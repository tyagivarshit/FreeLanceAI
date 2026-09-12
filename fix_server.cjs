const fs = require('fs');

let serverCode = fs.readFileSync('apps/web/server.js', 'utf8');

// The original injected routes started with `if (pathname === "/api/prompts" && req.method === "GET") {`
// Let's replace the entire block of Phase 3 endpoints.

const oldRoutes = `
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

const newRoutes = `
  if (pathname === "/api/prompts" && req.method === "GET") {
    const auth = await checkAuthentication();
    const ownerId = requireAuthenticatedOwner(auth);
    if (!ownerId) return;
    sendJson(200, { success: true, items: promptsStore.filter(p => p.ownerId === ownerId) });
    return;
  }
  if (pathname === "/api/prompts" && req.method === "POST") {
    const auth = await checkAuthentication();
    const ownerId = requireAuthenticatedOwner(auth);
    if (!ownerId) return;
    try {
      const data = await readJsonBody();
      const newItem = { id: "prm_" + Date.now(), ownerId, ...data, status: 'Draft', createdAt: new Date() };
      promptsStore.push(newItem);
      sendJson(201, { success: true, item: newItem });
    } catch(e) { handleClientApiError(e); }
    return;
  }

  if (pathname === "/api/memory" && req.method === "GET") {
    const auth = await checkAuthentication();
    const ownerId = requireAuthenticatedOwner(auth);
    if (!ownerId) return;
    sendJson(200, { success: true, items: memoryStore.filter(p => p.ownerId === ownerId) });
    return;
  }
  if (pathname === "/api/memory" && req.method === "POST") {
    const auth = await checkAuthentication();
    const ownerId = requireAuthenticatedOwner(auth);
    if (!ownerId) return;
    try {
      const data = await readJsonBody();
      const newItem = { id: "mem_" + Date.now(), ownerId, ...data, status: 'Active', createdAt: new Date() };
      memoryStore.push(newItem);
      sendJson(201, { success: true, item: newItem });
    } catch(e) { handleClientApiError(e); }
    return;
  }

  if (pathname === "/api/policies" && req.method === "GET") {
    const auth = await checkAuthentication();
    const ownerId = requireAuthenticatedOwner(auth);
    if (!ownerId) return;
    sendJson(200, { success: true, items: policiesStore.filter(p => p.ownerId === ownerId) });
    return;
  }
  if (pathname === "/api/policies" && req.method === "POST") {
    const auth = await checkAuthentication();
    const ownerId = requireAuthenticatedOwner(auth);
    if (!ownerId) return;
    try {
      const data = await readJsonBody();
      const newItem = { id: "pol_" + Date.now(), ownerId, ...data, status: 'Active', createdAt: new Date() };
      policiesStore.push(newItem);
      sendJson(201, { success: true, item: newItem });
    } catch(e) { handleClientApiError(e); }
    return;
  }
`;

serverCode = serverCode.replace(oldRoutes, newRoutes);
fs.writeFileSync('apps/web/server.js', serverCode);
console.log('Fixed server.js endpoints.');
