import { Redis } from "ioredis";
import { db, clientEmbeddings, jobEmbeddings, jobMatches } from "@freelanceos/db";
import { eq, and, sql } from "drizzle-orm";
import crypto from "crypto";

export interface MatchComputeRequest {
  tenantId: string;
  ownerId: string;
  jobId: string; // The external job reference
}

/**
 * Chapter 8D: Pre-Filtered SQL Matching Engine
 * Safely executes asynchronous mathematical vector matching bounds for candidates
 * strictly protecting against synchronous thread starvation and cross-tenant leakages.
 */
export class JobMatchingEngineService {
  private mainRedis: Redis;
  private workerRedis: Redis;

  // Capped database chunk limit to prevent PostgreSQL pool exhaustion
  private readonly MAX_BATCH_SIZE = 50;

  constructor(redisUrl: string = process.env.REDIS_URL || "redis://localhost:6379") {
    this.mainRedis = new Redis(redisUrl);
    this.workerRedis = new Redis(redisUrl);
  }

  /**
   * ASYNC MATRIX OFFLOADING
   * Offloads the intensive O(N) candidate calculations into our Redis Job Queue
   * to instantly return a non-blocking jobId and eliminate 504 timeouts.
   */
  public async enqueueMatching(request: MatchComputeRequest): Promise<string> {
    const taskId = crypto.randomUUID();
    const payload = JSON.stringify({ taskId, request });
    
    await this.mainRedis.hset(`match:job:${taskId}`, "status", "Queued");
    await this.mainRedis.lpush("job_matching:queue:pending", payload);
    
    return taskId;
  }

  /**
   * Background Execution Queue Listener
   */
  public async startWorker(signal?: AbortSignal): Promise<void> {
    console.log("[Job Matching] Worker online. Awaiting real-time matching matrices...");
    
    while (!signal?.aborted) {
      try {
        const result = await this.workerRedis.brpop("job_matching:queue:pending", 1);
        if (!result) continue;

        const [_, payloadString] = result;
        const { taskId, request } = JSON.parse(payloadString);

        // Execute dynamic mathematical matrices asynchronously
        this.computeMatches(taskId, request).catch(err => {
          console.error("[Job Matching Worker] Matrix calculation failure:", err);
        });
      } catch (e) {
        console.error("[Job Matching Worker] Queue pull error:", e);
        await new Promise(r => setTimeout(r, 1000));
      }
    }
  }

  /**
   * Core Pre-Filtered Matching Logic
   */
  public async computeMatches(taskId: string, request: MatchComputeRequest): Promise<void> {
    await this.mainRedis.hset(`match:job:${taskId}`, "status", "Processing");

    try {
      // 1. Fetch Target Job Vector (Strict Tenant Match)
      const [jobVectorRecord] = await db
        .select()
        .from(jobEmbeddings)
        .where(
          and(
            eq(jobEmbeddings.jobId, request.jobId),
            eq(jobEmbeddings.tenantId, request.tenantId)
          )
        )
        .limit(1);

      if (!jobVectorRecord) {
        throw new Error("Authorization fault: Job embedding missing or tenant boundary violated.");
      }

      // Convert array natively back to pgvector literal string format
      const vectorLiteral = JSON.stringify(jobVectorRecord.embedding);

      // 2. PRE-FILTERED SQL MATCHING ENGINE
      // Crucial: The `WHERE tenantId = ?` is deliberately invoked BEFORE the <=> operation.
      // The PostgreSQL Query Planner will filter the HNSW graph bounds down to the specific tenant
      // before attempting any expensive mathematical vector distance calculations.
      const candidateMatches = await db
        .select({
          clientId: clientEmbeddings.clientId,
          distance: sql<number>`${clientEmbeddings.embedding} <=> ${vectorLiteral}::vector`
        })
        .from(clientEmbeddings)
        .where(
          eq(clientEmbeddings.tenantId, request.tenantId)
        )
        .orderBy(sql`${clientEmbeddings.embedding} <=> ${vectorLiteral}::vector`)
        .limit(200); // Only capture the top 200 nearest profiles per job

      // 3. Batch Chunk Persistence (MAX_BATCH_SIZE)
      for (let i = 0; i < candidateMatches.length; i += this.MAX_BATCH_SIZE) {
        const chunk = candidateMatches.slice(i, i + this.MAX_BATCH_SIZE);
        
        await db.transaction(async (tx) => {
          const insertPayloads = chunk.map(candidate => ({
            id: crypto.randomUUID(),
            tenantId: request.tenantId,
            ownerId: request.ownerId,
            freelancerId: request.ownerId, // Mapping to user entity
            jobId: request.jobId,
            jobNormalizationId: "dynamic-vector-match",
            normalizationVersion: "v1",
            matchingVersion: "v1",
            status: "CREATED" as const,
            matchSignals: {
              vectorDistance: candidate.distance,
              matchedClientId: candidate.clientId
            }
          }));

          if (insertPayloads.length > 0) {
            await tx
              .insert(jobMatches)
              .values(insertPayloads)
              .onConflictDoNothing();
          }
        });
      }

      await this.mainRedis.hset(`match:job:${taskId}`, "status", "Completed");

    } catch (error: any) {
      console.error(`[Job Matching] Matrix ${taskId} calculation failed:`, error.message);
      await this.mainRedis.hset(`match:job:${taskId}`, "status", "Failed", "error", error.message);
    }
  }
}
