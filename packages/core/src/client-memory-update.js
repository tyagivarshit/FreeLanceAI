// 1. Value Objects
export class MemoryUpdateReference {
    _value;
    constructor(value) {
        if (!value || value.trim() === "") {
            throw new Error("Memory update reference is required.");
        }
        const cleanValue = value.trim();
        const pattern = /^[a-z0-9]+([.-][a-z0-9]+)*$/;
        if (!pattern.test(cleanValue)) {
            throw new Error("Invalid memory update reference format.");
        }
        this._value = cleanValue;
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
export class TargetMemoryReference {
    _value;
    constructor(value) {
        if (!value || value.trim() === "") {
            throw new Error("Target memory reference is required.");
        }
        const cleanValue = value.trim();
        const pattern = /^[a-z0-9]+([.-][a-z0-9]+)*$/;
        if (!pattern.test(cleanValue)) {
            throw new Error("Invalid target memory reference format.");
        }
        this._value = cleanValue;
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
export class MemoryUpdateSpecification {
    _operation;
    _target;
    _proposedValue;
    _reason;
    constructor(properties) {
        if (!properties.operation || properties.operation.trim() === "") {
            throw new Error("Operation type is required.");
        }
        if (!properties.target || properties.target.trim() === "") {
            throw new Error("Target specification is required.");
        }
        if (!properties.proposedValue || properties.proposedValue.trim() === "") {
            throw new Error("Proposed value is required.");
        }
        if (!properties.reason || properties.reason.trim() === "") {
            throw new Error("Reason is required.");
        }
        const cleanOp = properties.operation.trim();
        const validOps = ["Create", "Replace", "Append", "Remove"];
        const matched = validOps.find((op) => op.toLowerCase() === cleanOp.toLowerCase());
        if (!matched) {
            throw new Error(`Invalid operation type: ${cleanOp}.`);
        }
        this._operation = matched;
        this._target = properties.target.trim();
        this._proposedValue = properties.proposedValue.trim();
        this._reason = properties.reason.trim();
        Object.freeze(this);
    }
    get operation() {
        return this._operation;
    }
    get target() {
        return this._target;
    }
    get proposedValue() {
        return this._proposedValue;
    }
    get reason() {
        return this._reason;
    }
    equals(other) {
        if (!other) {
            return false;
        }
        return (this._operation === other.operation &&
            this._target === other.target &&
            this._proposedValue === other.proposedValue &&
            this._reason === other.reason);
    }
}
export class MemoryUpdateClassification {
    _value;
    constructor(value) {
        if (!value || value.trim() === "") {
            throw new Error("Memory update classification is required.");
        }
        const cleanValue = value.trim();
        const validCategories = [
            "Preference",
            "Goal",
            "Constraint",
            "Fact",
            "Relationship",
            "Risk",
            "Context",
        ];
        const matched = validCategories.find((c) => c.toLowerCase() === cleanValue.toLowerCase());
        if (!matched) {
            throw new Error(`Invalid Memory update classification category: ${cleanValue}.`);
        }
        this._value = matched;
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
export class MemoryUpdateSourceReference {
    _value;
    constructor(value) {
        if (!value || value.trim() === "") {
            throw new Error("Source reference is required.");
        }
        const cleanValue = value.trim();
        const pattern = /^[a-z0-9]+([.-][a-z0-9]+)*$/;
        if (!pattern.test(cleanValue)) {
            throw new Error("Invalid source reference format.");
        }
        this._value = cleanValue;
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
export class MemoryUpdatePriority {
    _value;
    constructor(value) {
        if (!value || value.trim() === "") {
            throw new Error("Memory update priority is required.");
        }
        const cleanValue = value.trim();
        const validPriorities = ["Low", "Normal", "High", "Critical"];
        const matched = validPriorities.find((p) => p.toLowerCase() === cleanValue.toLowerCase());
        if (!matched) {
            throw new Error(`Invalid Memory update priority: ${cleanValue}.`);
        }
        this._value = matched;
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
export class MemoryUpdateFingerprint {
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
export class ClientMemoryUpdateSnapshot {
    _version;
    _createdAt;
    _updateReference;
    _clientId;
    _ownerId;
    _targetMemoryReference;
    _specification;
    _classification;
    _sourceReference;
    _priority;
    _fingerprint;
    _lifecycle;
    constructor(properties) {
        if (properties.version <= 0) {
            throw new Error("Snapshot version must be greater than zero.");
        }
        if (!properties.createdAt) {
            throw new Error("Snapshot creation date is required.");
        }
        if (!properties.updateReference) {
            throw new Error("Memory update reference is required.");
        }
        if (!properties.clientId || properties.clientId.trim() === "") {
            throw new Error("Client reference is required.");
        }
        if (!properties.ownerId || properties.ownerId.trim() === "") {
            throw new Error("Owner reference is required.");
        }
        if (!properties.targetMemoryReference) {
            throw new Error("Target memory reference is required.");
        }
        if (!properties.specification) {
            throw new Error("Update specification is required.");
        }
        if (!properties.classification) {
            throw new Error("Classification is required.");
        }
        if (!properties.sourceReference) {
            throw new Error("Source reference is required.");
        }
        if (!properties.priority) {
            throw new Error("Priority is required.");
        }
        if (!properties.fingerprint) {
            throw new Error("Fingerprint is required.");
        }
        if (!properties.lifecycle) {
            throw new Error("Lifecycle state is required.");
        }
        this._version = properties.version;
        this._createdAt = new Date(properties.createdAt.getTime());
        this._updateReference = properties.updateReference;
        this._clientId = properties.clientId;
        this._ownerId = properties.ownerId;
        this._targetMemoryReference = properties.targetMemoryReference;
        this._specification = properties.specification;
        this._classification = properties.classification;
        this._sourceReference = properties.sourceReference;
        this._priority = properties.priority;
        this._fingerprint = properties.fingerprint;
        this._lifecycle = properties.lifecycle;
        Object.freeze(this);
    }
    get version() {
        return this._version;
    }
    get createdAt() {
        return new Date(this._createdAt.getTime());
    }
    get updateReference() {
        return this._updateReference;
    }
    get clientId() {
        return this._clientId;
    }
    get ownerId() {
        return this._ownerId;
    }
    get targetMemoryReference() {
        return this._targetMemoryReference;
    }
    get specification() {
        return this._specification;
    }
    get classification() {
        return this._classification;
    }
    get sourceReference() {
        return this._sourceReference;
    }
    get priority() {
        return this._priority;
    }
    get fingerprint() {
        return this._fingerprint;
    }
    get lifecycle() {
        return this._lifecycle;
    }
}
// 4. Domain Events
export const CLIENT_MEMORY_UPDATE_PROPOSED = "CLIENT_MEMORY_UPDATE_PROPOSED";
export const CLIENT_MEMORY_UPDATE_VALIDATED = "CLIENT_MEMORY_UPDATE_VALIDATED";
export const CLIENT_MEMORY_UPDATE_APPROVED = "CLIENT_MEMORY_UPDATE_APPROVED";
export const CLIENT_MEMORY_UPDATE_APPLIED = "CLIENT_MEMORY_UPDATE_APPLIED";
export const CLIENT_MEMORY_UPDATE_REJECTED = "CLIENT_MEMORY_UPDATE_REJECTED";
export const CLIENT_MEMORY_UPDATE_ARCHIVED = "CLIENT_MEMORY_UPDATE_ARCHIVED";
// 7. ClientMemoryUpdate Aggregate Root
export class ClientMemoryUpdate {
    _id;
    _updateReference;
    _clientId;
    _ownerId;
    _targetMemoryReference;
    _specification;
    _classification;
    _sourceReference;
    _priority;
    _fingerprint;
    _lifecycle;
    _snapshots = [];
    _createdAt;
    _updatedAt;
    _domainEvents = [];
    constructor(properties) {
        this._id = properties.id;
        this._updateReference = properties.updateReference;
        this._clientId = properties.clientId;
        this._ownerId = properties.ownerId;
        this._targetMemoryReference = properties.targetMemoryReference;
        this._specification = properties.specification;
        this._classification = properties.classification;
        this._sourceReference = properties.sourceReference;
        this._priority = properties.priority;
        this._fingerprint = properties.fingerprint;
        this._lifecycle = properties.lifecycle;
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
    get updateReference() {
        return this._updateReference;
    }
    get clientId() {
        return this._clientId;
    }
    get ownerId() {
        return this._ownerId;
    }
    get targetMemoryReference() {
        return this._targetMemoryReference;
    }
    get specification() {
        return this._specification;
    }
    get classification() {
        return this._classification;
    }
    get sourceReference() {
        return this._sourceReference;
    }
    get priority() {
        return this._priority;
    }
    get fingerprint() {
        return this._fingerprint;
    }
    get lifecycle() {
        return this._lifecycle;
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
        return this._domainEvents;
    }
    clearDomainEvents() {
        this._domainEvents = [];
    }
    addDomainEvent(event) {
        this._domainEvents.push(event);
    }
    verifyOwnership(actorOwnerId) {
        if (!actorOwnerId || actorOwnerId.trim() === "") {
            throw new Error("Missing owner identity in caller context.");
        }
        if (actorOwnerId !== this._ownerId) {
            throw new Error("Ownership validation failed: unauthorized owner context.");
        }
    }
    validateInvariants() {
        if (!this._id || this._id.trim() === "") {
            throw new Error("Update Identity is required.");
        }
        if (!this._updateReference) {
            throw new Error("Update Reference is required.");
        }
        if (!this._clientId || this._clientId.trim() === "") {
            throw new Error("Client Reference is required.");
        }
        if (!this._ownerId || this._ownerId.trim() === "") {
            throw new Error("Owner Reference is required.");
        }
        if (!this._targetMemoryReference) {
            throw new Error("Target Memory Reference is required.");
        }
        if (!this._specification) {
            throw new Error("Update Specification is required.");
        }
        if (!this._classification) {
            throw new Error("Update Classification is required.");
        }
        if (!this._sourceReference) {
            throw new Error("Update Source Reference is required.");
        }
        if (!this._priority) {
            throw new Error("Update Priority is required.");
        }
        if (!this._fingerprint) {
            throw new Error("Update Fingerprint is required.");
        }
        if (!this._lifecycle) {
            throw new Error("Lifecycle state is required.");
        }
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
        const newSnapshot = new ClientMemoryUpdateSnapshot({
            version: nextVersion,
            createdAt: new Date(),
            updateReference: this._updateReference,
            clientId: this._clientId,
            ownerId: this._ownerId,
            targetMemoryReference: this._targetMemoryReference,
            specification: this._specification,
            classification: this._classification,
            sourceReference: this._sourceReference,
            priority: this._priority,
            fingerprint: this._fingerprint,
            lifecycle: this._lifecycle,
        });
        this._snapshots.push(newSnapshot);
    }
    // Factory Creation Method
    static create(id, updateReference, clientId, ownerId, targetMemoryReference, specification, classification, sourceReference, priority, fingerprint) {
        const now = new Date();
        const update = new ClientMemoryUpdate({
            id,
            updateReference,
            clientId,
            ownerId,
            targetMemoryReference,
            specification,
            classification,
            sourceReference,
            priority,
            fingerprint,
            lifecycle: "Draft",
            snapshots: [],
            createdAt: now,
            updatedAt: now,
        });
        update.appendSnapshot();
        return update;
    }
    // Domain Operations
    propose(actorOwnerId) {
        this.verifyOwnership(actorOwnerId);
        if (this._lifecycle !== "Draft") {
            throw new Error(`Cannot propose update when in status: ${this._lifecycle}`);
        }
        this._lifecycle = "Proposed";
        this._updatedAt = new Date();
        this.appendSnapshot();
        this.addDomainEvent({
            eventType: CLIENT_MEMORY_UPDATE_PROPOSED,
            updateId: this._id,
            updateReference: this._updateReference.value,
            clientId: this._clientId,
            ownerId: this._ownerId,
            targetMemoryReference: this._targetMemoryReference.value,
            snapshotVersion: this._snapshots.length,
        });
    }
    validate(actorOwnerId) {
        this.verifyOwnership(actorOwnerId);
        if (this._lifecycle !== "Proposed") {
            throw new Error(`Cannot validate update when in status: ${this._lifecycle}`);
        }
        this._lifecycle = "Validated";
        this._updatedAt = new Date();
        this.appendSnapshot();
        this.addDomainEvent({
            eventType: CLIENT_MEMORY_UPDATE_VALIDATED,
            updateId: this._id,
            updateReference: this._updateReference.value,
            clientId: this._clientId,
            ownerId: this._ownerId,
            targetMemoryReference: this._targetMemoryReference.value,
            snapshotVersion: this._snapshots.length,
        });
    }
    approve(actorOwnerId) {
        this.verifyOwnership(actorOwnerId);
        if (this._lifecycle !== "Validated") {
            throw new Error(`Cannot approve update when in status: ${this._lifecycle}`);
        }
        this._lifecycle = "Approved";
        this._updatedAt = new Date();
        this.appendSnapshot();
        this.addDomainEvent({
            eventType: CLIENT_MEMORY_UPDATE_APPROVED,
            updateId: this._id,
            updateReference: this._updateReference.value,
            clientId: this._clientId,
            ownerId: this._ownerId,
            targetMemoryReference: this._targetMemoryReference.value,
            snapshotVersion: this._snapshots.length,
        });
    }
    apply(actorOwnerId) {
        this.verifyOwnership(actorOwnerId);
        if (this._lifecycle !== "Approved") {
            throw new Error(`Cannot apply update when in status: ${this._lifecycle}`);
        }
        // Applied state update only (Actual memory mutation remains completely outside Core aggregate boundaries)
        this._lifecycle = "Applied";
        this._updatedAt = new Date();
        this.appendSnapshot();
        this.addDomainEvent({
            eventType: CLIENT_MEMORY_UPDATE_APPLIED,
            updateId: this._id,
            updateReference: this._updateReference.value,
            clientId: this._clientId,
            ownerId: this._ownerId,
            targetMemoryReference: this._targetMemoryReference.value,
            snapshotVersion: this._snapshots.length,
        });
    }
    reject(actorOwnerId) {
        this.verifyOwnership(actorOwnerId);
        const nonRejectable = ["Applied", "Rejected", "Archived"];
        if (nonRejectable.includes(this._lifecycle)) {
            throw new Error(`Cannot reject update when in status: ${this._lifecycle}`);
        }
        this._lifecycle = "Rejected";
        this._updatedAt = new Date();
        this.appendSnapshot();
        this.addDomainEvent({
            eventType: CLIENT_MEMORY_UPDATE_REJECTED,
            updateId: this._id,
            updateReference: this._updateReference.value,
            clientId: this._clientId,
            ownerId: this._ownerId,
            targetMemoryReference: this._targetMemoryReference.value,
            snapshotVersion: this._snapshots.length,
        });
    }
    archive(actorOwnerId) {
        this.verifyOwnership(actorOwnerId);
        if (this._lifecycle === "Archived") {
            throw new Error("Update is already archived.");
        }
        this._lifecycle = "Archived";
        this._updatedAt = new Date();
        this.appendSnapshot();
        this.addDomainEvent({
            eventType: CLIENT_MEMORY_UPDATE_ARCHIVED,
            updateId: this._id,
            updateReference: this._updateReference.value,
            clientId: this._clientId,
            ownerId: this._ownerId,
            targetMemoryReference: this._targetMemoryReference.value,
            snapshotVersion: this._snapshots.length,
        });
    }
    update(actorOwnerId, targetMemoryReference, specification, classification, sourceReference, priority, fingerprint) {
        this.verifyOwnership(actorOwnerId);
        const unupdatable = ["Applied", "Rejected", "Archived"];
        if (unupdatable.includes(this._lifecycle)) {
            throw new Error(`Cannot update memory request in status: ${this._lifecycle}`);
        }
        this._targetMemoryReference = targetMemoryReference;
        this._specification = specification;
        this._classification = classification;
        this._sourceReference = sourceReference;
        this._priority = priority;
        this._fingerprint = fingerprint;
        this._updatedAt = new Date();
        this.appendSnapshot();
    }
}
