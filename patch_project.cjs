const fs = require('fs');
let code = fs.readFileSync('packages/core/src/project.test.ts', 'utf8');

// Fix Project.create calls
code = code.replace(
  /Project\.create\(\s*"([^"]+)",\s*"([^"]+)",\s*"([^"]+)",\s*"([^"]+)",\s*validMetadata,\s*validVisibility,?\s*\)/g,
  'Project.create("$1", "tenant-1", "$2", "$3", "$4", validMetadata, validVisibility)'
);

// Fix new Project({ calls
code = code.replace(
  /new Project\({/g,
  'new Project({ tenantId: "tenant-1",'
);

// Also need to fix mockStore tenant checks
code = code.replace(
  /async findById\(id, ownerId\) {/g,
  'async findById(id, tenantId) {'
);
code = code.replace(
  /assert\.strictEqual\(ownerId, "owner-1"\);/g,
  'assert.strictEqual(tenantId, "tenant-1");'
);
code = code.replace(
  /const fetched = await mockStore\.findById\("project-1", "owner-1"\);/g,
  'const fetched = await mockStore.findById("project-1", "tenant-1");'
);


fs.writeFileSync('packages/core/src/project.test.ts', code);
console.log("Patched project.test.ts");
