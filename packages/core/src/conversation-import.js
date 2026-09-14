export class ImportMetadata {
    _displayName;
    _description;
    _purpose;
    _importScopeSummary;
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
        if (!properties.importScopeSummary || properties.importScopeSummary.trim() === "") {
            throw new Error("Import Scope Summary is required.");
        }
        this._displayName = properties.displayName.trim();
        this._description = properties.description.trim();
        this._purpose = properties.purpose.trim();
        this._importScopeSummary = properties.importScopeSummary.trim();
        Object.freeze(this);
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
    get importScopeSummary() {
        return this._importScopeSummary;
    }
    equals(other) {
        if (!other) {
            return false;
        }
        return (this._displayName === other.displayName &&
            this._description === other.description &&
            this._purpose === other.purpose &&
            this._importScopeSummary === other.importScopeSummary);
    }
}
export class ImportScope {
    _value;
    constructor(value) {
        if (!value || value.trim() === "") {
            throw new Error("Import scope value is required.");
        }
        const cleanValue = value.trim();
        const validScopes = [
            "FullConversation",
            "PartialConversation",
            "SelectedPeriod",
            "SelectedSegment",
        ];
        if (!validScopes.includes(cleanValue)) {
            throw new Error(`Invalid Import scope: ${cleanValue}.`);
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
// 2. Value Objects
export class ImportFingerprint {
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
export class ImportReference {
    _value;
    constructor(value) {
        if (!value || value.trim() === "") {
            throw new Error("Import reference value is required.");
        }
        const cleanValue = value.trim();
        const referencePattern = /^[a-z0-9]+([.-][a-z0-9]+)*$/;
        if (!referencePattern.test(cleanValue)) {
            throw new Error("Invalid import reference format. Must be lower-case dot/hyphen-separated key.");
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
export class ConversationReference {
    _value;
    constructor(value) {
        if (!value || value.trim() === "") {
            throw new Error("Conversation reference value is required.");
        }
        const cleanValue = value.trim();
        const referencePattern = /^[a-z0-9]+([.-][a-z0-9]+)*$/;
        if (!referencePattern.test(cleanValue)) {
            throw new Error("Invalid conversation reference format. Must be lower-case dot/hyphen-separated key.");
        }
        // Reject provider-specific keywords to ensure provider neutrality
        const providers = ["slack", "whatsapp", "gmail", "discord", "telegram", "intercom"];
        if (providers.some((p) => cleanValue.toLowerCase().includes(p))) {
            throw new Error("Conversation reference must not contain provider-specific semantics.");
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
export class SourceClassification {
    _value;
    constructor(value) {
        if (!value || value.trim() === "") {
            throw new Error("Source classification value is required.");
        }
        const cleanValue = value.trim();
        const validSources = [
            "slack",
            "whatsapp",
            "gmail",
            "discord",
            "telegram",
            "intercom",
            "custom",
        ];
        if (!validSources.includes(cleanValue.toLowerCase())) {
            throw new Error(`Invalid source classification: ${cleanValue}.`);
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
        return this._value.toLowerCase() === other.value.toLowerCase();
    }
}
export class ConversationImportSnapshot {
    _version;
    _createdAt;
    _conversationReference;
    _clientId;
    _ownerId;
    _sourceClassification;
    _metadata;
    _scope;
    _fingerprint;
    _lifecycle;
    _importReference;
    constructor(properties) {
        if (properties.version <= 0) {
            throw new Error("Snapshot version must be greater than zero.");
        }
        if (!properties.createdAt) {
            throw new Error("Snapshot creation date is required.");
        }
        if (!properties.conversationReference) {
            throw new Error("Conversation reference is required.");
        }
        if (!properties.clientId || properties.clientId.trim() === "") {
            throw new Error("Client reference is required.");
        }
        if (!properties.ownerId || properties.ownerId.trim() === "") {
            throw new Error("Owner reference is required.");
        }
        if (!properties.sourceClassification) {
            throw new Error("Source classification is required.");
        }
        if (!properties.metadata) {
            throw new Error("Import metadata is required.");
        }
        if (!properties.scope) {
            throw new Error("Import scope is required.");
        }
        if (!properties.fingerprint) {
            throw new Error("Import fingerprint is required.");
        }
        if (!properties.lifecycle) {
            throw new Error("Lifecycle state is required.");
        }
        if (!properties.importReference) {
            throw new Error("Import reference is required.");
        }
        this._version = properties.version;
        this._createdAt = new Date(properties.createdAt.getTime());
        this._conversationReference = properties.conversationReference;
        this._clientId = properties.clientId;
        this._ownerId = properties.ownerId;
        this._sourceClassification = properties.sourceClassification;
        this._metadata = properties.metadata;
        this._scope = properties.scope;
        this._fingerprint = properties.fingerprint;
        this._lifecycle = properties.lifecycle;
        this._importReference = properties.importReference;
        Object.freeze(this);
    }
    get version() {
        return this._version;
    }
    get createdAt() {
        return new Date(this._createdAt.getTime());
    }
    get conversationReference() {
        return this._conversationReference;
    }
    get clientId() {
        return this._clientId;
    }
    get ownerId() {
        return this._ownerId;
    }
    get sourceClassification() {
        return this._sourceClassification;
    }
    get metadata() {
        return this._metadata;
    }
    get scope() {
        return this._scope;
    }
    get fingerprint() {
        return this._fingerprint;
    }
    get lifecycle() {
        return this._lifecycle;
    }
    get importReference() {
        return this._importReference;
    }
}
// 3. Domain Events
export const CONVERSATION_IMPORT_REGISTERED = "CONVERSATION_IMPORT_REGISTERED";
export const CONVERSATION_IMPORT_VALIDATED = "CONVERSATION_IMPORT_VALIDATED";
export const CONVERSATION_IMPORT_COMPLETED = "CONVERSATION_IMPORT_COMPLETED";
export const CONVERSATION_IMPORT_ARCHIVED = "CONVERSATION_IMPORT_ARCHIVED";
// 6. ConversationImport Aggregate Root
export class ConversationImport {
    _id;
    _importReference;
    _conversationReference;
    _clientId;
    _ownerId;
    _sourceClassification;
    _metadata;
    _scope;
    _fingerprint;
    _lifecycle;
    _snapshots = [];
    _createdAt;
    _updatedAt;
    _domainEvents = [];
    constructor(properties) {
        this._id = properties.id;
        this._importReference = properties.importReference;
        this._conversationReference = properties.conversationReference;
        this._clientId = properties.clientId;
        this._ownerId = properties.ownerId;
        this._sourceClassification = properties.sourceClassification;
        this._metadata = properties.metadata;
        this._scope = properties.scope;
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
    get importReference() {
        return this._importReference;
    }
    get conversationReference() {
        return this._conversationReference;
    }
    get clientId() {
        return this._clientId;
    }
    get ownerId() {
        return this._ownerId;
    }
    get sourceClassification() {
        return this._sourceClassification;
    }
    get metadata() {
        return this._metadata;
    }
    get scope() {
        return this._scope;
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
            throw new Error("Import Identity is required.");
        }
        if (!this._importReference) {
            throw new Error("Import Reference is required.");
        }
        if (!this._conversationReference) {
            throw new Error("Conversation Reference is required.");
        }
        if (!this._clientId || this._clientId.trim() === "") {
            throw new Error("Client Reference is required.");
        }
        if (!this._ownerId || this._ownerId.trim() === "") {
            throw new Error("Owner Reference is required.");
        }
        if (!this._sourceClassification) {
            throw new Error("Source Classification is required.");
        }
        if (!this._metadata) {
            throw new Error("Import Metadata is required.");
        }
        if (!this._scope) {
            throw new Error("Import Scope is required.");
        }
        if (!this._fingerprint) {
            throw new Error("Import Fingerprint is required.");
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
        const newSnapshot = new ConversationImportSnapshot({
            version: nextVersion,
            createdAt: new Date(),
            conversationReference: this._conversationReference,
            clientId: this._clientId,
            ownerId: this._ownerId,
            sourceClassification: this._sourceClassification,
            metadata: this._metadata,
            scope: this._scope,
            fingerprint: this._fingerprint,
            lifecycle: this._lifecycle,
            importReference: this._importReference,
        });
        this._snapshots.push(newSnapshot);
    }
    // Factory Creation Method
    static create(id, importReference, conversationReference, clientId, ownerId, sourceClassification, metadata, scope, fingerprint) {
        const now = new Date();
        const importObj = new ConversationImport({
            id,
            importReference,
            conversationReference,
            clientId,
            ownerId,
            sourceClassification,
            metadata,
            scope,
            fingerprint,
            lifecycle: "Draft",
            snapshots: [],
            createdAt: now,
            updatedAt: now,
        });
        importObj.appendSnapshot();
        return importObj;
    }
    // Domain Operations
    register(actorOwnerId) {
        this.verifyOwnership(actorOwnerId);
        if (this._lifecycle !== "Draft") {
            throw new Error(`Cannot register conversation import when in status: ${this._lifecycle}`);
        }
        this._lifecycle = "Registered";
        this._updatedAt = new Date();
        this.appendSnapshot();
        this.addDomainEvent({
            eventType: CONVERSATION_IMPORT_REGISTERED,
            importId: this._id,
            importReference: this._importReference.value,
            clientId: this._clientId,
            ownerId: this._ownerId,
            snapshotVersion: this._snapshots.length,
        });
    }
    validate(actorOwnerId) {
        this.verifyOwnership(actorOwnerId);
        if (this._lifecycle !== "Registered") {
            throw new Error(`Cannot validate conversation import when in status: ${this._lifecycle}`);
        }
        this._lifecycle = "Validated";
        this._updatedAt = new Date();
        this.appendSnapshot();
        this.addDomainEvent({
            eventType: CONVERSATION_IMPORT_VALIDATED,
            importId: this._id,
            importReference: this._importReference.value,
            clientId: this._clientId,
            ownerId: this._ownerId,
            snapshotVersion: this._snapshots.length,
        });
    }
    complete(actorOwnerId) {
        this.verifyOwnership(actorOwnerId);
        if (this._lifecycle !== "Validated") {
            throw new Error(`Cannot complete conversation import when in status: ${this._lifecycle}`);
        }
        this._lifecycle = "Completed";
        this._updatedAt = new Date();
        this.appendSnapshot();
        this.addDomainEvent({
            eventType: CONVERSATION_IMPORT_COMPLETED,
            importId: this._id,
            importReference: this._importReference.value,
            clientId: this._clientId,
            ownerId: this._ownerId,
            snapshotVersion: this._snapshots.length,
        });
    }
    archive(actorOwnerId) {
        this.verifyOwnership(actorOwnerId);
        if (this._lifecycle === "Archived") {
            throw new Error("Conversation import is already archived.");
        }
        this._lifecycle = "Archived";
        this._updatedAt = new Date();
        this.appendSnapshot();
        this.addDomainEvent({
            eventType: CONVERSATION_IMPORT_ARCHIVED,
            importId: this._id,
            importReference: this._importReference.value,
            clientId: this._clientId,
            ownerId: this._ownerId,
            snapshotVersion: this._snapshots.length,
        });
    }
    update(actorOwnerId, metadata, scope, fingerprint) {
        this.verifyOwnership(actorOwnerId);
        if (this._lifecycle === "Completed" || this._lifecycle === "Archived") {
            throw new Error(`Cannot update conversation import in status: ${this._lifecycle}`);
        }
        this._metadata = metadata;
        this._scope = scope;
        this._fingerprint = fingerprint;
        this._updatedAt = new Date();
        this.appendSnapshot();
    }
}
