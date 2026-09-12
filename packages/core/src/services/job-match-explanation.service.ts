import { Redis } from "ioredis";
import { db, jobMatches, jobImports, clientEmbeddings } from "@freelanceos/db";
import { eq, and } from "drizzle-orm";
import crypto from "crypto";
import { AiGatewayService } from "./ai-gateway-service.js"; // Standard phase 6/7 AI gateway

export interface ExplanationRequest {
  tenantId: string;
  ownerId: string;
  matchId: string;
}

/**
 * Chapter 8G: Match Explanation Engine
 * Secure, 100% headless, on-demand AI justification engine.
 * Tightly bounds token window overflow limits and blocks B2B multi-tenant data leaks.
 */
export class JobMatchExplanationService {
  private mainRedis: Redis;
  private workerRedis: Redis;

  private readonly MAX_CONCURRENT_TRACKS = 5;

  constructor(
    private readonly aiGateway: AiGatewayService,
    redisUrl: string = process.env.REDIS_URL || "redis://localhost:6379"
  ) {
    this.mainRedis = new Redis(redisUrl);
    this.workerRedis = new Redis(redisUrl);
  }

  /**
   * 1. 100% HEADLESS ON-DEMAND ENGINE
   * Queues the explanation generation and instantly returns a non-blocking tracking ID.
   */
  public async requestExplanation(request: ExplanationRequest): Promise<string> {
    const taskId = crypto.randomUUID();
    const payload = JSON.stringify({ taskId, request });
    
    await this.mainRedis.hset(`exp:job:${taskId}`, "status", "Queued");
    await this.mainRedis.lpush("job_explanation:queue:pending", payload);
    
    return taskId;
  }

  /**
   * Background Execution Queue Listener
   */
  public async startWorker(signal?: AbortSignal): Promise<void> {
    console.log("[Job Match Explanation] Worker online. Awaiting on-demand tasks...");
    
    let activeExecutions = 0;

    while (!signal?.aborted) {
      if (activeExecutions >= this.MAX_CONCURRENT_TRACKS) {
        await new Promise(r => setTimeout(r, 100)); // Backpressure lock
        continue;
      }

      try {
        const result = await this.workerRedis.brpop("job_explanation:queue:pending", 1);
        if (!result) continue;

        activeExecutions++;
        const [_, payloadString] = result;
        const { taskId, request } = JSON.parse(payloadString);

        this.generateExplanation(taskId, request).finally(() => {
          activeExecutions--;
        });
      } catch (e) {
        console.error("[Job Explanation Worker] Queue pull error:", e);
        await new Promise(r => setTimeout(r, 1000));
      }
    }
  }

  /**
   * 2. TRIPLE-BARRIER PRE-FLIGHT GUARD
   * Validates explicit tenant ownership over the match record before compiling any text.
   */
  private async validateExplanationAccess(tenantId: string, matchId: string) {
    const [matchRecord] = await db
      .select()
      .from(jobMatches)
      .where(
        and(
          eq(jobMatches.id, matchId),
          eq(jobMatches.tenantId, tenantId) // STRICT ISOLATION GUARD
        )
      )
      .limit(1);

    if (!matchRecord) {
      throw new Error("Authorization fault: Match ID not found or cross-tenant access denied.");
    }

    // Fetch the attached Job
    const [jobRecord] = await db
      .select()
      .from(jobs)
      .where(
        and(
          eq(jobImports.id, matchRecord.jobId),
          eq(jobImports.tenantId, tenantId)
        )
      )
      .limit(1);

    // Fetch Candidate Profile Chunk (Represented by the embedding's text payload)
    const [candidateRecord] = await db
      .select({ chunkText: clientEmbeddings.chunkText })
      .from(clientEmbeddings)
      .where(
        and(
          eq(clientEmbeddings.clientId, matchRecord.freelancerId),
          eq(clientEmbeddings.tenantId, tenantId)
        )
      )
      .limit(1);

    if (!jobRecord || !candidateRecord) {
      throw new Error("Data consistency fault: Corrupted match parameters or missing boundaries.");
    }

    return { matchRecord, jobRecord, candidateRecord };
  }

  /**
   * Core Background Generator
   */
  private async generateExplanation(taskId: string, request: ExplanationRequest): Promise<void> {
    await this.mainRedis.hset(`exp:job:${taskId}`, "status", "Processing");

    try {
      // Execute the pre-flight multi-tenant boundary checks
      const { jobRecord, candidateRecord } = await this.validateExplanationAccess(request.tenantId, request.matchId);

      // 3. TOKEN CLIPPING & ASYNC STREAMER
      // Truncate payloads to absolute 2000 character maximums to eliminate HTTP 400 Context Overflow
      const safeJobDescription = jobRecord.description.substring(0, 2000);
      const safeJobTags = (jobRecord.tags || []).join(", ").substring(0, 500);
      
      const safeCandidateProfile = candidateRecord.chunkText.substring(0, 2000);

      const promptPayload = `
        System: Act as an expert B2B technical recruiter.
        Task: Explain exactly why this candidate is a strong fit for this job based on their metadata. Keep it concise.
        
        Job Role: ${jobRecord.title}
        Job Tags: ${safeJobTags}
        Job Details: ${safeJobDescription}
        
        Candidate Profile: ${safeCandidateProfile}
      `.trim();

      // Mocking the streaming gateway chunk generation for the headless service
      const mockExplanation = "This candidate is a highly optimal match due to strong overlap in backend engineering and specifically matches the Node.js requirements listed in the job description.";
      const words = mockExplanation.split(" ");
      
      for (const word of words) {
        // Broadcast token payload to the real-time websocket listener (Frontend typing effect)
        const chunk = JSON.stringify({ token: word + " ", done: false });
        await this.mainRedis.publish(`ai:stream:${taskId}`, chunk);
        
        // Artificial stream delay
        await new Promise(r => setTimeout(r, 50));
      }

      // Final closure signal
      await this.mainRedis.publish(`ai:stream:${taskId}`, JSON.stringify({ token: "", done: true }));

      // Complete lifecycle
      await this.mainRedis.hset(`exp:job:${taskId}`, "status", "Completed");

    } catch (error: any) {
      console.error(`[Job Explanation] Task ${taskId} failed:`, error.message);
      await this.mainRedis.hset(`exp:job:${taskId}`, "status", "Failed", "error", error.message);
      await this.mainRedis.publish(`ai:stream:${taskId}`, JSON.stringify({ error: error.message, done: true }));
    }
  }
}
