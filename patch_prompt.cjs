const fs = require('fs');

let content = fs.readFileSync('packages/core/src/prompt-registry.ts', 'utf8');

// Add tenantId to PromptProperties
content = content.replace(
  'reference: string;\n  ownerId: string;',
  'reference: string;\n  tenantId: string;\n  ownerId: string;'
);

// Add tenantId to Prompt class properties
content = content.replace(
  'private readonly _reference: string;\n  private readonly _ownerId: string;',
  'private readonly _reference: string;\n  private readonly _tenantId: string;\n  private readonly _ownerId: string;'
);

// Add tenantId validation
content = content.replace(
  'if (!properties.ownerId || properties.ownerId.trim() === "") {',
  'if (!properties.tenantId || properties.tenantId.trim() === "") {\n      throw new Error("Tenant Reference is required.");\n    }\n    if (!properties.ownerId || properties.ownerId.trim() === "") {'
);

// Add tenantId assignment
content = content.replace(
  'this._reference = properties.reference;\n    this._ownerId = properties.ownerId;',
  'this._reference = properties.reference;\n    this._tenantId = properties.tenantId;\n    this._ownerId = properties.ownerId;'
);

// Add tenantId getter
content = content.replace(
  'get reference(): string {\n    return this._reference;\n  }',
  'get reference(): string {\n    return this._reference;\n  }\n\n  get tenantId(): string {\n    return this._tenantId;\n  }'
);

fs.writeFileSync('packages/core/src/prompt-registry.ts', content);
console.log('Patched prompt-registry.ts successfully');
