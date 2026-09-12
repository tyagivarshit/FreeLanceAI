// Domain Events
export const PROJECT_CREATED = "PROJECT_CREATED";
export const PROJECT_UPDATED = "PROJECT_UPDATED";
export const PROJECT_STARTED = "PROJECT_STARTED";
export const PROJECT_PAUSED = "PROJECT_PAUSED";
export const PROJECT_COMPLETED = "PROJECT_COMPLETED";
export const PROJECT_CANCELLED = "PROJECT_CANCELLED";
export const PROJECT_ARCHIVED = "PROJECT_ARCHIVED";
export class ProjectMetadata {
    _title;
    _description;
    _startDate;
    _endDate;
    constructor(properties) {
        if (!properties.title || properties.title.trim() === "") {
            throw new Error("Project title is required.");
        }
        this._title = properties.title;
        this._description = properties.description || "";
        this._startDate = properties.startDate;
        this._endDate = properties.endDate;
    }
    get title() {
        return this._title;
    }
    get description() {
        return this._description;
    }
    get startDate() {
        return this._startDate;
    }
    get endDate() {
        return this._endDate;
    }
}
// Logical Visibility Classification Value Object
export class ProjectVisibility {
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
// Project Aggregate Root
export class Project {
    _projectId;
    _tenantId;
    _clientId;
    _ownerId;
    _projectReference;
    _metadata;
    _visibility;
    _status;
    _createdAt;
    _updatedAt;
    _domainEvents = [];
    constructor(properties) {
        if (!properties.projectId || properties.projectId.trim() === "") {
            throw new Error("Project ID is required.");
        }
        if (!properties.tenantId || properties.tenantId.trim() === "") {
            throw new Error("Tenant ID is required.");
        }
        if (!properties.clientId || properties.clientId.trim() === "") {
            throw new Error("Client ID reference is required.");
        }
        if (!properties.ownerId || properties.ownerId.trim() === "") {
            throw new Error("Owner ID reference is required.");
        }
        if (!properties.projectReference || properties.projectReference.trim() === "") {
            throw new Error("Project reference is required.");
        }
        if (!properties.metadata) {
            throw new Error("Project metadata is required.");
        }
        if (!properties.visibility) {
            throw new Error("Project visibility is required.");
        }
        this._projectId = properties.projectId;
        this._tenantId = properties.tenantId;
        this._clientId = properties.clientId;
        this._ownerId = properties.ownerId;
        this._projectReference = properties.projectReference;
        this._metadata = properties.metadata;
        this._visibility = properties.visibility;
        this._status = properties.status;
        this._createdAt = properties.createdAt;
        this._updatedAt = properties.updatedAt;
        this.validateInvariants();
    }
    get projectId() {
        return this._projectId;
    }
    get tenantId() {
        return this._tenantId;
    }
    get clientId() {
        return this._clientId;
    }
    get ownerId() {
        return this._ownerId;
    }
    get projectReference() {
        return this._projectReference;
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
    static create(projectId, tenantId, clientId, ownerId, projectReference, metadata, visibility) {
        const now = new Date();
        const project = new Project({
            projectId,
            tenantId,
            clientId,
            ownerId,
            projectReference,
            metadata,
            visibility,
            status: "Draft",
            createdAt: now,
            updatedAt: now,
        });
        project.addDomainEvent(PROJECT_CREATED, {
            projectId: project.projectId,
            tenantId: project.tenantId,
            clientId: project.clientId,
            ownerId: project.ownerId,
            projectReference: project.projectReference,
        });
        return project;
    }
    // Logical operations (transitions occur through valid Domain Operations)
    plan(ownerId, metadata, visibility) {
        this.verifyOwnership(ownerId);
        if (this._status !== "Draft") {
            throw new Error(`Cannot plan project in status: ${this._status}`);
        }
        this._metadata = metadata;
        this._visibility = visibility;
        this._status = "Planned";
        this._updatedAt = new Date();
        this.addDomainEvent(PROJECT_UPDATED, { projectId: this._projectId, status: "Planned" });
    }
    start(ownerId) {
        this.verifyOwnership(ownerId);
        if (this._status !== "Planned") {
            throw new Error(`Cannot start project in status: ${this._status}`);
        }
        this._status = "Active";
        this._updatedAt = new Date();
        this.addDomainEvent(PROJECT_STARTED, { projectId: this._projectId });
    }
    pause(ownerId) {
        this.verifyOwnership(ownerId);
        if (this._status !== "Active") {
            throw new Error(`Cannot pause project in status: ${this._status}`);
        }
        this._status = "Paused";
        this._updatedAt = new Date();
        this.addDomainEvent(PROJECT_PAUSED, { projectId: this._projectId });
    }
    resume(ownerId) {
        this.verifyOwnership(ownerId);
        if (this._status !== "Paused") {
            throw new Error(`Cannot resume project in status: ${this._status}`);
        }
        this._status = "Active";
        this._updatedAt = new Date();
        this.addDomainEvent(PROJECT_STARTED, { projectId: this._projectId });
    }
    complete(ownerId) {
        this.verifyOwnership(ownerId);
        if (this._status !== "Active") {
            throw new Error(`Cannot complete project in status: ${this._status}`);
        }
        this._status = "Completed";
        this._updatedAt = new Date();
        this.addDomainEvent(PROJECT_COMPLETED, { projectId: this._projectId });
    }
    cancel(ownerId) {
        this.verifyOwnership(ownerId);
        if (this._status !== "Active" && this._status !== "Paused") {
            throw new Error(`Cannot cancel project in status: ${this._status}`);
        }
        this._status = "Cancelled";
        this._updatedAt = new Date();
        this.addDomainEvent(PROJECT_CANCELLED, { projectId: this._projectId });
    }
    archive(ownerId) {
        this.verifyOwnership(ownerId);
        if (this._status !== "Completed" && this._status !== "Cancelled") {
            throw new Error(`Cannot archive project in status: ${this._status}`);
        }
        this._status = "Archived";
        this._updatedAt = new Date();
        this.addDomainEvent(PROJECT_ARCHIVED, { projectId: this._projectId });
    }
    updateDetails(ownerId, metadata, visibility) {
        this.verifyOwnership(ownerId);
        if (this._status !== "Draft" && this._status !== "Planned") {
            throw new Error(`Cannot modify project details in status: ${this._status}`);
        }
        this._metadata = metadata;
        this._visibility = visibility;
        this._updatedAt = new Date();
        this.addDomainEvent(PROJECT_UPDATED, { projectId: this._projectId });
    }
    verifyOwnership(ownerId, tenantId) {
        if (ownerId !== this._ownerId) {
            throw new Error("Ownership validation failed.");
        }
        if (tenantId && tenantId !== this._tenantId) {
            throw new Error("Tenant boundary violation.");
        }
    }
    validateInvariants() {
        if (!this._projectId || this._projectId.trim() === "") {
            throw new Error("Project ID is required.");
        }
        if (!this._clientId || this._clientId.trim() === "") {
            throw new Error("Client ID reference is required.");
        }
        if (!this._ownerId || this._ownerId.trim() === "") {
            throw new Error("Owner ID reference is required.");
        }
        if (!this._projectReference || this._projectReference.trim() === "") {
            throw new Error("Project reference is required.");
        }
    }
}
