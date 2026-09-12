const fs = require('fs');

// PATCH MEMORY
let memory = fs.readFileSync('packages/core/src/memory.ts', 'utf8');
memory = memory.replace(
  'reference: string;\n  ownerId: string;',
  'reference: string;\n  tenantId: string;\n  ownerId: string;'
);
memory = memory.replace(
  'private readonly _reference: string;\n  private readonly _ownerId: string;',
  'private readonly _reference: string;\n  private readonly _tenantId: string;\n  private readonly _ownerId: string;'
);
memory = memory.replace(
  'if (!properties.ownerId || properties.ownerId.trim() === "") {',
  'if (!properties.tenantId || properties.tenantId.trim() === "") {\n      throw new Error("Tenant Reference is required.");\n    }\n    if (!properties.ownerId || properties.ownerId.trim() === "") {'
);
memory = memory.replace(
  'this._reference = properties.reference;\n    this._ownerId = properties.ownerId;',
  'this._reference = properties.reference;\n    this._tenantId = properties.tenantId;\n    this._ownerId = properties.ownerId;'
);
memory = memory.replace(
  'get reference(): string {\n    return this._reference;\n  }',
  'get reference(): string {\n    return this._reference;\n  }\n\n  get tenantId(): string {\n    return this._tenantId;\n  }'
);
fs.writeFileSync('packages/core/src/memory.ts', memory);
console.log('Patched memory.ts');

// PATCH POLICY
let policy = fs.readFileSync('packages/core/src/policy.ts', 'utf8');
policy = policy.replace(
  'reference: PolicyReference;\n  ownerId: string;',
  'reference: PolicyReference;\n  tenantId: string;\n  ownerId: string;'
);
policy = policy.replace(
  'private readonly _reference: PolicyReference;\n  private readonly _ownerId: string;',
  'private readonly _reference: PolicyReference;\n  private readonly _tenantId: string;\n  private readonly _ownerId: string;'
);
policy = policy.replace(
  'if (!properties.ownerId || properties.ownerId.trim() === "") {',
  'if (!properties.tenantId || properties.tenantId.trim() === "") {\n      throw new Error("Tenant Reference is required.");\n    }\n    if (!properties.ownerId || properties.ownerId.trim() === "") {'
);
policy = policy.replace(
  'this._reference = properties.reference;\n    this._ownerId = properties.ownerId;',
  'this._reference = properties.reference;\n    this._tenantId = properties.tenantId;\n    this._ownerId = properties.ownerId;'
);
policy = policy.replace(
  'get reference(): PolicyReference {\n    return this._reference;\n  }',
  'get reference(): PolicyReference {\n    return this._reference;\n  }\n\n  get tenantId(): string {\n    return this._tenantId;\n  }'
);
fs.writeFileSync('packages/core/src/policy.ts', policy);
console.log('Patched policy.ts');
