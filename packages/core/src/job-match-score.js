export class ScoreWeightProfile {
    _weightProfileVersion;
    _weights;
    constructor(weightProfileVersion, weights) {
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
        ];
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
    get weightProfileVersion() {
        return this._weightProfileVersion;
    }
    get weights() {
        return this._weights;
    }
    equals(other) {
        if (!other) {
            return false;
        }
        if (this._weightProfileVersion !== other.weightProfileVersion) {
            return false;
        }
        const w1 = this._weights;
        const w2 = other.weights;
        return (w1.semanticSimilarity === w2.semanticSimilarity &&
            w1.skillCoverage === w2.skillCoverage &&
            w1.experienceCompatibility === w2.experienceCompatibility &&
            w1.budgetCompatibility === w2.budgetCompatibility &&
            w1.jobTypeCompatibility === w2.jobTypeCompatibility &&
            w1.locationCompatibility === w2.locationCompatibility);
    }
}
export class ScoringConfiguration {
    _scoringVersion;
    _weightProfile;
    _compatibilityMapping;
    _missingSignalPolicy;
    _semanticSimilarityNormalization;
    _scoreScale;
    constructor(properties) {
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
        const states = ["COMPATIBLE", "PARTIAL", "INCOMPATIBLE"];
        for (const state of states) {
            const val = mapping[state];
            if (typeof val !== "number" || !Number.isFinite(val) || Number.isNaN(val)) {
                throw new Error(`Mapping value for ${state} must be a finite number.`);
            }
        }
        if (mapping.UNKNOWN !== undefined) {
            if (typeof mapping.UNKNOWN !== "number" ||
                !Number.isFinite(mapping.UNKNOWN) ||
                Number.isNaN(mapping.UNKNOWN)) {
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
    get scoringVersion() {
        return this._scoringVersion;
    }
    get weightProfile() {
        return this._weightProfile;
    }
    get compatibilityMapping() {
        return { ...this._compatibilityMapping };
    }
    get missingSignalPolicy() {
        return this._missingSignalPolicy;
    }
    get semanticSimilarityNormalization() {
        return this._semanticSimilarityNormalization;
    }
    get scoreScale() {
        return this._scoreScale;
    }
}
export class SignalContribution {
    _signalName;
    _rawValue;
    _normalizedValue;
    _weight;
    _contribution;
    _available;
    constructor(properties) {
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
    get signalName() {
        return this._signalName;
    }
    get rawValue() {
        return this._rawValue;
    }
    get normalizedValue() {
        return this._normalizedValue;
    }
    get weight() {
        return this._weight;
    }
    get contribution() {
        return this._contribution;
    }
    get available() {
        return this._available;
    }
}
export class ScoreBreakdown {
    _contributions;
    constructor(contributions) {
        if (!contributions || contributions.length === 0) {
            throw new Error("Contributions are required.");
        }
        this._contributions = [...contributions].map((c) => Object.freeze(c));
        Object.freeze(this._contributions);
        Object.freeze(this);
    }
    get contributions() {
        return Object.freeze([...this._contributions]);
    }
}
export class ScoreFingerprint {
    _value;
    constructor(jobMatchId, matchingVersion, scoringVersion, weightProfileVersion) {
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
    get value() {
        return this._value;
    }
    equals(other) {
        if (!other) {
            return false;
        }
        return this._value === other.value;
    }
}
// Deterministic Rounding Helper
export function roundToPrecision(value, decimals = 4) {
    const factor = Math.pow(10, decimals);
    return Math.round(value * factor) / factor;
}
export class JobMatchScoreSnapshot {
    _version;
    _createdAt;
    _status;
    _jobMatchId;
    _matchingVersion;
    _scoringVersion;
    _weightProfileVersion;
    _finalScore;
    _breakdown;
    _fingerprint;
    constructor(properties) {
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
    get version() {
        return this._version;
    }
    get createdAt() {
        return new Date(this._createdAt.getTime());
    }
    get status() {
        return this._status;
    }
    get jobMatchId() {
        return this._jobMatchId;
    }
    get matchingVersion() {
        return this._matchingVersion;
    }
    get scoringVersion() {
        return this._scoringVersion;
    }
    get weightProfileVersion() {
        return this._weightProfileVersion;
    }
    get finalScore() {
        return this._finalScore;
    }
    get breakdown() {
        return this._breakdown;
    }
    get fingerprint() {
        return this._fingerprint;
    }
}
// ==========================================
// 3. DOMAIN EVENTS
// ==========================================
export const JOB_MATCH_SCORE_CREATED = "JOB_MATCH_SCORE_CREATED";
export const JOB_MATCH_SCORE_CALCULATED = "JOB_MATCH_SCORE_CALCULATED";
export const JOB_MATCH_SCORE_ARCHIVED = "JOB_MATCH_SCORE_ARCHIVED";
// ==========================================
// 6. AGGREGATE ROOT
// ==========================================
export class JobMatchScore {
    _id;
    _tenantId;
    _ownerId;
    _jobMatchId;
    _matchingVersion;
    _scoringVersion;
    _weightProfileVersion;
    _finalScore;
    _breakdown;
    _fingerprint;
    _status;
    _snapshots = [];
    _createdAt;
    _updatedAt;
    _domainEvents = [];
    constructor(properties) {
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
        if (properties.status !== "CREATED" &&
            properties.status !== "CALCULATED" &&
            properties.status !== "ARCHIVED") {
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
    get id() {
        return this._id;
    }
    get tenantId() {
        return this._tenantId;
    }
    get ownerId() {
        return this._ownerId;
    }
    get jobMatchId() {
        return this._jobMatchId;
    }
    get matchingVersion() {
        return this._matchingVersion;
    }
    get scoringVersion() {
        return this._scoringVersion;
    }
    get weightProfileVersion() {
        return this._weightProfileVersion;
    }
    get finalScore() {
        return this._finalScore;
    }
    get breakdown() {
        return this._breakdown;
    }
    get fingerprint() {
        return this._fingerprint;
    }
    get status() {
        return this._status;
    }
    get snapshots() {
        return Object.freeze([...this._snapshots]);
    }
    get createdAt() {
        return new Date(this._createdAt.getTime());
    }
    get updatedAt() {
        return new Date(this._updatedAt.getTime());
    }
    get domainEvents() {
        return Object.freeze([...this._domainEvents]);
    }
    clearDomainEvents() {
        this._domainEvents = [];
    }
    addDomainEvent(event) {
        this._domainEvents.push(Object.freeze(event));
    }
    verifyOwnership(actorOwnerId) {
        if (!actorOwnerId || actorOwnerId.trim() === "") {
            throw new Error("Ownership validation failed: unauthorized owner context.");
        }
        if (actorOwnerId !== this._ownerId) {
            throw new Error("Ownership validation failed: unauthorized owner context.");
        }
    }
    validateInvariants() {
        if (this._snapshots.length > 0) {
            let expectedVersion = 1;
            for (const snap of this._snapshots) {
                if (snap.version !== expectedVersion) {
                    throw new Error(`Snapshot history must be sequential and start at 1. Expected version ${expectedVersion}, got ${snap.version}.`);
                }
                expectedVersion++;
            }
        }
    }
    appendSnapshot() {
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
    static create(id, tenantId, ownerId, jobMatchId, matchingVersion, scoringVersion, weightProfileVersion) {
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
    transitionTo(nextStatus) {
        if (this._status === "ARCHIVED") {
            throw new Error(`Invalid lifecycle transition from ARCHIVED to ${nextStatus.toUpperCase()}`);
        }
        if (nextStatus === "CALCULATED") {
            if (this._status !== "CREATED") {
                throw new Error(`Invalid lifecycle transition from ${this._status.toUpperCase()} to CALCULATED`);
            }
        }
        else if (nextStatus === "CREATED") {
            throw new Error(`Invalid lifecycle transition from ${this._status.toUpperCase()} to CREATED`);
        }
        this._status = nextStatus;
        this._updatedAt = new Date();
        this.appendSnapshot();
    }
    calculate(actorOwnerId, matchSignals, scoringConfiguration) {
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
        ];
        const contributions = [];
        let weightedSum = 0;
        let totalWeights = 0;
        for (const key of signalKeys) {
            const rawValue = matchSignals[key];
            const weight = weights[key];
            // Availability and UNKNOWN/absence resolution
            let available = true;
            if (rawValue === undefined) {
                available = false;
            }
            else if (rawValue === "UNKNOWN" && mapping.UNKNOWN === undefined) {
                available = false;
            }
            if (!available) {
                if (policy === "strict-validation") {
                    throw new Error(`Strict validation policy failed: missing required signal ${key}`);
                }
                // Normalized value and contribution under policy models
                let normalizedValue = undefined;
                let contribution = undefined;
                if (policy === "fixed-denominator") {
                    normalizedValue = mapping.UNKNOWN ?? 0;
                    contribution = normalizedValue * weight;
                    weightedSum += contribution;
                    totalWeights += weight;
                }
                contributions.push(new SignalContribution({
                    signalName: key,
                    rawValue: typeof rawValue === "number" ? rawValue : rawValue,
                    normalizedValue,
                    weight,
                    contribution,
                    available: false,
                }));
            }
            else {
                // Value is available - Perform Normalization
                let normalizedValue = 0;
                if (key === "semanticSimilarity") {
                    const val = rawValue;
                    if (typeof val !== "number" || !Number.isFinite(val) || Number.isNaN(val)) {
                        throw new Error("Semantic similarity value is not a finite number.");
                    }
                    if (val < -1 || val > 1) {
                        throw new Error("Semantic similarity value must be between -1 and 1.");
                    }
                    if (scoringConfiguration.semanticSimilarityNormalization === "shift-to-positive") {
                        normalizedValue = (val + 1) / 2;
                    }
                    else {
                        normalizedValue = val;
                    }
                }
                else if (key === "skillCoverage") {
                    const val = rawValue;
                    if (typeof val !== "number" || !Number.isFinite(val) || Number.isNaN(val)) {
                        throw new Error("Skill coverage value is not a finite number.");
                    }
                    if (val < 0 || val > 1) {
                        throw new Error("Skill coverage value must be between 0 and 1.");
                    }
                    normalizedValue = val;
                }
                else {
                    // Compatibility status lookup mapping
                    const status = rawValue.toUpperCase();
                    if (status === "UNKNOWN") {
                        normalizedValue = mapping.UNKNOWN ?? 0;
                    }
                    else if (status === "COMPATIBLE") {
                        normalizedValue = mapping.COMPATIBLE;
                    }
                    else if (status === "PARTIAL") {
                        normalizedValue = mapping.PARTIAL;
                    }
                    else if (status === "INCOMPATIBLE") {
                        normalizedValue = mapping.INCOMPATIBLE;
                    }
                    else {
                        throw new Error(`Invalid compatibility state: ${rawValue}`);
                    }
                }
                const contribution = normalizedValue * weight;
                weightedSum += contribution;
                totalWeights += weight;
                contributions.push(new SignalContribution({
                    signalName: key,
                    rawValue: typeof rawValue === "number" ? rawValue : rawValue,
                    normalizedValue,
                    weight,
                    contribution,
                    available: true,
                }));
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
        }
        else if (scoringConfiguration.scoreScale === "0-1000") {
            rawScore = rawScore * 1000;
        }
        this._finalScore = roundToPrecision(rawScore, 4);
        this._breakdown = new ScoreBreakdown(contributions);
        this._fingerprint = new ScoreFingerprint(this._jobMatchId, this._matchingVersion, this._scoringVersion, this._weightProfileVersion);
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
    archive(actorOwnerId) {
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
