const fs = require('fs');
let code = fs.readFileSync('packages/core/src/attachment.ts', 'utf8');

code = code.replace(
  `export interface AttachmentMetadataProperties {
  displayName: string;
  logicalMediaType: string;
  characteristics: string;
  description: string;
}`,
  `export interface AttachmentMetadataProperties {
  displayName: string;
  logicalMediaType: string;
  characteristics: string;
  description: string;
  fileSizeBytes?: number;
}`
);

code = code.replace(
  `  private readonly _characteristics: string;
  private readonly _description: string;`,
  `  private readonly _characteristics: string;
  private readonly _description: string;
  private readonly _fileSizeBytes: number;`
);

code = code.replace(
  `    this._logicalMediaType = properties.logicalMediaType;
    this._characteristics = properties.characteristics || "";
    this._description = properties.description || "";
  }`,
  `    this._logicalMediaType = properties.logicalMediaType;
    this._characteristics = properties.characteristics || "";
    this._description = properties.description || "";
    this._fileSizeBytes = properties.fileSizeBytes || 0;
    
    if (this._fileSizeBytes > 50 * 1024 * 1024) { // 50MB max
      throw new Error("File size exceeds 50MB limit.");
    }
  }`
);

code = code.replace(
  `  get characteristics(): string {
    return this._characteristics;
  }`,
  `  get characteristics(): string {
    return this._characteristics;
  }

  get fileSizeBytes(): number {
    return this._fileSizeBytes;
  }`
);

fs.writeFileSync('packages/core/src/attachment.ts', code);
console.log("Patched attachment file sizes");
