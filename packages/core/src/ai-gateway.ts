// AI Request States
export type AiRequestState = "Received" | "Accepted" | "Orchestrating" | "Completed" | "Failed";

// Domain Event Names
export const AI_REQUEST_RECEIVED = "AI_REQUEST_RECEIVED";
export const AI_REQUEST_ACCEPTED = "AI_REQUEST_ACCEPTED";
export const AI_REQUEST_ORCHESTRATING = "AI_REQUEST_ORCHESTRATING";
export const AI_REQUEST_COMPLETED = "AI_REQUEST_COMPLETED";
export const AI_REQUEST_FAILED = "AI_REQUEST_FAILED";

export type AiRequestDomainEventName =
  | typeof AI_REQUEST_RECEIVED
  | typeof AI_REQUEST_ACCEPTED
  | typeof AI_REQUEST_ORCHESTRATING
  | typeof AI_REQUEST_COMPLETED
  | typeof AI_REQUEST_FAILED;

// Strongly Typed Immutable Domain Events
export interface AiRequestReceivedEvent {
  readonly eventType: typeof AI_REQUEST_RECEIVED;
  readonly requestId: string;
  readonly requestContextReference: string;
  readonly ownerId: string;
}

export interface AiRequestAcceptedEvent {
  readonly eventType: typeof AI_REQUEST_ACCEPTED;
  readonly requestId: string;
}

export interface AiRequestOrchestratingEvent {
  readonly eventType: typeof AI_REQUEST_ORCHESTRATING;
  readonly requestId: string;
}

export interface AiRequestCompletedEvent {
  readonly eventType: typeof AI_REQUEST_COMPLETED;
  readonly requestId: string;
}

export interface AiRequestFailedEvent {
  readonly eventType: typeof AI_REQUEST_FAILED;
  readonly requestId: string;
}

export type AiRequestDomainEvent =
  | AiRequestReceivedEvent
  | AiRequestAcceptedEvent
  | AiRequestOrchestratingEvent
  | AiRequestCompletedEvent
  | AiRequestFailedEvent;

export interface AiRequestEventPublisher {
  publish(event: AiRequestDomainEvent): Promise<void>;
}

// Request Metadata Value Object
export interface AiRequestMetadataProperties {
  correlationId: string;
  invocationMetadata: string;
  logicalClassification: string;
}

/**
 * AiRequestMetadata is deeply immutable.
 * Nested mutable structures are strictly prohibited.
 * Any update to metadata requires complete Value Object replacement;
 * in-place property mutations are never allowed.
 */
export class AiRequestMetadata {
  private readonly _correlationId: string;
  private readonly _invocationMetadata: string;
  private readonly _logicalClassification: string;

  constructor(properties: AiRequestMetadataProperties) {
    if (!properties.correlationId || properties.correlationId.trim() === "") {
      throw new Error("Correlation ID is required.");
    }
    this._correlationId = properties.correlationId;
    this._invocationMetadata = properties.invocationMetadata || "";
    this._logicalClassification = properties.logicalClassification || "";
  }

  get correlationId(): string {
    return this._correlationId;
  }

  get invocationMetadata(): string {
    return this._invocationMetadata;
  }

  get logicalClassification(): string {
    return this._logicalClassification;
  }

  public equals(other: AiRequestMetadata): boolean {
    return (
      this._correlationId === other.correlationId &&
      this._invocationMetadata === other.invocationMetadata &&
      this._logicalClassification === other.logicalClassification
    );
  }
}

// AI Request Properties
export interface AiRequestProperties {
  requestId: string;
  requestContextReference: string;
  ownerId: string;
  metadata: AiRequestMetadata;
  status: AiRequestState;
  createdAt: Date;
  updatedAt: Date;
}

// AI Request Aggregate Root
export class AiRequest {
  private readonly _requestId: string;
  private readonly _requestContextReference: string;
  private readonly _ownerId: string;
  private _metadata: AiRequestMetadata;
  private _status: AiRequestState;
  private readonly _createdAt: Date;
  private _updatedAt: Date;
  private _domainEvents: Array<AiRequestDomainEvent> = [];

  constructor(properties: AiRequestProperties) {
    if (!properties.requestId || properties.requestId.trim() === "") {
      throw new Error("Request ID is required.");
    }
    if (!properties.requestContextReference || properties.requestContextReference.trim() === "") {
      throw new Error("Request context reference is required.");
    }
    if (!properties.ownerId || properties.ownerId.trim() === "") {
      throw new Error("Owner ID reference is required.");
    }
    if (!properties.metadata) {
      throw new Error("Request metadata is required.");
    }

    this._requestId = properties.requestId;
    this._requestContextReference = properties.requestContextReference;
    this._ownerId = properties.ownerId;
    this._metadata = properties.metadata;
    this._status = properties.status;
    this._createdAt = properties.createdAt;
    this._updatedAt = properties.updatedAt;

    this.validateInvariants();
  }

  get requestId(): string {
    return this._requestId;
  }

  get requestContextReference(): string {
    return this._requestContextReference;
  }

  get ownerId(): string {
    return this._ownerId;
  }

  get metadata(): AiRequestMetadata {
    return this._metadata;
  }

  get status(): AiRequestState {
    return this._status;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }

  get domainEvents(): ReadonlyArray<AiRequestDomainEvent> {
    return this._domainEvents;
  }

  public clearDomainEvents() {
    this._domainEvents = [];
  }

  private addDomainEvent(event: AiRequestDomainEvent) {
    this._domainEvents.push(event);
  }

  // Factory Creation Method
  public static create(
    requestId: string,
    requestContextReference: string,
    ownerId: string,
    metadata: AiRequestMetadata,
  ): AiRequest {
    const now = new Date();
    const request = new AiRequest({
      requestId,
      requestContextReference,
      ownerId,
      metadata,
      status: "Received",
      createdAt: now,
      updatedAt: now,
    });

    request.addDomainEvent({
      eventType: AI_REQUEST_RECEIVED,
      requestId: request.requestId,
      requestContextReference: request.requestContextReference,
      ownerId: request.ownerId,
    });

    return request;
  }

  // Logical operations (transitions occur through valid Domain Operations)
  public accept(ownerId: string) {
    this.verifyOwnership(ownerId);
    if (this._status !== "Received") {
      throw new Error(`Cannot accept request in status: ${this._status}`);
    }
    this._status = "Accepted";
    this._updatedAt = new Date();
    this.addDomainEvent({
      eventType: AI_REQUEST_ACCEPTED,
      requestId: this._requestId,
    });
  }

  public orchestrate(ownerId: string) {
    this.verifyOwnership(ownerId);
    if (this._status !== "Accepted") {
      throw new Error(`Cannot orchestrate request in status: ${this._status}`);
    }
    this._status = "Orchestrating";
    this._updatedAt = new Date();
    this.addDomainEvent({
      eventType: AI_REQUEST_ORCHESTRATING,
      requestId: this._requestId,
    });
  }

  public complete(ownerId: string) {
    this.verifyOwnership(ownerId);
    if (this._status !== "Orchestrating") {
      throw new Error(`Cannot complete request in status: ${this._status}`);
    }
    this._status = "Completed";
    this._updatedAt = new Date();
    this.addDomainEvent({
      eventType: AI_REQUEST_COMPLETED,
      requestId: this._requestId,
    });
  }

  public fail(ownerId: string) {
    this.verifyOwnership(ownerId);
    if (this._status === "Completed" || this._status === "Failed") {
      throw new Error(`Cannot fail request in status: ${this._status}`);
    }
    this._status = "Failed";
    this._updatedAt = new Date();
    this.addDomainEvent({
      eventType: AI_REQUEST_FAILED,
      requestId: this._requestId,
    });
  }

  public updateMetadata(ownerId: string, metadata: AiRequestMetadata) {
    this.verifyOwnership(ownerId);
    if (this._status === "Completed" || this._status === "Failed") {
      throw new Error("Cannot update metadata on completed or failed request.");
    }
    this._metadata = metadata;
    this._updatedAt = new Date();
  }

  private verifyOwnership(ownerId: string) {
    if (ownerId !== this._ownerId) {
      throw new Error("Ownership validation failed.");
    }
  }

  private validateInvariants() {
    if (!this._requestId || this._requestId.trim() === "") {
      throw new Error("Request ID is required.");
    }
    if (!this._requestContextReference || this._requestContextReference.trim() === "") {
      throw new Error("Request context reference is required.");
    }
    if (!this._ownerId || this._ownerId.trim() === "") {
      throw new Error("Owner ID reference is required.");
    }
  }
}

// Domain Persistence Contract
export interface AiRequestPersistenceContract {
  checkUniqueReference(
    ownerId: string,
    requestContextReference: string,
    requestId?: string,
  ): Promise<boolean>;
}

// AI Request Aggregate Store
export interface AiRequestAggregateStore {
  save(request: AiRequest): Promise<void>;
  findById(requestId: string, ownerId: string): Promise<AiRequest | null>;
  findByReference(requestContextReference: string, ownerId: string): Promise<AiRequest | null>;
}

// Query-side Projection Contract
export interface AiRequestQueryProjection {
  id: string;
  requestContextReference: string;
  ownerId: string;
  correlationId: string;
  status: AiRequestState;
}
