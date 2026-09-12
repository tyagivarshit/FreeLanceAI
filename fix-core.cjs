const fs = require('fs');
const file = 'packages/core/src/project.test.ts';
let content = fs.readFileSync(file, 'utf8');
content = content.replace(/Attachment\.create\(/g, 'Attachment.create("att-id", "tenant-id", ');
fs.writeFileSync(file, content);
console.log('Fixed project.test.ts');
