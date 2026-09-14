export class MemoryMetadata {
    _displayName;
    _description;
    _purpose;
    _versionSummary;
    constructor(properties) {
        if (!properties.displayName || properties.displayName.trim() === "") {
            throw new Error("Display Name is required.");
        }
        if (!properties.description || properties.description.trim() === "") {
            throw new Error("Description is required.");
        }
        if (!properties.purpose || properties.purpose.trim() === "") {
            throw new Error("Purpose is required.");
        }
        if (!properties.versionSummary || properties.versionSummary.trim() === "") {
            throw new Error("Version Summary is required.");
        }
        this._displayName = properties.displayName.trim();
        this._description = properties.description.trim();
        this._purpose = properties.purpose.trim();
        this._versionSummary = properties.versionSummary.trim();
    }
    get displayName() {
        return this._displayName;
    }
    get description() {
        return this._description;
    }
    get purpose() {
        return this._purpose;
    }
    get versionSummary() {
        return this._versionSummary;
    }
    equals(other) {
        return (this._displayName === other.displayName &&
            this._description === other.description &&
            this._purpose === other.purpose &&
            this._versionSummary === other.versionSummary);
    }
}
/**
 * Represents a rule defining retention configurations for the memory aggregate.
 *
 * Note: Retention parameters express a logical architectural duration policy
 * (specifying how long memory context remains logically relevant within the domain model),
 * rather than mapping directly to physical storage TTLs, database driver expirations,
 * or infrastructure-level cleanup tasks.
 */
export class MemoryRetentionRule {
    _policyName;
    _retentionDays;
    constructor(properties) {
        if (!properties.policyName || properties.policyName.trim() === "") {
            throw new Error("Policy name is required.");
        }
        if (properties.retentionDays <= 0) {
            throw new Error("Retention days must be greater than zero.");
        }
        this._policyName = properties.policyName.trim();
        this._retentionDays = properties.retentionDays;
    }
    get policyName() {
        return this._policyName;
    }
    /**
     * The logical architectural retention duration in days.
     *
     * This is a logical domain model property defining the contextual validity lifespan,
     * not a physical database TTL or storage-level execution parameter.
     */
    get retentionDays() {
        return this._retentionDays;
    }
    equals(other) {
        return this._policyName === other.policyName && this._retentionDays === other.retentionDays;
    }
}
export class MemoryEntry {
    _content;
    _classification;
    constructor(properties) {
        if (!properties.content || properties.content.trim() === "") {
            throw new Error("Memory entry content is required.");
        }
        if (!properties.classification || properties.classification.trim() === "") {
            throw new Error("Memory entry classification is required.");
        }
        this._content = properties.content.trim();
        this._classification = properties.classification.trim();
    }
    get content() {
        return this._content;
    }
    get classification() {
        return this._classification;
    }
    equals(other) {
        return this._content === other.content && this._classification === other.classification;
    }
}
export class MemorySnapshot {
    _snapshotId;
    _entry;
    _metadataSnapshot;
    _retentionRulesSnapshot;
    _capturedAt;
    constructor(properties) {
        if (!properties.snapshotId || properties.snapshotId.trim() === "") {
            throw new Error("Snapshot ID is required.");
        }
        if (!properties.entry) {
            throw new Error("Memory entry snapshot is required.");
        }
        if (!properties.metadataSnapshot) {
            throw new Error("Metadata snapshot is required.");
        }
        if (!properties.retentionRulesSnapshot) {
            throw new Error("Retention rules snapshot is required.");
        }
        if (!properties.capturedAt) {
            throw new Error("Capture date is required.");
        }
        this._snapshotId = properties.snapshotId.trim();
        this._entry = properties.entry;
        this._metadataSnapshot = properties.metadataSnapshot;
        this._retentionRulesSnapshot = [...properties.retentionRulesSnapshot];
        this._capturedAt = properties.capturedAt;
    }
    get snapshotId() {
        return this._snapshotId;
    }
    get entry() {
        return this._entry;
    }
    get metadataSnapshot() {
        return this._metadataSnapshot;
    }
    get retentionRulesSnapshot() {
        return Object.freeze([...this._retentionRulesSnapshot]);
    }
    get capturedAt() {
        return this._capturedAt;
    }
}
// 3. Domain Events
export const MEMORY_REGISTERED = "MEMORY_REGISTERED";
export const MEMORY_VALIDATED = "MEMORY_VALIDATED";
export const MEMORY_PUBLISHED = "MEMORY_PUBLISHED";
export const MEMORY_ARCHIVED = "MEMORY_ARCHIVED";
// 7. Memory Aggregate Root
export class Memory {
    _id;
    _reference;
    _ownerId;
    _metadata;
    _retentionRules = [];
    _snapshots = [];
    _status;
    _createdAt;
    _updatedAt;
    _domainEvents = [];
    constructor(properties) {
        if (!properties.id || properties.id.trim() === "") {
            throw new Error("Memory Identity is required.");
        }
        if (!properties.reference || properties.reference.trim() === "") {
            throw new Error("Memory Reference is required.");
        }
        const referencePattern = /^[a-z0-9]+(\.[a-z0-9]+)*$/;
        if (!referencePattern.test(properties.reference)) {
            throw new Error("Invalid memory reference format. Must be lower-case dot-separated key.");
        }
        if (!properties.ownerId || properties.ownerId.trim() === "") {
            throw new Error("Owner Reference is required.");
        }
        if (!properties.metadata) {
            throw new Error("Memory Metadata is required.");
        }
        if (!properties.snapshots || properties.snapshots.length === 0) {
            throw new Error("Memory Snapshots collection must not be empty.");
        }
        if (!properties.status) {
            throw new Error("Memory Lifecycle State is required.");
        }
        this._id = properties.id;
        this._reference = properties.reference;
        this._ownerId = properties.ownerId;
        this._metadata = properties.metadata;
        this._status = properties.status;
        this._createdAt = properties.createdAt;
        this._updatedAt = properties.updatedAt;
        this._snapshots = [...properties.snapshots];
        if (properties.retentionRules) {
            this._retentionRules = [...properties.retentionRules];
        }
        this.validateInvariants();
    }
    // Getters
    get id() {
        return this._id;
    }
    get reference() {
        return this._reference;
    }
    get ownerId() {
        return this._ownerId;
    }
    get metadata() {
        return this._metadata;
    }
    get retentionRules() {
        return Object.freeze([...this._retentionRules]);
    }
    get snapshots() {
        return Object.freeze([...this._snapshots]);
    }
    get status() {
        return this._status;
    }
    get createdAt() {
        return this._createdAt;
    }
    get updatedAt() {
        return this._updatedAt;
    }
    get domainEvents() {
        return this._domainEvents;
    }
    /**
     * Retrieves the latest snapshot from the append-only history.
     * This dedicated abstraction encapsulates the logical retrieval behavior.
     */
    get latestSnapshot() {
        if (this._snapshots.length === 0) {
            throw new Error("Invalid aggregate state: snapshots history is empty.");
        }
        return this._snapshots[this._snapshots.length - 1];
    }
    clearDomainEvents() {
        this._domainEvents = [];
    }
    addDomainEvent(event) {
        this._domainEvents.push(event);
    }
    validateInvariants() {
        const referencePattern = /^[a-z0-9]+(\.[a-z0-9]+)*$/;
        if (!referencePattern.test(this._reference)) {
            throw new Error("Invalid memory reference format. Must be lower-case dot-separated key.");
        }
    }
    verifyOwnership(actorOwnerId) {
        if (!actorOwnerId || actorOwnerId.trim() === "") {
            throw new Error("Missing owner identity in caller context.");
        }
        if (actorOwnerId !== this._ownerId) {
            throw new Error("Ownership validation failed: unauthorized owner context.");
        }
    }
    // Domain Factory
    static create(id, reference, ownerId, metadata, retentionRules, initialSnapshotId, initialEntry) {
        const now = new Date();
        const initialSnapshot = new MemorySnapshot({
            snapshotId: initialSnapshotId,
            entry: initialEntry,
            metadataSnapshot: metadata,
            retentionRulesSnapshot: retentionRules,
            capturedAt: now,
        });
        const memory = new Memory({
            id,
            reference,
            ownerId,
            metadata,
            retentionRules,
            snapshots: [initialSnapshot],
            status: "Draft",
            createdAt: now,
            updatedAt: now,
        });
        memory.addDomainEvent({
            eventType: MEMORY_REGISTERED,
            memoryId: memory.id,
            reference: memory.reference,
            snapshotId: initialSnapshotId,
            ownerId: memory.ownerId,
        });
        return memory;
    }
    // Domain Operations
    /**
     * Replaces the Memory Metadata in its entirety.
     *
     * Mutation Rules:
     * - Must verify caller ownership prior to replacing metadata.
     * - Cannot mutate metadata if the aggregate is not in "Draft" status.
     * - Published historical memory must remain immutable.
     * - Performs complete atomic replacement of metadata (no partial mutations).
     */
    replaceMetadata(actorOwnerId, metadata) {
        this.verifyOwnership(actorOwnerId);
        if (this._status !== "Draft") {
            throw new Error(`Cannot replace metadata when in status: ${this._status}`);
        }
        this._metadata = metadata;
        this._updatedAt = new Date();
    }
    appendSnapshot(actorOwnerId, snapshotId, entry, metadata) {
        this.verifyOwnership(actorOwnerId);
        if (this._status === "Archived") {
            throw new Error("Cannot append snapshot to an archived memory.");
        }
        const snapshot = new MemorySnapshot({
            snapshotId,
            entry,
            metadataSnapshot: metadata,
            retentionRulesSnapshot: this._retentionRules,
            capturedAt: new Date(),
        });
        this._snapshots.push(snapshot);
        this._updatedAt = new Date();
    }
    validate(actorOwnerId) {
        this.verifyOwnership(actorOwnerId);
        if (this._status !== "Draft") {
            throw new Error(`Cannot validate memory when in status: ${this._status}`);
        }
        this._status = "Validated";
        this._updatedAt = new Date();
        this.addDomainEvent({
            eventType: MEMORY_VALIDATED,
            memoryId: this._id,
            reference: this._reference,
            snapshotId: this.latestSnapshot.snapshotId,
            ownerId: this._ownerId,
        });
    }
    publish(actorOwnerId) {
        this.verifyOwnership(actorOwnerId);
        if (this._status !== "Validated") {
            throw new Error(`Cannot publish memory when in status: ${this._status}`);
        }
        this._status = "Published";
        this._updatedAt = new Date();
        this.addDomainEvent({
            eventType: MEMORY_PUBLISHED,
            memoryId: this._id,
            reference: this._reference,
            snapshotId: this.latestSnapshot.snapshotId,
            ownerId: this._ownerId,
        });
    }
    archive(actorOwnerId) {
        this.verifyOwnership(actorOwnerId);
        if (this._status === "Archived") {
            throw new Error("Memory is already archived.");
        }
        this._status = "Archived";
        this._updatedAt = new Date();
        this.addDomainEvent({
            eventType: MEMORY_ARCHIVED,
            memoryId: this._id,
            reference: this._reference,
            snapshotId: this.latestSnapshot.snapshotId,
            ownerId: this._ownerId,
        });
    }
}
