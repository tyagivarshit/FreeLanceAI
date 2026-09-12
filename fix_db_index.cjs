const fs = require("fs");

let content = fs.readFileSync("packages/db/src/index.ts", "utf8");

content += `\nexport { promptCompositions } from "./schema/prompt-compositions.js";\n`;
content += `export { PostgresCompositionRepository } from "./repository/composition-repository.js";\n`;

fs.writeFileSync("packages/db/src/index.ts", content);
console.log("Updated db/src/index.ts");
