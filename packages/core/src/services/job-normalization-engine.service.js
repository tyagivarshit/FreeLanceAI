import { Redis } from "ioredis";
import { db, jobImports } from "@freelanceos/db";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
// 3. Strict Zod Barrier for LLM Data
const NormalizationSchema = z.object({
    title: z.string().max(500),
    description: z.string(),
    budgetMin: z.coerce.number().min(0).optional().nullable(),
    budgetMax: z.coerce.number().min(0).optional().nullable(),
    currency: z.string().max(3).optional().nullable(),
    tags: z.array(z.string()).default([]),
    skills: z.array(z.string()).default([])
});
/**
 * Chapter 8B: Throttled Semaphore Parsing Engine
 * Enforces rate limits across upstream APIs/AI while securely sandboxing dirty data.
 */
export class JobNormalizationEngine {
    mainRedis;
    throttleRedis;
    MAX_CONCURRENT_PARSES = 10;
    constructor(redisUrl = process.env.REDIS_URL || "redis://localhost:6379") {
        this.mainRedis = new Redis(redisUrl);
        this.throttleRedis = new Redis(redisUrl);
    }
    async enqueueNormalization(request) {
        const { tenantId, jobImportId } = request;
        // 1. Pre-validation checks
        if (!tenantId || !jobImportId)
            throw new Error("Missing required fields for Normalization.");
        // 2. Insert onto distributed queue
        await this.mainRedis.lpush("queue:normalization", JSON.stringify(request));
        await this.mainRedis.hset(`norm:job:${jobImportId}`, "status", "Queued");
    }
    async processQueueWorker() {
        while (true) {
            const activeCount = await this.throttleRedis.get("throttle:normalization:active");
            if (Number(activeCount) >= this.MAX_CONCURRENT_PARSES) {
                await new Promise((r) => setTimeout(r, 1000));
                continue;
            }
            const jobDataStr = await this.mainRedis.rpop("queue:normalization");
            if (!jobDataStr) {
                await new Promise((r) => setTimeout(r, 2000));
                continue;
            }
            await this.throttleRedis.incr("throttle:normalization:active");
            try {
                const req = JSON.parse(jobDataStr);
                await this.executeNormalization(req);
            }
            finally {
                await this.throttleRedis.decr("throttle:normalization:active");
            }
        }
    }
    async executeNormalization(request) {
        const jobId = request.jobImportId;
        await this.mainRedis.hset(`norm:job:${jobId}`, "status", "Processing");
        try {
            // 1. Fetch unnormalized raw payload
            const [importRecord] = await db
                .select()
                .from(jobImports)
                .where(and(eq(jobImports.id, jobId), eq(jobImports.tenantId, request.tenantId)))
                .limit(1);
            if (!importRecord)
                throw new Error("Job Import not found or cross-tenant access denied.");
            if (importRecord.status !== "RECEIVED")
                throw new Error("Job already processed.");
            // 2. Emulate AI processing (mocking actual gateway)
            //    In real life this goes to ReRanking/AI-Gateway
            const rawText = JSON.stringify(importRecord.rawPayload);
            const extractedTitle = rawText.substring(0, 50) + "...";
            const extractedDesc = rawText.substring(0, 100);
            // 3. Strict Zod Boundary
            const validated = NormalizationSchema.parse({
                title: extractedTitle,
                description: extractedDesc,
                budgetMin: 50,
                budgetMax: 100,
                currency: "USD",
                tags: ["software", "ai"],
                skills: ["typescript", "react"],
            });
            // 5. UPDATE DB TO NORMALIZED
            await db.transaction(async (tx) => {
                // Enforce postgres strictly typed bounds (text[], numeric(12,2))
                await tx.update(jobImports).set({
                    status: "IMPORTED",
                    rawPayload: {
                        title: validated.title,
                        description: validated.description,
                        budget: { type: "fixed", minimum: validated.budgetMin, maximum: validated.budgetMax, currency: validated.currency },
                        skills: validated.skills
                    }
                }).where(eq(jobImports.id, importRecord.id));
            });
            await this.mainRedis.hset(`norm:job:${jobId}`, "status", "Completed");
        }
        catch (error) {
            console.error(`[Job Normalization] Job ${jobId} failed:`, error.message);
            await this.mainRedis.hset(`norm:job:${jobId}`, "status", "Failed", "error", error.message);
        }
    }
}
