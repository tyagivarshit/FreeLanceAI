export type JobMatchLifecycle = "CREATED" | "EVALUATED" | "ARCHIVED";

// ==========================================
// 1. VALUE OBJECTS & HELPER TYPES
// ==========================================

export interface MatchSignals {
  readonly semanticSimilarity?: number | undefined;
  readonly matchedSkills: string[];
  readonly missingSkills: string[];
  readonly skillCoverage: number;
  readonly experienceCompatibility: "COMPATIBLE" | "PARTIAL" | "INCOMPATIBLE" | "UNKNOWN";
  readonly budgetCompatibility: "COMPATIBLE" | "PARTIAL" | "INCOMPATIBLE" | "UNKNOWN";
  readonly jobTypeCompatibility: "COMPATIBLE" | "INCOMPATIBLE" | "UNKNOWN";
  readonly locationCompatibility: "COMPATIBLE" | "PARTIAL" | "INCOMPATIBLE" | "UNKNOWN";
}

export function freezeMatchSignals(signals: MatchSignals): MatchSignals {
  Object.freeze(signals.matchedSkills);
  Object.freeze(signals.missingSkills);
  Object.freeze(signals);
  return signals;
}

// Small tech-neutral Freelancer Input representation
export interface FreelancerMatchingProfile {
  readonly freelancerId: string;
  readonly tenantId: string;
  readonly skills: string[];
  readonly experience?: string | undefined;
  readonly budget?:
    | {
        readonly type: "fixed" | "hourly" | "unknown";
        readonly rate: number;
        readonly currency: string;
      }
    | undefined;
  readonly preferredJobTypes?: string[] | undefined;
  readonly location?:
    | {
        readonly country?: string | undefined;
        readonly timezone?: string | undefined;
      }
    | undefined;
  readonly embeddingVector?: number[] | undefined;
}

export interface JobNormalizationInput {
  readonly id: string;
  readonly tenantId: string;
  readonly canonicalJob: {
    readonly title: string;
    readonly description: string;
    readonly skills: readonly string[];
    readonly budget?:
      | {
          readonly type: "fixed" | "hourly" | "unknown";
          readonly minimum?: number | undefined;
          readonly maximum?: number | undefined;
          readonly currency?: string | undefined;
        }
      | undefined;
    readonly experience?: string | undefined;
    readonly category?: string | undefined;
    readonly jobType?: string | undefined;
    readonly location?:
      | {
          readonly mode?: string | undefined;
          readonly country?: string | undefined;
          readonly region?: string | undefined;
          readonly timezone?: string | undefined;
        }
      | undefined;
    readonly duration?: string | undefined;
  };
}

export interface JobEmbeddingInput {
  readonly id: string;
  readonly tenantId: string;
  readonly vector: readonly number[];
  readonly dimensions: number;
}

export interface MatchingInputs {
  readonly freelancerProfile: FreelancerMatchingProfile;
  readonly jobNormalization: JobNormalizationInput;
  readonly jobEmbedding?: JobEmbeddingInput | undefined;
}

// Semantic Cosine Similarity Calculation
export function calculateCosineSimilarity(a: readonly number[], b: readonly number[]): number {
  if (a.length !== b.length) {
    throw new Error("Vector dimension mismatch for semantic matching.");
  }
  if (a.length === 0) {
    throw new Error("Vectors must be non-empty.");
  }
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    const valA = a[i];
    const valB = b[i];
    if (
      typeof valA !== "number" ||
      typeof valB !== "number" ||
      !Number.isFinite(valA) ||
      !Number.isFinite(valB) ||
      Number.isNaN(valA) ||
      Number.isNaN(valB)
    ) {
      throw new Error("Vector elements must be finite numbers.");
    }
    dotProduct += valA * valB;
    normA += valA * valA;
    normB += valB * valB;
  }
  if (normA === 0 || normB === 0) {
    return 0;
  }
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// Experience Compatibility Rules
export function matchExperience(
  jobExp?: string | undefined,
  freelancerExp?: string | undefined,
): "COMPATIBLE" | "PARTIAL" | "INCOMPATIBLE" | "UNKNOWN" {
  if (!jobExp || !freelancerExp) {
    return "UNKNOWN";
  }
  const j = jobExp.trim().toLowerCase();
  const f = freelancerExp.trim().toLowerCase();
  if (j === f) {
    return "COMPATIBLE";
  }

  const getLevel = (val: string): number => {
    if (val.includes("expert") || val.includes("senior") || val.includes("lead")) {
      return 3;
    }
    if (val.includes("intermediate") || val.includes("mid")) {
      return 2;
    }
    if (val.includes("entry") || val.includes("junior")) {
      return 1;
    }
    return 0;
  };
  const levelJ = getLevel(j);
  const levelF = getLevel(f);
  if (levelJ === 0 || levelF === 0) {
    return "UNKNOWN";
  }
  if (levelF >= levelJ) {
    return "COMPATIBLE";
  }
  if (levelF === levelJ - 1) {
    return "PARTIAL";
  }
  return "INCOMPATIBLE";
}

// Budget Compatibility Rules
export function matchBudget(
  jobBudget?:
    | {
        type: string;
        minimum?: number | undefined;
        maximum?: number | undefined;
        currency?: string | undefined;
      }
    | undefined,
  freelancerBudget?: { type: string; rate: number; currency: string } | undefined,
): "COMPATIBLE" | "PARTIAL" | "INCOMPATIBLE" | "UNKNOWN" {
  if (
    !jobBudget ||
    !freelancerBudget ||
    jobBudget.type === "unknown" ||
    freelancerBudget.type === "unknown"
  ) {
    return "UNKNOWN";
  }
  if (
    jobBudget.currency &&
    freelancerBudget.currency &&
    jobBudget.currency.toUpperCase() !== freelancerBudget.currency.toUpperCase()
  ) {
    return "INCOMPATIBLE";
  }
  if (jobBudget.type !== freelancerBudget.type) {
    return "INCOMPATIBLE";
  }
  const maxLimit = jobBudget.maximum ?? jobBudget.minimum;
  if (maxLimit === undefined) {
    return "UNKNOWN";
  }
  if (freelancerBudget.rate <= maxLimit) {
    return "COMPATIBLE";
  }
  return "INCOMPATIBLE";
}

// Job Type Compatibility Rules
export function matchJobType(
  jobType?: string | undefined,
  preferredJobTypes?: string[] | undefined,
): "COMPATIBLE" | "INCOMPATIBLE" | "UNKNOWN" {
  if (!jobType || !preferredJobTypes || preferredJobTypes.length === 0) {
    return "UNKNOWN";
  }
  const jt = jobType.trim().toLowerCase();
  const preferred = preferredJobTypes.map((t) => t.trim().toLowerCase());
  return preferred.includes(jt) ? "COMPATIBLE" : "INCOMPATIBLE";
}

// Location Compatibility Rules
export function matchLocation(
  jobLocation?: { mode?: string | undefined; country?: string | undefined } | undefined,
  freelancerLocation?: { country?: string | undefined } | undefined,
): "COMPATIBLE" | "PARTIAL" | "INCOMPATIBLE" | "UNKNOWN" {
  if (!jobLocation || !freelancerLocation) {
    return "UNKNOWN";
  }
  const jCountry = jobLocation.country?.trim().toLowerCase();
  const fCountry = freelancerLocation.country?.trim().toLowerCase();
  if (!jCountry || !fCountry) {
    return "UNKNOWN";
  }
  if (jCountry === fCountry) {
    return "COMPATIBLE";
  }
  if (jobLocation.mode?.trim().toLowerCase() === "remote") {
    return "PARTIAL";
  }
  return "INCOMPATIBLE";
}

// ==========================================
// 2. SNAPSHOTS
// ==========================================

export interface JobMatchSnapshotProperties {
  version: number;
  createdAt: Date;
  status: JobMatchLifecycle;
  freelancerId: string;
  jobId: string;
  jobNormalizationId: string;
  normalizationVersion: string;
  jobEmbeddingId?: string | undefined;
  embeddingVersion?: string | undefined;
  matchingVersion: string;
  matchSignals?: MatchSignals | undefined;
}

export class JobMatchSnapshot {
  private readonly _version: number;
  private readonly _createdAt: Date;
  private readonly _status: JobMatchLifecycle;
  private readonly _freelancerId: string;
  private readonly _jobId: string;
  private readonly _jobNormalizationId: string;
  private readonly _normalizationVersion: string;
  private readonly _jobEmbeddingId: string | undefined;
  private readonly _embeddingVersion: string | undefined;
  private readonly _matchingVersion: string;
  private readonly _matchSignals: MatchSignals | undefined;

  constructor(properties: JobMatchSnapshotProperties) {
    if (properties.version <= 0) {
      throw new Error("Snapshot version must be greater than zero.");
    }
    if (!properties.createdAt) {
      throw new Error("Snapshot creation date is required.");
    }
    if (!properties.status) {
      throw new Error("Snapshot status is required.");
    }
    if (!properties.freelancerId || properties.freelancerId.trim() === "") {
      throw new Error("Snapshot freelancerId is required.");
    }
    if (!properties.jobId || properties.jobId.trim() === "") {
      throw new Error("Snapshot jobId is required.");
    }
    if (!properties.jobNormalizationId || properties.jobNormalizationId.trim() === "") {
      throw new Error("Snapshot jobNormalizationId is required.");
    }
    if (!properties.normalizationVersion || properties.normalizationVersion.trim() === "") {
      throw new Error("Snapshot normalizationVersion is required.");
    }
    if (!properties.matchingVersion || properties.matchingVersion.trim() === "") {
      throw new Error("Snapshot matchingVersion is required.");
    }

    this._version = properties.version;
    this._createdAt = new Date(properties.createdAt.getTime());
    this._status = properties.status;
    this._freelancerId = properties.freelancerId;
    this._jobId = properties.jobId;
    this._jobNormalizationId = properties.jobNormalizationId;
    this._normalizationVersion = properties.normalizationVersion;
    this._jobEmbeddingId = properties.jobEmbeddingId;
    this._embeddingVersion = properties.embeddingVersion;
    this._matchingVersion = properties.matchingVersion;
    if (properties.matchSignals) {
      this._matchSignals = freezeMatchSignals(properties.matchSignals);
    } else {
      this._matchSignals = undefined;
    }
    Object.freeze(this);
  }

  get version(): number {
    return this._version;
  }

  get createdAt(): Date {
    return new Date(this._createdAt.getTime());
  }

  get status(): JobMatchLifecycle {
    return this._status;
  }

  get freelancerId(): string {
    return this._freelancerId;
  }

  get jobId(): string {
    return this._jobId;
  }

  get jobNormalizationId(): string {
    return this._jobNormalizationId;
  }

  get normalizationVersion(): string {
    return this._normalizationVersion;
  }

  get jobEmbeddingId(): string | undefined {
    return this._jobEmbeddingId;
  }

  get embeddingVersion(): string | undefined {
    return this._embeddingVersion;
  }

  get matchingVersion(): string {
    return this._matchingVersion;
  }

  get matchSignals(): MatchSignals | undefined {
    return this._matchSignals;
  }
}

// ==========================================
// 3. DOMAIN EVENTS
// ==========================================

export const JOB_MATCH_CREATED = "JOB_MATCH_CREATED";
export const JOB_MATCH_EVALUATED = "JOB_MATCH_EVALUATED";
export const JOB_MATCH_ARCHIVED = "JOB_MATCH_ARCHIVED";

export type JobMatchDomainEventName =
  | typeof JOB_MATCH_CREATED
  | typeof JOB_MATCH_EVALUATED
  | typeof JOB_MATCH_ARCHIVED;

export interface JobMatchDomainEvent {
  readonly eventType: JobMatchDomainEventName;
  readonly matchId: string;
  readonly tenantId: string;
  readonly ownerId: string;
  readonly freelancerId: string;
  readonly jobId: string;
  readonly normalizationVersion: string;
  readonly embeddingVersion?: string | undefined;
  readonly matchingVersion: string;
  readonly snapshotVersion: number;
}

// ==========================================
// 4. PERSISTENCE CONTRACTS
// ==========================================

export interface JobMatchPersistenceContract {
  findByMatchingIdentity(
    tenantId: string,
    freelancerId: string,
    jobId: string,
    matchingVersion: string,
  ): Promise<JobMatch | null>;
}

export interface JobMatchAggregateStore {
  save(match: JobMatch): Promise<void>;
  findById(id: string, tenantId: string): Promise<JobMatch | null>;
  findByMatchingIdentity(
    tenantId: string,
    freelancerId: string,
    jobId: string,
    matchingVersion: string,
  ): Promise<JobMatch | null>;
}

// ==========================================
// 5. AGGREGATE ROOT PROPERTIES
// ==========================================

export interface JobMatchProperties {
  id: string;
  tenantId: string;
  ownerId: string;
  freelancerId: string;
  jobId: string;
  jobNormalizationId: string;
  normalizationVersion: string;
  jobEmbeddingId?: string | undefined;
  embeddingVersion?: string | undefined;
  matchingVersion: string;
  matchSignals?: MatchSignals | undefined;
  status: JobMatchLifecycle;
  snapshots: JobMatchSnapshot[];
  createdAt: Date;
  updatedAt: Date;
}

// ==========================================
// 6. AGGREGATE ROOT
// ==========================================

export class JobMatch {
  private readonly _id: string;
  private readonly _tenantId: string;
  private readonly _ownerId: string;
  private readonly _freelancerId: string;
  private readonly _jobId: string;
  private readonly _jobNormalizationId: string;
  private readonly _normalizationVersion: string;
  private readonly _jobEmbeddingId: string | undefined;
  private readonly _embeddingVersion: string | undefined;
  private readonly _matchingVersion: string;
  private _matchSignals: MatchSignals | undefined;
  private _status: JobMatchLifecycle;
  private readonly _snapshots: JobMatchSnapshot[] = [];
  private readonly _createdAt: Date;
  private _updatedAt: Date;
  private _domainEvents: JobMatchDomainEvent[] = [];

  constructor(properties: JobMatchProperties) {
    if (!properties.id || properties.id.trim() === "") {
      throw new Error("Match Identity is required.");
    }
    if (!properties.tenantId || properties.tenantId.trim() === "") {
      throw new Error("Tenant Identity is required.");
    }
    if (!properties.ownerId || properties.ownerId.trim() === "") {
      throw new Error("Owner Identity is required.");
    }
    if (!properties.freelancerId || properties.freelancerId.trim() === "") {
      throw new Error("Freelancer Identity is required.");
    }
    if (!properties.jobId || properties.jobId.trim() === "") {
      throw new Error("Job Identity is required.");
    }
    if (!properties.jobNormalizationId || properties.jobNormalizationId.trim() === "") {
      throw new Error("Job Normalization reference is required.");
    }
    if (!properties.normalizationVersion || properties.normalizationVersion.trim() === "") {
      throw new Error("Normalization Version is required.");
    }
    if (!properties.matchingVersion || properties.matchingVersion.trim() === "") {
      throw new Error("Matching Version is required.");
    }
    const versionPattern = /^v\d+$/;
    if (!versionPattern.test(properties.normalizationVersion.trim())) {
      throw new Error(`Invalid normalization version format: ${properties.normalizationVersion}.`);
    }
    if (properties.embeddingVersion && !versionPattern.test(properties.embeddingVersion.trim())) {
      throw new Error(`Invalid embedding version format: ${properties.embeddingVersion}.`);
    }
    if (!versionPattern.test(properties.matchingVersion.trim())) {
      throw new Error(`Invalid matching version format: ${properties.matchingVersion}.`);
    }
    if (!properties.status) {
      throw new Error("Lifecycle status is required.");
    }
    if (
      properties.status !== "CREATED" &&
      properties.status !== "EVALUATED" &&
      properties.status !== "ARCHIVED"
    ) {
      throw new Error(`Invalid lifecycle status: ${properties.status}`);
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
    this._freelancerId = properties.freelancerId;
    this._jobId = properties.jobId;
    this._jobNormalizationId = properties.jobNormalizationId;
    this._normalizationVersion = properties.normalizationVersion.trim();
    this._jobEmbeddingId = properties.jobEmbeddingId;
    this._embeddingVersion = properties.embeddingVersion?.trim();
    this._matchingVersion = properties.matchingVersion.trim();
    this._status = properties.status;
    this._createdAt = new Date(properties.createdAt.getTime());
    this._updatedAt = new Date(properties.updatedAt.getTime());

    if (properties.matchSignals) {
      this._matchSignals = freezeMatchSignals(properties.matchSignals);
    } else {
      this._matchSignals = undefined;
    }
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

  get freelancerId(): string {
    return this._freelancerId;
  }

  get jobId(): string {
    return this._jobId;
  }

  get jobNormalizationId(): string {
    return this._jobNormalizationId;
  }

  get normalizationVersion(): string {
    return this._normalizationVersion;
  }

  get jobEmbeddingId(): string | undefined {
    return this._jobEmbeddingId;
  }

  get embeddingVersion(): string | undefined {
    return this._embeddingVersion;
  }

  get matchingVersion(): string {
    return this._matchingVersion;
  }

  get matchSignals(): MatchSignals | undefined {
    return this._matchSignals;
  }

  get status(): JobMatchLifecycle {
    return this._status;
  }

  get snapshots(): ReadonlyArray<JobMatchSnapshot> {
    return Object.freeze([...this._snapshots]);
  }

  get createdAt(): Date {
    return new Date(this._createdAt.getTime());
  }

  get updatedAt(): Date {
    return new Date(this._updatedAt.getTime());
  }

  get domainEvents(): ReadonlyArray<JobMatchDomainEvent> {
    return Object.freeze([...this._domainEvents]);
  }

  public clearDomainEvents(): void {
    this._domainEvents = [];
  }

  private addDomainEvent(event: JobMatchDomainEvent): void {
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
      let expectedVersion = 1;
      for (const snap of this._snapshots) {
        if (snap.version !== expectedVersion) {
          throw new Error(
            `Snapshot history must be sequential and start at 1. Expected version ${expectedVersion}, got ${snap.version}.`,
          );
        }
        expectedVersion++;
      }
    }
  }

  private appendSnapshot(): void {
    const nextVersion = this._snapshots.length + 1;
    const newSnapshot = new JobMatchSnapshot({
      version: nextVersion,
      createdAt: new Date(),
      status: this._status,
      freelancerId: this._freelancerId,
      jobId: this._jobId,
      jobNormalizationId: this._jobNormalizationId,
      normalizationVersion: this._normalizationVersion,
      jobEmbeddingId: this._jobEmbeddingId,
      embeddingVersion: this._embeddingVersion,
      matchingVersion: this._matchingVersion,
      matchSignals: this._matchSignals,
    });
    this._snapshots.push(newSnapshot);
  }

  // Factory Creation Method
  public static create(
    id: string,
    tenantId: string,
    ownerId: string,
    freelancerId: string,
    jobId: string,
    jobNormalizationId: string,
    normalizationVersion: string,
    matchingVersion: string,
    jobEmbeddingId?: string | undefined,
    embeddingVersion?: string | undefined,
  ): JobMatch {
    const now = new Date();
    const match = new JobMatch({
      id,
      tenantId,
      ownerId,
      freelancerId,
      jobId,
      jobNormalizationId,
      normalizationVersion,
      jobEmbeddingId,
      embeddingVersion,
      matchingVersion,
      status: "CREATED",
      snapshots: [],
      createdAt: now,
      updatedAt: now,
    });

    match.appendSnapshot();
    match.addDomainEvent({
      eventType: JOB_MATCH_CREATED,
      matchId: match.id,
      tenantId: match.tenantId,
      ownerId: match.ownerId,
      freelancerId: match.freelancerId,
      jobId: match.jobId,
      normalizationVersion: match.normalizationVersion,
      embeddingVersion: match.embeddingVersion,
      matchingVersion: match.matchingVersion,
      snapshotVersion: match.snapshots.length,
    });

    return match;
  }

  // Domain Transitions

  private transitionTo(nextStatus: JobMatchLifecycle): void {
    if (this._status === "ARCHIVED") {
      throw new Error(`Invalid lifecycle transition from ARCHIVED to ${nextStatus.toUpperCase()}`);
    }

    if (nextStatus === "EVALUATED") {
      if (this._status !== "CREATED") {
        throw new Error(
          `Invalid lifecycle transition from ${this._status.toUpperCase()} to EVALUATED`,
        );
      }
    } else if (nextStatus === "CREATED") {
      throw new Error(`Invalid lifecycle transition from ${this._status.toUpperCase()} to CREATED`);
    }

    this._status = nextStatus;
    this._updatedAt = new Date();
    this.appendSnapshot();
  }

  public evaluate(actorOwnerId: string, matchingInputs: MatchingInputs): void {
    this.verifyOwnership(actorOwnerId);
    if (this._status !== "CREATED") {
      throw new Error(`Invalid lifecycle transition from ${this._status} to EVALUATED`);
    }

    // Tenant consistency validation
    if (matchingInputs.freelancerProfile.tenantId !== this._tenantId) {
      throw new Error("Tenant isolation violation: freelancer belongs to a different tenant.");
    }
    if (matchingInputs.jobNormalization.tenantId !== this._tenantId) {
      throw new Error("Tenant isolation violation: job belongs to a different tenant.");
    }
    if (matchingInputs.jobEmbedding && matchingInputs.jobEmbedding.tenantId !== this._tenantId) {
      throw new Error("Tenant isolation violation: job embedding belongs to a different tenant.");
    }

    // Reference integrity validation
    if (matchingInputs.freelancerProfile.freelancerId !== this._freelancerId) {
      throw new Error("Freelancer reference mismatch.");
    }
    if (matchingInputs.jobNormalization.id !== this._jobNormalizationId) {
      throw new Error("Job normalization reference mismatch.");
    }
    if (matchingInputs.jobEmbedding && matchingInputs.jobEmbedding.id !== this._jobEmbeddingId) {
      throw new Error("Job embedding reference mismatch.");
    }

    // Calculate Semantic Similarity Signal
    let semanticSimilarity: number | undefined = undefined;
    if (matchingInputs.freelancerProfile.embeddingVector && matchingInputs.jobEmbedding) {
      semanticSimilarity = calculateCosineSimilarity(
        matchingInputs.freelancerProfile.embeddingVector,
        matchingInputs.jobEmbedding.vector,
      );
    }

    // Calculate Skill Overlap Signals
    const jobSkills = matchingInputs.jobNormalization.canonicalJob.skills;
    const normalizedFreelancerSkills = matchingInputs.freelancerProfile.skills.map((s) =>
      s.trim().toLowerCase(),
    );
    const matchedSkills = jobSkills.filter((s) => normalizedFreelancerSkills.includes(s)).sort();
    const missingSkills = jobSkills.filter((s) => !normalizedFreelancerSkills.includes(s)).sort();
    const skillCoverage = jobSkills.length > 0 ? matchedSkills.length / jobSkills.length : 1.0;

    // Calculate Compatibility Signals
    const experienceCompatibility = matchExperience(
      matchingInputs.jobNormalization.canonicalJob.experience,
      matchingInputs.freelancerProfile.experience,
    );

    const budgetCompatibility = matchBudget(
      matchingInputs.jobNormalization.canonicalJob.budget,
      matchingInputs.freelancerProfile.budget,
    );

    const jobTypeCompatibility = matchJobType(
      matchingInputs.jobNormalization.canonicalJob.jobType,
      matchingInputs.freelancerProfile.preferredJobTypes,
    );

    const locationCompatibility = matchLocation(
      matchingInputs.jobNormalization.canonicalJob.location,
      matchingInputs.freelancerProfile.location,
    );

    this._matchSignals = freezeMatchSignals({
      semanticSimilarity,
      matchedSkills,
      missingSkills,
      skillCoverage,
      experienceCompatibility,
      budgetCompatibility,
      jobTypeCompatibility,
      locationCompatibility,
    });

    this.transitionTo("EVALUATED");

    this.addDomainEvent({
      eventType: JOB_MATCH_EVALUATED,
      matchId: this._id,
      tenantId: this._tenantId,
      ownerId: this._ownerId,
      freelancerId: this._freelancerId,
      jobId: this._jobId,
      normalizationVersion: this._normalizationVersion,
      embeddingVersion: this._embeddingVersion,
      matchingVersion: this._matchingVersion,
      snapshotVersion: this._snapshots.length,
    });
  }

  public archive(actorOwnerId: string): void {
    this.verifyOwnership(actorOwnerId);
    if (this._status === "ARCHIVED") {
      throw new Error("Job match is already archived.");
    }
    this.transitionTo("ARCHIVED");

    this.addDomainEvent({
      eventType: JOB_MATCH_ARCHIVED,
      matchId: this._id,
      tenantId: this._tenantId,
      ownerId: this._ownerId,
      freelancerId: this._freelancerId,
      jobId: this._jobId,
      normalizationVersion: this._normalizationVersion,
      embeddingVersion: this._embeddingVersion,
      matchingVersion: this._matchingVersion,
      snapshotVersion: this._snapshots.length,
    });
  }
}
