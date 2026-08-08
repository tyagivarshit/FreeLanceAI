// 1. Value Objects

export class EmbeddingReference {
  private readonly _value: string;

  constructor(value: string) {
    if (!value || value.trim() === "") {
      throw new Error("Embedding reference is required.");
    }
    const cleanValue = value.trim();
    const pattern = /^[a-z0-9]+([.-][a-z0-9]+)*$/;
    if (!pattern.test(cleanValue)) {
      throw new Error("Invalid embedding reference format.");
    }
    this._value = cleanValue;
    Object.freeze(this);
  }

  get value(): string {
    return this._value;
  }

  public equals(other: EmbeddingReference): boolean {
    if (!other) {
      return false;
    }
    return this._value === other.value;
  }
}

export class EmbeddingSourceReference {
  private readonly _value: string;

  constructor(value: string) {
    if (!value || value.trim() === "") {
      throw new Error("Source reference is required.");
    }
    const cleanValue = value.trim();
    const pattern = /^[a-z0-9]+([.-][a-z0-9]+)*$/;
    if (!pattern.test(cleanValue)) {
      throw new Error("Invalid source reference format.");
    }
    this._value = cleanValue;
    Object.freeze(this);
  }

  get value(): string {
    return this._value;
  }

  public equals(other: EmbeddingSourceReference): boolean {
    if (!other) {
      return false;
    }
    return this._value === other.value;
  }
}

export class EmbeddingVector {
  private readonly _values: number[];

  constructor(values: number[]) {
    if (!values) {
      throw new Error("Vector array is required.");
    }
    if (values.length === 0) {
      throw new Error("Vector array must not be empty.");
    }

    for (const val of values) {
      if (typeof val !== "number") {
        throw new Error("Every element in the vector must be numeric.");
      }
      if (!Number.isFinite(val) || Number.isNaN(val)) {
        throw new Error("Every element in the vector must be a finite number.");
      }
    }

    this._values = [...values];
    Object.freeze(this._values);
    Object.freeze(this);
  }

  get values(): number[] {
    return [...this._values];
  }

  get length(): number {
    return this._values.length;
  }

  public equals(other: EmbeddingVector): boolean {
    if (!other) {
      return false;
    }
    if (this._values.length !== other.length) {
      return false;
    }
    return this._values.every((val, index) => val === other.values[index]);
  }
}

export class EmbeddingSpace {
  private readonly _value: string;

  constructor(value: string) {
    if (!value || value.trim() === "") {
      throw new Error("Embedding space value is required.");
    }
    const cleanValue = value.trim();
    const pattern = /^[a-z0-9]+([.-][a-z0-9]+)*$/;
    if (!pattern.test(cleanValue)) {
      throw new Error("Invalid embedding space format.");
    }
    this._value = cleanValue;
    Object.freeze(this);
  }

  get value(): string {
    return this._value;
  }

  public equals(other: EmbeddingSpace): boolean {
    if (!other) {
      return false;
    }
    return this._value === other.value;
  }
}

export class EmbeddingFingerprint {
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

  public equals(other: EmbeddingFingerprint): boolean {
    if (!other) {
      return false;
    }
    return this._value === other.value;
  }
}

// 2. Lifecycle State
export type EmbeddingLifecycle = "Draft" | "Registered" | "Validated" | "Available" | "Archived";

// 3. Snapshot
export interface EmbeddingSnapshotProperties {
  version: number;
  createdAt: Date;
  embeddingReference: EmbeddingReference;
  sourceReference: EmbeddingSourceReference;
  vector: EmbeddingVector;
  dimension: number;
  space: EmbeddingSpace;
  fingerprint: EmbeddingFingerprint;
  lifecycle: EmbeddingLifecycle;
  snapshotId: string;
}

export class EmbeddingSnapshot {
  private readonly _version: number;
  private readonly _createdAt: Date;
  private readonly _embeddingReference: EmbeddingReference;
  private readonly _sourceReference: EmbeddingSourceReference;
  private readonly _vector: EmbeddingVector;
  private readonly _dimension: number;
  private readonly _space: EmbeddingSpace;
  private readonly _fingerprint: EmbeddingFingerprint;
  private readonly _lifecycle: EmbeddingLifecycle;
  private readonly _snapshotId: string;

  constructor(properties: EmbeddingSnapshotProperties) {
    if (properties.version <= 0) {
      throw new Error("Snapshot version must be greater than zero.");
    }
    if (!properties.createdAt) {
      throw new Error("Snapshot creation date is required.");
    }
    if (!properties.embeddingReference) {
      throw new Error("Embedding reference is required.");
    }
    if (!properties.sourceReference) {
      throw new Error("Source reference is required.");
    }
    if (!properties.vector) {
      throw new Error("Embedding vector is required.");
    }
    if (properties.dimension <= 0) {
      throw new Error("Embedding dimension must be greater than zero.");
    }
    if (properties.vector.length !== properties.dimension) {
      throw new Error("Vector dimension mismatch.");
    }
    if (!properties.space) {
      throw new Error("Embedding space is required.");
    }
    if (!properties.fingerprint) {
      throw new Error("Embedding fingerprint is required.");
    }
    if (!properties.lifecycle) {
      throw new Error("Lifecycle state is required.");
    }
    if (!properties.snapshotId || properties.snapshotId.trim() === "") {
      throw new Error("Snapshot identity is required.");
    }

    this._version = properties.version;
    this._createdAt = new Date(properties.createdAt.getTime());
    this._embeddingReference = properties.embeddingReference;
    this._sourceReference = properties.sourceReference;
    this._vector = properties.vector;
    this._dimension = properties.dimension;
    this._space = properties.space;
    this._fingerprint = properties.fingerprint;
    this._lifecycle = properties.lifecycle;
    this._snapshotId = properties.snapshotId.trim();
    Object.freeze(this);
  }

  get version(): number {
    return this._version;
  }

  get createdAt(): Date {
    return new Date(this._createdAt.getTime());
  }

  get embeddingReference(): EmbeddingReference {
    return this._embeddingReference;
  }

  get sourceReference(): EmbeddingSourceReference {
    return this._sourceReference;
  }

  get vector(): EmbeddingVector {
    return this._vector;
  }

  get dimension(): number {
    return this._dimension;
  }

  get space(): EmbeddingSpace {
    return this._space;
  }

  get fingerprint(): EmbeddingFingerprint {
    return this._fingerprint;
  }

  get lifecycle(): EmbeddingLifecycle {
    return this._lifecycle;
  }

  get snapshotId(): string {
    return this._snapshotId;
  }
}

// 4. Domain Events
export const EMBEDDING_REGISTERED = "EMBEDDING_REGISTERED";
export const EMBEDDING_VALIDATED = "EMBEDDING_VALIDATED";
export const EMBEDDING_AVAILABLE = "EMBEDDING_AVAILABLE";
export const EMBEDDING_ARCHIVED = "EMBEDDING_ARCHIVED";

export type EmbeddingDomainEventName =
  | typeof EMBEDDING_REGISTERED
  | typeof EMBEDDING_VALIDATED
  | typeof EMBEDDING_AVAILABLE
  | typeof EMBEDDING_ARCHIVED;

export interface EmbeddingRegisteredEvent {
  readonly eventType: typeof EMBEDDING_REGISTERED;
  readonly embeddingId: string;
  readonly embeddingReference: string;
  readonly sourceReference: string;
  readonly snapshotId: string;
}

export interface EmbeddingValidatedEvent {
  readonly eventType: typeof EMBEDDING_VALIDATED;
  readonly embeddingId: string;
  readonly embeddingReference: string;
  readonly sourceReference: string;
  readonly snapshotId: string;
}

export interface EmbeddingAvailableEvent {
  readonly eventType: typeof EMBEDDING_AVAILABLE;
  readonly embeddingId: string;
  readonly embeddingReference: string;
  readonly sourceReference: string;
  readonly snapshotId: string;
}

export interface EmbeddingArchivedEvent {
  readonly eventType: typeof EMBEDDING_ARCHIVED;
  readonly embeddingId: string;
  readonly embeddingReference: string;
  readonly sourceReference: string;
  readonly snapshotId: string;
}

export type EmbeddingDomainEvent =
  | EmbeddingRegisteredEvent
  | EmbeddingValidatedEvent
  | EmbeddingAvailableEvent
  | EmbeddingArchivedEvent;

// 5. Persistence & Query Contracts
export interface EmbeddingQueryProjection {
  readonly id: string;
  readonly embeddingReference: string;
  readonly sourceReference: string;
  readonly dimension: number;
  readonly space: string;
  readonly lifecycle: EmbeddingLifecycle;
  readonly versionCount: number;
  readonly updatedAt: Date;
}

export interface EmbeddingPersistenceContract {
  checkUniqueReference(reference: string, excludeEmbeddingId?: string): Promise<boolean>;
}

export interface EmbeddingAggregateStore {
  save(embedding: Embedding): Promise<void>;
  findById(id: string): Promise<Embedding | null>;
  findByReference(reference: string): Promise<Embedding | null>;
}

// 6. Embedding Aggregate Properties
export interface EmbeddingProperties {
  id: string;
  embeddingReference: EmbeddingReference;
  sourceReference: EmbeddingSourceReference;
  vector: EmbeddingVector;
  dimension: number;
  space: EmbeddingSpace;
  fingerprint: EmbeddingFingerprint;
  lifecycle: EmbeddingLifecycle;
  snapshots: EmbeddingSnapshot[];
  createdAt: Date;
  updatedAt: Date;
}

// 7. Embedding Aggregate Root
export class Embedding {
  private readonly _id: string;
  private readonly _embeddingReference: EmbeddingReference;
  private readonly _sourceReference: EmbeddingSourceReference;
  private _vector: EmbeddingVector;
  private _dimension: number;
  private _space: EmbeddingSpace;
  private _fingerprint: EmbeddingFingerprint;
  private _lifecycle: EmbeddingLifecycle;
  private readonly _snapshots: EmbeddingSnapshot[] = [];
  private readonly _createdAt: Date;
  private _updatedAt: Date;
  private _domainEvents: EmbeddingDomainEvent[] = [];

  constructor(properties: EmbeddingProperties) {
    this._id = properties.id;
    this._embeddingReference = properties.embeddingReference;
    this._sourceReference = properties.sourceReference;
    this._vector = properties.vector;
    this._dimension = properties.dimension;
    this._space = properties.space;
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

  get embeddingReference(): EmbeddingReference {
    return this._embeddingReference;
  }

  get sourceReference(): EmbeddingSourceReference {
    return this._sourceReference;
  }

  get vector(): EmbeddingVector {
    return this._vector;
  }

  get dimension(): number {
    return this._dimension;
  }

  get space(): EmbeddingSpace {
    return this._space;
  }

  get fingerprint(): EmbeddingFingerprint {
    return this._fingerprint;
  }

  get lifecycle(): EmbeddingLifecycle {
    return this._lifecycle;
  }

  get snapshots(): ReadonlyArray<EmbeddingSnapshot> {
    return Object.freeze([...this._snapshots]);
  }

  get createdAt(): Date {
    return new Date(this._createdAt.getTime());
  }

  get updatedAt(): Date {
    return new Date(this._updatedAt.getTime());
  }

  get domainEvents(): ReadonlyArray<EmbeddingDomainEvent> {
    return this._domainEvents;
  }

  public clearDomainEvents(): void {
    this._domainEvents = [];
  }

  private addDomainEvent(event: EmbeddingDomainEvent): void {
    this._domainEvents.push(event);
  }

  private validateInvariants(): void {
    if (!this._id || this._id.trim() === "") {
      throw new Error("Embedding Identity is required.");
    }
    if (!this._embeddingReference) {
      throw new Error("Embedding Reference is required.");
    }
    if (!this._sourceReference) {
      throw new Error("Source Reference is required.");
    }
    if (!this._vector) {
      throw new Error("Embedding Vector is required.");
    }
    if (this._dimension <= 0) {
      throw new Error("Embedding dimension must be greater than zero.");
    }
    if (this._vector.length !== this._dimension) {
      throw new Error("Vector dimension mismatch.");
    }
    if (!this._space) {
      throw new Error("Embedding Space is required.");
    }
    if (!this._fingerprint) {
      throw new Error("Embedding Fingerprint is required.");
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

  private appendSnapshot(snapshotId: string): void {
    const nextVersion = this._snapshots.length + 1;
    const newSnapshot = new EmbeddingSnapshot({
      version: nextVersion,
      createdAt: new Date(),
      embeddingReference: this._embeddingReference,
      sourceReference: this._sourceReference,
      vector: this._vector,
      dimension: this._dimension,
      space: this._space,
      fingerprint: this._fingerprint,
      lifecycle: this._lifecycle,
      snapshotId,
    });
    this._snapshots.push(newSnapshot);
  }

  // Factory Creation Method
  public static create(
    id: string,
    embeddingReference: EmbeddingReference,
    sourceReference: EmbeddingSourceReference,
    vector: EmbeddingVector,
    space: EmbeddingSpace,
    fingerprint: EmbeddingFingerprint,
    snapshotId: string,
  ): Embedding {
    const now = new Date();
    const dimension = vector.length;
    const embedding = new Embedding({
      id,
      embeddingReference,
      sourceReference,
      vector,
      dimension,
      space,
      fingerprint,
      lifecycle: "Draft",
      snapshots: [],
      createdAt: now,
      updatedAt: now,
    });

    embedding.appendSnapshot(snapshotId);
    return embedding;
  }

  // Domain Operations
  public register(snapshotId: string): void {
    if (this._lifecycle !== "Draft") {
      throw new Error(`Cannot register embedding when in status: ${this._lifecycle}`);
    }

    this._lifecycle = "Registered";
    this._updatedAt = new Date();
    this.appendSnapshot(snapshotId);

    this.addDomainEvent({
      eventType: EMBEDDING_REGISTERED,
      embeddingId: this._id,
      embeddingReference: this._embeddingReference.value,
      sourceReference: this._sourceReference.value,
      snapshotId,
    });
  }

  public validate(snapshotId: string): void {
    if (this._lifecycle !== "Registered") {
      throw new Error(`Cannot validate embedding when in status: ${this._lifecycle}`);
    }

    this._lifecycle = "Validated";
    this._updatedAt = new Date();
    this.appendSnapshot(snapshotId);

    this.addDomainEvent({
      eventType: EMBEDDING_VALIDATED,
      embeddingId: this._id,
      embeddingReference: this._embeddingReference.value,
      sourceReference: this._sourceReference.value,
      snapshotId,
    });
  }

  public makeAvailable(snapshotId: string): void {
    if (this._lifecycle !== "Validated") {
      throw new Error(`Cannot make embedding available when in status: ${this._lifecycle}`);
    }

    this._lifecycle = "Available";
    this._updatedAt = new Date();
    this.appendSnapshot(snapshotId);

    this.addDomainEvent({
      eventType: EMBEDDING_AVAILABLE,
      embeddingId: this._id,
      embeddingReference: this._embeddingReference.value,
      sourceReference: this._sourceReference.value,
      snapshotId,
    });
  }

  public archive(snapshotId: string): void {
    if (this._lifecycle === "Archived") {
      throw new Error("Embedding is already archived.");
    }

    this._lifecycle = "Archived";
    this._updatedAt = new Date();
    this.appendSnapshot(snapshotId);

    this.addDomainEvent({
      eventType: EMBEDDING_ARCHIVED,
      embeddingId: this._id,
      embeddingReference: this._embeddingReference.value,
      sourceReference: this._sourceReference.value,
      snapshotId,
    });
  }

  public update(
    vector: EmbeddingVector,
    space: EmbeddingSpace,
    fingerprint: EmbeddingFingerprint,
    snapshotId: string,
  ): void {
    if (this._lifecycle === "Archived") {
      throw new Error("Cannot update archived embedding.");
    }

    this._vector = vector;
    this._dimension = vector.length;
    this._space = space;
    this._fingerprint = fingerprint;
    this._updatedAt = new Date();
    this.appendSnapshot(snapshotId);
  }
}
