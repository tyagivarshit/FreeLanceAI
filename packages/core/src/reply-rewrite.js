// 2. Value Objects
export class RewriteInstruction {
    _text;
    constructor(text) {
        if (!text || text.trim() === "") {
            throw new Error("Rewrite instruction text is required.");
        }
        this._text = text.trim();
        Object.freeze(this);
    }
    get text() {
        return this._text;
    }
    equals(other) {
        if (!other) {
            return false;
        }
        return this._text === other.text;
    }
}
export class RewriteRequest {
    _generationId;
    _sourceVersion;
    _instruction;
    _metadata;
    constructor(properties) {
        if (!properties.generationId || properties.generationId.trim() === "") {
            throw new Error("Generation identifier is required for RewriteRequest.");
        }
        if (properties.sourceVersion <= 0) {
            throw new Error("Source version must be greater than zero.");
        }
        if (!properties.instruction) {
            throw new Error("Instruction is required for RewriteRequest.");
        }
        this._generationId = properties.generationId.trim();
        this._sourceVersion = properties.sourceVersion;
        this._instruction = properties.instruction;
        this._metadata = properties.metadata ? properties.metadata.trim() : undefined;
        Object.freeze(this);
    }
    get generationId() {
        return this._generationId;
    }
    get sourceVersion() {
        return this._sourceVersion;
    }
    get instruction() {
        return this._instruction;
    }
    get metadata() {
        return this._metadata;
    }
    equals(other) {
        if (!other) {
            return false;
        }
        return (this._generationId === other.generationId &&
            this._sourceVersion === other.sourceVersion &&
            this._instruction.equals(other.instruction) &&
            this._metadata === other.metadata);
    }
}
export class RewriteResult {
    _rewrittenText;
    _generatedAt;
    constructor(properties) {
        if (!properties.rewrittenText || properties.rewrittenText.trim() === "") {
            throw new Error("Rewritten text is required for RewriteResult.");
        }
        if (!properties.generatedAt) {
            throw new Error("Generated at date is required for RewriteResult.");
        }
        this._rewrittenText = properties.rewrittenText.trim();
        this._generatedAt = new Date(properties.generatedAt.getTime());
        Object.freeze(this);
    }
    get rewrittenText() {
        return this._rewrittenText;
    }
    get generatedAt() {
        return new Date(this._generatedAt.getTime());
    }
    equals(other) {
        if (!other) {
            return false;
        }
        return (this._rewrittenText === other.rewrittenText &&
            this._generatedAt.getTime() === other.generatedAt.getTime());
    }
}
export class Revision {
    _version;
    _sourceVersion;
    _instruction;
    _rewrittenContent;
    _createdAt;
    constructor(properties) {
        if (properties.version <= 0) {
            throw new Error("Revision version must be greater than zero.");
        }
        if (properties.sourceVersion <= 0) {
            throw new Error("Source version must be greater than zero.");
        }
        if (!properties.instruction) {
            throw new Error("Instruction is required for Revision.");
        }
        if (!properties.rewrittenContent || properties.rewrittenContent.trim() === "") {
            throw new Error("Rewritten content is required for Revision.");
        }
        if (!properties.createdAt) {
            throw new Error("Created date is required for Revision.");
        }
        this._version = properties.version;
        this._sourceVersion = properties.sourceVersion;
        this._instruction = properties.instruction;
        this._rewrittenContent = properties.rewrittenContent.trim();
        this._createdAt = new Date(properties.createdAt.getTime());
        Object.freeze(this);
    }
    get version() {
        return this._version;
    }
    get sourceVersion() {
        return this._sourceVersion;
    }
    get instruction() {
        return this._instruction;
    }
    get rewrittenContent() {
        return this._rewrittenContent;
    }
    get createdAt() {
        return new Date(this._createdAt.getTime());
    }
    equals(other) {
        if (!other) {
            return false;
        }
        return (this._version === other.version &&
            this._sourceVersion === other.sourceVersion &&
            this._instruction.equals(other.instruction) &&
            this._rewrittenContent === other.rewrittenContent &&
            this._createdAt.getTime() === other.createdAt.getTime());
    }
}
export class ReplyRewriteSnapshot {
    _version;
    _createdAt;
    _status;
    _request;
    _result;
    _revisions;
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
        if (!properties.revisions) {
            throw new Error("Snapshot revisions collection is required.");
        }
        this._version = properties.version;
        this._createdAt = new Date(properties.createdAt.getTime());
        this._status = properties.status;
        this._request = properties.request;
        this._result = properties.result;
        this._revisions = [...properties.revisions];
        Object.freeze(this._revisions);
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
    get revisions() {
        return this._revisions;
    }
}
// 5. Domain Events
export const REPLY_REWRITE_DRAFTED = "REPLY_REWRITE_DRAFTED";
export const REPLY_REWRITE_REQUESTED = "REPLY_REWRITE_REQUESTED";
export const REPLY_REWRITE_COMPLETED = "REPLY_REWRITE_COMPLETED";
export const REPLY_REWRITE_ARCHIVED = "REPLY_REWRITE_ARCHIVED";
// 8. ReplyRewrite Aggregate Root
export class ReplyRewrite {
    _id;
    _generationId;
    _ownerId;
    _sourceVersion;
    _request;
    _result;
    _status;
    _revisions = [];
    _snapshots = [];
    _createdAt;
    _updatedAt;
    _domainEvents = [];
    constructor(properties) {
        if (!properties.id || properties.id.trim() === "") {
            throw new Error("Rewrite Identity is required.");
        }
        if (!properties.generationId || properties.generationId.trim() === "") {
            throw new Error("Generation Identity reference is required.");
        }
        if (!properties.ownerId || properties.ownerId.trim() === "") {
            throw new Error("Owner reference is required.");
        }
        if (properties.sourceVersion <= 0) {
            throw new Error("Source version must be greater than zero.");
        }
        if (!properties.request) {
            throw new Error("Rewrite Request is required.");
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
        this._generationId = properties.generationId;
        this._ownerId = properties.ownerId;
        this._sourceVersion = properties.sourceVersion;
        this._request = properties.request;
        this._result = properties.result;
        this._status = properties.status;
        this._createdAt = new Date(properties.createdAt.getTime());
        this._updatedAt = new Date(properties.updatedAt.getTime());
        if (properties.revisions && properties.revisions.length > 0) {
            this._revisions = [...properties.revisions];
        }
        if (properties.snapshots && properties.snapshots.length > 0) {
            this._snapshots = [...properties.snapshots];
        }
        this.validateInvariants();
    }
    // Getters
    get id() {
        return this._id;
    }
    get generationId() {
        return this._generationId;
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
    get revisions() {
        return Object.freeze([...this._revisions]);
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
        if (this._revisions.length > 0) {
            let previousVersion = 0;
            for (const rev of this._revisions) {
                if (rev.version <= previousVersion) {
                    throw new Error("Revision versions must be sequential and strictly increasing.");
                }
                previousVersion = rev.version;
            }
        }
    }
    appendSnapshot() {
        const nextVersion = this._snapshots.length + 1;
        const newSnapshot = new ReplyRewriteSnapshot({
            version: nextVersion,
            createdAt: new Date(),
            status: this._status,
            request: this._request,
            result: this._result,
            revisions: this._revisions,
        });
        this._snapshots.push(newSnapshot);
    }
    // Factory Creation Method
    static create(id, generationId, ownerId, sourceVersion, request) {
        const now = new Date();
        const rewrite = new ReplyRewrite({
            id,
            generationId,
            ownerId,
            sourceVersion,
            request,
            result: undefined,
            status: "Draft",
            revisions: [],
            snapshots: [],
            createdAt: now,
            updatedAt: now,
        });
        rewrite.appendSnapshot();
        rewrite.addDomainEvent({
            eventType: REPLY_REWRITE_DRAFTED,
            rewriteId: rewrite.id,
            generationId: rewrite.generationId,
            ownerId: rewrite.ownerId,
            sourceVersion: rewrite.sourceVersion,
            revisionVersion: undefined,
            snapshotVersion: rewrite.snapshots.length,
        });
        return rewrite;
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
        else if (nextStatus === "Rewritten") {
            if (this._status !== "Requested") {
                throw new Error(`Invalid lifecycle transition from ${this._status.toUpperCase()} to REWRITTEN`);
            }
        }
        else if (nextStatus === "Draft") {
            throw new Error(`Invalid lifecycle transition from ${this._status.toUpperCase()} to DRAFT`);
        }
        this._status = nextStatus;
        this._updatedAt = new Date();
        this.appendSnapshot();
    }
    requestRewrite(actorOwnerId) {
        this.verifyOwnership(actorOwnerId);
        this.transitionTo("Requested");
        this.addDomainEvent({
            eventType: REPLY_REWRITE_REQUESTED,
            rewriteId: this._id,
            generationId: this._generationId,
            ownerId: this._ownerId,
            sourceVersion: this._sourceVersion,
            revisionVersion: undefined,
            snapshotVersion: this._snapshots.length,
        });
    }
    completeRewrite(actorOwnerId, result) {
        this.verifyOwnership(actorOwnerId);
        if (!result) {
            throw new Error("RewriteResult is required for completeRewrite.");
        }
        const nextRevisionVersion = this._revisions.length + 1;
        const previousRevisionVersion = this._revisions.length > 0
            ? this._revisions[this._revisions.length - 1].version
            : this._sourceVersion;
        // Create new Revision
        const newRevision = new Revision({
            version: nextRevisionVersion,
            sourceVersion: previousRevisionVersion,
            instruction: this._request.instruction,
            rewrittenContent: result.rewrittenText,
            createdAt: new Date(),
        });
        this.transitionTo("Rewritten");
        this._revisions.push(newRevision);
        this._result = result;
        this.addDomainEvent({
            eventType: REPLY_REWRITE_COMPLETED,
            rewriteId: this._id,
            generationId: this._generationId,
            ownerId: this._ownerId,
            sourceVersion: this._sourceVersion,
            revisionVersion: newRevision.version,
            snapshotVersion: this._snapshots.length,
        });
    }
    archive(actorOwnerId) {
        this.verifyOwnership(actorOwnerId);
        if (this._status === "Archived") {
            throw new Error("Reply rewrite is already archived.");
        }
        this.transitionTo("Archived");
        this.addDomainEvent({
            eventType: REPLY_REWRITE_ARCHIVED,
            rewriteId: this._id,
            generationId: this._generationId,
            ownerId: this._ownerId,
            sourceVersion: this._sourceVersion,
            revisionVersion: this._revisions.length > 0
                ? this._revisions[this._revisions.length - 1].version
                : undefined,
            snapshotVersion: this._snapshots.length,
        });
    }
}
