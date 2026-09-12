const fs = require("fs");

let serverCode = fs.readFileSync("apps/web/server.js", "utf8");

if (!serverCode.includes("PostgresPromptRepository")) {
  serverCode = serverCode.replace(
    'import { PostgresGatewayRepository } from "@freelanceos/db";',
    'import { PostgresGatewayRepository, PostgresPromptRepository } from "@freelanceos/db";'
  );
}

if (!serverCode.includes("RedisCacheStore")) {
  serverCode = serverCode.replace(
    'import { RedisUsageRepository } from "@freelanceos/redis";',
    'import { RedisUsageRepository, RedisCacheStore } from "@freelanceos/redis";'
  );
}

const newPromptsApi = `
  if (pathname === "/api/prompts" && req.method === "GET") {
    const auth = await checkAuthentication();
    const ownerId = requireAuthenticatedOwner(auth);
    if (!ownerId) return;
    
    try {
      const cacheStore = new RedisCacheStore();
      const promptRepo = new PostgresPromptRepository(cacheStore);
      const items = await promptRepo.listPrompts(auth.tenantId);
      sendJson(200, { success: true, items });
    } catch(e) { handleClientApiError(e); }
    return;
  }
  
  if (pathname === "/api/prompts" && req.method === "POST") {
    const auth = await checkAuthentication();
    const ownerId = requireAuthenticatedOwner(auth);
    if (!ownerId) return;

    try {
      const data = await readJsonBody();
      const cacheStore = new RedisCacheStore();
      const promptRepo = new PostgresPromptRepository(cacheStore);
      
      const newPrompt = { 
        id: "prm_" + crypto.randomUUID(), 
        tenantId: auth.tenantId,
        ownerId: ownerId, 
        reference: data.reference,
        definition: data.definition || {},
        metadata: data.metadata || {},
        status: data.status || 'Draft'
      };
      
      await promptRepo.savePrompt(newPrompt);
      sendJson(201, { success: true, item: newPrompt });
    } catch(e) { handleClientApiError(e); }
    return;
  }
`;

// Replace the old endpoints
const oldGet = /if \(pathname === "\/api\/prompts" && req\.method === "GET"\) \{[\s\S]*?return;\n    \}/;
const oldPost = /if \(pathname === "\/api\/prompts" && req\.method === "POST"\) \{[\s\S]*?return;\n    \}/;

serverCode = serverCode.replace(oldGet, "");
serverCode = serverCode.replace(oldPost, newPromptsApi);

fs.writeFileSync("apps/web/server.js", serverCode);
console.log("Patched Prompts API in server.js");
