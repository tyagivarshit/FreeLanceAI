export type JobMatchRankingLifecycle = "CREATED" | "RANKED" | "ARCHIVED";

// ==========================================
// 1. VALUE OBJECTS
// ==========================================

export class JobMatchRankingPolicy {
  private readonly _rankingPolicyVersion: string;
  private readonly _primaryOrdering: string;
  private readonly _tieBreakPolicy: string;
  private readonly _rankNumberingConvention: string;

  constructor(
    rankingPolicyVersion: string,
    primaryOrdering: string,
    tieBreakPolicy: string,
    rankNumberingConvention: string,
  ) {
    if (!rankingPolicyVersion || rankingPolicyVersion.trim() === "") {
      throw new Error("Ranking policy version is required.");
    }
    const versionPattern = /^v\d+$/;
    if (!versionPattern.test(rankingPolicyVersion.trim())) {
      throw new Error(`Invalid ranking policy version format: ${rankingPolicyVersion}`);
    }
    if (!primaryOrdering || primaryOrdering.trim() === "") {
      throw new Error("Primary ordering is required.");
    }
    if (!tieBreakPolicy || tieBreakPolicy.trim() === "") {
      throw new Error("Tie break policy is required.");
    }
    if (!rankNumberingConvention || rankNumberingConvention.trim() === "") {
      throw new Error("Rank numbering convention is required.");
    }

    this._rankingPolicyVersion = rankingPolicyVersion.trim();
    this._primaryOrdering = primaryOrdering.trim();
    this._tieBreakPolicy = tieBreakPolicy.trim();
    this._rankNumberingConvention = rankNumberingConvention.trim();
    Object.freeze(this);
  }

  get rankingPolicyVersion(): string {
    return this._rankingPolicyVersion;
  }

  get primaryOrdering(): string {
    return this._primaryOrdering;
  }

  get tieBreakPolicy(): string {
    return this._tieBreakPolicy;
  }

  get rankNumberingConvention(): string {
    return this._rankNumberingConvention;
  }
}

export interface RankedMatchProperties {
  matchId: string;
  scoreId: string;
  rank: number;
  finalScore: number;
  tieBreakerKey: string;
  matchingVersion: string;
  scoringVersion: string;
  weightProfileVersion: string;
}

export class RankedMatch {
  private readonly _matchId: string;
  private readonly _scoreId: string;
  private readonly _rank: number;
  private readonly _finalScore: number;
  private readonly _tieBreakerKey: string;
  private readonly _matchingVersion: string;
  private readonly _scoringVersion: string;
  private readonly _weightProfileVersion: string;

  constructor(properties: RankedMatchProperties) {
    if (!properties.matchId || properties.matchId.trim() === "") {
      throw new Error("matchId is required for RankedMatch.");
    }
    if (!properties.scoreId || properties.scoreId.trim() === "") {
      throw new Error("scoreId is required for RankedMatch.");
    }
    if (
      typeof properties.rank !== "number" ||
      properties.rank <= 0 ||
      !Number.isInteger(properties.rank)
    ) {
      throw new Error("rank must be a positive integer starting at 1.");
    }
    if (
      typeof properties.finalScore !== "number" ||
      !Number.isFinite(properties.finalScore) ||
      Number.isNaN(properties.finalScore)
    ) {
      throw new Error("finalScore must be a finite number.");
    }
    if (!properties.tieBreakerKey || properties.tieBreakerKey.trim() === "") {
      throw new Error("tieBreakerKey is required for RankedMatch.");
    }
    if (!properties.matchingVersion || properties.matchingVersion.trim() === "") {
      throw new Error("matchingVersion is required for RankedMatch.");
    }
    if (!properties.scoringVersion || properties.scoringVersion.trim() === "") {
      throw new Error("scoringVersion is required for RankedMatch.");
    }
    if (!properties.weightProfileVersion || properties.weightProfileVersion.trim() === "") {
      throw new Error("weightProfileVersion is required for RankedMatch.");
    }

    this._matchId = properties.matchId.trim();
    this._scoreId = properties.scoreId.trim();
    this._rank = properties.rank;
    this._finalScore = properties.finalScore;
    this._tieBreakerKey = properties.tieBreakerKey.trim();
    this._matchingVersion = properties.matchingVersion.trim();
    this._scoringVersion = properties.scoringVersion.trim();
    this._weightProfileVersion = properties.weightProfileVersion.trim();
    Object.freeze(this);
  }

  get matchId(): string {
    return this._matchId;
  }

  get scoreId(): string {
    return this._scoreId;
  }

  get rank(): number {
    return this._rank;
  }

  get finalScore(): number {
    return this._finalScore;
  }

  get tieBreakerKey(): string {
    return this._tieBreakerKey;
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
}

export class RankingFingerprint {
  private readonly _value: string;

  constructor(properties: {
    rankingSubjectId: string;
    tenantId: string;
    candidateSetIdentity: string;
    candidateScoreIdentities: string;
    matchingVersion: string;
    scoringVersion: string;
    rankingVersion: string;
    rankingPolicyVersion: string;
  }) {
    if (!properties.rankingSubjectId || properties.rankingSubjectId.trim() === "") {
      throw new Error("rankingSubjectId is required for RankingFingerprint.");
    }
    if (!properties.tenantId || properties.tenantId.trim() === "") {
      throw new Error("tenantId is required for RankingFingerprint.");
    }
    if (!properties.candidateSetIdentity || properties.candidateSetIdentity.trim() === "") {
      throw new Error("candidateSetIdentity is required for RankingFingerprint.");
    }
    if (
      properties.candidateScoreIdentities === undefined ||
      properties.candidateScoreIdentities === null
    ) {
      throw new Error("candidateScoreIdentities is required for RankingFingerprint.");
    }
    if (!properties.matchingVersion || properties.matchingVersion.trim() === "") {
      throw new Error("matchingVersion is required for RankingFingerprint.");
    }
    if (!properties.scoringVersion || properties.scoringVersion.trim() === "") {
      throw new Error("scoringVersion is required for RankingFingerprint.");
    }
    if (!properties.rankingVersion || properties.rankingVersion.trim() === "") {
      throw new Error("rankingVersion is required for RankingFingerprint.");
    }
    if (!properties.rankingPolicyVersion || properties.rankingPolicyVersion.trim() === "") {
      throw new Error("rankingPolicyVersion is required for RankingFingerprint.");
    }

    this._value = `rkfp:${properties.rankingSubjectId.trim()}:${properties.tenantId.trim()}:${properties.candidateSetIdentity.trim()}:${properties.candidateScoreIdentities.trim()}:${properties.matchingVersion.trim()}:${properties.scoringVersion.trim()}:${properties.rankingVersion.trim()}:${properties.rankingPolicyVersion.trim()}`;
    Object.freeze(this);
  }

  get value(): string {
    return this._value;
  }

  public equals(other: RankingFingerprint): boolean {
    if (!other) {
      return false;
    }
    return this._value === other.value;
  }
}

export function buildCandidateSetIdentity(matchIds: string[]): string {
  const sorted = [...matchIds].sort();
  return `set:${sorted.join(",")}`;
}

// ==========================================
// 2. SNAPSHOTS
// ==========================================

export interface JobMatchRankingSnapshotProperties {
  version: number;
  createdAt: Date;
  status: JobMatchRankingLifecycle;
  rankingSubjectId: string;
  matchingVersion: string;
  scoringVersion: string;
  rankingVersion: string;
  rankingPolicyVersion: string;
  rankedEntries?: RankedMatch[] | undefined;
  candidateCount: number;
  candidateSetIdentity: string;
  rankingFingerprint?: RankingFingerprint | undefined;
}

export class JobMatchRankingSnapshot {
  private readonly _version: number;
  private readonly _createdAt: Date;
  private readonly _status: JobMatchRankingLifecycle;
  private readonly _rankingSubjectId: string;
  private readonly _matchingVersion: string;
  private readonly _scoringVersion: string;
  private readonly _rankingVersion: string;
  private readonly _rankingPolicyVersion: string;
  private readonly _rankedEntries: RankedMatch[] | undefined;
  private readonly _candidateCount: number;
  private readonly _candidateSetIdentity: string;
  private readonly _rankingFingerprint: RankingFingerprint | undefined;

  constructor(properties: JobMatchRankingSnapshotProperties) {
    if (properties.version <= 0) {
      throw new Error("Snapshot version must be greater than zero.");
    }
    if (!properties.createdAt) {
      throw new Error("Snapshot creation date is required.");
    }
    if (!properties.status) {
      throw new Error("Snapshot status is required.");
    }
    if (!properties.rankingSubjectId || properties.rankingSubjectId.trim() === "") {
      throw new Error("Snapshot rankingSubjectId is required.");
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
    if (!properties.rankingPolicyVersion || properties.rankingPolicyVersion.trim() === "") {
      throw new Error("Snapshot rankingPolicyVersion is required.");
    }

    this._version = properties.version;
    this._createdAt = new Date(properties.createdAt.getTime());
    this._status = properties.status;
    this._rankingSubjectId = properties.rankingSubjectId;
    this._matchingVersion = properties.matchingVersion;
    this._scoringVersion = properties.scoringVersion;
    this._rankingVersion = properties.rankingVersion;
    this._rankingPolicyVersion = properties.rankingPolicyVersion;
    this._rankedEntries = properties.rankedEntries
      ? [...properties.rankedEntries].map((r) => Object.freeze(r) as RankedMatch)
      : undefined;
    this._candidateCount = properties.candidateCount;
    this._candidateSetIdentity = properties.candidateSetIdentity;
    this._rankingFingerprint = properties.rankingFingerprint;
    Object.freeze(this._rankedEntries);
    Object.freeze(this);
  }

  get version(): number {
    return this._version;
  }

  get createdAt(): Date {
    return new Date(this._createdAt.getTime());
  }

  get status(): JobMatchRankingLifecycle {
    return this._status;
  }

  get rankingSubjectId(): string {
    return this._rankingSubjectId;
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

  get rankingPolicyVersion(): string {
    return this._rankingPolicyVersion;
  }

  get rankedEntries(): readonly RankedMatch[] | undefined {
    return this._rankedEntries;
  }

  get candidateCount(): number {
    return this._candidateCount;
  }

  get candidateSetIdentity(): string {
    return this._candidateSetIdentity;
  }

  get rankingFingerprint(): RankingFingerprint | undefined {
    return this._rankingFingerprint;
  }
}

// ==========================================
// 3. DOMAIN EVENTS
// ==========================================

export const JOB_MATCH_RANKING_CREATED = "JOB_MATCH_RANKING_CREATED";
export const JOB_MATCH_RANKING_COMPLETED = "JOB_MATCH_RANKING_COMPLETED";
export const JOB_MATCH_RANKING_ARCHIVED = "JOB_MATCH_RANKING_ARCHIVED";

export type JobMatchRankingDomainEventName =
  | typeof JOB_MATCH_RANKING_CREATED
  | typeof JOB_MATCH_RANKING_COMPLETED
  | typeof JOB_MATCH_RANKING_ARCHIVED;

export interface JobMatchRankingDomainEvent {
  readonly eventType: JobMatchRankingDomainEventName;
  readonly rankingId: string;
  readonly tenantId: string;
  readonly ownerId: string;
  readonly rankingSubjectId: string;
  readonly matchingVersion: string;
  readonly scoringVersion: string;
  readonly rankingVersion: string;
  readonly rankingPolicyVersion: string;
  readonly candidateCount: number;
  readonly rankingFingerprint?: string | undefined;
  readonly snapshotVersion: number;
}

// ==========================================
// 4. PERSISTENCE CONTRACTS
// ==========================================

export interface JobMatchRankingPersistenceContract {
  findByRankingIdentity(
    tenantId: string,
    rankingSubjectId: string,
    candidateSetIdentity: string,
    matchingVersion: string,
    scoringVersion: string,
    rankingVersion: string,
    rankingPolicyVersion: string,
  ): Promise<JobMatchRanking | null>;
}

export interface JobMatchRankingAggregateStore {
  save(ranking: JobMatchRanking): Promise<void>;
  findById(id: string, tenantId: string): Promise<JobMatchRanking | null>;
  findByRankingIdentity(
    tenantId: string,
    rankingSubjectId: string,
    candidateSetIdentity: string,
    matchingVersion: string,
    scoringVersion: string,
    rankingVersion: string,
    rankingPolicyVersion: string,
  ): Promise<JobMatchRanking | null>;
}

// Scored match input layout
export interface ScoredMatchInput {
  readonly matchId: string;
  readonly scoreId: string;
  readonly tenantId: string;
  readonly finalScore: number;
  readonly tieBreakerKey: string;
  readonly matchingVersion: string;
  readonly scoringVersion: string;
  readonly weightProfileVersion: string;
}

// ==========================================
// 5. AGGREGATE PROPERTIES
// ==========================================

export interface JobMatchRankingProperties {
  id: string;
  tenantId: string;
  ownerId: string;
  rankingSubjectId: string;
  matchingVersion: string;
  scoringVersion: string;
  rankingVersion: string;
  rankingPolicyVersion: string;
  rankedEntries?: RankedMatch[] | undefined;
  candidateCount: number;
  candidateSetIdentity: string;
  rankingFingerprint?: RankingFingerprint | undefined;
  status: JobMatchRankingLifecycle;
  snapshots: JobMatchRankingSnapshot[];
  createdAt: Date;
  updatedAt: Date;
}

// ==========================================
// 6. AGGREGATE ROOT
// ==========================================

export class JobMatchRanking {
  private readonly _id: string;
  private readonly _tenantId: string;
  private readonly _ownerId: string;
  private readonly _rankingSubjectId: string;
  private readonly _matchingVersion: string;
  private readonly _scoringVersion: string;
  private readonly _rankingVersion: string;
  private readonly _rankingPolicyVersion: string;
  private _rankedEntries: RankedMatch[] | undefined;
  private readonly _candidateCount: number;
  private readonly _candidateSetIdentity: string;
  private _rankingFingerprint: RankingFingerprint | undefined;
  private _status: JobMatchRankingLifecycle;
  private readonly _snapshots: JobMatchRankingSnapshot[] = [];
  private readonly _createdAt: Date;
  private _updatedAt: Date;
  private _domainEvents: JobMatchRankingDomainEvent[] = [];

  constructor(properties: JobMatchRankingProperties) {
    if (!properties.id || properties.id.trim() === "") {
      throw new Error("Ranking Identity is required.");
    }
    if (!properties.tenantId || properties.tenantId.trim() === "") {
      throw new Error("Tenant Identity is required.");
    }
    if (!properties.ownerId || properties.ownerId.trim() === "") {
      throw new Error("Owner Identity is required.");
    }
    if (!properties.rankingSubjectId || properties.rankingSubjectId.trim() === "") {
      throw new Error("Ranking subject is required.");
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
    if (!properties.rankingPolicyVersion || properties.rankingPolicyVersion.trim() === "") {
      throw new Error("Ranking policy version is required.");
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
    if (!versionPattern.test(properties.rankingPolicyVersion.trim())) {
      throw new Error(`Invalid ranking policy version format: ${properties.rankingPolicyVersion}`);
    }
    if (properties.candidateCount < 0) {
      throw new Error("Candidate count cannot be negative.");
    }
    if (!properties.candidateSetIdentity || properties.candidateSetIdentity.trim() === "") {
      throw new Error("Candidate set identity is required.");
    }
    if (!properties.status) {
      throw new Error("Lifecycle status is required.");
    }
    if (
      properties.status !== "CREATED" &&
      properties.status !== "RANKED" &&
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
    this._rankingSubjectId = properties.rankingSubjectId;
    this._matchingVersion = properties.matchingVersion.trim();
    this._scoringVersion = properties.scoringVersion.trim();
    this._rankingVersion = properties.rankingVersion.trim();
    this._rankingPolicyVersion = properties.rankingPolicyVersion.trim();
    this._rankedEntries = properties.rankedEntries ? [...properties.rankedEntries] : undefined;
    this._candidateCount = properties.candidateCount;
    this._candidateSetIdentity = properties.candidateSetIdentity;
    this._rankingFingerprint = properties.rankingFingerprint;
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

  get rankingSubjectId(): string {
    return this._rankingSubjectId;
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

  get rankingPolicyVersion(): string {
    return this._rankingPolicyVersion;
  }

  get rankedEntries(): readonly RankedMatch[] | undefined {
    return this._rankedEntries ? Object.freeze([...this._rankedEntries]) : undefined;
  }

  get candidateCount(): number {
    return this._candidateCount;
  }

  get candidateSetIdentity(): string {
    return this._candidateSetIdentity;
  }

  get rankingFingerprint(): RankingFingerprint | undefined {
    return this._rankingFingerprint;
  }

  get status(): JobMatchRankingLifecycle {
    return this._status;
  }

  get snapshots(): ReadonlyArray<JobMatchRankingSnapshot> {
    return Object.freeze([...this._snapshots]);
  }

  get createdAt(): Date {
    return new Date(this._createdAt.getTime());
  }

  get updatedAt(): Date {
    return new Date(this._updatedAt.getTime());
  }

  get domainEvents(): ReadonlyArray<JobMatchRankingDomainEvent> {
    return Object.freeze([...this._domainEvents]);
  }

  public clearDomainEvents(): void {
    this._domainEvents = [];
  }

  private addDomainEvent(event: JobMatchRankingDomainEvent): void {
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
    const newSnapshot = new JobMatchRankingSnapshot({
      version: nextVersion,
      createdAt: new Date(),
      status: this._status,
      rankingSubjectId: this._rankingSubjectId,
      matchingVersion: this._matchingVersion,
      scoringVersion: this._scoringVersion,
      rankingVersion: this._rankingVersion,
      rankingPolicyVersion: this._rankingPolicyVersion,
      rankedEntries: this._rankedEntries,
      candidateCount: this._candidateCount,
      candidateSetIdentity: this._candidateSetIdentity,
      rankingFingerprint: this._rankingFingerprint,
    });
    this._snapshots.push(newSnapshot);
  }

  // Factory Creation Method
  public static create(
    id: string,
    tenantId: string,
    ownerId: string,
    rankingSubjectId: string,
    matchingVersion: string,
    scoringVersion: string,
    rankingVersion: string,
    rankingPolicyVersion: string,
    candidateMatchIds: string[],
  ): JobMatchRanking {
    const now = new Date();
    if (!candidateMatchIds) {
      throw new Error("Candidate match IDs set is required.");
    }

    // Verify candidate uniqueness
    const idSet = new Set<string>();
    for (const matchId of candidateMatchIds) {
      if (!matchId || matchId.trim() === "") {
        throw new Error("Match ID must be a non-empty string.");
      }
      if (idSet.has(matchId)) {
        throw new Error("Duplicate matches are rejected.");
      }
      idSet.add(matchId);
    }

    const candidateCount = candidateMatchIds.length;
    const candidateSetIdentity = buildCandidateSetIdentity(candidateMatchIds);

    const ranking = new JobMatchRanking({
      id,
      tenantId,
      ownerId,
      rankingSubjectId,
      matchingVersion,
      scoringVersion,
      rankingVersion,
      rankingPolicyVersion,
      status: "CREATED",
      candidateCount,
      candidateSetIdentity,
      snapshots: [],
      createdAt: now,
      updatedAt: now,
    });

    ranking.appendSnapshot();
    ranking.addDomainEvent({
      eventType: JOB_MATCH_RANKING_CREATED,
      rankingId: ranking.id,
      tenantId: ranking.tenantId,
      ownerId: ranking.ownerId,
      rankingSubjectId: ranking.rankingSubjectId,
      matchingVersion: ranking.matchingVersion,
      scoringVersion: ranking.scoringVersion,
      rankingVersion: ranking.rankingVersion,
      rankingPolicyVersion: ranking.rankingPolicyVersion,
      candidateCount: ranking.candidateCount,
      snapshotVersion: ranking.snapshots.length,
    });

    return ranking;
  }

  // Domain Transitions

  private transitionTo(nextStatus: JobMatchRankingLifecycle): void {
    if (this._status === "ARCHIVED") {
      throw new Error(`Invalid lifecycle transition from ARCHIVED to ${nextStatus.toUpperCase()}`);
    }

    if (nextStatus === "RANKED") {
      if (this._status !== "CREATED") {
        throw new Error(
          `Invalid lifecycle transition from ${this._status.toUpperCase()} to RANKED`,
        );
      }
    } else if (nextStatus === "CREATED") {
      throw new Error(`Invalid lifecycle transition from ${this._status.toUpperCase()} to CREATED`);
    }

    this._status = nextStatus;
    this._updatedAt = new Date();
    this.appendSnapshot();
  }

  public rank(
    actorOwnerId: string,
    scoredMatches: ScoredMatchInput[],
    rankingPolicy: JobMatchRankingPolicy,
  ): void {
    this.verifyOwnership(actorOwnerId);
    if (this._status !== "CREATED") {
      throw new Error(`Invalid lifecycle transition from ${this._status} to RANKED`);
    }
    if (rankingPolicy.rankingPolicyVersion !== this._rankingPolicyVersion) {
      throw new Error("Ranking policy version mismatch.");
    }
    if (!scoredMatches) {
      throw new Error("Scored matches are required.");
    }

    // Candidate set validations
    if (scoredMatches.length !== this._candidateCount) {
      throw new Error("Candidate matches array count mismatch.");
    }

    const inputMatchIds = scoredMatches.map((m) => m.matchId);
    const inputSetIdentity = buildCandidateSetIdentity(inputMatchIds);
    if (inputSetIdentity !== this._candidateSetIdentity) {
      throw new Error("Candidate matches set identity mismatch.");
    }

    const scoreIds: string[] = [];

    // Candidate score consistency checks
    for (const match of scoredMatches) {
      if (match.tenantId !== this._tenantId) {
        throw new Error("Tenant isolation violation: candidate belongs to different tenant.");
      }
      if (match.matchingVersion !== this._matchingVersion) {
        throw new Error("Score matchingVersion mismatch.");
      }
      if (match.scoringVersion !== this._scoringVersion) {
        throw new Error("Score scoringVersion mismatch.");
      }
      if (
        typeof match.finalScore !== "number" ||
        !Number.isFinite(match.finalScore) ||
        Number.isNaN(match.finalScore)
      ) {
        throw new Error("Candidate match score must be a finite number.");
      }
      if (!match.tieBreakerKey || match.tieBreakerKey.trim() === "") {
        throw new Error("Candidate tieBreakerKey is required.");
      }
      scoreIds.push(match.scoreId);
    }

    // Deterministic Comparator Sort
    const sorted = [...scoredMatches].sort((a, b) => {
      // 1. Primary ordering: finalScore DESC
      if (a.finalScore !== b.finalScore) {
        return b.finalScore - a.finalScore;
      }
      // 2. Deterministic tieBreakerKey ASC
      if (a.tieBreakerKey !== b.tieBreakerKey) {
        return a.tieBreakerKey < b.tieBreakerKey ? -1 : 1;
      }
      // 3. deterministic matchId ASC
      return a.matchId < b.matchId ? -1 : a.matchId > b.matchId ? 1 : 0;
    });

    // Assign ordinal ranks starting at 1
    const entries: RankedMatch[] = [];
    let rank = 1;
    for (const item of sorted) {
      entries.push(
        new RankedMatch({
          matchId: item.matchId,
          scoreId: item.scoreId,
          rank: rank,
          finalScore: item.finalScore,
          tieBreakerKey: item.tieBreakerKey,
          matchingVersion: item.matchingVersion,
          scoringVersion: item.scoringVersion,
          weightProfileVersion: item.weightProfileVersion,
        }),
      );
      rank++;
    }

    const scoreIdsIdentity = [...scoreIds].sort().join(",");

    this._rankedEntries = entries;
    this._rankingFingerprint = new RankingFingerprint({
      rankingSubjectId: this._rankingSubjectId,
      tenantId: this._tenantId,
      candidateSetIdentity: this._candidateSetIdentity,
      candidateScoreIdentities: scoreIdsIdentity,
      matchingVersion: this._matchingVersion,
      scoringVersion: this._scoringVersion,
      rankingVersion: this._rankingVersion,
      rankingPolicyVersion: this._rankingPolicyVersion,
    });

    this.transitionTo("RANKED");

    this.addDomainEvent({
      eventType: JOB_MATCH_RANKING_COMPLETED,
      rankingId: this._id,
      tenantId: this._tenantId,
      ownerId: this._ownerId,
      rankingSubjectId: this._rankingSubjectId,
      matchingVersion: this._matchingVersion,
      scoringVersion: this._scoringVersion,
      rankingVersion: this._rankingVersion,
      rankingPolicyVersion: this._rankingPolicyVersion,
      candidateCount: this._candidateCount,
      rankingFingerprint: this._rankingFingerprint.value,
      snapshotVersion: this._snapshots.length,
    });
  }

  public archive(actorOwnerId: string): void {
    this.verifyOwnership(actorOwnerId);
    if (this._status === "ARCHIVED") {
      throw new Error("Job match ranking is already archived.");
    }
    this.transitionTo("ARCHIVED");

    this.addDomainEvent({
      eventType: JOB_MATCH_RANKING_ARCHIVED,
      rankingId: this._id,
      tenantId: this._tenantId,
      ownerId: this._ownerId,
      rankingSubjectId: this._rankingSubjectId,
      matchingVersion: this._matchingVersion,
      scoringVersion: this._scoringVersion,
      rankingVersion: this._rankingVersion,
      rankingPolicyVersion: this._rankingPolicyVersion,
      candidateCount: this._candidateCount,
      rankingFingerprint: this._rankingFingerprint ? this._rankingFingerprint.value : undefined,
      snapshotVersion: this._snapshots.length,
    });
  }
}
