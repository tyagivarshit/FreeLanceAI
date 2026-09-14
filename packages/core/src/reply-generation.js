// 2. Value Objects
export class GenerationReference {
    _value;
    constructor(value) {
        if (!value || value.trim() === "") {
            throw new Error("Generation reference value is required and cannot be empty.");
        }
        const cleanValue = value.trim();
        const referencePattern = /^[a-z0-9]+([.-][a-z0-9]+)*$/;
        if (!referencePattern.test(cleanValue)) {
            throw new Error("Invalid generation reference format. Must be lower-case dot/hyphen-separated key.");
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
export class GenerationConstraint {
    _type;
    _value;
    constructor(type, value) {
        if (!type || type.trim() === "") {
            throw new Error("Constraint type is required.");
        }
        if (!value || value.trim() === "") {
            throw new Error("Constraint value is required.");
        }
        const cleanType = type.trim().toLowerCase();
        const cleanValue = value.trim().toLowerCase();
        if (cleanType !== "length" && cleanType !== "format") {
            throw new Error(`Invalid constraint type: ${type}. Only 'length' and 'format' are supported.`);
        }
        if (cleanType === "length") {
            const allowedLengths = ["short", "medium", "long"];
            if (!allowedLengths.includes(cleanValue)) {
                throw new Error(`Invalid length constraint value: ${value}. Must be 'short', 'medium', or 'long'.`);
            }
        }
        else if (cleanType === "format") {
            const allowedFormats = ["plain-text", "markdown"];
            if (!allowedFormats.includes(cleanValue)) {
                throw new Error(`Invalid format constraint value: ${value}. Must be 'plain-text' or 'markdown'.`);
            }
        }
        this._type = cleanType;
        this._value = cleanValue;
        Object.freeze(this);
    }
    get type() {
        return this._type;
    }
    get value() {
        return this._value;
    }
    equals(other) {
        if (!other) {
            return false;
        }
        return this._type === other.type && this._value === other.value;
    }
}
export class GenerationMetadata {
    _displayName;
    _description;
    constructor(properties) {
        if (!properties || properties.displayName === undefined || properties.displayName === null) {
            throw new Error("Display Name is required.");
        }
        if (properties.description === undefined || properties.description === null) {
            throw new Error("Description is required.");
        }
        const cleanName = properties.displayName.trim();
        const cleanDesc = properties.description.trim();
        if (cleanName === "") {
            throw new Error("Display Name is required and cannot be empty.");
        }
        if (cleanDesc === "") {
            throw new Error("Description is required and cannot be empty.");
        }
        this._displayName = cleanName;
        this._description = cleanDesc;
        Object.freeze(this);
    }
    get displayName() {
        return this._displayName;
    }
    get description() {
        return this._description;
    }
    equals(other) {
        if (!other) {
            return false;
        }
        return this._displayName === other.displayName && this._description === other.description;
    }
}
export class GenerationContent {
    _replyText;
    constructor(replyText) {
        if (replyText === undefined || replyText === null) {
            throw new Error("Reply text is required.");
        }
        const cleanText = replyText.trim();
        if (cleanText === "") {
            throw new Error("Reply text is required and cannot be empty.");
        }
        // HTML validation pattern: reject any text containing tags
        const htmlTagPattern = /<[^>]*>/;
        if (htmlTagPattern.test(cleanText)) {
            throw new Error("HTML tags are not allowed in generation content.");
        }
        this._replyText = cleanText;
        Object.freeze(this);
    }
    get replyText() {
        return this._replyText;
    }
    equals(other) {
        if (!other) {
            return false;
        }
        return this._replyText === other.replyText;
    }
}
export class GenerationRequest {
    _reference;
    _intent;
    _constraints;
    _metadata;
    constructor(properties) {
        if (!properties.reference) {
            throw new Error("Reference is required for GenerationRequest.");
        }
        if (properties.intent === undefined ||
            properties.intent === null ||
            properties.intent.trim() === "") {
            throw new Error("Intent is required for GenerationRequest.");
        }
        if (!properties.constraints) {
            throw new Error("Constraints are required for GenerationRequest.");
        }
        if (!properties.metadata) {
            throw new Error("Metadata is required for GenerationRequest.");
        }
        this._reference = properties.reference;
        this._intent = properties.intent.trim();
        this._constraints = [...properties.constraints];
        this._metadata = properties.metadata;
        Object.freeze(this._constraints);
        Object.freeze(this);
    }
    get reference() {
        return this._reference;
    }
    get intent() {
        return this._intent;
    }
    get constraints() {
        return this._constraints;
    }
    get metadata() {
        return this._metadata;
    }
    equals(other) {
        if (!other) {
            return false;
        }
        if (!this._reference.equals(other.reference) ||
            this._intent !== other.intent ||
            !this._metadata.equals(other.metadata)) {
            return false;
        }
        if (this._constraints.length !== other.constraints.length) {
            return false;
        }
        for (let i = 0; i < this._constraints.length; i++) {
            if (!this._constraints[i].equals(other.constraints[i])) {
                return false;
            }
        }
        return true;
    }
}
export class GenerationResult {
    _content;
    _generatedAt;
    constructor(properties) {
        if (!properties.content) {
            throw new Error("Content is required for GenerationResult.");
        }
        if (!properties.generatedAt) {
            throw new Error("Generated date is required for GenerationResult.");
        }
        this._content = properties.content;
        this._generatedAt = new Date(properties.generatedAt.getTime());
        Object.freeze(this);
    }
    get content() {
        return this._content;
    }
    get generatedAt() {
        return new Date(this._generatedAt.getTime());
    }
    equals(other) {
        if (!other) {
            return false;
        }
        return (this._content.equals(other.content) &&
            this._generatedAt.getTime() === other.generatedAt.getTime());
    }
}
export class ReplyGenerationSnapshot {
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
            throw new Error("Snapshot lifecycle state is required.");
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
export const REPLY_GENERATION_DRAFTED = "REPLY_GENERATION_DRAFTED";
export const REPLY_GENERATION_REQUESTED = "REPLY_GENERATION_REQUESTED";
export const REPLY_GENERATION_COMPLETED = "REPLY_GENERATION_COMPLETED";
export const REPLY_GENERATION_ARCHIVED = "REPLY_GENERATION_ARCHIVED";
// 7. ReplyGeneration Aggregate Root
export class ReplyGeneration {
    _id;
    _reference;
    _ownerId;
    _clientId;
    _conversationId;
    _status;
    _request;
    _result;
    _snapshots = [];
    _createdAt;
    _updatedAt;
    _domainEvents = [];
    constructor(properties) {
        if (!properties.id || properties.id.trim() === "") {
            throw new Error("Generation Identity is required.");
        }
        if (!properties.reference) {
            throw new Error("Generation Reference is required.");
        }
        if (!properties.ownerId || properties.ownerId.trim() === "") {
            throw new Error("Owner Reference is required.");
        }
        if (!properties.clientId || properties.clientId.trim() === "") {
            throw new Error("Client Reference is required.");
        }
        if (!properties.conversationId || properties.conversationId.trim() === "") {
            throw new Error("Conversation Reference is required.");
        }
        if (!properties.status) {
            throw new Error("Lifecycle status is required.");
        }
        if (!properties.request) {
            throw new Error("Generation Request is required.");
        }
        if (!properties.createdAt) {
            throw new Error("Creation Date is required.");
        }
        if (!properties.updatedAt) {
            throw new Error("Update Date is required.");
        }
        this._id = properties.id;
        this._reference = properties.reference;
        this._ownerId = properties.ownerId;
        this._clientId = properties.clientId;
        this._conversationId = properties.conversationId;
        this._status = properties.status;
        this._request = properties.request;
        this._result = properties.result;
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
    get reference() {
        return this._reference;
    }
    get ownerId() {
        return this._ownerId;
    }
    get clientId() {
        return this._clientId;
    }
    get conversationId() {
        return this._conversationId;
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
        const newSnapshot = new ReplyGenerationSnapshot({
            version: nextVersion,
            createdAt: new Date(),
            status: this._status,
            request: this._request,
            result: this._result,
        });
        this._snapshots.push(newSnapshot);
    }
    // Factory Creation Method
    static create(id, reference, ownerId, clientId, conversationId, request) {
        const now = new Date();
        const generation = new ReplyGeneration({
            id,
            reference,
            ownerId,
            clientId,
            conversationId,
            status: "Draft",
            request,
            result: undefined,
            snapshots: [],
            createdAt: now,
            updatedAt: now,
        });
        generation.appendSnapshot();
        generation.addDomainEvent({
            eventType: REPLY_GENERATION_DRAFTED,
            generationId: generation.id,
            reference: generation.reference.value,
            ownerId: generation.ownerId,
            clientId: generation.clientId,
            conversationId: generation.conversationId,
            snapshotVersion: generation.snapshots.length,
        });
        return generation;
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
        else if (nextStatus === "Generated") {
            if (this._status !== "Requested") {
                throw new Error(`Invalid lifecycle transition from ${this._status.toUpperCase()} to GENERATED`);
            }
        }
        else if (nextStatus === "Draft") {
            throw new Error(`Invalid lifecycle transition from ${this._status.toUpperCase()} to DRAFT`);
        }
        this._status = nextStatus;
        this._updatedAt = new Date();
        this.appendSnapshot();
    }
    requestGeneration(actorOwnerId) {
        this.verifyOwnership(actorOwnerId);
        this.transitionTo("Requested");
        this.addDomainEvent({
            eventType: REPLY_GENERATION_REQUESTED,
            generationId: this._id,
            reference: this._reference.value,
            ownerId: this._ownerId,
            clientId: this._clientId,
            conversationId: this._conversationId,
            snapshotVersion: this._snapshots.length,
        });
    }
    completeGeneration(actorOwnerId, result) {
        this.verifyOwnership(actorOwnerId);
        if (!result) {
            throw new Error("GenerationResult is required for completeGeneration.");
        }
        // Verify sequence checks using transitionTo
        this.transitionTo("Generated");
        this._result = result;
        this.addDomainEvent({
            eventType: REPLY_GENERATION_COMPLETED,
            generationId: this._id,
            reference: this._reference.value,
            ownerId: this._ownerId,
            clientId: this._clientId,
            conversationId: this._conversationId,
            snapshotVersion: this._snapshots.length,
        });
    }
    archive(actorOwnerId) {
        this.verifyOwnership(actorOwnerId);
        if (this._status === "Archived") {
            throw new Error("Reply generation is already archived.");
        }
        this.transitionTo("Archived");
        this.addDomainEvent({
            eventType: REPLY_GENERATION_ARCHIVED,
            generationId: this._id,
            reference: this._reference.value,
            ownerId: this._ownerId,
            clientId: this._clientId,
            conversationId: this._conversationId,
            snapshotVersion: this._snapshots.length,
        });
    }
}
