const fs = require('fs');

let code = fs.readFileSync('packages/core/src/project.test.ts', 'utf8');
let count = 0;
// Regex for Project.create("project-1", "client-1", "owner-1", "ref-1", validMetadata, validVisibility)
code = code.replace(/Project\.create\(\s*"([^"]+)",\s*"([^"]+)",\s*"([^"]+)",\s*"([^"]+)",\s*validMetadata,\s*validVisibility,?\s*\)/g, function(match, a1, a2, a3, a4) {
  count++;
  return `Project.create(
      "${a1}",
      "tenant-1",
      "${a2}",
      "${a3}",
      "${a4}",
      validMetadata,
      validVisibility
    )`;
});
fs.writeFileSync('packages/core/src/project.test.ts', code);
console.log('Replaced', count, 'Project.create calls');
