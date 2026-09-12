import { db, clientInsights } from "@freelanceos/db";
import { eq, and } from "drizzle-orm";
import crypto from "crypto";
import { AiGatewayService, GatewayRequestOptions } from "./ai-gateway-service.js";
import { logger } from "@freelanceos/logger";
import { eventDispatcher } from "@freelanceos/auth";

export interface ExtractedInsight {
  insightKey: string;
  title: string;
  description: string;
  confidenceScore: number;
}

export interface InsightJobContext {
  tenantId: string;
  clientId: string;
  rawContextData: string;
  analysisFocus: string;
}

/**
 * Dynamic Pool Throttling Manager (Concurrency Control)
 * Strictly limits parallel executions and introduces micro-jitters
 * to prevent HTTP 429 Rate Limit crashes on the AI Gateway.
 */
class ThrottledQueueManager {
  private activeCount = 0;
  private readonly queue: Array<() => void> = [];
  private readonly CONCURRENCY_LIMIT = 5; // Safe threshold for AI Gateway

  public async enqueue<T>(task: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const execute = async () => {
        this.activeCount++;
        
        // Micro-jitter (50ms - 200ms) to prevent instantaneous burst spikes
        const jitter = Math.floor(Math.random() * 150) + 50;
        await new Promise((r) => setTimeout(r, jitter));

        try {
          const result = await task();
          resolve(result);
        } catch (err) {
          reject(err);
        } finally {
          this.activeCount--;
          this.pump();
        }
      };

      if (this.activeCount < this.CONCURRENCY_LIMIT) {
        execute();
      } else {
        this.queue.push(execute);
      }
    });
  }

  private pump() {
    if (this.queue.length > 0 && this.activeCount < this.CONCURRENCY_LIMIT) {
      const next = this.queue.shift();
      if (next) next();
    }
  }
}

/**
 * Chapter 4C: Core Insights Engine
 * Orchestrates extraction of B2B patterns through the throttler and
 * saves them securely to the relational database to prevent multi-tenant leaks.
 */
export class InsightEngineService {
  private gateway: AiGatewayService;
  private throttler: ThrottledQueueManager;

  constructor(gateway: AiGatewayService) {
    this.gateway = gateway;
    this.throttler = new ThrottledQueueManager();
  }

  /**
   * Safely dispatches a background task to analyze data and extract insights.
   * Completely rate-limit resistant.
   */
  public async extractAndSaveInsight(context: InsightJobContext): Promise<void> {
    await this.throttler.enqueue(async () => {
      try {
        const rawResponse = await this.gateway.generate({
          systemPrompt: `You are an expert B2B analyst. Focus: ${context.analysisFocus}. 
          Analyze the data and extract exactly one key strategic insight. 
          Return ONLY valid JSON: {"insightKey": "e.g. CHURN_RISK", "title": "string", "description": "string", "confidenceScore": number (0-100)}`,
          userPrompt: context.rawContextData,
          contextReference: `insight_extraction_${context.clientId}`,
        });

        // Strip markdown backticks if present
        const cleanJson = rawResponse.content.replace(/```json/g, "").replace(/```/g, "").trim();
        const parsed: ExtractedInsight = JSON.parse(cleanJson);

        await this.persistInsight(context.tenantId, context.clientId, parsed);
        
      } catch (error) {
        logger.error({ 
          message: "[InsightEngine] Failed to extract insight", 
          clientId: context.clientId, 
          error 
        });
      }
    });
  }

  /**
   * Strictly isolated database atomic persistence.
   */
  private async persistInsight(tenantId: string, clientId: string, insight: ExtractedInsight): Promise<void> {
    await db.transaction(async (tx) => {
      const insightId = crypto.randomUUID();

      await tx
        .insert(clientInsights)
        .values({
          id: insightId,
          tenantId,
          clientId,
          insightKey: insight.insightKey.toUpperCase().replace(/\s+/g, '_'),
          title: insight.title,
          description: insight.description,
          confidenceScore: insight.confidenceScore,
          status: "ACTIVE",
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          // Multi-tenant protection: DO UPDATE on exact match to refresh existing insight
          target: [clientInsights.tenantId, clientInsights.clientId, clientInsights.insightKey],
          set: {
            title: insight.title,
            description: insight.description,
            confidenceScore: insight.confidenceScore,
            updatedAt: new Date(),
          }
        });

      // Emit event for real-time subscribers
      await eventDispatcher.publish("INSIGHT_GENERATED", {
        insightId,
        tenantId,
        clientId,
        insightKey: insight.insightKey,
      });
    });
  }
}

export class InsightRepository {
  /**
   * Retrieves active insights securely bound to the tenant scope.
   */
  public async getActiveInsights(tenantId: string, clientId: string) {
    return await db
      .select()
      .from(clientInsights)
      .where(
        and(
          eq(clientInsights.tenantId, tenantId),
          eq(clientInsights.clientId, clientId),
          eq(clientInsights.status, "ACTIVE")
        )
      );
  }
}
