// 1. Lifecycle State
export type PromptBuilderLifecycleState =
  | "Draft"
  | "Composed"
  | "Validated"
  | "Published"
  | "Archived";

// 2. Value Objects

/**
 * Encapsulates validation and representation of the dots-separated, lower-case Prompt Composition Reference.
 *
 * This value object is fully immutable.
 */
export class PromptCompositionReference {
  private readonly _value: string;

  constructor(value: string) {
    if (!value || value.trim() === "") {
      throw new Error("Prompt Composition Reference is required.");
    }
    const referencePattern = /^[a-z0-9]+(\.[a-z0-9]+)*$/;
    if (!referencePattern.test(value)) {
      throw new Error(
        "Invalid prompt composition reference format. Must be lower-case dot-separated key.",
      );
    }
    this._value = value.trim();
  }

  get value(): string {
    return this._value;
  }

  public equals(other: PromptCompositionReference): boolean {
    return this._value === other.value;
  }
}

/**
 * Represents a reference to a Prompt Definition.
 *
 * This value object is fully immutable.
 */
export class PromptDefinitionReference {
  private readonly _value: string;

  constructor(value: string) {
    if (!value || value.trim() === "") {
      throw new Error("Prompt definition reference is required.");
    }
    this._value = value.trim();
  }

  get value(): string {
    return this._value;
  }

  public equals(other: PromptDefinitionReference): boolean {
    return this._value === other.value;
  }
}

/**
 * Represents a reference to a Context Specification.
 *
 * This value object is fully immutable.
 */
export class ContextSpecificationReference {
  private readonly _value: string;

  constructor(value: string) {
    if (!value || value.trim() === "") {
      throw new Error("Context specification reference is required.");
    }
    this._value = value.trim();
  }

  get value(): string {
    return this._value;
  }

  public equals(other: ContextSpecificationReference): boolean {
    return this._value === other.value;
  }
}

/**
 * Represents a reference to a Memory.
 *
 * This value object is fully immutable.
 */
export class MemoryReference {
  private readonly _value: string;

  constructor(value: string) {
    if (!value || value.trim() === "") {
      throw new Error("Memory reference is required.");
    }
    this._value = value.trim();
  }

  get value(): string {
    return this._value;
  }

  public equals(other: MemoryReference): boolean {
    return this._value === other.value;
  }
}

/**
 * Represents a reference to an Embedding.
 *
 * This value object is fully immutable.
 */
export class EmbeddingReference {
  private readonly _value: string;

  constructor(value: string) {
    if (!value || value.trim() === "") {
      throw new Error("Embedding reference is required.");
    }
    this._value = value.trim();
  }

  get value(): string {
    return this._value;
  }

  public equals(other: EmbeddingReference): boolean {
    return this._value === other.value;
  }
}

/**
 * Represents a reference to a Composition Strategy configuration.
 *
 * This value object is fully immutable.
 */
export class CompositionStrategyReference {
  private readonly _value: string;

  constructor(value: string) {
    if (!value || value.trim() === "") {
      throw new Error("Composition strategy reference is required.");
    }
    this._value = value.trim();
  }

  get value(): string {
    return this._value;
  }

  public equals(other: CompositionStrategyReference): boolean {
    return this._value === other.value;
  }
}

export interface PromptCompositionProperties {
  promptDefinitionReference: PromptDefinitionReference;
  contextSpecificationReference: ContextSpecificationReference;
  memoryReference: MemoryReference;
  embeddingReference: EmbeddingReference;
  compositionStrategyReference: CompositionStrategyReference;
}

/**
 * Represents the canonical composition specification of references.
 *
 * This value object is fully immutable.
 */
export class PromptComposition {
  private readonly _promptDefinitionReference: PromptDefinitionReference;
  private readonly _contextSpecificationReference: ContextSpecificationReference;
  private readonly _memoryReference: MemoryReference;
  private readonly _embeddingReference: EmbeddingReference;
  private readonly _compositionStrategyReference: CompositionStrategyReference;

  constructor(properties: PromptCompositionProperties) {
    if (!properties.promptDefinitionReference) {
      throw new Error("Prompt definition reference is required.");
    }
    if (!properties.contextSpecificationReference) {
      throw new Error("Context specification reference is required.");
    }
    if (!properties.memoryReference) {
      throw new Error("Memory reference is required.");
    }
    if (!properties.embeddingReference) {
      throw new Error("Embedding reference is required.");
    }
    if (!properties.compositionStrategyReference) {
      throw new Error("Composition strategy reference is required.");
    }

    this._promptDefinitionReference = properties.promptDefinitionReference;
    this._contextSpecificationReference = properties.contextSpecificationReference;
    this._memoryReference = properties.memoryReference;
    this._embeddingReference = properties.embeddingReference;
    this._compositionStrategyReference = properties.compositionStrategyReference;
  }

  get promptDefinitionReference(): PromptDefinitionReference {
    return this._promptDefinitionReference;
  }

  get contextSpecificationReference(): ContextSpecificationReference {
    return this._contextSpecificationReference;
  }

  get memoryReference(): MemoryReference {
    return this._memoryReference;
  }

  get embeddingReference(): EmbeddingReference {
    return this._embeddingReference;
  }

  get compositionStrategyReference(): CompositionStrategyReference {
    return this._compositionStrategyReference;
  }

  public equals(other: PromptComposition): boolean {
    return (
      this._promptDefinitionReference.equals(other.promptDefinitionReference) &&
      this._contextSpecificationReference.equals(other.contextSpecificationReference) &&
      this._memoryReference.equals(other.memoryReference) &&
      this._embeddingReference.equals(other.embeddingReference) &&
      this._compositionStrategyReference.equals(other.compositionStrategyReference)
    );
  }
}

export interface CompositionMetadataProperties {
  displayName: string;
  description: string;
  purpose: string;
  compositionSummary: string;
}

export class CompositionMetadata {
  private readonly _displayName: string;
  private readonly _description: string;
  private readonly _purpose: string;
  private readonly _compositionSummary: string;

  constructor(properties: CompositionMetadataProperties) {
    if (!properties.displayName || properties.displayName.trim() === "") {
      throw new Error("Display Name is required.");
    }
    if (!properties.description || properties.description.trim() === "") {
      throw new Error("Description is required.");
    }
    if (!properties.purpose || properties.purpose.trim() === "") {
      throw new Error("Purpose is required.");
    }
    if (!properties.compositionSummary || properties.compositionSummary.trim() === "") {
      throw new Error("Composition summary is required.");
    }

    this._displayName = properties.displayName.trim();
    this._description = properties.description.trim();
    this._purpose = properties.purpose.trim();
    this._compositionSummary = properties.compositionSummary.trim();
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

  get compositionSummary(): string {
    return this._compositionSummary;
  }

  public equals(other: CompositionMetadata): boolean {
    return (
      this._displayName === other.displayName &&
      this._description === other.description &&
      this._purpose === other.purpose &&
      this._compositionSummary === other.compositionSummary
    );
  }
}

export interface CompositionStrategyProperties {
  assemblyOrder: number;
  compositionRules: string[];
  referenceInclusionRules: string[];
}

/**
 * Represents the logical composition behavior strategy.
 *
 * Immutability and Replacement Rules:
 * - This value object is fully immutable. Once initialized, its parameters cannot be altered.
 * - This strategy becomes strictly immutable after aggregate creation.
 * - Strategy replacement or modification is intentionally prohibited throughout the PromptBuilder lifecycle.
 */
export class CompositionStrategy {
  private readonly _assemblyOrder: number;
  private readonly _compositionRules: string[];
  private readonly _referenceInclusionRules: string[];

  constructor(properties: CompositionStrategyProperties) {
    if (properties.assemblyOrder <= 0) {
      throw new Error("Assembly order must be greater than zero.");
    }
    if (!properties.compositionRules || properties.compositionRules.length === 0) {
      throw new Error("Composition rules must not be empty.");
    }
    if (!properties.referenceInclusionRules || properties.referenceInclusionRules.length === 0) {
      throw new Error("Reference inclusion rules must not be empty.");
    }

    this._assemblyOrder = properties.assemblyOrder;
    this._compositionRules = [...properties.compositionRules];
    this._referenceInclusionRules = [...properties.referenceInclusionRules];
  }

  get assemblyOrder(): number {
    return this._assemblyOrder;
  }

  get compositionRules(): ReadonlyArray<string> {
    return Object.freeze([...this._compositionRules]);
  }

  get referenceInclusionRules(): ReadonlyArray<string> {
    return Object.freeze([...this._referenceInclusionRules]);
  }

  public equals(other: CompositionStrategy): boolean {
    if (this._assemblyOrder !== other.assemblyOrder) {
      return false;
    }
    if (this._compositionRules.length !== other.compositionRules.length) {
      return false;
    }
    if (this._referenceInclusionRules.length !== other.referenceInclusionRules.length) {
      return false;
    }

    for (let i = 0; i < this._compositionRules.length; i++) {
      if (this._compositionRules[i] !== other.compositionRules[i]) {
        return false;
      }
    }
    for (let i = 0; i < this._referenceInclusionRules.length; i++) {
      if (this._referenceInclusionRules[i] !== other.referenceInclusionRules[i]) {
        return false;
      }
    }
    return true;
  }
}

export interface CompositionFingerprintProperties {
  fingerprintIdentifier: string;
  fingerprintStrategyReference: string;
}

export class CompositionFingerprint {
  private readonly _fingerprintIdentifier: string;
  private readonly _fingerprintStrategyReference: string;

  constructor(properties: CompositionFingerprintProperties) {
    if (!properties.fingerprintIdentifier || properties.fingerprintIdentifier.trim() === "") {
      throw new Error("Fingerprint identifier is required.");
    }
    if (
      !properties.fingerprintStrategyReference ||
      properties.fingerprintStrategyReference.trim() === ""
    ) {
      throw new Error("Fingerprint strategy reference is required.");
    }

    this._fingerprintIdentifier = properties.fingerprintIdentifier.trim();
    this._fingerprintStrategyReference = properties.fingerprintStrategyReference.trim();
  }

  get fingerprintIdentifier(): string {
    return this._fingerprintIdentifier;
  }

  get fingerprintStrategyReference(): string {
    return this._fingerprintStrategyReference;
  }

  public equals(other: CompositionFingerprint): boolean {
    return (
      this._fingerprintIdentifier === other.fingerprintIdentifier &&
      this._fingerprintStrategyReference === other.fingerprintStrategyReference
    );
  }
}

export interface CompositionSnapshotProperties {
  snapshotId: string;
  builderReferenceSnapshot: PromptCompositionReference;
  promptCompositionSnapshot: PromptComposition;
  metadataSnapshot: CompositionMetadata;
  strategySnapshot: CompositionStrategy;
  fingerprintSnapshot: CompositionFingerprint;
  lifecycleSnapshot: PromptBuilderLifecycleState;
  capturedAt: Date;
}

export class CompositionSnapshot {
  private readonly _snapshotId: string;
  private readonly _builderReferenceSnapshot: PromptCompositionReference;
  private readonly _promptCompositionSnapshot: PromptComposition;
  private readonly _metadataSnapshot: CompositionMetadata;
  private readonly _strategySnapshot: CompositionStrategy;
  private readonly _fingerprintSnapshot: CompositionFingerprint;
  private readonly _lifecycleSnapshot: PromptBuilderLifecycleState;
  private readonly _capturedAt: Date;

  constructor(properties: CompositionSnapshotProperties) {
    if (!properties.snapshotId || properties.snapshotId.trim() === "") {
      throw new Error("Snapshot ID is required.");
    }
    if (!properties.builderReferenceSnapshot) {
      throw new Error("Builder reference snapshot is required.");
    }
    if (!properties.promptCompositionSnapshot) {
      throw new Error("Prompt composition snapshot is required.");
    }
    if (!properties.metadataSnapshot) {
      throw new Error("Metadata snapshot is required.");
    }
    if (!properties.strategySnapshot) {
      throw new Error("Strategy snapshot is required.");
    }
    if (!properties.fingerprintSnapshot) {
      throw new Error("Fingerprint snapshot is required.");
    }
    if (!properties.lifecycleSnapshot) {
      throw new Error("Lifecycle snapshot is required.");
    }
    if (!properties.capturedAt) {
      throw new Error("Captured date is required.");
    }

    this._snapshotId = properties.snapshotId.trim();
    this._builderReferenceSnapshot = properties.builderReferenceSnapshot;
    this._promptCompositionSnapshot = properties.promptCompositionSnapshot;
    this._metadataSnapshot = properties.metadataSnapshot;
    this._strategySnapshot = properties.strategySnapshot;
    this._fingerprintSnapshot = properties.fingerprintSnapshot;
    this._lifecycleSnapshot = properties.lifecycleSnapshot;
    this._capturedAt = properties.capturedAt;
  }

  get snapshotId(): string {
    return this._snapshotId;
  }

  get builderReferenceSnapshot(): PromptCompositionReference {
    return this._builderReferenceSnapshot;
  }

  get promptCompositionSnapshot(): PromptComposition {
    return this._promptCompositionSnapshot;
  }

  get metadataSnapshot(): CompositionMetadata {
    return this._metadataSnapshot;
  }

  get strategySnapshot(): CompositionStrategy {
    return this._strategySnapshot;
  }

  get fingerprintSnapshot(): CompositionFingerprint {
    return this._fingerprintSnapshot;
  }

  get lifecycleSnapshot(): PromptBuilderLifecycleState {
    return this._lifecycleSnapshot;
  }

  get capturedAt(): Date {
    return this._capturedAt;
  }
}

// 3. Domain Events
export const PROMPT_COMPOSITION_REGISTERED = "PROMPT_COMPOSITION_REGISTERED";
export const PROMPT_COMPOSED = "PROMPT_COMPOSED";
export const PROMPT_COMPOSITION_VALIDATED = "PROMPT_COMPOSITION_VALIDATED";
export const PROMPT_COMPOSITION_PUBLISHED = "PROMPT_COMPOSITION_PUBLISHED";
export const PROMPT_COMPOSITION_ARCHIVED = "PROMPT_COMPOSITION_ARCHIVED";

export type PromptBuilderDomainEventName =
  | typeof PROMPT_COMPOSITION_REGISTERED
  | typeof PROMPT_COMPOSED
  | typeof PROMPT_COMPOSITION_VALIDATED
  | typeof PROMPT_COMPOSITION_PUBLISHED
  | typeof PROMPT_COMPOSITION_ARCHIVED;

export interface PromptCompositionRegisteredEvent {
  readonly eventType: typeof PROMPT_COMPOSITION_REGISTERED;
  readonly builderId: string;
  readonly reference: string;
  readonly snapshotId: string;
  readonly ownerId: string;
}

export interface PromptComposedEvent {
  readonly eventType: typeof PROMPT_COMPOSED;
  readonly builderId: string;
  readonly reference: string;
  readonly snapshotId: string;
  readonly ownerId: string;
}

export interface PromptCompositionValidatedEvent {
  readonly eventType: typeof PROMPT_COMPOSITION_VALIDATED;
  readonly builderId: string;
  readonly reference: string;
  readonly snapshotId: string;
  readonly ownerId: string;
}

export interface PromptCompositionPublishedEvent {
  readonly eventType: typeof PROMPT_COMPOSITION_PUBLISHED;
  readonly builderId: string;
  readonly reference: string;
  readonly snapshotId: string;
  readonly ownerId: string;
}

export interface PromptCompositionArchivedEvent {
  readonly eventType: typeof PROMPT_COMPOSITION_ARCHIVED;
  readonly builderId: string;
  readonly reference: string;
  readonly snapshotId: string;
  readonly ownerId: string;
}

export type PromptBuilderDomainEvent =
  | PromptCompositionRegisteredEvent
  | PromptComposedEvent
  | PromptCompositionValidatedEvent
  | PromptCompositionPublishedEvent
  | PromptCompositionArchivedEvent;

export interface PromptBuilderEventPublisher {
  publish(event: PromptBuilderDomainEvent): Promise<void>;
}

// 4. Query-Side Projection
export interface PromptBuilderQueryProjection {
  readonly id: string;
  readonly reference: string;
  readonly ownerId: string;
  readonly displayName: string;
  readonly status: PromptBuilderLifecycleState;
  readonly updatedAt: Date;
}

// 5. Persistence Interfaces
export interface PromptBuilderPersistenceContract {
  checkUniqueReference(
    ownerId: string,
    reference: string,
    excludeBuilderId?: string,
  ): Promise<boolean>;
}

export interface PromptBuilderAggregateStore {
  save(builder: PromptBuilder): Promise<void>;
  findById(id: string, ownerId: string): Promise<PromptBuilder | null>;
  findByReference(reference: string, ownerId: string): Promise<PromptBuilder | null>;
}

// 6. PromptBuilder Properties
export interface PromptBuilderProperties {
  id: string;
  reference: PromptCompositionReference;
  ownerId: string;
  promptComposition: PromptComposition;
  metadata: CompositionMetadata;
  strategy: CompositionStrategy;
  snapshots: CompositionSnapshot[];
  status: PromptBuilderLifecycleState;
  createdAt: Date;
  updatedAt: Date;
}

// 7. PromptBuilder Aggregate Root
export class PromptBuilder {
  private readonly _id: string;
  private readonly _reference: PromptCompositionReference;
  private readonly _ownerId: string;
  private readonly _promptComposition: PromptComposition;
  private _metadata: CompositionMetadata;
  private readonly _strategy: CompositionStrategy;
  private _snapshots: CompositionSnapshot[] = [];
  private _status: PromptBuilderLifecycleState;
  private readonly _createdAt: Date;
  private _updatedAt: Date;
  private _domainEvents: PromptBuilderDomainEvent[] = [];

  constructor(properties: PromptBuilderProperties) {
    if (!properties.id || properties.id.trim() === "") {
      throw new Error("Builder Identity is required.");
    }
    if (!properties.reference) {
      throw new Error("Builder Reference is required.");
    }
    if (!properties.ownerId || properties.ownerId.trim() === "") {
      throw new Error("Owner Reference is required.");
    }
    if (!properties.promptComposition) {
      throw new Error("Prompt Composition is required.");
    }
    if (!properties.metadata) {
      throw new Error("Composition Metadata is required.");
    }
    if (!properties.strategy) {
      throw new Error("Composition Strategy is required.");
    }
    if (!properties.snapshots || properties.snapshots.length === 0) {
      throw new Error("Composition Snapshot history must not be empty.");
    }
    if (!properties.status) {
      throw new Error("Prompt Builder Lifecycle State is required.");
    }

    this._id = properties.id;
    this._reference = properties.reference;
    this._ownerId = properties.ownerId;
    this._promptComposition = properties.promptComposition;
    this._metadata = properties.metadata;
    this._strategy = properties.strategy;
    this._status = properties.status;
    this._createdAt = properties.createdAt;
    this._updatedAt = properties.updatedAt;

    this._snapshots = [...properties.snapshots];
  }

  // Getters
  get id(): string {
    return this._id;
  }

  get reference(): string {
    return this._reference.value;
  }

  get ownerId(): string {
    return this._ownerId;
  }

  get promptComposition(): PromptComposition {
    return this._promptComposition;
  }

  get metadata(): CompositionMetadata {
    return this._metadata;
  }

  /**
   * The CompositionStrategy behavior configuration.
   *
   * Strategy Immutability and Replacement Rules:
   * - Once the aggregate is instantiated, the strategy is fully immutable.
   * - Replacing or updating the strategy config is intentionally prohibited.
   */
  get strategy(): CompositionStrategy {
    return this._strategy;
  }

  get snapshots(): ReadonlyArray<CompositionSnapshot> {
    return Object.freeze([...this._snapshots]);
  }

  get status(): PromptBuilderLifecycleState {
    return this._status;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }

  get domainEvents(): ReadonlyArray<PromptBuilderDomainEvent> {
    return this._domainEvents;
  }

  /**
   * Dedicated helper abstraction to retrieve the latest snapshot from history.
   */
  get latestSnapshot(): CompositionSnapshot {
    if (this._snapshots.length === 0) {
      throw new Error("Invalid aggregate state: snapshots history is empty.");
    }
    return this._snapshots[this._snapshots.length - 1]!;
  }

  public clearDomainEvents(): void {
    this._domainEvents = [];
  }

  private addDomainEvent(event: PromptBuilderDomainEvent): void {
    this._domainEvents.push(event);
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
    referenceValue: string,
    ownerId: string,
    promptComposition: PromptComposition,
    metadata: CompositionMetadata,
    strategy: CompositionStrategy,
    initialSnapshotId: string,
    initialFingerprint: CompositionFingerprint,
  ): PromptBuilder {
    const reference = new PromptCompositionReference(referenceValue);
    const now = new Date();
    const initialSnapshot = new CompositionSnapshot({
      snapshotId: initialSnapshotId,
      builderReferenceSnapshot: reference,
      promptCompositionSnapshot: promptComposition,
      metadataSnapshot: metadata,
      strategySnapshot: strategy,
      fingerprintSnapshot: initialFingerprint,
      lifecycleSnapshot: "Draft",
      capturedAt: now,
    });

    const builder = new PromptBuilder({
      id,
      reference,
      ownerId,
      promptComposition,
      metadata,
      strategy,
      snapshots: [initialSnapshot],
      status: "Draft",
      createdAt: now,
      updatedAt: now,
    });

    builder.addDomainEvent({
      eventType: PROMPT_COMPOSITION_REGISTERED,
      builderId: builder.id,
      reference: builder.reference,
      snapshotId: initialSnapshotId,
      ownerId: builder.ownerId,
    });

    return builder;
  }

  // Domain Operations
  /**
   * Replaces the metadata of the aggregate.
   *
   * Mutation Rules:
   * - Must verify caller ownership.
   * - Operation is restricted strictly to the "Draft" lifecycle state.
   */
  public replaceMetadata(actorOwnerId: string, metadata: CompositionMetadata): void {
    this.verifyOwnership(actorOwnerId);
    if (this._status !== "Draft") {
      throw new Error("Cannot replace metadata when in status: " + this._status);
    }
    this._metadata = metadata;
    this._updatedAt = new Date();
  }

  /**
   * Generates a new snapshot representational fingerprint.
   *
   * Mutation Rules:
   * - Must verify caller ownership.
   * - Operation is restricted strictly to the "Draft" or "Composed" lifecycle states.
   */
  public compose(
    actorOwnerId: string,
    newSnapshotId: string,
    newFingerprint: CompositionFingerprint,
  ): void {
    this.verifyOwnership(actorOwnerId);
    if (this._status !== "Draft" && this._status !== "Composed") {
      throw new Error("Cannot compose prompt when in status: " + this._status);
    }

    this._status = "Composed";
    this._updatedAt = new Date();

    const newSnapshot = new CompositionSnapshot({
      snapshotId: newSnapshotId,
      builderReferenceSnapshot: this._reference,
      promptCompositionSnapshot: this._promptComposition,
      metadataSnapshot: this._metadata,
      strategySnapshot: this._strategy,
      fingerprintSnapshot: newFingerprint,
      lifecycleSnapshot: "Composed",
      capturedAt: new Date(),
    });

    this._snapshots.push(newSnapshot);

    this.addDomainEvent({
      eventType: PROMPT_COMPOSED,
      builderId: this._id,
      reference: this._reference.value,
      snapshotId: newSnapshotId,
      ownerId: this._ownerId,
    });
  }

  public validate(actorOwnerId: string): void {
    this.verifyOwnership(actorOwnerId);
    if (this._status !== "Composed") {
      throw new Error("Cannot validate prompt builder when in status: " + this._status);
    }

    this._status = "Validated";
    this._updatedAt = new Date();

    this.addDomainEvent({
      eventType: PROMPT_COMPOSITION_VALIDATED,
      builderId: this._id,
      reference: this._reference.value,
      snapshotId: this.latestSnapshot.snapshotId,
      ownerId: this._ownerId,
    });
  }

  public publish(actorOwnerId: string): void {
    this.verifyOwnership(actorOwnerId);
    if (this._status !== "Validated") {
      throw new Error("Cannot publish prompt builder when in status: " + this._status);
    }

    this._status = "Published";
    this._updatedAt = new Date();

    this.addDomainEvent({
      eventType: PROMPT_COMPOSITION_PUBLISHED,
      builderId: this._id,
      reference: this._reference.value,
      snapshotId: this.latestSnapshot.snapshotId,
      ownerId: this._ownerId,
    });
  }

  public archive(actorOwnerId: string): void {
    this.verifyOwnership(actorOwnerId);
    if (this._status === "Archived") {
      throw new Error("Prompt builder is already archived.");
    }

    this._status = "Archived";
    this._updatedAt = new Date();

    this.addDomainEvent({
      eventType: PROMPT_COMPOSITION_ARCHIVED,
      builderId: this._id,
      reference: this._reference.value,
      snapshotId: this.latestSnapshot.snapshotId,
      ownerId: this._ownerId,
    });
  }
}
