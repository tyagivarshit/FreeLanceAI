// 1. Lifecycle State
export type EmbeddingLifecycleState =
  | "Draft"
  | "Generated"
  | "Validated"
  | "Published"
  | "Archived";

// 2. Value Objects

/**
 * Encapsulates validation and representation of the dots-separated, lower-case Embedding Reference.
 */
export class EmbeddingReference {
  private readonly _value: string;

  constructor(value: string) {
    if (!value || value.trim() === "") {
      throw new Error("Embedding Reference is required.");
    }
    const referencePattern = /^[a-z0-9]+(\.[a-z0-9]+)*$/;
    if (!referencePattern.test(value)) {
      throw new Error("Invalid embedding reference format. Must be lower-case dot-separated key.");
    }
    this._value = value.trim();
  }

  get value(): string {
    return this._value;
  }

  public equals(other: EmbeddingReference): boolean {
    return this._value === other.value;
  }
}

/**
 * Represents an immutable classification tagging system.
 */
export interface EmbeddingClassificationProperties {
  classificationTag: string;
}

export class EmbeddingClassification {
  private readonly _classificationTag: string;

  constructor(properties: EmbeddingClassificationProperties) {
    if (!properties.classificationTag || properties.classificationTag.trim() === "") {
      throw new Error("Classification tag is required.");
    }
    this._classificationTag = properties.classificationTag.trim();
  }

  get classificationTag(): string {
    return this._classificationTag;
  }

  public equals(other: EmbeddingClassification): boolean {
    return this._classificationTag === other.classificationTag;
  }
}

export interface RepresentationFingerprintProperties {
  fingerprintIdentifier: string;
  fingerprintStrategyReference: string;
}

export class RepresentationFingerprint {
  private readonly _fingerprintIdentifier: string;
  private readonly _fingerprintStrategyReference: string;

  constructor(properties: RepresentationFingerprintProperties) {
    if (!properties.fingerprintIdentifier || properties.fingerprintIdentifier.trim() === "") {
      throw new Error("Fingerprint identifier is required.");
    }
    if (
      !properties.fingerprintStrategyReference ||
      properties.fingerprintStrategyReference.trim() === ""
    ) {
      throw new Error("Fingerprint strategy reference is required.");
    }

    this._fingerprintIdentifier = properties.fingerprintIdentifier.trim();
    this._fingerprintStrategyReference = properties.fingerprintStrategyReference.trim();
  }

  get fingerprintIdentifier(): string {
    return this._fingerprintIdentifier;
  }

  get fingerprintStrategyReference(): string {
    return this._fingerprintStrategyReference;
  }

  public equals(other: RepresentationFingerprint): boolean {
    return (
      this._fingerprintIdentifier === other.fingerprintIdentifier &&
      this._fingerprintStrategyReference === other.fingerprintStrategyReference
    );
  }
}

export interface EmbeddingMetadataProperties {
  displayName: string;
  description: string;
  purpose: string;
  classificationSummary: string;
}

export class EmbeddingMetadata {
  private readonly _displayName: string;
  private readonly _description: string;
  private readonly _purpose: string;
  private readonly _classificationSummary: string;

  constructor(properties: EmbeddingMetadataProperties) {
    if (!properties.displayName || properties.displayName.trim() === "") {
      throw new Error("Display Name is required.");
    }
    if (!properties.description || properties.description.trim() === "") {
      throw new Error("Description is required.");
    }
    if (!properties.purpose || properties.purpose.trim() === "") {
      throw new Error("Purpose is required.");
    }
    if (!properties.classificationSummary || properties.classificationSummary.trim() === "") {
      throw new Error("Classification summary is required.");
    }

    this._displayName = properties.displayName.trim();
    this._description = properties.description.trim();
    this._purpose = properties.purpose.trim();
    this._classificationSummary = properties.classificationSummary.trim();
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

  get classificationSummary(): string {
    return this._classificationSummary;
  }

  public equals(other: EmbeddingMetadata): boolean {
    return (
      this._displayName === other.displayName &&
      this._description === other.description &&
      this._purpose === other.purpose &&
      this._classificationSummary === other.classificationSummary
    );
  }
}

export interface EmbeddingGenerationPolicyProperties {
  generationStrategyReference: string;
  compatibilityClassification: string;
  logicalRefreshClassification: string;
}

export class EmbeddingGenerationPolicy {
  private readonly _generationStrategyReference: string;
  private readonly _compatibilityClassification: string;
  private readonly _logicalRefreshClassification: string;

  constructor(properties: EmbeddingGenerationPolicyProperties) {
    if (
      !properties.generationStrategyReference ||
      properties.generationStrategyReference.trim() === ""
    ) {
      throw new Error("Generation strategy reference is required.");
    }
    if (
      !properties.compatibilityClassification ||
      properties.compatibilityClassification.trim() === ""
    ) {
      throw new Error("Compatibility classification is required.");
    }
    if (
      !properties.logicalRefreshClassification ||
      properties.logicalRefreshClassification.trim() === ""
    ) {
      throw new Error("Logical refresh classification is required.");
    }

    this._generationStrategyReference = properties.generationStrategyReference.trim();
    this._compatibilityClassification = properties.compatibilityClassification.trim();
    this._logicalRefreshClassification = properties.logicalRefreshClassification.trim();
  }

  get generationStrategyReference(): string {
    return this._generationStrategyReference;
  }

  get compatibilityClassification(): string {
    return this._compatibilityClassification;
  }

  get logicalRefreshClassification(): string {
    return this._logicalRefreshClassification;
  }

  public equals(other: EmbeddingGenerationPolicy): boolean {
    return (
      this._generationStrategyReference === other.generationStrategyReference &&
      this._compatibilityClassification === other.compatibilityClassification &&
      this._logicalRefreshClassification === other.logicalRefreshClassification
    );
  }
}

export interface EmbeddingSnapshotProperties {
  snapshotId: string;
  representationFingerprint: RepresentationFingerprint;
  metadataSnapshot: EmbeddingMetadata;
  generationPolicySnapshot: EmbeddingGenerationPolicy;
  classificationSnapshot: EmbeddingClassification;
  lifecycleStateSnapshot: EmbeddingLifecycleState;
  capturedAt: Date;
}

export class EmbeddingSnapshot {
  private readonly _snapshotId: string;
  private readonly _representationFingerprint: RepresentationFingerprint;
  private readonly _metadataSnapshot: EmbeddingMetadata;
  private readonly _generationPolicySnapshot: EmbeddingGenerationPolicy;
  private readonly _classificationSnapshot: EmbeddingClassification;
  private readonly _lifecycleStateSnapshot: EmbeddingLifecycleState;
  private readonly _capturedAt: Date;

  constructor(properties: EmbeddingSnapshotProperties) {
    if (!properties.snapshotId || properties.snapshotId.trim() === "") {
      throw new Error("Snapshot ID is required.");
    }
    if (!properties.representationFingerprint) {
      throw new Error("Representation fingerprint snapshot is required.");
    }
    if (!properties.metadataSnapshot) {
      throw new Error("Metadata snapshot is required.");
    }
    if (!properties.generationPolicySnapshot) {
      throw new Error("Generation policy snapshot is required.");
    }
    if (!properties.classificationSnapshot) {
      throw new Error("Classification snapshot is required.");
    }
    if (!properties.lifecycleStateSnapshot) {
      throw new Error("Lifecycle state snapshot is required.");
    }
    if (!properties.capturedAt) {
      throw new Error("Captured date is required.");
    }

    this._snapshotId = properties.snapshotId.trim();
    this._representationFingerprint = properties.representationFingerprint;
    this._metadataSnapshot = properties.metadataSnapshot;
    this._generationPolicySnapshot = properties.generationPolicySnapshot;
    this._classificationSnapshot = properties.classificationSnapshot;
    this._lifecycleStateSnapshot = properties.lifecycleStateSnapshot;
    this._capturedAt = properties.capturedAt;
  }

  get snapshotId(): string {
    return this._snapshotId;
  }

  get representationFingerprint(): RepresentationFingerprint {
    return this._representationFingerprint;
  }

  get metadataSnapshot(): EmbeddingMetadata {
    return this._metadataSnapshot;
  }

  get generationPolicySnapshot(): EmbeddingGenerationPolicy {
    return this._generationPolicySnapshot;
  }

  get classificationSnapshot(): EmbeddingClassification {
    return this._classificationSnapshot;
  }

  get lifecycleStateSnapshot(): EmbeddingLifecycleState {
    return this._lifecycleStateSnapshot;
  }

  get capturedAt(): Date {
    return this._capturedAt;
  }
}

// 3. Domain Events
export const EMBEDDING_REGISTERED = "EMBEDDING_REGISTERED";
export const EMBEDDING_GENERATED = "EMBEDDING_GENERATED";
export const EMBEDDING_VALIDATED = "EMBEDDING_VALIDATED";
export const EMBEDDING_PUBLISHED = "EMBEDDING_PUBLISHED";
export const EMBEDDING_ARCHIVED = "EMBEDDING_ARCHIVED";

export type EmbeddingDomainEventName =
  | typeof EMBEDDING_REGISTERED
  | typeof EMBEDDING_GENERATED
  | typeof EMBEDDING_VALIDATED
  | typeof EMBEDDING_PUBLISHED
  | typeof EMBEDDING_ARCHIVED;

export interface EmbeddingRegisteredEvent {
  readonly eventType: typeof EMBEDDING_REGISTERED;
  readonly embeddingId: string;
  readonly reference: string;
  readonly snapshotId: string;
  readonly ownerId: string;
}

export interface EmbeddingGeneratedEvent {
  readonly eventType: typeof EMBEDDING_GENERATED;
  readonly embeddingId: string;
  readonly reference: string;
  readonly snapshotId: string;
  readonly ownerId: string;
}

export interface EmbeddingValidatedEvent {
  readonly eventType: typeof EMBEDDING_VALIDATED;
  readonly embeddingId: string;
  readonly reference: string;
  readonly snapshotId: string;
  readonly ownerId: string;
}

export interface EmbeddingPublishedEvent {
  readonly eventType: typeof EMBEDDING_PUBLISHED;
  readonly embeddingId: string;
  readonly reference: string;
  readonly snapshotId: string;
  readonly ownerId: string;
}

export interface EmbeddingArchivedEvent {
  readonly eventType: typeof EMBEDDING_ARCHIVED;
  readonly embeddingId: string;
  readonly reference: string;
  readonly snapshotId: string;
  readonly ownerId: string;
}

export type EmbeddingDomainEvent =
  | EmbeddingRegisteredEvent
  | EmbeddingGeneratedEvent
  | EmbeddingValidatedEvent
  | EmbeddingPublishedEvent
  | EmbeddingArchivedEvent;

export interface EmbeddingEventPublisher {
  publish(event: EmbeddingDomainEvent): Promise<void>;
}

// 4. Query-Side Projection
export interface EmbeddingQueryProjection {
  readonly id: string;
  readonly reference: string;
  readonly ownerId: string;
  readonly displayName: string;
  readonly status: EmbeddingLifecycleState;
  readonly updatedAt: Date;
}

// 5. Persistence Interfaces
export interface EmbeddingPersistenceContract {
  checkUniqueReference(
    ownerId: string,
    reference: string,
    excludeEmbeddingId?: string,
  ): Promise<boolean>;
}

export interface EmbeddingAggregateStore {
  save(embedding: Embedding): Promise<void>;
  findById(id: string, ownerId: string): Promise<Embedding | null>;
  findByReference(reference: string, ownerId: string): Promise<Embedding | null>;
}

// 6. Embedding Properties
export interface EmbeddingProperties {
  id: string;
  reference: EmbeddingReference;
  ownerId: string;
  metadata: EmbeddingMetadata;
  generationPolicy: EmbeddingGenerationPolicy;
  classification: EmbeddingClassification;
  snapshots: EmbeddingSnapshot[];
  status: EmbeddingLifecycleState;
  createdAt: Date;
  updatedAt: Date;
}

// 7. Embedding Aggregate Root
export class Embedding {
  private readonly _id: string;
  private readonly _reference: EmbeddingReference;
  private readonly _ownerId: string;
  private _metadata: EmbeddingMetadata;
  private readonly _generationPolicy: EmbeddingGenerationPolicy;
  private readonly _classification: EmbeddingClassification;
  private _snapshots: EmbeddingSnapshot[] = [];
  private _status: EmbeddingLifecycleState;
  private readonly _createdAt: Date;
  private _updatedAt: Date;
  private _domainEvents: EmbeddingDomainEvent[] = [];

  constructor(properties: EmbeddingProperties) {
    if (!properties.id || properties.id.trim() === "") {
      throw new Error("Embedding Identity is required.");
    }
    if (!properties.reference) {
      throw new Error("Embedding Reference is required.");
    }
    if (!properties.ownerId || properties.ownerId.trim() === "") {
      throw new Error("Owner Reference is required.");
    }
    if (!properties.metadata) {
      throw new Error("Embedding Metadata is required.");
    }
    if (!properties.generationPolicy) {
      throw new Error("Embedding Generation Policy is required.");
    }
    if (!properties.classification) {
      throw new Error("Embedding Classification is required.");
    }
    if (!properties.snapshots || properties.snapshots.length === 0) {
      throw new Error("Embedding Snapshots collection must not be empty.");
    }
    if (!properties.status) {
      throw new Error("Embedding Lifecycle State is required.");
    }

    this._id = properties.id;
    this._reference = properties.reference;
    this._ownerId = properties.ownerId;
    this._metadata = properties.metadata;
    this._generationPolicy = properties.generationPolicy;
    this._classification = properties.classification;
    this._status = properties.status;
    this._createdAt = properties.createdAt;
    this._updatedAt = properties.updatedAt;

    this._snapshots = [...properties.snapshots];
  }

  // Getters
  get id(): string {
    return this._id;
  }

  get reference(): string {
    return this._reference.value;
  }

  get ownerId(): string {
    return this._ownerId;
  }

  get metadata(): EmbeddingMetadata {
    return this._metadata;
  }

  get generationPolicy(): EmbeddingGenerationPolicy {
    return this._generationPolicy;
  }

  get classification(): EmbeddingClassification {
    return this._classification;
  }

  get snapshots(): ReadonlyArray<EmbeddingSnapshot> {
    return Object.freeze([...this._snapshots]);
  }

  get status(): EmbeddingLifecycleState {
    return this._status;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }

  get domainEvents(): ReadonlyArray<EmbeddingDomainEvent> {
    return this._domainEvents;
  }

  /**
   * Dedicated helper abstraction to retrieve the latest snapshot from history.
   */
  get latestSnapshot(): EmbeddingSnapshot {
    if (this._snapshots.length === 0) {
      throw new Error("Invalid aggregate state: snapshots history is empty.");
    }
    return this._snapshots[this._snapshots.length - 1]!;
  }

  public clearDomainEvents(): void {
    this._domainEvents = [];
  }

  private addDomainEvent(event: EmbeddingDomainEvent): void {
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

  // Domain Factory
  public static create(
    id: string,
    referenceValue: string,
    ownerId: string,
    metadata: EmbeddingMetadata,
    generationPolicy: EmbeddingGenerationPolicy,
    classification: EmbeddingClassification,
    initialSnapshotId: string,
    initialFingerprint: RepresentationFingerprint,
  ): Embedding {
    const reference = new EmbeddingReference(referenceValue);
    const now = new Date();
    const initialSnapshot = new EmbeddingSnapshot({
      snapshotId: initialSnapshotId,
      representationFingerprint: initialFingerprint,
      metadataSnapshot: metadata,
      generationPolicySnapshot: generationPolicy,
      classificationSnapshot: classification,
      lifecycleStateSnapshot: "Draft",
      capturedAt: now,
    });

    const embedding = new Embedding({
      id,
      reference,
      ownerId,
      metadata,
      generationPolicy,
      classification,
      snapshots: [initialSnapshot],
      status: "Draft",
      createdAt: now,
      updatedAt: now,
    });

    embedding.addDomainEvent({
      eventType: EMBEDDING_REGISTERED,
      embeddingId: embedding.id,
      reference: embedding.reference,
      snapshotId: initialSnapshotId,
      ownerId: embedding.ownerId,
    });

    return embedding;
  }

  // Domain Operations
  /**
   * Replaces the metadata of the aggregate.
   *
   * Mutation Rules:
   * - Must verify caller ownership.
   * - Operation is restricted strictly to the "Draft" lifecycle state.
   */
  public replaceMetadata(actorOwnerId: string, metadata: EmbeddingMetadata): void {
    this.verifyOwnership(actorOwnerId);
    if (this._status !== "Draft") {
      throw new Error(`Cannot replace metadata when in status: ${this._status}`);
    }
    this._metadata = metadata;
    this._updatedAt = new Date();
  }

  /**
   * Generates a new snapshot representational fingerprint.
   *
   * Mutation Rules:
   * - Must verify caller ownership.
   * - Operation is restricted strictly to the "Draft" or "Generated" lifecycle states.
   */
  public generateRepresentation(
    actorOwnerId: string,
    newSnapshotId: string,
    newFingerprint: RepresentationFingerprint,
  ): void {
    this.verifyOwnership(actorOwnerId);
    if (this._status !== "Draft" && this._status !== "Generated") {
      throw new Error(`Cannot generate representation when in status: ${this._status}`);
    }

    this._status = "Generated";
    this._updatedAt = new Date();

    const newSnapshot = new EmbeddingSnapshot({
      snapshotId: newSnapshotId,
      representationFingerprint: newFingerprint,
      metadataSnapshot: this._metadata,
      generationPolicySnapshot: this._generationPolicy,
      classificationSnapshot: this._classification,
      lifecycleStateSnapshot: "Generated",
      capturedAt: new Date(),
    });

    this._snapshots.push(newSnapshot);

    this.addDomainEvent({
      eventType: EMBEDDING_GENERATED,
      embeddingId: this._id,
      reference: this._reference.value,
      snapshotId: newSnapshotId,
      ownerId: this._ownerId,
    });
  }

  public validate(actorOwnerId: string): void {
    this.verifyOwnership(actorOwnerId);
    if (this._status !== "Generated") {
      throw new Error(`Cannot validate embedding when in status: ${this._status}`);
    }

    this._status = "Validated";
    this._updatedAt = new Date();

    this.addDomainEvent({
      eventType: EMBEDDING_VALIDATED,
      embeddingId: this._id,
      reference: this._reference.value,
      snapshotId: this.latestSnapshot.snapshotId,
      ownerId: this._ownerId,
    });
  }

  public publish(actorOwnerId: string): void {
    this.verifyOwnership(actorOwnerId);
    if (this._status !== "Validated") {
      throw new Error(`Cannot publish embedding when in status: ${this._status}`);
    }

    this._status = "Published";
    this._updatedAt = new Date();

    this.addDomainEvent({
      eventType: EMBEDDING_PUBLISHED,
      embeddingId: this._id,
      reference: this._reference.value,
      snapshotId: this.latestSnapshot.snapshotId,
      ownerId: this._ownerId,
    });
  }

  public archive(actorOwnerId: string): void {
    this.verifyOwnership(actorOwnerId);
    if (this._status === "Archived") {
      throw new Error("Embedding is already archived.");
    }

    this._status = "Archived";
    this._updatedAt = new Date();

    this.addDomainEvent({
      eventType: EMBEDDING_ARCHIVED,
      embeddingId: this._id,
      reference: this._reference.value,
      snapshotId: this.latestSnapshot.snapshotId,
      ownerId: this._ownerId,
    });
  }
}
