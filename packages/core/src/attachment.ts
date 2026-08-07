// Attachment States
export type AttachmentState = "Pending" | "Available" | "Archived" | "Deleted";

// Domain Events
export const ATTACHMENT_CREATED = "ATTACHMENT_CREATED";
export const ATTACHMENT_UPDATED = "ATTACHMENT_UPDATED";
export const ATTACHMENT_AVAILABLE = "ATTACHMENT_AVAILABLE";
export const ATTACHMENT_ARCHIVED = "ATTACHMENT_ARCHIVED";
export const ATTACHMENT_DELETED = "ATTACHMENT_DELETED";

export type AttachmentDomainEventName =
  | typeof ATTACHMENT_CREATED
  | typeof ATTACHMENT_UPDATED
  | typeof ATTACHMENT_AVAILABLE
  | typeof ATTACHMENT_ARCHIVED
  | typeof ATTACHMENT_DELETED;

export interface AttachmentEventPublisher {
  publish(event: AttachmentDomainEventName, metadata: Record<string, unknown>): Promise<void>;
}

// Attachment Metadata Value Object
export interface AttachmentMetadataProperties {
  displayName: string;
  logicalMediaType: string;
  characteristics: string;
  description: string;
}

export class AttachmentMetadata {
  private readonly _displayName: string;
  private readonly _logicalMediaType: string;
  private readonly _characteristics: string;
  private readonly _description: string;

  constructor(properties: AttachmentMetadataProperties) {
    if (!properties.displayName || properties.displayName.trim() === "") {
      throw new Error("Display name is required.");
    }
    if (!properties.logicalMediaType || properties.logicalMediaType.trim() === "") {
      throw new Error("Logical media type is required.");
    }
    this._displayName = properties.displayName;
    this._logicalMediaType = properties.logicalMediaType;
    this._characteristics = properties.characteristics || "";
    this._description = properties.description || "";
  }

  get displayName(): string {
    return this._displayName;
  }

  get logicalMediaType(): string {
    return this._logicalMediaType;
  }

  get characteristics(): string {
    return this._characteristics;
  }

  get description(): string {
    return this._description;
  }

  public equals(other: AttachmentMetadata): boolean {
    return (
      this._displayName === other.displayName &&
      this._logicalMediaType === other.logicalMediaType &&
      this._characteristics === other.characteristics &&
      this._description === other.description
    );
  }
}

// Logical Visibility Classification Value Object
export class AttachmentVisibility {
  private readonly _classification: string;

  constructor(classification: string) {
    if (!classification || classification.trim() === "") {
      throw new Error("Visibility classification is required.");
    }
    this._classification = classification;
  }

  get classification(): string {
    return this._classification;
  }
}

// Attachment Properties
export interface AttachmentProperties {
  attachmentId: string;
  parentId: string;
  ownerId: string;
  attachmentReference: string;
  metadata: AttachmentMetadata;
  visibility: AttachmentVisibility;
  status: AttachmentState;
  createdAt: Date;
  updatedAt: Date;
}

// Attachment Aggregate Root
export class Attachment {
  private readonly _attachmentId: string;
  private readonly _parentId: string;
  private readonly _ownerId: string;
  private readonly _attachmentReference: string;
  private _metadata: AttachmentMetadata;
  private _visibility: AttachmentVisibility;
  private _status: AttachmentState;
  private readonly _createdAt: Date;
  private _updatedAt: Date;
  private _domainEvents: Array<{
    event: AttachmentDomainEventName;
    metadata: Record<string, unknown>;
  }> = [];

  constructor(properties: AttachmentProperties) {
    if (!properties.attachmentId || properties.attachmentId.trim() === "") {
      throw new Error("Attachment ID is required.");
    }
    if (!properties.parentId || properties.parentId.trim() === "") {
      throw new Error("Parent ID reference is required.");
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
    this._parentId = properties.parentId;
    this._ownerId = properties.ownerId;
    this._attachmentReference = properties.attachmentReference;
    this._metadata = properties.metadata;
    this._visibility = properties.visibility;
    this._status = properties.status;
    this._createdAt = properties.createdAt;
    this._updatedAt = properties.updatedAt;

    this.validateInvariants();
  }

  get attachmentId(): string {
    return this._attachmentId;
  }

  get parentId(): string {
    return this._parentId;
  }

  get ownerId(): string {
    return this._ownerId;
  }

  get attachmentReference(): string {
    return this._attachmentReference;
  }

  get metadata(): AttachmentMetadata {
    return this._metadata;
  }

  get visibility(): AttachmentVisibility {
    return this._visibility;
  }

  get status(): AttachmentState {
    return this._status;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }

  get domainEvents() {
    return this._domainEvents;
  }

  public clearDomainEvents() {
    this._domainEvents = [];
  }

  private addDomainEvent(event: AttachmentDomainEventName, metadata: Record<string, unknown>) {
    this._domainEvents.push({ event, metadata });
  }

  // Factory Creation Method
  public static create(
    attachmentId: string,
    parentId: string,
    ownerId: string,
    attachmentReference: string,
    metadata: AttachmentMetadata,
    visibility: AttachmentVisibility,
  ): Attachment {
    const now = new Date();
    const attachment = new Attachment({
      attachmentId,
      parentId,
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
      parentId: attachment.parentId,
      ownerId: attachment.ownerId,
      attachmentReference: attachment.attachmentReference,
    });

    return attachment;
  }

  // Logical operations (transitions occur through valid Domain Operations)
  public confirmRegistration(ownerId: string) {
    this.verifyOwnership(ownerId);
    if (this._status !== "Pending") {
      throw new Error(`Cannot confirm attachment in status: ${this._status}`);
    }
    this._status = "Available";
    this._updatedAt = new Date();
    this.addDomainEvent(ATTACHMENT_AVAILABLE, { attachmentId: this._attachmentId });
  }

  public cancelRegistration(ownerId: string) {
    this.verifyOwnership(ownerId);
    if (this._status !== "Pending") {
      throw new Error(`Cannot cancel attachment registration in status: ${this._status}`);
    }
    this._status = "Deleted";
    this._updatedAt = new Date();
    this.addDomainEvent(ATTACHMENT_DELETED, { attachmentId: this._attachmentId });
  }

  public archive(ownerId: string) {
    this.verifyOwnership(ownerId);
    if (this._status !== "Available") {
      throw new Error(`Cannot archive attachment in status: ${this._status}`);
    }
    this._status = "Archived";
    this._updatedAt = new Date();
    this.addDomainEvent(ATTACHMENT_ARCHIVED, { attachmentId: this._attachmentId });
  }

  public delete(ownerId: string) {
    this.verifyOwnership(ownerId);
    if (this._status !== "Available" && this._status !== "Archived") {
      throw new Error(`Cannot delete attachment in status: ${this._status}`);
    }
    this._status = "Deleted";
    this._updatedAt = new Date();
    this.addDomainEvent(ATTACHMENT_DELETED, { attachmentId: this._attachmentId });
  }

  public updateMetadata(ownerId: string, metadata: AttachmentMetadata) {
    this.verifyOwnership(ownerId);
    if (this._status === "Deleted") {
      throw new Error("Cannot update metadata on deleted attachment.");
    }
    this._metadata = metadata;
    this._updatedAt = new Date();
    this.addDomainEvent(ATTACHMENT_UPDATED, { attachmentId: this._attachmentId });
  }

  public updateVisibility(ownerId: string, visibility: AttachmentVisibility) {
    this.verifyOwnership(ownerId);
    if (this._status === "Deleted") {
      throw new Error("Cannot update visibility on deleted attachment.");
    }
    this._visibility = visibility;
    this._updatedAt = new Date();
    this.addDomainEvent(ATTACHMENT_UPDATED, { attachmentId: this._attachmentId });
  }

  private verifyOwnership(ownerId: string) {
    if (ownerId !== this._ownerId) {
      throw new Error("Ownership validation failed.");
    }
  }

  private validateInvariants() {
    if (!this._attachmentId || this._attachmentId.trim() === "") {
      throw new Error("Attachment ID is required.");
    }
    if (!this._parentId || this._parentId.trim() === "") {
      throw new Error("Parent ID reference is required.");
    }
    if (!this._ownerId || this._ownerId.trim() === "") {
      throw new Error("Owner ID reference is required.");
    }
    if (!this._attachmentReference || this._attachmentReference.trim() === "") {
      throw new Error("Attachment reference is required.");
    }
  }
}

// Domain Persistence Contract
export interface AttachmentPersistenceContract {
  checkUniqueReference(
    ownerId: string,
    attachmentReference: string,
    attachmentId?: string,
  ): Promise<boolean>;
}

// Attachment Aggregate Store
export interface AttachmentAggregateStore {
  save(attachment: Attachment): Promise<void>;
  findById(attachmentId: string, ownerId: string): Promise<Attachment | null>;
  findByReference(attachmentReference: string, ownerId: string): Promise<Attachment | null>;
}

// Query-side Projection Contract
export interface AttachmentQueryProjection {
  id: string;
  parentId: string;
  ownerId: string;
  attachmentReference: string;
  displayName: string;
  status: string;
}
