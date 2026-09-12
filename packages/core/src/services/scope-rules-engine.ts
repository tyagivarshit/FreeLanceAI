import { AiQueueService } from "./ai-queue-service.js";
import { AiGatewayService } from "./ai-gateway-service.js";
import { db, scopeComplianceRules, scopeRuleViolationsLog } from "@freelanceos/db";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import crypto from "crypto";

// Strict Zod Whitelist Validator for Rule Validations
export const RuleValidationResultSchema = z.object({
  isCompliant: z.boolean(),
  violations: z.array(
    z.object({
      ruleKey: z.string(),
      reason: z.string(),
    })
  ).default([]),
});

export class ScopeRulesEngineService {
  constructor(
    private readonly queueService: AiQueueService,
    private readonly gatewayService: AiGatewayService
  ) {}

  /**
   * Enqueues an asynchronous compliance validation job.
   * Completely bypasses N+1 validation loops on the main thread by offloading to the Redis Queue.
   */
  public async validateScopeCompliance(
    tenantId: string,
    clientId: string,
    extractedDataLogs: string
  ): Promise<string> {
    
    // Parameterized Data Boundaries:
    // Extracting rules explicitly via strict Drizzle bounds locks cross-tenant bleed.
    const activeRules = await db.select()
      .from(scopeComplianceRules)
      .where(
        and(
          eq(scopeComplianceRules.tenantId, tenantId),
          eq(scopeComplianceRules.isActive, true)
        )
      );

    if (activeRules.length === 0) {
      // No rules to validate against
      return "skipped-no-rules";
    }

    const rulesMatrix = activeRules.map(r => `- [${r.ruleKey}]: ${r.description}`).join("\n");

    const promptPayload = `
      You are a strict compliance validation engine.
      Evaluate the provided extracted data against the following rules.
      
      RULES:
      ${rulesMatrix}
      
      EXTRACTED DATA:
      ${extractedDataLogs}
      
      Return ONLY a JSON object matching this structure:
      {
        "isCompliant": boolean,
        "violations": [
          { "ruleKey": "string", "reason": "string" }
        ]
      }
    `;

    // Push to background queue to prevent event loop gridlock
    const jobId = await this.queueService.enqueueRequest({
      tenantId,
      ownerId: "system",
      contextReference: `scope_compliance_${clientId}`,
      systemPrompt: "You are a rigid compliance matrix evaluator.",
      userPrompt: promptPayload,
    });

    return jobId;
  }

  /**
   * Background Queue Worker Pipeline
   * Evaluates outcomes and records isolated violations.
   */
  public async processValidationResult(
    tenantId: string,
    clientId: string,
    rawAiResponse: string
  ): Promise<void> {
    try {
      // 0. Pre-Flight Tenancy Validation Guard
      const clientRecord = await db.query.clients.findFirst({
        where: (clients, { eq }) => eq(clients.id, clientId)
      });
      if (!clientRecord || clientRecord.tenantId !== tenantId) {
        throw new Error(`UnauthorizedAccessException: Tenancy violation detected. Client ${clientId} does not belong to Tenant ${tenantId}.`);
      }

      // 1. Clean the response of potential markdown
      const cleanJsonStr = rawAiResponse.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsedJson = JSON.parse(cleanJsonStr);

      // 2. Strict Zod-Shielded Result Extraction
      const safeValidation = RuleValidationResultSchema.parse(parsedJson);

      if (!safeValidation.isCompliant && safeValidation.violations.length > 0) {
        // Log violations securely to the database
        const insertPayloads = safeValidation.violations.map(violation => ({
          id: crypto.randomUUID(),
          tenantId,
          clientId,
          ruleKey: violation.ruleKey,
          violationContext: { reason: violation.reason }
        }));
        await db.insert(scopeRuleViolationsLog).values(insertPayloads);
      }

      // 4. Immutable Compliance Footprinting (Audit Log Ledger Trigger)
      const { eventDispatcher } = await import("@freelanceos/auth");
      eventDispatcher.dispatch("SCOPE_INTELLIGENCE_COMPLETED", {
        tenantId,
        clientId,
        module: "SCOPE_COMPLIANCE_RULES",
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error(`[ScopeRulesEngine] Background Validation Failure for Client ${clientId}:`, error);
      throw error;
    }
  }
}
