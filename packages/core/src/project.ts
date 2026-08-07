// Project States
export type ProjectState =
  | "Draft"
  | "Planned"
  | "Active"
  | "Paused"
  | "Completed"
  | "Cancelled"
  | "Archived";

// Domain Events
export const PROJECT_CREATED = "PROJECT_CREATED";
export const PROJECT_UPDATED = "PROJECT_UPDATED";
export const PROJECT_STARTED = "PROJECT_STARTED";
export const PROJECT_PAUSED = "PROJECT_PAUSED";
export const PROJECT_COMPLETED = "PROJECT_COMPLETED";
export const PROJECT_CANCELLED = "PROJECT_CANCELLED";
export const PROJECT_ARCHIVED = "PROJECT_ARCHIVED";

export type ProjectDomainEventName =
  | typeof PROJECT_CREATED
  | typeof PROJECT_UPDATED
  | typeof PROJECT_STARTED
  | typeof PROJECT_PAUSED
  | typeof PROJECT_COMPLETED
  | typeof PROJECT_CANCELLED
  | typeof PROJECT_ARCHIVED;

export interface ProjectEventPublisher {
  publish(event: ProjectDomainEventName, metadata: Record<string, unknown>): Promise<void>;
}

// Project Descriptive Metadata Value Object
export interface ProjectMetadataProperties {
  title: string;
  description: string;
  startDate?: Date | undefined;
  endDate?: Date | undefined;
}

export class ProjectMetadata {
  private readonly _title: string;
  private readonly _description: string;
  private readonly _startDate: Date | undefined;
  private readonly _endDate: Date | undefined;

  constructor(properties: ProjectMetadataProperties) {
    if (!properties.title || properties.title.trim() === "") {
      throw new Error("Project title is required.");
    }
    this._title = properties.title;
    this._description = properties.description || "";
    this._startDate = properties.startDate;
    this._endDate = properties.endDate;
  }

  get title(): string {
    return this._title;
  }

  get description(): string {
    return this._description;
  }

  get startDate(): Date | undefined {
    return this._startDate;
  }

  get endDate(): Date | undefined {
    return this._endDate;
  }
}

// Logical Visibility Classification Value Object
export class ProjectVisibility {
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

// Project Properties
export interface ProjectProperties {
  projectId: string;
  clientId: string;
  ownerId: string;
  projectReference: string;
  metadata: ProjectMetadata;
  visibility: ProjectVisibility;
  status: ProjectState;
  createdAt: Date;
  updatedAt: Date;
}

// Project Aggregate Root
export class Project {
  private readonly _projectId: string;
  private readonly _clientId: string;
  private readonly _ownerId: string;
  private readonly _projectReference: string;
  private _metadata: ProjectMetadata;
  private _visibility: ProjectVisibility;
  private _status: ProjectState;
  private readonly _createdAt: Date;
  private _updatedAt: Date;
  private _domainEvents: Array<{
    event: ProjectDomainEventName;
    metadata: Record<string, unknown>;
  }> = [];

  constructor(properties: ProjectProperties) {
    if (!properties.projectId || properties.projectId.trim() === "") {
      throw new Error("Project ID is required.");
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

  get projectId(): string {
    return this._projectId;
  }

  get clientId(): string {
    return this._clientId;
  }

  get ownerId(): string {
    return this._ownerId;
  }

  get projectReference(): string {
    return this._projectReference;
  }

  get metadata(): ProjectMetadata {
    return this._metadata;
  }

  get visibility(): ProjectVisibility {
    return this._visibility;
  }

  get status(): ProjectState {
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

  private addDomainEvent(event: ProjectDomainEventName, metadata: Record<string, unknown>) {
    this._domainEvents.push({ event, metadata });
  }

  // Factory Creation Method
  public static create(
    projectId: string,
    clientId: string,
    ownerId: string,
    projectReference: string,
    metadata: ProjectMetadata,
    visibility: ProjectVisibility,
  ): Project {
    const now = new Date();
    const project = new Project({
      projectId,
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
      clientId: project.clientId,
      ownerId: project.ownerId,
      projectReference: project.projectReference,
    });

    return project;
  }

  // Logical operations (transitions occur through valid Domain Operations)
  public plan(ownerId: string, metadata: ProjectMetadata, visibility: ProjectVisibility) {
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

  public start(ownerId: string) {
    this.verifyOwnership(ownerId);
    if (this._status !== "Planned") {
      throw new Error(`Cannot start project in status: ${this._status}`);
    }
    this._status = "Active";
    this._updatedAt = new Date();
    this.addDomainEvent(PROJECT_STARTED, { projectId: this._projectId });
  }

  public pause(ownerId: string) {
    this.verifyOwnership(ownerId);
    if (this._status !== "Active") {
      throw new Error(`Cannot pause project in status: ${this._status}`);
    }
    this._status = "Paused";
    this._updatedAt = new Date();
    this.addDomainEvent(PROJECT_PAUSED, { projectId: this._projectId });
  }

  public resume(ownerId: string) {
    this.verifyOwnership(ownerId);
    if (this._status !== "Paused") {
      throw new Error(`Cannot resume project in status: ${this._status}`);
    }
    this._status = "Active";
    this._updatedAt = new Date();
    this.addDomainEvent(PROJECT_STARTED, { projectId: this._projectId });
  }

  public complete(ownerId: string) {
    this.verifyOwnership(ownerId);
    if (this._status !== "Active") {
      throw new Error(`Cannot complete project in status: ${this._status}`);
    }
    this._status = "Completed";
    this._updatedAt = new Date();
    this.addDomainEvent(PROJECT_COMPLETED, { projectId: this._projectId });
  }

  public cancel(ownerId: string) {
    this.verifyOwnership(ownerId);
    if (this._status !== "Active" && this._status !== "Paused") {
      throw new Error(`Cannot cancel project in status: ${this._status}`);
    }
    this._status = "Cancelled";
    this._updatedAt = new Date();
    this.addDomainEvent(PROJECT_CANCELLED, { projectId: this._projectId });
  }

  public archive(ownerId: string) {
    this.verifyOwnership(ownerId);
    if (this._status !== "Completed" && this._status !== "Cancelled") {
      throw new Error(`Cannot archive project in status: ${this._status}`);
    }
    this._status = "Archived";
    this._updatedAt = new Date();
    this.addDomainEvent(PROJECT_ARCHIVED, { projectId: this._projectId });
  }

  public updateDetails(ownerId: string, metadata: ProjectMetadata, visibility: ProjectVisibility) {
    this.verifyOwnership(ownerId);
    if (this._status !== "Draft" && this._status !== "Planned") {
      throw new Error(`Cannot modify project details in status: ${this._status}`);
    }
    this._metadata = metadata;
    this._visibility = visibility;
    this._updatedAt = new Date();
    this.addDomainEvent(PROJECT_UPDATED, { projectId: this._projectId });
  }

  private verifyOwnership(ownerId: string) {
    if (ownerId !== this._ownerId) {
      throw new Error("Ownership validation failed.");
    }
  }

  private validateInvariants() {
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

// Domain Persistence Contract
export interface ProjectPersistenceContract {
  checkUniqueReference(
    ownerId: string,
    projectReference: string,
    projectId?: string,
  ): Promise<boolean>;
}

// Project Aggregate Store
export interface ProjectAggregateStore {
  save(project: Project): Promise<void>;
  findById(projectId: string, ownerId: string): Promise<Project | null>;
  findByReference(projectReference: string, ownerId: string): Promise<Project | null>;
}

// Query-side Projection Contract
export interface ProjectQueryProjection {
  id: string;
  clientId: string;
  ownerId: string;
  projectReference: string;
  title: string;
  status: string;
}
