const fs = require("fs");

["packages/core/src/memory.ts", "packages/core/src/policy.ts", "packages/core/src/prompt-registry.ts", "packages/core/src/ai-gateway.ts"].forEach(file => {
  if (!fs.existsSync(file)) return;
  let content = fs.readFileSync(file, "utf8");
  
  // Fix TS6133: '_tenantId' is declared but its value is never read.
  // Fix Property 'tenantId' is missing in type '{ ... }' but required in type '...Properties'.
  // We need to ensure the get properties() method returns tenantId
  content = content.replace(
    /ownerId: this\._ownerId,/g,
    "tenantId: this._tenantId,\n      ownerId: this._ownerId,"
  );

  // Fix duplicate tenantId: this._tenantId if we accidentally added it twice
  content = content.replace(/tenantId: this\._tenantId,\n\s*tenantId: this\._tenantId,/g, "tenantId: this._tenantId,");

  fs.writeFileSync(file, content);
});

// Fix memory.test.ts
if (fs.existsSync("packages/core/src/memory.test.ts")) {
  let mt = fs.readFileSync("packages/core/src/memory.test.ts", "utf8");
  mt = mt.replace(/Memory\.create\(\n\s*(.*),\n\s*(.*),\n\s*(.*),/g, "Memory.create(\n      $1,\n      \"tenant-1\",\n      $2,\n      $3,");
  // One liners
  mt = mt.replace(/Memory\.create\(([^,]+),\s*([^,]+),\s*([^,]+),/g, "Memory.create($1, \"tenant-1\", $2, $3,");
  fs.writeFileSync("packages/core/src/memory.test.ts", mt);
}

// Fix prompt-registry.test.ts
if (fs.existsSync("packages/core/src/prompt-registry.test.ts")) {
  let pt = fs.readFileSync("packages/core/src/prompt-registry.test.ts", "utf8");
  pt = pt.replace(/Prompt\.create\(\n\s*(.*),\n\s*(.*),\n\s*(.*),/g, "Prompt.create(\n      $1,\n      \"tenant-1\",\n      $2,\n      $3,");
  // One liners
  pt = pt.replace(/Prompt\.create\(([^,]+),\s*([^,]+),\s*([^,]+),/g, "Prompt.create($1, \"tenant-1\", $2, $3,");
  fs.writeFileSync("packages/core/src/prompt-registry.test.ts", pt);
}

// Fix ai-gateway.test.ts
if (fs.existsSync("packages/core/src/ai-gateway.test.ts")) {
  let at = fs.readFileSync("packages/core/src/ai-gateway.test.ts", "utf8");
  at = at.replace(/AiRequest\.create\(([^,]+),\s*([^,]+),\s*([^,]+),/g, "AiRequest.create($1, \"tenant-1\", $2, $3,");
  fs.writeFileSync("packages/core/src/ai-gateway.test.ts", at);
}

console.log("Fixed properties and tests");
