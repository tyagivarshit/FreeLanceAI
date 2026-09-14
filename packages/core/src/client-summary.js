export class SummaryContent {
    _businessSummary;
    _relationshipSummary;
    _currentSituation;
    _knownGoals;
    _knownConstraints;
    _openTopics;
    constructor(properties) {
        if (typeof properties.businessSummary !== "string") {
            throw new Error("Business Summary must be a string.");
        }
        if (typeof properties.relationshipSummary !== "string") {
            throw new Error("Relationship Summary must be a string.");
        }
        if (typeof properties.currentSituation !== "string") {
            throw new Error("Current Situation must be a string.");
        }
        if (!Array.isArray(properties.knownGoals)) {
            throw new Error("Known Goals must be an array of strings.");
        }
        if (!Array.isArray(properties.knownConstraints)) {
            throw new Error("Known Constraints must be an array of strings.");
        }
        if (!Array.isArray(properties.openTopics)) {
            throw new Error("Open Topics must be an array of strings.");
        }
        this._businessSummary = properties.businessSummary;
        this._relationshipSummary = properties.relationshipSummary;
        this._currentSituation = properties.currentSituation;
        // Copy and freeze arrays to ensure strict immutability
        this._knownGoals = [...properties.knownGoals];
        this._knownConstraints = [...properties.knownConstraints];
        this._openTopics = [...properties.openTopics];
        Object.freeze(this._knownGoals);
        Object.freeze(this._knownConstraints);
        Object.freeze(this._openTopics);
        Object.freeze(this);
    }
    get businessSummary() {
        return this._businessSummary;
    }
    get relationshipSummary() {
        return this._relationshipSummary;
    }
    get currentSituation() {
        return this._currentSituation;
    }
    get knownGoals() {
        return this._knownGoals;
    }
    get knownConstraints() {
        return this._knownConstraints;
    }
    get openTopics() {
        return this._openTopics;
    }
    equals(other) {
        if (!other) {
            return false;
        }
        return (this._businessSummary === other.businessSummary &&
            this._relationshipSummary === other.relationshipSummary &&
            this._currentSituation === other.currentSituation &&
            this._knownGoals.length === other.knownGoals.length &&
            this._knownGoals.every((v, i) => v === other.knownGoals[i]) &&
            this._knownConstraints.length === other.knownConstraints.length &&
            this._knownConstraints.every((v, i) => v === other.knownConstraints[i]) &&
            this._openTopics.length === other.openTopics.length &&
            this._openTopics.every((v, i) => v === other.openTopics[i]));
    }
}
export class SummaryScope {
    _value;
    constructor(value) {
        if (!value || value.trim() === "") {
            throw new Error("Scope value is required.");
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
        return this._value.toLowerCase() === other.value.toLowerCase();
    }
}
export class SummaryMetadata {
    _displayName;
    _description;
    _purpose;
    _scope;
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
        if (!properties.scope) {
            throw new Error("Summary Scope is required.");
        }
        this._displayName = properties.displayName.trim();
        this._description = properties.description.trim();
        this._purpose = properties.purpose.trim();
        this._scope = properties.scope;
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
    get scope() {
        return this._scope;
    }
    equals(other) {
        if (!other) {
            return false;
        }
        return (this._displayName === other.displayName &&
            this._description === other.description &&
            this._purpose === other.purpose &&
            this._scope.equals(other.scope));
    }
}
export class SummaryClassification {
    _value;
    constructor(value) {
        if (!value || value.trim() === "") {
            throw new Error("Classification value is required.");
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
        return this._value.toLowerCase() === other.value.toLowerCase();
    }
}
export class SummaryFingerprint {
    _value;
    constructor(value) {
        if (!value || value.trim() === "") {
            throw new Error("Fingerprint value is required.");
        }
        const cleanValue = value.trim();
        // Validate: No hashes allowed (such as 32-128 hex chars)
        if (/^[a-f0-9]{32,128}$/i.test(cleanValue)) {
            throw new Error("Fingerprint cannot be a hash.");
        }
        // Validate: No provider identifiers allowed
        const providers = [
            "openai",
            "anthropic",
            "gemini",
            "ollama",
            "cohere",
            "google",
            "aws",
            "azure",
        ];
        if (providers.some((p) => cleanValue.toLowerCase().includes(p))) {
            throw new Error("Fingerprint cannot contain provider identifiers.");
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
export class SummaryReference {
    _value;
    constructor(value) {
        if (!value || value.trim() === "") {
            throw new Error("Summary reference value is required.");
        }
        const cleanValue = value.trim();
        // Lowercase dot/hyphen-separated alphanumeric reference pattern
        const referencePattern = /^[a-z0-9]+([.-][a-z0-9]+)*$/;
        if (!referencePattern.test(cleanValue)) {
            throw new Error("Invalid summary reference format. Must be lower-case dot/hyphen-separated key.");
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
export class SummarySnapshot {
    _version;
    _createdAt;
    _content;
    _metadata;
    _classification;
    _scope;
    _fingerprint;
    _lifecycle;
    constructor(properties) {
        if (properties.version <= 0) {
            throw new Error("Snapshot version must be greater than zero.");
        }
        if (!properties.createdAt) {
            throw new Error("Snapshot creation date is required.");
        }
        if (!properties.content) {
            throw new Error("Snapshot content is required.");
        }
        if (!properties.metadata) {
            throw new Error("Snapshot metadata is required.");
        }
        if (!properties.classification) {
            throw new Error("Snapshot classification is required.");
        }
        if (!properties.scope) {
            throw new Error("Snapshot scope is required.");
        }
        if (!properties.fingerprint) {
            throw new Error("Snapshot fingerprint is required.");
        }
        if (!properties.lifecycle) {
            throw new Error("Snapshot lifecycle is required.");
        }
        this._version = properties.version;
        this._createdAt = new Date(properties.createdAt.getTime());
        this._content = properties.content;
        this._metadata = properties.metadata;
        this._classification = properties.classification;
        this._scope = properties.scope;
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
    get content() {
        return this._content;
    }
    get metadata() {
        return this._metadata;
    }
    get classification() {
        return this._classification;
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
}
// 3. Domain Events
export const CLIENT_SUMMARY_REGISTERED = "CLIENT_SUMMARY_REGISTERED";
export const CLIENT_SUMMARY_GENERATED = "CLIENT_SUMMARY_GENERATED";
export const CLIENT_SUMMARY_VALIDATED = "CLIENT_SUMMARY_VALIDATED";
export const CLIENT_SUMMARY_PUBLISHED = "CLIENT_SUMMARY_PUBLISHED";
export const CLIENT_SUMMARY_ARCHIVED = "CLIENT_SUMMARY_ARCHIVED";
// 6. ClientSummary Aggregate Root
export class ClientSummary {
    _id;
    _reference;
    _clientId;
    _ownerId;
    _content;
    _metadata;
    _classification;
    _scope;
    _fingerprint;
    _lifecycle;
    _snapshots = [];
    _createdAt;
    _updatedAt;
    _domainEvents = [];
    constructor(properties) {
        this._id = properties.id;
        this._reference = properties.reference;
        this._clientId = properties.clientId;
        this._ownerId = properties.ownerId;
        this._content = properties.content;
        this._metadata = properties.metadata;
        this._classification = properties.classification;
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
    get reference() {
        return this._reference;
    }
    get clientId() {
        return this._clientId;
    }
    get ownerId() {
        return this._ownerId;
    }
    get content() {
        return this._content;
    }
    get metadata() {
        return this._metadata;
    }
    get classification() {
        return this._classification;
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
            throw new Error("Summary Identity is required.");
        }
        if (!this._clientId || this._clientId.trim() === "") {
            throw new Error("Client Reference is required.");
        }
        if (!this._ownerId || this._ownerId.trim() === "") {
            throw new Error("Owner Reference is required.");
        }
        if (!this._reference) {
            throw new Error("Summary Reference is required.");
        }
        if (!this._content) {
            throw new Error("Summary Content is required.");
        }
        if (!this._metadata) {
            throw new Error("Summary Metadata is required.");
        }
        if (!this._classification) {
            throw new Error("Summary Classification is required.");
        }
        if (!this._scope) {
            throw new Error("Summary Scope is required.");
        }
        if (!this._fingerprint) {
            throw new Error("Summary Fingerprint is required.");
        }
        if (!this._lifecycle) {
            throw new Error("Summary Lifecycle is required.");
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
        const newSnapshot = new SummarySnapshot({
            version: nextVersion,
            createdAt: new Date(),
            content: this._content,
            metadata: this._metadata,
            classification: this._classification,
            scope: this._scope,
            fingerprint: this._fingerprint,
            lifecycle: this._lifecycle,
        });
        this._snapshots.push(newSnapshot);
    }
    // Domain Factory
    static create(id, reference, clientId, ownerId, content, metadata, classification, scope, fingerprint) {
        const now = new Date();
        const summary = new ClientSummary({
            id,
            reference,
            clientId,
            ownerId,
            content,
            metadata,
            classification,
            scope,
            fingerprint,
            lifecycle: "Draft",
            snapshots: [],
            createdAt: now,
            updatedAt: now,
        });
        summary.appendSnapshot();
        summary.addDomainEvent({
            eventType: CLIENT_SUMMARY_REGISTERED,
            summaryId: id,
            reference: reference.value,
            clientId,
            ownerId,
        });
        return summary;
    }
    // Domain Operations
    transitionTo(newLifecycle, actorOwnerId) {
        this.verifyOwnership(actorOwnerId);
        if (this._lifecycle === newLifecycle) {
            return;
        }
        let allowed = false;
        switch (this._lifecycle) {
            case "Draft":
                allowed = newLifecycle === "Generated" || newLifecycle === "Archived";
                break;
            case "Generated":
                allowed = newLifecycle === "Validated" || newLifecycle === "Archived";
                break;
            case "Validated":
                allowed = newLifecycle === "Published" || newLifecycle === "Archived";
                break;
            case "Published":
                allowed = newLifecycle === "Archived";
                break;
            case "Archived":
                allowed = false;
                break;
        }
        if (!allowed) {
            throw new Error(`Invalid lifecycle transition from ${this._lifecycle} to ${newLifecycle}.`);
        }
        this._lifecycle = newLifecycle;
        this._updatedAt = new Date();
        this.appendSnapshot();
        if (newLifecycle === "Generated") {
            this.addDomainEvent({
                eventType: CLIENT_SUMMARY_GENERATED,
                summaryId: this._id,
                reference: this._reference.value,
                clientId: this._clientId,
                ownerId: this._ownerId,
            });
        }
        else if (newLifecycle === "Validated") {
            this.addDomainEvent({
                eventType: CLIENT_SUMMARY_VALIDATED,
                summaryId: this._id,
                reference: this._reference.value,
                clientId: this._clientId,
                ownerId: this._ownerId,
            });
        }
        else if (newLifecycle === "Published") {
            this.addDomainEvent({
                eventType: CLIENT_SUMMARY_PUBLISHED,
                summaryId: this._id,
                reference: this._reference.value,
                clientId: this._clientId,
                ownerId: this._ownerId,
            });
        }
        else if (newLifecycle === "Archived") {
            this.addDomainEvent({
                eventType: CLIENT_SUMMARY_ARCHIVED,
                summaryId: this._id,
                reference: this._reference.value,
                clientId: this._clientId,
                ownerId: this._ownerId,
            });
        }
    }
    update(actorOwnerId, content, metadata, classification, scope, fingerprint) {
        this.verifyOwnership(actorOwnerId);
        if (this._lifecycle === "Published") {
            throw new Error("Cannot update summary content in Published state.");
        }
        if (this._lifecycle === "Archived") {
            throw new Error("Cannot update summary content in Archived state.");
        }
        this._content = content;
        this._metadata = metadata;
        this._classification = classification;
        this._scope = scope;
        this._fingerprint = fingerprint;
        this._updatedAt = new Date();
        this.appendSnapshot();
    }
}
