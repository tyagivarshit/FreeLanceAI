// Domain Event Names
export const AI_REQUEST_RECEIVED = "AI_REQUEST_RECEIVED";
export const AI_REQUEST_ACCEPTED = "AI_REQUEST_ACCEPTED";
export const AI_REQUEST_ORCHESTRATING = "AI_REQUEST_ORCHESTRATING";
export const AI_REQUEST_COMPLETED = "AI_REQUEST_COMPLETED";
export const AI_REQUEST_FAILED = "AI_REQUEST_FAILED";
/**
 * AiRequestMetadata is deeply immutable.
 * Nested mutable structures are strictly prohibited.
 * Any update to metadata requires complete Value Object replacement;
 * in-place property mutations are never allowed.
 */
export class AiRequestMetadata {
    _correlationId;
    _invocationMetadata;
    _logicalClassification;
    constructor(properties) {
        if (!properties.correlationId || properties.correlationId.trim() === "") {
            throw new Error("Correlation ID is required.");
        }
        this._correlationId = properties.correlationId;
        this._invocationMetadata = properties.invocationMetadata || "";
        this._logicalClassification = properties.logicalClassification || "";
    }
    get correlationId() {
        return this._correlationId;
    }
    get invocationMetadata() {
        return this._invocationMetadata;
    }
    get logicalClassification() {
        return this._logicalClassification;
    }
    equals(other) {
        return (this._correlationId === other.correlationId &&
            this._invocationMetadata === other.invocationMetadata &&
            this._logicalClassification === other.logicalClassification);
    }
}
// AI Request Aggregate Root
export class AiRequest {
    _requestId;
    _requestContextReference;
    _ownerId;
    _metadata;
    _status;
    _createdAt;
    _updatedAt;
    _domainEvents = [];
    constructor(properties) {
        if (!properties.requestId || properties.requestId.trim() === "") {
            throw new Error("Request ID is required.");
        }
        if (!properties.requestContextReference || properties.requestContextReference.trim() === "") {
            throw new Error("Request context reference is required.");
        }
        if (!properties.ownerId || properties.ownerId.trim() === "") {
            throw new Error("Owner ID reference is required.");
        }
        if (!properties.metadata) {
            throw new Error("Request metadata is required.");
        }
        this._requestId = properties.requestId;
        this._requestContextReference = properties.requestContextReference;
        this._ownerId = properties.ownerId;
        this._metadata = properties.metadata;
        this._status = properties.status;
        this._createdAt = properties.createdAt;
        this._updatedAt = properties.updatedAt;
        this.validateInvariants();
    }
    get requestId() {
        return this._requestId;
    }
    get requestContextReference() {
        return this._requestContextReference;
    }
    get ownerId() {
        return this._ownerId;
    }
    get metadata() {
        return this._metadata;
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
    clearDomainEvents() {
        this._domainEvents = [];
    }
    addDomainEvent(event) {
        this._domainEvents.push(event);
    }
    // Factory Creation Method
    static create(requestId, requestContextReference, ownerId, metadata) {
        const now = new Date();
        const request = new AiRequest({
            requestId,
            requestContextReference,
            ownerId,
            metadata,
            status: "Received",
            createdAt: now,
            updatedAt: now,
        });
        request.addDomainEvent({
            eventType: AI_REQUEST_RECEIVED,
            requestId: request.requestId,
            requestContextReference: request.requestContextReference,
            ownerId: request.ownerId,
        });
        return request;
    }
    // Logical operations (transitions occur through valid Domain Operations)
    accept(ownerId) {
        this.verifyOwnership(ownerId);
        if (this._status !== "Received") {
            throw new Error(`Cannot accept request in status: ${this._status}`);
        }
        this._status = "Accepted";
        this._updatedAt = new Date();
        this.addDomainEvent({
            eventType: AI_REQUEST_ACCEPTED,
            requestId: this._requestId,
        });
    }
    orchestrate(ownerId) {
        this.verifyOwnership(ownerId);
        if (this._status !== "Accepted") {
            throw new Error(`Cannot orchestrate request in status: ${this._status}`);
        }
        this._status = "Orchestrating";
        this._updatedAt = new Date();
        this.addDomainEvent({
            eventType: AI_REQUEST_ORCHESTRATING,
            requestId: this._requestId,
        });
    }
    complete(ownerId) {
        this.verifyOwnership(ownerId);
        if (this._status !== "Orchestrating") {
            throw new Error(`Cannot complete request in status: ${this._status}`);
        }
        this._status = "Completed";
        this._updatedAt = new Date();
        this.addDomainEvent({
            eventType: AI_REQUEST_COMPLETED,
            requestId: this._requestId,
        });
    }
    fail(ownerId) {
        this.verifyOwnership(ownerId);
        if (this._status === "Completed" || this._status === "Failed") {
            throw new Error(`Cannot fail request in status: ${this._status}`);
        }
        this._status = "Failed";
        this._updatedAt = new Date();
        this.addDomainEvent({
            eventType: AI_REQUEST_FAILED,
            requestId: this._requestId,
        });
    }
    updateMetadata(ownerId, metadata) {
        this.verifyOwnership(ownerId);
        if (this._status === "Completed" || this._status === "Failed") {
            throw new Error("Cannot update metadata on completed or failed request.");
        }
        this._metadata = metadata;
        this._updatedAt = new Date();
    }
    verifyOwnership(ownerId) {
        if (ownerId !== this._ownerId) {
            throw new Error("Ownership validation failed.");
        }
    }
    validateInvariants() {
        if (!this._requestId || this._requestId.trim() === "") {
            throw new Error("Request ID is required.");
        }
        if (!this._requestContextReference || this._requestContextReference.trim() === "") {
            throw new Error("Request context reference is required.");
        }
        if (!this._ownerId || this._ownerId.trim() === "") {
            throw new Error("Owner ID reference is required.");
        }
    }
}
