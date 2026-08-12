/* eslint-disable @typescript-eslint/no-explicit-any */
export type JobMatchWorkItemStatus =
  | "QUEUED"
  | "RUNNING"
  | "RETRY_WAITING"
  | "FAILED"
  | "DEAD_LETTER"
  | "CANCELLED"
  | "CANCELLING"
  | "SUCCEEDED";

export interface JobMatchContext {
  readonly jobId: string;
  readonly freelancerId: string;
  readonly jobNormalizationId: string;
  readonly jobEmbeddingId: string;
}

export interface PolicyVersions {
  readonly weightProfileVersion?: string | undefined;
  readonly rankingPolicyVersion?: string | undefined;
  readonly explanationPolicyVersion?: string | undefined;
}

export interface ResultReferences {
  readonly jobMatchId?: string | undefined;
  readonly scoreId?: string | undefined;
  readonly rankingId?: string | undefined;
  readonly explanationId?: string | undefined;
}

export interface FailureMetadata {
  readonly category: string;
  readonly message: string;
  readonly attempt: number;
  readonly timestamp: Date;
}

export interface JobMatchWorkItemProperties {
  readonly workItemId: string;
  readonly tenantId: string;
  readonly ownerId: string;
  readonly jobMatchContext: JobMatchContext;
  readonly requestId: string; // Idempotency key
  readonly matchingVersion: string;
  readonly scoringVersion: string;
  readonly rankingVersion: string;
  readonly explanationVersion?: string | undefined;
  readonly policyVersions?: PolicyVersions | undefined;
  readonly status: JobMatchWorkItemStatus;
  readonly attempt: number;
  readonly maxAttempts: number;
  readonly leaseId?: string | undefined;
  readonly fencingToken: number;
  readonly workerId?: string | undefined;
  readonly leasedUntil?: Date | undefined;
  readonly resultReferences?: ResultReferences | undefined;
  readonly failureMetadata?: FailureMetadata | undefined;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

// ------------------------------------------------------------
// Domain Events
// ------------------------------------------------------------

export interface JobMatchWorkItemDomainEvent {
  readonly eventId: string;
  readonly eventType: string;
  readonly workItemId: string;
  readonly tenantId: string;
  readonly timestamp: Date;
  readonly payload: Record<string, any>;
}

// ------------------------------------------------------------
// Snapshot
// ------------------------------------------------------------

export class JobMatchWorkItemSnapshot {
  public readonly version: number;
  public readonly createdAt: Date;
  public readonly properties: Omit<JobMatchWorkItemProperties, "createdAt" | "updatedAt">;

  constructor(
    version: number,
    properties: Omit<JobMatchWorkItemProperties, "createdAt" | "updatedAt">,
  ) {
    if (version <= 0) {
      throw new Error("Snapshot version must be greater than zero.");
    }
    this.version = version;
    this.createdAt = new Date();
    this.properties = {
      ...properties,
      leasedUntil: properties.leasedUntil ? new Date(properties.leasedUntil.getTime()) : undefined,
      failureMetadata: properties.failureMetadata
        ? {
            ...properties.failureMetadata,
            timestamp: new Date(properties.failureMetadata.timestamp.getTime()),
          }
        : undefined,
    };
    Object.freeze(this);
  }
}

// ------------------------------------------------------------
// Aggregate Root
// ------------------------------------------------------------

export class JobMatchWorkItem {
  private readonly _workItemId: string;
  private readonly _tenantId: string;
  private readonly _ownerId: string;
  private readonly _jobMatchContext: JobMatchContext;
  private readonly _requestId: string;
  private readonly _matchingVersion: string;
  private readonly _scoringVersion: string;
  private readonly _rankingVersion: string;
  private readonly _explanationVersion: string | undefined;
  private readonly _policyVersions: PolicyVersions;
  private _status: JobMatchWorkItemStatus;
  private _attempt: number;
  private readonly _maxAttempts: number;
  private _leaseId: string | undefined;
  private _fencingToken: number;
  private _workerId: string | undefined;
  private _leasedUntil: Date | undefined;
  private _resultReferences: ResultReferences;
  private _failureMetadata: FailureMetadata | undefined;
  private readonly _createdAt: Date;
  private _updatedAt: Date;

  private _domainEvents: JobMatchWorkItemDomainEvent[] = [];
  private readonly _snapshots: JobMatchWorkItemSnapshot[] = [];

  constructor(properties: JobMatchWorkItemProperties) {
    if (!properties.workItemId || properties.workItemId.trim() === "") {
      throw new Error("Work Item ID is required.");
    }
    if (!properties.tenantId || properties.tenantId.trim() === "") {
      throw new Error("Tenant ID is required.");
    }
    if (!properties.ownerId || properties.ownerId.trim() === "") {
      throw new Error("Owner ID is required.");
    }
    if (!properties.requestId || properties.requestId.trim() === "") {
      throw new Error("Request ID/Idempotency key is required.");
    }
    if (!properties.jobMatchContext) {
      throw new Error("JobMatch context is required.");
    }
    if (!properties.jobMatchContext.jobId || properties.jobMatchContext.jobId.trim() === "") {
      throw new Error("Job ID is required in JobMatch context.");
    }
    if (
      !properties.jobMatchContext.freelancerId ||
      properties.jobMatchContext.freelancerId.trim() === ""
    ) {
      throw new Error("Freelancer ID is required in JobMatch context.");
    }
    if (
      !properties.jobMatchContext.jobNormalizationId ||
      properties.jobMatchContext.jobNormalizationId.trim() === ""
    ) {
      throw new Error("Job Normalization ID is required in JobMatch context.");
    }
    if (
      !properties.jobMatchContext.jobEmbeddingId ||
      properties.jobMatchContext.jobEmbeddingId.trim() === ""
    ) {
      throw new Error("Job Embedding ID is required in JobMatch context.");
    }
    if (!properties.matchingVersion || properties.matchingVersion.trim() === "") {
      throw new Error("Matching Version is required.");
    }
    if (!properties.scoringVersion || properties.scoringVersion.trim() === "") {
      throw new Error("Scoring Version is required.");
    }
    if (!properties.rankingVersion || properties.rankingVersion.trim() === "") {
      throw new Error("Ranking Version is required.");
    }
    if (properties.maxAttempts <= 0) {
      throw new Error("Max Attempts must be greater than zero.");
    }
    if (properties.attempt < 0) {
      throw new Error("Attempt count cannot be negative.");
    }
    if (!properties.status) {
      throw new Error("Status is required.");
    }

    const versionPattern = /^v\d+$/;
    if (!versionPattern.test(properties.matchingVersion.trim())) {
      throw new Error(`Invalid matching version format: ${properties.matchingVersion}.`);
    }
    if (!versionPattern.test(properties.scoringVersion.trim())) {
      throw new Error(`Invalid scoring version format: ${properties.scoringVersion}.`);
    }
    if (!versionPattern.test(properties.rankingVersion.trim())) {
      throw new Error(`Invalid ranking version format: ${properties.rankingVersion}.`);
    }
    if (
      properties.explanationVersion &&
      !versionPattern.test(properties.explanationVersion.trim())
    ) {
      throw new Error(`Invalid explanation version format: ${properties.explanationVersion}.`);
    }

    this._workItemId = properties.workItemId;
    this._tenantId = properties.tenantId;
    this._ownerId = properties.ownerId;
    this._jobMatchContext = properties.jobMatchContext;
    this._requestId = properties.requestId;
    this._matchingVersion = properties.matchingVersion.trim();
    this._scoringVersion = properties.scoringVersion.trim();
    this._rankingVersion = properties.rankingVersion.trim();
    this._explanationVersion = properties.explanationVersion?.trim();
    this._policyVersions = properties.policyVersions || {};
    this._status = properties.status;
    this._attempt = properties.attempt;
    this._maxAttempts = properties.maxAttempts;
    this._leaseId = properties.leaseId;
    this._fencingToken = properties.fencingToken;
    this._workerId = properties.workerId;
    this._leasedUntil = properties.leasedUntil
      ? new Date(properties.leasedUntil.getTime())
      : undefined;
    this._resultReferences = properties.resultReferences || {};
    this._failureMetadata = properties.failureMetadata
      ? {
          ...properties.failureMetadata,
          timestamp: new Date(properties.failureMetadata.timestamp.getTime()),
        }
      : undefined;
    this._createdAt = new Date(properties.createdAt.getTime());
    this._updatedAt = new Date(properties.updatedAt.getTime());

    this.validateInvariants();
  }

  // ------------------------------------------------------------
  // Static Factory
  // ------------------------------------------------------------

  public static create(
    properties: Omit<
      JobMatchWorkItemProperties,
      "status" | "attempt" | "fencingToken" | "createdAt" | "updatedAt"
    >,
  ): JobMatchWorkItem {
    const now = new Date();
    const workItem = new JobMatchWorkItem({
      ...properties,
      status: "QUEUED",
      attempt: 0,
      fencingToken: 0,
      createdAt: now,
      updatedAt: now,
    });

    workItem.addDomainEvent("JOB_MATCH_WORK_ITEM_QUEUED", {
      workItemId: workItem.workItemId,
      tenantId: workItem.tenantId,
      requestId: workItem.requestId,
    });

    workItem.appendSnapshot();
    return workItem;
  }

  // ------------------------------------------------------------
  // Getters
  // ------------------------------------------------------------

  get workItemId(): string {
    return this._workItemId;
  }
  get tenantId(): string {
    return this._tenantId;
  }
  get ownerId(): string {
    return this._ownerId;
  }
  get jobMatchContext(): JobMatchContext {
    return this._jobMatchContext;
  }
  get requestId(): string {
    return this._requestId;
  }
  get matchingVersion(): string {
    return this._matchingVersion;
  }
  get scoringVersion(): string {
    return this._scoringVersion;
  }
  get rankingVersion(): string {
    return this._rankingVersion;
  }
  get explanationVersion(): string | undefined {
    return this._explanationVersion;
  }
  get policyVersions(): PolicyVersions {
    return this._policyVersions;
  }
  get status(): JobMatchWorkItemStatus {
    return this._status;
  }
  get attempt(): number {
    return this._attempt;
  }
  get maxAttempts(): number {
    return this._maxAttempts;
  }
  get leaseId(): string | undefined {
    return this._leaseId;
  }
  get fencingToken(): number {
    return this._fencingToken;
  }
  get workerId(): string | undefined {
    return this._workerId;
  }
  get leasedUntil(): Date | undefined {
    return this._leasedUntil;
  }
  get resultReferences(): ResultReferences {
    return this._resultReferences;
  }
  get failureMetadata(): FailureMetadata | undefined {
    return this._failureMetadata;
  }
  get createdAt(): Date {
    return new Date(this._createdAt.getTime());
  }
  get updatedAt(): Date {
    return new Date(this._updatedAt.getTime());
  }
  get domainEvents(): ReadonlyArray<JobMatchWorkItemDomainEvent> {
    return Object.freeze([...this._domainEvents]);
  }
  get snapshots(): ReadonlyArray<JobMatchWorkItemSnapshot> {
    return Object.freeze([...this._snapshots]);
  }

  public clearDomainEvents(): void {
    this._domainEvents = [];
  }

  // ------------------------------------------------------------
  // State Mutations
  // ------------------------------------------------------------

  public claim(workerId: string, leaseDurationMs: number): void {
    if (!workerId || workerId.trim() === "") {
      throw new Error("Worker ID is required to claim work.");
    }
    if (leaseDurationMs <= 0) {
      throw new Error("Lease duration must be positive.");
    }

    const isQueued = this._status === "QUEUED";
    const isLeaseExpired =
      this._status === "RUNNING" &&
      this._leasedUntil &&
      new Date().getTime() > this._leasedUntil.getTime();

    if (!isQueued && !isLeaseExpired) {
      throw new Error(`Cannot claim job match work item in state: ${this._status}`);
    }

    this._status = "RUNNING";
    this._attempt += 1;
    this._workerId = workerId;
    this._leaseId = this.generateId(); // Simple unique lease identifier
    this._leasedUntil = new Date(Date.now() + leaseDurationMs);
    this._fencingToken += 1;
    this._updatedAt = new Date();

    this.addDomainEvent("JOB_MATCH_WORK_ITEM_STARTED", {
      workItemId: this._workItemId,
      workerId: this._workerId,
      leaseId: this._leaseId,
      fencingToken: this._fencingToken,
      attempt: this._attempt,
    });

    this.appendSnapshot();
  }

  public heartbeat(
    workerId: string,
    leaseId: string,
    fencingToken: number,
    leaseDurationMs: number,
  ): void {
    this.verifyWorkerSession(workerId, leaseId, fencingToken);

    if (this._status !== "RUNNING") {
      throw new Error(`Cannot renew lease for work item in state: ${this._status}`);
    }
    if (leaseDurationMs <= 0) {
      throw new Error("Lease duration must be positive.");
    }

    this._leasedUntil = new Date(Date.now() + leaseDurationMs);
    this._updatedAt = new Date();

    this.addDomainEvent("JOB_MATCH_WORK_ITEM_HEARTBEAT", {
      workItemId: this._workItemId,
      workerId: this._workerId,
      leaseId: this._leaseId,
      fencingToken: this._fencingToken,
      leasedUntil: this._leasedUntil,
    });
  }

  public complete(
    workerId: string,
    leaseId: string,
    fencingToken: number,
    resultReferences: ResultReferences,
  ): void {
    this.verifyWorkerSession(workerId, leaseId, fencingToken);

    if (this._status !== "RUNNING" && this._status !== "CANCELLING") {
      throw new Error(`Cannot complete work item in state: ${this._status}`);
    }

    this._status = "SUCCEEDED";
    this._resultReferences = resultReferences;
    this._leaseId = undefined;
    this._workerId = undefined;
    this._leasedUntil = undefined;
    this._updatedAt = new Date();

    this.addDomainEvent("JOB_MATCH_WORK_ITEM_SUCCEEDED", {
      workItemId: this._workItemId,
      resultReferences: this._resultReferences,
    });

    this.appendSnapshot();
  }

  public fail(
    workerId: string,
    leaseId: string,
    fencingToken: number,
    failure: Omit<FailureMetadata, "attempt" | "timestamp">,
    isTransient: boolean = true,
  ): void {
    this.verifyWorkerSession(workerId, leaseId, fencingToken);

    if (this._status !== "RUNNING") {
      throw new Error(`Cannot fail work item in state: ${this._status}`);
    }

    this._failureMetadata = {
      category: failure.category,
      message: this.sanitizeErrorMessage(failure.message),
      attempt: this._attempt,
      timestamp: new Date(),
    };

    if (isTransient && this._attempt < this._maxAttempts) {
      this._status = "RETRY_WAITING";
      this._leaseId = undefined;
      this._workerId = undefined;
      this._leasedUntil = undefined;
      this._updatedAt = new Date();

      this.addDomainEvent("JOB_MATCH_WORK_ITEM_RETRY_SCHEDULED", {
        workItemId: this._workItemId,
        attempt: this._attempt,
        failureMetadata: this._failureMetadata,
      });
    } else {
      this._status = "FAILED";
      this._leaseId = undefined;
      this._workerId = undefined;
      this._leasedUntil = undefined;
      this._updatedAt = new Date();

      this.addDomainEvent("JOB_MATCH_WORK_ITEM_FAILED", {
        workItemId: this._workItemId,
        failureMetadata: this._failureMetadata,
      });
    }

    this.appendSnapshot();
  }

  public deadLetter(): void {
    if (this._status !== "FAILED") {
      throw new Error(`Cannot transition to DEAD_LETTER from state: ${this._status}`);
    }

    this._status = "DEAD_LETTER";
    this._updatedAt = new Date();

    this.addDomainEvent("JOB_MATCH_WORK_ITEM_DEAD_LETTERED", {
      workItemId: this._workItemId,
      failureMetadata: this._failureMetadata,
    });

    this.appendSnapshot();
  }

  public cancel(actorOwnerId: string): void {
    this.verifyOwnership(actorOwnerId);

    if (this._status === "CANCELLED" || this._status === "CANCELLING") {
      return; // Idempotent
    }

    if (
      this._status === "SUCCEEDED" ||
      this._status === "FAILED" ||
      this._status === "DEAD_LETTER"
    ) {
      throw new Error(`Cannot cancel work item in terminal state: ${this._status}`);
    }

    if (this._status === "RUNNING") {
      this._status = "CANCELLING";
      this._updatedAt = new Date();
      this.addDomainEvent("JOB_MATCH_WORK_ITEM_CANCELLING", {
        workItemId: this._workItemId,
      });
    } else {
      this._status = "CANCELLED";
      this._leaseId = undefined;
      this._workerId = undefined;
      this._leasedUntil = undefined;
      this._updatedAt = new Date();
      this.addDomainEvent("JOB_MATCH_WORK_ITEM_CANCELLED", {
        workItemId: this._workItemId,
      });
    }

    this.appendSnapshot();
  }

  public confirmCancellationByWorker(
    workerId: string,
    leaseId: string,
    fencingToken: number,
  ): void {
    this.verifyWorkerSession(workerId, leaseId, fencingToken);

    if (this._status !== "CANCELLING") {
      throw new Error(`Cannot confirm worker cancellation in state: ${this._status}`);
    }

    this._status = "CANCELLED";
    this._leaseId = undefined;
    this._workerId = undefined;
    this._leasedUntil = undefined;
    this._updatedAt = new Date();

    this.addDomainEvent("JOB_MATCH_WORK_ITEM_CANCELLED", {
      workItemId: this._workItemId,
    });

    this.appendSnapshot();
  }

  public requeueAfterRetryWaiting(): void {
    if (this._status !== "RETRY_WAITING") {
      throw new Error(`Cannot requeue work item in state: ${this._status}`);
    }

    this._status = "QUEUED";
    this._updatedAt = new Date();

    this.addDomainEvent("JOB_MATCH_WORK_ITEM_QUEUED", {
      workItemId: this._workItemId,
      tenantId: this._tenantId,
      requestId: this._requestId,
    });

    this.appendSnapshot();
  }

  public replay(actorOwnerId: string): void {
    this.verifyOwnership(actorOwnerId);

    if (this._status !== "DEAD_LETTER") {
      throw new Error(`Cannot replay work item in state: ${this._status}`);
    }

    this._status = "QUEUED";
    this._attempt = 0;
    this._leaseId = undefined;
    this._workerId = undefined;
    this._leasedUntil = undefined;
    this._failureMetadata = undefined;
    this._updatedAt = new Date();

    this.addDomainEvent("JOB_MATCH_WORK_ITEM_QUEUED", {
      workItemId: this._workItemId,
      tenantId: this._tenantId,
      requestId: this._requestId,
      isReplay: true,
    });

    this.appendSnapshot();
  }

  // ------------------------------------------------------------
  // Helper / Utility Methods
  // ------------------------------------------------------------

  private verifyWorkerSession(workerId: string, leaseId: string, fencingToken: number): void {
    if (!workerId || workerId.trim() === "") {
      throw new Error("Worker ID is required.");
    }
    if (!leaseId || leaseId.trim() === "") {
      throw new Error("Lease ID is required.");
    }

    if (this._workerId !== workerId) {
      throw new Error("Lease validation failed: worker ID mismatch.");
    }
    if (this._leaseId !== leaseId) {
      throw new Error("Lease validation failed: lease ID mismatch.");
    }
    if (this._fencingToken !== fencingToken) {
      throw new Error("Fencing token validation failed: stale fencing token.");
    }
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
    if (this._attempt > this._maxAttempts) {
      throw new Error(
        `Execution attempts (${this._attempt}) cannot exceed maximum allowed attempts (${this._maxAttempts}).`,
      );
    }

    if (this._status === "RUNNING") {
      if (!this._workerId || this._workerId.trim() === "") {
        throw new Error("Running work item must have a worker ID.");
      }
      if (!this._leaseId || this._leaseId.trim() === "") {
        throw new Error("Running work item must have a lease ID.");
      }
      if (!this._leasedUntil) {
        throw new Error("Running work item must have a lease expiration date.");
      }
    }
  }

  private appendSnapshot(): void {
    const nextVersion = this._snapshots.length + 1;
    const snap = new JobMatchWorkItemSnapshot(nextVersion, {
      workItemId: this._workItemId,
      tenantId: this._tenantId,
      ownerId: this._ownerId,
      jobMatchContext: this._jobMatchContext,
      requestId: this._requestId,
      matchingVersion: this._matchingVersion,
      scoringVersion: this._scoringVersion,
      rankingVersion: this._rankingVersion,
      explanationVersion: this._explanationVersion,
      policyVersions: this._policyVersions,
      status: this._status,
      attempt: this._attempt,
      maxAttempts: this._maxAttempts,
      leaseId: this._leaseId,
      fencingToken: this._fencingToken,
      workerId: this._workerId,
      leasedUntil: this._leasedUntil,
      resultReferences: this._resultReferences,
      failureMetadata: this._failureMetadata,
    });
    this._snapshots.push(snap);
  }

  private addDomainEvent(eventType: string, payload: Record<string, any>): void {
    this._domainEvents.push(
      Object.freeze({
        eventId: this.generateId(),
        eventType,
        workItemId: this._workItemId,
        tenantId: this._tenantId,
        timestamp: new Date(),
        payload: { ...payload },
      }),
    );
  }

  private generateId(): string {
    return (
      Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
    );
  }

  private sanitizeErrorMessage(msg: string): string {
    if (!msg) {
      return "";
    }
    // Regex matches passwords, credentials, tokens, apikeys, secrets
    let sanitized = msg;
    const secretKeywords = [
      /password/gi,
      /apikey/gi,
      /api_key/gi,
      /token/gi,
      /secret/gi,
      /credential/gi,
      /private_key/gi,
      /bearer/gi,
    ];
    for (const kw of secretKeywords) {
      if (kw.test(sanitized)) {
        // Sanitize string matching sensitive keys
        sanitized = sanitized.replace(
          /([a-zA-Z0-9_-]*(?:password|apikey|api_key|token|secret|credential|private_key|bearer)[a-zA-Z0-9_-]*\s*[:=]\s*)[^\s,;}]+/gi,
          "$1[REDACTED]",
        );
      }
    }
    return sanitized;
  }
}

// ------------------------------------------------------------
// Persistence Contract
// ------------------------------------------------------------

export interface JobMatchWorkItemStore {
  findById(workItemId: string, tenantId: string): Promise<JobMatchWorkItem | null>;
  findByIdempotencyKey(tenantId: string, idempotencyKey: string): Promise<JobMatchWorkItem | null>;
  save(workItem: JobMatchWorkItem): Promise<void>;
  claim(
    workItemId: string,
    tenantId: string,
    workerId: string,
    leaseDurationMs: number,
  ): Promise<JobMatchWorkItem | null>;
  heartbeat(
    workItemId: string,
    tenantId: string,
    workerId: string,
    leaseId: string,
    fencingToken: number,
    leaseDurationMs: number,
  ): Promise<void>;
  complete(
    workItemId: string,
    tenantId: string,
    workerId: string,
    leaseId: string,
    fencingToken: number,
    resultReferences: ResultReferences,
  ): Promise<void>;
  fail(
    workItemId: string,
    tenantId: string,
    workerId: string,
    leaseId: string,
    fencingToken: number,
    failure: Omit<FailureMetadata, "attempt" | "timestamp">,
    maxAttempts: number,
    isTransient?: boolean,
  ): Promise<void>;
  cancel(workItemId: string, tenantId: string, actorOwnerId: string): Promise<void>;
  deadLetter(workItemId: string, tenantId: string): Promise<void>;
}
