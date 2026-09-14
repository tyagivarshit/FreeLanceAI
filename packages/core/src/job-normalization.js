// 2. Value Objects
export class JobSourceReference {
    _jobImportId;
    _source;
    _externalJobId;
    constructor(properties) {
        if (!properties.jobImportId || properties.jobImportId.trim() === "") {
            throw new Error("JobImport ID is required.");
        }
        if (!properties.source) {
            throw new Error("Source is required.");
        }
        if (!properties.externalJobId || properties.externalJobId.trim() === "") {
            throw new Error("External Job ID is required.");
        }
        this._jobImportId = properties.jobImportId.trim();
        this._source = properties.source;
        this._externalJobId = properties.externalJobId.trim();
        Object.freeze(this);
    }
    get jobImportId() {
        return this._jobImportId;
    }
    get source() {
        return this._source;
    }
    get externalJobId() {
        return this._externalJobId;
    }
    equals(other) {
        if (!other) {
            return false;
        }
        return (this._jobImportId === other.jobImportId &&
            this._source.equals(other.source) &&
            this._externalJobId === other.externalJobId);
    }
}
export class CanonicalBudget {
    _type;
    _minimum;
    _maximum;
    _currency;
    constructor(properties) {
        if (!properties.type) {
            throw new Error("Budget type is required.");
        }
        if (properties.type !== "fixed" &&
            properties.type !== "hourly" &&
            properties.type !== "unknown") {
            throw new Error(`Unsupported budget type: ${properties.type}`);
        }
        if (properties.minimum !== undefined && properties.minimum < 0) {
            throw new Error("Budget minimum cannot be negative.");
        }
        if (properties.maximum !== undefined && properties.maximum < 0) {
            throw new Error("Budget maximum cannot be negative.");
        }
        if (properties.minimum !== undefined &&
            properties.maximum !== undefined &&
            properties.minimum > properties.maximum) {
            throw new Error("Budget minimum cannot be greater than maximum.");
        }
        this._type = properties.type;
        this._minimum = properties.minimum;
        this._maximum = properties.maximum;
        this._currency = properties.currency ? properties.currency.trim().toUpperCase() : undefined;
        Object.freeze(this);
    }
    get type() {
        return this._type;
    }
    get minimum() {
        return this._minimum;
    }
    get maximum() {
        return this._maximum;
    }
    get currency() {
        return this._currency;
    }
    equals(other) {
        if (!other) {
            return false;
        }
        return (this._type === other.type &&
            this._minimum === other.minimum &&
            this._maximum === other.maximum &&
            this._currency === other.currency);
    }
}
export class CanonicalLocation {
    _mode;
    _country;
    _region;
    _timezone;
    constructor(properties) {
        this._mode = properties.mode ? properties.mode.trim() : undefined;
        this._country = properties.country ? properties.country.trim() : undefined;
        this._region = properties.region ? properties.region.trim() : undefined;
        this._timezone = properties.timezone ? properties.timezone.trim() : undefined;
        Object.freeze(this);
    }
    get mode() {
        return this._mode;
    }
    get country() {
        return this._country;
    }
    get region() {
        return this._region;
    }
    get timezone() {
        return this._timezone;
    }
    equals(other) {
        if (!other) {
            return false;
        }
        return (this._mode === other.mode &&
            this._country === other.country &&
            this._region === other.region &&
            this._timezone === other.timezone);
    }
}
export class CanonicalJob {
    _title;
    _description;
    _skills;
    _budget;
    _experience;
    _category;
    _jobType;
    _location;
    _duration;
    constructor(properties) {
        if (!properties.title || properties.title.trim() === "") {
            throw new Error("Canonical title is required.");
        }
        if (!properties.description || properties.description.trim() === "") {
            throw new Error("Canonical description is required.");
        }
        if (!properties.skills) {
            throw new Error("Skills list is required.");
        }
        this._title = properties.title.trim().replace(/\s+/g, " ");
        this._description = properties.description
            .trim()
            .replace(/\r\n/g, "\n")
            .replace(/\r/g, "\n")
            .replace(/[ \t]+/g, " ");
        const rawSkills = properties.skills.map((s) => s.trim().toLowerCase()).filter((s) => s !== "");
        const uniqueSortedSkills = Array.from(new Set(rawSkills)).sort();
        this._skills = uniqueSortedSkills;
        Object.freeze(this._skills);
        this._budget = properties.budget;
        this._experience = properties.experience ? properties.experience.trim() : undefined;
        this._category = properties.category ? properties.category.trim() : undefined;
        if (properties.jobType !== undefined) {
            const normalizedJobType = properties.jobType.trim().toLowerCase();
            if (normalizedJobType !== "fixed" &&
                normalizedJobType !== "hourly" &&
                normalizedJobType !== "contract") {
                throw new Error(`Unsupported job type: ${properties.jobType}`);
            }
            this._jobType = normalizedJobType;
        }
        else {
            this._jobType = undefined;
        }
        this._location = properties.location;
        this._duration = properties.duration ? properties.duration.trim() : undefined;
        Object.freeze(this);
    }
    get title() {
        return this._title;
    }
    get description() {
        return this._description;
    }
    get skills() {
        return this._skills;
    }
    get budget() {
        return this._budget;
    }
    get experience() {
        return this._experience;
    }
    get category() {
        return this._category;
    }
    get jobType() {
        return this._jobType;
    }
    get location() {
        return this._location;
    }
    get duration() {
        return this._duration;
    }
    equals(other) {
        if (!other) {
            return false;
        }
        if (this._title !== other.title || this._description !== other.description) {
            return false;
        }
        if (this._experience !== other.experience ||
            this._category !== other.category ||
            this._jobType !== other.jobType ||
            this._duration !== other.duration) {
            return false;
        }
        if (this._skills.length !== other.skills.length) {
            return false;
        }
        for (let i = 0; i < this._skills.length; i++) {
            if (this._skills[i] !== other.skills[i]) {
                return false;
            }
        }
        if (this._budget && other.budget) {
            if (!this._budget.equals(other.budget)) {
                return false;
            }
        }
        else if (this._budget || other.budget) {
            return false;
        }
        if (this._location && other.location) {
            if (!this._location.equals(other.location)) {
                return false;
            }
        }
        else if (this._location || other.location) {
            return false;
        }
        return true;
    }
}
export class JobNormalizedFingerprint {
    _value;
    constructor(value) {
        if (!value || value.trim() === "") {
            throw new Error("Normalized fingerprint value is required.");
        }
        this._value = value.trim();
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
export class JobNormalizationSnapshot {
    _version;
    _createdAt;
    _status;
    _sourceReference;
    _normalizationVersion;
    _canonicalJob;
    _normalizedFingerprint;
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
        if (!properties.sourceReference) {
            throw new Error("Snapshot source reference is required.");
        }
        if (!properties.normalizationVersion || properties.normalizationVersion.trim() === "") {
            throw new Error("Snapshot normalization version is required.");
        }
        if (!properties.canonicalJob) {
            throw new Error("Snapshot canonical job is required.");
        }
        if (!properties.normalizedFingerprint) {
            throw new Error("Snapshot fingerprint is required.");
        }
        this._version = properties.version;
        this._createdAt = new Date(properties.createdAt.getTime());
        this._status = properties.status;
        this._sourceReference = properties.sourceReference;
        this._normalizationVersion = properties.normalizationVersion.trim();
        this._canonicalJob = properties.canonicalJob;
        this._normalizedFingerprint = properties.normalizedFingerprint;
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
    get sourceReference() {
        return this._sourceReference;
    }
    get normalizationVersion() {
        return this._normalizationVersion;
    }
    get canonicalJob() {
        return this._canonicalJob;
    }
    get normalizedFingerprint() {
        return this._normalizedFingerprint;
    }
}
// 4. Domain Events
export const JOB_NORMALIZATION_CREATED = "JOB_NORMALIZATION_CREATED";
export const JOB_NORMALIZED = "JOB_NORMALIZED";
export const JOB_NORMALIZATION_ARCHIVED = "JOB_NORMALIZATION_ARCHIVED";
// 7. JobNormalization Aggregate Root
export class JobNormalization {
    _id;
    _tenantId;
    _ownerId;
    _sourceReference;
    _normalizationVersion;
    _canonicalJob;
    _normalizedFingerprint;
    _status;
    _snapshots = [];
    _createdAt;
    _updatedAt;
    _domainEvents = [];
    constructor(properties) {
        if (!properties.id || properties.id.trim() === "") {
            throw new Error("Job Normalization Identity is required.");
        }
        if (!properties.tenantId || properties.tenantId.trim() === "") {
            throw new Error("Tenant Identity is required.");
        }
        if (!properties.ownerId || properties.ownerId.trim() === "") {
            throw new Error("Owner Identity is required.");
        }
        if (!properties.sourceReference) {
            throw new Error("Source Reference is required.");
        }
        if (!properties.normalizationVersion || properties.normalizationVersion.trim() === "") {
            throw new Error("Normalization Version is required.");
        }
        const versionPattern = /^v\d+$/;
        if (!versionPattern.test(properties.normalizationVersion.trim())) {
            throw new Error(`Invalid normalization version format: ${properties.normalizationVersion}.`);
        }
        if (!properties.canonicalJob) {
            throw new Error("Canonical Job is required.");
        }
        if (!properties.normalizedFingerprint) {
            throw new Error("Normalized Fingerprint is required.");
        }
        if (!properties.status) {
            throw new Error("Lifecycle status is required.");
        }
        if (properties.status !== "CREATED" &&
            properties.status !== "NORMALIZED" &&
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
        this._sourceReference = properties.sourceReference;
        this._normalizationVersion = properties.normalizationVersion.trim();
        this._canonicalJob = properties.canonicalJob;
        this._normalizedFingerprint = properties.normalizedFingerprint;
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
    get sourceReference() {
        return this._sourceReference;
    }
    get normalizationVersion() {
        return this._normalizationVersion;
    }
    get canonicalJob() {
        return this._canonicalJob;
    }
    get normalizedFingerprint() {
        return this._normalizedFingerprint;
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
        const newSnapshot = new JobNormalizationSnapshot({
            version: nextVersion,
            createdAt: new Date(),
            status: this._status,
            sourceReference: this._sourceReference,
            normalizationVersion: this._normalizationVersion,
            canonicalJob: this._canonicalJob,
            normalizedFingerprint: this._normalizedFingerprint,
        });
        this._snapshots.push(newSnapshot);
    }
    // Factory Creation Method
    static create(id, tenantId, ownerId, sourceReference, normalizationVersion, canonicalJob, normalizedFingerprint) {
        const now = new Date();
        const normalization = new JobNormalization({
            id,
            tenantId,
            ownerId,
            sourceReference,
            normalizationVersion,
            canonicalJob,
            normalizedFingerprint,
            status: "CREATED",
            snapshots: [],
            createdAt: now,
            updatedAt: now,
        });
        normalization.appendSnapshot();
        normalization.addDomainEvent({
            eventType: JOB_NORMALIZATION_CREATED,
            normalizationId: normalization.id,
            tenantId: normalization.tenantId,
            ownerId: normalization.ownerId,
            jobImportId: normalization.sourceReference.jobImportId,
            normalizationVersion: normalization.normalizationVersion,
            normalizedFingerprint: normalization.normalizedFingerprint.value,
            snapshotVersion: normalization.snapshots.length,
        });
        return normalization;
    }
    // Domain Transitions
    transitionTo(nextStatus) {
        if (this._status === "ARCHIVED") {
            throw new Error(`Invalid lifecycle transition from ARCHIVED to ${nextStatus.toUpperCase()}`);
        }
        if (nextStatus === "NORMALIZED") {
            if (this._status !== "CREATED") {
                throw new Error(`Invalid lifecycle transition from ${this._status.toUpperCase()} to NORMALIZED`);
            }
        }
        else if (nextStatus === "CREATED") {
            throw new Error(`Invalid lifecycle transition from ${this._status.toUpperCase()} to CREATED`);
        }
        this._status = nextStatus;
        this._updatedAt = new Date();
        this.appendSnapshot();
    }
    markNormalized(actorOwnerId) {
        this.verifyOwnership(actorOwnerId);
        this.transitionTo("NORMALIZED");
        this.addDomainEvent({
            eventType: JOB_NORMALIZED,
            normalizationId: this._id,
            tenantId: this._tenantId,
            ownerId: this._ownerId,
            jobImportId: this._sourceReference.jobImportId,
            normalizationVersion: this._normalizationVersion,
            normalizedFingerprint: this._normalizedFingerprint.value,
            snapshotVersion: this._snapshots.length,
        });
    }
    archive(actorOwnerId) {
        this.verifyOwnership(actorOwnerId);
        if (this._status === "ARCHIVED") {
            throw new Error("Job normalization is already archived.");
        }
        this.transitionTo("ARCHIVED");
        this.addDomainEvent({
            eventType: JOB_NORMALIZATION_ARCHIVED,
            normalizationId: this._id,
            tenantId: this._tenantId,
            ownerId: this._ownerId,
            jobImportId: this._sourceReference.jobImportId,
            normalizationVersion: this._normalizationVersion,
            normalizedFingerprint: this._normalizedFingerprint.value,
            snapshotVersion: this._snapshots.length,
        });
    }
}
