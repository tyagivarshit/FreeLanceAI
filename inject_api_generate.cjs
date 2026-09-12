const fs = require('fs');

let serverCode = fs.readFileSync('apps/web/server.js', 'utf8');

// Inject imports if not present
if (!serverCode.includes('AiGatewayService')) {
  serverCode = serverCode.replace(
    'import {',
    'import { AiGatewayService, PostgresGatewayRepository } from "@freelanceos/db";\nimport { RedisUsageRepository } from "@freelanceos/redis";\nimport {'
  );
}

const endpoint = `
  // AI Gateway Generation Endpoint
  if (pathname === "/api/generate" && req.method === "POST") {
    const auth = await checkAuthentication();
    const ownerId = requireAuthenticatedOwner(auth);
    if (!ownerId) return;

    try {
      const data = await readJsonBody();
      
      // Initialize the AI Gateway Service securely
      const gatewayRepo = new PostgresGatewayRepository();
      const usageRepo = new RedisUsageRepository();
      
      // Pull API keys directly from the loaded config environment
      const gatewayEnv = {
        DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY || "",
        QWEN_API_KEY: process.env.QWEN_API_KEY || ""
      };
      
      const aiGateway = new AiGatewayService(gatewayRepo, usageRepo, gatewayEnv);

      // Call the AI
      const aiResult = await aiGateway.generate({
        tenantId: auth.tenantId,
        ownerId: ownerId,
        contextReference: data.contextReference || "manual_test",
        systemPrompt: data.systemPrompt || "You are a helpful assistant.",
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

// Only inject if it hasn't been injected before
if (!serverCode.includes('"/api/generate"')) {
  serverCode = serverCode.replace(
    'if (pathname === "/api/policies" && req.method === "POST") {',
    endpoint + '\n  if (pathname === "/api/policies" && req.method === "POST") {'
  );
  fs.writeFileSync('apps/web/server.js', serverCode);
  console.log("Injected /api/generate endpoint");
} else {
  console.log("/api/generate already exists");
}
