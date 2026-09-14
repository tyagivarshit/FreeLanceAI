// Domain Events
export const ATTACHMENT_CREATED = "ATTACHMENT_CREATED";
export const ATTACHMENT_UPDATED = "ATTACHMENT_UPDATED";
export const ATTACHMENT_AVAILABLE = "ATTACHMENT_AVAILABLE";
export const ATTACHMENT_ARCHIVED = "ATTACHMENT_ARCHIVED";
export const ATTACHMENT_DELETED = "ATTACHMENT_DELETED";
export class AttachmentMetadata {
    _displayName;
    _logicalMediaType;
    _characteristics;
    _description;
    _fileSizeBytes;
    constructor(properties) {
        if (!properties.displayName || properties.displayName.trim() === "") {
            throw new Error("Display name is required.");
        }
        if (!properties.logicalMediaType || properties.logicalMediaType.trim() === "") {
            throw new Error("Logical media type is required.");
        }
        const mediaTypeLower = properties.logicalMediaType.toLowerCase();
        if (mediaTypeLower === "text/html" || mediaTypeLower === "application/javascript" || mediaTypeLower.includes("script")) {
            throw new Error("Malicious media type blocked.");
        }
        this._displayName = properties.displayName;
        this._logicalMediaType = properties.logicalMediaType;
        this._characteristics = properties.characteristics || "";
        this._description = properties.description || "";
        this._fileSizeBytes = properties.fileSizeBytes || 0;
        if (this._fileSizeBytes > 50 * 1024 * 1024) { // 50MB max
            throw new Error("File size exceeds 50MB limit.");
        }
    }
    get displayName() {
        return this._displayName;
    }
    get logicalMediaType() {
        return this._logicalMediaType;
    }
    get characteristics() {
        return this._characteristics;
    }
    get fileSizeBytes() {
        return this._fileSizeBytes;
    }
    get description() {
        return this._description;
    }
    equals(other) {
        return (this._displayName === other.displayName &&
            this._logicalMediaType === other.logicalMediaType &&
            this._characteristics === other.characteristics &&
            this._description === other.description);
    }
}
// Logical Visibility Classification Value Object
export class AttachmentVisibility {
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
// Attachment Aggregate Root
export class Attachment {
    _attachmentId;
    _tenantId;
    _parentId;
    _parentType;
    _ownerId;
    _attachmentReference;
    _metadata;
    _visibility;
    _status;
    _createdAt;
    _updatedAt;
    _domainEvents = [];
    constructor(properties) {
        if (!properties.attachmentId || properties.attachmentId.trim() === "") {
            throw new Error("Attachment ID is required.");
        }
        if (!properties.tenantId || properties.tenantId.trim() === "") {
            throw new Error("Tenant ID is required.");
        }
        if (!properties.parentId || properties.parentId.trim() === "") {
            throw new Error("Parent ID reference is required.");
        }
        if (!properties.parentType || properties.parentType.trim() === "") {
            throw new Error("Parent Type is required.");
        }
        if (!properties.ownerId || properties.ownerId.trim() === "") {
            throw new Error("Owner ID reference is required.");
        }
        if (!properties.attachmentReference || properties.attachmentReference.trim() === "") {
            throw new Error("Attachment reference is required.");
        }
        if (!properties.metadata) {
            throw new Error("Attachment metadata is required.");
        }
        if (!properties.visibility) {
            throw new Error("Attachment visibility is required.");
        }
        this._attachmentId = properties.attachmentId;
        this._tenantId = properties.tenantId;
        this._parentId = properties.parentId;
        this._parentType = properties.parentType;
        this._ownerId = properties.ownerId;
        this._attachmentReference = properties.attachmentReference;
        this._metadata = properties.metadata;
        this._visibility = properties.visibility;
        this._status = properties.status;
        this._createdAt = properties.createdAt;
        this._updatedAt = properties.updatedAt;
        this.validateInvariants();
    }
    get attachmentId() {
        return this._attachmentId;
    }
    get tenantId() {
        return this._tenantId;
    }
    get parentId() {
        return this._parentId;
    }
    get parentType() {
        return this._parentType;
    }
    get ownerId() {
        return this._ownerId;
    }
    get attachmentReference() {
        return this._attachmentReference;
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
    static async create(attachmentId, tenantId, parentId, parentType, ownerId, attachmentReference, metadata, visibility) {
        const now = new Date();
        const attachment = new Attachment({
            attachmentId,
            tenantId,
            parentId,
            parentType,
            ownerId,
            attachmentReference,
            metadata,
            visibility,
            status: "Pending",
            createdAt: now,
            updatedAt: now,
        });
        attachment.addDomainEvent(ATTACHMENT_CREATED, {
            attachmentId: attachment.attachmentId,
            tenantId: attachment.tenantId,
            parentId: attachment.parentId,
            parentType: attachment.parentType,
            ownerId: attachment.ownerId,
            attachmentReference: attachment.attachmentReference,
        });
        return attachment;
    }
    // Logical operations (transitions occur through valid Domain Operations)
    confirmRegistration(ownerId) {
        this.verifyOwnership(ownerId);
        if (this._status !== "Pending") {
            throw new Error(`Cannot confirm attachment in status: ${this._status}`);
        }
        this._status = "Available";
        this._updatedAt = new Date();
        this.addDomainEvent(ATTACHMENT_AVAILABLE, { attachmentId: this._attachmentId });
    }
    cancelRegistration(ownerId) {
        this.verifyOwnership(ownerId);
        if (this._status !== "Pending") {
            throw new Error(`Cannot cancel attachment registration in status: ${this._status}`);
        }
        this._status = "Deleted";
        this._updatedAt = new Date();
        this.addDomainEvent(ATTACHMENT_DELETED, { attachmentId: this._attachmentId });
    }
    archive(ownerId) {
        this.verifyOwnership(ownerId);
        if (this._status !== "Available") {
            throw new Error(`Cannot archive attachment in status: ${this._status}`);
        }
        this._status = "Archived";
        this._updatedAt = new Date();
        this.addDomainEvent(ATTACHMENT_ARCHIVED, { attachmentId: this._attachmentId });
    }
    delete(ownerId) {
        this.verifyOwnership(ownerId);
        if (this._status !== "Available" && this._status !== "Archived") {
            throw new Error(`Cannot delete attachment in status: ${this._status}`);
        }
        this._status = "Deleted";
        this._updatedAt = new Date();
        this.addDomainEvent(ATTACHMENT_DELETED, { attachmentId: this._attachmentId });
    }
    updateMetadata(ownerId, metadata) {
        this.verifyOwnership(ownerId);
        if (this._status === "Deleted" || this._status === "Archived") {
            throw new Error("Cannot update metadata on deleted or archived attachment.");
        }
        this._metadata = metadata;
        this._updatedAt = new Date();
        this.addDomainEvent(ATTACHMENT_UPDATED, { attachmentId: this._attachmentId });
    }
    updateVisibility(ownerId, visibility) {
        this.verifyOwnership(ownerId);
        if (this._status === "Deleted" || this._status === "Archived") {
            throw new Error("Cannot update visibility on deleted or archived attachment.");
        }
        this._visibility = visibility;
        this._updatedAt = new Date();
        this.addDomainEvent(ATTACHMENT_UPDATED, { attachmentId: this._attachmentId });
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
        if (!this._attachmentId || this._attachmentId.trim() === "") {
            throw new Error("Attachment ID is required.");
        }
        if (!this._tenantId || this._tenantId.trim() === "") {
            throw new Error("Tenant ID is required.");
        }
        if (!this._parentId || this._parentId.trim() === "") {
            throw new Error("Parent ID reference is required.");
        }
        if (!this._parentType || this._parentType.trim() === "") {
            throw new Error("Parent Type is required.");
        }
        if (!this._ownerId || this._ownerId.trim() === "") {
            throw new Error("Owner ID reference is required.");
        }
        if (!this._attachmentReference || this._attachmentReference.trim() === "") {
            throw new Error("Attachment reference is required.");
        }
    }
}
