const fs = require("fs");

let file = "packages/db/src/repository/prompt-repository.ts";
let content = fs.readFileSync(file, "utf8");

// Fix status 'Active' to 'Published'
content = content.replace(/eq\(prompts\.status, "Active"\)/g, 'eq(prompts.status, "Published")');
content = content.replace(/data\.status === "Active"/g, 'data.status === "Published"');

// Fix missing visibility
content = content.replace(/metadata: data.metadata,/g, 'metadata: data.metadata,\n      visibility: data.visibility || "Private",');

// Also update the PromptRecord interface to optionally include visibility
content = content.replace(/status: string;/g, 'status: string;\n  visibility?: string;');

// Fix the line 85 compilation error (cacheKey in savePrompt)
content = content.replace(/const cacheKey = `prompt:\$\{tenantId\}:\$\{reference\}`;/g, function(match, offset, string) {
  if (string.substring(offset - 50, offset).includes("savePrompt")) {
    return 'const cacheKey = `prompt:${data.tenantId}:${data.reference}`;';
  }
  return match; // keep as is for getActivePromptByReference
});

fs.writeFileSync(file, content);
console.log("Fixed Drizzle Schema Validation Errors");
