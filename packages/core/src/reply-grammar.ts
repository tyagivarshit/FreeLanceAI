// 1. Lifecycle State
export type ReplyGrammarCorrectionLifecycle = "Draft" | "Requested" | "Corrected" | "Archived";

// 2. Value Objects

export class GrammarProfile {
  private readonly _value: string;

  private static readonly ALLOWED_PROFILES = ["standard", "formal", "simplified"];

  constructor(value: string) {
    if (!value || value.trim() === "") {
      throw new Error("Grammar profile value is required.");
    }
    const normalized = value.trim().toLowerCase();
    if (!GrammarProfile.ALLOWED_PROFILES.includes(normalized)) {
      throw new Error(
        `Invalid grammar profile: ${value}. Value must be one of the approved vocabulary profiles.`,
      );
    }
    this._value = normalized;
    Object.freeze(this);
  }

  get value(): string {
    return this._value;
  }

  public equals(other: GrammarProfile): boolean {
    if (!other) {
      return false;
    }
    return this._value === other.value;
  }
}

export interface GrammarRequestProperties {
  sourceReference: string;
  sourceVersion: number;
  targetProfile: GrammarProfile;
}

export class GrammarRequest {
  private readonly _sourceReference: string;
  private readonly _sourceVersion: number;
  private readonly _targetProfile: GrammarProfile;

  constructor(properties: GrammarRequestProperties) {
    if (!properties.sourceReference || properties.sourceReference.trim() === "") {
      throw new Error("Source reference is required for GrammarRequest.");
    }
    if (properties.sourceVersion <= 0) {
      throw new Error("Source version must be greater than zero.");
    }
    if (!properties.targetProfile) {
      throw new Error("Target GrammarProfile is required for GrammarRequest.");
    }

    this._sourceReference = properties.sourceReference.trim();
    this._sourceVersion = properties.sourceVersion;
    this._targetProfile = properties.targetProfile;
    Object.freeze(this);
  }

  get sourceReference(): string {
    return this._sourceReference;
  }

  get sourceVersion(): number {
    return this._sourceVersion;
  }

  get targetProfile(): GrammarProfile {
    return this._targetProfile;
  }

  public equals(other: GrammarRequest): boolean {
    if (!other) {
      return false;
    }
    return (
      this._sourceReference === other.sourceReference &&
      this._sourceVersion === other.sourceVersion &&
      this._targetProfile.equals(other.targetProfile)
    );
  }
}

export interface GrammarResultProperties {
  correctedText: string;
  correctedAt: Date;
}

export class GrammarResult {
  private readonly _correctedText: string;
  private readonly _correctedAt: Date;

  constructor(properties: GrammarResultProperties) {
    if (!properties.correctedText || properties.correctedText.trim() === "") {
      throw new Error("Corrected reply content is required for GrammarResult.");
    }
    if (!properties.correctedAt) {
      throw new Error("Corrected timestamp is required for GrammarResult.");
    }

    this._correctedText = properties.correctedText.trim();
    this._correctedAt = new Date(properties.correctedAt.getTime());
    Object.freeze(this);
  }

  get correctedText(): string {
    return this._correctedText;
  }

  get correctedAt(): Date {
    return new Date(this._correctedAt.getTime());
  }

  public equals(other: GrammarResult): boolean {
    if (!other) {
      return false;
    }
    return (
      this._correctedText === other.correctedText &&
      this._correctedAt.getTime() === other.correctedAt.getTime()
    );
  }
}

// 3. Snapshots

export interface ReplyGrammarCorrectionSnapshotProperties {
  version: number;
  createdAt: Date;
  status: ReplyGrammarCorrectionLifecycle;
  request: GrammarRequest;
  result: GrammarResult | undefined;
}

export class ReplyGrammarCorrectionSnapshot {
  private readonly _version: number;
  private readonly _createdAt: Date;
  private readonly _status: ReplyGrammarCorrectionLifecycle;
  private readonly _request: GrammarRequest;
  private readonly _result: GrammarResult | undefined;

  constructor(properties: ReplyGrammarCorrectionSnapshotProperties) {
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

  get status(): ReplyGrammarCorrectionLifecycle {
    return this._status;
  }

  get request(): GrammarRequest {
    return this._request;
  }

  get result(): GrammarResult | undefined {
    return this._result;
  }
}

// 4. Domain Events

export const REPLY_GRAMMAR_DRAFTED = "REPLY_GRAMMAR_DRAFTED";
export const REPLY_GRAMMAR_REQUESTED = "REPLY_GRAMMAR_REQUESTED";
export const REPLY_GRAMMAR_CORRECTED = "REPLY_GRAMMAR_CORRECTED";
export const REPLY_GRAMMAR_ARCHIVED = "REPLY_GRAMMAR_ARCHIVED";

export type ReplyGrammarCorrectionDomainEventName =
  | typeof REPLY_GRAMMAR_DRAFTED
  | typeof REPLY_GRAMMAR_REQUESTED
  | typeof REPLY_GRAMMAR_CORRECTED
  | typeof REPLY_GRAMMAR_ARCHIVED;

export interface ReplyGrammarCorrectionDomainEvent {
  readonly eventType: ReplyGrammarCorrectionDomainEventName;
  readonly grammarCorrectionId: string;
  readonly sourceReference: string;
  readonly ownerId: string;
  readonly sourceVersion: number;
  readonly grammarProfile: string;
  readonly snapshotVersion: number;
}

// 5. Persistence Port Contracts

export interface ReplyGrammarPersistenceContract {
  checkUniqueReference(
    ownerId: string,
    reference: string,
    excludeCorrectionId?: string,
  ): Promise<boolean>;
}

export interface ReplyGrammarAggregateStore {
  save(correction: ReplyGrammarCorrection): Promise<void>;
  findById(id: string, ownerId: string): Promise<ReplyGrammarCorrection | null>;
  findByReference(reference: string, ownerId: string): Promise<ReplyGrammarCorrection | null>;
}

// 6. ReplyGrammarCorrection Aggregate Root Properties

export interface ReplyGrammarCorrectionProperties {
  id: string;
  sourceReference: string;
  ownerId: string;
  sourceVersion: number;
  request: GrammarRequest;
  result: GrammarResult | undefined;
  status: ReplyGrammarCorrectionLifecycle;
  snapshots: ReplyGrammarCorrectionSnapshot[];
  createdAt: Date;
  updatedAt: Date;
}

// 7. ReplyGrammarCorrection Aggregate Root

export class ReplyGrammarCorrection {
  private readonly _id: string;
  private readonly _sourceReference: string;
  private readonly _ownerId: string;
  private readonly _sourceVersion: number;
  private readonly _request: GrammarRequest;
  private _result: GrammarResult | undefined;
  private _status: ReplyGrammarCorrectionLifecycle;
  private readonly _snapshots: ReplyGrammarCorrectionSnapshot[] = [];
  private readonly _createdAt: Date;
  private _updatedAt: Date;
  private _domainEvents: ReplyGrammarCorrectionDomainEvent[] = [];

  constructor(properties: ReplyGrammarCorrectionProperties) {
    if (!properties.id || properties.id.trim() === "") {
      throw new Error("Grammar Correction Identity is required.");
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
      throw new Error("Grammar Request is required.");
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

  get request(): GrammarRequest {
    return this._request;
  }

  get result(): GrammarResult | undefined {
    return this._result;
  }

  get status(): ReplyGrammarCorrectionLifecycle {
    return this._status;
  }

  get snapshots(): ReadonlyArray<ReplyGrammarCorrectionSnapshot> {
    return Object.freeze([...this._snapshots]);
  }

  get createdAt(): Date {
    return new Date(this._createdAt.getTime());
  }

  get updatedAt(): Date {
    return new Date(this._updatedAt.getTime());
  }

  get domainEvents(): ReadonlyArray<ReplyGrammarCorrectionDomainEvent> {
    return Object.freeze([...this._domainEvents]);
  }

  public clearDomainEvents(): void {
    this._domainEvents = [];
  }

  private addDomainEvent(event: ReplyGrammarCorrectionDomainEvent): void {
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
    const newSnapshot = new ReplyGrammarCorrectionSnapshot({
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
    request: GrammarRequest,
  ): ReplyGrammarCorrection {
    const now = new Date();
    const correction = new ReplyGrammarCorrection({
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

    correction.appendSnapshot();
    correction.addDomainEvent({
      eventType: REPLY_GRAMMAR_DRAFTED,
      grammarCorrectionId: correction.id,
      sourceReference: correction.sourceReference,
      ownerId: correction.ownerId,
      sourceVersion: correction.sourceVersion,
      grammarProfile: correction.request.targetProfile.value,
      snapshotVersion: correction.snapshots.length,
    });

    return correction;
  }

  // Domain Transitions

  private transitionTo(nextStatus: ReplyGrammarCorrectionLifecycle): void {
    if (this._status === "Archived") {
      throw new Error(`Invalid lifecycle transition from ARCHIVED to ${nextStatus.toUpperCase()}`);
    }

    if (nextStatus === "Requested") {
      if (this._status !== "Draft") {
        throw new Error(
          `Invalid lifecycle transition from ${this._status.toUpperCase()} to REQUESTED`,
        );
      }
    } else if (nextStatus === "Corrected") {
      if (this._status !== "Requested") {
        throw new Error(
          `Invalid lifecycle transition from ${this._status.toUpperCase()} to CORRECTED`,
        );
      }
    } else if (nextStatus === "Draft") {
      throw new Error(`Invalid lifecycle transition from ${this._status.toUpperCase()} to DRAFT`);
    }

    this._status = nextStatus;
    this._updatedAt = new Date();
    this.appendSnapshot();
  }

  public requestGrammarCorrection(actorOwnerId: string): void {
    this.verifyOwnership(actorOwnerId);
    this.transitionTo("Requested");

    this.addDomainEvent({
      eventType: REPLY_GRAMMAR_REQUESTED,
      grammarCorrectionId: this._id,
      sourceReference: this._sourceReference,
      ownerId: this._ownerId,
      sourceVersion: this._sourceVersion,
      grammarProfile: this._request.targetProfile.value,
      snapshotVersion: this._snapshots.length,
    });
  }

  public completeGrammarCorrection(actorOwnerId: string, result: GrammarResult): void {
    this.verifyOwnership(actorOwnerId);
    if (!result) {
      throw new Error("GrammarResult is required for completeGrammarCorrection.");
    }

    this.transitionTo("Corrected");
    this._result = result;

    this.addDomainEvent({
      eventType: REPLY_GRAMMAR_CORRECTED,
      grammarCorrectionId: this._id,
      sourceReference: this._sourceReference,
      ownerId: this._ownerId,
      sourceVersion: this._sourceVersion,
      grammarProfile: this._request.targetProfile.value,
      snapshotVersion: this._snapshots.length,
    });
  }

  public archive(actorOwnerId: string): void {
    this.verifyOwnership(actorOwnerId);
    if (this._status === "Archived") {
      throw new Error("Reply grammar correction is already archived.");
    }
    this.transitionTo("Archived");

    this.addDomainEvent({
      eventType: REPLY_GRAMMAR_ARCHIVED,
      grammarCorrectionId: this._id,
      sourceReference: this._sourceReference,
      ownerId: this._ownerId,
      sourceVersion: this._sourceVersion,
      grammarProfile: this._request.targetProfile.value,
      snapshotVersion: this._snapshots.length,
    });
  }
}
