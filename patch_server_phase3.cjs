const fs = require('fs');

let serverCode = fs.readFileSync('apps/web/server.js', 'utf8');

const storesInjection = `
// ==========================================
// Phase 3 AI Infrastructure Mock Stores
// ==========================================
const promptsStore = [];
const memoryStore = [];
const policiesStore = [];
`;

// Inject stores near the top
serverCode = serverCode.replace(
  'const projectStore = [];',
  storesInjection + '\nconst projectStore = [];'
);

const routesInjection = `
  // ==========================================
  // Phase 3 AI Infrastructure Endpoints
  // ==========================================
  
  if (pathname === "/api/prompts" && req.method === "GET") {
    const auth = await checkAuthentication();
    const ownerId = requireAuthenticatedOwner(auth);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ success: true, items: promptsStore.filter(p => p.ownerId === ownerId) }));
    return;
  }
  if (pathname === "/api/prompts" && req.method === "POST") {
    const auth = await checkAuthentication();
    const ownerId = requireAuthenticatedOwner(auth);
    let body = "";
    req.on("data", chunk => body += chunk);
    req.on("end", () => {
      try {
        const data = JSON.parse(body);
        const newItem = { id: "prm_" + Date.now(), ownerId, ...data, status: 'Draft', createdAt: new Date() };
        promptsStore.push(newItem);
        res.writeHead(201, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true, item: newItem }));
      } catch (err) {
        res.writeHead(400); res.end();
      }
    });
    return;
  }

  if (pathname === "/api/memory" && req.method === "GET") {
    const auth = await checkAuthentication();
    const ownerId = requireAuthenticatedOwner(auth);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ success: true, items: memoryStore.filter(p => p.ownerId === ownerId) }));
    return;
  }
  if (pathname === "/api/memory" && req.method === "POST") {
    const auth = await checkAuthentication();
    const ownerId = requireAuthenticatedOwner(auth);
    let body = "";
    req.on("data", chunk => body += chunk);
    req.on("end", () => {
      try {
        const data = JSON.parse(body);
        const newItem = { id: "mem_" + Date.now(), ownerId, ...data, status: 'Active', createdAt: new Date() };
        memoryStore.push(newItem);
        res.writeHead(201, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true, item: newItem }));
      } catch (err) {
        res.writeHead(400); res.end();
      }
    });
    return;
  }

  if (pathname === "/api/policies" && req.method === "GET") {
    const auth = await checkAuthentication();
    const ownerId = requireAuthenticatedOwner(auth);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ success: true, items: policiesStore.filter(p => p.ownerId === ownerId) }));
    return;
  }
  if (pathname === "/api/policies" && req.method === "POST") {
    const auth = await checkAuthentication();
    const ownerId = requireAuthenticatedOwner(auth);
    let body = "";
    req.on("data", chunk => body += chunk);
    req.on("end", () => {
      try {
        const data = JSON.parse(body);
        const newItem = { id: "pol_" + Date.now(), ownerId, ...data, status: 'Active', createdAt: new Date() };
        policiesStore.push(newItem);
        res.writeHead(201, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true, item: newItem }));
      } catch (err) {
        res.writeHead(400); res.end();
      }
    });
    return;
  }
`;

// Inject routes before 404 handler
serverCode = serverCode.replace(
  '// 2. Serve static pages',
  routesInjection + '\n    // 2. Serve static pages'
);

fs.writeFileSync('apps/web/server.js', serverCode);
console.log('Patched server.js with Phase 3 APIs successfully.');
