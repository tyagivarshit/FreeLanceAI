// Deep clone and deep freeze helper functions for payload immutability
function deepCloneAndFreeze<T>(obj: T): T {
  if (obj === null || typeof obj !== "object") {
    return obj;
  }
  const cloned = JSON.parse(JSON.stringify(obj));
  return deepFreeze(cloned);
}

function deepFreeze<T>(obj: T): T {
  if (obj === null || typeof obj !== "object") {
    return obj;
  }
  Object.freeze(obj);
  Object.keys(obj).forEach((key) => {
    const val = (obj as Record<string, unknown>)[key];
    if (val !== null && typeof val === "object" && !Object.isFrozen(val)) {
      deepFreeze(val);
    }
  });
  return obj;
}

// 1. Lifecycle State
export type JobImportLifecycle = "RECEIVED" | "IMPORTED" | "ARCHIVED";

// 2. Value Objects

export class JobSource {
  private readonly _value: string;
  private static readonly ALLOWED_SOURCES = [
    "upwork",
    "freelancer",
    "toptal",
    "linkedin",
    "indeed",
  ];

  constructor(value: string) {
    if (!value || value.trim() === "") {
      throw new Error("Job source is required and cannot be empty.");
    }
    const normalized = value.trim().toLowerCase();
    if (!JobSource.ALLOWED_SOURCES.includes(normalized)) {
      throw new Error(
        `Invalid job source: ${value}. Value must be one of the approved vocabulary sources.`,
      );
    }
    this._value = normalized;
    Object.freeze(this);
  }

  get value(): string {
    return this._value;
  }

  public equals(other: JobSource): boolean {
    if (!other) {
      return false;
    }
    return this._value === other.value;
  }
}

export class JobExternalIdentity {
  private readonly _source: JobSource;
  private readonly _externalJobId: string;

  constructor(source: JobSource, externalJobId: string) {
    if (!source) {
      throw new Error("JobSource is required for JobExternalIdentity.");
    }
    if (!externalJobId || externalJobId.trim() === "") {
      throw new Error("External Job ID is required for JobExternalIdentity.");
    }
    this._source = source;
    this._externalJobId = externalJobId.trim();
    Object.freeze(this);
  }

  get source(): JobSource {
    return this._source;
  }

  get externalJobId(): string {
    return this._externalJobId;
  }

  public equals(other: JobExternalIdentity): boolean {
    if (!other) {
      return false;
    }
    return this._source.equals(other.source) && this._externalJobId === other.externalJobId;
  }
}

export interface JobImportProvenanceProperties {
  source: JobSource;
  externalJobId: string;
  sourceUrl?: string;
  importedAt: Date;
}

export class JobImportProvenance {
  private readonly _source: JobSource;
  private readonly _externalJobId: string;
  private readonly _sourceUrl: string | undefined;
  private readonly _importedAt: Date;

  constructor(properties: JobImportProvenanceProperties) {
    if (!properties.source) {
      throw new Error("Source is required for JobImportProvenance.");
    }
    if (!properties.externalJobId || properties.externalJobId.trim() === "") {
      throw new Error("External Job ID is required for JobImportProvenance.");
    }
    if (!properties.importedAt) {
      throw new Error("Imported timestamp is required for JobImportProvenance.");
    }

    this._source = properties.source;
    this._externalJobId = properties.externalJobId.trim();
    this._sourceUrl = properties.sourceUrl ? properties.sourceUrl.trim() : undefined;
    this._importedAt = new Date(properties.importedAt.getTime());
    Object.freeze(this);
  }

  get source(): JobSource {
    return this._source;
  }

  get externalJobId(): string {
    return this._externalJobId;
  }

  get sourceUrl(): string | undefined {
    return this._sourceUrl;
  }

  get importedAt(): Date {
    return new Date(this._importedAt.getTime());
  }

  public equals(other: JobImportProvenance): boolean {
    if (!other) {
      return false;
    }
    return (
      this._source.equals(other.source) &&
      this._externalJobId === other.externalJobId &&
      this._sourceUrl === other.sourceUrl &&
      this._importedAt.getTime() === other.importedAt.getTime()
    );
  }
}

export class JobRawPayload {
  private readonly _data: Record<string, unknown>;

  constructor(data: Record<string, unknown>) {
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      throw new Error("Raw payload data must be a valid non-array object.");
    }
    this._data = deepCloneAndFreeze(data);
    Object.freeze(this);
  }

  get data(): Record<string, unknown> {
    return deepCloneAndFreeze(this._data);
  }

  public equals(other: JobRawPayload): boolean {
    if (!other) {
      return false;
    }
    return JSON.stringify(this._data) === JSON.stringify(other._data);
  }
}

export class JobImportFingerprint {
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

  public equals(other: JobImportFingerprint): boolean {
    if (!other) {
      return false;
    }
    return this._value === other.value;
  }
}

// 3. Snapshots

export interface JobImportSnapshotProperties {
  version: number;
  createdAt: Date;
  status: JobImportLifecycle;
  externalIdentity: JobExternalIdentity;
  provenance: JobImportProvenance;
  rawPayload: JobRawPayload;
  fingerprint: JobImportFingerprint;
}

export class JobImportSnapshot {
  private readonly _version: number;
  private readonly _createdAt: Date;
  private readonly _status: JobImportLifecycle;
  private readonly _externalIdentity: JobExternalIdentity;
  private readonly _provenance: JobImportProvenance;
  private readonly _rawPayload: JobRawPayload;
  private readonly _fingerprint: JobImportFingerprint;

  constructor(properties: JobImportSnapshotProperties) {
    if (properties.version <= 0) {
      throw new Error("Snapshot version must be greater than zero.");
    }
    if (!properties.createdAt) {
      throw new Error("Snapshot creation date is required.");
    }
    if (!properties.status) {
      throw new Error("Snapshot status is required.");
    }
    if (!properties.externalIdentity) {
      throw new Error("Snapshot external identity is required.");
    }
    if (!properties.provenance) {
      throw new Error("Snapshot provenance is required.");
    }
    if (!properties.rawPayload) {
      throw new Error("Snapshot raw payload is required.");
    }
    if (!properties.fingerprint) {
      throw new Error("Snapshot fingerprint is required.");
    }

    this._version = properties.version;
    this._createdAt = new Date(properties.createdAt.getTime());
    this._status = properties.status;
    this._externalIdentity = properties.externalIdentity;
    this._provenance = properties.provenance;
    this._rawPayload = properties.rawPayload;
    this._fingerprint = properties.fingerprint;
    Object.freeze(this);
  }

  get version(): number {
    return this._version;
  }

  get createdAt(): Date {
    return new Date(this._createdAt.getTime());
  }

  get status(): JobImportLifecycle {
    return this._status;
  }

  get externalIdentity(): JobExternalIdentity {
    return this._externalIdentity;
  }

  get provenance(): JobImportProvenance {
    return this._provenance;
  }

  get rawPayload(): JobRawPayload {
    return this._rawPayload;
  }

  get fingerprint(): JobImportFingerprint {
    return this._fingerprint;
  }
}

// 4. Domain Events

export const JOB_IMPORT_RECEIVED = "JOB_IMPORT_RECEIVED";
export const JOB_IMPORTED = "JOB_IMPORTED";
export const JOB_IMPORT_ARCHIVED = "JOB_IMPORT_ARCHIVED";

export type JobImportDomainEventName =
  | typeof JOB_IMPORT_RECEIVED
  | typeof JOB_IMPORTED
  | typeof JOB_IMPORT_ARCHIVED;

export interface JobImportDomainEvent {
  readonly eventType: JobImportDomainEventName;
  readonly jobImportId: string;
  readonly tenantId: string;
  readonly ownerId: string;
  readonly source: string;
  readonly externalJobId: string;
  readonly fingerprint: string;
  readonly snapshotVersion: number;
}

// 5. Persistence Port Contracts

export interface JobImportPersistenceContract {
  findByExternalIdentity(
    tenantId: string,
    source: string,
    externalJobId: string,
  ): Promise<JobImport | null>;
}

export interface JobImportAggregateStore {
  save(jobImport: JobImport): Promise<void>;
  findById(id: string, tenantId: string): Promise<JobImport | null>;
  findByExternalIdentity(
    tenantId: string,
    source: string,
    externalJobId: string,
  ): Promise<JobImport | null>;
}

// 6. JobImport Aggregate Root Properties

export interface JobImportProperties {
  id: string;
  tenantId: string;
  ownerId: string;
  externalIdentity: JobExternalIdentity;
  provenance: JobImportProvenance;
  rawPayload: JobRawPayload;
  fingerprint: JobImportFingerprint;
  status: JobImportLifecycle;
  snapshots: JobImportSnapshot[];
  createdAt: Date;
  updatedAt: Date;
}

// 7. JobImport Aggregate Root

export class JobImport {
  private readonly _id: string;
  private readonly _tenantId: string;
  private readonly _ownerId: string;
  private readonly _externalIdentity: JobExternalIdentity;
  private readonly _provenance: JobImportProvenance;
  private readonly _rawPayload: JobRawPayload;
  private readonly _fingerprint: JobImportFingerprint;
  private _status: JobImportLifecycle;
  private readonly _snapshots: JobImportSnapshot[] = [];
  private readonly _createdAt: Date;
  private _updatedAt: Date;
  private _domainEvents: JobImportDomainEvent[] = [];

  constructor(properties: JobImportProperties) {
    if (!properties.id || properties.id.trim() === "") {
      throw new Error("Job Import Identity is required.");
    }
    if (!properties.tenantId || properties.tenantId.trim() === "") {
      throw new Error("Tenant Identity is required.");
    }
    if (!properties.ownerId || properties.ownerId.trim() === "") {
      throw new Error("Owner Identity is required.");
    }
    if (!properties.externalIdentity) {
      throw new Error("External Identity is required.");
    }
    if (!properties.provenance) {
      throw new Error("Provenance is required.");
    }
    if (!properties.rawPayload) {
      throw new Error("Raw Payload is required.");
    }
    if (!properties.fingerprint) {
      throw new Error("Fingerprint is required.");
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
    this._tenantId = properties.tenantId;
    this._ownerId = properties.ownerId;
    this._externalIdentity = properties.externalIdentity;
    this._provenance = properties.provenance;
    this._rawPayload = properties.rawPayload;
    this._fingerprint = properties.fingerprint;
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

  get tenantId(): string {
    return this._tenantId;
  }

  get ownerId(): string {
    return this._ownerId;
  }

  get externalIdentity(): JobExternalIdentity {
    return this._externalIdentity;
  }

  get provenance(): JobImportProvenance {
    return this._provenance;
  }

  get rawPayload(): JobRawPayload {
    return this._rawPayload;
  }

  get fingerprint(): JobImportFingerprint {
    return this._fingerprint;
  }

  get status(): JobImportLifecycle {
    return this._status;
  }

  get snapshots(): ReadonlyArray<JobImportSnapshot> {
    return Object.freeze([...this._snapshots]);
  }

  get createdAt(): Date {
    return new Date(this._createdAt.getTime());
  }

  get updatedAt(): Date {
    return new Date(this._updatedAt.getTime());
  }

  get domainEvents(): ReadonlyArray<JobImportDomainEvent> {
    return Object.freeze([...this._domainEvents]);
  }

  public clearDomainEvents(): void {
    this._domainEvents = [];
  }

  private addDomainEvent(event: JobImportDomainEvent): void {
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
    const newSnapshot = new JobImportSnapshot({
      version: nextVersion,
      createdAt: new Date(),
      status: this._status,
      externalIdentity: this._externalIdentity,
      provenance: this._provenance,
      rawPayload: this._rawPayload,
      fingerprint: this._fingerprint,
    });
    this._snapshots.push(newSnapshot);
  }

  // Factory Creation Method
  public static create(
    id: string,
    tenantId: string,
    ownerId: string,
    externalIdentity: JobExternalIdentity,
    provenance: JobImportProvenance,
    rawPayload: JobRawPayload,
    fingerprint: JobImportFingerprint,
  ): JobImport {
    const now = new Date();
    const jobImport = new JobImport({
      id,
      tenantId,
      ownerId,
      externalIdentity,
      provenance,
      rawPayload,
      fingerprint,
      status: "RECEIVED",
      snapshots: [],
      createdAt: now,
      updatedAt: now,
    });

    jobImport.appendSnapshot();
    jobImport.addDomainEvent({
      eventType: JOB_IMPORT_RECEIVED,
      jobImportId: jobImport.id,
      tenantId: jobImport.tenantId,
      ownerId: jobImport.ownerId,
      source: jobImport.externalIdentity.source.value,
      externalJobId: jobImport.externalIdentity.externalJobId,
      fingerprint: jobImport.fingerprint.value,
      snapshotVersion: jobImport.snapshots.length,
    });

    return jobImport;
  }

  // Domain Transitions

  private transitionTo(nextStatus: JobImportLifecycle): void {
    if (this._status === "ARCHIVED") {
      throw new Error(`Invalid lifecycle transition from ARCHIVED to ${nextStatus.toUpperCase()}`);
    }

    if (nextStatus === "IMPORTED") {
      if (this._status !== "RECEIVED") {
        throw new Error(
          `Invalid lifecycle transition from ${this._status.toUpperCase()} to IMPORTED`,
        );
      }
    } else if (nextStatus === "RECEIVED") {
      throw new Error(
        `Invalid lifecycle transition from ${this._status.toUpperCase()} to RECEIVED`,
      );
    }

    this._status = nextStatus;
    this._updatedAt = new Date();
    this.appendSnapshot();
  }

  public markImported(actorOwnerId: string): void {
    this.verifyOwnership(actorOwnerId);
    this.transitionTo("IMPORTED");

    this.addDomainEvent({
      eventType: JOB_IMPORTED,
      jobImportId: this._id,
      tenantId: this._tenantId,
      ownerId: this._ownerId,
      source: this._externalIdentity.source.value,
      externalJobId: this._externalIdentity.externalJobId,
      fingerprint: this._fingerprint.value,
      snapshotVersion: this._snapshots.length,
    });
  }

  public archive(actorOwnerId: string): void {
    this.verifyOwnership(actorOwnerId);
    if (this._status === "ARCHIVED") {
      throw new Error("Job import is already archived.");
    }
    this.transitionTo("ARCHIVED");

    this.addDomainEvent({
      eventType: JOB_IMPORT_ARCHIVED,
      jobImportId: this._id,
      tenantId: this._tenantId,
      ownerId: this._ownerId,
      source: this._externalIdentity.source.value,
      externalJobId: this._externalIdentity.externalJobId,
      fingerprint: this._fingerprint.value,
      snapshotVersion: this._snapshots.length,
    });
  }
}
