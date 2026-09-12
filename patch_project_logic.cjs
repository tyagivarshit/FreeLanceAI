const fs = require('fs');
let code = fs.readFileSync('packages/core/src/project.ts', 'utf8');

// 1. Fix cancel to allow Draft and Planned
code = code.replace(
  `  public cancel(ownerId: string) {
    this.verifyOwnership(ownerId);
    if (this._status !== "Active" && this._status !== "Paused") {
      throw new Error(\`Cannot cancel project in status: \${this._status}\`);
    }`,
  `  public cancel(ownerId: string) {
    this.verifyOwnership(ownerId);
    if (this._status === "Completed" || this._status === "Archived" || this._status === "Cancelled") {
      throw new Error(\`Cannot cancel project in status: \${this._status}\`);
    }`
);

// 2. Fix archive to allow Draft and Planned
// Actually wait, let's leave archive as is (only terminal states can be archived).

// 3. Fix updateDetails to allow Active and Paused
code = code.replace(
  `  public updateDetails(ownerId: string, metadata: ProjectMetadata, visibility: ProjectVisibility) {
    this.verifyOwnership(ownerId);
    if (this._status !== "Draft" && this._status !== "Planned") {
      throw new Error(\`Cannot modify project details in status: \${this._status}\`);
    }`,
  `  public updateDetails(ownerId: string, metadata: ProjectMetadata, visibility: ProjectVisibility) {
    this.verifyOwnership(ownerId);
    if (this._status === "Completed" || this._status === "Archived" || this._status === "Cancelled") {
      throw new Error(\`Cannot modify project details in status: \${this._status}\`);
    }`
);

// 4. Add tenantId to validateInvariants
code = code.replace(
  `  private validateInvariants() {
    if (!this._projectId || this._projectId.trim() === "") {
      throw new Error("Project ID is required.");
    }
    if (!this._clientId || this._clientId.trim() === "") {
      throw new Error("Client ID reference is required.");
    }`,
  `  private validateInvariants() {
    if (!this._projectId || this._projectId.trim() === "") {
      throw new Error("Project ID is required.");
    }
    if (!this._tenantId || this._tenantId.trim() === "") {
      throw new Error("Tenant ID is required.");
    }
    if (!this._clientId || this._clientId.trim() === "") {
      throw new Error("Client ID reference is required.");
    }`
);

fs.writeFileSync('packages/core/src/project.ts', code);
console.log("Patched project.ts");
