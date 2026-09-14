import { Redis } from "ioredis";
import * as crypto from "crypto";
export class ReplyRewriteEngineService {
    mainRedis;
    redisUrl;
    constructor(redisUrl = process.env.REDIS_URL || "redis://localhost:6379") {
        this.redisUrl = redisUrl;
        this.mainRedis = new Redis(redisUrl);
    }
    /**
     * STRICT INTERSECTION INTER-LOCKS
     * Enforces strict pre-flight checks matching the current tenant_id with any
     * historical documentId or client context requested.
     */
    async validateStrictIntersection(tenantId, clientId, documentId) {
        if (!tenantId || !clientId) {
            throw new Error("Validation Failed: Missing required tenant or client context.");
        }
        // 1. Client Intersection Lock
        const clientOwner = await this.mainRedis.get(`tenant:client:${clientId}:owner`);
        if (clientOwner && clientOwner !== tenantId) {
            throw new Error("Tenant Isolation Violation: Cross-tenant client context access strictly denied.");
        }
        // 2. Document Intersection Lock (If historical context requested)
        if (documentId) {
            const documentOwner = await this.mainRedis.get(`tenant:document:${documentId}:owner`);
            if (documentOwner && documentOwner !== tenantId) {
                throw new Error("Tenant Isolation Violation: Cross-tenant document context access strictly denied.");
            }
        }
        return true;
    }
    /**
     * Enqueue Text Rewrite - Non-blocking Architecture
     * Offloads generation to Job Queue returning instant jobId to negate 504 timeouts.
     */
    async enqueueTextRewrite(request) {
        await this.validateStrictIntersection(request.tenantId, request.clientId, request.documentId);
        const jobId = crypto.randomUUID();
        const payload = JSON.stringify({
            jobId,
            type: "text_rewrite",
            request
        });
        await this.mainRedis.hset(`rewrite:job:${jobId}`, "status", "Queued");
        await this.mainRedis.lpush("rewrite:queue:pending", payload);
        return jobId;
    }
    /**
     * Dedicated background worker for Text Rewrite tasks
     */
    async startWorker(signal) {
        const workerRedis = new Redis(this.redisUrl);
        console.log("[Rewrite Engine Worker] Listening for async rewrite jobImports...");
        while (!signal?.aborted) {
            try {
                // 1-second timeout blocking pop to allow for graceful abort check
                const result = await workerRedis.brpop("rewrite:queue:pending", 1);
                if (!result)
                    continue;
                const [_, payloadString] = result;
                const { jobId, request } = JSON.parse(payloadString);
                await this.processRewriteStream(jobId, request);
            }
            catch (err) {
                console.error("[Rewrite Engine Worker] Execution error:", err);
            }
        }
    }
    /**
     * ASYNC PUB/SUB REWRITE STREAMER
     * Feeds instructions into DeepSeek stream blocks and broadcasts output tokens
     * natively to the ai:stream:jobId channel for real-time frontend consumption.
     */
    async processRewriteStream(jobId, request) {
        await this.mainRedis.hset(`rewrite:job:${jobId}`, "status", "Processing");
        const channel = `ai:stream:${jobId}`;
        try {
            this.mainRedis.publish(channel, JSON.stringify({ type: "start", jobId }));
            const apiKey = process.env.DEEPSEEK_API_KEY || "dummy_for_tests";
            // Rewrite constraints: strict, deterministic edits. No conversational bloat.
            const systemPrompt = `You are an expert text rewrite engine.
Your sole purpose is to rewrite the provided text according to the instructions provided.
Output ONLY the final rewritten string. Do NOT include markdown blocks, introductory sentences, or conversational filler.`;
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
                        { role: "user", content: `Instructions: ${request.rewriteInstructions}\n\nOriginal Text: ${request.originalText}` }
                    ],
                    temperature: 0.3, // Lower temperature to retain structural fidelity
                    stream: true
                })
            });
            if (!response.ok || !response.body) {
                throw new Error(`Rewrite LLM Connection Failed: HTTP ${response.status}`);
            }
            const reader = response.body.getReader();
            const decoder = new TextDecoder("utf-8");
            while (true) {
                const { done, value } = await reader.read();
                if (done)
                    break;
                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split("\n").filter(line => line.trim() !== "");
                for (const line of lines) {
                    if (line === "data: [DONE]")
                        continue;
                    if (line.startsWith("data: ")) {
                        try {
                            const data = JSON.parse(line.slice(6));
                            const token = data.choices?.[0]?.delta?.content;
                            if (token) {
                                // Publish token chunks directly for real-time string typing
                                this.mainRedis.publish(channel, JSON.stringify({ type: "chunk", text: token }));
                            }
                        }
                        catch (e) { /* Handle fragmented JSON boundaries gracefully */ }
                    }
                }
            }
            await this.mainRedis.hset(`rewrite:job:${jobId}`, "status", "Completed");
            this.mainRedis.publish(channel, JSON.stringify({ type: "done", jobId }));
        }
        catch (error) {
            await this.mainRedis.hset(`rewrite:job:${jobId}`, "status", "Failed", "error", error.message);
            this.mainRedis.publish(channel, JSON.stringify({ type: "error", error: error.message }));
        }
    }
}
