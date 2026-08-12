export type JobMatchScoreLifecycle = "CREATED" | "CALCULATED" | "ARCHIVED";

// ==========================================
// 1. VALUE OBJECTS
// ==========================================

export interface SignalWeights {
  readonly semanticSimilarity: number;
  readonly skillCoverage: number;
  readonly experienceCompatibility: number;
  readonly budgetCompatibility: number;
  readonly jobTypeCompatibility: number;
  readonly locationCompatibility: number;
}

export class ScoreWeightProfile {
  private readonly _weightProfileVersion: string;
  private readonly _weights: SignalWeights;

  constructor(weightProfileVersion: string, weights: SignalWeights) {
    if (!weightProfileVersion || weightProfileVersion.trim() === "") {
      throw new Error("Weight profile version is required.");
    }
    const versionPattern = /^v\d+$/;
    if (!versionPattern.test(weightProfileVersion.trim())) {
      throw new Error(`Invalid weight profile version format: ${weightProfileVersion}`);
    }
    if (!weights) {
      throw new Error("Weights are required.");
    }

    const keys = [
      "semanticSimilarity",
      "skillCoverage",
      "experienceCompatibility",
      "budgetCompatibility",
      "jobTypeCompatibility",
      "locationCompatibility",
    ] as const;
    for (const key of keys) {
      const val = weights[key];
      if (typeof val !== "number" || !Number.isFinite(val) || Number.isNaN(val)) {
        throw new Error(`Weight for ${key} must be a finite number.`);
      }
      if (val < 0) {
        throw new Error(`Weight for ${key} must be non-negative.`);
      }
    }

    this._weightProfileVersion = weightProfileVersion.trim();
    this._weights = Object.freeze({ ...weights });
    Object.freeze(this);
  }

  get weightProfileVersion(): string {
    return this._weightProfileVersion;
  }

  get weights(): SignalWeights {
    return this._weights;
  }

  public equals(other: ScoreWeightProfile): boolean {
    if (!other) {
      return false;
    }
    if (this._weightProfileVersion !== other.weightProfileVersion) {
      return false;
    }
    const w1 = this._weights;
    const w2 = other.weights;
    return (
      w1.semanticSimilarity === w2.semanticSimilarity &&
      w1.skillCoverage === w2.skillCoverage &&
      w1.experienceCompatibility === w2.experienceCompatibility &&
      w1.budgetCompatibility === w2.budgetCompatibility &&
      w1.jobTypeCompatibility === w2.jobTypeCompatibility &&
      w1.locationCompatibility === w2.locationCompatibility
    );
  }
}

export type MissingSignalPolicy = "fixed-denominator" | "available-weight" | "strict-validation";

export interface StateCompatibilityMapping {
  readonly COMPATIBLE: number;
  readonly PARTIAL: number;
  readonly INCOMPATIBLE: number;
  readonly UNKNOWN: number | undefined;
}

export interface ScoringConfigurationProperties {
  scoringVersion: string;
  weightProfile: ScoreWeightProfile;
  compatibilityMapping: StateCompatibilityMapping;
  missingSignalPolicy: MissingSignalPolicy;
  semanticSimilarityNormalization?: "raw" | "shift-to-positive" | undefined;
  scoreScale: "0-1" | "0-100" | "0-1000";
}

export class ScoringConfiguration {
  private readonly _scoringVersion: string;
  private readonly _weightProfile: ScoreWeightProfile;
  private readonly _compatibilityMapping: StateCompatibilityMapping;
  private readonly _missingSignalPolicy: MissingSignalPolicy;
  private readonly _semanticSimilarityNormalization: "raw" | "shift-to-positive";
  private readonly _scoreScale: "0-1" | "0-100" | "0-1000";

  constructor(properties: ScoringConfigurationProperties) {
    if (!properties.scoringVersion || properties.scoringVersion.trim() === "") {
      throw new Error("Scoring version is required.");
    }
    const versionPattern = /^v\d+$/;
    if (!versionPattern.test(properties.scoringVersion.trim())) {
      throw new Error(`Invalid scoring version format: ${properties.scoringVersion}`);
    }
    if (!properties.weightProfile) {
      throw new Error("Weight profile is required.");
    }
    if (!properties.compatibilityMapping) {
      throw new Error("Compatibility mapping is required.");
    }
    if (!properties.missingSignalPolicy) {
      throw new Error("Missing signal policy is required.");
    }
    if (!properties.scoreScale) {
      throw new Error("Score scale is required.");
    }

    const mapping = properties.compatibilityMapping;
    const states = ["COMPATIBLE", "PARTIAL", "INCOMPATIBLE"] as const;
    for (const state of states) {
      const val = mapping[state];
      if (typeof val !== "number" || !Number.isFinite(val) || Number.isNaN(val)) {
        throw new Error(`Mapping value for ${state} must be a finite number.`);
      }
    }
    if (mapping.UNKNOWN !== undefined) {
      if (
        typeof mapping.UNKNOWN !== "number" ||
        !Number.isFinite(mapping.UNKNOWN) ||
        Number.isNaN(mapping.UNKNOWN)
      ) {
        throw new Error("Mapping value for UNKNOWN must be a finite number or undefined.");
      }
    }

    this._scoringVersion = properties.scoringVersion.trim();
    this._weightProfile = properties.weightProfile;
    this._compatibilityMapping = Object.freeze({ ...properties.compatibilityMapping });
    this._missingSignalPolicy = properties.missingSignalPolicy;
    this._semanticSimilarityNormalization = properties.semanticSimilarityNormalization ?? "raw";
    this._scoreScale = properties.scoreScale;
    Object.freeze(this);
  }

  get scoringVersion(): string {
    return this._scoringVersion;
  }

  get weightProfile(): ScoreWeightProfile {
    return this._weightProfile;
  }

  get compatibilityMapping(): StateCompatibilityMapping {
    return { ...this._compatibilityMapping };
  }

  get missingSignalPolicy(): MissingSignalPolicy {
    return this._missingSignalPolicy;
  }

  get semanticSimilarityNormalization(): "raw" | "shift-to-positive" {
    return this._semanticSimilarityNormalization;
  }

  get scoreScale(): "0-1" | "0-100" | "0-1000" {
    return this._scoreScale;
  }
}

export interface SignalContributionProperties {
  signalName: string;
  rawValue: string | number | undefined;
  normalizedValue: number | undefined;
  weight: number;
  contribution: number | undefined;
  available: boolean;
}

export class SignalContribution {
  private readonly _signalName: string;
  private readonly _rawValue: string | number | undefined;
  private readonly _normalizedValue: number | undefined;
  private readonly _weight: number;
  private readonly _contribution: number | undefined;
  private readonly _available: boolean;

  constructor(properties: SignalContributionProperties) {
    if (!properties.signalName || properties.signalName.trim() === "") {
      throw new Error("Signal name is required.");
    }
    this._signalName = properties.signalName.trim();
    this._rawValue = properties.rawValue;
    this._normalizedValue = properties.normalizedValue;
    this._weight = properties.weight;
    this._contribution = properties.contribution;
    this._available = properties.available;
    Object.freeze(this);
  }

  get signalName(): string {
    return this._signalName;
  }

  get rawValue(): string | number | undefined {
    return this._rawValue;
  }

  get normalizedValue(): number | undefined {
    return this._normalizedValue;
  }

  get weight(): number {
    return this._weight;
  }

  get contribution(): number | undefined {
    return this._contribution;
  }

  get available(): boolean {
    return this._available;
  }
}

export class ScoreBreakdown {
  private readonly _contributions: SignalContribution[];

  constructor(contributions: SignalContribution[]) {
    if (!contributions || contributions.length === 0) {
      throw new Error("Contributions are required.");
    }
    this._contributions = [...contributions].map((c) => Object.freeze(c) as SignalContribution);
    Object.freeze(this._contributions);
    Object.freeze(this);
  }

  get contributions(): ReadonlyArray<SignalContribution> {
    return Object.freeze([...this._contributions]);
  }
}

export class ScoreFingerprint {
  private readonly _value: string;

  constructor(
    jobMatchId: string,
    matchingVersion: string,
    scoringVersion: string,
    weightProfileVersion: string,
  ) {
    if (!jobMatchId || jobMatchId.trim() === "") {
      throw new Error("jobMatchId is required for ScoreFingerprint.");
    }
    if (!matchingVersion || matchingVersion.trim() === "") {
      throw new Error("matchingVersion is required for ScoreFingerprint.");
    }
    if (!scoringVersion || scoringVersion.trim() === "") {
      throw new Error("scoringVersion is required for ScoreFingerprint.");
    }
    if (!weightProfileVersion || weightProfileVersion.trim() === "") {
      throw new Error("weightProfileVersion is required for ScoreFingerprint.");
    }

    this._value = `fp:${jobMatchId.trim()}:${matchingVersion.trim()}:${scoringVersion.trim()}:${weightProfileVersion.trim()}`;
    Object.freeze(this);
  }

  get value(): string {
    return this._value;
  }

  public equals(other: ScoreFingerprint): boolean {
    if (!other) {
      return false;
    }
    return this._value === other.value;
  }
}

// Deterministic Rounding Helper
export function roundToPrecision(value: number, decimals = 4): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

// ==========================================
// 2. SNAPSHOTS
// ==========================================

export interface JobMatchScoreSnapshotProperties {
  version: number;
  createdAt: Date;
  status: JobMatchScoreLifecycle;
  jobMatchId: string;
  matchingVersion: string;
  scoringVersion: string;
  weightProfileVersion: string;
  finalScore?: number | undefined;
  breakdown?: ScoreBreakdown | undefined;
  fingerprint?: ScoreFingerprint | undefined;
}

export class JobMatchScoreSnapshot {
  private readonly _version: number;
  private readonly _createdAt: Date;
  private readonly _status: JobMatchScoreLifecycle;
  private readonly _jobMatchId: string;
  private readonly _matchingVersion: string;
  private readonly _scoringVersion: string;
  private readonly _weightProfileVersion: string;
  private readonly _finalScore: number | undefined;
  private readonly _breakdown: ScoreBreakdown | undefined;
  private readonly _fingerprint: ScoreFingerprint | undefined;

  constructor(properties: JobMatchScoreSnapshotProperties) {
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
    if (!properties.matchingVersion || properties.matchingVersion.trim() === "") {
      throw new Error("Snapshot matchingVersion is required.");
    }
    if (!properties.scoringVersion || properties.scoringVersion.trim() === "") {
      throw new Error("Snapshot scoringVersion is required.");
    }
    if (!properties.weightProfileVersion || properties.weightProfileVersion.trim() === "") {
      throw new Error("Snapshot weightProfileVersion is required.");
    }

    this._version = properties.version;
    this._createdAt = new Date(properties.createdAt.getTime());
    this._status = properties.status;
    this._jobMatchId = properties.jobMatchId;
    this._matchingVersion = properties.matchingVersion;
    this._scoringVersion = properties.scoringVersion;
    this._weightProfileVersion = properties.weightProfileVersion;
    this._finalScore = properties.finalScore;
    this._breakdown = properties.breakdown;
    this._fingerprint = properties.fingerprint;
    Object.freeze(this);
  }

  get version(): number {
    return this._version;
  }

  get createdAt(): Date {
    return new Date(this._createdAt.getTime());
  }

  get status(): JobMatchScoreLifecycle {
    return this._status;
  }

  get jobMatchId(): string {
    return this._jobMatchId;
  }

  get matchingVersion(): string {
    return this._matchingVersion;
  }

  get scoringVersion(): string {
    return this._scoringVersion;
  }

  get weightProfileVersion(): string {
    return this._weightProfileVersion;
  }

  get finalScore(): number | undefined {
    return this._finalScore;
  }

  get breakdown(): ScoreBreakdown | undefined {
    return this._breakdown;
  }

  get fingerprint(): ScoreFingerprint | undefined {
    return this._fingerprint;
  }
}

// ==========================================
// 3. DOMAIN EVENTS
// ==========================================

export const JOB_MATCH_SCORE_CREATED = "JOB_MATCH_SCORE_CREATED";
export const JOB_MATCH_SCORE_CALCULATED = "JOB_MATCH_SCORE_CALCULATED";
export const JOB_MATCH_SCORE_ARCHIVED = "JOB_MATCH_SCORE_ARCHIVED";

export type JobMatchScoreDomainEventName =
  | typeof JOB_MATCH_SCORE_CREATED
  | typeof JOB_MATCH_SCORE_CALCULATED
  | typeof JOB_MATCH_SCORE_ARCHIVED;

export interface JobMatchScoreDomainEvent {
  readonly eventType: JobMatchScoreDomainEventName;
  readonly scoreId: string;
  readonly tenantId: string;
  readonly ownerId: string;
  readonly jobMatchId: string;
  readonly matchingVersion: string;
  readonly scoringVersion: string;
  readonly weightProfileVersion: string;
  readonly finalScore?: number | undefined;
  readonly snapshotVersion: number;
}

// ==========================================
// 4. PERSISTENCE CONTRACTS
// ==========================================

export interface JobMatchScorePersistenceContract {
  findByScoringIdentity(
    tenantId: string,
    jobMatchId: string,
    matchingVersion: string,
    scoringVersion: string,
    weightProfileVersion: string,
  ): Promise<JobMatchScore | null>;
}

export interface JobMatchScoreAggregateStore {
  save(score: JobMatchScore): Promise<void>;
  findById(id: string, tenantId: string): Promise<JobMatchScore | null>;
  findByScoringIdentity(
    tenantId: string,
    jobMatchId: string,
    matchingVersion: string,
    scoringVersion: string,
    weightProfileVersion: string,
  ): Promise<JobMatchScore | null>;
}

// 8D match signals shape for direct consumption
export interface MatchSignalsInput {
  readonly semanticSimilarity?: number | undefined;
  readonly matchedSkills: readonly string[];
  readonly missingSkills: readonly string[];
  readonly skillCoverage: number;
  readonly experienceCompatibility: "COMPATIBLE" | "PARTIAL" | "INCOMPATIBLE" | "UNKNOWN";
  readonly budgetCompatibility: "COMPATIBLE" | "PARTIAL" | "INCOMPATIBLE" | "UNKNOWN";
  readonly jobTypeCompatibility: "COMPATIBLE" | "INCOMPATIBLE" | "UNKNOWN";
  readonly locationCompatibility: "COMPATIBLE" | "PARTIAL" | "INCOMPATIBLE" | "UNKNOWN";
}

// ==========================================
// 5. AGGREGATE PROPERTIES
// ==========================================

export interface JobMatchScoreProperties {
  id: string;
  tenantId: string;
  ownerId: string;
  jobMatchId: string;
  matchingVersion: string;
  scoringVersion: string;
  weightProfileVersion: string;
  finalScore?: number | undefined;
  breakdown?: ScoreBreakdown | undefined;
  fingerprint?: ScoreFingerprint | undefined;
  status: JobMatchScoreLifecycle;
  snapshots: JobMatchScoreSnapshot[];
  createdAt: Date;
  updatedAt: Date;
}

// ==========================================
// 6. AGGREGATE ROOT
// ==========================================

export class JobMatchScore {
  private readonly _id: string;
  private readonly _tenantId: string;
  private readonly _ownerId: string;
  private readonly _jobMatchId: string;
  private readonly _matchingVersion: string;
  private readonly _scoringVersion: string;
  private readonly _weightProfileVersion: string;
  private _finalScore: number | undefined;
  private _breakdown: ScoreBreakdown | undefined;
  private _fingerprint: ScoreFingerprint | undefined;
  private _status: JobMatchScoreLifecycle;
  private readonly _snapshots: JobMatchScoreSnapshot[] = [];
  private readonly _createdAt: Date;
  private _updatedAt: Date;
  private _domainEvents: JobMatchScoreDomainEvent[] = [];

  constructor(properties: JobMatchScoreProperties) {
    if (!properties.id || properties.id.trim() === "") {
      throw new Error("Score Identity is required.");
    }
    if (!properties.tenantId || properties.tenantId.trim() === "") {
      throw new Error("Tenant Identity is required.");
    }
    if (!properties.ownerId || properties.ownerId.trim() === "") {
      throw new Error("Owner Identity is required.");
    }
    if (!properties.jobMatchId || properties.jobMatchId.trim() === "") {
      throw new Error("Job Match Identity reference is required.");
    }
    if (!properties.matchingVersion || properties.matchingVersion.trim() === "") {
      throw new Error("Matching version is required.");
    }
    if (!properties.scoringVersion || properties.scoringVersion.trim() === "") {
      throw new Error("Scoring version is required.");
    }
    if (!properties.weightProfileVersion || properties.weightProfileVersion.trim() === "") {
      throw new Error("Weight profile version is required.");
    }
    const versionPattern = /^v\d+$/;
    if (!versionPattern.test(properties.matchingVersion.trim())) {
      throw new Error(`Invalid matching version format: ${properties.matchingVersion}`);
    }
    if (!versionPattern.test(properties.scoringVersion.trim())) {
      throw new Error(`Invalid scoring version format: ${properties.scoringVersion}`);
    }
    if (!versionPattern.test(properties.weightProfileVersion.trim())) {
      throw new Error(`Invalid weight profile version format: ${properties.weightProfileVersion}`);
    }
    if (!properties.status) {
      throw new Error("Lifecycle status is required.");
    }
    if (
      properties.status !== "CREATED" &&
      properties.status !== "CALCULATED" &&
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
    this._matchingVersion = properties.matchingVersion.trim();
    this._scoringVersion = properties.scoringVersion.trim();
    this._weightProfileVersion = properties.weightProfileVersion.trim();
    this._finalScore = properties.finalScore;
    this._breakdown = properties.breakdown;
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

  get jobMatchId(): string {
    return this._jobMatchId;
  }

  get matchingVersion(): string {
    return this._matchingVersion;
  }

  get scoringVersion(): string {
    return this._scoringVersion;
  }

  get weightProfileVersion(): string {
    return this._weightProfileVersion;
  }

  get finalScore(): number | undefined {
    return this._finalScore;
  }

  get breakdown(): ScoreBreakdown | undefined {
    return this._breakdown;
  }

  get fingerprint(): ScoreFingerprint | undefined {
    return this._fingerprint;
  }

  get status(): JobMatchScoreLifecycle {
    return this._status;
  }

  get snapshots(): ReadonlyArray<JobMatchScoreSnapshot> {
    return Object.freeze([...this._snapshots]);
  }

  get createdAt(): Date {
    return new Date(this._createdAt.getTime());
  }

  get updatedAt(): Date {
    return new Date(this._updatedAt.getTime());
  }

  get domainEvents(): ReadonlyArray<JobMatchScoreDomainEvent> {
    return Object.freeze([...this._domainEvents]);
  }

  public clearDomainEvents(): void {
    this._domainEvents = [];
  }

  private addDomainEvent(event: JobMatchScoreDomainEvent): void {
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
    const newSnapshot = new JobMatchScoreSnapshot({
      version: nextVersion,
      createdAt: new Date(),
      status: this._status,
      jobMatchId: this._jobMatchId,
      matchingVersion: this._matchingVersion,
      scoringVersion: this._scoringVersion,
      weightProfileVersion: this._weightProfileVersion,
      finalScore: this._finalScore,
      breakdown: this._breakdown,
      fingerprint: this._fingerprint,
    });
    this._snapshots.push(newSnapshot);
  }

  // Factory Creation Method
  public static create(
    id: string,
    tenantId: string,
    ownerId: string,
    jobMatchId: string,
    matchingVersion: string,
    scoringVersion: string,
    weightProfileVersion: string,
  ): JobMatchScore {
    const now = new Date();
    const score = new JobMatchScore({
      id,
      tenantId,
      ownerId,
      jobMatchId,
      matchingVersion,
      scoringVersion,
      weightProfileVersion,
      status: "CREATED",
      snapshots: [],
      createdAt: now,
      updatedAt: now,
    });

    score.appendSnapshot();
    score.addDomainEvent({
      eventType: JOB_MATCH_SCORE_CREATED,
      scoreId: score.id,
      tenantId: score.tenantId,
      ownerId: score.ownerId,
      jobMatchId: score.jobMatchId,
      matchingVersion: score.matchingVersion,
      scoringVersion: score.scoringVersion,
      weightProfileVersion: score.weightProfileVersion,
      snapshotVersion: score.snapshots.length,
    });

    return score;
  }

  // Domain Transitions

  private transitionTo(nextStatus: JobMatchScoreLifecycle): void {
    if (this._status === "ARCHIVED") {
      throw new Error(`Invalid lifecycle transition from ARCHIVED to ${nextStatus.toUpperCase()}`);
    }

    if (nextStatus === "CALCULATED") {
      if (this._status !== "CREATED") {
        throw new Error(
          `Invalid lifecycle transition from ${this._status.toUpperCase()} to CALCULATED`,
        );
      }
    } else if (nextStatus === "CREATED") {
      throw new Error(`Invalid lifecycle transition from ${this._status.toUpperCase()} to CREATED`);
    }

    this._status = nextStatus;
    this._updatedAt = new Date();
    this.appendSnapshot();
  }

  public calculate(
    actorOwnerId: string,
    matchSignals: MatchSignalsInput,
    scoringConfiguration: ScoringConfiguration,
  ): void {
    this.verifyOwnership(actorOwnerId);
    if (this._status !== "CREATED") {
      throw new Error(`Invalid lifecycle transition from ${this._status} to CALCULATED`);
    }
    if (scoringConfiguration.scoringVersion !== this._scoringVersion) {
      throw new Error("Scoring version mismatch.");
    }
    if (scoringConfiguration.weightProfile.weightProfileVersion !== this._weightProfileVersion) {
      throw new Error("Weight profile version mismatch.");
    }

    const weights = scoringConfiguration.weightProfile.weights;
    const mapping = scoringConfiguration.compatibilityMapping;
    const policy = scoringConfiguration.missingSignalPolicy;

    const signalKeys = [
      "semanticSimilarity",
      "skillCoverage",
      "experienceCompatibility",
      "budgetCompatibility",
      "jobTypeCompatibility",
      "locationCompatibility",
    ] as const;

    const contributions: SignalContribution[] = [];
    let weightedSum = 0;
    let totalWeights = 0;

    for (const key of signalKeys) {
      const rawValue = matchSignals[key];
      const weight = weights[key];

      // Availability and UNKNOWN/absence resolution
      let available = true;
      if (rawValue === undefined) {
        available = false;
      } else if (rawValue === "UNKNOWN" && mapping.UNKNOWN === undefined) {
        available = false;
      }

      if (!available) {
        if (policy === "strict-validation") {
          throw new Error(`Strict validation policy failed: missing required signal ${key}`);
        }

        // Normalized value and contribution under policy models
        let normalizedValue: number | undefined = undefined;
        let contribution: number | undefined = undefined;

        if (policy === "fixed-denominator") {
          normalizedValue = mapping.UNKNOWN ?? 0;
          contribution = normalizedValue * weight;
          weightedSum += contribution;
          totalWeights += weight;
        }

        contributions.push(
          new SignalContribution({
            signalName: key,
            rawValue: typeof rawValue === "number" ? rawValue : (rawValue as string | undefined),
            normalizedValue,
            weight,
            contribution,
            available: false,
          }),
        );
      } else {
        // Value is available - Perform Normalization
        let normalizedValue = 0;

        if (key === "semanticSimilarity") {
          const val = rawValue as number;
          if (typeof val !== "number" || !Number.isFinite(val) || Number.isNaN(val)) {
            throw new Error("Semantic similarity value is not a finite number.");
          }
          if (val < -1 || val > 1) {
            throw new Error("Semantic similarity value must be between -1 and 1.");
          }

          if (scoringConfiguration.semanticSimilarityNormalization === "shift-to-positive") {
            normalizedValue = (val + 1) / 2;
          } else {
            normalizedValue = val;
          }
        } else if (key === "skillCoverage") {
          const val = rawValue as number;
          if (typeof val !== "number" || !Number.isFinite(val) || Number.isNaN(val)) {
            throw new Error("Skill coverage value is not a finite number.");
          }
          if (val < 0 || val > 1) {
            throw new Error("Skill coverage value must be between 0 and 1.");
          }
          normalizedValue = val;
        } else {
          // Compatibility status lookup mapping
          const status = (rawValue as string).toUpperCase();
          if (status === "UNKNOWN") {
            normalizedValue = mapping.UNKNOWN ?? 0;
          } else if (status === "COMPATIBLE") {
            normalizedValue = mapping.COMPATIBLE;
          } else if (status === "PARTIAL") {
            normalizedValue = mapping.PARTIAL;
          } else if (status === "INCOMPATIBLE") {
            normalizedValue = mapping.INCOMPATIBLE;
          } else {
            throw new Error(`Invalid compatibility state: ${rawValue}`);
          }
        }

        const contribution = normalizedValue * weight;
        weightedSum += contribution;
        totalWeights += weight;

        contributions.push(
          new SignalContribution({
            signalName: key,
            rawValue: typeof rawValue === "number" ? rawValue : (rawValue as string | undefined),
            normalizedValue,
            weight,
            contribution,
            available: true,
          }),
        );
      }
    }

    // Deterministic combination logic
    let rawScore = 0;
    if (totalWeights > 0) {
      rawScore = weightedSum / totalWeights;
    }

    // Scaling application
    if (scoringConfiguration.scoreScale === "0-100") {
      rawScore = rawScore * 100;
    } else if (scoringConfiguration.scoreScale === "0-1000") {
      rawScore = rawScore * 1000;
    }

    this._finalScore = roundToPrecision(rawScore, 4);
    this._breakdown = new ScoreBreakdown(contributions);
    this._fingerprint = new ScoreFingerprint(
      this._jobMatchId,
      this._matchingVersion,
      this._scoringVersion,
      this._weightProfileVersion,
    );

    this.transitionTo("CALCULATED");

    this.addDomainEvent({
      eventType: JOB_MATCH_SCORE_CALCULATED,
      scoreId: this._id,
      tenantId: this._tenantId,
      ownerId: this._ownerId,
      jobMatchId: this._jobMatchId,
      matchingVersion: this._matchingVersion,
      scoringVersion: this._scoringVersion,
      weightProfileVersion: this._weightProfileVersion,
      finalScore: this._finalScore,
      snapshotVersion: this._snapshots.length,
    });
  }

  public archive(actorOwnerId: string): void {
    this.verifyOwnership(actorOwnerId);
    if (this._status === "ARCHIVED") {
      throw new Error("Job match score is already archived.");
    }
    this.transitionTo("ARCHIVED");

    this.addDomainEvent({
      eventType: JOB_MATCH_SCORE_ARCHIVED,
      scoreId: this._id,
      tenantId: this._tenantId,
      ownerId: this._ownerId,
      jobMatchId: this._jobMatchId,
      matchingVersion: this._matchingVersion,
      scoringVersion: this._scoringVersion,
      weightProfileVersion: this._weightProfileVersion,
      finalScore: this._finalScore,
      snapshotVersion: this._snapshots.length,
    });
  }
}
