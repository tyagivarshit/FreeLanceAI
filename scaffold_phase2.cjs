const fs = require('fs');
const path = require('path');

const webDir = path.join(process.cwd(), 'apps', 'web');
const serverFile = path.join(webDir, 'server.js');

// 1. Inject server.js routes and imports
let serverCode = fs.readFileSync(serverFile, 'utf8');

if (!serverCode.includes('PostgresProjectRepository')) {
  serverCode = serverCode.replace(
    /} from "@freelanceos\/db";/,
    `  PostgresProjectRepository,
  PostgresAttachmentRepository,
  PostgresPaymentRepository,
} from "@freelanceos/db";`
  );

  serverCode = serverCode.replace(
    /} from "@freelanceos\/core";/,
    `  Project,
  Attachment,
  AttachmentMetadata,
  Payment,
  Money,
} from "@freelanceos/core";`
  );

  const mockRegex = /\/\/ Mock \/ placeholder PaymentAggregateStore[\s\S]*?findByReference: async \([^)]*\) => \{\n\s*logger\.info\([^)]*\);\n\s*return null;\n\s*\},\n\s*\};/;
  serverCode = serverCode.replace(mockRegex, `const paymentStore = new PostgresPaymentRepository();`);

  const repoInstantiations = `
const projectRepo = new PostgresProjectRepository();
const attachmentRepo = new PostgresAttachmentRepository();
`;
  serverCode = serverCode.replace(`const clientRepo = new PostgresClientRepository();`, `const clientRepo = new PostgresClientRepository();\n${repoInstantiations}`);
  
  const apiInjection = `
  // --- PHASE 2 REST APIs ---
  if (pathname === "/api/projects" && req.method === "GET") {
    const auth = await checkAuthentication();
    const ownerId = requireAuthenticatedOwner(auth);
    if (!ownerId) return;
    try {
      const result = await db.select().from(projects).where(eq(projects.tenantId, auth.tenantId)).orderBy(desc(projects.createdAt)).limit(50);
      sendJson(200, { success: true, items: result });
    } catch(e) { handleClientApiError(e); }
    return;
  }
  if (pathname === "/api/projects" && req.method === "POST") {
    const auth = await checkAuthentication();
    const ownerId = requireAuthenticatedOwner(auth);
    if (!ownerId) return;
    try {
      const p = await readJsonBody();
      const proj = Project.create(randomUUID(), auth.tenantId, p.clientId, ownerId, "REF-"+Date.now(), {title: p.title, description: p.description}, {classification: "StandardClassification"});
      await projectRepo.save(proj);
      sendJson(201, { success: true, item: proj });
    } catch(e) { handleClientApiError(e); }
    return;
  }

  if (pathname === "/api/payments" && req.method === "GET") {
    const auth = await checkAuthentication();
    const ownerId = requireAuthenticatedOwner(auth);
    if (!ownerId) return;
    try {
      const result = await db.select().from(payments).where(eq(payments.tenantId, auth.tenantId)).orderBy(desc(payments.createdAt)).limit(50);
      sendJson(200, { success: true, items: result });
    } catch(e) { handleClientApiError(e); }
    return;
  }
  if (pathname === "/api/payments" && req.method === "POST") {
    const auth = await checkAuthentication();
    const ownerId = requireAuthenticatedOwner(auth);
    if (!ownerId) return;
    try {
      const p = await readJsonBody();
      const money = new Money(Number(p.amount), p.currency);
      const payment = Payment.create(randomUUID(), auth.tenantId, p.clientId, ownerId, money, "PAY-"+Date.now());
      await paymentStore.save(payment);
      sendJson(201, { success: true, item: payment });
    } catch(e) { handleClientApiError(e); }
    return;
  }

  if (pathname === "/api/attachments" && req.method === "GET") {
    const auth = await checkAuthentication();
    const ownerId = requireAuthenticatedOwner(auth);
    if (!ownerId) return;
    try {
      const result = await db.select().from(attachments).where(eq(attachments.tenantId, auth.tenantId)).orderBy(desc(attachments.createdAt)).limit(50);
      sendJson(200, { success: true, items: result });
    } catch(e) { handleClientApiError(e); }
    return;
  }
  if (pathname === "/api/attachments" && req.method === "POST") {
    const auth = await checkAuthentication();
    const ownerId = requireAuthenticatedOwner(auth);
    if (!ownerId) return;
    try {
      const p = await readJsonBody();
      const meta = new AttachmentMetadata({ displayName: p.filename, logicalMediaType: p.mimeType, characteristics: "", description: p.description, fileSizeBytes: 1024 });
      const att = Attachment.create(randomUUID(), auth.tenantId, p.projectId, "Project", ownerId, "ATT-"+Date.now(), meta, {classification: "StandardClassification"});
      await attachmentRepo.save(att);
      sendJson(201, { success: true, item: att });
    } catch(e) { handleClientApiError(e); }
    return;
  }
  // --- END PHASE 2 REST APIs ---
`;

  serverCode = serverCode.replace(
    /if \(pathname === "\/api\/clients" && req\.method === "GET"\) \{/,
    apiInjection + `\n  if (pathname === "/api/clients" && req.method === "GET") {`
  );
  
  // also add missing db table imports
  serverCode = serverCode.replace(
    /clientTimelines,\n\s*timelineEntries,/,
    `clientTimelines,
  timelineEntries,
  projects,
  payments,
  attachments,`
  );

  fs.writeFileSync(serverFile, serverCode);
}

// 2. Generate UI Screens HTML
const generateHtml = (title, endpoint) => \`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>\${title} - FreelanceOS</title>
  <link rel="stylesheet" href="/style.css">
  <script type="module" src="/\${endpoint}.js"></script>
</head>
<body class="dashboard-body">
  <aside id="sidebar" class="sidebar">
    <div class="sidebar-header">
      <span class="brand-name">FreelanceOS</span>
    </div>
    <nav class="sidebar-nav">
      <a href="/dashboard.html" class="nav-item">Dashboard</a>
      <a href="/clients.html" class="nav-item">Clients</a>
      <a href="/projects.html" class="nav-item \${title==='Projects'?'active':''}">Projects</a>
      <a href="/payments.html" class="nav-item \${title==='Payments'?'active':''}">Payments</a>
      <a href="/attachments.html" class="nav-item \${title==='Attachments'?'active':''}">Attachments</a>
    </nav>
  </aside>
  <main class="main-content">
    <header class="top-nav">
      <h1 class="page-title">\${title}</h1>
      <button id="create-btn" class="btn btn-primary">Create New</button>
    </header>
    <div class="content-container">
      <div id="list-container" class="card">
         <p>Loading \${title}...</p>
      </div>
    </div>
  </main>
</body>
</html>\`;

fs.writeFileSync(path.join(webDir, 'projects.html'), generateHtml('Projects', 'projects'));
fs.writeFileSync(path.join(webDir, 'payments.html'), generateHtml('Payments', 'payments'));
fs.writeFileSync(path.join(webDir, 'attachments.html'), generateHtml('Attachments', 'attachments'));

// 3. Generate UI Screens JS
const generateJs = (title, apiEndpoint, fields) => \`
document.addEventListener('DOMContentLoaded', async () => {
  const listContainer = document.getElementById('list-container');
  const createBtn = document.getElementById('create-btn');

  async function loadItems() {
    try {
      const res = await fetch('\${apiEndpoint}');
      if (res.redirected) { window.location.href = res.url; return; }
      const data = await res.json();
      if (!data.success) throw new Error("Failed to load");
      
      if (data.items.length === 0) {
        listContainer.innerHTML = '<p>No \${title.toLowerCase()} found.</p>';
        return;
      }
      
      let html = '<ul class="item-list" style="list-style:none; padding:0;">';
      for (const item of data.items) {
        html += '<li class="card" style="margin-bottom:1rem; padding:1rem; border:1px solid #ddd; border-radius:8px;">' + JSON.stringify(item, null, 2) + '</li>';
      }
      html += '</ul>';
      listContainer.innerHTML = html;
    } catch(err) {
      listContainer.innerHTML = '<p class="error">Error loading data.</p>';
    }
  }

  createBtn.addEventListener('click', async () => {
    \${fields}
  });

  loadItems();
});
\`;

fs.writeFileSync(path.join(webDir, 'projects.js'), generateJs('Projects', '/api/projects', \`
    const title = prompt("Enter Project Title:");
    const clientId = prompt("Enter Client ID:");
    if (!title || !clientId) return;
    await fetch('/api/projects', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ title, description: "New project", clientId })
    });
    loadItems();
\`));

fs.writeFileSync(path.join(webDir, 'payments.js'), generateJs('Payments', '/api/payments', \`
    const amount = prompt("Enter Amount (in cents):");
    const clientId = prompt("Enter Client ID:");
    if (!amount || !clientId) return;
    await fetch('/api/payments', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ amount: Number(amount), currency: "USD", clientId })
    });
    loadItems();
\`));

fs.writeFileSync(path.join(webDir, 'attachments.js'), generateJs('Attachments', '/api/attachments', \`
    const filename = prompt("Enter Filename:");
    const projectId = prompt("Enter Project ID:");
    if (!filename || !projectId) return;
    await fetch('/api/attachments', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ filename, mimeType: "text/plain", description: "Uploaded file", projectId })
    });
    loadItems();
\`));

console.log("Phase 2 scaffolding complete!");
