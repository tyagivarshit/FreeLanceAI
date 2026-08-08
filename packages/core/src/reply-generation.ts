// 1. Lifecycle State
export type ReplyGenerationLifecycle = "Draft" | "Requested" | "Generated" | "Archived";

// 2. Value Objects

export class GenerationReference {
  private readonly _value: string;

  constructor(value: string) {
    if (!value || value.trim() === "") {
      throw new Error("Generation reference value is required and cannot be empty.");
    }
    const cleanValue = value.trim();
    const referencePattern = /^[a-z0-9]+([.-][a-z0-9]+)*$/;
    if (!referencePattern.test(cleanValue)) {
      throw new Error(
        "Invalid generation reference format. Must be lower-case dot/hyphen-separated key.",
      );
    }
    this._value = cleanValue;
    Object.freeze(this);
  }

  get value(): string {
    return this._value;
  }

  public equals(other: GenerationReference): boolean {
    if (!other) {
      return false;
    }
    return this._value === other.value;
  }
}

export class GenerationConstraint {
  private readonly _type: string;
  private readonly _value: string;

  constructor(type: string, value: string) {
    if (!type || type.trim() === "") {
      throw new Error("Constraint type is required.");
    }
    if (!value || value.trim() === "") {
      throw new Error("Constraint value is required.");
    }

    const cleanType = type.trim().toLowerCase();
    const cleanValue = value.trim().toLowerCase();

    if (cleanType !== "length" && cleanType !== "format") {
      throw new Error(
        `Invalid constraint type: ${type}. Only 'length' and 'format' are supported.`,
      );
    }

    if (cleanType === "length") {
      const allowedLengths = ["short", "medium", "long"];
      if (!allowedLengths.includes(cleanValue)) {
        throw new Error(
          `Invalid length constraint value: ${value}. Must be 'short', 'medium', or 'long'.`,
        );
      }
    } else if (cleanType === "format") {
      const allowedFormats = ["plain-text", "markdown"];
      if (!allowedFormats.includes(cleanValue)) {
        throw new Error(
          `Invalid format constraint value: ${value}. Must be 'plain-text' or 'markdown'.`,
        );
      }
    }

    this._type = cleanType;
    this._value = cleanValue;
    Object.freeze(this);
  }

  get type(): string {
    return this._type;
  }

  get value(): string {
    return this._value;
  }

  public equals(other: GenerationConstraint): boolean {
    if (!other) {
      return false;
    }
    return this._type === other.type && this._value === other.value;
  }
}

export interface GenerationMetadataProperties {
  displayName: string;
  description: string;
}

export class GenerationMetadata {
  private readonly _displayName: string;
  private readonly _description: string;

  constructor(properties: GenerationMetadataProperties) {
    if (!properties || properties.displayName === undefined || properties.displayName === null) {
      throw new Error("Display Name is required.");
    }
    if (properties.description === undefined || properties.description === null) {
      throw new Error("Description is required.");
    }

    const cleanName = properties.displayName.trim();
    const cleanDesc = properties.description.trim();

    if (cleanName === "") {
      throw new Error("Display Name is required and cannot be empty.");
    }
    if (cleanDesc === "") {
      throw new Error("Description is required and cannot be empty.");
    }

    this._displayName = cleanName;
    this._description = cleanDesc;
    Object.freeze(this);
  }

  get displayName(): string {
    return this._displayName;
  }

  get description(): string {
    return this._description;
  }

  public equals(other: GenerationMetadata): boolean {
    if (!other) {
      return false;
    }
    return this._displayName === other.displayName && this._description === other.description;
  }
}

export class GenerationContent {
  private readonly _replyText: string;

  constructor(replyText: string) {
    if (replyText === undefined || replyText === null) {
      throw new Error("Reply text is required.");
    }
    const cleanText = replyText.trim();
    if (cleanText === "") {
      throw new Error("Reply text is required and cannot be empty.");
    }

    // HTML validation pattern: reject any text containing tags
    const htmlTagPattern = /<[^>]*>/;
    if (htmlTagPattern.test(cleanText)) {
      throw new Error("HTML tags are not allowed in generation content.");
    }

    this._replyText = cleanText;
    Object.freeze(this);
  }

  get replyText(): string {
    return this._replyText;
  }

  public equals(other: GenerationContent): boolean {
    if (!other) {
      return false;
    }
    return this._replyText === other.replyText;
  }
}

export interface GenerationRequestProperties {
  reference: GenerationReference;
  intent: string;
  constraints: GenerationConstraint[];
  metadata: GenerationMetadata;
}

export class GenerationRequest {
  private readonly _reference: GenerationReference;
  private readonly _intent: string;
  private readonly _constraints: GenerationConstraint[];
  private readonly _metadata: GenerationMetadata;

  constructor(properties: GenerationRequestProperties) {
    if (!properties.reference) {
      throw new Error("Reference is required for GenerationRequest.");
    }
    if (
      properties.intent === undefined ||
      properties.intent === null ||
      properties.intent.trim() === ""
    ) {
      throw new Error("Intent is required for GenerationRequest.");
    }
    if (!properties.constraints) {
      throw new Error("Constraints are required for GenerationRequest.");
    }
    if (!properties.metadata) {
      throw new Error("Metadata is required for GenerationRequest.");
    }

    this._reference = properties.reference;
    this._intent = properties.intent.trim();
    this._constraints = [...properties.constraints];
    this._metadata = properties.metadata;

    Object.freeze(this._constraints);
    Object.freeze(this);
  }

  get reference(): GenerationReference {
    return this._reference;
  }

  get intent(): string {
    return this._intent;
  }

  get constraints(): ReadonlyArray<GenerationConstraint> {
    return this._constraints;
  }

  get metadata(): GenerationMetadata {
    return this._metadata;
  }

  public equals(other: GenerationRequest): boolean {
    if (!other) {
      return false;
    }
    if (
      !this._reference.equals(other.reference) ||
      this._intent !== other.intent ||
      !this._metadata.equals(other.metadata)
    ) {
      return false;
    }
    if (this._constraints.length !== other.constraints.length) {
      return false;
    }
    for (let i = 0; i < this._constraints.length; i++) {
      if (!this._constraints[i]!.equals(other.constraints[i]!)) {
        return false;
      }
    }
    return true;
  }
}

export interface GenerationResultProperties {
  content: GenerationContent;
  generatedAt: Date;
}

export class GenerationResult {
  private readonly _content: GenerationContent;
  private readonly _generatedAt: Date;

  constructor(properties: GenerationResultProperties) {
    if (!properties.content) {
      throw new Error("Content is required for GenerationResult.");
    }
    if (!properties.generatedAt) {
      throw new Error("Generated date is required for GenerationResult.");
    }

    this._content = properties.content;
    this._generatedAt = new Date(properties.generatedAt.getTime());
    Object.freeze(this);
  }

  get content(): GenerationContent {
    return this._content;
  }

  get generatedAt(): Date {
    return new Date(this._generatedAt.getTime());
  }

  public equals(other: GenerationResult): boolean {
    if (!other) {
      return false;
    }
    return (
      this._content.equals(other.content) &&
      this._generatedAt.getTime() === other.generatedAt.getTime()
    );
  }
}

// 3. Snapshots

export interface ReplyGenerationSnapshotProperties {
  version: number;
  createdAt: Date;
  status: ReplyGenerationLifecycle;
  request: GenerationRequest;
  result: GenerationResult | undefined;
}

export class ReplyGenerationSnapshot {
  private readonly _version: number;
  private readonly _createdAt: Date;
  private readonly _status: ReplyGenerationLifecycle;
  private readonly _request: GenerationRequest;
  private readonly _result: GenerationResult | undefined;

  constructor(properties: ReplyGenerationSnapshotProperties) {
    if (properties.version <= 0) {
      throw new Error("Snapshot version must be greater than zero.");
    }
    if (!properties.createdAt) {
      throw new Error("Snapshot creation date is required.");
    }
    if (!properties.status) {
      throw new Error("Snapshot lifecycle state is required.");
    }
    if (!properties.request) {
      throw new Error("Snapshot request is required.");
    }

    this._version = properties.version;
    this._createdAt = new Date(properties.createdAt.getTime());
    this._status = properties.status;
    this._request = properties.request;
    this._result = properties.result;
    Object.freeze(this);
  }

  get version(): number {
    return this._version;
  }

  get createdAt(): Date {
    return new Date(this._createdAt.getTime());
  }

  get status(): ReplyGenerationLifecycle {
    return this._status;
  }

  get request(): GenerationRequest {
    return this._request;
  }

  get result(): GenerationResult | undefined {
    return this._result;
  }
}

// 4. Domain Events

export const REPLY_GENERATION_DRAFTED = "REPLY_GENERATION_DRAFTED";
export const REPLY_GENERATION_REQUESTED = "REPLY_GENERATION_REQUESTED";
export const REPLY_GENERATION_COMPLETED = "REPLY_GENERATION_COMPLETED";
export const REPLY_GENERATION_ARCHIVED = "REPLY_GENERATION_ARCHIVED";

export type ReplyGenerationDomainEventName =
  | typeof REPLY_GENERATION_DRAFTED
  | typeof REPLY_GENERATION_REQUESTED
  | typeof REPLY_GENERATION_COMPLETED
  | typeof REPLY_GENERATION_ARCHIVED;

export interface ReplyGenerationDomainEvent {
  readonly eventType: ReplyGenerationDomainEventName;
  readonly generationId: string;
  readonly reference: string;
  readonly ownerId: string;
  readonly clientId: string;
  readonly conversationId: string;
  readonly snapshotVersion: number;
}

export interface ReplyGenerationEventPublisher {
  publish(event: ReplyGenerationDomainEvent): Promise<void>;
}

// 5. Persistence Port Contracts

export interface ReplyGenerationQueryProjection {
  readonly id: string;
  readonly reference: string;
  readonly ownerId: string;
  readonly status: ReplyGenerationLifecycle;
  readonly latestVersion: number;
  readonly updatedAt: Date;
}

export interface ReplyGenerationPersistenceContract {
  checkUniqueReference(
    ownerId: string,
    reference: string,
    excludeGenerationId?: string,
  ): Promise<boolean>;
}

export interface ReplyGenerationAggregateStore {
  save(generation: ReplyGeneration): Promise<void>;
  findById(id: string, ownerId: string): Promise<ReplyGeneration | null>;
  findByReference(reference: string, ownerId: string): Promise<ReplyGeneration | null>;
}

// 6. Aggregate Root Properties

export interface ReplyGenerationProperties {
  id: string;
  reference: GenerationReference;
  ownerId: string;
  clientId: string;
  conversationId: string;
  status: ReplyGenerationLifecycle;
  request: GenerationRequest;
  result: GenerationResult | undefined;
  snapshots: ReplyGenerationSnapshot[];
  createdAt: Date;
  updatedAt: Date;
}

// 7. ReplyGeneration Aggregate Root

export class ReplyGeneration {
  private readonly _id: string;
  private readonly _reference: GenerationReference;
  private readonly _ownerId: string;
  private readonly _clientId: string;
  private readonly _conversationId: string;
  private _status: ReplyGenerationLifecycle;
  private readonly _request: GenerationRequest;
  private _result: GenerationResult | undefined;
  private readonly _snapshots: ReplyGenerationSnapshot[] = [];
  private readonly _createdAt: Date;
  private _updatedAt: Date;
  private _domainEvents: ReplyGenerationDomainEvent[] = [];

  constructor(properties: ReplyGenerationProperties) {
    if (!properties.id || properties.id.trim() === "") {
      throw new Error("Generation Identity is required.");
    }
    if (!properties.reference) {
      throw new Error("Generation Reference is required.");
    }
    if (!properties.ownerId || properties.ownerId.trim() === "") {
      throw new Error("Owner Reference is required.");
    }
    if (!properties.clientId || properties.clientId.trim() === "") {
      throw new Error("Client Reference is required.");
    }
    if (!properties.conversationId || properties.conversationId.trim() === "") {
      throw new Error("Conversation Reference is required.");
    }
    if (!properties.status) {
      throw new Error("Lifecycle status is required.");
    }
    if (!properties.request) {
      throw new Error("Generation Request is required.");
    }
    if (!properties.createdAt) {
      throw new Error("Creation Date is required.");
    }
    if (!properties.updatedAt) {
      throw new Error("Update Date is required.");
    }

    this._id = properties.id;
    this._reference = properties.reference;
    this._ownerId = properties.ownerId;
    this._clientId = properties.clientId;
    this._conversationId = properties.conversationId;
    this._status = properties.status;
    this._request = properties.request;
    this._result = properties.result;
    this._createdAt = new Date(properties.createdAt.getTime());
    this._updatedAt = new Date(properties.updatedAt.getTime());

    if (properties.snapshots && properties.snapshots.length > 0) {
      this._snapshots = [...properties.snapshots];
    }

    this.validateInvariants();
  }

  // Getters
  get id(): string {
    return this._id;
  }

  get reference(): GenerationReference {
    return this._reference;
  }

  get ownerId(): string {
    return this._ownerId;
  }

  get clientId(): string {
    return this._clientId;
  }

  get conversationId(): string {
    return this._conversationId;
  }

  get status(): ReplyGenerationLifecycle {
    return this._status;
  }

  get request(): GenerationRequest {
    return this._request;
  }

  get result(): GenerationResult | undefined {
    return this._result;
  }

  get snapshots(): ReadonlyArray<ReplyGenerationSnapshot> {
    return Object.freeze([...this._snapshots]);
  }

  get createdAt(): Date {
    return new Date(this._createdAt.getTime());
  }

  get updatedAt(): Date {
    return new Date(this._updatedAt.getTime());
  }

  get domainEvents(): ReadonlyArray<ReplyGenerationDomainEvent> {
    return Object.freeze([...this._domainEvents]);
  }

  public clearDomainEvents(): void {
    this._domainEvents = [];
  }

  private addDomainEvent(event: ReplyGenerationDomainEvent): void {
    this._domainEvents.push(Object.freeze(event));
  }

  private verifyOwnership(actorOwnerId: string): void {
    if (!actorOwnerId || actorOwnerId.trim() === "") {
      throw new Error("Ownership validation failed: unauthorized owner context.");
    }
    if (actorOwnerId !== this._ownerId) {
      throw new Error("Ownership validation failed: unauthorized owner context.");
    }
  }

  private validateInvariants(): void {
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

  private appendSnapshot(): void {
    const nextVersion = this._snapshots.length + 1;
    const newSnapshot = new ReplyGenerationSnapshot({
      version: nextVersion,
      createdAt: new Date(),
      status: this._status,
      request: this._request,
      result: this._result,
    });
    this._snapshots.push(newSnapshot);
  }

  // Factory Creation Method
  public static create(
    id: string,
    reference: GenerationReference,
    ownerId: string,
    clientId: string,
    conversationId: string,
    request: GenerationRequest,
  ): ReplyGeneration {
    const now = new Date();
    const generation = new ReplyGeneration({
      id,
      reference,
      ownerId,
      clientId,
      conversationId,
      status: "Draft",
      request,
      result: undefined,
      snapshots: [],
      createdAt: now,
      updatedAt: now,
    });

    generation.appendSnapshot();
    generation.addDomainEvent({
      eventType: REPLY_GENERATION_DRAFTED,
      generationId: generation.id,
      reference: generation.reference.value,
      ownerId: generation.ownerId,
      clientId: generation.clientId,
      conversationId: generation.conversationId,
      snapshotVersion: generation.snapshots.length,
    });

    return generation;
  }

  // Domain Transitions

  private transitionTo(nextStatus: ReplyGenerationLifecycle): void {
    if (this._status === "Archived") {
      throw new Error(`Invalid lifecycle transition from ARCHIVED to ${nextStatus.toUpperCase()}`);
    }

    if (nextStatus === "Requested") {
      if (this._status !== "Draft") {
        throw new Error(
          `Invalid lifecycle transition from ${this._status.toUpperCase()} to REQUESTED`,
        );
      }
    } else if (nextStatus === "Generated") {
      if (this._status !== "Requested") {
        throw new Error(
          `Invalid lifecycle transition from ${this._status.toUpperCase()} to GENERATED`,
        );
      }
    } else if (nextStatus === "Draft") {
      throw new Error(`Invalid lifecycle transition from ${this._status.toUpperCase()} to DRAFT`);
    }

    this._status = nextStatus;
    this._updatedAt = new Date();
    this.appendSnapshot();
  }

  public requestGeneration(actorOwnerId: string): void {
    this.verifyOwnership(actorOwnerId);
    this.transitionTo("Requested");

    this.addDomainEvent({
      eventType: REPLY_GENERATION_REQUESTED,
      generationId: this._id,
      reference: this._reference.value,
      ownerId: this._ownerId,
      clientId: this._clientId,
      conversationId: this._conversationId,
      snapshotVersion: this._snapshots.length,
    });
  }

  public completeGeneration(actorOwnerId: string, result: GenerationResult): void {
    this.verifyOwnership(actorOwnerId);
    if (!result) {
      throw new Error("GenerationResult is required for completeGeneration.");
    }

    // Verify sequence checks using transitionTo
    this.transitionTo("Generated");
    this._result = result;

    this.addDomainEvent({
      eventType: REPLY_GENERATION_COMPLETED,
      generationId: this._id,
      reference: this._reference.value,
      ownerId: this._ownerId,
      clientId: this._clientId,
      conversationId: this._conversationId,
      snapshotVersion: this._snapshots.length,
    });
  }

  public archive(actorOwnerId: string): void {
    this.verifyOwnership(actorOwnerId);
    if (this._status === "Archived") {
      throw new Error("Reply generation is already archived.");
    }
    this.transitionTo("Archived");

    this.addDomainEvent({
      eventType: REPLY_GENERATION_ARCHIVED,
      generationId: this._id,
      reference: this._reference.value,
      ownerId: this._ownerId,
      clientId: this._clientId,
      conversationId: this._conversationId,
      snapshotVersion: this._snapshots.length,
    });
  }
}
