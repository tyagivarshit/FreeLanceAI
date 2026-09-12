const fs = require("fs");

// 1. ai-gateway.ts
let aiGtw = fs.readFileSync("packages/core/src/ai-gateway.ts", "utf8");
aiGtw = aiGtw.replace("  tenantId: string;\n  readonly tenantId: string;", "  readonly tenantId: string;");

aiGtw = aiGtw.replace(
  "    requestId: string,\n    requestContextReference: string,\n    ownerId: string",
  "    requestId: string,\n    tenantId: string,\n    requestContextReference: string,\n    ownerId: string"
);

aiGtw = aiGtw.replace(
  "    return new AiRequest({\n      requestId,\n      requestContextReference,\n      ownerId,",
  "    return new AiRequest({\n      requestId,\n      tenantId,\n      requestContextReference,\n      ownerId,"
);

aiGtw = aiGtw.replace(
  "        eventType: \"AI_REQUEST_RECEIVED\",\n        requestId: this._id,\n        requestContextReference: this._requestContextReference,\n        ownerId: this._ownerId,",
  "        eventType: \"AI_REQUEST_RECEIVED\",\n        requestId: this._id,\n        tenantId: this._tenantId,\n        requestContextReference: this._requestContextReference,\n        ownerId: this._ownerId,"
);

fs.writeFileSync("packages/core/src/ai-gateway.ts", aiGtw);

// 2. memory.ts
let memory = fs.readFileSync("packages/core/src/memory.ts", "utf8");
memory = memory.replace(
  "    id: string,\n    reference: string,\n    ownerId: string,\n    metadata: MemoryMetadata",
  "    id: string,\n    tenantId: string,\n    reference: string,\n    ownerId: string,\n    metadata: MemoryMetadata"
);
memory = memory.replace(
  "    return new Memory({\n      id,\n      reference,\n      ownerId,",
  "    return new Memory({\n      id,\n      tenantId,\n      reference,\n      ownerId,"
);
fs.writeFileSync("packages/core/src/memory.ts", memory);

// 3. policy.ts
let policy = fs.readFileSync("packages/core/src/policy.ts", "utf8");
policy = policy.replace(
  "    id: string,\n    reference: PolicyReference,\n    ownerId: string,\n    definition: PolicyDefinition,\n    metadata: PolicyMetadata,\n    ruleSet: PolicyRuleSet",
  "    id: string,\n    tenantId: string,\n    reference: PolicyReference,\n    ownerId: string,\n    definition: PolicyDefinition,\n    metadata: PolicyMetadata,\n    ruleSet: PolicyRuleSet"
);
policy = policy.replace(
  "    return new Policy({\n      id,\n      reference,\n      ownerId,",
  "    return new Policy({\n      id,\n      tenantId,\n      reference,\n      ownerId,"
);
fs.writeFileSync("packages/core/src/policy.ts", policy);

// 4. prompt-registry.ts
let promptReg = fs.readFileSync("packages/core/src/prompt-registry.ts", "utf8");
promptReg = promptReg.replace(
  "    id: string,\n    reference: string,\n    ownerId: string,\n    definition: PromptDefinition,\n    metadata: PromptMetadata,\n    visibility: LogicalVisibilityClassification",
  "    id: string,\n    tenantId: string,\n    reference: string,\n    ownerId: string,\n    definition: PromptDefinition,\n    metadata: PromptMetadata,\n    visibility: LogicalVisibilityClassification"
);
promptReg = promptReg.replace(
  "    return new Prompt({\n      id,\n      reference,\n      ownerId,",
  "    return new Prompt({\n      id,\n      tenantId,\n      reference,\n      ownerId,"
);
fs.writeFileSync("packages/core/src/prompt-registry.ts", promptReg);

// 5. ai-gateway.test.ts
if (fs.existsSync("packages/core/src/ai-gateway.test.ts")) {
  let aiTest = fs.readFileSync("packages/core/src/ai-gateway.test.ts", "utf8");
  aiTest = aiTest.replace(
    "      requestId: \"req-1\",\n      requestContextReference:",
    "      requestId: \"req-1\",\n      tenantId: \"tenant-1\",\n      requestContextReference:"
  );
  aiTest = aiTest.replace(
    "      requestId: \"req-2\",\n      requestContextReference:",
    "      requestId: \"req-2\",\n      tenantId: \"tenant-1\",\n      requestContextReference:"
  );
  aiTest = aiTest.replace(
    "      requestId: \"req-3\",\n      requestContextReference:",
    "      requestId: \"req-3\",\n      tenantId: \"tenant-1\",\n      requestContextReference:"
  );
  fs.writeFileSync("packages/core/src/ai-gateway.test.ts", aiTest);
}

console.log("TypeScript models fixed");
