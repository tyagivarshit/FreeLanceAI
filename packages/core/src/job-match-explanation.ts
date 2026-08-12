export type JobMatchExplanationLifecycle = "CREATED" | "GENERATED" | "ARCHIVED";

// ==========================================
// 1. VALUE OBJECTS
// ==========================================

export interface ExplanationPolicyProperties {
  explanationPolicyVersion: string;
  supportedFactTypes: readonly string[];
  sectionOrdering: readonly string[];
  prioritizationRules: readonly string[];
  semanticRelevanceThreshold?: number | undefined;
}

export class ExplanationPolicy {
  private readonly _explanationPolicyVersion: string;
  private readonly _supportedFactTypes: readonly string[];
  private readonly _sectionOrdering: readonly string[];
  private readonly _prioritizationRules: readonly string[];
  private readonly _semanticRelevanceThreshold: number | undefined;

  constructor(properties: ExplanationPolicyProperties) {
    if (!properties.explanationPolicyVersion || properties.explanationPolicyVersion.trim() === "") {
      throw new Error("explanationPolicyVersion is required.");
    }
    const versionPattern = /^v\d+$/;
    if (!versionPattern.test(properties.explanationPolicyVersion.trim())) {
      throw new Error(`Invalid policy version format: ${properties.explanationPolicyVersion}`);
    }
    if (!properties.supportedFactTypes || properties.supportedFactTypes.length === 0) {
      throw new Error("supportedFactTypes is required.");
    }
    if (!properties.sectionOrdering || properties.sectionOrdering.length === 0) {
      throw new Error("sectionOrdering is required.");
    }
    if (!properties.prioritizationRules) {
      throw new Error("prioritizationRules is required.");
    }

    this._explanationPolicyVersion = properties.explanationPolicyVersion.trim();
    this._supportedFactTypes = Object.freeze([...properties.supportedFactTypes]);
    this._sectionOrdering = Object.freeze([...properties.sectionOrdering]);
    this._prioritizationRules = Object.freeze([...properties.prioritizationRules]);
    this._semanticRelevanceThreshold = properties.semanticRelevanceThreshold;
    Object.freeze(this);
  }

  get explanationPolicyVersion(): string {
    return this._explanationPolicyVersion;
  }

  get supportedFactTypes(): readonly string[] {
    return this._supportedFactTypes;
  }

  get sectionOrdering(): readonly string[] {
    return this._sectionOrdering;
  }

  get prioritizationRules(): readonly string[] {
    return this._prioritizationRules;
  }

  get semanticRelevanceThreshold(): number | undefined {
    return this._semanticRelevanceThreshold;
  }
}

export interface ExplanationFactProperties {
  factType: string;
  sourceDomain: "8D" | "8E" | "8F";
  sourceReference: string;
  signalName?: string | undefined;
  rawValue?: string | number | undefined;
  normalizedValue?: number | undefined;
  importance?: string | undefined;
  evidenceReference?: string | undefined;
}

export class ExplanationFact {
  private readonly _factType: string;
  private readonly _sourceDomain: "8D" | "8E" | "8F";
  private readonly _sourceReference: string;
  private readonly _signalName: string | undefined;
  private readonly _rawValue: string | number | undefined;
  private readonly _normalizedValue: number | undefined;
  private readonly _importance: string | undefined;
  private readonly _evidenceReference: string | undefined;

  constructor(properties: ExplanationFactProperties) {
    if (!properties.factType || properties.factType.trim() === "") {
      throw new Error("factType is required.");
    }
    if (!properties.sourceDomain) {
      throw new Error("sourceDomain is required.");
    }
    if (!properties.sourceReference || properties.sourceReference.trim() === "") {
      throw new Error("sourceReference is required.");
    }

    this._factType = properties.factType.trim();
    this._sourceDomain = properties.sourceDomain;
    this._sourceReference = properties.sourceReference.trim();
    this._signalName = properties.signalName;
    this._rawValue = properties.rawValue;
    this._normalizedValue = properties.normalizedValue;
    this._importance = properties.importance;
    this._evidenceReference = properties.evidenceReference;
    Object.freeze(this);
  }

  get factType(): string {
    return this._factType;
  }

  get sourceDomain(): "8D" | "8E" | "8F" {
    return this._sourceDomain;
  }

  get sourceReference(): string {
    return this._sourceReference;
  }

  get signalName(): string | undefined {
    return this._signalName;
  }

  get rawValue(): string | number | undefined {
    return this._rawValue;
  }

  get normalizedValue(): number | undefined {
    return this._normalizedValue;
  }

  get importance(): string | undefined {
    return this._importance;
  }

  get evidenceReference(): string | undefined {
    return this._evidenceReference;
  }
}

export interface ExplanationModelProperties {
  summary: string;
  strengths: readonly string[];
  gaps: readonly string[];
  compatibility: Record<string, string>;
  scoreContext: string;
  rankingContext?: string | undefined;
}

export class ExplanationModel {
  private readonly _summary: string;
  private readonly _strengths: readonly string[];
  private readonly _gaps: readonly string[];
  private readonly _compatibility: Record<string, string>;
  private readonly _scoreContext: string;
  private readonly _rankingContext: string | undefined;

  constructor(properties: ExplanationModelProperties) {
    this._summary = properties.summary;
    this._strengths = Object.freeze([...properties.strengths]);
    this._gaps = Object.freeze([...properties.gaps]);
    this._compatibility = Object.freeze({ ...properties.compatibility });
    this._scoreContext = properties.scoreContext;
    this._rankingContext = properties.rankingContext;
    Object.freeze(this);
  }

  get summary(): string {
    return this._summary;
  }

  get strengths(): readonly string[] {
    return this._strengths;
  }

  get gaps(): readonly string[] {
    return this._gaps;
  }

  get compatibility(): Record<string, string> {
    return this._compatibility;
  }

  get scoreContext(): string {
    return this._scoreContext;
  }

  get rankingContext(): string | undefined {
    return this._rankingContext;
  }
}

export interface ExplanationRenderer {
  render(model: ExplanationModel): string;
}

export class ExplanationFingerprint {
  private readonly _value: string;

  constructor(properties: {
    jobMatchId: string;
    scoreId: string;
    rankingId?: string | undefined;
    matchingVersion: string;
    scoringVersion: string;
    rankingVersion: string;
    explanationVersion: string;
    explanationPolicyVersion: string;
    evidenceFactFingerprint: string;
  }) {
    if (!properties.jobMatchId || properties.jobMatchId.trim() === "") {
      throw new Error("jobMatchId is required for ExplanationFingerprint.");
    }
    if (!properties.scoreId || properties.scoreId.trim() === "") {
      throw new Error("scoreId is required for ExplanationFingerprint.");
    }
    if (!properties.matchingVersion || properties.matchingVersion.trim() === "") {
      throw new Error("matchingVersion is required for ExplanationFingerprint.");
    }
    if (!properties.scoringVersion || properties.scoringVersion.trim() === "") {
      throw new Error("scoringVersion is required for ExplanationFingerprint.");
    }
    if (!properties.rankingVersion || properties.rankingVersion.trim() === "") {
      throw new Error("rankingVersion is required for ExplanationFingerprint.");
    }
    if (!properties.explanationVersion || properties.explanationVersion.trim() === "") {
      throw new Error("explanationVersion is required for ExplanationFingerprint.");
    }
    if (!properties.explanationPolicyVersion || properties.explanationPolicyVersion.trim() === "") {
      throw new Error("explanationPolicyVersion is required for ExplanationFingerprint.");
    }
    if (
      properties.evidenceFactFingerprint === undefined ||
      properties.evidenceFactFingerprint === null
    ) {
      throw new Error("evidenceFactFingerprint is required for ExplanationFingerprint.");
    }

    this._value = `exfp:${properties.jobMatchId.trim()}:${properties.scoreId.trim()}:${(properties.rankingId || "").trim()}:${properties.matchingVersion.trim()}:${properties.scoringVersion.trim()}:${properties.rankingVersion.trim()}:${properties.explanationVersion.trim()}:${properties.explanationPolicyVersion.trim()}:${properties.evidenceFactFingerprint.trim()}`;
    Object.freeze(this);
  }

  get value(): string {
    return this._value;
  }

  public equals(other: ExplanationFingerprint): boolean {
    if (!other) {
      return false;
    }
    return this._value === other.value;
  }
}

export function buildEvidenceFactFingerprint(facts: ExplanationFact[]): string {
  const sortedStrings = facts
    .map((f) => {
      return `${f.factType}:${f.sourceDomain}:${f.rawValue ?? ""}:${f.normalizedValue ?? ""}`;
    })
    .sort();
  return `facts:${sortedStrings.join("|")}`;
}

// ==========================================
// 2. SNAPSHOTS
// ==========================================

export interface JobMatchExplanationSnapshotProperties {
  version: number;
  createdAt: Date;
  status: JobMatchExplanationLifecycle;
  jobMatchId: string;
  scoreId: string;
  rankingId?: string | undefined;
  matchingVersion: string;
  scoringVersion: string;
  rankingVersion: string;
  explanationVersion: string;
  explanationPolicyVersion: string;
  facts: ExplanationFact[];
  explanationModel?: ExplanationModel | undefined;
  explanationFingerprint?: ExplanationFingerprint | undefined;
}

export class JobMatchExplanationSnapshot {
  private readonly _version: number;
  private readonly _createdAt: Date;
  private readonly _status: JobMatchExplanationLifecycle;
  private readonly _jobMatchId: string;
  private readonly _scoreId: string;
  private readonly _rankingId: string | undefined;
  private readonly _matchingVersion: string;
  private readonly _scoringVersion: string;
  private readonly _rankingVersion: string;
  private readonly _explanationVersion: string;
  private readonly _explanationPolicyVersion: string;
  private readonly _facts: ExplanationFact[];
  private readonly _explanationModel: ExplanationModel | undefined;
  private readonly _explanationFingerprint: ExplanationFingerprint | undefined;

  constructor(properties: JobMatchExplanationSnapshotProperties) {
    if (properties.version <= 0) {
      throw new Error("Snapshot version must be greater than zero.");
    }
    if (!properties.createdAt) {
      throw new Error("Snapshot creation date is required.");
    }
    if (!properties.status) {
      throw new Error("Snapshot status is required.");
    }
    if (!properties.jobMatchId || properties.jobMatchId.trim() === "") {
      throw new Error("Snapshot jobMatchId is required.");
    }
    if (!properties.scoreId || properties.scoreId.trim() === "") {
      throw new Error("Snapshot scoreId is required.");
    }
    if (!properties.matchingVersion || properties.matchingVersion.trim() === "") {
      throw new Error("Snapshot matchingVersion is required.");
    }
    if (!properties.scoringVersion || properties.scoringVersion.trim() === "") {
      throw new Error("Snapshot scoringVersion is required.");
    }
    if (!properties.rankingVersion || properties.rankingVersion.trim() === "") {
      throw new Error("Snapshot rankingVersion is required.");
    }
    if (!properties.explanationVersion || properties.explanationVersion.trim() === "") {
      throw new Error("Snapshot explanationVersion is required.");
    }
    if (!properties.explanationPolicyVersion || properties.explanationPolicyVersion.trim() === "") {
      throw new Error("Snapshot explanationPolicyVersion is required.");
    }

    this._version = properties.version;
    this._createdAt = new Date(properties.createdAt.getTime());
    this._status = properties.status;
    this._jobMatchId = properties.jobMatchId;
    this._scoreId = properties.scoreId;
    this._rankingId = properties.rankingId;
    this._matchingVersion = properties.matchingVersion;
    this._scoringVersion = properties.scoringVersion;
    this._rankingVersion = properties.rankingVersion;
    this._explanationVersion = properties.explanationVersion;
    this._explanationPolicyVersion = properties.explanationPolicyVersion;
    this._facts = [...properties.facts].map((f) => Object.freeze(f) as ExplanationFact);
    this._explanationModel = properties.explanationModel;
    this._explanationFingerprint = properties.explanationFingerprint;
    Object.freeze(this._facts);
    Object.freeze(this);
  }

  get version(): number {
    return this._version;
  }

  get createdAt(): Date {
    return new Date(this._createdAt.getTime());
  }

  get status(): JobMatchExplanationLifecycle {
    return this._status;
  }

  get jobMatchId(): string {
    return this._jobMatchId;
  }

  get scoreId(): string {
    return this._scoreId;
  }

  get rankingId(): string | undefined {
    return this._rankingId;
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

  get explanationVersion(): string {
    return this._explanationVersion;
  }

  get explanationPolicyVersion(): string {
    return this._explanationPolicyVersion;
  }

  get facts(): readonly ExplanationFact[] {
    return this._facts;
  }

  get explanationModel(): ExplanationModel | undefined {
    return this._explanationModel;
  }

  get explanationFingerprint(): ExplanationFingerprint | undefined {
    return this._explanationFingerprint;
  }
}

// ==========================================
// 3. DOMAIN EVENTS
// ==========================================

export const JOB_MATCH_EXPLANATION_CREATED = "JOB_MATCH_EXPLANATION_CREATED";
export const JOB_MATCH_EXPLANATION_GENERATED = "JOB_MATCH_EXPLANATION_GENERATED";
export const JOB_MATCH_EXPLANATION_ARCHIVED = "JOB_MATCH_EXPLANATION_ARCHIVED";

export type JobMatchExplanationDomainEventName =
  | typeof JOB_MATCH_EXPLANATION_CREATED
  | typeof JOB_MATCH_EXPLANATION_GENERATED
  | typeof JOB_MATCH_EXPLANATION_ARCHIVED;

export interface JobMatchExplanationDomainEvent {
  readonly eventType: JobMatchExplanationDomainEventName;
  readonly explanationId: string;
  readonly tenantId: string;
  readonly ownerId: string;
  readonly jobMatchId: string;
  readonly scoreId: string;
  readonly rankingId?: string | undefined;
  readonly matchingVersion: string;
  readonly scoringVersion: string;
  readonly rankingVersion: string;
  readonly explanationVersion: string;
  readonly explanationPolicyVersion: string;
  readonly fingerprint?: string | undefined;
  readonly snapshotVersion: number;
}

// ==========================================
// 4. PERSISTENCE CONTRACTS
// ==========================================

export interface JobMatchExplanationPersistenceContract {
  findByExplanationIdentity(
    tenantId: string,
    jobMatchId: string,
    matchingVersion: string,
    scoringVersion: string,
    rankingVersion: string,
    explanationVersion: string,
    explanationPolicyVersion: string,
  ): Promise<JobMatchExplanation | null>;
}

export interface JobMatchExplanationAggregateStore {
  save(explanation: JobMatchExplanation): Promise<void>;
  findById(id: string, tenantId: string): Promise<JobMatchExplanation | null>;
  findByExplanationIdentity(
    tenantId: string,
    jobMatchId: string,
    matchingVersion: string,
    scoringVersion: string,
    rankingVersion: string,
    explanationVersion: string,
    explanationPolicyVersion: string,
  ): Promise<JobMatchExplanation | null>;
}

// Scored Match contribution for inputs
export interface ScoredContributionInput {
  readonly signalName: string;
  readonly rawValue: string | number | undefined;
  readonly normalizedValue: number | undefined;
  readonly weight: number;
  readonly contribution: number | undefined;
  readonly available: boolean;
}

// Evidence Input shape
export interface AuthoritativeEvidenceInput {
  readonly tenantId: string;
  readonly matchSignals: {
    readonly semanticSimilarity?: number | undefined;
    readonly matchedSkills: readonly string[];
    readonly missingSkills: readonly string[];
    readonly skillCoverage: number;
    readonly experienceCompatibility: "COMPATIBLE" | "PARTIAL" | "INCOMPATIBLE" | "UNKNOWN";
    readonly budgetCompatibility: "COMPATIBLE" | "PARTIAL" | "INCOMPATIBLE" | "UNKNOWN";
    readonly jobTypeCompatibility: "COMPATIBLE" | "INCOMPATIBLE" | "UNKNOWN";
    readonly locationCompatibility: "COMPATIBLE" | "PARTIAL" | "INCOMPATIBLE" | "UNKNOWN";
  };
  readonly finalScore: number;
  readonly contributions: readonly ScoredContributionInput[];
  readonly rank?: number | undefined;
  readonly candidateCount?: number | undefined;
}

// ==========================================
// 5. AGGREGATE PROPERTIES
// ==========================================

export interface JobMatchExplanationProperties {
  id: string;
  tenantId: string;
  ownerId: string;
  jobMatchId: string;
  scoreId: string;
  rankingId?: string | undefined;
  matchingVersion: string;
  scoringVersion: string;
  rankingVersion: string;
  explanationVersion: string;
  explanationPolicyVersion: string;
  facts: ExplanationFact[];
  explanationModel?: ExplanationModel | undefined;
  explanationFingerprint?: ExplanationFingerprint | undefined;
  status: JobMatchExplanationLifecycle;
  snapshots: JobMatchExplanationSnapshot[];
  createdAt: Date;
  updatedAt: Date;
}

// ==========================================
// 6. AGGREGATE ROOT
// ==========================================

export class JobMatchExplanation {
  private readonly _id: string;
  private readonly _tenantId: string;
  private readonly _ownerId: string;
  private readonly _jobMatchId: string;
  private readonly _scoreId: string;
  private readonly _rankingId: string | undefined;
  private readonly _matchingVersion: string;
  private readonly _scoringVersion: string;
  private readonly _rankingVersion: string;
  private readonly _explanationVersion: string;
  private readonly _explanationPolicyVersion: string;
  private _facts: ExplanationFact[] = [];
  private _explanationModel: ExplanationModel | undefined;
  private _explanationFingerprint: ExplanationFingerprint | undefined;
  private _status: JobMatchExplanationLifecycle;
  private readonly _snapshots: JobMatchExplanationSnapshot[] = [];
  private readonly _createdAt: Date;
  private _updatedAt: Date;
  private _domainEvents: JobMatchExplanationDomainEvent[] = [];

  constructor(properties: JobMatchExplanationProperties) {
    if (!properties.id || properties.id.trim() === "") {
      throw new Error("Explanation Identity is required.");
    }
    if (!properties.tenantId || properties.tenantId.trim() === "") {
      throw new Error("Tenant Identity is required.");
    }
    if (!properties.ownerId || properties.ownerId.trim() === "") {
      throw new Error("Owner Identity is required.");
    }
    if (!properties.jobMatchId || properties.jobMatchId.trim() === "") {
      throw new Error("Job Match reference is required.");
    }
    if (!properties.scoreId || properties.scoreId.trim() === "") {
      throw new Error("Score reference is required.");
    }
    if (!properties.matchingVersion || properties.matchingVersion.trim() === "") {
      throw new Error("Matching version is required.");
    }
    if (!properties.scoringVersion || properties.scoringVersion.trim() === "") {
      throw new Error("Scoring version is required.");
    }
    if (!properties.rankingVersion || properties.rankingVersion.trim() === "") {
      throw new Error("Ranking version is required.");
    }
    if (!properties.explanationVersion || properties.explanationVersion.trim() === "") {
      throw new Error("Explanation version is required.");
    }
    if (!properties.explanationPolicyVersion || properties.explanationPolicyVersion.trim() === "") {
      throw new Error("Explanation policy version is required.");
    }
    const versionPattern = /^v\d+$/;
    if (!versionPattern.test(properties.matchingVersion.trim())) {
      throw new Error(`Invalid matching version format: ${properties.matchingVersion}`);
    }
    if (!versionPattern.test(properties.scoringVersion.trim())) {
      throw new Error(`Invalid scoring version format: ${properties.scoringVersion}`);
    }
    if (!versionPattern.test(properties.rankingVersion.trim())) {
      throw new Error(`Invalid ranking version format: ${properties.rankingVersion}`);
    }
    if (!versionPattern.test(properties.explanationVersion.trim())) {
      throw new Error(`Invalid explanation version format: ${properties.explanationVersion}`);
    }
    if (!versionPattern.test(properties.explanationPolicyVersion.trim())) {
      throw new Error(`Invalid policy version format: ${properties.explanationPolicyVersion}`);
    }
    if (!properties.status) {
      throw new Error("Lifecycle status is required.");
    }
    if (
      properties.status !== "CREATED" &&
      properties.status !== "GENERATED" &&
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
    this._jobMatchId = properties.jobMatchId;
    this._scoreId = properties.scoreId;
    this._rankingId = properties.rankingId;
    this._matchingVersion = properties.matchingVersion.trim();
    this._scoringVersion = properties.scoringVersion.trim();
    this._rankingVersion = properties.rankingVersion.trim();
    this._explanationVersion = properties.explanationVersion.trim();
    this._explanationPolicyVersion = properties.explanationPolicyVersion.trim();
    this._explanationModel = properties.explanationModel;
    this._explanationFingerprint = properties.explanationFingerprint;
    this._status = properties.status;
    this._createdAt = new Date(properties.createdAt.getTime());
    this._updatedAt = new Date(properties.updatedAt.getTime());

    if (properties.facts && properties.facts.length > 0) {
      this._facts = [...properties.facts];
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

  get jobMatchId(): string {
    return this._jobMatchId;
  }

  get scoreId(): string {
    return this._scoreId;
  }

  get rankingId(): string | undefined {
    return this._rankingId;
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

  get explanationVersion(): string {
    return this._explanationVersion;
  }

  get explanationPolicyVersion(): string {
    return this._explanationPolicyVersion;
  }

  get facts(): readonly ExplanationFact[] {
    return Object.freeze([...this._facts]);
  }

  get explanationModel(): ExplanationModel | undefined {
    return this._explanationModel;
  }

  get explanationFingerprint(): ExplanationFingerprint | undefined {
    return this._explanationFingerprint;
  }

  get status(): JobMatchExplanationLifecycle {
    return this._status;
  }

  get snapshots(): ReadonlyArray<JobMatchExplanationSnapshot> {
    return Object.freeze([...this._snapshots]);
  }

  get createdAt(): Date {
    return new Date(this._createdAt.getTime());
  }

  get updatedAt(): Date {
    return new Date(this._updatedAt.getTime());
  }

  get domainEvents(): ReadonlyArray<JobMatchExplanationDomainEvent> {
    return Object.freeze([...this._domainEvents]);
  }

  public clearDomainEvents(): void {
    this._domainEvents = [];
  }

  private addDomainEvent(event: JobMatchExplanationDomainEvent): void {
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
    const newSnapshot = new JobMatchExplanationSnapshot({
      version: nextVersion,
      createdAt: new Date(),
      status: this._status,
      jobMatchId: this._jobMatchId,
      scoreId: this._scoreId,
      rankingId: this._rankingId,
      matchingVersion: this._matchingVersion,
      scoringVersion: this._scoringVersion,
      rankingVersion: this._rankingVersion,
      explanationVersion: this._explanationVersion,
      explanationPolicyVersion: this._explanationPolicyVersion,
      facts: this._facts,
      explanationModel: this._explanationModel,
      explanationFingerprint: this._explanationFingerprint,
    });
    this._snapshots.push(newSnapshot);
  }

  // Factory creation method
  public static create(
    id: string,
    tenantId: string,
    ownerId: string,
    jobMatchId: string,
    scoreId: string,
    rankingId: string | undefined,
    matchingVersion: string,
    scoringVersion: string,
    rankingVersion: string,
    explanationVersion: string,
    explanationPolicyVersion: string,
  ): JobMatchExplanation {
    const now = new Date();
    const explanation = new JobMatchExplanation({
      id,
      tenantId,
      ownerId,
      jobMatchId,
      scoreId,
      rankingId,
      matchingVersion,
      scoringVersion,
      rankingVersion,
      explanationVersion,
      explanationPolicyVersion,
      facts: [],
      status: "CREATED",
      snapshots: [],
      createdAt: now,
      updatedAt: now,
    });

    explanation.appendSnapshot();
    explanation.addDomainEvent({
      eventType: JOB_MATCH_EXPLANATION_CREATED,
      explanationId: explanation.id,
      tenantId: explanation.tenantId,
      ownerId: explanation.ownerId,
      jobMatchId: explanation.jobMatchId,
      scoreId: explanation.scoreId,
      rankingId: explanation.rankingId,
      matchingVersion: explanation.matchingVersion,
      scoringVersion: explanation.scoringVersion,
      rankingVersion: explanation.rankingVersion,
      explanationVersion: explanation.explanationVersion,
      explanationPolicyVersion: explanation.explanationPolicyVersion,
      snapshotVersion: explanation.snapshots.length,
    });

    return explanation;
  }

  // Domain Transitions

  private transitionTo(nextStatus: JobMatchExplanationLifecycle): void {
    if (this._status === "ARCHIVED") {
      throw new Error(`Invalid lifecycle transition from ARCHIVED to ${nextStatus.toUpperCase()}`);
    }

    if (nextStatus === "GENERATED") {
      if (this._status !== "CREATED") {
        throw new Error(
          `Invalid lifecycle transition from ${this._status.toUpperCase()} to GENERATED`,
        );
      }
    } else if (nextStatus === "CREATED") {
      throw new Error(`Invalid lifecycle transition from ${this._status.toUpperCase()} to CREATED`);
    }

    this._status = nextStatus;
    this._updatedAt = new Date();
    this.appendSnapshot();
  }

  public generate(
    actorOwnerId: string,
    evidence: AuthoritativeEvidenceInput,
    policy: ExplanationPolicy,
  ): void {
    this.verifyOwnership(actorOwnerId);
    if (this._status !== "CREATED") {
      throw new Error(`Invalid lifecycle transition from ${this._status} to GENERATED`);
    }
    if (policy.explanationPolicyVersion !== this._explanationPolicyVersion) {
      throw new Error("Explanation policy version mismatch.");
    }
    if (!evidence) {
      throw new Error("Evidence inputs are required.");
    }

    // Tenant Isolation
    if (evidence.tenantId !== this._tenantId) {
      throw new Error("Tenant isolation violation: cross-tenant evidence rejected.");
    }

    // Version checks and validation
    const matchSignals = evidence.matchSignals;
    if (
      matchSignals.semanticSimilarity !== undefined &&
      (typeof matchSignals.semanticSimilarity !== "number" ||
        !Number.isFinite(matchSignals.semanticSimilarity) ||
        Number.isNaN(matchSignals.semanticSimilarity) ||
        matchSignals.semanticSimilarity < -1 ||
        matchSignals.semanticSimilarity > 1)
    ) {
      throw new Error("Semantic similarity must be a finite number between -1 and 1.");
    }
    if (
      typeof matchSignals.skillCoverage !== "number" ||
      !Number.isFinite(matchSignals.skillCoverage) ||
      Number.isNaN(matchSignals.skillCoverage) ||
      matchSignals.skillCoverage < 0 ||
      matchSignals.skillCoverage > 1
    ) {
      throw new Error("Skill coverage must be a finite number between 0 and 1.");
    }
    if (
      typeof evidence.finalScore !== "number" ||
      !Number.isFinite(evidence.finalScore) ||
      Number.isNaN(evidence.finalScore)
    ) {
      throw new Error("Final score must be a finite number.");
    }

    // Compile facts
    const facts: ExplanationFact[] = [];
    const factTypes = policy.supportedFactTypes;

    // Matched skills facts
    if (factTypes.includes("MATCHED_SKILL")) {
      for (const skill of matchSignals.matchedSkills) {
        facts.push(
          new ExplanationFact({
            factType: "MATCHED_SKILL",
            sourceDomain: "8D",
            sourceReference: this._jobMatchId,
            signalName: "matchedSkills",
            rawValue: skill,
          }),
        );
      }
    }

    // Missing skills facts
    if (factTypes.includes("MISSING_SKILL")) {
      for (const skill of matchSignals.missingSkills) {
        facts.push(
          new ExplanationFact({
            factType: "MISSING_SKILL",
            sourceDomain: "8D",
            sourceReference: this._jobMatchId,
            signalName: "missingSkills",
            rawValue: skill,
          }),
        );
      }
    }

    // Compatibility states
    const compatibilityKeys = [
      { key: "experienceCompatibility", type: "EXPERIENCE_COMPATIBILITY" },
      { key: "budgetCompatibility", type: "BUDGET_COMPATIBILITY" },
      { key: "jobTypeCompatibility", type: "JOB_TYPE_COMPATIBILITY" },
      { key: "locationCompatibility", type: "LOCATION_COMPATIBILITY" },
    ] as const;

    for (const item of compatibilityKeys) {
      if (factTypes.includes(item.type)) {
        const rawValue = matchSignals[item.key];
        facts.push(
          new ExplanationFact({
            factType: item.type,
            sourceDomain: "8D",
            sourceReference: this._jobMatchId,
            signalName: item.key,
            rawValue: rawValue,
          }),
        );
      }
    }

    // Semantic relevance
    if (factTypes.includes("SEMANTIC_RELEVANCE") && matchSignals.semanticSimilarity !== undefined) {
      facts.push(
        new ExplanationFact({
          factType: "SEMANTIC_RELEVANCE",
          sourceDomain: "8D",
          sourceReference: this._jobMatchId,
          signalName: "semanticSimilarity",
          rawValue: matchSignals.semanticSimilarity,
        }),
      );
    }

    // Score contributions
    if (factTypes.includes("SCORE_CONTRIBUTION")) {
      for (const contrib of evidence.contributions) {
        facts.push(
          new ExplanationFact({
            factType: "SCORE_CONTRIBUTION",
            sourceDomain: "8E",
            sourceReference: this._scoreId,
            signalName: contrib.signalName,
            rawValue: contrib.rawValue,
            normalizedValue: contrib.normalizedValue,
          }),
        );
      }
    }

    // Ranking context
    if (
      factTypes.includes("RANKING_CONTEXT") &&
      evidence.rank !== undefined &&
      evidence.candidateCount !== undefined &&
      this._rankingId
    ) {
      facts.push(
        new ExplanationFact({
          factType: "RANKING_CONTEXT",
          sourceDomain: "8F",
          sourceReference: this._rankingId,
          signalName: "rank",
          rawValue: evidence.rank,
        }),
      );
      facts.push(
        new ExplanationFact({
          factType: "RANKING_CONTEXT",
          sourceDomain: "8F",
          sourceReference: this._rankingId,
          signalName: "candidateCount",
          rawValue: evidence.candidateCount,
        }),
      );
    }

    // Deduplicate facts by type and value
    const uniqueFactsMap = new Map<string, ExplanationFact>();
    for (const f of facts) {
      const key = `${f.factType}:${f.sourceDomain}:${f.signalName ?? ""}:${f.rawValue ?? ""}`;
      uniqueFactsMap.set(key, f);
    }
    const deduplicatedFacts = Array.from(uniqueFactsMap.values());

    // Deterministic prioritization/sorting: sorting by factType ASC, rawValue ASC
    const sortedFacts = deduplicatedFacts.sort((a, b) => {
      if (a.factType !== b.factType) {
        return a.factType < b.factType ? -1 : 1;
      }
      const rawA = String(a.rawValue ?? "");
      const rawB = String(b.rawValue ?? "");
      return rawA < rawB ? -1 : rawA > rawB ? 1 : 0;
    });

    // Construct Model sections deterministically
    const strengths: string[] = [];
    const gaps: string[] = [];

    // Derive strengths (positive facts) and gaps (negative facts)
    // 1. Skills
    for (const skill of matchSignals.matchedSkills) {
      strengths.push(`Matched required skill: ${skill}`);
    }
    for (const skill of matchSignals.missingSkills) {
      gaps.push(`Missing required skill: ${skill}`);
    }

    // 2. Compatibility states
    if (matchSignals.experienceCompatibility === "COMPATIBLE") {
      strengths.push("Experience level is fully compatible.");
    } else if (matchSignals.experienceCompatibility === "INCOMPATIBLE") {
      gaps.push("Experience level does not meet job requirements.");
    }

    if (matchSignals.budgetCompatibility === "COMPATIBLE") {
      strengths.push("Rate fits within job budget.");
    } else if (matchSignals.budgetCompatibility === "INCOMPATIBLE") {
      gaps.push("Freelancer rate exceeds job budget or currency differs.");
    }

    if (matchSignals.jobTypeCompatibility === "COMPATIBLE") {
      strengths.push("Job type fits freelancer preference.");
    } else if (matchSignals.jobTypeCompatibility === "INCOMPATIBLE") {
      gaps.push("Job type does not match freelancer preferences.");
    }

    if (matchSignals.locationCompatibility === "COMPATIBLE") {
      strengths.push("Location matching is compatible.");
    } else if (matchSignals.locationCompatibility === "PARTIAL") {
      strengths.push("Location matches remote constraints partially.");
    } else if (matchSignals.locationCompatibility === "INCOMPATIBLE") {
      gaps.push("Location is incompatible with job geographic requirements.");
    }

    // 3. Semantic similarity strength check if above threshold
    const relThreshold = policy.semanticRelevanceThreshold ?? 0.5;
    if (
      matchSignals.semanticSimilarity !== undefined &&
      matchSignals.semanticSimilarity >= relThreshold
    ) {
      strengths.push("Strong semantic relevance between profile descriptions.");
    }

    const compatibilityObj: Record<string, string> = {
      experienceCompatibility: matchSignals.experienceCompatibility,
      budgetCompatibility: matchSignals.budgetCompatibility,
      jobTypeCompatibility: matchSignals.jobTypeCompatibility,
      locationCompatibility: matchSignals.locationCompatibility,
    };

    const model = new ExplanationModel({
      summary: `Deterministic explanation of match score ${evidence.finalScore}.`,
      strengths,
      gaps,
      compatibility: compatibilityObj,
      scoreContext: `Final score is ${evidence.finalScore}.`,
      rankingContext:
        evidence.rank !== undefined && evidence.candidateCount !== undefined
          ? `Ranked #${evidence.rank} out of ${evidence.candidateCount} candidates.`
          : undefined,
    });

    const factFp = buildEvidenceFactFingerprint(sortedFacts);

    this._facts = sortedFacts;
    this._explanationModel = model;
    this._explanationFingerprint = new ExplanationFingerprint({
      jobMatchId: this._jobMatchId,
      scoreId: this._scoreId,
      rankingId: this._rankingId,
      matchingVersion: this._matchingVersion,
      scoringVersion: this._scoringVersion,
      rankingVersion: this._rankingVersion,
      explanationVersion: this._explanationVersion,
      explanationPolicyVersion: this._explanationPolicyVersion,
      evidenceFactFingerprint: factFp,
    });

    this.transitionTo("GENERATED");

    this.addDomainEvent({
      eventType: JOB_MATCH_EXPLANATION_GENERATED,
      explanationId: this._id,
      tenantId: this._tenantId,
      ownerId: this._ownerId,
      jobMatchId: this._jobMatchId,
      scoreId: this._scoreId,
      rankingId: this._rankingId,
      matchingVersion: this._matchingVersion,
      scoringVersion: this._scoringVersion,
      rankingVersion: this._rankingVersion,
      explanationVersion: this._explanationVersion,
      explanationPolicyVersion: this._explanationPolicyVersion,
      fingerprint: this._explanationFingerprint.value,
      snapshotVersion: this._snapshots.length,
    });
  }

  public archive(actorOwnerId: string): void {
    this.verifyOwnership(actorOwnerId);
    if (this._status === "ARCHIVED") {
      throw new Error("Job match explanation is already archived.");
    }
    this.transitionTo("ARCHIVED");

    this.addDomainEvent({
      eventType: JOB_MATCH_EXPLANATION_ARCHIVED,
      explanationId: this._id,
      tenantId: this._tenantId,
      ownerId: this._ownerId,
      jobMatchId: this._jobMatchId,
      scoreId: this._scoreId,
      rankingId: this._rankingId,
      matchingVersion: this._matchingVersion,
      scoringVersion: this._scoringVersion,
      rankingVersion: this._rankingVersion,
      explanationVersion: this._explanationVersion,
      explanationPolicyVersion: this._explanationPolicyVersion,
      fingerprint: this._explanationFingerprint ? this._explanationFingerprint.value : undefined,
      snapshotVersion: this._snapshots.length,
    });
  }
}
