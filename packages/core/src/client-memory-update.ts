// 1. Value Objects

export class MemoryUpdateReference {
  private readonly _value: string;

  constructor(value: string) {
    if (!value || value.trim() === "") {
      throw new Error("Memory update reference is required.");
    }
    const cleanValue = value.trim();
    const pattern = /^[a-z0-9]+([.-][a-z0-9]+)*$/;
    if (!pattern.test(cleanValue)) {
      throw new Error("Invalid memory update reference format.");
    }
    this._value = cleanValue;
    Object.freeze(this);
  }

  get value(): string {
    return this._value;
  }

  public equals(other: MemoryUpdateReference): boolean {
    if (!other) {
      return false;
    }
    return this._value === other.value;
  }
}

export class TargetMemoryReference {
  private readonly _value: string;

  constructor(value: string) {
    if (!value || value.trim() === "") {
      throw new Error("Target memory reference is required.");
    }
    const cleanValue = value.trim();
    const pattern = /^[a-z0-9]+([.-][a-z0-9]+)*$/;
    if (!pattern.test(cleanValue)) {
      throw new Error("Invalid target memory reference format.");
    }
    this._value = cleanValue;
    Object.freeze(this);
  }

  get value(): string {
    return this._value;
  }

  public equals(other: TargetMemoryReference): boolean {
    if (!other) {
      return false;
    }
    return this._value === other.value;
  }
}

export type MemoryUpdateOperation = "Create" | "Replace" | "Append" | "Remove";

export interface MemoryUpdateSpecificationProperties {
  operation: string;
  target: string;
  proposedValue: string;
  reason: string;
}

export class MemoryUpdateSpecification {
  private readonly _operation: MemoryUpdateOperation;
  private readonly _target: string;
  private readonly _proposedValue: string;
  private readonly _reason: string;

  constructor(properties: MemoryUpdateSpecificationProperties) {
    if (!properties.operation || properties.operation.trim() === "") {
      throw new Error("Operation type is required.");
    }
    if (!properties.target || properties.target.trim() === "") {
      throw new Error("Target specification is required.");
    }
    if (!properties.proposedValue || properties.proposedValue.trim() === "") {
      throw new Error("Proposed value is required.");
    }
    if (!properties.reason || properties.reason.trim() === "") {
      throw new Error("Reason is required.");
    }

    const cleanOp = properties.operation.trim();
    const validOps = ["Create", "Replace", "Append", "Remove"];
    const matched = validOps.find((op) => op.toLowerCase() === cleanOp.toLowerCase());
    if (!matched) {
      throw new Error(`Invalid operation type: ${cleanOp}.`);
    }

    this._operation = matched as MemoryUpdateOperation;
    this._target = properties.target.trim();
    this._proposedValue = properties.proposedValue.trim();
    this._reason = properties.reason.trim();
    Object.freeze(this);
  }

  get operation(): MemoryUpdateOperation {
    return this._operation;
  }

  get target(): string {
    return this._target;
  }

  get proposedValue(): string {
    return this._proposedValue;
  }

  get reason(): string {
    return this._reason;
  }

  public equals(other: MemoryUpdateSpecification): boolean {
    if (!other) {
      return false;
    }
    return (
      this._operation === other.operation &&
      this._target === other.target &&
      this._proposedValue === other.proposedValue &&
      this._reason === other.reason
    );
  }
}

export type MemoryUpdateClassificationValue =
  | "Preference"
  | "Goal"
  | "Constraint"
  | "Fact"
  | "Relationship"
  | "Risk"
  | "Context";

export class MemoryUpdateClassification {
  private readonly _value: MemoryUpdateClassificationValue;

  constructor(value: string) {
    if (!value || value.trim() === "") {
      throw new Error("Memory update classification is required.");
    }
    const cleanValue = value.trim();
    const validCategories = [
      "Preference",
      "Goal",
      "Constraint",
      "Fact",
      "Relationship",
      "Risk",
      "Context",
    ];

    const matched = validCategories.find((c) => c.toLowerCase() === cleanValue.toLowerCase());
    if (!matched) {
      throw new Error(`Invalid Memory update classification category: ${cleanValue}.`);
    }

    this._value = matched as MemoryUpdateClassificationValue;
    Object.freeze(this);
  }

  get value(): MemoryUpdateClassificationValue {
    return this._value;
  }

  public equals(other: MemoryUpdateClassification): boolean {
    if (!other) {
      return false;
    }
    return this._value === other.value;
  }
}

export class MemoryUpdateSourceReference {
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

  public equals(other: MemoryUpdateSourceReference): boolean {
    if (!other) {
      return false;
    }
    return this._value === other.value;
  }
}

export type MemoryUpdatePriorityValue = "Low" | "Normal" | "High" | "Critical";

export class MemoryUpdatePriority {
  private readonly _value: MemoryUpdatePriorityValue;

  constructor(value: string) {
    if (!value || value.trim() === "") {
      throw new Error("Memory update priority is required.");
    }
    const cleanValue = value.trim();
    const validPriorities = ["Low", "Normal", "High", "Critical"];

    const matched = validPriorities.find((p) => p.toLowerCase() === cleanValue.toLowerCase());
    if (!matched) {
      throw new Error(`Invalid Memory update priority: ${cleanValue}.`);
    }

    this._value = matched as MemoryUpdatePriorityValue;
    Object.freeze(this);
  }

  get value(): MemoryUpdatePriorityValue {
    return this._value;
  }

  public equals(other: MemoryUpdatePriority): boolean {
    if (!other) {
      return false;
    }
    return this._value === other.value;
  }
}

export class MemoryUpdateFingerprint {
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

  public equals(other: MemoryUpdateFingerprint): boolean {
    if (!other) {
      return false;
    }
    return this._value === other.value;
  }
}

// 2. Lifecycle State
export type ClientMemoryUpdateLifecycle =
  | "Draft"
  | "Proposed"
  | "Validated"
  | "Approved"
  | "Applied"
  | "Rejected"
  | "Archived";

// 3. Snapshot
export interface ClientMemoryUpdateSnapshotProperties {
  version: number;
  createdAt: Date;
  updateReference: MemoryUpdateReference;
  clientId: string;
  ownerId: string;
  targetMemoryReference: TargetMemoryReference;
  specification: MemoryUpdateSpecification;
  classification: MemoryUpdateClassification;
  sourceReference: MemoryUpdateSourceReference;
  priority: MemoryUpdatePriority;
  fingerprint: MemoryUpdateFingerprint;
  lifecycle: ClientMemoryUpdateLifecycle;
}

export class ClientMemoryUpdateSnapshot {
  private readonly _version: number;
  private readonly _createdAt: Date;
  private readonly _updateReference: MemoryUpdateReference;
  private readonly _clientId: string;
  private readonly _ownerId: string;
  private readonly _targetMemoryReference: TargetMemoryReference;
  private readonly _specification: MemoryUpdateSpecification;
  private readonly _classification: MemoryUpdateClassification;
  private readonly _sourceReference: MemoryUpdateSourceReference;
  private readonly _priority: MemoryUpdatePriority;
  private readonly _fingerprint: MemoryUpdateFingerprint;
  private readonly _lifecycle: ClientMemoryUpdateLifecycle;

  constructor(properties: ClientMemoryUpdateSnapshotProperties) {
    if (properties.version <= 0) {
      throw new Error("Snapshot version must be greater than zero.");
    }
    if (!properties.createdAt) {
      throw new Error("Snapshot creation date is required.");
    }
    if (!properties.updateReference) {
      throw new Error("Memory update reference is required.");
    }
    if (!properties.clientId || properties.clientId.trim() === "") {
      throw new Error("Client reference is required.");
    }
    if (!properties.ownerId || properties.ownerId.trim() === "") {
      throw new Error("Owner reference is required.");
    }
    if (!properties.targetMemoryReference) {
      throw new Error("Target memory reference is required.");
    }
    if (!properties.specification) {
      throw new Error("Update specification is required.");
    }
    if (!properties.classification) {
      throw new Error("Classification is required.");
    }
    if (!properties.sourceReference) {
      throw new Error("Source reference is required.");
    }
    if (!properties.priority) {
      throw new Error("Priority is required.");
    }
    if (!properties.fingerprint) {
      throw new Error("Fingerprint is required.");
    }
    if (!properties.lifecycle) {
      throw new Error("Lifecycle state is required.");
    }

    this._version = properties.version;
    this._createdAt = new Date(properties.createdAt.getTime());
    this._updateReference = properties.updateReference;
    this._clientId = properties.clientId;
    this._ownerId = properties.ownerId;
    this._targetMemoryReference = properties.targetMemoryReference;
    this._specification = properties.specification;
    this._classification = properties.classification;
    this._sourceReference = properties.sourceReference;
    this._priority = properties.priority;
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

  get updateReference(): MemoryUpdateReference {
    return this._updateReference;
  }

  get clientId(): string {
    return this._clientId;
  }

  get ownerId(): string {
    return this._ownerId;
  }

  get targetMemoryReference(): TargetMemoryReference {
    return this._targetMemoryReference;
  }

  get specification(): MemoryUpdateSpecification {
    return this._specification;
  }

  get classification(): MemoryUpdateClassification {
    return this._classification;
  }

  get sourceReference(): MemoryUpdateSourceReference {
    return this._sourceReference;
  }

  get priority(): MemoryUpdatePriority {
    return this._priority;
  }

  get fingerprint(): MemoryUpdateFingerprint {
    return this._fingerprint;
  }

  get lifecycle(): ClientMemoryUpdateLifecycle {
    return this._lifecycle;
  }
}

// 4. Domain Events
export const CLIENT_MEMORY_UPDATE_PROPOSED = "CLIENT_MEMORY_UPDATE_PROPOSED";
export const CLIENT_MEMORY_UPDATE_VALIDATED = "CLIENT_MEMORY_UPDATE_VALIDATED";
export const CLIENT_MEMORY_UPDATE_APPROVED = "CLIENT_MEMORY_UPDATE_APPROVED";
export const CLIENT_MEMORY_UPDATE_APPLIED = "CLIENT_MEMORY_UPDATE_APPLIED";
export const CLIENT_MEMORY_UPDATE_REJECTED = "CLIENT_MEMORY_UPDATE_REJECTED";
export const CLIENT_MEMORY_UPDATE_ARCHIVED = "CLIENT_MEMORY_UPDATE_ARCHIVED";

export type ClientMemoryUpdateDomainEventName =
  | typeof CLIENT_MEMORY_UPDATE_PROPOSED
  | typeof CLIENT_MEMORY_UPDATE_VALIDATED
  | typeof CLIENT_MEMORY_UPDATE_APPROVED
  | typeof CLIENT_MEMORY_UPDATE_APPLIED
  | typeof CLIENT_MEMORY_UPDATE_REJECTED
  | typeof CLIENT_MEMORY_UPDATE_ARCHIVED;

export interface ClientMemoryUpdateProposedEvent {
  readonly eventType: typeof CLIENT_MEMORY_UPDATE_PROPOSED;
  readonly updateId: string;
  readonly updateReference: string;
  readonly clientId: string;
  readonly ownerId: string;
  readonly targetMemoryReference: string;
  readonly snapshotVersion: number;
}

export interface ClientMemoryUpdateValidatedEvent {
  readonly eventType: typeof CLIENT_MEMORY_UPDATE_VALIDATED;
  readonly updateId: string;
  readonly updateReference: string;
  readonly clientId: string;
  readonly ownerId: string;
  readonly targetMemoryReference: string;
  readonly snapshotVersion: number;
}

export interface ClientMemoryUpdateApprovedEvent {
  readonly eventType: typeof CLIENT_MEMORY_UPDATE_APPROVED;
  readonly updateId: string;
  readonly updateReference: string;
  readonly clientId: string;
  readonly ownerId: string;
  readonly targetMemoryReference: string;
  readonly snapshotVersion: number;
}

export interface ClientMemoryUpdateAppliedEvent {
  readonly eventType: typeof CLIENT_MEMORY_UPDATE_APPLIED;
  readonly updateId: string;
  readonly updateReference: string;
  readonly clientId: string;
  readonly ownerId: string;
  readonly targetMemoryReference: string;
  readonly snapshotVersion: number;
}

export interface ClientMemoryUpdateRejectedEvent {
  readonly eventType: typeof CLIENT_MEMORY_UPDATE_REJECTED;
  readonly updateId: string;
  readonly updateReference: string;
  readonly clientId: string;
  readonly ownerId: string;
  readonly targetMemoryReference: string;
  readonly snapshotVersion: number;
}

export interface ClientMemoryUpdateArchivedEvent {
  readonly eventType: typeof CLIENT_MEMORY_UPDATE_ARCHIVED;
  readonly updateId: string;
  readonly updateReference: string;
  readonly clientId: string;
  readonly ownerId: string;
  readonly targetMemoryReference: string;
  readonly snapshotVersion: number;
}

export type ClientMemoryUpdateDomainEvent =
  | ClientMemoryUpdateProposedEvent
  | ClientMemoryUpdateValidatedEvent
  | ClientMemoryUpdateApprovedEvent
  | ClientMemoryUpdateAppliedEvent
  | ClientMemoryUpdateRejectedEvent
  | ClientMemoryUpdateArchivedEvent;

// 5. Persistence & Query Contracts
export interface ClientMemoryUpdateQueryProjection {
  readonly id: string;
  readonly updateReference: string;
  readonly clientId: string;
  readonly ownerId: string;
  readonly targetMemoryReference: string;
  readonly lifecycle: ClientMemoryUpdateLifecycle;
  readonly operation: string;
  readonly classification: string;
  readonly priority: string;
  readonly versionCount: number;
  readonly updatedAt: Date;
}

export interface ClientMemoryUpdatePersistenceContract {
  checkUniqueReference(
    ownerId: string,
    reference: string,
    excludeUpdateId?: string,
  ): Promise<boolean>;
}

export interface ClientMemoryUpdateAggregateStore {
  save(update: ClientMemoryUpdate): Promise<void>;
  findById(id: string, ownerId: string): Promise<ClientMemoryUpdate | null>;
  findByReference(reference: string, ownerId: string): Promise<ClientMemoryUpdate | null>;
}

// 6. ClientMemoryUpdate Properties
export interface ClientMemoryUpdateProperties {
  id: string;
  updateReference: MemoryUpdateReference;
  clientId: string;
  ownerId: string;
  targetMemoryReference: TargetMemoryReference;
  specification: MemoryUpdateSpecification;
  classification: MemoryUpdateClassification;
  sourceReference: MemoryUpdateSourceReference;
  priority: MemoryUpdatePriority;
  fingerprint: MemoryUpdateFingerprint;
  lifecycle: ClientMemoryUpdateLifecycle;
  snapshots: ClientMemoryUpdateSnapshot[];
  createdAt: Date;
  updatedAt: Date;
}

// 7. ClientMemoryUpdate Aggregate Root
export class ClientMemoryUpdate {
  private readonly _id: string;
  private readonly _updateReference: MemoryUpdateReference;
  private readonly _clientId: string;
  private readonly _ownerId: string;
  private _targetMemoryReference: TargetMemoryReference;
  private _specification: MemoryUpdateSpecification;
  private _classification: MemoryUpdateClassification;
  private _sourceReference: MemoryUpdateSourceReference;
  private _priority: MemoryUpdatePriority;
  private _fingerprint: MemoryUpdateFingerprint;
  private _lifecycle: ClientMemoryUpdateLifecycle;
  private readonly _snapshots: ClientMemoryUpdateSnapshot[] = [];
  private readonly _createdAt: Date;
  private _updatedAt: Date;
  private _domainEvents: ClientMemoryUpdateDomainEvent[] = [];

  constructor(properties: ClientMemoryUpdateProperties) {
    this._id = properties.id;
    this._updateReference = properties.updateReference;
    this._clientId = properties.clientId;
    this._ownerId = properties.ownerId;
    this._targetMemoryReference = properties.targetMemoryReference;
    this._specification = properties.specification;
    this._classification = properties.classification;
    this._sourceReference = properties.sourceReference;
    this._priority = properties.priority;
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

  get updateReference(): MemoryUpdateReference {
    return this._updateReference;
  }

  get clientId(): string {
    return this._clientId;
  }

  get ownerId(): string {
    return this._ownerId;
  }

  get targetMemoryReference(): TargetMemoryReference {
    return this._targetMemoryReference;
  }

  get specification(): MemoryUpdateSpecification {
    return this._specification;
  }

  get classification(): MemoryUpdateClassification {
    return this._classification;
  }

  get sourceReference(): MemoryUpdateSourceReference {
    return this._sourceReference;
  }

  get priority(): MemoryUpdatePriority {
    return this._priority;
  }

  get fingerprint(): MemoryUpdateFingerprint {
    return this._fingerprint;
  }

  get lifecycle(): ClientMemoryUpdateLifecycle {
    return this._lifecycle;
  }

  get snapshots(): ReadonlyArray<ClientMemoryUpdateSnapshot> {
    return Object.freeze([...this._snapshots]);
  }

  get createdAt(): Date {
    return new Date(this._createdAt.getTime());
  }

  get updatedAt(): Date {
    return new Date(this._updatedAt.getTime());
  }

  get domainEvents(): ReadonlyArray<ClientMemoryUpdateDomainEvent> {
    return this._domainEvents;
  }

  public clearDomainEvents(): void {
    this._domainEvents = [];
  }

  private addDomainEvent(event: ClientMemoryUpdateDomainEvent): void {
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
      throw new Error("Update Identity is required.");
    }
    if (!this._updateReference) {
      throw new Error("Update Reference is required.");
    }
    if (!this._clientId || this._clientId.trim() === "") {
      throw new Error("Client Reference is required.");
    }
    if (!this._ownerId || this._ownerId.trim() === "") {
      throw new Error("Owner Reference is required.");
    }
    if (!this._targetMemoryReference) {
      throw new Error("Target Memory Reference is required.");
    }
    if (!this._specification) {
      throw new Error("Update Specification is required.");
    }
    if (!this._classification) {
      throw new Error("Update Classification is required.");
    }
    if (!this._sourceReference) {
      throw new Error("Update Source Reference is required.");
    }
    if (!this._priority) {
      throw new Error("Update Priority is required.");
    }
    if (!this._fingerprint) {
      throw new Error("Update Fingerprint is required.");
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
    const newSnapshot = new ClientMemoryUpdateSnapshot({
      version: nextVersion,
      createdAt: new Date(),
      updateReference: this._updateReference,
      clientId: this._clientId,
      ownerId: this._ownerId,
      targetMemoryReference: this._targetMemoryReference,
      specification: this._specification,
      classification: this._classification,
      sourceReference: this._sourceReference,
      priority: this._priority,
      fingerprint: this._fingerprint,
      lifecycle: this._lifecycle,
    });
    this._snapshots.push(newSnapshot);
  }

  // Factory Creation Method
  public static create(
    id: string,
    updateReference: MemoryUpdateReference,
    clientId: string,
    ownerId: string,
    targetMemoryReference: TargetMemoryReference,
    specification: MemoryUpdateSpecification,
    classification: MemoryUpdateClassification,
    sourceReference: MemoryUpdateSourceReference,
    priority: MemoryUpdatePriority,
    fingerprint: MemoryUpdateFingerprint,
  ): ClientMemoryUpdate {
    const now = new Date();
    const update = new ClientMemoryUpdate({
      id,
      updateReference,
      clientId,
      ownerId,
      targetMemoryReference,
      specification,
      classification,
      sourceReference,
      priority,
      fingerprint,
      lifecycle: "Draft",
      snapshots: [],
      createdAt: now,
      updatedAt: now,
    });

    update.appendSnapshot();
    return update;
  }

  // Domain Operations
  public propose(actorOwnerId: string): void {
    this.verifyOwnership(actorOwnerId);
    if (this._lifecycle !== "Draft") {
      throw new Error(`Cannot propose update when in status: ${this._lifecycle}`);
    }

    this._lifecycle = "Proposed";
    this._updatedAt = new Date();
    this.appendSnapshot();

    this.addDomainEvent({
      eventType: CLIENT_MEMORY_UPDATE_PROPOSED,
      updateId: this._id,
      updateReference: this._updateReference.value,
      clientId: this._clientId,
      ownerId: this._ownerId,
      targetMemoryReference: this._targetMemoryReference.value,
      snapshotVersion: this._snapshots.length,
    });
  }

  public validate(actorOwnerId: string): void {
    this.verifyOwnership(actorOwnerId);
    if (this._lifecycle !== "Proposed") {
      throw new Error(`Cannot validate update when in status: ${this._lifecycle}`);
    }

    this._lifecycle = "Validated";
    this._updatedAt = new Date();
    this.appendSnapshot();

    this.addDomainEvent({
      eventType: CLIENT_MEMORY_UPDATE_VALIDATED,
      updateId: this._id,
      updateReference: this._updateReference.value,
      clientId: this._clientId,
      ownerId: this._ownerId,
      targetMemoryReference: this._targetMemoryReference.value,
      snapshotVersion: this._snapshots.length,
    });
  }

  public approve(actorOwnerId: string): void {
    this.verifyOwnership(actorOwnerId);
    if (this._lifecycle !== "Validated") {
      throw new Error(`Cannot approve update when in status: ${this._lifecycle}`);
    }

    this._lifecycle = "Approved";
    this._updatedAt = new Date();
    this.appendSnapshot();

    this.addDomainEvent({
      eventType: CLIENT_MEMORY_UPDATE_APPROVED,
      updateId: this._id,
      updateReference: this._updateReference.value,
      clientId: this._clientId,
      ownerId: this._ownerId,
      targetMemoryReference: this._targetMemoryReference.value,
      snapshotVersion: this._snapshots.length,
    });
  }

  public apply(actorOwnerId: string): void {
    this.verifyOwnership(actorOwnerId);
    if (this._lifecycle !== "Approved") {
      throw new Error(`Cannot apply update when in status: ${this._lifecycle}`);
    }

    // Applied state update only (Actual memory mutation remains completely outside Core aggregate boundaries)
    this._lifecycle = "Applied";
    this._updatedAt = new Date();
    this.appendSnapshot();

    this.addDomainEvent({
      eventType: CLIENT_MEMORY_UPDATE_APPLIED,
      updateId: this._id,
      updateReference: this._updateReference.value,
      clientId: this._clientId,
      ownerId: this._ownerId,
      targetMemoryReference: this._targetMemoryReference.value,
      snapshotVersion: this._snapshots.length,
    });
  }

  public reject(actorOwnerId: string): void {
    this.verifyOwnership(actorOwnerId);
    const nonRejectable = ["Applied", "Rejected", "Archived"];
    if (nonRejectable.includes(this._lifecycle)) {
      throw new Error(`Cannot reject update when in status: ${this._lifecycle}`);
    }

    this._lifecycle = "Rejected";
    this._updatedAt = new Date();
    this.appendSnapshot();

    this.addDomainEvent({
      eventType: CLIENT_MEMORY_UPDATE_REJECTED,
      updateId: this._id,
      updateReference: this._updateReference.value,
      clientId: this._clientId,
      ownerId: this._ownerId,
      targetMemoryReference: this._targetMemoryReference.value,
      snapshotVersion: this._snapshots.length,
    });
  }

  public archive(actorOwnerId: string): void {
    this.verifyOwnership(actorOwnerId);
    if (this._lifecycle === "Archived") {
      throw new Error("Update is already archived.");
    }

    this._lifecycle = "Archived";
    this._updatedAt = new Date();
    this.appendSnapshot();

    this.addDomainEvent({
      eventType: CLIENT_MEMORY_UPDATE_ARCHIVED,
      updateId: this._id,
      updateReference: this._updateReference.value,
      clientId: this._clientId,
      ownerId: this._ownerId,
      targetMemoryReference: this._targetMemoryReference.value,
      snapshotVersion: this._snapshots.length,
    });
  }

  public update(
    actorOwnerId: string,
    targetMemoryReference: TargetMemoryReference,
    specification: MemoryUpdateSpecification,
    classification: MemoryUpdateClassification,
    sourceReference: MemoryUpdateSourceReference,
    priority: MemoryUpdatePriority,
    fingerprint: MemoryUpdateFingerprint,
  ): void {
    this.verifyOwnership(actorOwnerId);
    const unupdatable = ["Applied", "Rejected", "Archived"];
    if (unupdatable.includes(this._lifecycle)) {
      throw new Error(`Cannot update memory request in status: ${this._lifecycle}`);
    }

    this._targetMemoryReference = targetMemoryReference;
    this._specification = specification;
    this._classification = classification;
    this._sourceReference = sourceReference;
    this._priority = priority;
    this._fingerprint = fingerprint;
    this._updatedAt = new Date();
    this.appendSnapshot();
  }
}
