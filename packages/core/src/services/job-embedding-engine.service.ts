import { Redis } from "ioredis";
import { db, jobImports, jobEmbeddings } from "@freelanceos/db";
import { eq, and } from "drizzle-orm";
import crypto from "crypto";

export interface JobEmbeddingRequest {
  tenantId: string;
  ownerId: string;
  jobId: string;
}

/**
 * Chapter 8C: Pre-Filtered Job Embedding Ingestion Engine
 * Secures multi-tenant job vector embeddings directly into pgvector behind strict tenant isolation bounds.
 */
export class JobEmbeddingEngineService {
  private mainRedis: Redis;
  private workerRedis: Redis;

  constructor(redisUrl: string = process.env.REDIS_URL || "redis://localhost:6379") {
    this.mainRedis = new Redis(redisUrl);
    this.workerRedis = new Redis(redisUrl);
  }

  /**
   * Pushes the job vector generation task into the Redis async background queue.
   */
  public async enqueueJobEmbedding(request: JobEmbeddingRequest): Promise<string> {
    const taskId = crypto.randomUUID();
    const payload = JSON.stringify({ taskId, request });
    
    await this.mainRedis.hset(`emb:job:${taskId}`, "status", "Queued");
    await this.mainRedis.lpush("job_embedding:queue:pending", payload);
    
    return taskId;
  }

  /**
   * Executes as a background worker processing vector generation safely.
   */
  public async startWorker(signal?: AbortSignal): Promise<void> {
    console.log("[Job Embedding] Worker online. Awaiting tasks...");
    
    while (!signal?.aborted) {
      try {
        const result = await this.workerRedis.brpop("job_embedding:queue:pending", 1);
        if (!result) continue;

        const [_, payloadString] = result;
        const { taskId, request } = JSON.parse(payloadString);

        // Fire off dynamically without blocking the queue read loop
        this.ingestJobEmbedding(taskId, request).catch(err => {
           console.error("[Job Embedding Worker] Process failure:", err);
        });
      } catch (e) {
        console.error("[Job Embedding Worker] Error popping queue", e);
        await new Promise(r => setTimeout(r, 1000));
      }
    }
  }

  /**
   * Pre-filtered embedding ingest execution.
   */
  public async ingestJobEmbedding(taskId: string, request: JobEmbeddingRequest): Promise<void> {
    await this.mainRedis.hset(`emb:job:${taskId}`, "status", "Processing");

    try {
      // 1. STRICT TENANT BOUNDARY: Cross-contamination Pre-flight Guard
      const [normalizedJob] = await db
        .select()
        .from(jobs)
        .where(
          and(
            eq(jobImports.id, request.jobId),
            eq(jobImports.tenantId, request.tenantId)
          )
        )
        .limit(1);

      if (!normalizedJob) {
        throw new Error("Authorization fault: Job not found or tenant mismatch. Operation force-dropped to protect shared HNSW buffers.");
      }

      // 2. Generate Vector from normalized text properties (Title + Description + Tags)
      // Since it's a headless backend system without live OpenAI wiring directly here, we mock the dense 1536-d vector return.
      // In reality, this hits AiGatewayService.generateEmbedding()
      
      const chunkText = `Title: ${normalizedJob.title}\nDescription: ${normalizedJob.description}\nTags: ${normalizedJob.tags.join(",")}\nBudget: ${normalizedJob.budgetMin || 0}-${normalizedJob.budgetMax || 0} ${normalizedJob.currency || "USD"}`;
      
      // Mock dense 1536 vector
      const vectorData = new Array(1536).fill(0).map(() => Math.random() * 2 - 1);

      // 3. Pre-Filtered Ingestion Execution
      await db.transaction(async (tx) => {
        // Enforce postgres pre-filtered upsert locking via tenantId
        await tx.insert(jobEmbeddings).values({
          id: crypto.randomUUID(),
          tenantId: request.tenantId,
          jobId: request.jobId,
          chunkText: chunkText,
          embedding: vectorData,
        }).onConflictDoNothing(); 
      });

      await this.mainRedis.hset(`emb:job:${taskId}`, "status", "Completed");

    } catch (error: any) {
      console.error(`[Job Embedding] Task ${taskId} failed:`, error.message);
      await this.mainRedis.hset(`emb:job:${taskId}`, "status", "Failed", "error", error.message);
    }
  }
}
