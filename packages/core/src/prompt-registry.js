// 2. Value Objects
export class LogicalVisibilityClassification {
    _value;
    constructor(value) {
        if (!value || value.trim() === "") {
            throw new Error("Visibility classification value cannot be empty.");
        }
        this._value = value.trim();
    }
    get value() {
        return this._value;
    }
    equals(other) {
        return this._value.toLowerCase() === other.value.toLowerCase();
    }
}
export class PromptDefinition {
    _promptTextSpecification;
    constructor(properties) {
        if (properties.promptTextSpecification === undefined ||
            properties.promptTextSpecification === null) {
            throw new Error("Prompt text specification is required.");
        }
        this._promptTextSpecification = properties.promptTextSpecification;
    }
    get promptTextSpecification() {
        return this._promptTextSpecification;
    }
    equals(other) {
        return this._promptTextSpecification === other.promptTextSpecification;
    }
}
export class PromptMetadata {
    _displayName;
    _description;
    _purpose;
    _classification;
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
        if (!properties.classification || properties.classification.trim() === "") {
            throw new Error("Classification is required.");
        }
        if (!properties.versionSummary || properties.versionSummary.trim() === "") {
            throw new Error("Version Summary is required.");
        }
        this._displayName = properties.displayName.trim();
        this._description = properties.description.trim();
        this._purpose = properties.purpose.trim();
        this._classification = properties.classification.trim();
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
    get classification() {
        return this._classification;
    }
    get versionSummary() {
        return this._versionSummary;
    }
    equals(other) {
        return (this._displayName === other.displayName &&
            this._description === other.description &&
            this._purpose === other.purpose &&
            this._classification === other.classification &&
            this._versionSummary === other.versionSummary);
    }
}
export class PromptVersion {
    _versionNumber;
    _createdAt;
    _publishedAt;
    _definitionSnapshot;
    _metadataSnapshot;
    _visibilitySnapshot;
    _state;
    constructor(properties) {
        if (properties.versionNumber <= 0) {
            throw new Error("Version number must be greater than zero.");
        }
        if (!properties.createdAt) {
            throw new Error("Creation date is required.");
        }
        if (!properties.definitionSnapshot) {
            throw new Error("Definition snapshot is required.");
        }
        if (!properties.metadataSnapshot) {
            throw new Error("Metadata snapshot is required.");
        }
        if (!properties.visibilitySnapshot) {
            throw new Error("Visibility snapshot is required.");
        }
        if (!properties.state) {
            throw new Error("Lifecycle state is required.");
        }
        this._versionNumber = properties.versionNumber;
        this._createdAt = properties.createdAt;
        this._publishedAt = properties.publishedAt;
        this._definitionSnapshot = properties.definitionSnapshot;
        this._metadataSnapshot = properties.metadataSnapshot;
        this._visibilitySnapshot = properties.visibilitySnapshot;
        this._state = properties.state;
    }
    get versionNumber() {
        return this._versionNumber;
    }
    get createdAt() {
        return this._createdAt;
    }
    get publishedAt() {
        return this._publishedAt;
    }
    get definitionSnapshot() {
        return this._definitionSnapshot;
    }
    get metadataSnapshot() {
        return this._metadataSnapshot;
    }
    get visibilitySnapshot() {
        return this._visibilitySnapshot;
    }
    get state() {
        return this._state;
    }
}
// 4. Domain Events
export const PROMPT_REGISTERED = "PROMPT_REGISTERED";
export const PROMPT_UPDATED = "PROMPT_UPDATED";
export const PROMPT_PUBLISHED = "PROMPT_PUBLISHED";
export const PROMPT_DEPRECATED = "PROMPT_DEPRECATED";
export const PROMPT_ARCHIVED = "PROMPT_ARCHIVED";
// 8. Prompt Aggregate Root
export class Prompt {
    _id;
    _reference;
    _ownerId;
    _definition;
    _metadata;
    _visibility;
    _status;
    _versions = [];
    _createdAt;
    _updatedAt;
    _domainEvents = [];
    constructor(properties) {
        if (!properties.id || properties.id.trim() === "") {
            throw new Error("Prompt Identity is required.");
        }
        if (!properties.reference || properties.reference.trim() === "") {
            throw new Error("Prompt Reference is required.");
        }
        const referencePattern = /^[a-z0-9]+(\.[a-z0-9]+)*$/;
        if (!referencePattern.test(properties.reference)) {
            throw new Error("Invalid prompt reference format. Must be lower-case dot-separated key.");
        }
        if (!properties.ownerId || properties.ownerId.trim() === "") {
            throw new Error("Owner Reference is required.");
        }
        if (!properties.definition) {
            throw new Error("Prompt Definition is required.");
        }
        if (!properties.metadata) {
            throw new Error("Prompt Metadata is required.");
        }
        if (!properties.visibility) {
            throw new Error("Logical Visibility Classification is required.");
        }
        if (!properties.status) {
            throw new Error("Prompt Lifecycle State is required.");
        }
        this._id = properties.id;
        this._reference = properties.reference;
        this._ownerId = properties.ownerId;
        this._definition = properties.definition;
        this._metadata = properties.metadata;
        this._visibility = properties.visibility;
        this._status = properties.status;
        this._createdAt = properties.createdAt;
        this._updatedAt = properties.updatedAt;
        if (properties.versions && properties.versions.length > 0) {
            // Keep copy of initial versions to preserve append-only invariants
            this._versions = [...properties.versions];
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
    get definition() {
        return this._definition;
    }
    get metadata() {
        return this._metadata;
    }
    get visibility() {
        return this._visibility;
    }
    get status() {
        return this._status;
    }
    get versions() {
        return [...this._versions];
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
        // 1. Reference format
        const referencePattern = /^[a-z0-9]+(\.[a-z0-9]+)*$/;
        if (!referencePattern.test(this._reference)) {
            throw new Error("Invalid prompt reference format. Must be lower-case dot-separated key.");
        }
        // 2. Version history coherence
        if (this._versions.length > 0) {
            let previousNumber = 0;
            for (const ver of this._versions) {
                if (ver.versionNumber <= previousNumber) {
                    throw new Error("Version history must be sequential and strictly increasing.");
                }
                previousNumber = ver.versionNumber;
            }
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
    static create(id, reference, ownerId, definition, metadata, visibility) {
        const now = new Date();
        const initialVersion = new PromptVersion({
            versionNumber: 1,
            createdAt: now,
            definitionSnapshot: definition,
            metadataSnapshot: metadata,
            visibilitySnapshot: visibility,
            state: "Draft",
        });
        const prompt = new Prompt({
            id,
            reference,
            ownerId,
            definition,
            metadata,
            visibility,
            status: "Draft",
            versions: [initialVersion],
            createdAt: now,
            updatedAt: now,
        });
        prompt.addDomainEvent({
            eventType: PROMPT_REGISTERED,
            promptId: prompt.id,
            reference: prompt.reference,
            ownerId: prompt.ownerId,
        });
        return prompt;
    }
    getLatestVersion() {
        if (this._versions.length === 0) {
            throw new Error("No versions found in aggregate history.");
        }
        let latest = this._versions[0];
        for (const ver of this._versions) {
            if (ver.versionNumber > latest.versionNumber) {
                latest = ver;
            }
        }
        return latest;
    }
    // Domain Operations
    updateDraft(actorOwnerId, definition, metadata, visibility) {
        this.verifyOwnership(actorOwnerId);
        if (this._status !== "Draft") {
            throw new Error(`Cannot update definition or metadata in status: ${this._status}`);
        }
        this._definition = definition;
        this._metadata = metadata;
        this._visibility = visibility;
        this._updatedAt = new Date();
        // Replace the draft version snapshot in the version history using getLatestVersion helper
        const latestVersion = this.getLatestVersion();
        const latestIndex = this._versions.findIndex((v) => v.versionNumber === latestVersion.versionNumber);
        if (latestIndex !== -1) {
            this._versions[latestIndex] = new PromptVersion({
                versionNumber: latestVersion.versionNumber,
                createdAt: this._versions[latestIndex].createdAt,
                definitionSnapshot: this._definition,
                metadataSnapshot: this._metadata,
                visibilitySnapshot: this._visibility,
                state: "Draft",
            });
        }
        this.addDomainEvent({
            eventType: PROMPT_UPDATED,
            promptId: this._id,
            reference: this._reference,
            ownerId: this._ownerId,
            versionNumber: latestVersion.versionNumber,
        });
    }
    publish(actorOwnerId) {
        this.verifyOwnership(actorOwnerId);
        if (this._status !== "Draft") {
            throw new Error(`Cannot publish prompt when in status: ${this._status}`);
        }
        const now = new Date();
        this._status = "Published";
        this._updatedAt = now;
        // Freeze active version snapshot as Published using getLatestVersion helper
        const latestVersion = this.getLatestVersion();
        const latestIndex = this._versions.findIndex((v) => v.versionNumber === latestVersion.versionNumber);
        if (latestIndex !== -1) {
            const activeDraft = this._versions[latestIndex];
            this._versions[latestIndex] = new PromptVersion({
                versionNumber: activeDraft.versionNumber,
                createdAt: activeDraft.createdAt,
                publishedAt: now,
                definitionSnapshot: activeDraft.definitionSnapshot,
                metadataSnapshot: activeDraft.metadataSnapshot,
                visibilitySnapshot: activeDraft.visibilitySnapshot,
                state: "Published",
            });
        }
        this.addDomainEvent({
            eventType: PROMPT_PUBLISHED,
            promptId: this._id,
            reference: this._reference,
            ownerId: this._ownerId,
            versionNumber: latestVersion.versionNumber,
        });
    }
    createNewDraft(actorOwnerId, definition, metadata, visibility) {
        this.verifyOwnership(actorOwnerId);
        if (this._status !== "Published" && this._status !== "Deprecated") {
            throw new Error(`Cannot create a new draft from status: ${this._status}`);
        }
        const now = new Date();
        this._status = "Draft";
        this._definition = definition;
        this._metadata = metadata;
        this._visibility = visibility;
        this._updatedAt = now;
        // Append-only new draft version to collection using getLatestVersion helper
        const latestVersion = this.getLatestVersion();
        const newVersionNumber = latestVersion.versionNumber + 1;
        const newDraftVersion = new PromptVersion({
            versionNumber: newVersionNumber,
            createdAt: now,
            definitionSnapshot: definition,
            metadataSnapshot: metadata,
            visibilitySnapshot: visibility,
            state: "Draft",
        });
        this._versions.push(newDraftVersion);
        this.addDomainEvent({
            eventType: PROMPT_UPDATED,
            promptId: this._id,
            reference: this._reference,
            ownerId: this._ownerId,
            versionNumber: newVersionNumber,
        });
    }
    deprecate(actorOwnerId) {
        this.verifyOwnership(actorOwnerId);
        if (this._status !== "Published") {
            throw new Error(`Cannot deprecate prompt in status: ${this._status}`);
        }
        const now = new Date();
        this._status = "Deprecated";
        this._updatedAt = now;
        const latestVersion = this.getLatestVersion();
        this.addDomainEvent({
            eventType: PROMPT_DEPRECATED,
            promptId: this._id,
            reference: this._reference,
            ownerId: this._ownerId,
            versionNumber: latestVersion.versionNumber,
        });
    }
    archive(actorOwnerId) {
        this.verifyOwnership(actorOwnerId);
        if (this._status === "Archived") {
            throw new Error("Prompt is already archived.");
        }
        const now = new Date();
        this._status = "Archived";
        this._updatedAt = now;
        this.addDomainEvent({
            eventType: PROMPT_ARCHIVED,
            promptId: this._id,
            reference: this._reference,
            ownerId: this._ownerId,
        });
    }
}
