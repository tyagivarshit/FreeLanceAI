const fs = require('fs');
const path = require('path');
const serverFile = path.join(process.cwd(), 'apps', 'web', 'server.js');
let serverCode = fs.readFileSync(serverFile, 'utf8');

serverCode = serverCode.replace(
  'const att = Attachment.create(randomUUID()',
  'const att = await Attachment.create(randomUUID()'
);

fs.writeFileSync(serverFile, serverCode);
console.log("Patched await for Attachment.create");
