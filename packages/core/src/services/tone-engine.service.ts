import { Redis } from "ioredis";
import * as crypto from "crypto";

export interface ToneAdjustmentRequest {
  tenantId: string;
  clientId: string;
  profileId?: string;
  originalText: string;
  targetTone: string;
}

export class ReplyToneEngineService {
  private mainRedis: Redis;
  private redisUrl: string;
  
  constructor(redisUrl: string = process.env.REDIS_URL || "redis://localhost:6379") {
    this.redisUrl = redisUrl;
    this.mainRedis = new Redis(redisUrl);
  }

  /**
   * STRICT TENANT PROFILE GUARD
   * Enforces a hard matching barrier between the current tenant_id and any requested
   * tone profile or configuration context before hitting persistence layers.
   */
  private async validateTenantProfile(tenantId: string, clientId: string, profileId?: string): Promise<boolean> {
    if (!tenantId || !clientId) {
      throw new Error("Validation Failed: Missing required tenant or client context.");
    }

    // 1. Client Context Guard
    const clientOwner = await this.mainRedis.get(`tenant:client:${clientId}:owner`);
    if (clientOwner && clientOwner !== tenantId) {
       throw new Error("Tenant Isolation Violation: Cross-tenant client access is strictly denied.");
    }

    // 2. Tone Profile Guard
    if (profileId) {
      const profileOwner = await this.mainRedis.get(`tenant:profile:${profileId}:owner`);
      if (profileOwner && profileOwner !== tenantId) {
        throw new Error("Tenant Isolation Violation: Unauthorized access to cross-tenant tone profile IP.");
      }
    }

    return true;
  }

  /**
   * Enqueue Tone Adjustment - Non-blocking Architecture
   * Offloads tone modification to Redis to prevent V8 event loop starvation and 504 timeouts.
   */
  async enqueueToneAdjustment(request: ToneAdjustmentRequest): Promise<string> {
    await this.validateTenantProfile(request.tenantId, request.clientId, request.profileId);

    const jobId = crypto.randomUUID();
    
    const payload = JSON.stringify({
      jobId,
      type: "tone_adjustment",
      request
    });

    await this.mainRedis.hset(`tone:job:${jobId}`, "status", "Queued");
    await this.mainRedis.lpush("tone:queue:pending", payload);

    return jobId;
  }

  /**
   * Dedicated background worker for Tone Adjustment tasks
   */
  async startWorker(signal?: AbortSignal): Promise<void> {
    const workerRedis = new Redis(this.redisUrl);
    console.log("[Tone Engine Worker] Listening for async tone adjustment jobImports...");
    
    while (!signal?.aborted) {
      try {
        const result = await workerRedis.brpop("tone:queue:pending", 1);
        if (!result) continue;

        const [_, payloadString] = result;
        const { jobId, request } = JSON.parse(payloadString);

        await this.processToneStream(jobId, request);
      } catch (err) {
        console.error("[Tone Engine Worker] Execution error:", err);
      }
    }
  }

  /**
   * ASYNC PUB/SUB TONE STREAMER
   * Feeds historical/large text blocks into DeepSeek stream blocks and broadcasts
   * output tokens natively to the ai:stream:jobId channel for real-time typing chunks.
   */
  public async processToneStream(jobId: string, request: ToneAdjustmentRequest) {
    await this.mainRedis.hset(`tone:job:${jobId}`, "status", "Processing");
    const channel = `ai:stream:${jobId}`;

    try {
      this.mainRedis.publish(channel, JSON.stringify({ type: "start", jobId }));
      
      const apiKey = process.env.DEEPSEEK_API_KEY || "dummy_for_tests";
      
      const systemPrompt = `You are a highly precise text tone-adjustment engine.
Your objective is to subtly adjust the tone of the provided text to match the requested target tone (${request.targetTone}).
Do NOT change the core meaning, facts, or technical details of the text.
Output ONLY the adjusted text. Do NOT include any markdown blocks, introductory phrases, or conversational filler.`;

      const response = await fetch("https://api.deepseek.com/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: "deepseek-chat",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: `Original Text:\n${request.originalText}` }
          ],
          temperature: 0.2, // Strict, low-temperature behavior for predictable tone mapping
          stream: true
        })
      });

      if (!response.ok || !response.body) {
         throw new Error(`Tone LLM Connection Failed: HTTP ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n").filter(line => line.trim() !== "");

        for (const line of lines) {
          if (line === "data: [DONE]") continue;
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              const token = data.choices?.[0]?.delta?.content;
              if (token) {
                // Broadcast completion tokens directly for real-time chunking
                this.mainRedis.publish(channel, JSON.stringify({ type: "chunk", text: token }));
              }
            } catch (e) { /* Absorb fragmented JSON boundaries safely */ }
          }
        }
      }

      await this.mainRedis.hset(`tone:job:${jobId}`, "status", "Completed");
      this.mainRedis.publish(channel, JSON.stringify({ type: "done", jobId }));
    } catch (error: any) {
      await this.mainRedis.hset(`tone:job:${jobId}`, "status", "Failed", "error", error.message);
      this.mainRedis.publish(channel, JSON.stringify({ type: "error", error: error.message }));
    }
  }
}
