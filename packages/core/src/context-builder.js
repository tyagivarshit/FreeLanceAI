export class ContextBlueprint {
    _blueprintId;
    _orderingStrategy;
    _assemblyRules;
    _sourceReferences;
    constructor(properties) {
        if (!properties.blueprintId || properties.blueprintId.trim() === "") {
            throw new Error("Blueprint identity is required.");
        }
        if (!properties.orderingStrategy || properties.orderingStrategy.trim() === "") {
            throw new Error("Ordering strategy is required.");
        }
        if (!properties.assemblyRules) {
            throw new Error("Assembly rules are required.");
        }
        if (!properties.sourceReferences) {
            throw new Error("Source references are required.");
        }
        this._blueprintId = properties.blueprintId.trim();
        this._orderingStrategy = properties.orderingStrategy.trim();
        this._assemblyRules = [...properties.assemblyRules];
        this._sourceReferences = [...properties.sourceReferences];
    }
    get blueprintId() {
        return this._blueprintId;
    }
    get orderingStrategy() {
        return this._orderingStrategy;
    }
    get assemblyRules() {
        return this._assemblyRules;
    }
    get sourceReferences() {
        return this._sourceReferences;
    }
    equals(other) {
        if (this._blueprintId !== other.blueprintId) {
            return false;
        }
        if (this._orderingStrategy !== other.orderingStrategy) {
            return false;
        }
        if (this._assemblyRules.length !== other.assemblyRules.length) {
            return false;
        }
        if (this._sourceReferences.length !== other.sourceReferences.length) {
            return false;
        }
        for (let i = 0; i < this._assemblyRules.length; i++) {
            if (this._assemblyRules[i] !== other.assemblyRules[i]) {
                return false;
            }
        }
        for (let i = 0; i < this._sourceReferences.length; i++) {
            if (this._sourceReferences[i] !== other.sourceReferences[i]) {
                return false;
            }
        }
        return true;
    }
}
export class ContextMetadata {
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
export class ContextAssemblyRule {
    _ruleName;
    _assemblyOrder;
    _isRequired;
    constructor(properties) {
        if (!properties.ruleName || properties.ruleName.trim() === "") {
            throw new Error("Rule name is required.");
        }
        if (properties.assemblyOrder < 0) {
            throw new Error("Assembly order must be non-negative.");
        }
        this._ruleName = properties.ruleName.trim();
        this._assemblyOrder = properties.assemblyOrder;
        this._isRequired = properties.isRequired;
    }
    get ruleName() {
        return this._ruleName;
    }
    get assemblyOrder() {
        return this._assemblyOrder;
    }
    get isRequired() {
        return this._isRequired;
    }
    equals(other) {
        return (this._ruleName === other.ruleName &&
            this._assemblyOrder === other.assemblyOrder &&
            this._isRequired === other.isRequired);
    }
}
export class ContextSourceReference {
    _sourceType;
    _sourceId;
    constructor(properties) {
        if (!properties.sourceType || properties.sourceType.trim() === "") {
            throw new Error("Source type is required.");
        }
        if (!properties.sourceId || properties.sourceId.trim() === "") {
            throw new Error("Source ID is required.");
        }
        this._sourceType = properties.sourceType.trim();
        this._sourceId = properties.sourceId.trim();
    }
    get sourceType() {
        return this._sourceType;
    }
    get sourceId() {
        return this._sourceId;
    }
    equals(other) {
        return this._sourceType === other.sourceType && this._sourceId === other.sourceId;
    }
}
// 3. Domain Events
export const CONTEXT_REGISTERED = "CONTEXT_REGISTERED";
export const CONTEXT_VALIDATED = "CONTEXT_VALIDATED";
export const CONTEXT_PUBLISHED = "CONTEXT_PUBLISHED";
export const CONTEXT_ARCHIVED = "CONTEXT_ARCHIVED";
// 7. Context Aggregate Root
export class Context {
    _id;
    _reference;
    _ownerId;
    _blueprint;
    _metadata;
    _assemblyRules = [];
    _sourceReferences = [];
    _status;
    _createdAt;
    _updatedAt;
    _domainEvents = [];
    constructor(properties) {
        if (!properties.id || properties.id.trim() === "") {
            throw new Error("Context Identity is required.");
        }
        if (!properties.reference || properties.reference.trim() === "") {
            throw new Error("Context Reference is required.");
        }
        const referencePattern = /^[a-z0-9]+(\.[a-z0-9]+)*$/;
        if (!referencePattern.test(properties.reference)) {
            throw new Error("Invalid context reference format. Must be lower-case dot-separated key.");
        }
        if (!properties.ownerId || properties.ownerId.trim() === "") {
            throw new Error("Owner Reference is required.");
        }
        if (!properties.blueprint) {
            throw new Error("Context Blueprint is required.");
        }
        if (!properties.metadata) {
            throw new Error("Context Metadata is required.");
        }
        if (!properties.status) {
            throw new Error("Context Lifecycle State is required.");
        }
        this._id = properties.id;
        this._reference = properties.reference;
        this._ownerId = properties.ownerId;
        this._blueprint = properties.blueprint;
        this._metadata = properties.metadata;
        this._status = properties.status;
        this._createdAt = properties.createdAt;
        this._updatedAt = properties.updatedAt;
        if (properties.assemblyRules) {
            this._assemblyRules = [...properties.assemblyRules];
        }
        if (properties.sourceReferences) {
            this._sourceReferences = [...properties.sourceReferences];
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
    get blueprint() {
        return this._blueprint;
    }
    get metadata() {
        return this._metadata;
    }
    get assemblyRules() {
        return [...this._assemblyRules];
    }
    get sourceReferences() {
        return [...this._sourceReferences];
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
    validateInvariants() {
        const referencePattern = /^[a-z0-9]+(\.[a-z0-9]+)*$/;
        if (!referencePattern.test(this._reference)) {
            throw new Error("Invalid context reference format. Must be lower-case dot-separated key.");
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
    static create(id, reference, ownerId, blueprint, metadata, assemblyRules, sourceReferences) {
        const now = new Date();
        const context = new Context({
            id,
            reference,
            ownerId,
            blueprint,
            metadata,
            assemblyRules,
            sourceReferences,
            status: "Draft",
            createdAt: now,
            updatedAt: now,
        });
        context.addDomainEvent({
            eventType: CONTEXT_REGISTERED,
            contextId: context.id,
            reference: context.reference,
            ownerId: context.ownerId,
        });
        return context;
    }
    /**
     * Performs an atomic replacement of the current draft specification.
     * This operation replaces the Blueprint, Metadata, Assembly Rules, and Source References
     * simultaneously, rather than permitting partial updates or incremental mutations.
     *
     * - Replaces all specification properties as a single unit of change.
     * - No partial updates or incremental field changes are allowed.
     * - No historical version of the draft is retained.
     *
     * @param actorOwnerId The identifier of the requesting owner.
     * @param blueprint The Context Blueprint specification representing the logical assembly.
     * @param metadata The Context Metadata.
     * @param assemblyRules The array of assembly rules.
     * @param sourceReferences The array of source references.
     * @throws Error if ownership validation fails or if the context status is not "Draft".
     */
    updateDraft(actorOwnerId, blueprint, metadata, assemblyRules, sourceReferences) {
        this.verifyOwnership(actorOwnerId);
        if (this._status !== "Draft") {
            throw new Error(`Cannot update context in status: ${this._status}`);
        }
        this._blueprint = blueprint;
        this._metadata = metadata;
        this._assemblyRules = [...assemblyRules];
        this._sourceReferences = [...sourceReferences];
        this._updatedAt = new Date();
    }
    validate(actorOwnerId) {
        this.verifyOwnership(actorOwnerId);
        if (this._status !== "Draft") {
            throw new Error(`Cannot validate context when in status: ${this._status}`);
        }
        this._status = "Validated";
        this._updatedAt = new Date();
        this.addDomainEvent({
            eventType: CONTEXT_VALIDATED,
            contextId: this._id,
            reference: this._reference,
            ownerId: this._ownerId,
        });
    }
    publish(actorOwnerId) {
        this.verifyOwnership(actorOwnerId);
        if (this._status !== "Validated") {
            throw new Error(`Cannot publish context when in status: ${this._status}`);
        }
        this._status = "Published";
        this._updatedAt = new Date();
        this.addDomainEvent({
            eventType: CONTEXT_PUBLISHED,
            contextId: this._id,
            reference: this._reference,
            ownerId: this._ownerId,
        });
    }
    archive(actorOwnerId) {
        this.verifyOwnership(actorOwnerId);
        if (this._status === "Archived") {
            throw new Error("Context is already archived.");
        }
        this._status = "Archived";
        this._updatedAt = new Date();
        this.addDomainEvent({
            eventType: CONTEXT_ARCHIVED,
            contextId: this._id,
            reference: this._reference,
            ownerId: this._ownerId,
        });
    }
}
