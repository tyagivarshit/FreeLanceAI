const fs = require("fs");

let coreFile = "packages/core/src/entitlements.ts";
let coreContent = fs.readFileSync(coreFile, "utf8");

// Fix UsageRepository consume signature
coreContent = coreContent.replace(
  /consume\(key: string, limit: number, amount: number\): Promise<\{ success: boolean; current: number \}>;/g,
  "consume(key: string, limit: number, amount: number, ttlSeconds?: number): Promise<{ success: boolean; current: number }>;"
);

// Fix InMemoryUsageRepository consume signature
coreContent = coreContent.replace(
  /async consume\(\n\s*key: string,\n\s*limit: number,\n\s*amount: number,\n\s*\): Promise<\{ success: boolean; current: number \}> \{/g,
  "async consume(\n    key: string,\n    limit: number,\n    amount: number,\n    ttlSeconds?: number\n  ): Promise<{ success: boolean; current: number }> {"
);
coreContent = coreContent.replace(
  /async consume\(key: string, limit: number, amount: number\): Promise<\{ success: boolean; current: number \}> \{/g,
  "async consume(key: string, limit: number, amount: number, ttlSeconds?: number): Promise<{ success: boolean; current: number }> {"
);

// Add refund to InMemoryUsageRepository
if (!coreContent.includes("async refund(key: string, amount: number)")) {
  coreContent = coreContent.replace(
    /async getUsage\(key: string\): Promise<number> \{/g,
    "async refund(key: string, amount: number): Promise<void> {\n    const current = this.store.get(key) || 0;\n    this.store.set(key, Math.max(0, current - amount));\n  }\n\n  async getUsage(key: string): Promise<number> {"
  );
}

fs.writeFileSync(coreFile, coreContent);
console.log("Fixed InMemoryUsageRepository");
