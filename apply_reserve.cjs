const fs = require("fs");

let gatewayFile = "packages/core/src/services/ai-gateway-service.ts";
let content = fs.readFileSync(gatewayFile, "utf8");

// We need to replace the generate() method block.
const generateRegex = /async generate\(options: GatewayRequestOptions\): Promise<GatewayResponse> \{[\s\S]*?private async callDeepSeek/m;

const newGenerate = `async generate(options: GatewayRequestOptions): Promise<GatewayResponse> {
    const logId = crypto.randomUUID();
    
    // 1. Initial State: Received
    await this.logState(logId, options, "Received", { model: "pending" });

    // 2. Pre-flight Token Reservation (Hold)
    const estimatedPromptTokens = Math.ceil((options.systemPrompt.length + options.userPrompt.length) / 4);
    const estimatedCompletionTokens = 2000; // Assume max burst
    const estimatedTotalCost = estimatedPromptTokens + estimatedCompletionTokens;

    const today = new Date().toISOString().split('T')[0];
    const usageKey = \`ai_usage:\${options.tenantId}:\${today}\`;
    
    // Atomically reserve the estimated tokens
    const reservation = await this.usageRepo.consume(usageKey, this.DAILY_TOKEN_LIMIT, estimatedTotalCost, 86400);
    if (!reservation.success) {
      const msg = \`Daily AI Quota Reached. Required: \${estimatedTotalCost}, Current Usage: \${reservation.current}/\${this.DAILY_TOKEN_LIMIT}. Upgrade for unlimited burst.\`;
      await this.logState(logId, options, "Failed", { error: msg });
      throw new GatewayRateLimitError(msg);
    }

    try {
      // 3. Orchestrating
      await this.logState(logId, options, "Orchestrating", { step: "calling_deepseek" });
      
      let result = await this.callDeepSeek(options);
      
      if (!result.success) {
        console.warn(\`[AI Gateway] DeepSeek failed for \${logId}. Falling back to Qwen... Error: \${result.error}\`);
        await this.logState(logId, options, "Orchestrating", { step: "calling_qwen_fallback", previousError: result.error });
        
        result = await this.callQwen(options);
        
        if (!result.success) {
          throw new Error(\`Both Primary and Fallback AI models failed. Last Error: \${result.error}\`);
        }
      }

      // 4. Post-flight Settlement (Refund)
      const actualUsage = result.usage.totalTokens;
      if (estimatedTotalCost > actualUsage) {
        // Refund the unused reserved tokens
        await this.usageRepo.refund(usageKey, estimatedTotalCost - actualUsage);
      } else if (actualUsage > estimatedTotalCost) {
        // Deduct extra tokens if the LLM hallucinated beyond our safety margin
        await this.usageRepo.consume(usageKey, this.DAILY_TOKEN_LIMIT, actualUsage - estimatedTotalCost, 86400);
      }

      // 5. Completed
      await this.logState(logId, options, "Completed", { 
        modelUsed: result.modelUsed, 
        usage: result.usage,
        reservationCost: estimatedTotalCost
      });

      return result;

    } catch (error: any) {
      // 6. Full Refund on Complete Failure
      await this.usageRepo.refund(usageKey, estimatedTotalCost);
      await this.logState(logId, options, "Failed", { error: error.message });
      
      if (error instanceof GatewayRateLimitError) {
        return { success: false, content: "", modelUsed: "none", usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 }, error: error.message };
      }

      return { success: false, content: "", modelUsed: "none", usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 }, error: error.message };
    }
  }

  private async callDeepSeek`;

content = content.replace(generateRegex, newGenerate);
fs.writeFileSync(gatewayFile, content);
console.log("AiGatewayService updated with Reserve and Refund logic.");
