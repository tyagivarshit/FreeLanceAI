const fs = require("fs");

["packages/db/src/schema/gateway.ts", "packages/db/src/schema/memory.ts", "packages/db/src/schema/policies.ts", "packages/db/src/schema/prompts.ts"].forEach(file => {
  if (fs.existsSync(file)) {
    let content = fs.readFileSync(file, "utf8");
    content = content.replace(/timestamp, /g, "");
    fs.writeFileSync(file, content);
  }
});
console.log("Fixed unused imports");
