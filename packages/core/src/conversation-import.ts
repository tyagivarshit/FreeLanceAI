export interface ImportMetadataProperties {
  displayName: string;
  description: string;
  purpose: string;
  importScopeSummary: string;
}

export class ImportMetadata {
  private readonly _displayName: string;
  private readonly _description: string;
  private readonly _purpose: string;
  private readonly _importScopeSummary: string;

  constructor(properties: ImportMetadataProperties) {
    if (!properties.displayName || properties.displayName.trim() === "") {
      throw new Error("Display Name is required.");
    }
    if (!properties.description || properties.description.trim() === "") {
      throw new Error("Description is required.");
    }
    if (!properties.purpose || properties.purpose.trim() === "") {
      throw new Error("Purpose is required.");
    }
    if (!properties.importScopeSummary || properties.importScopeSummary.trim() === "") {
      throw new Error("Import Scope Summary is required.");
    }

    this._displayName = properties.displayName.trim();
    this._description = properties.description.trim();
    this._purpose = properties.purpose.trim();
    this._importScopeSummary = properties.importScopeSummary.trim();
    Object.freeze(this);
  }

  get displayName(): string {
    return this._displayName;
  }

  get description(): string {
    return this._description;
  }

  get purpose(): string {
    return this._purpose;
  }

  get importScopeSummary(): string {
    return this._importScopeSummary;
  }

  public equals(other: ImportMetadata): boolean {
    if (!other) {
      return false;
    }
    return (
      this._displayName === other.displayName &&
      this._description === other.description &&
      this._purpose === other.purpose &&
      this._importScopeSummary === other.importScopeSummary
    );
  }
}

export type ImportScopeValue =
  | "FullConversation"
  | "PartialConversation"
  | "SelectedPeriod"
  | "SelectedSegment";

export class ImportScope {
  private readonly _value: ImportScopeValue;

  constructor(value: string) {
    if (!value || value.trim() === "") {
      throw new Error("Import scope value is required.");
    }
    const cleanValue = value.trim();
    const validScopes = [
      "FullConversation",
      "PartialConversation",
      "SelectedPeriod",
      "SelectedSegment",
    ];
    if (!validScopes.includes(cleanValue)) {
      throw new Error(`Invalid Import scope: ${cleanValue}.`);
    }
    this._value = cleanValue as ImportScopeValue;
    Object.freeze(this);
  }

  get value(): ImportScopeValue {
    return this._value;
  }

  public equals(other: ImportScope): boolean {
    if (!other) {
      return false;
    }
    return this._value === other.value;
  }
}

// 1. Lifecycle State
export type ConversationImportLifecycle =
  | "Draft"
  | "Registered"
  | "Validated"
  | "Completed"
  | "Archived";

// 2. Value Objects

export class ImportFingerprint {
  private readonly _value: string;

  constructor(value: string) {
    if (!value || value.trim() === "") {
      throw new Error("Fingerprint value is required.");
    }
    this._value = value.trim();
    Object.freeze(this);
  }

  get value(): string {
    return this._value;
  }

  public equals(other: ImportFingerprint): boolean {
    if (!other) {
      return false;
    }
    return this._value === other.value;
  }
}

export class ImportReference {
  private readonly _value: string;

  constructor(value: string) {
    if (!value || value.trim() === "") {
      throw new Error("Import reference value is required.");
    }
    const cleanValue = value.trim();
    const referencePattern = /^[a-z0-9]+([.-][a-z0-9]+)*$/;
    if (!referencePattern.test(cleanValue)) {
      throw new Error(
        "Invalid import reference format. Must be lower-case dot/hyphen-separated key.",
      );
    }
    this._value = cleanValue;
    Object.freeze(this);
  }

  get value(): string {
    return this._value;
  }

  public equals(other: ImportReference): boolean {
    if (!other) {
      return false;
    }
    return this._value === other.value;
  }
}

export class ConversationReference {
  private readonly _value: string;

  constructor(value: string) {
    if (!value || value.trim() === "") {
      throw new Error("Conversation reference value is required.");
    }
    const cleanValue = value.trim();
    const referencePattern = /^[a-z0-9]+([.-][a-z0-9]+)*$/;
    if (!referencePattern.test(cleanValue)) {
      throw new Error(
        "Invalid conversation reference format. Must be lower-case dot/hyphen-separated key.",
      );
    }
    // Reject provider-specific keywords to ensure provider neutrality
    const providers = ["slack", "whatsapp", "gmail", "discord", "telegram", "intercom"];
    if (providers.some((p) => cleanValue.toLowerCase().includes(p))) {
      throw new Error("Conversation reference must not contain provider-specific semantics.");
    }
    this._value = cleanValue;
    Object.freeze(this);
  }

  get value(): string {
    return this._value;
  }

  public equals(other: ConversationReference): boolean {
    if (!other) {
      return false;
    }
    return this._value === other.value;
  }
}

export class SourceClassification {
  private readonly _value: string;

  constructor(value: string) {
    if (!value || value.trim() === "") {
      throw new Error("Source classification value is required.");
    }
    const cleanValue = value.trim();
    const validSources = [
      "slack",
      "whatsapp",
      "gmail",
      "discord",
      "telegram",
      "intercom",
      "custom",
    ];
    if (!validSources.includes(cleanValue.toLowerCase())) {
      throw new Error(`Invalid source classification: ${cleanValue}.`);
    }
    this._value = cleanValue;
    Object.freeze(this);
  }

  get value(): string {
    return this._value;
  }

  public equals(other: SourceClassification): boolean {
    if (!other) {
      return false;
    }
    return this._value.toLowerCase() === other.value.toLowerCase();
  }
}

export interface ConversationImportSnapshotProperties {
  version: number;
  createdAt: Date;
  conversationReference: ConversationReference;
  clientId: string;
  ownerId: string;
  sourceClassification: SourceClassification;
  metadata: ImportMetadata;
  scope: ImportScope;
  fingerprint: ImportFingerprint;
  lifecycle: ConversationImportLifecycle;
  importReference: ImportReference;
}

export class ConversationImportSnapshot {
  private readonly _version: number;
  private readonly _createdAt: Date;
  private readonly _conversationReference: ConversationReference;
  private readonly _clientId: string;
  private readonly _ownerId: string;
  private readonly _sourceClassification: SourceClassification;
  private readonly _metadata: ImportMetadata;
  private readonly _scope: ImportScope;
  private readonly _fingerprint: ImportFingerprint;
  private readonly _lifecycle: ConversationImportLifecycle;
  private readonly _importReference: ImportReference;

  constructor(properties: ConversationImportSnapshotProperties) {
    if (properties.version <= 0) {
      throw new Error("Snapshot version must be greater than zero.");
    }
    if (!properties.createdAt) {
      throw new Error("Snapshot creation date is required.");
    }
    if (!properties.conversationReference) {
      throw new Error("Conversation reference is required.");
    }
    if (!properties.clientId || properties.clientId.trim() === "") {
      throw new Error("Client reference is required.");
    }
    if (!properties.ownerId || properties.ownerId.trim() === "") {
      throw new Error("Owner reference is required.");
    }
    if (!properties.sourceClassification) {
      throw new Error("Source classification is required.");
    }
    if (!properties.metadata) {
      throw new Error("Import metadata is required.");
    }
    if (!properties.scope) {
      throw new Error("Import scope is required.");
    }
    if (!properties.fingerprint) {
      throw new Error("Import fingerprint is required.");
    }
    if (!properties.lifecycle) {
      throw new Error("Lifecycle state is required.");
    }
    if (!properties.importReference) {
      throw new Error("Import reference is required.");
    }

    this._version = properties.version;
    this._createdAt = new Date(properties.createdAt.getTime());
    this._conversationReference = properties.conversationReference;
    this._clientId = properties.clientId;
    this._ownerId = properties.ownerId;
    this._sourceClassification = properties.sourceClassification;
    this._metadata = properties.metadata;
    this._scope = properties.scope;
    this._fingerprint = properties.fingerprint;
    this._lifecycle = properties.lifecycle;
    this._importReference = properties.importReference;
    Object.freeze(this);
  }

  get version(): number {
    return this._version;
  }

  get createdAt(): Date {
    return new Date(this._createdAt.getTime());
  }

  get conversationReference(): ConversationReference {
    return this._conversationReference;
  }

  get clientId(): string {
    return this._clientId;
  }

  get ownerId(): string {
    return this._ownerId;
  }

  get sourceClassification(): SourceClassification {
    return this._sourceClassification;
  }

  get metadata(): ImportMetadata {
    return this._metadata;
  }

  get scope(): ImportScope {
    return this._scope;
  }

  get fingerprint(): ImportFingerprint {
    return this._fingerprint;
  }

  get lifecycle(): ConversationImportLifecycle {
    return this._lifecycle;
  }

  get importReference(): ImportReference {
    return this._importReference;
  }
}

// 3. Domain Events
export const CONVERSATION_IMPORT_REGISTERED = "CONVERSATION_IMPORT_REGISTERED";
export const CONVERSATION_IMPORT_VALIDATED = "CONVERSATION_IMPORT_VALIDATED";
export const CONVERSATION_IMPORT_COMPLETED = "CONVERSATION_IMPORT_COMPLETED";
export const CONVERSATION_IMPORT_ARCHIVED = "CONVERSATION_IMPORT_ARCHIVED";

export type ConversationImportDomainEventName =
  | typeof CONVERSATION_IMPORT_REGISTERED
  | typeof CONVERSATION_IMPORT_VALIDATED
  | typeof CONVERSATION_IMPORT_COMPLETED
  | typeof CONVERSATION_IMPORT_ARCHIVED;

export interface ConversationImportRegisteredEvent {
  readonly eventType: typeof CONVERSATION_IMPORT_REGISTERED;
  readonly importId: string;
  readonly importReference: string;
  readonly clientId: string;
  readonly ownerId: string;
  readonly snapshotVersion: number;
}

export interface ConversationImportValidatedEvent {
  readonly eventType: typeof CONVERSATION_IMPORT_VALIDATED;
  readonly importId: string;
  readonly importReference: string;
  readonly clientId: string;
  readonly ownerId: string;
  readonly snapshotVersion: number;
}

export interface ConversationImportCompletedEvent {
  readonly eventType: typeof CONVERSATION_IMPORT_COMPLETED;
  readonly importId: string;
  readonly importReference: string;
  readonly clientId: string;
  readonly ownerId: string;
  readonly snapshotVersion: number;
}

export interface ConversationImportArchivedEvent {
  readonly eventType: typeof CONVERSATION_IMPORT_ARCHIVED;
  readonly importId: string;
  readonly importReference: string;
  readonly clientId: string;
  readonly ownerId: string;
  readonly snapshotVersion: number;
}

export type ConversationImportDomainEvent =
  | ConversationImportRegisteredEvent
  | ConversationImportValidatedEvent
  | ConversationImportCompletedEvent
  | ConversationImportArchivedEvent;

export interface ConversationImportEventPublisher {
  publish(event: ConversationImportDomainEvent): Promise<void>;
}

// 4. Persistence & Query Projection Contracts
export interface ConversationImportQueryProjection {
  readonly id: string;
  readonly importReference: string;
  readonly clientId: string;
  readonly ownerId: string;
  readonly lifecycle: ConversationImportLifecycle;
  readonly source: string;
  readonly versionCount: number;
  readonly updatedAt: Date;
}

export interface ConversationImportPersistenceContract {
  checkUniqueReference(
    ownerId: string,
    reference: string,
    excludeImportId?: string,
  ): Promise<boolean>;
}

export interface ConversationImportAggregateStore {
  save(importObj: ConversationImport): Promise<void>;
  findById(id: string, ownerId: string): Promise<ConversationImport | null>;
  findByReference(reference: string, ownerId: string): Promise<ConversationImport | null>;
}

// 5. Aggregate Root Properties
export interface ConversationImportProperties {
  id: string;
  importReference: ImportReference;
  conversationReference: ConversationReference;
  clientId: string;
  ownerId: string;
  sourceClassification: SourceClassification;
  metadata: ImportMetadata;
  scope: ImportScope;
  fingerprint: ImportFingerprint;
  lifecycle: ConversationImportLifecycle;
  snapshots: ConversationImportSnapshot[];
  createdAt: Date;
  updatedAt: Date;
}

// 6. ConversationImport Aggregate Root
export class ConversationImport {
  private readonly _id: string;
  private readonly _importReference: ImportReference;
  private readonly _conversationReference: ConversationReference;
  private readonly _clientId: string;
  private readonly _ownerId: string;
  private readonly _sourceClassification: SourceClassification;
  private _metadata: ImportMetadata;
  private _scope: ImportScope;
  private _fingerprint: ImportFingerprint;
  private _lifecycle: ConversationImportLifecycle;
  private readonly _snapshots: ConversationImportSnapshot[] = [];
  private readonly _createdAt: Date;
  private _updatedAt: Date;
  private _domainEvents: ConversationImportDomainEvent[] = [];

  constructor(properties: ConversationImportProperties) {
    this._id = properties.id;
    this._importReference = properties.importReference;
    this._conversationReference = properties.conversationReference;
    this._clientId = properties.clientId;
    this._ownerId = properties.ownerId;
    this._sourceClassification = properties.sourceClassification;
    this._metadata = properties.metadata;
    this._scope = properties.scope;
    this._fingerprint = properties.fingerprint;
    this._lifecycle = properties.lifecycle;
    this._createdAt = new Date(properties.createdAt.getTime());
    this._updatedAt = new Date(properties.updatedAt.getTime());

    if (properties.snapshots && properties.snapshots.length > 0) {
      this._snapshots = [...properties.snapshots];
    }

    this.validateInvariants();
  }

  // Getters
  get id(): string {
    return this._id;
  }

  get importReference(): ImportReference {
    return this._importReference;
  }

  get conversationReference(): ConversationReference {
    return this._conversationReference;
  }

  get clientId(): string {
    return this._clientId;
  }

  get ownerId(): string {
    return this._ownerId;
  }

  get sourceClassification(): SourceClassification {
    return this._sourceClassification;
  }

  get metadata(): ImportMetadata {
    return this._metadata;
  }

  get scope(): ImportScope {
    return this._scope;
  }

  get fingerprint(): ImportFingerprint {
    return this._fingerprint;
  }

  get lifecycle(): ConversationImportLifecycle {
    return this._lifecycle;
  }

  get snapshots(): ReadonlyArray<ConversationImportSnapshot> {
    return Object.freeze([...this._snapshots]);
  }

  get createdAt(): Date {
    return new Date(this._createdAt.getTime());
  }

  get updatedAt(): Date {
    return new Date(this._updatedAt.getTime());
  }

  get domainEvents(): ReadonlyArray<ConversationImportDomainEvent> {
    return this._domainEvents;
  }

  public clearDomainEvents(): void {
    this._domainEvents = [];
  }

  private addDomainEvent(event: ConversationImportDomainEvent): void {
    this._domainEvents.push(event);
  }

  private verifyOwnership(actorOwnerId: string): void {
    if (!actorOwnerId || actorOwnerId.trim() === "") {
      throw new Error("Missing owner identity in caller context.");
    }
    if (actorOwnerId !== this._ownerId) {
      throw new Error("Ownership validation failed: unauthorized owner context.");
    }
  }

  private validateInvariants(): void {
    if (!this._id || this._id.trim() === "") {
      throw new Error("Import Identity is required.");
    }
    if (!this._importReference) {
      throw new Error("Import Reference is required.");
    }
    if (!this._conversationReference) {
      throw new Error("Conversation Reference is required.");
    }
    if (!this._clientId || this._clientId.trim() === "") {
      throw new Error("Client Reference is required.");
    }
    if (!this._ownerId || this._ownerId.trim() === "") {
      throw new Error("Owner Reference is required.");
    }
    if (!this._sourceClassification) {
      throw new Error("Source Classification is required.");
    }
    if (!this._metadata) {
      throw new Error("Import Metadata is required.");
    }
    if (!this._scope) {
      throw new Error("Import Scope is required.");
    }
    if (!this._fingerprint) {
      throw new Error("Import Fingerprint is required.");
    }
    if (!this._lifecycle) {
      throw new Error("Lifecycle state is required.");
    }

    if (this._snapshots.length > 0) {
      let previousVersion = 0;
      for (const snap of this._snapshots) {
        if (snap.version <= previousVersion) {
          throw new Error("Snapshot history must be sequential and strictly increasing.");
        }
        previousVersion = snap.version;
      }
    }
  }

  private appendSnapshot(): void {
    const nextVersion = this._snapshots.length + 1;
    const newSnapshot = new ConversationImportSnapshot({
      version: nextVersion,
      createdAt: new Date(),
      conversationReference: this._conversationReference,
      clientId: this._clientId,
      ownerId: this._ownerId,
      sourceClassification: this._sourceClassification,
      metadata: this._metadata,
      scope: this._scope,
      fingerprint: this._fingerprint,
      lifecycle: this._lifecycle,
      importReference: this._importReference,
    });
    this._snapshots.push(newSnapshot);
  }

  // Factory Creation Method
  public static create(
    id: string,
    importReference: ImportReference,
    conversationReference: ConversationReference,
    clientId: string,
    ownerId: string,
    sourceClassification: SourceClassification,
    metadata: ImportMetadata,
    scope: ImportScope,
    fingerprint: ImportFingerprint,
  ): ConversationImport {
    const now = new Date();
    const importObj = new ConversationImport({
      id,
      importReference,
      conversationReference,
      clientId,
      ownerId,
      sourceClassification,
      metadata,
      scope,
      fingerprint,
      lifecycle: "Draft",
      snapshots: [],
      createdAt: now,
      updatedAt: now,
    });

    importObj.appendSnapshot();
    return importObj;
  }

  // Domain Operations
  public register(actorOwnerId: string): void {
    this.verifyOwnership(actorOwnerId);
    if (this._lifecycle !== "Draft") {
      throw new Error(`Cannot register conversation import when in status: ${this._lifecycle}`);
    }

    this._lifecycle = "Registered";
    this._updatedAt = new Date();
    this.appendSnapshot();

    this.addDomainEvent({
      eventType: CONVERSATION_IMPORT_REGISTERED,
      importId: this._id,
      importReference: this._importReference.value,
      clientId: this._clientId,
      ownerId: this._ownerId,
      snapshotVersion: this._snapshots.length,
    });
  }

  public validate(actorOwnerId: string): void {
    this.verifyOwnership(actorOwnerId);
    if (this._lifecycle !== "Registered") {
      throw new Error(`Cannot validate conversation import when in status: ${this._lifecycle}`);
    }

    this._lifecycle = "Validated";
    this._updatedAt = new Date();
    this.appendSnapshot();

    this.addDomainEvent({
      eventType: CONVERSATION_IMPORT_VALIDATED,
      importId: this._id,
      importReference: this._importReference.value,
      clientId: this._clientId,
      ownerId: this._ownerId,
      snapshotVersion: this._snapshots.length,
    });
  }

  public complete(actorOwnerId: string): void {
    this.verifyOwnership(actorOwnerId);
    if (this._lifecycle !== "Validated") {
      throw new Error(`Cannot complete conversation import when in status: ${this._lifecycle}`);
    }

    this._lifecycle = "Completed";
    this._updatedAt = new Date();
    this.appendSnapshot();

    this.addDomainEvent({
      eventType: CONVERSATION_IMPORT_COMPLETED,
      importId: this._id,
      importReference: this._importReference.value,
      clientId: this._clientId,
      ownerId: this._ownerId,
      snapshotVersion: this._snapshots.length,
    });
  }

  public archive(actorOwnerId: string): void {
    this.verifyOwnership(actorOwnerId);
    if (this._lifecycle === "Archived") {
      throw new Error("Conversation import is already archived.");
    }

    this._lifecycle = "Archived";
    this._updatedAt = new Date();
    this.appendSnapshot();

    this.addDomainEvent({
      eventType: CONVERSATION_IMPORT_ARCHIVED,
      importId: this._id,
      importReference: this._importReference.value,
      clientId: this._clientId,
      ownerId: this._ownerId,
      snapshotVersion: this._snapshots.length,
    });
  }

  public update(
    actorOwnerId: string,
    metadata: ImportMetadata,
    scope: ImportScope,
    fingerprint: ImportFingerprint,
  ): void {
    this.verifyOwnership(actorOwnerId);
    if (this._lifecycle === "Completed" || this._lifecycle === "Archived") {
      throw new Error(`Cannot update conversation import in status: ${this._lifecycle}`);
    }

    this._metadata = metadata;
    this._scope = scope;
    this._fingerprint = fingerprint;
    this._updatedAt = new Date();
    this.appendSnapshot();
  }
}
