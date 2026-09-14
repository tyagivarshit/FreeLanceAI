// Domain Events
export const REPOSITORY_REGISTERED = "REPOSITORY_REGISTERED";
export const REPOSITORY_UPDATED = "REPOSITORY_UPDATED";
export const REPOSITORY_AVAILABLE = "REPOSITORY_AVAILABLE";
export const REPOSITORY_ARCHIVED = "REPOSITORY_ARCHIVED";
export const REPOSITORY_REMOVED = "REPOSITORY_REMOVED";
export class RepositoryMetadata {
    _displayName;
    _characteristics;
    _description;
    constructor(properties) {
        if (!properties.displayName || properties.displayName.trim() === "") {
            throw new Error("Display name is required.");
        }
        this._displayName = properties.displayName;
        this._characteristics = properties.characteristics || "";
        this._description = properties.description || "";
    }
    get displayName() {
        return this._displayName;
    }
    get characteristics() {
        return this._characteristics;
    }
    get description() {
        return this._description;
    }
    equals(other) {
        return (this._displayName === other.displayName &&
            this._characteristics === other.characteristics &&
            this._description === other.description);
    }
}
// Logical Visibility Classification Value Object
export class RepositoryVisibility {
    _classification;
    constructor(classification) {
        if (!classification || classification.trim() === "") {
            throw new Error("Visibility classification is required.");
        }
        this._classification = classification;
    }
    get classification() {
        return this._classification;
    }
}
// Repository Aggregate Root
export class Repository {
    _repositoryId;
    _projectId;
    _ownerId;
    _repositoryReference;
    _metadata;
    _visibility;
    _status;
    _createdAt;
    _updatedAt;
    _domainEvents = [];
    constructor(properties) {
        if (!properties.repositoryId || properties.repositoryId.trim() === "") {
            throw new Error("Repository ID is required.");
        }
        if (!properties.projectId || properties.projectId.trim() === "") {
            throw new Error("Project ID reference is required.");
        }
        if (!properties.ownerId || properties.ownerId.trim() === "") {
            throw new Error("Owner ID reference is required.");
        }
        if (!properties.repositoryReference || properties.repositoryReference.trim() === "") {
            throw new Error("Repository reference is required.");
        }
        if (!properties.metadata) {
            throw new Error("Repository metadata is required.");
        }
        if (!properties.visibility) {
            throw new Error("Repository visibility is required.");
        }
        this._repositoryId = properties.repositoryId;
        this._projectId = properties.projectId;
        this._ownerId = properties.ownerId;
        this._repositoryReference = properties.repositoryReference;
        this._metadata = properties.metadata;
        this._visibility = properties.visibility;
        this._status = properties.status;
        this._createdAt = properties.createdAt;
        this._updatedAt = properties.updatedAt;
        this.validateInvariants();
    }
    get repositoryId() {
        return this._repositoryId;
    }
    get projectId() {
        return this._projectId;
    }
    get ownerId() {
        return this._ownerId;
    }
    get repositoryReference() {
        return this._repositoryReference;
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
    addDomainEvent(event, metadata) {
        this._domainEvents.push({ event, metadata });
    }
    // Factory Creation Method
    static create(repositoryId, projectId, ownerId, repositoryReference, metadata, visibility) {
        const now = new Date();
        const repository = new Repository({
            repositoryId,
            projectId,
            ownerId,
            repositoryReference,
            metadata,
            visibility,
            status: "Pending",
            createdAt: now,
            updatedAt: now,
        });
        repository.addDomainEvent(REPOSITORY_REGISTERED, {
            repositoryId: repository.repositoryId,
            projectId: repository.projectId,
            ownerId: repository.ownerId,
            repositoryReference: repository.repositoryReference,
        });
        return repository;
    }
    // Logical operations (transitions occur through valid Domain Operations)
    confirmRegistration(ownerId) {
        this.verifyOwnership(ownerId);
        if (this._status !== "Pending") {
            throw new Error(`Cannot confirm repository registration in status: ${this._status}`);
        }
        this._status = "Available";
        this._updatedAt = new Date();
        this.addDomainEvent(REPOSITORY_AVAILABLE, { repositoryId: this._repositoryId });
    }
    cancelRegistration(ownerId) {
        this.verifyOwnership(ownerId);
        if (this._status !== "Pending") {
            throw new Error(`Cannot cancel repository registration in status: ${this._status}`);
        }
        this._status = "Removed";
        this._updatedAt = new Date();
        this.addDomainEvent(REPOSITORY_REMOVED, { repositoryId: this._repositoryId });
    }
    archive(ownerId) {
        this.verifyOwnership(ownerId);
        if (this._status !== "Available") {
            throw new Error(`Cannot archive repository in status: ${this._status}`);
        }
        this._status = "Archived";
        this._updatedAt = new Date();
        this.addDomainEvent(REPOSITORY_ARCHIVED, { repositoryId: this._repositoryId });
    }
    remove(ownerId) {
        this.verifyOwnership(ownerId);
        if (this._status !== "Available" && this._status !== "Archived") {
            throw new Error(`Cannot remove repository in status: ${this._status}`);
        }
        this._status = "Removed";
        this._updatedAt = new Date();
        this.addDomainEvent(REPOSITORY_REMOVED, { repositoryId: this._repositoryId });
    }
    updateMetadata(ownerId, metadata) {
        this.verifyOwnership(ownerId);
        if (this._status === "Removed") {
            throw new Error("Cannot update metadata on removed repository.");
        }
        this._metadata = metadata;
        this._updatedAt = new Date();
        this.addDomainEvent(REPOSITORY_UPDATED, { repositoryId: this._repositoryId });
    }
    updateVisibility(ownerId, visibility) {
        this.verifyOwnership(ownerId);
        if (this._status === "Removed") {
            throw new Error("Cannot update visibility on removed repository.");
        }
        this._visibility = visibility;
        this._updatedAt = new Date();
        this.addDomainEvent(REPOSITORY_UPDATED, { repositoryId: this._repositoryId });
    }
    verifyOwnership(ownerId) {
        if (ownerId !== this._ownerId) {
            throw new Error("Ownership validation failed.");
        }
    }
    validateInvariants() {
        if (!this._repositoryId || this._repositoryId.trim() === "") {
            throw new Error("Repository ID is required.");
        }
        if (!this._projectId || this._projectId.trim() === "") {
            throw new Error("Project ID reference is required.");
        }
        if (!this._ownerId || this._ownerId.trim() === "") {
            throw new Error("Owner ID reference is required.");
        }
        if (!this._repositoryReference || this._repositoryReference.trim() === "") {
            throw new Error("Repository reference is required.");
        }
    }
}
