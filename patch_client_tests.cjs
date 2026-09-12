const fs = require('fs');
let code = fs.readFileSync('packages/core/src/client.test.ts', 'utf8');

code = code.replace(/client\.updateProfile\(/g, `client.updateProfile("owner-1", `);

fs.writeFileSync('packages/core/src/client.test.ts', code);
console.log("Patched client.test.ts");
