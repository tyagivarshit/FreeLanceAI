const fs = require("fs");

let serverCode = fs.readFileSync("apps/web/server.js", "utf8");

if (!serverCode.includes("PromptTemplateEngine")) {
  serverCode = serverCode.replace(
    'import { AiGatewayService } from "@freelanceos/core";',
    'import { AiGatewayService, PromptTemplateEngine } from "@freelanceos/core";'
  );
}

const newGenerate = `
  // AI Gateway Generation Endpoint
  if (pathname === "/api/generate" && req.method === "POST") {
    const auth = await checkAuthentication();
    const ownerId = requireAuthenticatedOwner(auth);
    if (!ownerId) return;

    try {
      const data = await readJsonBody();
      
      const gatewayRepo = new PostgresGatewayRepository();
      const usageRepo = new RedisUsageRepository();
      const cacheStore = new RedisCacheStore();
      const promptRepo = new PostgresPromptRepository(cacheStore);
      
      const gatewayEnv = {
        DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY || "",
        QWEN_API_KEY: process.env.QWEN_API_KEY || ""
      };
      
      const aiGateway = new AiGatewayService(gatewayRepo, usageRepo, gatewayEnv);

      // --- Prompt Injection & Caching Pipeline ---
      let systemPrompt = data.systemPrompt || "You are a helpful assistant.";
      
      if (data.promptReference) {
        // Fetch from Redis Cache instantly!
        const promptDef = await promptRepo.getActivePromptByReference(auth.tenantId, data.promptReference);
        if (!promptDef) {
          sendJson(404, { success: false, error: "Active Prompt not found in Registry" });
          return;
        }
        
        // Secure Injection
        const variables = data.variables || {};
        systemPrompt = PromptTemplateEngine.compile(promptDef.definition.text || "", variables);
      }
      // -------------------------------------------

      const aiResult = await aiGateway.generate({
        tenantId: auth.tenantId,
        ownerId: ownerId,
        contextReference: data.contextReference || "manual_test",
        systemPrompt: systemPrompt,
        userPrompt: data.userPrompt || "",
        temperature: data.temperature || 0.7
      });

      if (!aiResult.success) {
        if (aiResult.error && aiResult.error.includes("Daily AI Quota Reached")) {
          sendJson(429, { success: false, error: aiResult.error });
        } else {
          sendJson(502, { success: false, error: "AI Generation Failed", details: aiResult.error });
        }
        return;
      }

      sendJson(200, { success: true, item: aiResult });
    } catch(e) { handleClientApiError(e); }
    return;
  }
`;

const oldGenerate = /\/\/ AI Gateway Generation Endpoint[\s\S]*?if \(pathname === "\/api\/policies"/;
serverCode = serverCode.replace(oldGenerate, newGenerate.trim() + '\n  if (pathname === "/api/policies"');

fs.writeFileSync("apps/web/server.js", serverCode);
console.log("Patched generate API with Prompt Engine");
