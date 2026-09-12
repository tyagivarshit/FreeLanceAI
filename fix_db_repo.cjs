const fs = require("fs");

let file = "packages/db/src/repository/prompt-repository.ts";
let content = fs.readFileSync(file, "utf8");

// Remove the slashes before backticks and dollar signs if they were mangled
content = content.replace(/\\`prompt:\\\${tenantId}:\\\${reference}\\`/g, '`prompt:${tenantId}:${reference}`');
content = content.replace(/\\`prompt:\\\${data\.tenantId}:\\\${data\.reference}\\`/g, '`prompt:${data.tenantId}:${data.reference}`');

// Or just brutally replace any `\${` with `${` and `\`` with ```
content = content.replace(/\\\$/g, "$");
content = content.replace(/\\`/g, "`");

fs.writeFileSync(file, content);
console.log("Fixed mangled characters in DB repo");
