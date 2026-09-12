const fs = require('fs');
const path = require('path');
const serverFile = path.join(process.cwd(), 'apps', 'web', 'server.js');
let serverCode = fs.readFileSync(serverFile, 'utf8');

serverCode = serverCode.replace(
  'AttachmentMetadata,\n  Payment,',
  'AttachmentMetadata,\n  AttachmentVisibility,\n  ProjectMetadata,\n  ProjectVisibility,\n  Payment,'
);

serverCode = serverCode.replace(
  'Project.create(randomUUID(), auth.tenantId, p.clientId, ownerId, "REF-"+Date.now(), {title: p.title, description: p.description}, {classification: "StandardClassification"});',
  'Project.create(randomUUID(), auth.tenantId, p.clientId, ownerId, "REF-"+Date.now(), new ProjectMetadata({title: p.title, description: p.description}), new ProjectVisibility("StandardClassification"));'
);

serverCode = serverCode.replace(
  'await Attachment.create(randomUUID(), auth.tenantId, p.projectId, "Project", ownerId, "ATT-"+Date.now(), meta, {classification: "StandardClassification"});',
  'await Attachment.create(randomUUID(), auth.tenantId, p.projectId, "Project", ownerId, "ATT-"+Date.now(), meta, new AttachmentVisibility("StandardClassification"));'
);

fs.writeFileSync(serverFile, serverCode);
console.log("Fixed class instantiations in server.js");
