import { db, clientScopes } from "@freelanceos/db";
import { z } from "zod";
// Strict Zod Whitelist Validator Schema
// Completely filters out unallowed object properties or privilege escalation attempts
// If an LLM hallucinates an arbitrary column (e.g. "role": "admin"), Zod will strip it.
export const ExtractionScopeSchema = z.object({
    budgetRange: z.string().optional(),
    technicalRequirements: z.array(z.string()).default([]),
    timelineExpectations: z.string().optional(),
    keyDeliverables: z.array(z.string()).default([]),
});
export class ScopeExtractionEngineService {
    queueService;
    gatewayService;
    constructor(queueService, gatewayService) {
        this.queueService = queueService;
        this.gatewayService = gatewayService;
    }
    /**
     * Enqueues the heavy project detail document for asynchronous scope extraction.
     * Prevents 504 Gateway Timeouts by instantly returning a tracking jobId.
     */
    async enqueueExtractionJob(tenantId, clientId, documentText) {
        const promptPayload = `
      Extract the project scope details from the following document.
      Return ONLY a JSON object matching this structure:
      {
        "budgetRange": "string",
        "technicalRequirements": ["string"],
        "timelineExpectations": "string",
        "keyDeliverables": ["string"]
      }
      
      Document:
      ${documentText}
    `;
        // 1. Push payload configuration to our Redis Job Queue
        const jobId = await this.queueService.enqueueRequest({
            tenantId,
            ownerId: "system", // Executed under system background context
            contextReference: `scope_extraction_${clientId}`,
            systemPrompt: "You are a precise data extraction assistant.",
            userPrompt: promptPayload,
        });
        // 2. Instantly return jobId to prevent synchronous load balancer choke points
        return jobId;
    }
    /**
     * Background Execution Loop Handler (Worker Pipeline)
     * Parses AI results through a strict Zod whitelist validator schema before saving to the DB.
     */
    async processExtractedResult(tenantId, clientId, rawAiResponse, originalText) {
        try {
            // 1. Clean the response of potential markdown formatting
            const cleanJsonStr = rawAiResponse.replace(/```json/g, '').replace(/```/g, '').trim();
            const parsedJson = JSON.parse(cleanJsonStr);
            // 2. Strict Zod-Shielded Validation (Whitelisting & Escaping)
            const safeData = ExtractionScopeSchema.parse(parsedJson);
            // 3. Upsert to DB with strict composite uniqueness (tenant_id + client_id)
            await db.insert(clientScopes)
                .values({
                tenantId,
                clientId,
                projectSpecs: safeData,
                rawTextData: originalText,
            })
                .onConflictDoUpdate({
                target: [clientScopes.tenantId, clientScopes.clientId],
                set: {
                    projectSpecs: safeData,
                    rawTextData: originalText,
                    updatedAt: new Date()
                }
            });
        }
        catch (error) {
            console.error(`[ScopeExtractionEngine] Verification Error for Client ${clientId}:`, error);
            // Fails safely without corrupting the dynamic client profile
            throw error;
        }
    }
}
