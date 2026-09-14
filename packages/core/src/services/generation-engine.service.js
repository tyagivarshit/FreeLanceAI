import { Redis } from "ioredis";
import * as crypto from "crypto";
export class ReplyGenerationEngineService {
    mainRedis;
    redisUrl;
    constructor(redisUrl = process.env.REDIS_URL || "redis://localhost:6379") {
        this.redisUrl = redisUrl;
        this.mainRedis = new Redis(redisUrl);
    }
    /**
     * Pre-flight Auth Entity Guard
     * Validates tenant authorization to prevent cross-tenant data leaks.
     */
    async validateTenantAccess(tenantId, clientId) {
        if (!tenantId || !clientId) {
            throw new Error("Pre-flight Validation Failed: Missing tenant or client identifier.");
        }
        // Strict pre-flight tenant check to prevent cross-tenant asset extraction
        const clientOwner = await this.mainRedis.get(`tenant:client:${clientId}:owner`);
        if (clientOwner && clientOwner !== tenantId) {
            throw new Error("Security Violation: Cross-tenant access denied.");
        }
        return true;
    }
    /**
     * Enqueues proposal generation for asynchronous background execution.
     * Returns a jobId immediately to eliminate HTTP 504 timeouts.
     */
    async enqueueProposalGeneration(request) {
        // 1. Strict pre-flight check before fetching templates/scopes
        await this.validateTenantAccess(request.tenantId, request.clientId);
        const jobId = crypto.randomUUID();
        const payload = JSON.stringify({
            jobId,
            type: "proposal_generation",
            request
        });
        // 2. Offload generation task into Redis Job Queue
        await this.mainRedis.hset(`reply:job:${jobId}`, "status", "Queued");
        await this.mainRedis.lpush("reply:queue:pending", payload);
        // 3. Return instant jobId
        return jobId;
    }
    /**
     * Background Worker for Proposal Generation
     * Offloads heavy generation tasks to background stream loops.
     */
    async startWorker(signal) {
        const workerRedis = new Redis(this.redisUrl);
        console.log("[Reply Generation Worker] Listening for async proposal jobImports...");
        while (!signal?.aborted) {
            try {
                const result = await workerRedis.brpop("reply:queue:pending", 1);
                if (!result)
                    continue;
                const [_, payloadString] = result;
                const { jobId, request } = JSON.parse(payloadString);
                await this.processGenerationStream(jobId, request);
            }
            catch (err) {
                console.error("[Reply Generation Worker] Execution error:", err);
            }
        }
    }
    /**
     * Background Execution Track using DeepSeek Stream Loops
     * Pipes output tokens directly through Redis Pub/Sub (ai:stream:jobId)
     */
    async processGenerationStream(jobId, request) {
        await this.mainRedis.hset(`reply:job:${jobId}`, "status", "Processing");
        const channel = `ai:stream:${jobId}`;
        try {
            this.mainRedis.publish(channel, JSON.stringify({ type: "start", jobId }));
            const apiKey = process.env.DEEPSEEK_API_KEY || "dummy_for_tests";
            // DATA MESH INTERCONNECTION: Phase 6 client_scopes extraction
            let scopeContext = "";
            try {
                const { db, clientScopes } = await import("@freelanceos/db");
                const { eq, and } = await import("drizzle-orm");
                const scopes = await db.select().from(clientScopes).where(and(eq(clientScopes.tenantId, request.tenantId), eq(clientScopes.clientId, request.clientId)));
                if (scopes && scopes.length > 0) {
                    scopeContext = "\n\nClient Extracted Scopes:\n" + JSON.stringify(scopes);
                }
            }
            catch (e) {
                console.warn("[Generation Engine] Could not load client_scopes:", e);
            }
            const systemPrompt = `You are an expert B2B proposal generation assistant.
Your task is to draft a highly professional, high-converting freelance proposal based on the user's instructions.
Output ONLY the proposal text. Do NOT include markdown blocks, introductory phrases, or conversational filler.${scopeContext}`;
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
                        { role: "user", content: request.userPrompt }
                    ],
                    temperature: 0.7,
                    stream: true // Essential for character-by-character streaming
                })
            });
            if (!response.ok || !response.body) {
                throw new Error(`LLM Connection Failed: HTTP ${response.status}`);
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
                                // Pipe output tokens directly to Redis Pub/Sub
                                this.mainRedis.publish(channel, JSON.stringify({ type: "chunk", text: token }));
                            }
                        }
                        catch (e) { /* ignore fragmented JSON boundary */ }
                    }
                }
            }
            await this.mainRedis.hset(`reply:job:${jobId}`, "status", "Completed");
            this.mainRedis.publish(channel, JSON.stringify({ type: "done", jobId }));
        }
        catch (error) {
            await this.mainRedis.hset(`reply:job:${jobId}`, "status", "Failed", "error", error.message);
            this.mainRedis.publish(channel, JSON.stringify({ type: "error", error: error.message }));
        }
    }
}
