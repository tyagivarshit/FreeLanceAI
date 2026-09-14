import crypto from "crypto";
export class GatewayRateLimitError extends Error {
    constructor(message) {
        super(message);
        this.name = "GatewayRateLimitError";
    }
}
export class AiGatewayService {
    deepseekApiKey;
    qwenApiKey;
    repo;
    usageRepo;
    // Example: 1 Million Tokens per day per tenant limit
    DAILY_TOKEN_LIMIT = 1000000;
    constructor(repo, usageRepo, env) {
        this.repo = repo;
        this.usageRepo = usageRepo;
        this.deepseekApiKey = env.DEEPSEEK_API_KEY || "";
        this.qwenApiKey = env.QWEN_API_KEY || "";
    }
    async generate(options) {
        const logId = crypto.randomUUID();
        // 1. Initial State: Received
        await this.logState(logId, options, "Received", { model: "pending" });
        // 2. Pre-flight Token Reservation (Hold)
        const estimatedPromptTokens = Math.ceil((options.systemPrompt.length + options.userPrompt.length) / 4);
        const estimatedCompletionTokens = 2000; // Assume max burst
        const estimatedTotalCost = estimatedPromptTokens + estimatedCompletionTokens;
        const today = new Date().toISOString().split('T')[0];
        const usageKey = `ai_usage:${options.tenantId}:${today}`;
        // Atomically reserve the estimated tokens
        const reservation = await this.usageRepo.consume(usageKey, this.DAILY_TOKEN_LIMIT, estimatedTotalCost);
        if (!reservation.success) {
            const msg = `Daily AI Quota Reached. Required: ${estimatedTotalCost}, Current Usage: ${reservation.current}/${this.DAILY_TOKEN_LIMIT}. Upgrade for unlimited burst.`;
            await this.logState(logId, options, "Failed", { error: msg });
            throw new GatewayRateLimitError(msg);
        }
        try {
            // 3. Orchestrating
            await this.logState(logId, options, "Orchestrating", { step: "calling_deepseek" });
            let result = await this.callDeepSeek(options);
            if (!result.success) {
                console.warn(`[AI Gateway] DeepSeek failed for ${logId}. Falling back to Qwen... Error: ${result.error}`);
                await this.logState(logId, options, "Orchestrating", { step: "calling_qwen_fallback", previousError: result.error });
                result = await this.callQwen(options);
                if (!result.success) {
                    throw new Error(`Both Primary and Fallback AI models failed. Last Error: ${result.error}`);
                }
            }
            // 4. Post-flight Settlement (Refund)
            const actualUsage = result.usage.totalTokens;
            if (estimatedTotalCost > actualUsage) {
                // Refund the unused reserved tokens
                await this.usageRepo.refund(usageKey, estimatedTotalCost - actualUsage);
            }
            else if (actualUsage > estimatedTotalCost) {
                // Deduct extra tokens if the LLM hallucinated beyond our safety margin
                await this.usageRepo.consume(usageKey, this.DAILY_TOKEN_LIMIT, actualUsage - estimatedTotalCost);
            }
            // 5. Completed
            await this.logState(logId, options, "Completed", {
                modelUsed: result.modelUsed,
                usage: result.usage,
                reservationCost: estimatedTotalCost
            });
            return result;
        }
        catch (error) {
            // 6. Full Refund on Complete Failure
            await this.usageRepo.refund(usageKey, estimatedTotalCost);
            await this.logState(logId, options, "Failed", { error: error.message });
            if (error instanceof GatewayRateLimitError) {
                return { success: false, content: "", modelUsed: "none", usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 }, error: error.message };
            }
            return { success: false, content: "", modelUsed: "none", usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 }, error: error.message };
        }
    }
    async callDeepSeek(options) {
        if (!this.deepseekApiKey)
            return { success: false, content: "", modelUsed: "deepseek", usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 }, error: "DeepSeek API key missing" };
        try {
            const response = await fetch("https://api.deepseek.com/chat/completions", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${this.deepseekApiKey}`
                },
                body: JSON.stringify({
                    model: "deepseek-chat",
                    messages: [
                        { role: "system", content: options.systemPrompt },
                        { role: "user", content: options.userPrompt }
                    ],
                    temperature: options.temperature || 0.7
                })
            });
            if (!response.ok) {
                const errText = await response.text();
                return { success: false, content: "", modelUsed: "deepseek", usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 }, error: `HTTP ${response.status}: ${errText}` };
            }
            const data = await response.json();
            return {
                success: true,
                content: data.choices[0]?.message?.content || "",
                modelUsed: "deepseek-v4",
                usage: {
                    promptTokens: data.usage?.prompt_tokens || 0,
                    completionTokens: data.usage?.completion_tokens || 0,
                    totalTokens: data.usage?.total_tokens || 0,
                }
            };
        }
        catch (e) {
            return { success: false, content: "", modelUsed: "deepseek", usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 }, error: e.message };
        }
    }
    async callQwen(options) {
        if (!this.qwenApiKey)
            return { success: false, content: "", modelUsed: "qwen", usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 }, error: "Qwen API key missing" };
        try {
            const response = await fetch("https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${this.qwenApiKey}`
                },
                body: JSON.stringify({
                    model: "qwen-max",
                    messages: [
                        { role: "system", content: options.systemPrompt },
                        { role: "user", content: options.userPrompt }
                    ],
                    temperature: options.temperature || 0.7
                })
            });
            if (!response.ok) {
                const errText = await response.text();
                return { success: false, content: "", modelUsed: "qwen", usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 }, error: `HTTP ${response.status}: ${errText}` };
            }
            const data = await response.json();
            return {
                success: true,
                content: data.choices[0]?.message?.content || "",
                modelUsed: "qwen-max",
                usage: {
                    promptTokens: data.usage?.prompt_tokens || 0,
                    completionTokens: data.usage?.completion_tokens || 0,
                    totalTokens: data.usage?.total_tokens || 0,
                }
            };
        }
        catch (e) {
            return { success: false, content: "", modelUsed: "qwen", usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 }, error: e.message };
        }
    }
    async logState(id, options, status, metadataExtra = {}) {
        try {
            await this.repo.saveLog({
                id,
                tenantId: options.tenantId,
                ownerId: options.ownerId,
                requestContextReference: options.contextReference,
                status: status,
                metadata: {
                    systemPromptLength: options.systemPrompt.length,
                    userPromptLength: options.userPrompt.length,
                    ...metadataExtra
                }
            });
        }
        catch (e) {
            console.error("[AI Gateway] Failed to persist log state:", e);
        }
    }
}
