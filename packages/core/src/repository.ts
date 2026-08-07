// Repository States
export type RepositoryState = "Pending" | "Available" | "Archived" | "Removed";

// Domain Events
export const REPOSITORY_REGISTERED = "REPOSITORY_REGISTERED";
export const REPOSITORY_UPDATED = "REPOSITORY_UPDATED";
export const REPOSITORY_AVAILABLE = "REPOSITORY_AVAILABLE";
export const REPOSITORY_ARCHIVED = "REPOSITORY_ARCHIVED";
export const REPOSITORY_REMOVED = "REPOSITORY_REMOVED";

export type RepositoryDomainEventName =
  | typeof REPOSITORY_REGISTERED
  | typeof REPOSITORY_UPDATED
  | typeof REPOSITORY_AVAILABLE
  | typeof REPOSITORY_ARCHIVED
  | typeof REPOSITORY_REMOVED;

export interface RepositoryEventPublisher {
  publish(event: RepositoryDomainEventName, metadata: Record<string, unknown>): Promise<void>;
}

// Repository Metadata Value Object
export interface RepositoryMetadataProperties {
  displayName: string;
  characteristics: string;
  description: string;
}

export class RepositoryMetadata {
  private readonly _displayName: string;
  private readonly _characteristics: string;
  private readonly _description: string;

  constructor(properties: RepositoryMetadataProperties) {
    if (!properties.displayName || properties.displayName.trim() === "") {
      throw new Error("Display name is required.");
    }
    this._displayName = properties.displayName;
    this._characteristics = properties.characteristics || "";
    this._description = properties.description || "";
  }

  get displayName(): string {
    return this._displayName;
  }

  get characteristics(): string {
    return this._characteristics;
  }

  get description(): string {
    return this._description;
  }

  public equals(other: RepositoryMetadata): boolean {
    return (
      this._displayName === other.displayName &&
      this._characteristics === other.characteristics &&
      this._description === other.description
    );
  }
}

// Logical Visibility Classification Value Object
export class RepositoryVisibility {
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

// Repository Properties
export interface RepositoryProperties {
  repositoryId: string;
  projectId: string;
  ownerId: string;
  repositoryReference: string;
  metadata: RepositoryMetadata;
  visibility: RepositoryVisibility;
  status: RepositoryState;
  createdAt: Date;
  updatedAt: Date;
}

// Repository Aggregate Root
export class Repository {
  private readonly _repositoryId: string;
  private readonly _projectId: string;
  private readonly _ownerId: string;
  private readonly _repositoryReference: string;
  private _metadata: RepositoryMetadata;
  private _visibility: RepositoryVisibility;
  private _status: RepositoryState;
  private readonly _createdAt: Date;
  private _updatedAt: Date;
  private _domainEvents: Array<{
    event: RepositoryDomainEventName;
    metadata: Record<string, unknown>;
  }> = [];

  constructor(properties: RepositoryProperties) {
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

  get repositoryId(): string {
    return this._repositoryId;
  }

  get projectId(): string {
    return this._projectId;
  }

  get ownerId(): string {
    return this._ownerId;
  }

  get repositoryReference(): string {
    return this._repositoryReference;
  }

  get metadata(): RepositoryMetadata {
    return this._metadata;
  }

  get visibility(): RepositoryVisibility {
    return this._visibility;
  }

  get status(): RepositoryState {
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

  private addDomainEvent(event: RepositoryDomainEventName, metadata: Record<string, unknown>) {
    this._domainEvents.push({ event, metadata });
  }

  // Factory Creation Method
  public static create(
    repositoryId: string,
    projectId: string,
    ownerId: string,
    repositoryReference: string,
    metadata: RepositoryMetadata,
    visibility: RepositoryVisibility,
  ): Repository {
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
  public confirmRegistration(ownerId: string) {
    this.verifyOwnership(ownerId);
    if (this._status !== "Pending") {
      throw new Error(`Cannot confirm repository registration in status: ${this._status}`);
    }
    this._status = "Available";
    this._updatedAt = new Date();
    this.addDomainEvent(REPOSITORY_AVAILABLE, { repositoryId: this._repositoryId });
  }

  public cancelRegistration(ownerId: string) {
    this.verifyOwnership(ownerId);
    if (this._status !== "Pending") {
      throw new Error(`Cannot cancel repository registration in status: ${this._status}`);
    }
    this._status = "Removed";
    this._updatedAt = new Date();
    this.addDomainEvent(REPOSITORY_REMOVED, { repositoryId: this._repositoryId });
  }

  public archive(ownerId: string) {
    this.verifyOwnership(ownerId);
    if (this._status !== "Available") {
      throw new Error(`Cannot archive repository in status: ${this._status}`);
    }
    this._status = "Archived";
    this._updatedAt = new Date();
    this.addDomainEvent(REPOSITORY_ARCHIVED, { repositoryId: this._repositoryId });
  }

  public remove(ownerId: string) {
    this.verifyOwnership(ownerId);
    if (this._status !== "Available" && this._status !== "Archived") {
      throw new Error(`Cannot remove repository in status: ${this._status}`);
    }
    this._status = "Removed";
    this._updatedAt = new Date();
    this.addDomainEvent(REPOSITORY_REMOVED, { repositoryId: this._repositoryId });
  }

  public updateMetadata(ownerId: string, metadata: RepositoryMetadata) {
    this.verifyOwnership(ownerId);
    if (this._status === "Removed") {
      throw new Error("Cannot update metadata on removed repository.");
    }
    this._metadata = metadata;
    this._updatedAt = new Date();
    this.addDomainEvent(REPOSITORY_UPDATED, { repositoryId: this._repositoryId });
  }

  public updateVisibility(ownerId: string, visibility: RepositoryVisibility) {
    this.verifyOwnership(ownerId);
    if (this._status === "Removed") {
      throw new Error("Cannot update visibility on removed repository.");
    }
    this._visibility = visibility;
    this._updatedAt = new Date();
    this.addDomainEvent(REPOSITORY_UPDATED, { repositoryId: this._repositoryId });
  }

  private verifyOwnership(ownerId: string) {
    if (ownerId !== this._ownerId) {
      throw new Error("Ownership validation failed.");
    }
  }

  private validateInvariants() {
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

// Domain Persistence Contract
export interface RepositoryPersistenceContract {
  checkUniqueReference(
    ownerId: string,
    repositoryReference: string,
    repositoryId?: string,
  ): Promise<boolean>;
}

// Repository Aggregate Store
export interface RepositoryAggregateStore {
  save(repository: Repository): Promise<void>;
  findById(repositoryId: string, ownerId: string): Promise<Repository | null>;
  findByReference(repositoryReference: string, ownerId: string): Promise<Repository | null>;
}

// Query-side Projection Contract
export interface RepositoryQueryProjection {
  id: string;
  projectId: string;
  ownerId: string;
  repositoryReference: string;
  displayName: string;
  status: string;
}
