import { AiQueueService } from "./ai-queue-service.js";
import { AiGatewayService } from "./ai-gateway-service.js";
import { db, clientScopeConfidenceScores } from "@freelanceos/db";
import { z } from "zod";
import crypto from "crypto";

// Strict Zod Whitelist Validator for Confidence Math Results
// This structurally prevents floating point overflows or malicious injection
export const ConfidenceMetricsSchema = z.object({
  baseScore: z.number().int().min(0).max(100),
  confidenceWeight: z.number().min(0.0).max(2.0), // Allows up to 2.0x weight multiplier
  validationMetadata: z.object({
    reasoning: z.string(),
    dataPointsEvaluated: z.number().int().min(0)
  })
});

export class ConfidenceScoringEngineService {
  constructor(
    private readonly queueService: AiQueueService,
    private readonly gatewayService: AiGatewayService
  ) {}

  /**
   * Enqueues an asynchronous confidence scoring computation job.
   * Completely bypasses V8 event loop math locking by offloading to the Redis Queue.
   */
  public async computeConfidenceMetrics(
    tenantId: string,
    clientId: string,
    extractedDataPayload: string
  ): Promise<string> {
    const promptPayload = `
      You are a precise data confidence scoring engine.
      Evaluate the provided extracted data and return the structural confidence metrics.
      
      EXTRACTED DATA:
      ${extractedDataPayload}
      
      Return ONLY a JSON object matching this structure:
      {
        "baseScore": number (0-100 integer),
        "confidenceWeight": number (0.0 to 1.0 floating point),
        "validationMetadata": {
          "reasoning": "string",
          "dataPointsEvaluated": number (integer count)
        }
      }
    `;

    // Push to background queue to prevent floating-point synchronous compute freezes
    const jobId = await this.queueService.enqueueRequest({
      tenantId,
      ownerId: "system",
      contextReference: `confidence_scoring_${clientId}`,
      systemPrompt: "You are an analytical scoring matrix evaluator.",
      userPrompt: promptPayload,
    });

    return jobId;
  }

  /**
   * Background Queue Worker Pipeline
   * Evaluates outcomes and calculates final adjusted math isolated from main API threads.
   */
  public async processScoringResult(
    tenantId: string,
    clientId: string,
    rawAiResponse: string
  ): Promise<void> {
    try {
      // 1. Clean the response of potential markdown
      const cleanJsonStr = rawAiResponse.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsedJson = JSON.parse(cleanJsonStr);

      // 2. Strict Zod-Shielded Extraction & Verification
      const safeMetrics = ConfidenceMetricsSchema.parse(parsedJson);

      // 3. Perform floating-point calculation synchronously IN THE WORKER ONLY
      const rawAdjusted = safeMetrics.baseScore * safeMetrics.confidenceWeight;
      const adjustedScoreStr = rawAdjusted.toFixed(4); // precision 8 scale 4 format

      // 4. Upsert isolated metrics directly to DB bypassing memory arrays
      await db.insert(clientScopeConfidenceScores)
        .values({
          id: crypto.randomUUID(),
          tenantId,
          clientId,
          baseScore: safeMetrics.baseScore,
          confidenceWeight: safeMetrics.confidenceWeight.toFixed(4),
          adjustedScore: adjustedScoreStr,
          validationMetadata: safeMetrics.validationMetadata
        })
        .onConflictDoUpdate({
          target: [clientScopeConfidenceScores.tenantId, clientScopeConfidenceScores.clientId],
          set: {
            baseScore: safeMetrics.baseScore,
            confidenceWeight: safeMetrics.confidenceWeight.toFixed(4),
            adjustedScore: adjustedScoreStr,
            validationMetadata: safeMetrics.validationMetadata,
            updatedAt: new Date()
          }
        });

    } catch (error) {
      console.error(`[ConfidenceScoringEngine] Background Math Failure for Client ${clientId}:`, error);
      throw error;
    }
  }
}
