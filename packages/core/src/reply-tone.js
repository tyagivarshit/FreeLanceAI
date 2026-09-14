// 2. Value Objects
export class ToneProfile {
    _value;
    static ALLOWED_TONES = [
        "professional",
        "friendly",
        "casual",
        "formal",
        "concise",
        "persuasive",
        "empathetic",
        "direct",
    ];
    constructor(value) {
        if (!value || value.trim() === "") {
            throw new Error("Tone profile value is required.");
        }
        const normalized = value.trim().toLowerCase();
        if (!ToneProfile.ALLOWED_TONES.includes(normalized)) {
            throw new Error(`Invalid tone profile: ${value}. Value must be one of the approved vocabulary tones.`);
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
export class ToneRequest {
    _sourceReference;
    _sourceVersion;
    _targetTone;
    constructor(properties) {
        if (!properties.sourceReference || properties.sourceReference.trim() === "") {
            throw new Error("Source reference is required for ToneRequest.");
        }
        if (properties.sourceVersion <= 0) {
            throw new Error("Source version must be greater than zero.");
        }
        if (!properties.targetTone) {
            throw new Error("Target ToneProfile is required for ToneRequest.");
        }
        this._sourceReference = properties.sourceReference.trim();
        this._sourceVersion = properties.sourceVersion;
        this._targetTone = properties.targetTone;
        Object.freeze(this);
    }
    get sourceReference() {
        return this._sourceReference;
    }
    get sourceVersion() {
        return this._sourceVersion;
    }
    get targetTone() {
        return this._targetTone;
    }
    equals(other) {
        if (!other) {
            return false;
        }
        return (this._sourceReference === other.sourceReference &&
            this._sourceVersion === other.sourceVersion &&
            this._targetTone.equals(other.targetTone));
    }
}
export class ToneResult {
    _adjustedText;
    _adjustedAt;
    constructor(properties) {
        if (!properties.adjustedText || properties.adjustedText.trim() === "") {
            throw new Error("Adjusted reply content is required for ToneResult.");
        }
        if (!properties.adjustedAt) {
            throw new Error("Adjusted timestamp is required for ToneResult.");
        }
        this._adjustedText = properties.adjustedText.trim();
        this._adjustedAt = new Date(properties.adjustedAt.getTime());
        Object.freeze(this);
    }
    get adjustedText() {
        return this._adjustedText;
    }
    get adjustedAt() {
        return new Date(this._adjustedAt.getTime());
    }
    equals(other) {
        if (!other) {
            return false;
        }
        return (this._adjustedText === other.adjustedText &&
            this._adjustedAt.getTime() === other.adjustedAt.getTime());
    }
}
export class ReplyToneAdjustmentSnapshot {
    _version;
    _createdAt;
    _status;
    _request;
    _result;
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
        if (!properties.request) {
            throw new Error("Snapshot request is required.");
        }
        this._version = properties.version;
        this._createdAt = new Date(properties.createdAt.getTime());
        this._status = properties.status;
        this._request = properties.request;
        this._result = properties.result;
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
    get request() {
        return this._request;
    }
    get result() {
        return this._result;
    }
}
// 4. Domain Events
export const REPLY_TONE_DRAFTED = "REPLY_TONE_DRAFTED";
export const REPLY_TONE_REQUESTED = "REPLY_TONE_REQUESTED";
export const REPLY_TONE_ADJUSTED = "REPLY_TONE_ADJUSTED";
export const REPLY_TONE_ARCHIVED = "REPLY_TONE_ARCHIVED";
// 7. ReplyToneAdjustment Aggregate Root
export class ReplyToneAdjustment {
    _id;
    _sourceReference;
    _ownerId;
    _sourceVersion;
    _request;
    _result;
    _status;
    _snapshots = [];
    _createdAt;
    _updatedAt;
    _domainEvents = [];
    constructor(properties) {
        if (!properties.id || properties.id.trim() === "") {
            throw new Error("Tone Adjustment Identity is required.");
        }
        if (!properties.sourceReference || properties.sourceReference.trim() === "") {
            throw new Error("Source Reference is required.");
        }
        if (!properties.ownerId || properties.ownerId.trim() === "") {
            throw new Error("Owner Reference is required.");
        }
        if (properties.sourceVersion <= 0) {
            throw new Error("Source version must be greater than zero.");
        }
        if (!properties.request) {
            throw new Error("Tone Request is required.");
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
        this._sourceReference = properties.sourceReference;
        this._ownerId = properties.ownerId;
        this._sourceVersion = properties.sourceVersion;
        this._request = properties.request;
        this._result = properties.result;
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
    get sourceReference() {
        return this._sourceReference;
    }
    get ownerId() {
        return this._ownerId;
    }
    get sourceVersion() {
        return this._sourceVersion;
    }
    get request() {
        return this._request;
    }
    get result() {
        return this._result;
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
        const newSnapshot = new ReplyToneAdjustmentSnapshot({
            version: nextVersion,
            createdAt: new Date(),
            status: this._status,
            request: this._request,
            result: this._result,
        });
        this._snapshots.push(newSnapshot);
    }
    // Factory Creation Method
    static create(id, sourceReference, ownerId, sourceVersion, request) {
        const now = new Date();
        const adjustment = new ReplyToneAdjustment({
            id,
            sourceReference,
            ownerId,
            sourceVersion,
            request,
            result: undefined,
            status: "Draft",
            snapshots: [],
            createdAt: now,
            updatedAt: now,
        });
        adjustment.appendSnapshot();
        adjustment.addDomainEvent({
            eventType: REPLY_TONE_DRAFTED,
            toneAdjustmentId: adjustment.id,
            sourceReference: adjustment.sourceReference,
            ownerId: adjustment.ownerId,
            sourceVersion: adjustment.sourceVersion,
            targetTone: adjustment.request.targetTone.value,
            snapshotVersion: adjustment.snapshots.length,
        });
        return adjustment;
    }
    // Domain Transitions
    transitionTo(nextStatus) {
        if (this._status === "Archived") {
            throw new Error(`Invalid lifecycle transition from ARCHIVED to ${nextStatus.toUpperCase()}`);
        }
        if (nextStatus === "Requested") {
            if (this._status !== "Draft") {
                throw new Error(`Invalid lifecycle transition from ${this._status.toUpperCase()} to REQUESTED`);
            }
        }
        else if (nextStatus === "Adjusted") {
            if (this._status !== "Requested") {
                throw new Error(`Invalid lifecycle transition from ${this._status.toUpperCase()} to ADJUSTED`);
            }
        }
        else if (nextStatus === "Draft") {
            throw new Error(`Invalid lifecycle transition from ${this._status.toUpperCase()} to DRAFT`);
        }
        this._status = nextStatus;
        this._updatedAt = new Date();
        this.appendSnapshot();
    }
    requestToneAdjustment(actorOwnerId) {
        this.verifyOwnership(actorOwnerId);
        this.transitionTo("Requested");
        this.addDomainEvent({
            eventType: REPLY_TONE_REQUESTED,
            toneAdjustmentId: this._id,
            sourceReference: this._sourceReference,
            ownerId: this._ownerId,
            sourceVersion: this._sourceVersion,
            targetTone: this._request.targetTone.value,
            snapshotVersion: this._snapshots.length,
        });
    }
    completeToneAdjustment(actorOwnerId, result) {
        this.verifyOwnership(actorOwnerId);
        if (!result) {
            throw new Error("ToneResult is required for completeToneAdjustment.");
        }
        this.transitionTo("Adjusted");
        this._result = result;
        this.addDomainEvent({
            eventType: REPLY_TONE_ADJUSTED,
            toneAdjustmentId: this._id,
            sourceReference: this._sourceReference,
            ownerId: this._ownerId,
            sourceVersion: this._sourceVersion,
            targetTone: this._request.targetTone.value,
            snapshotVersion: this._snapshots.length,
        });
    }
    archive(actorOwnerId) {
        this.verifyOwnership(actorOwnerId);
        if (this._status === "Archived") {
            throw new Error("Reply tone adjustment is already archived.");
        }
        this.transitionTo("Archived");
        this.addDomainEvent({
            eventType: REPLY_TONE_ARCHIVED,
            toneAdjustmentId: this._id,
            sourceReference: this._sourceReference,
            ownerId: this._ownerId,
            sourceVersion: this._sourceVersion,
            targetTone: this._request.targetTone.value,
            snapshotVersion: this._snapshots.length,
        });
    }
}
