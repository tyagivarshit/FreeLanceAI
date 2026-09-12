const fs = require('fs');

// 1. Fix ai-gateway.ts
let aiGtw = fs.readFileSync('packages/core/src/ai-gateway.ts', 'utf8');
aiGtw = aiGtw.replace(/tenantId: string;\n\s+tenantId: string;/g, 'tenantId: string;');
aiGtw = aiGtw.replace(/private readonly _tenantId: string;\n\s+private readonly _tenantId: string;/g, 'private readonly _tenantId: string;');
aiGtw = aiGtw.replace(
  'requestId: string, requestContextReference: string, ownerId: string',
  'requestId: string, tenantId: string, requestContextReference: string, ownerId: string'
);
aiGtw = aiGtw.replace(
  'return new AiRequest({\n      requestId,\n      requestContextReference,\n      ownerId,',
  'return new AiRequest({\n      requestId,\n      tenantId,\n      requestContextReference,\n      ownerId,'
);
aiGtw = aiGtw.replace(
  'eventType: "AI_REQUEST_RECEIVED",\n        requestId: this._id,\n        requestContextReference: this._requestContextReference,\n        ownerId: this._ownerId,',
  'eventType: "AI_REQUEST_RECEIVED",\n        requestId: this._id,\n        tenantId: this._tenantId,\n        requestContextReference: this._requestContextReference,\n        ownerId: this._ownerId,'
);
fs.writeFileSync('packages/core/src/ai-gateway.ts', aiGtw);

// 2. Fix ai-gateway.test.ts
if (fs.existsSync('packages/core/src/ai-gateway.test.ts')) {
  let aiGtwTest = fs.readFileSync('packages/core/src/ai-gateway.test.ts', 'utf8');
  aiGtwTest = aiGtwTest.replace(/requestId: "req-1",\n\s+requestContextReference/g, 'requestId: "req-1",\n        tenantId: "tenant-1",\n        requestContextReference');
  fs.writeFileSync('packages/core/src/ai-gateway.test.ts', aiGtwTest);
}

// 3. Fix memory.ts
let memory = fs.readFileSync('packages/core/src/memory.ts', 'utf8');
memory = memory.replace(
  'id: string, reference: string, ownerId: string, metadata: MemoryMetadata',
  'id: string, tenantId: string, reference: string, ownerId: string, metadata: MemoryMetadata'
);
memory = memory.replace(
  'return new Memory({\n      id,\n      reference,\n      ownerId,',
  'return new Memory({\n      id,\n      tenantId,\n      reference,\n      ownerId,'
);
fs.writeFileSync('packages/core/src/memory.ts', memory);

// 4. Fix policy.ts
let policy = fs.readFileSync('packages/core/src/policy.ts', 'utf8');
policy = policy.replace(
  'id: string, reference: PolicyReference, ownerId: string, definition: PolicyDefinition, metadata: PolicyMetadata, ruleSet: PolicyRuleSet',
  'id: string, tenantId: string, reference: PolicyReference, ownerId: string, definition: PolicyDefinition, metadata: PolicyMetadata, ruleSet: PolicyRuleSet'
);
policy = policy.replace(
  'return new Policy({\n      id,\n      reference,\n      ownerId,',
  'return new Policy({\n      id,\n      tenantId,\n      reference,\n      ownerId,'
);
fs.writeFileSync('packages/core/src/policy.ts', policy);

// 5. Fix prompt-registry.ts
let promptReg = fs.readFileSync('packages/core/src/prompt-registry.ts', 'utf8');
promptReg = promptReg.replace(
  'id: string, reference: string, ownerId: string, definition: PromptDefinition, metadata: PromptMetadata, visibility: LogicalVisibilityClassification',
  'id: string, tenantId: string, reference: string, ownerId: string, definition: PromptDefinition, metadata: PromptMetadata, visibility: LogicalVisibilityClassification'
);
promptReg = promptReg.replace(
  'return new Prompt({\n      id,\n      reference,\n      ownerId,',
  'return new Prompt({\n      id,\n      tenantId,\n      reference,\n      ownerId,'
);
fs.writeFileSync('packages/core/src/prompt-registry.ts', promptReg);

console.log('Fixed typescript models');
