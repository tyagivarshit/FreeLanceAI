// 1. Lifecycle State
export type ReplyToneAdjustmentLifecycle = "Draft" | "Requested" | "Adjusted" | "Archived";

// 2. Value Objects

export class ToneProfile {
  private readonly _value: string;

  private static readonly ALLOWED_TONES = [
    "professional",
    "friendly",
    "casual",
    "formal",
    "concise",
    "persuasive",
    "empathetic",
    "direct",
  ];

  constructor(value: string) {
    if (!value || value.trim() === "") {
      throw new Error("Tone profile value is required.");
    }
    const normalized = value.trim().toLowerCase();
    if (!ToneProfile.ALLOWED_TONES.includes(normalized)) {
      throw new Error(
        `Invalid tone profile: ${value}. Value must be one of the approved vocabulary tones.`,
      );
    }
    this._value = normalized;
    Object.freeze(this);
  }

  get value(): string {
    return this._value;
  }

  public equals(other: ToneProfile): boolean {
    if (!other) {
      return false;
    }
    return this._value === other.value;
  }
}

export interface ToneRequestProperties {
  sourceReference: string;
  sourceVersion: number;
  targetTone: ToneProfile;
}

export class ToneRequest {
  private readonly _sourceReference: string;
  private readonly _sourceVersion: number;
  private readonly _targetTone: ToneProfile;

  constructor(properties: ToneRequestProperties) {
    if (!properties.sourceReference || properties.sourceReference.trim() === "") {
      throw new Error("Source reference is required for ToneRequest.");
    }
    if (properties.sourceVersion <= 0) {
      throw new Error("Source version must be greater than zero.");
    }
    if (!properties.targetTone) {
      throw new Error("Target ToneProfile is required for ToneRequest.");
    }

    this._sourceReference = properties.sourceReference.trim();
    this._sourceVersion = properties.sourceVersion;
    this._targetTone = properties.targetTone;
    Object.freeze(this);
  }

  get sourceReference(): string {
    return this._sourceReference;
  }

  get sourceVersion(): number {
    return this._sourceVersion;
  }

  get targetTone(): ToneProfile {
    return this._targetTone;
  }

  public equals(other: ToneRequest): boolean {
    if (!other) {
      return false;
    }
    return (
      this._sourceReference === other.sourceReference &&
      this._sourceVersion === other.sourceVersion &&
      this._targetTone.equals(other.targetTone)
    );
  }
}

export interface ToneResultProperties {
  adjustedText: string;
  adjustedAt: Date;
}

export class ToneResult {
  private readonly _adjustedText: string;
  private readonly _adjustedAt: Date;

  constructor(properties: ToneResultProperties) {
    if (!properties.adjustedText || properties.adjustedText.trim() === "") {
      throw new Error("Adjusted reply content is required for ToneResult.");
    }
    if (!properties.adjustedAt) {
      throw new Error("Adjusted timestamp is required for ToneResult.");
    }

    this._adjustedText = properties.adjustedText.trim();
    this._adjustedAt = new Date(properties.adjustedAt.getTime());
    Object.freeze(this);
  }

  get adjustedText(): string {
    return this._adjustedText;
  }

  get adjustedAt(): Date {
    return new Date(this._adjustedAt.getTime());
  }

  public equals(other: ToneResult): boolean {
    if (!other) {
      return false;
    }
    return (
      this._adjustedText === other.adjustedText &&
      this._adjustedAt.getTime() === other.adjustedAt.getTime()
    );
  }
}

// 3. Snapshots

export interface ReplyToneAdjustmentSnapshotProperties {
  version: number;
  createdAt: Date;
  status: ReplyToneAdjustmentLifecycle;
  request: ToneRequest;
  result: ToneResult | undefined;
}

export class ReplyToneAdjustmentSnapshot {
  private readonly _version: number;
  private readonly _createdAt: Date;
  private readonly _status: ReplyToneAdjustmentLifecycle;
  private readonly _request: ToneRequest;
  private readonly _result: ToneResult | undefined;

  constructor(properties: ReplyToneAdjustmentSnapshotProperties) {
    if (properties.version <= 0) {
      throw new Error("Snapshot version must be greater than zero.");
    }
    if (!properties.createdAt) {
      throw new Error("Snapshot creation date is required.");
    }
    if (!properties.status) {
      throw new Error("Snapshot status is required.");
    }
    if (!properties.request) {
      throw new Error("Snapshot request is required.");
    }

    this._version = properties.version;
    this._createdAt = new Date(properties.createdAt.getTime());
    this._status = properties.status;
    this._request = properties.request;
    this._result = properties.result;
    Object.freeze(this);
  }

  get version(): number {
    return this._version;
  }

  get createdAt(): Date {
    return new Date(this._createdAt.getTime());
  }

  get status(): ReplyToneAdjustmentLifecycle {
    return this._status;
  }

  get request(): ToneRequest {
    return this._request;
  }

  get result(): ToneResult | undefined {
    return this._result;
  }
}

// 4. Domain Events

export const REPLY_TONE_DRAFTED = "REPLY_TONE_DRAFTED";
export const REPLY_TONE_REQUESTED = "REPLY_TONE_REQUESTED";
export const REPLY_TONE_ADJUSTED = "REPLY_TONE_ADJUSTED";
export const REPLY_TONE_ARCHIVED = "REPLY_TONE_ARCHIVED";

export type ReplyToneAdjustmentDomainEventName =
  | typeof REPLY_TONE_DRAFTED
  | typeof REPLY_TONE_REQUESTED
  | typeof REPLY_TONE_ADJUSTED
  | typeof REPLY_TONE_ARCHIVED;

export interface ReplyToneAdjustmentDomainEvent {
  readonly eventType: ReplyToneAdjustmentDomainEventName;
  readonly toneAdjustmentId: string;
  readonly sourceReference: string;
  readonly ownerId: string;
  readonly sourceVersion: number;
  readonly targetTone: string;
  readonly snapshotVersion: number;
}

// 5. Persistence Port Contracts

export interface ReplyTonePersistenceContract {
  checkUniqueReference(
    ownerId: string,
    reference: string,
    excludeAdjustmentId?: string,
  ): Promise<boolean>;
}

export interface ReplyToneAggregateStore {
  save(adjustment: ReplyToneAdjustment): Promise<void>;
  findById(id: string, ownerId: string): Promise<ReplyToneAdjustment | null>;
  findByReference(reference: string, ownerId: string): Promise<ReplyToneAdjustment | null>;
}

// 6. ReplyToneAdjustment Aggregate Root Properties

export interface ReplyToneAdjustmentProperties {
  id: string;
  sourceReference: string;
  ownerId: string;
  sourceVersion: number;
  request: ToneRequest;
  result: ToneResult | undefined;
  status: ReplyToneAdjustmentLifecycle;
  snapshots: ReplyToneAdjustmentSnapshot[];
  createdAt: Date;
  updatedAt: Date;
}

// 7. ReplyToneAdjustment Aggregate Root

export class ReplyToneAdjustment {
  private readonly _id: string;
  private readonly _sourceReference: string;
  private readonly _ownerId: string;
  private readonly _sourceVersion: number;
  private readonly _request: ToneRequest;
  private _result: ToneResult | undefined;
  private _status: ReplyToneAdjustmentLifecycle;
  private readonly _snapshots: ReplyToneAdjustmentSnapshot[] = [];
  private readonly _createdAt: Date;
  private _updatedAt: Date;
  private _domainEvents: ReplyToneAdjustmentDomainEvent[] = [];

  constructor(properties: ReplyToneAdjustmentProperties) {
    if (!properties.id || properties.id.trim() === "") {
      throw new Error("Tone Adjustment Identity is required.");
    }
    if (!properties.sourceReference || properties.sourceReference.trim() === "") {
      throw new Error("Source Reference is required.");
    }
    if (!properties.ownerId || properties.ownerId.trim() === "") {
      throw new Error("Owner Reference is required.");
    }
    if (properties.sourceVersion <= 0) {
      throw new Error("Source version must be greater than zero.");
    }
    if (!properties.request) {
      throw new Error("Tone Request is required.");
    }
    if (!properties.status) {
      throw new Error("Lifecycle status is required.");
    }
    if (!properties.createdAt) {
      throw new Error("Creation date is required.");
    }
    if (!properties.updatedAt) {
      throw new Error("Update date is required.");
    }

    this._id = properties.id;
    this._sourceReference = properties.sourceReference;
    this._ownerId = properties.ownerId;
    this._sourceVersion = properties.sourceVersion;
    this._request = properties.request;
    this._result = properties.result;
    this._status = properties.status;
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

  get sourceReference(): string {
    return this._sourceReference;
  }

  get ownerId(): string {
    return this._ownerId;
  }

  get sourceVersion(): number {
    return this._sourceVersion;
  }

  get request(): ToneRequest {
    return this._request;
  }

  get result(): ToneResult | undefined {
    return this._result;
  }

  get status(): ReplyToneAdjustmentLifecycle {
    return this._status;
  }

  get snapshots(): ReadonlyArray<ReplyToneAdjustmentSnapshot> {
    return Object.freeze([...this._snapshots]);
  }

  get createdAt(): Date {
    return new Date(this._createdAt.getTime());
  }

  get updatedAt(): Date {
    return new Date(this._updatedAt.getTime());
  }

  get domainEvents(): ReadonlyArray<ReplyToneAdjustmentDomainEvent> {
    return Object.freeze([...this._domainEvents]);
  }

  public clearDomainEvents(): void {
    this._domainEvents = [];
  }

  private addDomainEvent(event: ReplyToneAdjustmentDomainEvent): void {
    this._domainEvents.push(Object.freeze(event));
  }

  private verifyOwnership(actorOwnerId: string): void {
    if (!actorOwnerId || actorOwnerId.trim() === "") {
      throw new Error("Ownership validation failed: unauthorized owner context.");
    }
    if (actorOwnerId !== this._ownerId) {
      throw new Error("Ownership validation failed: unauthorized owner context.");
    }
  }

  private validateInvariants(): void {
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
    const newSnapshot = new ReplyToneAdjustmentSnapshot({
      version: nextVersion,
      createdAt: new Date(),
      status: this._status,
      request: this._request,
      result: this._result,
    });
    this._snapshots.push(newSnapshot);
  }

  // Factory Creation Method
  public static create(
    id: string,
    sourceReference: string,
    ownerId: string,
    sourceVersion: number,
    request: ToneRequest,
  ): ReplyToneAdjustment {
    const now = new Date();
    const adjustment = new ReplyToneAdjustment({
      id,
      sourceReference,
      ownerId,
      sourceVersion,
      request,
      result: undefined,
      status: "Draft",
      snapshots: [],
      createdAt: now,
      updatedAt: now,
    });

    adjustment.appendSnapshot();
    adjustment.addDomainEvent({
      eventType: REPLY_TONE_DRAFTED,
      toneAdjustmentId: adjustment.id,
      sourceReference: adjustment.sourceReference,
      ownerId: adjustment.ownerId,
      sourceVersion: adjustment.sourceVersion,
      targetTone: adjustment.request.targetTone.value,
      snapshotVersion: adjustment.snapshots.length,
    });

    return adjustment;
  }

  // Domain Transitions

  private transitionTo(nextStatus: ReplyToneAdjustmentLifecycle): void {
    if (this._status === "Archived") {
      throw new Error(`Invalid lifecycle transition from ARCHIVED to ${nextStatus.toUpperCase()}`);
    }

    if (nextStatus === "Requested") {
      if (this._status !== "Draft") {
        throw new Error(
          `Invalid lifecycle transition from ${this._status.toUpperCase()} to REQUESTED`,
        );
      }
    } else if (nextStatus === "Adjusted") {
      if (this._status !== "Requested") {
        throw new Error(
          `Invalid lifecycle transition from ${this._status.toUpperCase()} to ADJUSTED`,
        );
      }
    } else if (nextStatus === "Draft") {
      throw new Error(`Invalid lifecycle transition from ${this._status.toUpperCase()} to DRAFT`);
    }

    this._status = nextStatus;
    this._updatedAt = new Date();
    this.appendSnapshot();
  }

  public requestToneAdjustment(actorOwnerId: string): void {
    this.verifyOwnership(actorOwnerId);
    this.transitionTo("Requested");

    this.addDomainEvent({
      eventType: REPLY_TONE_REQUESTED,
      toneAdjustmentId: this._id,
      sourceReference: this._sourceReference,
      ownerId: this._ownerId,
      sourceVersion: this._sourceVersion,
      targetTone: this._request.targetTone.value,
      snapshotVersion: this._snapshots.length,
    });
  }

  public completeToneAdjustment(actorOwnerId: string, result: ToneResult): void {
    this.verifyOwnership(actorOwnerId);
    if (!result) {
      throw new Error("ToneResult is required for completeToneAdjustment.");
    }

    this.transitionTo("Adjusted");
    this._result = result;

    this.addDomainEvent({
      eventType: REPLY_TONE_ADJUSTED,
      toneAdjustmentId: this._id,
      sourceReference: this._sourceReference,
      ownerId: this._ownerId,
      sourceVersion: this._sourceVersion,
      targetTone: this._request.targetTone.value,
      snapshotVersion: this._snapshots.length,
    });
  }

  public archive(actorOwnerId: string): void {
    this.verifyOwnership(actorOwnerId);
    if (this._status === "Archived") {
      throw new Error("Reply tone adjustment is already archived.");
    }
    this.transitionTo("Archived");

    this.addDomainEvent({
      eventType: REPLY_TONE_ARCHIVED,
      toneAdjustmentId: this._id,
      sourceReference: this._sourceReference,
      ownerId: this._ownerId,
      sourceVersion: this._sourceVersion,
      targetTone: this._request.targetTone.value,
      snapshotVersion: this._snapshots.length,
    });
  }
}
