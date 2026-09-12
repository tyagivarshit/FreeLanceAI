const fs = require('fs');

let content = fs.readFileSync('packages/core/src/ai-gateway.ts', 'utf8');

// Add tenantId to AiRequestReceivedEvent
content = content.replace(
  'readonly requestContextReference: string;',
  'readonly requestContextReference: string;\n  readonly tenantId: string;'
);

// Add tenantId to AiRequestProperties
content = content.replace(
  'requestContextReference: string;',
  'requestContextReference: string;\n  tenantId: string;'
);

// Add tenantId field to AiRequest class
content = content.replace(
  'private readonly _requestContextReference: string;',
  'private readonly _requestContextReference: string;\n  private readonly _tenantId: string;'
);

// Add tenantId validation in constructor
content = content.replace(
  'if (!properties.ownerId || properties.ownerId.trim() === "") {',
  'if (!properties.tenantId || properties.tenantId.trim() === "") {\n      throw new Error("Tenant ID reference is required.");\n    }\n    if (!properties.ownerId || properties.ownerId.trim() === "") {'
);

// Add tenantId assignment in constructor
content = content.replace(
  'this._requestContextReference = properties.requestContextReference;',
  'this._requestContextReference = properties.requestContextReference;\n    this._tenantId = properties.tenantId;'
);

// Add getter for tenantId
content = content.replace(
  'get requestContextReference(): string {\n    return this._requestContextReference;\n  }',
  'get requestContextReference(): string {\n    return this._requestContextReference;\n  }\n\n  get tenantId(): string {\n    return this._tenantId;\n  }'
);

// Add tenantId to AiRequestQueryProjection
content = content.replace(
  'requestContextReference: string;\n  ownerId: string;',
  'requestContextReference: string;\n  tenantId: string;\n  ownerId: string;'
);

// Add tenantId to event published in factory
content = content.replace(
  'requestContextReference: requestContextReference,',
  'requestContextReference: requestContextReference,\n          tenantId: properties.tenantId,'
);

fs.writeFileSync('packages/core/src/ai-gateway.ts', content);
console.log('Patched ai-gateway.ts successfully');
