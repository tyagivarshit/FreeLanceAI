const fs = require("fs");

let serverCode = fs.readFileSync("apps/web/server.js", "utf8");

if (!serverCode.includes("PostgresCompositionRepository")) {
  serverCode = serverCode.replace(
    'import { PostgresGatewayRepository, PostgresPromptRepository } from "@freelanceos/db";',
    'import { PostgresGatewayRepository, PostgresPromptRepository, PostgresCompositionRepository } from "@freelanceos/db";'
  );
}

const newCompApi = `
  if (pathname === "/api/compositions" && req.method === "GET") {
    const auth = await checkAuthentication();
    const ownerId = requireAuthenticatedOwner(auth);
    if (!ownerId) return;
    
    try {
      const cacheStore = new RedisCacheStore();
      const compRepo = new PostgresCompositionRepository(cacheStore);
      const items = await compRepo.listCompositions(auth.tenantId);
      sendJson(200, { success: true, items });
    } catch(e) { handleClientApiError(e); }
    return;
  }
  
  if (pathname === "/api/compositions" && req.method === "POST") {
    const auth = await checkAuthentication();
    const ownerId = requireAuthenticatedOwner(auth);
    if (!ownerId) return;

    try {
      const data = await readJsonBody();
      const cacheStore = new RedisCacheStore();
      const compRepo = new PostgresCompositionRepository(cacheStore);
      
      const newComp = { 
        id: data.id || "cmp_" + crypto.randomUUID(), 
        tenantId: auth.tenantId,
        ownerId: ownerId, 
        reference: data.reference,
        pipelineLayout: data.pipelineLayout || { blocks: [] },
        status: data.status || 'Draft'
      };
      
      await compRepo.saveComposition(newComp);
      sendJson(201, { success: true, item: newComp });
    } catch(e) { handleClientApiError(e); }
    return;
  }
`;

const insertPoint = 'if (pathname === "/api/memory" && req.method === "GET")';
serverCode = serverCode.replace(insertPoint, newCompApi.trim() + '\n\n  ' + insertPoint);

fs.writeFileSync("apps/web/server.js", serverCode);
console.log("Patched Compositions API in server.js");
