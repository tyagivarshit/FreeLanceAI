const fs = require("fs");

let serverCode = fs.readFileSync("apps/web/server.js", "utf8");

const oldPromptsBlock = /if \(pathname === "\/api\/prompts" && req\.method === "GET"\) \{[\s\S]*?if \(pathname === "\/api\/memory" && req\.method === "GET"\)/;

const newPromptsBlock = `if (pathname === "/api/prompts" && req.method === "GET") {
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
        id: data.id || "prm_" + crypto.randomUUID(), 
        tenantId: auth.tenantId,
        ownerId: ownerId, 
        reference: data.reference,
        definition: data.definition || {},
        metadata: data.metadata || {},
        visibility: data.visibility || "Private",
        status: data.status || 'Draft'
      };
      
      await promptRepo.savePrompt(newPrompt);
      sendJson(201, { success: true, item: newPrompt });
    } catch(e) { handleClientApiError(e); }
    return;
  }

  if (pathname === "/api/memory" && req.method === "GET")`;

serverCode = serverCode.replace(oldPromptsBlock, newPromptsBlock);

fs.writeFileSync("apps/web/server.js", serverCode);
console.log("Forced API prompts patch in server.js");
