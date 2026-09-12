const fs = require("fs");

let file = "packages/core/src/services/prompt-template-engine.ts";
let content = fs.readFileSync(file, "utf8");

content = content.replace(/\(match, varName\)/g, "(_match, varName)");
content = content.replace(/m => m\[1\]/g, "m => m[1] as string");

fs.writeFileSync(file, content);
console.log("Fixed TS errors in engine");
