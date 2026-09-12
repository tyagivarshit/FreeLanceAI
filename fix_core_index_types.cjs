const fs = require("fs");

let content = fs.readFileSync("packages/core/src/index.ts", "utf8");

content = content.replace(/export type \{[\s\S]*?\} from "\.\/prompt-builder\.js";/g, "");

fs.writeFileSync("packages/core/src/index.ts", content);
console.log("Fixed core index.ts types");
