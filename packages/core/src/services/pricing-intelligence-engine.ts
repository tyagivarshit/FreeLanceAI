import { AiQueueService } from "./ai-queue-service.js";
import { AiGatewayService } from "./ai-gateway-service.js";
import { db, clientProjectPricingEstimates, clients } from "@freelanceos/db";
import { eq } from "drizzle-orm";
import { z } from "zod";
import crypto from "crypto";

// Strict Zod Whitelist Validator for Financial Metrics
export const PricingIntelligenceSchema = z.object({
  currencyCode: z.string().length(3).default("USD"),
  estimatedBudget: z.number().min(0),
  hourlyTargetRate: z.number().min(0),
  platformMarkup: z.number().min(0).max(100), // percentage basis point representation
  pricingMetadata: z.object({
    marketRateAnalysis: z.string(),
    complexityMultiplier: z.number().min(0)
  })
});

export class PricingIntelligenceEngineService {
  constructor(
    private readonly queueService: AiQueueService,
    private readonly gatewayService: AiGatewayService
  ) {}

  /**
   * Enqueues an asynchronous pricing intelligence computation job.
   * Completely bypasses V8 event loop math locking by offloading to the Redis Queue.
   */
  public async computeProjectPricing(
    tenantId: string,
    clientId: string,
    extractedScopePayload: string
  ): Promise<string> {
    const promptPayload = `
      You are an enterprise pricing estimation engine.
      Analyze the provided project scope and generate structured financial estimations.
      
      PROJECT SCOPE:
      ${extractedScopePayload}
      
      Return ONLY a JSON object matching this strict structural financial model:
      {
        "currencyCode": "string (e.g. USD, EUR, GBP)",
        "estimatedBudget": number (raw float),
        "hourlyTargetRate": number (raw float),
        "platformMarkup": number (percentage e.g. 15 for 15%),
        "pricingMetadata": {
          "marketRateAnalysis": "string",
          "complexityMultiplier": number (float)
        }
      }
    `;

    // Push to background queue to prevent floating-point synchronous compute freezes
    const jobId = await this.queueService.enqueueRequest({
      tenantId,
      ownerId: "system",
      contextReference: `pricing_intelligence_${clientId}`,
      systemPrompt: "You are a precise financial pricing estimator.",
      userPrompt: promptPayload,
    });

    return jobId;
  }

  /**
   * Background Queue Worker Pipeline
   * Evaluates outcomes and calculates exact floating-point margin math isolated from API threads.
   */
  public async processPricingResult(
    tenantId: string,
    clientId: string,
    rawAiResponse: string
  ): Promise<void> {
    try {
      // 0. Pre-Flight Tenancy Validation Guard (Cross-Tenant Hardware Bypass Block)
      const [clientRecord] = await db.select().from(clients).where(eq(clients.id, clientId)).limit(1);
      if (!clientRecord || clientRecord.tenantId !== tenantId) {
        throw new Error(`UnauthorizedAccessException: Tenancy violation detected. Client ${clientId} does not belong to Tenant ${tenantId}.`);
      }

      // 1. Clean the response of potential markdown
      const cleanJsonStr = rawAiResponse.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsedJson = JSON.parse(cleanJsonStr);

      // 2. Strict Zod-Shielded Extraction & Verification
      const safePricing = PricingIntelligenceSchema.parse(parsedJson);

      // 3. Perform financial calculations IN THE WORKER ONLY
      const markupMultiplier = safePricing.platformMarkup / 100;
      const rawTotalEstimatedValue = safePricing.estimatedBudget * (1 + markupMultiplier);

      const estimatedBudgetStr = safePricing.estimatedBudget.toFixed(2);
      const hourlyTargetRateStr = safePricing.hourlyTargetRate.toFixed(2);
      const platformMarkupStr = safePricing.platformMarkup.toFixed(2);
      const totalEstimatedValueStr = rawTotalEstimatedValue.toFixed(2);

      // 4. Upsert isolated metrics directly to DB avoiding cross-tenant state bleed
      await db.insert(clientProjectPricingEstimates)
        .values({
          tenantId,
          clientId,
          currencyCode: safePricing.currencyCode,
          estimatedBudget: estimatedBudgetStr,
          hourlyTargetRate: hourlyTargetRateStr,
          platformMarkup: platformMarkupStr,
          totalEstimatedValue: totalEstimatedValueStr,
          pricingMetadata: safePricing.pricingMetadata
        })
        .onConflictDoUpdate({
          target: [clientProjectPricingEstimates.tenantId, clientProjectPricingEstimates.clientId],
          set: {
            currencyCode: safePricing.currencyCode,
            estimatedBudget: estimatedBudgetStr,
            hourlyTargetRate: hourlyTargetRateStr,
            platformMarkup: platformMarkupStr,
            totalEstimatedValue: totalEstimatedValueStr,
            pricingMetadata: safePricing.pricingMetadata,
            updatedAt: new Date()
          }
        });

      // 5. Immutable Compliance Footprinting (Audit Log Ledger Trigger)
      const { eventDispatcher } = await import("@freelanceos/auth");
      eventDispatcher.dispatch("SCOPE_INTELLIGENCE_COMPLETED", {
        tenantId,
        clientId,
        module: "PRICING_INTELLIGENCE",
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error(`[PricingIntelligenceEngine] Background Financial Failure for Client ${clientId}:`, error);
      throw error;
    }
  }
}
