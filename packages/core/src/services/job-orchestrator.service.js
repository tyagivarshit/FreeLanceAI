import { Redis } from "ioredis";
import crypto from "crypto";
/**
 * Chapter 8I: Background Worker Orchestrator Chains
 * 100% Headless event orchestrator driving the entire matching macro-workflow.
 */
export class JobMatchingOrchestratorService {
    normalizationEngine;
    embeddingEngine;
    matchingEngine;
    cacheService;
    mainRedis;
    workerRedis;
    constructor(normalizationEngine, embeddingEngine, matchingEngine, cacheService, redisUrl = process.env.REDIS_URL || "redis://localhost:6379") {
        this.normalizationEngine = normalizationEngine;
        this.embeddingEngine = embeddingEngine;
        this.matchingEngine = matchingEngine;
        this.cacheService = cacheService;
        this.mainRedis = new Redis(redisUrl);
        this.workerRedis = new Redis(redisUrl);
    }
    /**
     * Kicks off the asynchronous background chain by enveloping the tenant context.
     */
    async startPipeline(tenantId, ownerId, jobImportId) {
        const pipelineId = crypto.randomUUID();
        await this.dispatchStage({
            tenantId,
            ownerId,
            jobImportId,
            stage: "NORMALIZE",
            attempt: 1
        });
        return pipelineId;
    }
    /**
     * 2. IRONCLAD TENANT CONTEXT ENVELOPE
     * Explicitly passes the strict B2B isolation boundaries throughout the Redis network.
     */
    async dispatchStage(envelope) {
        if (!envelope.tenantId || !envelope.ownerId) {
            throw new Error("Fatal: Orchestration envelope missing strict B2B isolation boundaries.");
        }
        const payload = JSON.stringify(envelope);
        await this.mainRedis.lpush("orchestrator:queue:pending", payload);
    }
    /**
     * Subscriber execution harness for distributed workflow stages.
     */
    async startWorker(signal) {
        console.log("[Job Orchestrator] Worker online. Managing distributed pipelines...");
        while (!signal?.aborted) {
            try {
                const result = await this.workerRedis.brpop("orchestrator:queue:pending", 1);
                if (!result)
                    continue;
                const [_, payloadString] = result;
                const envelope = JSON.parse(payloadString);
                this.processStage(envelope).catch((err) => {
                    console.error(`[Orchestrator] Core fallback crash processing stage ${envelope.stage}:`, err);
                });
            }
            catch (e) {
                console.error("[Orchestrator] Queue pull error:", e);
                await new Promise((r) => setTimeout(r, 1000));
            }
        }
    }
    async processStage(envelope) {
        const attempt = envelope.attempt || 1;
        const internalTaskId = crypto.randomUUID();
        try {
            switch (envelope.stage) {
                case "NORMALIZE":
                    await this.normalizationEngine.processNormalization(internalTaskId, {
                        tenantId: envelope.tenantId,
                        ownerId: envelope.ownerId,
                        jobImportId: envelope.jobImportId
                    });
                    // Note: The normalization engine internally upserts a new `jobs` row matching the `jobImportId`.
                    // We will mock the `jobId` here, but in production, we query the new job mapped to `jobImportId`.
                    const resolvedJobId = envelope.jobId || `job-${envelope.jobImportId}`;
                    await this.dispatchStage({
                        ...envelope,
                        jobId: resolvedJobId,
                        stage: "EMBED",
                        attempt: 1
                    });
                    break;
                case "EMBED":
                    if (!envelope.jobId)
                        throw new Error("Missing jobId context for EMBED stage.");
                    await this.embeddingEngine.ingestJobEmbedding(internalTaskId, {
                        tenantId: envelope.tenantId,
                        ownerId: envelope.ownerId,
                        jobId: envelope.jobId
                    });
                    await this.dispatchStage({ ...envelope, stage: "MATCH", attempt: 1 });
                    break;
                case "MATCH":
                    if (!envelope.jobId)
                        throw new Error("Missing jobId context for MATCH stage.");
                    await this.matchingEngine.computeMatches(internalTaskId, {
                        tenantId: envelope.tenantId,
                        ownerId: envelope.ownerId,
                        jobId: envelope.jobId
                    });
                    await this.dispatchStage({ ...envelope, stage: "CACHE_INVALIDATE", attempt: 1 });
                    break;
                case "CACHE_INVALIDATE":
                    if (!envelope.jobId)
                        throw new Error("Missing jobId context for CACHE_INVALIDATE stage.");
                    // Trigger explicit write-through Redis deletion
                    await this.cacheService.invalidateJobCache(envelope.tenantId, envelope.jobId);
                    // Global compliance ledger tracking
                    console.log(`[AUDIT_LOG_TRIGGERED] Tenant: ${envelope.tenantId} | Job: ${envelope.jobId} | Action: COMPLETE_MATCHING_PIPELINE`);
                    await this.mainRedis.publish("audit:global:ledger", JSON.stringify({
                        eventType: "AUDIT_LOG_TRIGGERED",
                        tenantId: envelope.tenantId,
                        jobId: envelope.jobId,
                        timestamp: new Date().toISOString()
                    }));
                    break;
            }
        }
        catch (error) {
            console.error(`[Orchestrator] Stage ${envelope.stage} failed for JobImport ${envelope.jobImportId}. Attempt ${attempt}. Error: ${error.message}`);
            // 3. EXPONENTIAL BACKOFF RETRY & AUDIT HARNESS
            // Protects the macro-pipeline against transient LLM API timeouts or PG connection drops
            if (attempt < 5) {
                const backoffMs = attempt * 2000;
                console.log(`[Orchestrator] Retrying stage ${envelope.stage} in ${backoffMs}ms...`);
                setTimeout(() => {
                    this.dispatchStage({ ...envelope, attempt: attempt + 1 }).catch(e => console.error("Retry dispatch failed:", e));
                }, backoffMs);
            }
            else {
                console.error(`[Orchestrator] FATAL: Pipeline permanently crashed at stage ${envelope.stage} after 5 attempts.`);
            }
        }
    }
}
