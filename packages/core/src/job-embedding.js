export class ModelReference {
    _provider;
    _modelName;
    _modelVersion;
    constructor(properties) {
        if (!properties.provider || properties.provider.trim() === "") {
            throw new Error("Provider identifier is required.");
        }
        if (!properties.modelName || properties.modelName.trim() === "") {
            throw new Error("Model name is required.");
        }
        if (!properties.modelVersion || properties.modelVersion.trim() === "") {
            throw new Error("Model version is required.");
        }
        this._provider = properties.provider.trim();
        this._modelName = properties.modelName.trim();
        this._modelVersion = properties.modelVersion.trim();
        Object.freeze(this);
    }
    get provider() {
        return this._provider;
    }
    get modelName() {
        return this._modelName;
    }
    get modelVersion() {
        return this._modelVersion;
    }
    equals(other) {
        if (!other) {
            return false;
        }
        return (this._provider === other.provider &&
            this._modelName === other.modelName &&
            this._modelVersion === other.modelVersion);
    }
}
export class JobVectorFingerprint {
    _value;
    constructor(value) {
        if (!value || value.trim() === "") {
            throw new Error("Vector fingerprint value is required.");
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
// Helper to validate numeric vector elements
function validateVector(vector, dimensions) {
    if (!vector || !Array.isArray(vector)) {
        throw new Error("Vector is required and must be an array.");
    }
    if (vector.length === 0) {
        throw new Error("Vector must be non-empty.");
    }
    if (dimensions <= 0) {
        throw new Error("Dimensions must be positive.");
    }
    if (vector.length !== dimensions) {
        throw new Error("Vector length must match dimensions.");
    }
    for (const element of vector) {
        if (typeof element !== "number") {
            throw new Error("Every vector element must be a number.");
        }
        if (!Number.isFinite(element) || Number.isNaN(element)) {
            throw new Error("Every vector element must be a finite number.");
        }
    }
}
export class JobEmbeddingSnapshot {
    _version;
    _createdAt;
    _status;
    _jobNormalizationId;
    _normalizationVersion;
    _embeddingVersion;
    _modelReference;
    _vector;
    _dimensions;
    _inputFingerprint;
    _vectorFingerprint;
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
        if (!properties.jobNormalizationId || properties.jobNormalizationId.trim() === "") {
            throw new Error("Snapshot jobNormalizationId is required.");
        }
        if (!properties.normalizationVersion || properties.normalizationVersion.trim() === "") {
            throw new Error("Snapshot normalizationVersion is required.");
        }
        if (!properties.embeddingVersion || properties.embeddingVersion.trim() === "") {
            throw new Error("Snapshot embeddingVersion is required.");
        }
        if (!properties.modelReference) {
            throw new Error("Snapshot modelReference is required.");
        }
        validateVector(properties.vector, properties.dimensions);
        if (!properties.inputFingerprint || properties.inputFingerprint.trim() === "") {
            throw new Error("Snapshot inputFingerprint is required.");
        }
        if (!properties.vectorFingerprint) {
            throw new Error("Snapshot vectorFingerprint is required.");
        }
        this._version = properties.version;
        this._createdAt = new Date(properties.createdAt.getTime());
        this._status = properties.status;
        this._jobNormalizationId = properties.jobNormalizationId;
        this._normalizationVersion = properties.normalizationVersion;
        this._embeddingVersion = properties.embeddingVersion;
        this._modelReference = properties.modelReference;
        this._vector = Object.freeze([...properties.vector]);
        this._dimensions = properties.dimensions;
        this._inputFingerprint = properties.inputFingerprint;
        this._vectorFingerprint = properties.vectorFingerprint;
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
    get jobNormalizationId() {
        return this._jobNormalizationId;
    }
    get normalizationVersion() {
        return this._normalizationVersion;
    }
    get embeddingVersion() {
        return this._embeddingVersion;
    }
    get modelReference() {
        return this._modelReference;
    }
    get vector() {
        return Object.freeze([...this._vector]);
    }
    get dimensions() {
        return this._dimensions;
    }
    get inputFingerprint() {
        return this._inputFingerprint;
    }
    get vectorFingerprint() {
        return this._vectorFingerprint;
    }
}
// ==========================================
// 3. DOMAIN EVENTS
// ==========================================
export const JOB_EMBEDDING_CREATED = "JOB_EMBEDDING_CREATED";
export const JOB_EMBEDDING_GENERATED = "JOB_EMBEDDING_GENERATED";
export const JOB_EMBEDDING_ARCHIVED = "JOB_EMBEDDING_ARCHIVED";
// ==========================================
// 7. AGGREGATE ROOT
// ==========================================
export class JobEmbedding {
    _id;
    _tenantId;
    _ownerId;
    _jobNormalizationId;
    _normalizationVersion;
    _embeddingVersion;
    _modelReference;
    _vector;
    _dimensions;
    _inputFingerprint;
    _vectorFingerprint;
    _status;
    _snapshots = [];
    _createdAt;
    _updatedAt;
    _domainEvents = [];
    constructor(properties) {
        if (!properties.id || properties.id.trim() === "") {
            throw new Error("Embedding Identity is required.");
        }
        if (!properties.tenantId || properties.tenantId.trim() === "") {
            throw new Error("Tenant Identity is required.");
        }
        if (!properties.ownerId || properties.ownerId.trim() === "") {
            throw new Error("Owner Identity is required.");
        }
        if (!properties.jobNormalizationId || properties.jobNormalizationId.trim() === "") {
            throw new Error("Normalization reference ID is required.");
        }
        if (!properties.normalizationVersion || properties.normalizationVersion.trim() === "") {
            throw new Error("Normalization Version is required.");
        }
        if (!properties.embeddingVersion || properties.embeddingVersion.trim() === "") {
            throw new Error("Embedding Version is required.");
        }
        const versionPattern = /^v\d+$/;
        if (!versionPattern.test(properties.normalizationVersion.trim())) {
            throw new Error(`Invalid normalization version format: ${properties.normalizationVersion}.`);
        }
        if (!versionPattern.test(properties.embeddingVersion.trim())) {
            throw new Error(`Invalid embedding version format: ${properties.embeddingVersion}.`);
        }
        if (!properties.modelReference) {
            throw new Error("Model Reference is required.");
        }
        validateVector(properties.vector, properties.dimensions);
        if (!properties.inputFingerprint || properties.inputFingerprint.trim() === "") {
            throw new Error("Input Fingerprint is required.");
        }
        if (!properties.vectorFingerprint) {
            throw new Error("Vector Fingerprint is required.");
        }
        if (!properties.status) {
            throw new Error("Lifecycle status is required.");
        }
        if (properties.status !== "CREATED" &&
            properties.status !== "GENERATED" &&
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
        this._jobNormalizationId = properties.jobNormalizationId;
        this._normalizationVersion = properties.normalizationVersion.trim();
        this._embeddingVersion = properties.embeddingVersion.trim();
        this._modelReference = properties.modelReference;
        this._vector = Object.freeze([...properties.vector]);
        this._dimensions = properties.dimensions;
        this._inputFingerprint = properties.inputFingerprint.trim();
        this._vectorFingerprint = properties.vectorFingerprint;
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
    get jobNormalizationId() {
        return this._jobNormalizationId;
    }
    get normalizationVersion() {
        return this._normalizationVersion;
    }
    get embeddingVersion() {
        return this._embeddingVersion;
    }
    get modelReference() {
        return this._modelReference;
    }
    get vector() {
        return Object.freeze([...this._vector]);
    }
    get dimensions() {
        return this._dimensions;
    }
    get inputFingerprint() {
        return this._inputFingerprint;
    }
    get vectorFingerprint() {
        return this._vectorFingerprint;
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
        const newSnapshot = new JobEmbeddingSnapshot({
            version: nextVersion,
            createdAt: new Date(),
            status: this._status,
            jobNormalizationId: this._jobNormalizationId,
            normalizationVersion: this._normalizationVersion,
            embeddingVersion: this._embeddingVersion,
            modelReference: this._modelReference,
            vector: [...this._vector],
            dimensions: this._dimensions,
            inputFingerprint: this._inputFingerprint,
            vectorFingerprint: this._vectorFingerprint,
        });
        this._snapshots.push(newSnapshot);
    }
    // Factory Creation Method
    static create(id, tenantId, ownerId, jobNormalizationId, normalizationVersion, embeddingVersion, modelReference, vector, dimensions, inputFingerprint, vectorFingerprint) {
        const now = new Date();
        const embedding = new JobEmbedding({
            id,
            tenantId,
            ownerId,
            jobNormalizationId,
            normalizationVersion,
            embeddingVersion,
            modelReference,
            vector,
            dimensions,
            inputFingerprint,
            vectorFingerprint,
            status: "CREATED",
            snapshots: [],
            createdAt: now,
            updatedAt: now,
        });
        embedding.appendSnapshot();
        embedding.addDomainEvent({
            eventType: JOB_EMBEDDING_CREATED,
            embeddingId: embedding.id,
            tenantId: embedding.tenantId,
            ownerId: embedding.ownerId,
            jobNormalizationId: embedding.jobNormalizationId,
            normalizationVersion: embedding.normalizationVersion,
            embeddingVersion: embedding.embeddingVersion,
            modelReference: {
                provider: embedding.modelReference.provider,
                modelName: embedding.modelReference.modelName,
                modelVersion: embedding.modelReference.modelVersion,
            },
            dimensions: embedding.dimensions,
            inputFingerprint: embedding.inputFingerprint,
            vectorFingerprint: embedding.vectorFingerprint.value,
            snapshotVersion: embedding.snapshots.length,
        });
        return embedding;
    }
    // Domain Transitions
    transitionTo(nextStatus) {
        if (this._status === "ARCHIVED") {
            throw new Error(`Invalid lifecycle transition from ARCHIVED to ${nextStatus.toUpperCase()}`);
        }
        if (nextStatus === "GENERATED") {
            if (this._status !== "CREATED") {
                throw new Error(`Invalid lifecycle transition from ${this._status.toUpperCase()} to GENERATED`);
            }
        }
        else if (nextStatus === "CREATED") {
            throw new Error(`Invalid lifecycle transition from ${this._status.toUpperCase()} to CREATED`);
        }
        this._status = nextStatus;
        this._updatedAt = new Date();
        this.appendSnapshot();
    }
    markGenerated(actorOwnerId) {
        this.verifyOwnership(actorOwnerId);
        this.transitionTo("GENERATED");
        this.addDomainEvent({
            eventType: JOB_EMBEDDING_GENERATED,
            embeddingId: this._id,
            tenantId: this._tenantId,
            ownerId: this._ownerId,
            jobNormalizationId: this._jobNormalizationId,
            normalizationVersion: this._normalizationVersion,
            embeddingVersion: this._embeddingVersion,
            modelReference: {
                provider: this._modelReference.provider,
                modelName: this._modelReference.modelName,
                modelVersion: this._modelReference.modelVersion,
            },
            dimensions: this._dimensions,
            inputFingerprint: this._inputFingerprint,
            vectorFingerprint: this._vectorFingerprint.value,
            snapshotVersion: this._snapshots.length,
        });
    }
    archive(actorOwnerId) {
        this.verifyOwnership(actorOwnerId);
        if (this._status === "ARCHIVED") {
            throw new Error("Job embedding is already archived.");
        }
        this.transitionTo("ARCHIVED");
        this.addDomainEvent({
            eventType: JOB_EMBEDDING_ARCHIVED,
            embeddingId: this._id,
            tenantId: this._tenantId,
            ownerId: this._ownerId,
            jobNormalizationId: this._jobNormalizationId,
            normalizationVersion: this._normalizationVersion,
            embeddingVersion: this._embeddingVersion,
            modelReference: {
                provider: this._modelReference.provider,
                modelName: this._modelReference.modelName,
                modelVersion: this._modelReference.modelVersion,
            },
            dimensions: this._dimensions,
            inputFingerprint: this._inputFingerprint,
            vectorFingerprint: this._vectorFingerprint.value,
            snapshotVersion: this._snapshots.length,
        });
    }
}
