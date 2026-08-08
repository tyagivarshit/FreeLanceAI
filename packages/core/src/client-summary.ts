// 1. Lifecycle State
export type SummaryLifecycle = "Draft" | "Generated" | "Validated" | "Published" | "Archived";

// 2. Value Objects

export interface SummaryContentProperties {
  businessSummary: string;
  relationshipSummary: string;
  currentSituation: string;
  knownGoals: string[];
  knownConstraints: string[];
  openTopics: string[];
}

export class SummaryContent {
  private readonly _businessSummary: string;
  private readonly _relationshipSummary: string;
  private readonly _currentSituation: string;
  private readonly _knownGoals: string[];
  private readonly _knownConstraints: string[];
  private readonly _openTopics: string[];

  constructor(properties: SummaryContentProperties) {
    if (typeof properties.businessSummary !== "string") {
      throw new Error("Business Summary must be a string.");
    }
    if (typeof properties.relationshipSummary !== "string") {
      throw new Error("Relationship Summary must be a string.");
    }
    if (typeof properties.currentSituation !== "string") {
      throw new Error("Current Situation must be a string.");
    }
    if (!Array.isArray(properties.knownGoals)) {
      throw new Error("Known Goals must be an array of strings.");
    }
    if (!Array.isArray(properties.knownConstraints)) {
      throw new Error("Known Constraints must be an array of strings.");
    }
    if (!Array.isArray(properties.openTopics)) {
      throw new Error("Open Topics must be an array of strings.");
    }

    this._businessSummary = properties.businessSummary;
    this._relationshipSummary = properties.relationshipSummary;
    this._currentSituation = properties.currentSituation;

    // Copy and freeze arrays to ensure strict immutability
    this._knownGoals = [...properties.knownGoals];
    this._knownConstraints = [...properties.knownConstraints];
    this._openTopics = [...properties.openTopics];

    Object.freeze(this._knownGoals);
    Object.freeze(this._knownConstraints);
    Object.freeze(this._openTopics);
    Object.freeze(this);
  }

  get businessSummary(): string {
    return this._businessSummary;
  }

  get relationshipSummary(): string {
    return this._relationshipSummary;
  }

  get currentSituation(): string {
    return this._currentSituation;
  }

  get knownGoals(): string[] {
    return this._knownGoals;
  }

  get knownConstraints(): string[] {
    return this._knownConstraints;
  }

  get openTopics(): string[] {
    return this._openTopics;
  }

  public equals(other: SummaryContent): boolean {
    if (!other) {
      return false;
    }
    return (
      this._businessSummary === other.businessSummary &&
      this._relationshipSummary === other.relationshipSummary &&
      this._currentSituation === other.currentSituation &&
      this._knownGoals.length === other.knownGoals.length &&
      this._knownGoals.every((v, i) => v === other.knownGoals[i]) &&
      this._knownConstraints.length === other.knownConstraints.length &&
      this._knownConstraints.every((v, i) => v === other.knownConstraints[i]) &&
      this._openTopics.length === other.openTopics.length &&
      this._openTopics.every((v, i) => v === other.openTopics[i])
    );
  }
}

export class SummaryScope {
  private readonly _value: string;

  constructor(value: string) {
    if (!value || value.trim() === "") {
      throw new Error("Scope value is required.");
    }
    this._value = value.trim();
    Object.freeze(this);
  }

  get value(): string {
    return this._value;
  }

  public equals(other: SummaryScope): boolean {
    if (!other) {
      return false;
    }
    return this._value.toLowerCase() === other.value.toLowerCase();
  }
}

export interface SummaryMetadataProperties {
  displayName: string;
  description: string;
  purpose: string;
  scope: SummaryScope;
}

export class SummaryMetadata {
  private readonly _displayName: string;
  private readonly _description: string;
  private readonly _purpose: string;
  private readonly _scope: SummaryScope;

  constructor(properties: SummaryMetadataProperties) {
    if (!properties.displayName || properties.displayName.trim() === "") {
      throw new Error("Display Name is required.");
    }
    if (!properties.description || properties.description.trim() === "") {
      throw new Error("Description is required.");
    }
    if (!properties.purpose || properties.purpose.trim() === "") {
      throw new Error("Purpose is required.");
    }
    if (!properties.scope) {
      throw new Error("Summary Scope is required.");
    }

    this._displayName = properties.displayName.trim();
    this._description = properties.description.trim();
    this._purpose = properties.purpose.trim();
    this._scope = properties.scope;
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

  get scope(): SummaryScope {
    return this._scope;
  }

  public equals(other: SummaryMetadata): boolean {
    if (!other) {
      return false;
    }
    return (
      this._displayName === other.displayName &&
      this._description === other.description &&
      this._purpose === other.purpose &&
      this._scope.equals(other.scope)
    );
  }
}

export class SummaryClassification {
  private readonly _value: string;

  constructor(value: string) {
    if (!value || value.trim() === "") {
      throw new Error("Classification value is required.");
    }
    this._value = value.trim();
    Object.freeze(this);
  }

  get value(): string {
    return this._value;
  }

  public equals(other: SummaryClassification): boolean {
    if (!other) {
      return false;
    }
    return this._value.toLowerCase() === other.value.toLowerCase();
  }
}

export class SummaryFingerprint {
  private readonly _value: string;

  constructor(value: string) {
    if (!value || value.trim() === "") {
      throw new Error("Fingerprint value is required.");
    }
    const cleanValue = value.trim();
    // Validate: No hashes allowed (such as 32-128 hex chars)
    if (/^[a-f0-9]{32,128}$/i.test(cleanValue)) {
      throw new Error("Fingerprint cannot be a hash.");
    }
    // Validate: No provider identifiers allowed
    const providers = [
      "openai",
      "anthropic",
      "gemini",
      "ollama",
      "cohere",
      "google",
      "aws",
      "azure",
    ];
    if (providers.some((p) => cleanValue.toLowerCase().includes(p))) {
      throw new Error("Fingerprint cannot contain provider identifiers.");
    }
    this._value = cleanValue;
    Object.freeze(this);
  }

  get value(): string {
    return this._value;
  }

  public equals(other: SummaryFingerprint): boolean {
    if (!other) {
      return false;
    }
    return this._value === other.value;
  }
}

export class SummaryReference {
  private readonly _value: string;

  constructor(value: string) {
    if (!value || value.trim() === "") {
      throw new Error("Summary reference value is required.");
    }
    const cleanValue = value.trim();
    // Lowercase dot/hyphen-separated alphanumeric reference pattern
    const referencePattern = /^[a-z0-9]+([.-][a-z0-9]+)*$/;
    if (!referencePattern.test(cleanValue)) {
      throw new Error(
        "Invalid summary reference format. Must be lower-case dot/hyphen-separated key.",
      );
    }
    this._value = cleanValue;
    Object.freeze(this);
  }

  get value(): string {
    return this._value;
  }

  public equals(other: SummaryReference): boolean {
    if (!other) {
      return false;
    }
    return this._value === other.value;
  }
}

export interface SummarySnapshotProperties {
  version: number;
  createdAt: Date;
  content: SummaryContent;
  metadata: SummaryMetadata;
  classification: SummaryClassification;
  scope: SummaryScope;
  fingerprint: SummaryFingerprint;
  lifecycle: SummaryLifecycle;
}

export class SummarySnapshot {
  private readonly _version: number;
  private readonly _createdAt: Date;
  private readonly _content: SummaryContent;
  private readonly _metadata: SummaryMetadata;
  private readonly _classification: SummaryClassification;
  private readonly _scope: SummaryScope;
  private readonly _fingerprint: SummaryFingerprint;
  private readonly _lifecycle: SummaryLifecycle;

  constructor(properties: SummarySnapshotProperties) {
    if (properties.version <= 0) {
      throw new Error("Snapshot version must be greater than zero.");
    }
    if (!properties.createdAt) {
      throw new Error("Snapshot creation date is required.");
    }
    if (!properties.content) {
      throw new Error("Snapshot content is required.");
    }
    if (!properties.metadata) {
      throw new Error("Snapshot metadata is required.");
    }
    if (!properties.classification) {
      throw new Error("Snapshot classification is required.");
    }
    if (!properties.scope) {
      throw new Error("Snapshot scope is required.");
    }
    if (!properties.fingerprint) {
      throw new Error("Snapshot fingerprint is required.");
    }
    if (!properties.lifecycle) {
      throw new Error("Snapshot lifecycle is required.");
    }

    this._version = properties.version;
    this._createdAt = new Date(properties.createdAt.getTime());
    this._content = properties.content;
    this._metadata = properties.metadata;
    this._classification = properties.classification;
    this._scope = properties.scope;
    this._fingerprint = properties.fingerprint;
    this._lifecycle = properties.lifecycle;
    Object.freeze(this);
  }

  get version(): number {
    return this._version;
  }

  get createdAt(): Date {
    return new Date(this._createdAt.getTime());
  }

  get content(): SummaryContent {
    return this._content;
  }

  get metadata(): SummaryMetadata {
    return this._metadata;
  }

  get classification(): SummaryClassification {
    return this._classification;
  }

  get scope(): SummaryScope {
    return this._scope;
  }

  get fingerprint(): SummaryFingerprint {
    return this._fingerprint;
  }

  get lifecycle(): SummaryLifecycle {
    return this._lifecycle;
  }
}

// 3. Domain Events
export const CLIENT_SUMMARY_REGISTERED = "CLIENT_SUMMARY_REGISTERED";
export const CLIENT_SUMMARY_GENERATED = "CLIENT_SUMMARY_GENERATED";
export const CLIENT_SUMMARY_VALIDATED = "CLIENT_SUMMARY_VALIDATED";
export const CLIENT_SUMMARY_PUBLISHED = "CLIENT_SUMMARY_PUBLISHED";
export const CLIENT_SUMMARY_ARCHIVED = "CLIENT_SUMMARY_ARCHIVED";

export type ClientSummaryDomainEventName =
  | typeof CLIENT_SUMMARY_REGISTERED
  | typeof CLIENT_SUMMARY_GENERATED
  | typeof CLIENT_SUMMARY_VALIDATED
  | typeof CLIENT_SUMMARY_PUBLISHED
  | typeof CLIENT_SUMMARY_ARCHIVED;

export interface ClientSummaryRegisteredEvent {
  readonly eventType: typeof CLIENT_SUMMARY_REGISTERED;
  readonly summaryId: string;
  readonly reference: string;
  readonly clientId: string;
  readonly ownerId: string;
}

export interface ClientSummaryGeneratedEvent {
  readonly eventType: typeof CLIENT_SUMMARY_GENERATED;
  readonly summaryId: string;
  readonly reference: string;
  readonly clientId: string;
  readonly ownerId: string;
}

export interface ClientSummaryValidatedEvent {
  readonly eventType: typeof CLIENT_SUMMARY_VALIDATED;
  readonly summaryId: string;
  readonly reference: string;
  readonly clientId: string;
  readonly ownerId: string;
}

export interface ClientSummaryPublishedEvent {
  readonly eventType: typeof CLIENT_SUMMARY_PUBLISHED;
  readonly summaryId: string;
  readonly reference: string;
  readonly clientId: string;
  readonly ownerId: string;
}

export interface ClientSummaryArchivedEvent {
  readonly eventType: typeof CLIENT_SUMMARY_ARCHIVED;
  readonly summaryId: string;
  readonly reference: string;
  readonly clientId: string;
  readonly ownerId: string;
}

export type ClientSummaryDomainEvent =
  | ClientSummaryRegisteredEvent
  | ClientSummaryGeneratedEvent
  | ClientSummaryValidatedEvent
  | ClientSummaryPublishedEvent
  | ClientSummaryArchivedEvent;

export interface ClientSummaryEventPublisher {
  publish(event: ClientSummaryDomainEvent): Promise<void>;
}

// 4. Persistence & Query side Projection contracts
export interface ClientSummaryQueryProjection {
  readonly id: string;
  readonly reference: string;
  readonly clientId: string;
  readonly ownerId: string;
  readonly displayName: string;
  readonly lifecycle: SummaryLifecycle;
  readonly versionCount: number;
  readonly updatedAt: Date;
}

export interface ClientSummaryPersistenceContract {
  checkUniqueReference(
    ownerId: string,
    reference: string,
    excludeSummaryId?: string,
  ): Promise<boolean>;
}

export interface ClientSummaryAggregateStore {
  save(summary: ClientSummary): Promise<void>;
  findById(id: string, ownerId: string): Promise<ClientSummary | null>;
  findByReference(reference: string, ownerId: string): Promise<ClientSummary | null>;
}

// 5. Aggregate Root Properties
export interface ClientSummaryProperties {
  id: string;
  reference: SummaryReference;
  clientId: string;
  ownerId: string;
  content: SummaryContent;
  metadata: SummaryMetadata;
  classification: SummaryClassification;
  scope: SummaryScope;
  fingerprint: SummaryFingerprint;
  lifecycle: SummaryLifecycle;
  snapshots: SummarySnapshot[];
  createdAt: Date;
  updatedAt: Date;
}

// 6. ClientSummary Aggregate Root
export class ClientSummary {
  private readonly _id: string;
  private readonly _reference: SummaryReference;
  private readonly _clientId: string;
  private readonly _ownerId: string;
  private _content: SummaryContent;
  private _metadata: SummaryMetadata;
  private _classification: SummaryClassification;
  private _scope: SummaryScope;
  private _fingerprint: SummaryFingerprint;
  private _lifecycle: SummaryLifecycle;
  private readonly _snapshots: SummarySnapshot[] = [];
  private readonly _createdAt: Date;
  private _updatedAt: Date;
  private _domainEvents: ClientSummaryDomainEvent[] = [];

  constructor(properties: ClientSummaryProperties) {
    this._id = properties.id;
    this._reference = properties.reference;
    this._clientId = properties.clientId;
    this._ownerId = properties.ownerId;
    this._content = properties.content;
    this._metadata = properties.metadata;
    this._classification = properties.classification;
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

  get reference(): SummaryReference {
    return this._reference;
  }

  get clientId(): string {
    return this._clientId;
  }

  get ownerId(): string {
    return this._ownerId;
  }

  get content(): SummaryContent {
    return this._content;
  }

  get metadata(): SummaryMetadata {
    return this._metadata;
  }

  get classification(): SummaryClassification {
    return this._classification;
  }

  get scope(): SummaryScope {
    return this._scope;
  }

  get fingerprint(): SummaryFingerprint {
    return this._fingerprint;
  }

  get lifecycle(): SummaryLifecycle {
    return this._lifecycle;
  }

  get snapshots(): ReadonlyArray<SummarySnapshot> {
    return Object.freeze([...this._snapshots]);
  }

  get createdAt(): Date {
    return new Date(this._createdAt.getTime());
  }

  get updatedAt(): Date {
    return new Date(this._updatedAt.getTime());
  }

  get domainEvents(): ReadonlyArray<ClientSummaryDomainEvent> {
    return this._domainEvents;
  }

  public clearDomainEvents(): void {
    this._domainEvents = [];
  }

  private addDomainEvent(event: ClientSummaryDomainEvent): void {
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
      throw new Error("Summary Identity is required.");
    }
    if (!this._clientId || this._clientId.trim() === "") {
      throw new Error("Client Reference is required.");
    }
    if (!this._ownerId || this._ownerId.trim() === "") {
      throw new Error("Owner Reference is required.");
    }
    if (!this._reference) {
      throw new Error("Summary Reference is required.");
    }
    if (!this._content) {
      throw new Error("Summary Content is required.");
    }
    if (!this._metadata) {
      throw new Error("Summary Metadata is required.");
    }
    if (!this._classification) {
      throw new Error("Summary Classification is required.");
    }
    if (!this._scope) {
      throw new Error("Summary Scope is required.");
    }
    if (!this._fingerprint) {
      throw new Error("Summary Fingerprint is required.");
    }
    if (!this._lifecycle) {
      throw new Error("Summary Lifecycle is required.");
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
    const newSnapshot = new SummarySnapshot({
      version: nextVersion,
      createdAt: new Date(),
      content: this._content,
      metadata: this._metadata,
      classification: this._classification,
      scope: this._scope,
      fingerprint: this._fingerprint,
      lifecycle: this._lifecycle,
    });
    this._snapshots.push(newSnapshot);
  }

  // Domain Factory
  public static create(
    id: string,
    reference: SummaryReference,
    clientId: string,
    ownerId: string,
    content: SummaryContent,
    metadata: SummaryMetadata,
    classification: SummaryClassification,
    scope: SummaryScope,
    fingerprint: SummaryFingerprint,
  ): ClientSummary {
    const now = new Date();
    const summary = new ClientSummary({
      id,
      reference,
      clientId,
      ownerId,
      content,
      metadata,
      classification,
      scope,
      fingerprint,
      lifecycle: "Draft",
      snapshots: [],
      createdAt: now,
      updatedAt: now,
    });

    summary.appendSnapshot();

    summary.addDomainEvent({
      eventType: CLIENT_SUMMARY_REGISTERED,
      summaryId: id,
      reference: reference.value,
      clientId,
      ownerId,
    });

    return summary;
  }

  // Domain Operations
  public transitionTo(newLifecycle: SummaryLifecycle, actorOwnerId: string): void {
    this.verifyOwnership(actorOwnerId);
    if (this._lifecycle === newLifecycle) {
      return;
    }

    let allowed = false;
    switch (this._lifecycle) {
      case "Draft":
        allowed = newLifecycle === "Generated" || newLifecycle === "Archived";
        break;
      case "Generated":
        allowed = newLifecycle === "Validated" || newLifecycle === "Archived";
        break;
      case "Validated":
        allowed = newLifecycle === "Published" || newLifecycle === "Archived";
        break;
      case "Published":
        allowed = newLifecycle === "Archived";
        break;
      case "Archived":
        allowed = false;
        break;
    }

    if (!allowed) {
      throw new Error(`Invalid lifecycle transition from ${this._lifecycle} to ${newLifecycle}.`);
    }

    this._lifecycle = newLifecycle;
    this._updatedAt = new Date();

    this.appendSnapshot();

    if (newLifecycle === "Generated") {
      this.addDomainEvent({
        eventType: CLIENT_SUMMARY_GENERATED,
        summaryId: this._id,
        reference: this._reference.value,
        clientId: this._clientId,
        ownerId: this._ownerId,
      });
    } else if (newLifecycle === "Validated") {
      this.addDomainEvent({
        eventType: CLIENT_SUMMARY_VALIDATED,
        summaryId: this._id,
        reference: this._reference.value,
        clientId: this._clientId,
        ownerId: this._ownerId,
      });
    } else if (newLifecycle === "Published") {
      this.addDomainEvent({
        eventType: CLIENT_SUMMARY_PUBLISHED,
        summaryId: this._id,
        reference: this._reference.value,
        clientId: this._clientId,
        ownerId: this._ownerId,
      });
    } else if (newLifecycle === "Archived") {
      this.addDomainEvent({
        eventType: CLIENT_SUMMARY_ARCHIVED,
        summaryId: this._id,
        reference: this._reference.value,
        clientId: this._clientId,
        ownerId: this._ownerId,
      });
    }
  }

  public update(
    actorOwnerId: string,
    content: SummaryContent,
    metadata: SummaryMetadata,
    classification: SummaryClassification,
    scope: SummaryScope,
    fingerprint: SummaryFingerprint,
  ): void {
    this.verifyOwnership(actorOwnerId);
    if (this._lifecycle === "Published") {
      throw new Error("Cannot update summary content in Published state.");
    }
    if (this._lifecycle === "Archived") {
      throw new Error("Cannot update summary content in Archived state.");
    }

    this._content = content;
    this._metadata = metadata;
    this._classification = classification;
    this._scope = scope;
    this._fingerprint = fingerprint;
    this._updatedAt = new Date();

    this.appendSnapshot();
  }
}
