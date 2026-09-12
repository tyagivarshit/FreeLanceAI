const fs = require('fs');

['apps/frontend/src/pages/Memory.jsx', 'apps/frontend/src/pages/Policies.jsx'].forEach(file => {
  if (!fs.existsSync(file)) return;
  let code = fs.readFileSync(file, 'utf8');
  
  code = code.replace(/const res = const res = await fetch/g, "const res = await fetch");
  
  fs.writeFileSync(file, code);
});
console.log("Fixed Syntax Errors");
