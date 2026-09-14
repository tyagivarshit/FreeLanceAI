// 2. Value Objects
export class GrammarProfile {
    _value;
    static ALLOWED_PROFILES = ["standard", "formal", "simplified"];
    constructor(value) {
        if (!value || value.trim() === "") {
            throw new Error("Grammar profile value is required.");
        }
        const normalized = value.trim().toLowerCase();
        if (!GrammarProfile.ALLOWED_PROFILES.includes(normalized)) {
            throw new Error(`Invalid grammar profile: ${value}. Value must be one of the approved vocabulary profiles.`);
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
export class GrammarRequest {
    _sourceReference;
    _sourceVersion;
    _targetProfile;
    constructor(properties) {
        if (!properties.sourceReference || properties.sourceReference.trim() === "") {
            throw new Error("Source reference is required for GrammarRequest.");
        }
        if (properties.sourceVersion <= 0) {
            throw new Error("Source version must be greater than zero.");
        }
        if (!properties.targetProfile) {
            throw new Error("Target GrammarProfile is required for GrammarRequest.");
        }
        this._sourceReference = properties.sourceReference.trim();
        this._sourceVersion = properties.sourceVersion;
        this._targetProfile = properties.targetProfile;
        Object.freeze(this);
    }
    get sourceReference() {
        return this._sourceReference;
    }
    get sourceVersion() {
        return this._sourceVersion;
    }
    get targetProfile() {
        return this._targetProfile;
    }
    equals(other) {
        if (!other) {
            return false;
        }
        return (this._sourceReference === other.sourceReference &&
            this._sourceVersion === other.sourceVersion &&
            this._targetProfile.equals(other.targetProfile));
    }
}
export class GrammarResult {
    _correctedText;
    _correctedAt;
    constructor(properties) {
        if (!properties.correctedText || properties.correctedText.trim() === "") {
            throw new Error("Corrected reply content is required for GrammarResult.");
        }
        if (!properties.correctedAt) {
            throw new Error("Corrected timestamp is required for GrammarResult.");
        }
        this._correctedText = properties.correctedText.trim();
        this._correctedAt = new Date(properties.correctedAt.getTime());
        Object.freeze(this);
    }
    get correctedText() {
        return this._correctedText;
    }
    get correctedAt() {
        return new Date(this._correctedAt.getTime());
    }
    equals(other) {
        if (!other) {
            return false;
        }
        return (this._correctedText === other.correctedText &&
            this._correctedAt.getTime() === other.correctedAt.getTime());
    }
}
export class ReplyGrammarCorrectionSnapshot {
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
export const REPLY_GRAMMAR_DRAFTED = "REPLY_GRAMMAR_DRAFTED";
export const REPLY_GRAMMAR_REQUESTED = "REPLY_GRAMMAR_REQUESTED";
export const REPLY_GRAMMAR_CORRECTED = "REPLY_GRAMMAR_CORRECTED";
export const REPLY_GRAMMAR_ARCHIVED = "REPLY_GRAMMAR_ARCHIVED";
// 7. ReplyGrammarCorrection Aggregate Root
export class ReplyGrammarCorrection {
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
            throw new Error("Grammar Correction Identity is required.");
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
            throw new Error("Grammar Request is required.");
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
        const newSnapshot = new ReplyGrammarCorrectionSnapshot({
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
        const correction = new ReplyGrammarCorrection({
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
        correction.appendSnapshot();
        correction.addDomainEvent({
            eventType: REPLY_GRAMMAR_DRAFTED,
            grammarCorrectionId: correction.id,
            sourceReference: correction.sourceReference,
            ownerId: correction.ownerId,
            sourceVersion: correction.sourceVersion,
            grammarProfile: correction.request.targetProfile.value,
            snapshotVersion: correction.snapshots.length,
        });
        return correction;
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
        else if (nextStatus === "Corrected") {
            if (this._status !== "Requested") {
                throw new Error(`Invalid lifecycle transition from ${this._status.toUpperCase()} to CORRECTED`);
            }
        }
        else if (nextStatus === "Draft") {
            throw new Error(`Invalid lifecycle transition from ${this._status.toUpperCase()} to DRAFT`);
        }
        this._status = nextStatus;
        this._updatedAt = new Date();
        this.appendSnapshot();
    }
    requestGrammarCorrection(actorOwnerId) {
        this.verifyOwnership(actorOwnerId);
        this.transitionTo("Requested");
        this.addDomainEvent({
            eventType: REPLY_GRAMMAR_REQUESTED,
            grammarCorrectionId: this._id,
            sourceReference: this._sourceReference,
            ownerId: this._ownerId,
            sourceVersion: this._sourceVersion,
            grammarProfile: this._request.targetProfile.value,
            snapshotVersion: this._snapshots.length,
        });
    }
    completeGrammarCorrection(actorOwnerId, result) {
        this.verifyOwnership(actorOwnerId);
        if (!result) {
            throw new Error("GrammarResult is required for completeGrammarCorrection.");
        }
        this.transitionTo("Corrected");
        this._result = result;
        this.addDomainEvent({
            eventType: REPLY_GRAMMAR_CORRECTED,
            grammarCorrectionId: this._id,
            sourceReference: this._sourceReference,
            ownerId: this._ownerId,
            sourceVersion: this._sourceVersion,
            grammarProfile: this._request.targetProfile.value,
            snapshotVersion: this._snapshots.length,
        });
    }
    archive(actorOwnerId) {
        this.verifyOwnership(actorOwnerId);
        if (this._status === "Archived") {
            throw new Error("Reply grammar correction is already archived.");
        }
        this.transitionTo("Archived");
        this.addDomainEvent({
            eventType: REPLY_GRAMMAR_ARCHIVED,
            grammarCorrectionId: this._id,
            sourceReference: this._sourceReference,
            ownerId: this._ownerId,
            sourceVersion: this._sourceVersion,
            grammarProfile: this._request.targetProfile.value,
            snapshotVersion: this._snapshots.length,
        });
    }
}
