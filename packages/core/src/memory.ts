// 1. Lifecycle State
export type MemoryLifecycleState = "Draft" | "Validated" | "Published" | "Archived";

// 2. Value Objects
export interface MemoryMetadataProperties {
  displayName: string;
  description: string;
  purpose: string;
  versionSummary: string;
}

export class MemoryMetadata {
  private readonly _displayName: string;
  private readonly _description: string;
  private readonly _purpose: string;
  private readonly _versionSummary: string;

  constructor(properties: MemoryMetadataProperties) {
    if (!properties.displayName || properties.displayName.trim() === "") {
      throw new Error("Display Name is required.");
    }
    if (!properties.description || properties.description.trim() === "") {
      throw new Error("Description is required.");
    }
    if (!properties.purpose || properties.purpose.trim() === "") {
      throw new Error("Purpose is required.");
    }
    if (!properties.versionSummary || properties.versionSummary.trim() === "") {
      throw new Error("Version Summary is required.");
    }

    this._displayName = properties.displayName.trim();
    this._description = properties.description.trim();
    this._purpose = properties.purpose.trim();
    this._versionSummary = properties.versionSummary.trim();
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

  get versionSummary(): string {
    return this._versionSummary;
  }

  public equals(other: MemoryMetadata): boolean {
    return (
      this._displayName === other.displayName &&
      this._description === other.description &&
      this._purpose === other.purpose &&
      this._versionSummary === other.versionSummary
    );
  }
}

export interface MemoryRetentionRuleProperties {
  policyName: string;
  retentionDays: number;
}

/**
 * Represents a rule defining retention configurations for the memory aggregate.
 *
 * Note: Retention parameters express a logical architectural duration policy
 * (specifying how long memory context remains logically relevant within the domain model),
 * rather than mapping directly to physical storage TTLs, database driver expirations,
 * or infrastructure-level cleanup tasks.
 */
export class MemoryRetentionRule {
  private readonly _policyName: string;
  private readonly _retentionDays: number;

  constructor(properties: MemoryRetentionRuleProperties) {
    if (!properties.policyName || properties.policyName.trim() === "") {
      throw new Error("Policy name is required.");
    }
    if (properties.retentionDays <= 0) {
      throw new Error("Retention days must be greater than zero.");
    }

    this._policyName = properties.policyName.trim();
    this._retentionDays = properties.retentionDays;
  }

  get policyName(): string {
    return this._policyName;
  }

  /**
   * The logical architectural retention duration in days.
   *
   * This is a logical domain model property defining the contextual validity lifespan,
   * not a physical database TTL or storage-level execution parameter.
   */
  get retentionDays(): number {
    return this._retentionDays;
  }

  public equals(other: MemoryRetentionRule): boolean {
    return this._policyName === other.policyName && this._retentionDays === other.retentionDays;
  }
}

export interface MemoryEntryProperties {
  content: string;
  classification: string;
}

export class MemoryEntry {
  private readonly _content: string;
  private readonly _classification: string;

  constructor(properties: MemoryEntryProperties) {
    if (!properties.content || properties.content.trim() === "") {
      throw new Error("Memory entry content is required.");
    }
    if (!properties.classification || properties.classification.trim() === "") {
      throw new Error("Memory entry classification is required.");
    }

    this._content = properties.content.trim();
    this._classification = properties.classification.trim();
  }

  get content(): string {
    return this._content;
  }

  get classification(): string {
    return this._classification;
  }

  public equals(other: MemoryEntry): boolean {
    return this._content === other.content && this._classification === other.classification;
  }
}

export interface MemorySnapshotProperties {
  snapshotId: string;
  entry: MemoryEntry;
  metadataSnapshot: MemoryMetadata;
  retentionRulesSnapshot: MemoryRetentionRule[];
  capturedAt: Date;
}

export class MemorySnapshot {
  private readonly _snapshotId: string;
  private readonly _entry: MemoryEntry;
  private readonly _metadataSnapshot: MemoryMetadata;
  private readonly _retentionRulesSnapshot: MemoryRetentionRule[];
  private readonly _capturedAt: Date;

  constructor(properties: MemorySnapshotProperties) {
    if (!properties.snapshotId || properties.snapshotId.trim() === "") {
      throw new Error("Snapshot ID is required.");
    }
    if (!properties.entry) {
      throw new Error("Memory entry snapshot is required.");
    }
    if (!properties.metadataSnapshot) {
      throw new Error("Metadata snapshot is required.");
    }
    if (!properties.retentionRulesSnapshot) {
      throw new Error("Retention rules snapshot is required.");
    }
    if (!properties.capturedAt) {
      throw new Error("Capture date is required.");
    }

    this._snapshotId = properties.snapshotId.trim();
    this._entry = properties.entry;
    this._metadataSnapshot = properties.metadataSnapshot;
    this._retentionRulesSnapshot = [...properties.retentionRulesSnapshot];
    this._capturedAt = properties.capturedAt;
  }

  get snapshotId(): string {
    return this._snapshotId;
  }

  get entry(): MemoryEntry {
    return this._entry;
  }

  get metadataSnapshot(): MemoryMetadata {
    return this._metadataSnapshot;
  }

  get retentionRulesSnapshot(): ReadonlyArray<MemoryRetentionRule> {
    return Object.freeze([...this._retentionRulesSnapshot]);
  }

  get capturedAt(): Date {
    return this._capturedAt;
  }
}

// 3. Domain Events
export const MEMORY_REGISTERED = "MEMORY_REGISTERED";
export const MEMORY_VALIDATED = "MEMORY_VALIDATED";
export const MEMORY_PUBLISHED = "MEMORY_PUBLISHED";
export const MEMORY_ARCHIVED = "MEMORY_ARCHIVED";

export type MemoryDomainEventName =
  | typeof MEMORY_REGISTERED
  | typeof MEMORY_VALIDATED
  | typeof MEMORY_PUBLISHED
  | typeof MEMORY_ARCHIVED;

export interface MemoryRegisteredEvent {
  readonly eventType: typeof MEMORY_REGISTERED;
  readonly memoryId: string;
  readonly reference: string;
  readonly snapshotId: string;
  readonly ownerId: string;
}

export interface MemoryValidatedEvent {
  readonly eventType: typeof MEMORY_VALIDATED;
  readonly memoryId: string;
  readonly reference: string;
  readonly snapshotId: string;
  readonly ownerId: string;
}

export interface MemoryPublishedEvent {
  readonly eventType: typeof MEMORY_PUBLISHED;
  readonly memoryId: string;
  readonly reference: string;
  readonly snapshotId: string;
  readonly ownerId: string;
}

export interface MemoryArchivedEvent {
  readonly eventType: typeof MEMORY_ARCHIVED;
  readonly memoryId: string;
  readonly reference: string;
  readonly snapshotId: string;
  readonly ownerId: string;
}

export type MemoryDomainEvent =
  | MemoryRegisteredEvent
  | MemoryValidatedEvent
  | MemoryPublishedEvent
  | MemoryArchivedEvent;

export interface MemoryEventPublisher {
  publish(event: MemoryDomainEvent): Promise<void>;
}

// 4. Query Projection Contract
export interface MemoryQueryProjection {
  readonly id: string;
  readonly reference: string;
  readonly ownerId: string;
  readonly displayName: string;
  readonly status: MemoryLifecycleState;
  readonly updatedAt: Date;
}

// 5. Persistence Interfaces
export interface MemoryPersistenceContract {
  checkUniqueReference(
    ownerId: string,
    reference: string,
    excludeMemoryId?: string,
  ): Promise<boolean>;
}

export interface MemoryAggregateStore {
  save(memory: Memory): Promise<void>;
  findById(id: string, ownerId: string): Promise<Memory | null>;
  findByReference(reference: string, ownerId: string): Promise<Memory | null>;
}

// 6. Memory Properties
export interface MemoryProperties {
  id: string;
  reference: string;
  ownerId: string;
  metadata: MemoryMetadata;
  retentionRules: MemoryRetentionRule[];
  snapshots: MemorySnapshot[];
  status: MemoryLifecycleState;
  createdAt: Date;
  updatedAt: Date;
}

// 7. Memory Aggregate Root
export class Memory {
  private readonly _id: string;
  private readonly _reference: string;
  private readonly _ownerId: string;
  private _metadata: MemoryMetadata;
  private _retentionRules: MemoryRetentionRule[] = [];
  private _snapshots: MemorySnapshot[] = [];
  private _status: MemoryLifecycleState;
  private readonly _createdAt: Date;
  private _updatedAt: Date;
  private _domainEvents: MemoryDomainEvent[] = [];

  constructor(properties: MemoryProperties) {
    if (!properties.id || properties.id.trim() === "") {
      throw new Error("Memory Identity is required.");
    }
    if (!properties.reference || properties.reference.trim() === "") {
      throw new Error("Memory Reference is required.");
    }
    const referencePattern = /^[a-z0-9]+(\.[a-z0-9]+)*$/;
    if (!referencePattern.test(properties.reference)) {
      throw new Error("Invalid memory reference format. Must be lower-case dot-separated key.");
    }
    if (!properties.ownerId || properties.ownerId.trim() === "") {
      throw new Error("Owner Reference is required.");
    }
    if (!properties.metadata) {
      throw new Error("Memory Metadata is required.");
    }
    if (!properties.snapshots || properties.snapshots.length === 0) {
      throw new Error("Memory Snapshots collection must not be empty.");
    }
    if (!properties.status) {
      throw new Error("Memory Lifecycle State is required.");
    }

    this._id = properties.id;
    this._reference = properties.reference;
    this._ownerId = properties.ownerId;
    this._metadata = properties.metadata;
    this._status = properties.status;
    this._createdAt = properties.createdAt;
    this._updatedAt = properties.updatedAt;

    this._snapshots = [...properties.snapshots];
    if (properties.retentionRules) {
      this._retentionRules = [...properties.retentionRules];
    }

    this.validateInvariants();
  }

  // Getters
  get id(): string {
    return this._id;
  }

  get reference(): string {
    return this._reference;
  }

  get ownerId(): string {
    return this._ownerId;
  }

  get metadata(): MemoryMetadata {
    return this._metadata;
  }

  get retentionRules(): ReadonlyArray<MemoryRetentionRule> {
    return Object.freeze([...this._retentionRules]);
  }

  get snapshots(): ReadonlyArray<MemorySnapshot> {
    return Object.freeze([...this._snapshots]);
  }

  get status(): MemoryLifecycleState {
    return this._status;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }

  get domainEvents(): ReadonlyArray<MemoryDomainEvent> {
    return this._domainEvents;
  }

  /**
   * Retrieves the latest snapshot from the append-only history.
   * This dedicated abstraction encapsulates the logical retrieval behavior.
   */
  get latestSnapshot(): MemorySnapshot {
    if (this._snapshots.length === 0) {
      throw new Error("Invalid aggregate state: snapshots history is empty.");
    }
    return this._snapshots[this._snapshots.length - 1]!;
  }

  public clearDomainEvents(): void {
    this._domainEvents = [];
  }

  private addDomainEvent(event: MemoryDomainEvent): void {
    this._domainEvents.push(event);
  }

  private validateInvariants(): void {
    const referencePattern = /^[a-z0-9]+(\.[a-z0-9]+)*$/;
    if (!referencePattern.test(this._reference)) {
      throw new Error("Invalid memory reference format. Must be lower-case dot-separated key.");
    }
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
    reference: string,
    ownerId: string,
    metadata: MemoryMetadata,
    retentionRules: MemoryRetentionRule[],
    initialSnapshotId: string,
    initialEntry: MemoryEntry,
  ): Memory {
    const now = new Date();
    const initialSnapshot = new MemorySnapshot({
      snapshotId: initialSnapshotId,
      entry: initialEntry,
      metadataSnapshot: metadata,
      retentionRulesSnapshot: retentionRules,
      capturedAt: now,
    });

    const memory = new Memory({
      id,
      reference,
      ownerId,
      metadata,
      retentionRules,
      snapshots: [initialSnapshot],
      status: "Draft",
      createdAt: now,
      updatedAt: now,
    });

    memory.addDomainEvent({
      eventType: MEMORY_REGISTERED,
      memoryId: memory.id,
      reference: memory.reference,
      snapshotId: initialSnapshotId,
      ownerId: memory.ownerId,
    });

    return memory;
  }

  // Domain Operations
  /**
   * Replaces the Memory Metadata in its entirety.
   *
   * Mutation Rules:
   * - Must verify caller ownership prior to replacing metadata.
   * - Cannot mutate metadata if the aggregate is not in "Draft" status.
   * - Published historical memory must remain immutable.
   * - Performs complete atomic replacement of metadata (no partial mutations).
   */
  public replaceMetadata(actorOwnerId: string, metadata: MemoryMetadata): void {
    this.verifyOwnership(actorOwnerId);
    if (this._status !== "Draft") {
      throw new Error(`Cannot replace metadata when in status: ${this._status}`);
    }
    this._metadata = metadata;
    this._updatedAt = new Date();
  }

  public appendSnapshot(
    actorOwnerId: string,
    snapshotId: string,
    entry: MemoryEntry,
    metadata: MemoryMetadata,
  ): void {
    this.verifyOwnership(actorOwnerId);
    if (this._status === "Archived") {
      throw new Error("Cannot append snapshot to an archived memory.");
    }

    const snapshot = new MemorySnapshot({
      snapshotId,
      entry,
      metadataSnapshot: metadata,
      retentionRulesSnapshot: this._retentionRules,
      capturedAt: new Date(),
    });
    this._snapshots.push(snapshot);
    this._updatedAt = new Date();
  }

  public validate(actorOwnerId: string): void {
    this.verifyOwnership(actorOwnerId);
    if (this._status !== "Draft") {
      throw new Error(`Cannot validate memory when in status: ${this._status}`);
    }

    this._status = "Validated";
    this._updatedAt = new Date();

    this.addDomainEvent({
      eventType: MEMORY_VALIDATED,
      memoryId: this._id,
      reference: this._reference,
      snapshotId: this.latestSnapshot.snapshotId,
      ownerId: this._ownerId,
    });
  }

  public publish(actorOwnerId: string): void {
    this.verifyOwnership(actorOwnerId);
    if (this._status !== "Validated") {
      throw new Error(`Cannot publish memory when in status: ${this._status}`);
    }

    this._status = "Published";
    this._updatedAt = new Date();

    this.addDomainEvent({
      eventType: MEMORY_PUBLISHED,
      memoryId: this._id,
      reference: this._reference,
      snapshotId: this.latestSnapshot.snapshotId,
      ownerId: this._ownerId,
    });
  }

  public archive(actorOwnerId: string): void {
    this.verifyOwnership(actorOwnerId);
    if (this._status === "Archived") {
      throw new Error("Memory is already archived.");
    }

    this._status = "Archived";
    this._updatedAt = new Date();

    this.addDomainEvent({
      eventType: MEMORY_ARCHIVED,
      memoryId: this._id,
      reference: this._reference,
      snapshotId: this.latestSnapshot.snapshotId,
      ownerId: this._ownerId,
    });
  }
}
