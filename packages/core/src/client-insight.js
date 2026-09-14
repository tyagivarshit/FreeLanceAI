// 1. Value Objects
export class InsightContent {
    _observation;
    _implication;
    _evidenceSummary;
    constructor(properties) {
        if (!properties.observation || properties.observation.trim() === "") {
            throw new Error("Observation is required.");
        }
        if (!properties.implication || properties.implication.trim() === "") {
            throw new Error("Implication is required.");
        }
        if (!properties.evidenceSummary || properties.evidenceSummary.trim() === "") {
            throw new Error("Evidence summary is required.");
        }
        this._observation = properties.observation.trim();
        this._implication = properties.implication.trim();
        this._evidenceSummary = properties.evidenceSummary.trim();
        Object.freeze(this);
    }
    get observation() {
        return this._observation;
    }
    get implication() {
        return this._implication;
    }
    get evidenceSummary() {
        return this._evidenceSummary;
    }
    equals(other) {
        if (!other) {
            return false;
        }
        return (this._observation === other.observation &&
            this._implication === other.implication &&
            this._evidenceSummary === other.evidenceSummary);
    }
}
export class InsightClassification {
    _value;
    constructor(value) {
        if (!value || value.trim() === "") {
            throw new Error("Insight classification value is required.");
        }
        const cleanValue = value.trim();
        const validCategories = [
            "Goal",
            "Concern",
            "Preference",
            "Risk",
            "Opportunity",
            "RelationshipSignal",
        ];
        // Find case-insensitive match
        const matchedCategory = validCategories.find((c) => c.toLowerCase() === cleanValue.toLowerCase());
        if (!matchedCategory) {
            throw new Error(`Invalid Insight classification category: ${cleanValue}.`);
        }
        this._value = matchedCategory;
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
export class InsightConfidence {
    _value;
    constructor(value) {
        if (!value || value.trim() === "") {
            throw new Error("Insight confidence value is required.");
        }
        const cleanValue = value.trim();
        const validConfidences = ["Low", "Moderate", "High"];
        const matchedConfidence = validConfidences.find((c) => c.toLowerCase() === cleanValue.toLowerCase());
        if (!matchedConfidence) {
            throw new Error(`Invalid Insight confidence: ${cleanValue}.`);
        }
        this._value = matchedConfidence;
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
export class InsightSourceReference {
    _value;
    constructor(value) {
        if (!value || value.trim() === "") {
            throw new Error("Insight source reference value is required.");
        }
        const cleanValue = value.trim();
        // Validate logical reference pattern
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
export class InsightMetadata {
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
        if (!properties.scope || properties.scope.trim() === "") {
            throw new Error("Scope is required.");
        }
        this._displayName = properties.displayName.trim();
        this._description = properties.description.trim();
        this._purpose = properties.purpose.trim();
        this._scope = properties.scope.trim();
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
            this._scope === other.scope);
    }
}
export class InsightFingerprint {
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
export class InsightReference {
    _value;
    constructor(value) {
        if (!value || value.trim() === "") {
            throw new Error("Insight reference value is required.");
        }
        const cleanValue = value.trim();
        const pattern = /^[a-z0-9]+([.-][a-z0-9]+)*$/;
        if (!pattern.test(cleanValue)) {
            throw new Error("Invalid insight reference format.");
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
export class ClientInsightSnapshot {
    _version;
    _createdAt;
    _insightReference;
    _clientId;
    _ownerId;
    _content;
    _classification;
    _confidence;
    _sourceReference;
    _metadata;
    _fingerprint;
    _lifecycle;
    constructor(properties) {
        if (properties.version <= 0) {
            throw new Error("Snapshot version must be greater than zero.");
        }
        if (!properties.createdAt) {
            throw new Error("Snapshot creation date is required.");
        }
        if (!properties.insightReference) {
            throw new Error("Insight reference is required.");
        }
        if (!properties.clientId || properties.clientId.trim() === "") {
            throw new Error("Client reference is required.");
        }
        if (!properties.ownerId || properties.ownerId.trim() === "") {
            throw new Error("Owner reference is required.");
        }
        if (!properties.content) {
            throw new Error("Insight content is required.");
        }
        if (!properties.classification) {
            throw new Error("Insight classification is required.");
        }
        if (!properties.confidence) {
            throw new Error("Insight confidence is required.");
        }
        if (!properties.sourceReference) {
            throw new Error("Insight source reference is required.");
        }
        if (!properties.metadata) {
            throw new Error("Insight metadata is required.");
        }
        if (!properties.fingerprint) {
            throw new Error("Insight fingerprint is required.");
        }
        if (!properties.lifecycle) {
            throw new Error("Lifecycle state is required.");
        }
        this._version = properties.version;
        this._createdAt = new Date(properties.createdAt.getTime());
        this._insightReference = properties.insightReference;
        this._clientId = properties.clientId;
        this._ownerId = properties.ownerId;
        this._content = properties.content;
        this._classification = properties.classification;
        this._confidence = properties.confidence;
        this._sourceReference = properties.sourceReference;
        this._metadata = properties.metadata;
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
    get insightReference() {
        return this._insightReference;
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
    get classification() {
        return this._classification;
    }
    get confidence() {
        return this._confidence;
    }
    get sourceReference() {
        return this._sourceReference;
    }
    get metadata() {
        return this._metadata;
    }
    get fingerprint() {
        return this._fingerprint;
    }
    get lifecycle() {
        return this._lifecycle;
    }
}
// 4. Domain Events
export const CLIENT_INSIGHT_IDENTIFIED = "CLIENT_INSIGHT_IDENTIFIED";
export const CLIENT_INSIGHT_VALIDATED = "CLIENT_INSIGHT_VALIDATED";
export const CLIENT_INSIGHT_PUBLISHED = "CLIENT_INSIGHT_PUBLISHED";
export const CLIENT_INSIGHT_ARCHIVED = "CLIENT_INSIGHT_ARCHIVED";
// 7. ClientInsight Aggregate Root
export class ClientInsight {
    _id;
    _insightReference;
    _clientId;
    _ownerId;
    _content;
    _classification;
    _confidence;
    _sourceReference;
    _metadata;
    _fingerprint;
    _lifecycle;
    _snapshots = [];
    _createdAt;
    _updatedAt;
    _domainEvents = [];
    constructor(properties) {
        this._id = properties.id;
        this._insightReference = properties.insightReference;
        this._clientId = properties.clientId;
        this._ownerId = properties.ownerId;
        this._content = properties.content;
        this._classification = properties.classification;
        this._confidence = properties.confidence;
        this._sourceReference = properties.sourceReference;
        this._metadata = properties.metadata;
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
    get insightReference() {
        return this._insightReference;
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
    get classification() {
        return this._classification;
    }
    get confidence() {
        return this._confidence;
    }
    get sourceReference() {
        return this._sourceReference;
    }
    get metadata() {
        return this._metadata;
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
            throw new Error("Insight Identity is required.");
        }
        if (!this._insightReference) {
            throw new Error("Insight Reference is required.");
        }
        if (!this._clientId || this._clientId.trim() === "") {
            throw new Error("Client Reference is required.");
        }
        if (!this._ownerId || this._ownerId.trim() === "") {
            throw new Error("Owner Reference is required.");
        }
        if (!this._content) {
            throw new Error("Insight Content is required.");
        }
        if (!this._classification) {
            throw new Error("Insight Classification is required.");
        }
        if (!this._confidence) {
            throw new Error("Insight Confidence is required.");
        }
        if (!this._sourceReference) {
            throw new Error("Insight Source Reference is required.");
        }
        if (!this._metadata) {
            throw new Error("Insight Metadata is required.");
        }
        if (!this._fingerprint) {
            throw new Error("Insight Fingerprint is required.");
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
        const newSnapshot = new ClientInsightSnapshot({
            version: nextVersion,
            createdAt: new Date(),
            insightReference: this._insightReference,
            clientId: this._clientId,
            ownerId: this._ownerId,
            content: this._content,
            classification: this._classification,
            confidence: this._confidence,
            sourceReference: this._sourceReference,
            metadata: this._metadata,
            fingerprint: this._fingerprint,
            lifecycle: this._lifecycle,
        });
        this._snapshots.push(newSnapshot);
    }
    // Factory Creation Method
    static create(id, insightReference, clientId, ownerId, content, classification, confidence, sourceReference, metadata, fingerprint) {
        const now = new Date();
        const insight = new ClientInsight({
            id,
            insightReference,
            clientId,
            ownerId,
            content,
            classification,
            confidence,
            sourceReference,
            metadata,
            fingerprint,
            lifecycle: "Draft",
            snapshots: [],
            createdAt: now,
            updatedAt: now,
        });
        insight.appendSnapshot();
        return insight;
    }
    // Domain Operations
    identify(actorOwnerId) {
        this.verifyOwnership(actorOwnerId);
        if (this._lifecycle !== "Draft") {
            throw new Error(`Cannot identify insight when in status: ${this._lifecycle}`);
        }
        this._lifecycle = "Identified";
        this._updatedAt = new Date();
        this.appendSnapshot();
        this.addDomainEvent({
            eventType: CLIENT_INSIGHT_IDENTIFIED,
            insightId: this._id,
            insightReference: this._insightReference.value,
            clientId: this._clientId,
            ownerId: this._ownerId,
            snapshotVersion: this._snapshots.length,
        });
    }
    validate(actorOwnerId) {
        this.verifyOwnership(actorOwnerId);
        if (this._lifecycle !== "Identified") {
            throw new Error(`Cannot validate insight when in status: ${this._lifecycle}`);
        }
        this._lifecycle = "Validated";
        this._updatedAt = new Date();
        this.appendSnapshot();
        this.addDomainEvent({
            eventType: CLIENT_INSIGHT_VALIDATED,
            insightId: this._id,
            insightReference: this._insightReference.value,
            clientId: this._clientId,
            ownerId: this._ownerId,
            snapshotVersion: this._snapshots.length,
        });
    }
    publish(actorOwnerId) {
        this.verifyOwnership(actorOwnerId);
        if (this._lifecycle !== "Validated") {
            throw new Error(`Cannot publish insight when in status: ${this._lifecycle}`);
        }
        this._lifecycle = "Published";
        this._updatedAt = new Date();
        this.appendSnapshot();
        this.addDomainEvent({
            eventType: CLIENT_INSIGHT_PUBLISHED,
            insightId: this._id,
            insightReference: this._insightReference.value,
            clientId: this._clientId,
            ownerId: this._ownerId,
            snapshotVersion: this._snapshots.length,
        });
    }
    archive(actorOwnerId) {
        this.verifyOwnership(actorOwnerId);
        if (this._lifecycle === "Archived") {
            throw new Error("Insight is already archived.");
        }
        this._lifecycle = "Archived";
        this._updatedAt = new Date();
        this.appendSnapshot();
        this.addDomainEvent({
            eventType: CLIENT_INSIGHT_ARCHIVED,
            insightId: this._id,
            insightReference: this._insightReference.value,
            clientId: this._clientId,
            ownerId: this._ownerId,
            snapshotVersion: this._snapshots.length,
        });
    }
    update(actorOwnerId, content, classification, confidence, sourceReference, metadata, fingerprint) {
        this.verifyOwnership(actorOwnerId);
        if (this._lifecycle === "Published" || this._lifecycle === "Archived") {
            throw new Error(`Cannot update insight in status: ${this._lifecycle}`);
        }
        this._content = content;
        this._classification = classification;
        this._confidence = confidence;
        this._sourceReference = sourceReference;
        this._metadata = metadata;
        this._fingerprint = fingerprint;
        this._updatedAt = new Date();
        this.appendSnapshot();
    }
}
