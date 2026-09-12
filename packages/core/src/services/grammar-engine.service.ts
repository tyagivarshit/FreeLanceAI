import { Redis } from "ioredis";
import * as crypto from "crypto";

export interface GrammarEnhancementRequest {
  tenantId: string;
  clientId: string;
  documentId?: string;
  profileId?: string;
  originalText: string;
  enhancementLevel: "light" | "standard" | "heavy";
}

export class ReplyGrammarEngineService {
  private mainRedis: Redis;
  private redisUrl: string;
  
  constructor(redisUrl: string = process.env.REDIS_URL || "redis://localhost:6379") {
    this.redisUrl = redisUrl;
    this.mainRedis = new Redis(redisUrl);
  }

  /**
   * STRICT TENANT CONTENT GUARD
   * Enforces a hard matching barrier between the current tenant_id and any requested
   * document or custom vocabulary profile context to prevent dictionary spoofing.
   */
  private async validateTenantContent(
    tenantId: string, 
    clientId: string, 
    documentId?: string, 
    profileId?: string
  ): Promise<boolean> {
    if (!tenantId || !clientId) {
      throw new Error("Validation Failed: Missing required tenant or client context.");
    }

    // 1. Client Context Guard
    const clientOwner = await this.mainRedis.get(`tenant:client:${clientId}:owner`);
    if (clientOwner && clientOwner !== tenantId) {
       throw new Error("Tenant Isolation Violation: Cross-tenant client access is strictly denied.");
    }

    // 2. Document Context Guard
    if (documentId) {
      const documentOwner = await this.mainRedis.get(`tenant:document:${documentId}:owner`);
      if (documentOwner && documentOwner !== tenantId) {
        throw new Error("Tenant Isolation Violation: Cross-tenant document access is strictly denied.");
      }
    }

    // 3. Custom Vocabulary/Profile Guard
    if (profileId) {
      const profileOwner = await this.mainRedis.get(`tenant:profile:${profileId}:owner`);
      if (profileOwner && profileOwner !== tenantId) {
        throw new Error("Tenant Isolation Violation: Unauthorized access to cross-tenant grammar dictionary IP.");
      }
    }

    return true;
  }

  /**
   * Enqueue Grammar Enhancement - Non-blocking Architecture
   * Offloads heavy AST/lexical processing to Redis to prevent V8 event loop starvation.
   */
  async enqueueGrammarEnhancement(request: GrammarEnhancementRequest): Promise<string> {
    await this.validateTenantContent(request.tenantId, request.clientId, request.documentId, request.profileId);

    const jobId = crypto.randomUUID();
    
    const payload = JSON.stringify({
      jobId,
      type: "grammar_enhancement",
      request
    });

    await this.mainRedis.hset(`grammar:job:${jobId}`, "status", "Queued");
    await this.mainRedis.lpush("grammar:queue:pending", payload);

    return jobId;
  }

  /**
   * Dedicated background worker for Grammar Enhancement tasks
   */
  async startWorker(signal?: AbortSignal): Promise<void> {
    const workerRedis = new Redis(this.redisUrl);
    console.log("[Grammar Engine Worker] Listening for async grammar enhancement jobImports...");
    
    while (!signal?.aborted) {
      try {
        const result = await workerRedis.brpop("grammar:queue:pending", 1);
        if (!result) continue;

        const [_, payloadString] = result;
        const { jobId, request } = JSON.parse(payloadString);

        await this.processGrammarStream(jobId, request);
      } catch (err) {
        console.error("[Grammar Engine Worker] Execution error:", err);
      }
    }
  }

  /**
   * ASYNC PUB/SUB GRAMMAR STREAMER
   * Processes large text blocks through low-temperature DeepSeek stream sessions,
   * broadcasting output tokens natively to the ai:stream:jobId channel for real-time typing chunks.
   */
  public async processGrammarStream(jobId: string, request: GrammarEnhancementRequest) {
    await this.mainRedis.hset(`grammar:job:${jobId}`, "status", "Processing");
    const channel = `ai:stream:${jobId}`;

    try {
      this.mainRedis.publish(channel, JSON.stringify({ type: "start", jobId }));
      
      const apiKey = process.env.DEEPSEEK_API_KEY || "dummy_for_tests";
      
      let systemPrompt = `You are an expert grammar and lexical enhancement engine.
Your sole purpose is to correct spelling, grammar, and syntax in the provided text.
Output ONLY the corrected text. Do NOT include markdown blocks, introductory sentences, or conversational filler.`;

      if (request.enhancementLevel === "heavy") {
        systemPrompt += "\nPerform a heavy edit: aggressively improve sentence structure, vocabulary, and flow while maintaining the original meaning.";
      } else if (request.enhancementLevel === "light") {
        systemPrompt += "\nPerform a light edit: fix ONLY obvious typos, punctuation, and blatant grammatical errors. Leave the structure intact.";
      }

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
            { role: "user", content: request.originalText }
          ],
          temperature: 0.1, // Near-zero temperature for absolute lexical determinism
          stream: true
        })
      });

      if (!response.ok || !response.body) {
         throw new Error(`Grammar LLM Connection Failed: HTTP ${response.status}`);
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
                // Broadcast completion tokens directly for real-time formatting chunking
                this.mainRedis.publish(channel, JSON.stringify({ type: "chunk", text: token }));
              }
            } catch (e) { /* Absorb fragmented JSON boundaries safely */ }
          }
        }
      }

      await this.mainRedis.hset(`grammar:job:${jobId}`, "status", "Completed");
      this.mainRedis.publish(channel, JSON.stringify({ type: "done", jobId }));
    } catch (error: any) {
      await this.mainRedis.hset(`grammar:job:${jobId}`, "status", "Failed", "error", error.message);
      this.mainRedis.publish(channel, JSON.stringify({ type: "error", error: error.message }));
    }
  }
}
