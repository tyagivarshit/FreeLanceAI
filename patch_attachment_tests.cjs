const fs = require('fs');

let code = fs.readFileSync('packages/core/src/attachment.test.ts', 'utf8');
let count = 0;
// Regex for Attachment.create("att-1", "parent-1", "type", "owner", "ref", validMetadata, validVisibility)
code = code.replace(/Attachment\.create\(\s*"([^"]+)",\s*"([^"]+)",\s*"([^"]+)",\s*"([^"]+)",\s*"([^"]+)",\s*validMetadata,\s*validVisibility,?\s*\)/g, function(match, a1, a2, a3, a4, a5) {
  count++;
  return `Attachment.create(
      "${a1}",
      "tenant-1",
      "${a2}",
      "${a3}",
      "${a4}",
      "${a5}",
      validMetadata,
      validVisibility
    )`;
});
fs.writeFileSync('packages/core/src/attachment.test.ts', code);
console.log('Replaced', count, 'Attachment.create calls');
