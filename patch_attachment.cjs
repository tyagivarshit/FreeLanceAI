const fs = require('fs');
let code = fs.readFileSync('packages/core/src/attachment.ts', 'utf8');

// 1. Fix AttachmentMetadata
code = code.replace(
  `    if (!properties.logicalMediaType || properties.logicalMediaType.trim() === "") {
      throw new Error("Logical media type is required.");
    }`,
  `    if (!properties.logicalMediaType || properties.logicalMediaType.trim() === "") {
      throw new Error("Logical media type is required.");
    }
    const mediaTypeLower = properties.logicalMediaType.toLowerCase();
    if (mediaTypeLower === "text/html" || mediaTypeLower === "application/javascript" || mediaTypeLower.includes("script")) {
      throw new Error("Malicious media type blocked.");
    }`
);

// 2. Fix verifyOwnership
code = code.replace(
  `  private verifyOwnership(ownerId: string) {
    if (ownerId !== this._ownerId) {
      throw new Error("Ownership validation failed.");
    }
  }`,
  `  private verifyOwnership(ownerId: string, tenantId?: string) {
    if (ownerId !== this._ownerId) {
      throw new Error("Ownership validation failed.");
    }
    if (tenantId && tenantId !== this._tenantId) {
      throw new Error("Tenant boundary violation.");
    }
  }`
);

// Fix usages of verifyOwnership in attachment.ts
code = code.replace(/this\.verifyOwnership\(ownerId\);/g, 'this.verifyOwnership(ownerId);');

// 3. Fix validateInvariants
code = code.replace(
  `  private validateInvariants() {
    if (!this._attachmentId || this._attachmentId.trim() === "") {
      throw new Error("Attachment ID is required.");
    }
    if (!this._parentId || this._parentId.trim() === "") {
      throw new Error("Parent ID reference is required.");
    }`,
  `  private validateInvariants() {
    if (!this._attachmentId || this._attachmentId.trim() === "") {
      throw new Error("Attachment ID is required.");
    }
    if (!this._tenantId || this._tenantId.trim() === "") {
      throw new Error("Tenant ID is required.");
    }
    if (!this._parentId || this._parentId.trim() === "") {
      throw new Error("Parent ID reference is required.");
    }
    if (!this._parentType || this._parentType.trim() === "") {
      throw new Error("Parent Type is required.");
    }`
);

// 4. Fix updateMetadata to block Archived
code = code.replace(
  `  public updateMetadata(ownerId: string, metadata: AttachmentMetadata) {
    this.verifyOwnership(ownerId);
    if (this._status === "Deleted") {
      throw new Error("Cannot update metadata on deleted attachment.");
    }`,
  `  public updateMetadata(ownerId: string, metadata: AttachmentMetadata) {
    this.verifyOwnership(ownerId);
    if (this._status === "Deleted" || this._status === "Archived") {
      throw new Error("Cannot update metadata on deleted or archived attachment.");
    }`
);

// 5. Fix updateVisibility to block Archived
code = code.replace(
  `  public updateVisibility(ownerId: string, visibility: AttachmentVisibility) {
    this.verifyOwnership(ownerId);
    if (this._status === "Deleted") {
      throw new Error("Cannot update visibility on deleted attachment.");
    }`,
  `  public updateVisibility(ownerId: string, visibility: AttachmentVisibility) {
    this.verifyOwnership(ownerId);
    if (this._status === "Deleted" || this._status === "Archived") {
      throw new Error("Cannot update visibility on deleted or archived attachment.");
    }`
);

fs.writeFileSync('packages/core/src/attachment.ts', code);
console.log("Patched attachment.ts");
