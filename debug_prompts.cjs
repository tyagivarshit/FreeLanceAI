const fs = require('fs');
let code = fs.readFileSync('apps/frontend/src/pages/Prompts.jsx', 'utf8');

code = code.replace(
  "await fetch('/api/prompts', {",
  "const res = await fetch('/api/prompts', {"
);

code = code.replace(
  "body: JSON.stringify({ reference, definition: { promptTextSpecification: definition }, metadata: { displayName: reference } })\n      });\n      setReference('');",
  "body: JSON.stringify({ reference, definition: { promptTextSpecification: definition }, metadata: { displayName: reference } })\n      });\n      if (!res.ok) { const text = await res.text(); throw new Error(`Server returned ${res.status}: ${text}`); }\n      const responseData = await res.json();\n      setReference('');"
);

code = code.replace(
  "console.error(err);",
  "console.error('Failed to create prompt:', err);\n      alert('Error saving prompt: ' + err.message);"
);

fs.writeFileSync('apps/frontend/src/pages/Prompts.jsx', code);
console.log("Updated Prompts.jsx");
