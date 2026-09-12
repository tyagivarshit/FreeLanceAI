const fs = require('fs');
const path = require('path');

const webDir = path.join(process.cwd(), 'apps', 'web');
const serverFile = path.join(webDir, 'server.js');

let serverCode = fs.readFileSync(serverFile, 'utf8');

if (!serverCode.includes('PostgresProjectRepository')) {
  serverCode = serverCode.replace(
    /} from "@freelanceos\/db";/,
    `  PostgresProjectRepository,
  PostgresAttachmentRepository,
  PostgresPaymentRepository,
  projects,
  payments,
  attachments,
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
  serverCode = serverCode.replace(mockRegex, 'const paymentStore = new PostgresPaymentRepository();');

  const repoInstantiations = `
const projectRepo = new PostgresProjectRepository();
const attachmentRepo = new PostgresAttachmentRepository();
`;
  serverCode = serverCode.replace('const clientRepo = new PostgresClientRepository();', 'const clientRepo = new PostgresClientRepository();\n' + repoInstantiations);
  
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
    'if (pathname === "/api/clients" && req.method === "GET") {',
    apiInjection + '\n  if (pathname === "/api/clients" && req.method === "GET") {'
  );

  fs.writeFileSync(serverFile, serverCode);
}

const generateHtml = (title, endpoint) => '<!DOCTYPE html>\n' +
'<html lang="en">\n' +
'<head>\n' +
'  <meta charset="UTF-8">\n' +
'  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n' +
'  <title>' + title + ' - FreelanceOS</title>\n' +
'  <link rel="stylesheet" href="/style.css">\n' +
'  <script type="module" src="/' + endpoint + '.js"></script>\n' +
'</head>\n' +
'<body class="dashboard-body">\n' +
'  <aside id="sidebar" class="sidebar">\n' +
'    <div class="sidebar-header">\n' +
'      <span class="brand-name">FreelanceOS</span>\n' +
'    </div>\n' +
'    <nav class="sidebar-nav">\n' +
'      <a href="/dashboard.html" class="nav-item">Dashboard</a>\n' +
'      <a href="/clients.html" class="nav-item">Clients</a>\n' +
'      <a href="/projects.html" class="nav-item ' + (title==='Projects'?'active':'') + '">Projects</a>\n' +
'      <a href="/payments.html" class="nav-item ' + (title==='Payments'?'active':'') + '">Payments</a>\n' +
'      <a href="/attachments.html" class="nav-item ' + (title==='Attachments'?'active':'') + '">Attachments</a>\n' +
'    </nav>\n' +
'  </aside>\n' +
'  <main class="main-content">\n' +
'    <header class="top-nav">\n' +
'      <h1 class="page-title">' + title + '</h1>\n' +
'      <button id="create-btn" class="btn btn-primary">Create New</button>\n' +
'    </header>\n' +
'    <div class="content-container">\n' +
'      <div id="list-container" class="card">\n' +
'         <p>Loading ' + title + '...</p>\n' +
'      </div>\n' +
'    </div>\n' +
'  </main>\n' +
'</body>\n' +
'</html>';

fs.writeFileSync(path.join(webDir, 'projects.html'), generateHtml('Projects', 'projects'));
fs.writeFileSync(path.join(webDir, 'payments.html'), generateHtml('Payments', 'payments'));
fs.writeFileSync(path.join(webDir, 'attachments.html'), generateHtml('Attachments', 'attachments'));

const generateJs = (title, apiEndpoint, fields) => 
"document.addEventListener('DOMContentLoaded', async () => {\n" +
"  const listContainer = document.getElementById('list-container');\n" +
"  const createBtn = document.getElementById('create-btn');\n" +
"  async function loadItems() {\n" +
"    try {\n" +
"      const res = await fetch('" + apiEndpoint + "');\n" +
"      if (res.redirected) { window.location.href = res.url; return; }\n" +
"      const data = await res.json();\n" +
"      if (!data.success) throw new Error('Failed to load');\n" +
"      if (data.items.length === 0) {\n" +
"        listContainer.innerHTML = '<p>No " + title.toLowerCase() + " found.</p>';\n" +
"        return;\n" +
"      }\n" +
"      let html = '<ul class=\"item-list\" style=\"list-style:none; padding:0;\">';\n" +
"      for (const item of data.items) {\n" +
"        html += '<li class=\"card\" style=\"margin-bottom:1rem; padding:1rem; border:1px solid #ddd; border-radius:8px;\"><pre>' + JSON.stringify(item, null, 2) + '</pre></li>';\n" +
"      }\n" +
"      html += '</ul>';\n" +
"      listContainer.innerHTML = html;\n" +
"    } catch(err) {\n" +
"      listContainer.innerHTML = '<p class=\"error\">Error loading data.</p>';\n" +
"    }\n" +
"  }\n" +
"  createBtn.addEventListener('click', async () => {\n" +
fields +
"  });\n" +
"  loadItems();\n" +
"});";

fs.writeFileSync(path.join(webDir, 'projects.js'), generateJs('Projects', '/api/projects', 
"    const title = prompt('Enter Project Title:');\n" +
"    const clientId = prompt('Enter Client ID:');\n" +
"    if (!title || !clientId) return;\n" +
"    await fetch('/api/projects', {\n" +
"      method: 'POST',\n" +
"      headers: {'Content-Type': 'application/json'},\n" +
"      body: JSON.stringify({ title, description: 'New project', clientId })\n" +
"    });\n" +
"    loadItems();\n"
));

fs.writeFileSync(path.join(webDir, 'payments.js'), generateJs('Payments', '/api/payments', 
"    const amount = prompt('Enter Amount (in cents):');\n" +
"    const clientId = prompt('Enter Client ID:');\n" +
"    if (!amount || !clientId) return;\n" +
"    await fetch('/api/payments', {\n" +
"      method: 'POST',\n" +
"      headers: {'Content-Type': 'application/json'},\n" +
"      body: JSON.stringify({ amount: Number(amount), currency: 'USD', clientId })\n" +
"    });\n" +
"    loadItems();\n"
));

fs.writeFileSync(path.join(webDir, 'attachments.js'), generateJs('Attachments', '/api/attachments', 
"    const filename = prompt('Enter Filename:');\n" +
"    const projectId = prompt('Enter Project ID:');\n" +
"    if (!filename || !projectId) return;\n" +
"    await fetch('/api/attachments', {\n" +
"      method: 'POST',\n" +
"      headers: {'Content-Type': 'application/json'},\n" +
"      body: JSON.stringify({ filename, mimeType: 'text/plain', description: 'Uploaded file', projectId })\n" +
"    });\n" +
"    loadItems();\n"
));

console.log("Phase 2 scaffolding complete!");
