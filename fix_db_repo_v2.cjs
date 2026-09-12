const fs = require("fs");

let file = "packages/db/src/repository/prompt-repository.ts";
let content = fs.readFileSync(file, "utf8");

content = content.replace(/const cacheKey = \\prompt:\\:\\\\;/g, "const cacheKey = `prompt:${tenantId}:${reference}`;");
content = content.replace(/const cacheKey = \\prompt:\\:\\\\;/g, "const cacheKey = `prompt:${data.tenantId}:${data.reference}`;");

// Actually just fix them manually via absolute replace
content = content.replace(/const cacheKey = .*/g, function(match, offset, string) {
  if (string.substring(offset - 50, offset).includes("getActivePromptByReference")) {
    return "const cacheKey = `prompt:${tenantId}:${reference}`;";
  }
  if (string.substring(offset - 50, offset).includes("savePrompt")) {
    return "const cacheKey = `prompt:${data.tenantId}:${data.reference}`;";
  }
  return "const cacheKey = `prompt:${tenantId}:${reference}`;";
});


fs.writeFileSync(file, content);
console.log("Fixed DB Repo cacheKey");
