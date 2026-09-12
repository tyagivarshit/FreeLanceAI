const fs = require("fs");

// Fix entitlements.ts
let coreFile = "packages/core/src/entitlements.ts";
let coreContent = fs.readFileSync(coreFile, "utf8");

// Fix UsageRepository interface
coreContent = coreContent.replace(
  /consume\(key: string, limit: number, amount: number\): Promise<\{ success: boolean; current: number \}>;/g,
  "consume(key: string, limit: number, amount: number, ttlSeconds?: number): Promise<{ success: boolean; current: number }>;"
);

// Fix InMemoryUsageRepository
coreContent = coreContent.replace(
  /this\.store/g,
  "this._usage"
);

// Fix ttlSeconds unused error
coreContent = coreContent.replace(
  /async consume\(\s*key: string,\s*limit: number,\s*amount: number,\s*ttlSeconds\?: number\s*\): Promise<\{ success: boolean; current: number \}> \{/g,
  "async consume(\n    key: string,\n    limit: number,\n    amount: number,\n    _ttlSeconds?: number\n  ): Promise<{ success: boolean; current: number }> {"
);
coreContent = coreContent.replace(
  /async consume\(key: string, limit: number, amount: number, ttlSeconds\?: number\): Promise<\{ success: boolean; current: number \}> \{/g,
  "async consume(key: string, limit: number, amount: number, _ttlSeconds?: number): Promise<{ success: boolean; current: number }> {"
);


fs.writeFileSync(coreFile, coreContent);
console.log("Fixed entitlements.ts completely.");
