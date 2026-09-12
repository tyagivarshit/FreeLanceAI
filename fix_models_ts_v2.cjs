const fs = require('fs');

// Fix ai-gateway-service.ts type unknown
let aiSvc = fs.readFileSync('packages/core/src/services/ai-gateway-service.ts', 'utf8');
aiSvc = aiSvc.replace(/const data = await response\.json\(\);/g, 'const data = await response.json() as any;');
fs.writeFileSync('packages/core/src/services/ai-gateway-service.ts', aiSvc);

// Fix ai-gateway.ts duplicate tenantId
let aiGtw = fs.readFileSync('packages/core/src/ai-gateway.ts', 'utf8');
// remove all duplicate tenantId
aiGtw = aiGtw.replace(/tenantId: string;\s*tenantId: string;/g, 'tenantId: string;');
aiGtw = aiGtw.replace(/private readonly _tenantId: string;\s*private readonly _tenantId: string;/g, 'private readonly _tenantId: string;');

// For create method in ai-gateway
aiGtw = aiGtw.replace(/return new AiRequest\(\{\s*requestId,\s*requestContextReference,\s*ownerId,/g, 'return new AiRequest({\n      requestId,\n      tenantId,\n      requestContextReference,\n      ownerId,');
aiGtw = aiGtw.replace(/eventType: "AI_REQUEST_RECEIVED",\s*requestId: this._id,\s*requestContextReference: this._requestContextReference,\s*ownerId: this._ownerId,/g, 'eventType: "AI_REQUEST_RECEIVED",\n        requestId: this._id,\n        tenantId: this._tenantId,\n        requestContextReference: this._requestContextReference,\n        ownerId: this._ownerId,');
fs.writeFileSync('packages/core/src/ai-gateway.ts', aiGtw);

// Fix memory.ts
let memory = fs.readFileSync('packages/core/src/memory.ts', 'utf8');
memory = memory.replace(/return new Memory\(\{\s*id,\s*reference,\s*ownerId,/g, 'return new Memory({\n      id,\n      tenantId,\n      reference,\n      ownerId,');
fs.writeFileSync('packages/core/src/memory.ts', memory);

// Fix policy.ts
let policy = fs.readFileSync('packages/core/src/policy.ts', 'utf8');
policy = policy.replace(/return new Policy\(\{\s*id,\s*reference,\s*ownerId,/g, 'return new Policy({\n      id,\n      tenantId,\n      reference,\n      ownerId,');
fs.writeFileSync('packages/core/src/policy.ts', policy);

// Fix prompt-registry.ts
let promptReg = fs.readFileSync('packages/core/src/prompt-registry.ts', 'utf8');
promptReg = promptReg.replace(/return new Prompt\(\{\s*id,\s*reference,\s*ownerId,/g, 'return new Prompt({\n      id,\n      tenantId,\n      reference,\n      ownerId,');
fs.writeFileSync('packages/core/src/prompt-registry.ts', promptReg);

// Fix ai-gateway.test.ts
if (fs.existsSync('packages/core/src/ai-gateway.test.ts')) {
  let aiTest = fs.readFileSync('packages/core/src/ai-gateway.test.ts', 'utf8');
  aiTest = aiTest.replace(/requestId: "req-1",\s*requestContextReference: "test",/g, 'requestId: "req-1",\n      tenantId: "tenant-1",\n      requestContextReference: "test",');
  aiTest = aiTest.replace(/requestId: "req-2",\s*requestContextReference: "test-2",/g, 'requestId: "req-2",\n      tenantId: "tenant-1",\n      requestContextReference: "test-2",');
  fs.writeFileSync('packages/core/src/ai-gateway.test.ts', aiTest);
}

console.log("Fixed models");
