import { Redis } from "ioredis";
import { db, jobImports, jobImports } from "@freelanceos/db";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import crypto from "crypto";

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

export interface NormalizationRequest {
  tenantId: string;
  ownerId: string;
  jobImportId: string;
}

/**
 * Chapter 8B: Throttled Semaphore Parsing Engine
 * Normalizes raw external job streams safely into our strict database types.
 */
export class JobNormalizationEngineService {
  private mainRedis: Redis;
  private workerRedis: Redis;

  // Max 5 concurrent tracks to protect downstream AI APIs from HTTP 429 errors
  private readonly MAX_CONCURRENT_TRACKS = 5;

  constructor(redisUrl: string = process.env.REDIS_URL || "redis://localhost:6379") {
    this.mainRedis = new Redis(redisUrl);
    this.workerRedis = new Redis(redisUrl);
  }

  /**
   * Pushes the job into the Redis async background queue.
   */
  public async enqueueNormalization(request: NormalizationRequest): Promise<string> {
    const jobId = crypto.randomUUID();
    const payload = JSON.stringify({ jobId, request });
    
    await this.mainRedis.hset(`norm:job:${jobId}`, "status", "Queued");
    await this.mainRedis.lpush("job_normalization:queue:pending", payload);
    
    return jobId;
  }

  /**
   * Executes as a background worker with strict semaphore concurrency pooling.
   */
  public async startWorker(signal?: AbortSignal): Promise<void> {
    console.log("[Job Normalization] Worker online. Awaiting tasks...");
    
    let activeExecutions = 0;

    while (!signal?.aborted) {
      if (activeExecutions >= this.MAX_CONCURRENT_TRACKS) {
        // Backpressure block if semaphore pool is saturated
        await new Promise(r => setTimeout(r, 100));
        continue;
      }

      try {
        const result = await this.workerRedis.brpop("job_normalization:queue:pending", 1);
        if (!result) continue;

        activeExecutions++;

        const [_, payloadString] = result;
        const { jobId, request } = JSON.parse(payloadString);

        // Fire off dynamically without awaiting the loop, creating parallel tracks
        this.processNormalization(jobId, request).finally(() => {
          activeExecutions--;
        });
      } catch (e) {
        console.error("[Job Normalization Worker] Error popping queue", e);
        await new Promise(r => setTimeout(r, 1000));
      }
    }
  }

  /**
   * Primary normalization parser logic.
   */
  public async processNormalization(jobId: string, request: NormalizationRequest): Promise<void> {
    await this.mainRedis.hset(`norm:job:${jobId}`, "status", "Processing");

    try {
      // 1. STRICT TENANT BOUNDARY: Cross-contamination Guard
      const [importRecord] = await db
        .select()
        .from(jobImports)
        .where(
          and(
            eq(jobImports.id, request.jobImportId),
            eq(jobImports.tenantId, request.tenantId)
          )
        )
        .limit(1);

      if (!importRecord) {
        throw new Error("Authorization fault: jobImportId not found or tenant mismatch. Operation force-dropped.");
      }

      // 2. DYNAMIC JITTER DELAYS
      // Add random 50-250ms jitter to explicitly prevent bursting the OpenAI/DeepSeek 429 rate limit bucket
      const jitter = Math.floor(Math.random() * 200) + 50;
      await new Promise(r => setTimeout(r, jitter));

      // 3. (Mocked LLM Processing)
      // Extract from the raw jsonb
      const rawString = JSON.stringify(importRecord.rawPayload);
      const extractedData = {
        title: importRecord.externalJobId + " - Extracted Role",
        description: rawString.substring(0, 500) + "...",
        budgetMin: 50,
        budgetMax: 200,
        currency: "USD",
        tags: ["contract", "backend"],
        skills: ["nodejs", "typescript"]
      };

      // 4. SANITIZE VIA ZOD
      const validated = NormalizationSchema.parse(extractedData);

      // 5. UPDATE DB TO NORMALIZED
      await db.transaction(async (tx) => {
        // Enforce postgres strictly typed bounds (text[], numeric(12,2))
        await tx.insert(jobs).values({
          id: crypto.randomUUID(),
          tenantId: request.tenantId,
          ownerId: request.ownerId,
          sourcePlatform: importRecord.source,
          externalJobId: importRecord.externalJobId,
          title: validated.title,
          description: validated.description,
          budgetMin: validated.budgetMin ? String(validated.budgetMin) : null,
          budgetMax: validated.budgetMax ? String(validated.budgetMax) : null,
          currency: validated.currency || null,
          tags: validated.tags,
          skills: validated.skills,
        }).onConflictDoNothing();

        // Mark import status lifecycle
        await tx.update(jobImports).set({ status: "IMPORTED" }).where(eq(jobImports.id, importRecord.id));
      });

      await this.mainRedis.hset(`norm:job:${jobId}`, "status", "Completed");

    } catch (error: any) {
      console.error(`[Job Normalization] Job ${jobId} failed:`, error.message);
      await this.mainRedis.hset(`norm:job:${jobId}`, "status", "Failed", "error", error.message);
    }
  }
}
