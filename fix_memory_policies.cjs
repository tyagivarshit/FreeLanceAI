const fs = require('fs');

['apps/frontend/src/pages/Memory.jsx', 'apps/frontend/src/pages/Policies.jsx'].forEach(file => {
  if (!fs.existsSync(file)) return;
  let code = fs.readFileSync(file, 'utf8');
  
  if (code.includes('await fetch(') && !code.includes('res.ok')) {
    code = code.replace(
      "await fetch('/api/",
      "const res = await fetch('/api/"
    );
    
    code = code.replace(
      "})\n      });\n      set",
      "})\n      });\n      if (!res.ok) { throw new Error(`Server returned ${res.status}`); }\n      set"
    );
    
    code = code.replace(
      "console.error(err);",
      "console.error(err);\n      alert('Error: ' + err.message);"
    );
    
    fs.writeFileSync(file, code);
  }
});
console.log("Patched Memory and Policies");
