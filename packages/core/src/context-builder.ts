// 1. Lifecycle State
export type ContextLifecycleState = "Draft" | "Validated" | "Published" | "Archived";

// 2. Value Objects
export interface ContextBlueprintProperties {
  blueprintId: string;
  orderingStrategy: string;
  assemblyRules: string[];
  sourceReferences: string[];
}

export class ContextBlueprint {
  private readonly _blueprintId: string;
  private readonly _orderingStrategy: string;
  private readonly _assemblyRules: string[];
  private readonly _sourceReferences: string[];

  constructor(properties: ContextBlueprintProperties) {
    if (!properties.blueprintId || properties.blueprintId.trim() === "") {
      throw new Error("Blueprint identity is required.");
    }
    if (!properties.orderingStrategy || properties.orderingStrategy.trim() === "") {
      throw new Error("Ordering strategy is required.");
    }
    if (!properties.assemblyRules) {
      throw new Error("Assembly rules are required.");
    }
    if (!properties.sourceReferences) {
      throw new Error("Source references are required.");
    }

    this._blueprintId = properties.blueprintId.trim();
    this._orderingStrategy = properties.orderingStrategy.trim();
    this._assemblyRules = [...properties.assemblyRules];
    this._sourceReferences = [...properties.sourceReferences];
  }

  get blueprintId(): string {
    return this._blueprintId;
  }

  get orderingStrategy(): string {
    return this._orderingStrategy;
  }

  get assemblyRules(): ReadonlyArray<string> {
    return this._assemblyRules;
  }

  get sourceReferences(): ReadonlyArray<string> {
    return this._sourceReferences;
  }

  public equals(other: ContextBlueprint): boolean {
    if (this._blueprintId !== other.blueprintId) {
      return false;
    }
    if (this._orderingStrategy !== other.orderingStrategy) {
      return false;
    }
    if (this._assemblyRules.length !== other.assemblyRules.length) {
      return false;
    }
    if (this._sourceReferences.length !== other.sourceReferences.length) {
      return false;
    }

    for (let i = 0; i < this._assemblyRules.length; i++) {
      if (this._assemblyRules[i] !== other.assemblyRules[i]) {
        return false;
      }
    }
    for (let i = 0; i < this._sourceReferences.length; i++) {
      if (this._sourceReferences[i] !== other.sourceReferences[i]) {
        return false;
      }
    }
    return true;
  }
}

export interface ContextMetadataProperties {
  displayName: string;
  description: string;
  purpose: string;
  versionSummary: string;
}

export class ContextMetadata {
  private readonly _displayName: string;
  private readonly _description: string;
  private readonly _purpose: string;
  private readonly _versionSummary: string;

  constructor(properties: ContextMetadataProperties) {
    if (!properties.displayName || properties.displayName.trim() === "") {
      throw new Error("Display Name is required.");
    }
    if (!properties.description || properties.description.trim() === "") {
      throw new Error("Description is required.");
    }
    if (!properties.purpose || properties.purpose.trim() === "") {
      throw new Error("Purpose is required.");
    }
    if (!properties.versionSummary || properties.versionSummary.trim() === "") {
      throw new Error("Version Summary is required.");
    }

    this._displayName = properties.displayName.trim();
    this._description = properties.description.trim();
    this._purpose = properties.purpose.trim();
    this._versionSummary = properties.versionSummary.trim();
  }

  get displayName(): string {
    return this._displayName;
  }

  get description(): string {
    return this._description;
  }

  get purpose(): string {
    return this._purpose;
  }

  get versionSummary(): string {
    return this._versionSummary;
  }

  public equals(other: ContextMetadata): boolean {
    return (
      this._displayName === other.displayName &&
      this._description === other.description &&
      this._purpose === other.purpose &&
      this._versionSummary === other.versionSummary
    );
  }
}

export interface ContextAssemblyRuleProperties {
  ruleName: string;
  assemblyOrder: number;
  isRequired: boolean;
}

export class ContextAssemblyRule {
  private readonly _ruleName: string;
  private readonly _assemblyOrder: number;
  private readonly _isRequired: boolean;

  constructor(properties: ContextAssemblyRuleProperties) {
    if (!properties.ruleName || properties.ruleName.trim() === "") {
      throw new Error("Rule name is required.");
    }
    if (properties.assemblyOrder < 0) {
      throw new Error("Assembly order must be non-negative.");
    }

    this._ruleName = properties.ruleName.trim();
    this._assemblyOrder = properties.assemblyOrder;
    this._isRequired = properties.isRequired;
  }

  get ruleName(): string {
    return this._ruleName;
  }

  get assemblyOrder(): number {
    return this._assemblyOrder;
  }

  get isRequired(): boolean {
    return this._isRequired;
  }

  public equals(other: ContextAssemblyRule): boolean {
    return (
      this._ruleName === other.ruleName &&
      this._assemblyOrder === other.assemblyOrder &&
      this._isRequired === other.isRequired
    );
  }
}

export type ContextSourceType = string;

export interface ContextSourceReferenceProperties {
  sourceType: ContextSourceType;
  sourceId: string;
}

export class ContextSourceReference {
  private readonly _sourceType: ContextSourceType;
  private readonly _sourceId: string;

  constructor(properties: ContextSourceReferenceProperties) {
    if (!properties.sourceType || properties.sourceType.trim() === "") {
      throw new Error("Source type is required.");
    }
    if (!properties.sourceId || properties.sourceId.trim() === "") {
      throw new Error("Source ID is required.");
    }

    this._sourceType = properties.sourceType.trim();
    this._sourceId = properties.sourceId.trim();
  }

  get sourceType(): ContextSourceType {
    return this._sourceType;
  }

  get sourceId(): string {
    return this._sourceId;
  }

  public equals(other: ContextSourceReference): boolean {
    return this._sourceType === other.sourceType && this._sourceId === other.sourceId;
  }
}

// 3. Domain Events
export const CONTEXT_REGISTERED = "CONTEXT_REGISTERED";
export const CONTEXT_VALIDATED = "CONTEXT_VALIDATED";
export const CONTEXT_PUBLISHED = "CONTEXT_PUBLISHED";
export const CONTEXT_ARCHIVED = "CONTEXT_ARCHIVED";

export type ContextDomainEventName =
  | typeof CONTEXT_REGISTERED
  | typeof CONTEXT_VALIDATED
  | typeof CONTEXT_PUBLISHED
  | typeof CONTEXT_ARCHIVED;

export interface ContextRegisteredEvent {
  readonly eventType: typeof CONTEXT_REGISTERED;
  readonly contextId: string;
  readonly reference: string;
  readonly ownerId: string;
}

export interface ContextValidatedEvent {
  readonly eventType: typeof CONTEXT_VALIDATED;
  readonly contextId: string;
  readonly reference: string;
  readonly ownerId: string;
}

export interface ContextPublishedEvent {
  readonly eventType: typeof CONTEXT_PUBLISHED;
  readonly contextId: string;
  readonly reference: string;
  readonly ownerId: string;
}

export interface ContextArchivedEvent {
  readonly eventType: typeof CONTEXT_ARCHIVED;
  readonly contextId: string;
  readonly reference: string;
  readonly ownerId: string;
}

export type ContextDomainEvent =
  | ContextRegisteredEvent
  | ContextValidatedEvent
  | ContextPublishedEvent
  | ContextArchivedEvent;

export interface ContextEventPublisher {
  publish(event: ContextDomainEvent): Promise<void>;
}

// 4. Query Projection Contract
export interface ContextQueryProjection {
  readonly id: string;
  readonly reference: string;
  readonly ownerId: string;
  readonly displayName: string;
  readonly status: ContextLifecycleState;
  readonly updatedAt: Date;
}

// 5. Persistence interfaces
export interface ContextPersistenceContract {
  checkUniqueReference(
    ownerId: string,
    reference: string,
    excludeContextId?: string,
  ): Promise<boolean>;
}

export interface ContextAggregateStore {
  save(context: Context): Promise<void>;
  findById(id: string, ownerId: string): Promise<Context | null>;
  findByReference(reference: string, ownerId: string): Promise<Context | null>;
}

// 6. Context Properties
export interface ContextProperties {
  id: string;
  reference: string;
  ownerId: string;
  blueprint: ContextBlueprint;
  metadata: ContextMetadata;
  assemblyRules: ContextAssemblyRule[];
  sourceReferences: ContextSourceReference[];
  status: ContextLifecycleState;
  createdAt: Date;
  updatedAt: Date;
}

// 7. Context Aggregate Root
export class Context {
  private readonly _id: string;
  private readonly _reference: string;
  private readonly _ownerId: string;
  private _blueprint: ContextBlueprint;
  private _metadata: ContextMetadata;
  private _assemblyRules: ContextAssemblyRule[] = [];
  private _sourceReferences: ContextSourceReference[] = [];
  private _status: ContextLifecycleState;
  private readonly _createdAt: Date;
  private _updatedAt: Date;
  private _domainEvents: ContextDomainEvent[] = [];

  constructor(properties: ContextProperties) {
    if (!properties.id || properties.id.trim() === "") {
      throw new Error("Context Identity is required.");
    }
    if (!properties.reference || properties.reference.trim() === "") {
      throw new Error("Context Reference is required.");
    }
    const referencePattern = /^[a-z0-9]+(\.[a-z0-9]+)*$/;
    if (!referencePattern.test(properties.reference)) {
      throw new Error("Invalid context reference format. Must be lower-case dot-separated key.");
    }
    if (!properties.ownerId || properties.ownerId.trim() === "") {
      throw new Error("Owner Reference is required.");
    }
    if (!properties.blueprint) {
      throw new Error("Context Blueprint is required.");
    }
    if (!properties.metadata) {
      throw new Error("Context Metadata is required.");
    }
    if (!properties.status) {
      throw new Error("Context Lifecycle State is required.");
    }

    this._id = properties.id;
    this._reference = properties.reference;
    this._ownerId = properties.ownerId;
    this._blueprint = properties.blueprint;
    this._metadata = properties.metadata;
    this._status = properties.status;
    this._createdAt = properties.createdAt;
    this._updatedAt = properties.updatedAt;

    if (properties.assemblyRules) {
      this._assemblyRules = [...properties.assemblyRules];
    }
    if (properties.sourceReferences) {
      this._sourceReferences = [...properties.sourceReferences];
    }

    this.validateInvariants();
  }

  // Getters
  get id(): string {
    return this._id;
  }

  get reference(): string {
    return this._reference;
  }

  get ownerId(): string {
    return this._ownerId;
  }

  get blueprint(): ContextBlueprint {
    return this._blueprint;
  }

  get metadata(): ContextMetadata {
    return this._metadata;
  }

  get assemblyRules(): ReadonlyArray<ContextAssemblyRule> {
    return [...this._assemblyRules];
  }

  get sourceReferences(): ReadonlyArray<ContextSourceReference> {
    return [...this._sourceReferences];
  }

  get status(): ContextLifecycleState {
    return this._status;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }

  get domainEvents(): ReadonlyArray<ContextDomainEvent> {
    return this._domainEvents;
  }

  public clearDomainEvents(): void {
    this._domainEvents = [];
  }

  private addDomainEvent(event: ContextDomainEvent): void {
    this._domainEvents.push(event);
  }

  private validateInvariants(): void {
    const referencePattern = /^[a-z0-9]+(\.[a-z0-9]+)*$/;
    if (!referencePattern.test(this._reference)) {
      throw new Error("Invalid context reference format. Must be lower-case dot-separated key.");
    }
  }

  private verifyOwnership(actorOwnerId: string): void {
    if (!actorOwnerId || actorOwnerId.trim() === "") {
      throw new Error("Missing owner identity in caller context.");
    }
    if (actorOwnerId !== this._ownerId) {
      throw new Error("Ownership validation failed: unauthorized owner context.");
    }
  }

  // Domain Factory
  public static create(
    id: string,
    reference: string,
    ownerId: string,
    blueprint: ContextBlueprint,
    metadata: ContextMetadata,
    assemblyRules: ContextAssemblyRule[],
    sourceReferences: ContextSourceReference[],
  ): Context {
    const now = new Date();
    const context = new Context({
      id,
      reference,
      ownerId,
      blueprint,
      metadata,
      assemblyRules,
      sourceReferences,
      status: "Draft",
      createdAt: now,
      updatedAt: now,
    });

    context.addDomainEvent({
      eventType: CONTEXT_REGISTERED,
      contextId: context.id,
      reference: context.reference,
      ownerId: context.ownerId,
    });

    return context;
  }

  /**
   * Performs an atomic replacement of the current draft specification.
   * This operation replaces the Blueprint, Metadata, Assembly Rules, and Source References
   * simultaneously, rather than permitting partial updates or incremental mutations.
   *
   * - Replaces all specification properties as a single unit of change.
   * - No partial updates or incremental field changes are allowed.
   * - No historical version of the draft is retained.
   *
   * @param actorOwnerId The identifier of the requesting owner.
   * @param blueprint The Context Blueprint specification representing the logical assembly.
   * @param metadata The Context Metadata.
   * @param assemblyRules The array of assembly rules.
   * @param sourceReferences The array of source references.
   * @throws Error if ownership validation fails or if the context status is not "Draft".
   */
  public updateDraft(
    actorOwnerId: string,
    blueprint: ContextBlueprint,
    metadata: ContextMetadata,
    assemblyRules: ContextAssemblyRule[],
    sourceReferences: ContextSourceReference[],
  ): void {
    this.verifyOwnership(actorOwnerId);
    if (this._status !== "Draft") {
      throw new Error(`Cannot update context in status: ${this._status}`);
    }

    this._blueprint = blueprint;
    this._metadata = metadata;
    this._assemblyRules = [...assemblyRules];
    this._sourceReferences = [...sourceReferences];
    this._updatedAt = new Date();
  }

  public validate(actorOwnerId: string): void {
    this.verifyOwnership(actorOwnerId);
    if (this._status !== "Draft") {
      throw new Error(`Cannot validate context when in status: ${this._status}`);
    }

    this._status = "Validated";
    this._updatedAt = new Date();

    this.addDomainEvent({
      eventType: CONTEXT_VALIDATED,
      contextId: this._id,
      reference: this._reference,
      ownerId: this._ownerId,
    });
  }

  public publish(actorOwnerId: string): void {
    this.verifyOwnership(actorOwnerId);
    if (this._status !== "Validated") {
      throw new Error(`Cannot publish context when in status: ${this._status}`);
    }

    this._status = "Published";
    this._updatedAt = new Date();

    this.addDomainEvent({
      eventType: CONTEXT_PUBLISHED,
      contextId: this._id,
      reference: this._reference,
      ownerId: this._ownerId,
    });
  }

  public archive(actorOwnerId: string): void {
    this.verifyOwnership(actorOwnerId);
    if (this._status === "Archived") {
      throw new Error("Context is already archived.");
    }

    this._status = "Archived";
    this._updatedAt = new Date();

    this.addDomainEvent({
      eventType: CONTEXT_ARCHIVED,
      contextId: this._id,
      reference: this._reference,
      ownerId: this._ownerId,
    });
  }
}
