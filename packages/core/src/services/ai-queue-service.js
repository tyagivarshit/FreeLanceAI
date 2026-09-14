import Redis from "ioredis";
import crypto from "crypto";
/**
 * Issue 7 Fix: Asynchronous Queue & Streaming Pipeline Engine.
 * Moves heavy AI tasks to the background and streams chunks via Pub/Sub.
 */
export class AiQueueService {
    mainRedis;
    workerRedis; // Dedicated connection for blocking BRPOP
    constructor(redisUrl = process.env.REDIS_URL || "redis://localhost:6379") {
        this.mainRedis = new Redis(redisUrl);
        this.workerRedis = new Redis(redisUrl);
    }
    /**
     * 1. Queue Injection (Synchronous Wait Bypass)
     * Enqueues the prompt and returns a jobId instantly (0ms latency).
     */
    async enqueueRequest(options) {
        const jobId = crypto.randomUUID();
        const payload = JSON.stringify({ jobId, options });
        // Push to list and track state in hash
        await this.mainRedis.hset(`ai:job:${jobId}`, "status", "Queued");
        await this.mainRedis.lpush("ai:queue:pending", payload);
        return jobId;
    }
    /**
     * 2. Background Queue Processor
     * Pops jobs using efficient blocking array pop (no polling waste).
     */
    async startWorker() {
        console.log("[AI Queue Worker] Listening for async jobImports...");
        // Continuous event loop
        while (true) {
            try {
                // Block until a job arrives across all known queues
                const result = await this.workerRedis.brpop("ai:queue:pending", "reply:queue:pending", "rewrite:queue:pending", "tone:queue:pending", "grammar:queue:pending", 0);
                if (!result)
                    continue;
                const [queueName, payloadString] = result;
                const payload = JSON.parse(payloadString);
                if (queueName === "reply:queue:pending") {
                    const { ReplyGenerationEngineService } = await import("./generation-engine.service.js");
                    const engine = new ReplyGenerationEngineService(process.env.REDIS_URL);
                    await engine.processGenerationStream(payload.jobId, payload.request);
                }
                else if (queueName === "rewrite:queue:pending") {
                    const { ReplyRewriteEngineService } = await import("./rewrite-engine.service.js");
                    const engine = new ReplyRewriteEngineService(process.env.REDIS_URL);
                    await engine.processRewriteStream(payload.jobId, payload.request);
                }
                else if (queueName === "tone:queue:pending") {
                    const { ReplyToneEngineService } = await import("./tone-engine.service.js");
                    const engine = new ReplyToneEngineService(process.env.REDIS_URL);
                    await engine.processToneStream(payload.jobId, payload.request);
                }
                else if (queueName === "grammar:queue:pending") {
                    const { ReplyGrammarEngineService } = await import("./grammar-engine.service.js");
                    const engine = new ReplyGrammarEngineService(process.env.REDIS_URL);
                    await engine.processGrammarStream(payload.jobId, payload.request);
                }
                else {
                    // Default legacy AI queue
                    await this.processJobStream(payload.jobId, payload.options);
                }
            }
            catch (err) {
                console.error("[AI Queue Worker] Execution error:", err);
            }
        }
    }
    /**
     * 3. AI Stream Processing & Pub/Sub Broadcasting
     */
    async processJobStream(jobId, options) {
        await this.mainRedis.hset(`ai:job:${jobId}`, "status", "Processing");
        const channel = `ai:stream:${jobId}`;
        try {
            this.mainRedis.publish(channel, JSON.stringify({ type: "start", jobId }));
            // Call LLM with native stream=true for chunk-by-chunk generation
            const fullResultText = await this.executeStreamingLlm(jobId, channel, options);
            // Phase 6 Grand Worker Routing Matrix
            if (options.contextReference) {
                if (options.contextReference.startsWith("scope_extraction_")) {
                    const clientId = options.contextReference.split("_")[2];
                    const { ScopeExtractionEngineService } = await import("./scope-extraction-engine.js");
                    const scopeExtractor = new ScopeExtractionEngineService(this, null);
                    await scopeExtractor.processExtractionResult(options.tenantId, clientId, fullResultText);
                }
                else if (options.contextReference.startsWith("scope_compliance_")) {
                    const clientId = options.contextReference.split("_")[2];
                    const { ScopeRulesEngineService } = await import("./scope-rules-engine.js");
                    const rulesEngine = new ScopeRulesEngineService(this, null);
                    await rulesEngine.processValidationResult(options.tenantId, clientId, fullResultText);
                }
                else if (options.contextReference.startsWith("confidence_scoring_")) {
                    const clientId = options.contextReference.split("_")[2];
                    const { ConfidenceScoringEngineService } = await import("./confidence-scoring-engine.js");
                    const confEngine = new ConfidenceScoringEngineService(this, null);
                    await confEngine.processScoringResult(options.tenantId, clientId, fullResultText);
                }
                else if (options.contextReference.startsWith("pricing_intelligence_")) {
                    const clientId = options.contextReference.split("_")[2];
                    const { PricingIntelligenceEngineService } = await import("./pricing-intelligence-engine.js");
                    const priceEngine = new PricingIntelligenceEngineService(this, null);
                    await priceEngine.processPricingResult(options.tenantId, clientId, fullResultText);
                }
            }
            await this.mainRedis.hset(`ai:job:${jobId}`, "status", "Completed");
            this.mainRedis.publish(channel, JSON.stringify({ type: "done", jobId }));
        }
        catch (error) {
            await this.mainRedis.hset(`ai:job:${jobId}`, "status", "Failed", "error", error.message);
            this.mainRedis.publish(channel, JSON.stringify({ type: "error", error: error.message }));
        }
    }
    async executeStreamingLlm(jobId, channel, options) {
        const apiKey = process.env.DEEPSEEK_API_KEY || "dummy_for_tests";
        // Native Node fetch call strictly optimized for streaming
        const response = await fetch("https://api.deepseek.com/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: "deepseek-chat",
                messages: [
                    { role: "system", content: options.systemPrompt },
                    { role: "user", content: options.userPrompt }
                ],
                temperature: options.temperature || 0.7,
                stream: true // Critical: Enables streaming chunk responses
            })
        });
        if (!response.ok || !response.body) {
            throw new Error(`LLM Connection Failed: HTTP ${response.status}`);
        }
        const reader = response.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let fullText = "";
        // Efficiently pipe network chunks directly to Redis Pub/Sub
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
                            fullText += token;
                            // High-frequency burst delivery to Redis channel
                            this.mainRedis.publish(channel, JSON.stringify({ type: "chunk", text: token }));
                        }
                    }
                    catch (e) { /* ignore fragmented JSON boundary */ }
                }
            }
        }
        return fullText;
    }
}
