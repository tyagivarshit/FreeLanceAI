// Deep clone and deep freeze helper functions for payload immutability
function deepCloneAndFreeze(obj) {
    if (obj === null || typeof obj !== "object") {
        return obj;
    }
    const cloned = JSON.parse(JSON.stringify(obj));
    return deepFreeze(cloned);
}
function deepFreeze(obj) {
    if (obj === null || typeof obj !== "object") {
        return obj;
    }
    Object.freeze(obj);
    Object.keys(obj).forEach((key) => {
        const val = obj[key];
        if (val !== null && typeof val === "object" && !Object.isFrozen(val)) {
            deepFreeze(val);
        }
    });
    return obj;
}
// 2. Value Objects
export class JobSource {
    _value;
    static ALLOWED_SOURCES = [
        "upwork",
        "freelancer",
        "toptal",
        "linkedin",
        "indeed",
    ];
    constructor(value) {
        if (!value || value.trim() === "") {
            throw new Error("Job source is required and cannot be empty.");
        }
        const normalized = value.trim().toLowerCase();
        if (!JobSource.ALLOWED_SOURCES.includes(normalized)) {
            throw new Error(`Invalid job source: ${value}. Value must be one of the approved vocabulary sources.`);
        }
        this._value = normalized;
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
export class JobExternalIdentity {
    _source;
    _externalJobId;
    constructor(source, externalJobId) {
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
        return this._source.equals(other.source) && this._externalJobId === other.externalJobId;
    }
}
export class JobImportProvenance {
    _source;
    _externalJobId;
    _sourceUrl;
    _importedAt;
    constructor(properties) {
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
    get source() {
        return this._source;
    }
    get externalJobId() {
        return this._externalJobId;
    }
    get sourceUrl() {
        return this._sourceUrl;
    }
    get importedAt() {
        return new Date(this._importedAt.getTime());
    }
    equals(other) {
        if (!other) {
            return false;
        }
        return (this._source.equals(other.source) &&
            this._externalJobId === other.externalJobId &&
            this._sourceUrl === other.sourceUrl &&
            this._importedAt.getTime() === other.importedAt.getTime());
    }
}
export class JobRawPayload {
    _data;
    constructor(data) {
        if (!data || typeof data !== "object" || Array.isArray(data)) {
            throw new Error("Raw payload data must be a valid non-array object.");
        }
        this._data = deepCloneAndFreeze(data);
        Object.freeze(this);
    }
    get data() {
        return deepCloneAndFreeze(this._data);
    }
    equals(other) {
        if (!other) {
            return false;
        }
        return JSON.stringify(this._data) === JSON.stringify(other._data);
    }
}
export class JobImportFingerprint {
    _value;
    constructor(value) {
        if (!value || value.trim() === "") {
            throw new Error("Fingerprint value is required.");
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
export class JobImportSnapshot {
    _version;
    _createdAt;
    _status;
    _externalIdentity;
    _provenance;
    _rawPayload;
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
    get version() {
        return this._version;
    }
    get createdAt() {
        return new Date(this._createdAt.getTime());
    }
    get status() {
        return this._status;
    }
    get externalIdentity() {
        return this._externalIdentity;
    }
    get provenance() {
        return this._provenance;
    }
    get rawPayload() {
        return this._rawPayload;
    }
    get fingerprint() {
        return this._fingerprint;
    }
}
// 4. Domain Events
export const JOB_IMPORT_RECEIVED = "JOB_IMPORT_RECEIVED";
export const JOB_IMPORTED = "JOB_IMPORTED";
export const JOB_IMPORT_ARCHIVED = "JOB_IMPORT_ARCHIVED";
// 7. JobImport Aggregate Root
export class JobImport {
    _id;
    _tenantId;
    _ownerId;
    _externalIdentity;
    _provenance;
    _rawPayload;
    _fingerprint;
    _status;
    _snapshots = [];
    _createdAt;
    _updatedAt;
    _domainEvents = [];
    constructor(properties) {
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
    get id() {
        return this._id;
    }
    get tenantId() {
        return this._tenantId;
    }
    get ownerId() {
        return this._ownerId;
    }
    get externalIdentity() {
        return this._externalIdentity;
    }
    get provenance() {
        return this._provenance;
    }
    get rawPayload() {
        return this._rawPayload;
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
            let previousVersion = 0;
            for (const snap of this._snapshots) {
                if (snap.version <= previousVersion) {
                    throw new Error("Snapshot history must be sequential and strictly increasing.");
                }
                previousVersion = snap.version;
            }
        }
    }
    appendSnapshot() {
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
    static create(id, tenantId, ownerId, externalIdentity, provenance, rawPayload, fingerprint) {
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
    transitionTo(nextStatus) {
        if (this._status === "ARCHIVED") {
            throw new Error(`Invalid lifecycle transition from ARCHIVED to ${nextStatus.toUpperCase()}`);
        }
        if (nextStatus === "IMPORTED") {
            if (this._status !== "RECEIVED") {
                throw new Error(`Invalid lifecycle transition from ${this._status.toUpperCase()} to IMPORTED`);
            }
        }
        else if (nextStatus === "RECEIVED") {
            throw new Error(`Invalid lifecycle transition from ${this._status.toUpperCase()} to RECEIVED`);
        }
        this._status = nextStatus;
        this._updatedAt = new Date();
        this.appendSnapshot();
    }
    markImported(actorOwnerId) {
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
    archive(actorOwnerId) {
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
