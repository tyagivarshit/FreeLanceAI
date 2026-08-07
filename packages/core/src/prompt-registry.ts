// 1. Lifecycle State
export type PromptLifecycleState = "Draft" | "Published" | "Deprecated" | "Archived";

// 2. Value Objects
export class LogicalVisibilityClassification {
  private readonly _value: string;

  constructor(value: string) {
    if (!value || value.trim() === "") {
      throw new Error("Visibility classification value cannot be empty.");
    }
    this._value = value.trim();
  }

  get value(): string {
    return this._value;
  }

  public equals(other: LogicalVisibilityClassification): boolean {
    return this._value.toLowerCase() === other.value.toLowerCase();
  }
}

export interface PromptDefinitionProperties {
  promptTextSpecification: string;
}

export class PromptDefinition {
  private readonly _promptTextSpecification: string;

  constructor(properties: PromptDefinitionProperties) {
    if (
      properties.promptTextSpecification === undefined ||
      properties.promptTextSpecification === null
    ) {
      throw new Error("Prompt text specification is required.");
    }
    this._promptTextSpecification = properties.promptTextSpecification;
  }

  get promptTextSpecification(): string {
    return this._promptTextSpecification;
  }

  public equals(other: PromptDefinition): boolean {
    return this._promptTextSpecification === other.promptTextSpecification;
  }
}

export interface PromptMetadataProperties {
  displayName: string;
  description: string;
  purpose: string;
  classification: string;
  versionSummary: string;
}

export class PromptMetadata {
  private readonly _displayName: string;
  private readonly _description: string;
  private readonly _purpose: string;
  private readonly _classification: string;
  private readonly _versionSummary: string;

  constructor(properties: PromptMetadataProperties) {
    if (!properties.displayName || properties.displayName.trim() === "") {
      throw new Error("Display Name is required.");
    }
    if (!properties.description || properties.description.trim() === "") {
      throw new Error("Description is required.");
    }
    if (!properties.purpose || properties.purpose.trim() === "") {
      throw new Error("Purpose is required.");
    }
    if (!properties.classification || properties.classification.trim() === "") {
      throw new Error("Classification is required.");
    }
    if (!properties.versionSummary || properties.versionSummary.trim() === "") {
      throw new Error("Version Summary is required.");
    }

    this._displayName = properties.displayName.trim();
    this._description = properties.description.trim();
    this._purpose = properties.purpose.trim();
    this._classification = properties.classification.trim();
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

  get classification(): string {
    return this._classification;
  }

  get versionSummary(): string {
    return this._versionSummary;
  }

  public equals(other: PromptMetadata): boolean {
    return (
      this._displayName === other.displayName &&
      this._description === other.description &&
      this._purpose === other.purpose &&
      this._classification === other.classification &&
      this._versionSummary === other.versionSummary
    );
  }
}

// 3. Prompt Version Entity
export interface PromptVersionProperties {
  versionNumber: number;
  createdAt: Date;
  publishedAt?: Date | undefined;
  definitionSnapshot: PromptDefinition;
  metadataSnapshot: PromptMetadata;
  visibilitySnapshot: LogicalVisibilityClassification;
  state: PromptLifecycleState;
}

export class PromptVersion {
  private readonly _versionNumber: number;
  private readonly _createdAt: Date;
  private readonly _publishedAt: Date | undefined;
  private readonly _definitionSnapshot: PromptDefinition;
  private readonly _metadataSnapshot: PromptMetadata;
  private readonly _visibilitySnapshot: LogicalVisibilityClassification;
  private readonly _state: PromptLifecycleState;

  constructor(properties: PromptVersionProperties) {
    if (properties.versionNumber <= 0) {
      throw new Error("Version number must be greater than zero.");
    }
    if (!properties.createdAt) {
      throw new Error("Creation date is required.");
    }
    if (!properties.definitionSnapshot) {
      throw new Error("Definition snapshot is required.");
    }
    if (!properties.metadataSnapshot) {
      throw new Error("Metadata snapshot is required.");
    }
    if (!properties.visibilitySnapshot) {
      throw new Error("Visibility snapshot is required.");
    }
    if (!properties.state) {
      throw new Error("Lifecycle state is required.");
    }

    this._versionNumber = properties.versionNumber;
    this._createdAt = properties.createdAt;
    this._publishedAt = properties.publishedAt;
    this._definitionSnapshot = properties.definitionSnapshot;
    this._metadataSnapshot = properties.metadataSnapshot;
    this._visibilitySnapshot = properties.visibilitySnapshot;
    this._state = properties.state;
  }

  get versionNumber(): number {
    return this._versionNumber;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  get publishedAt(): Date | undefined {
    return this._publishedAt;
  }

  get definitionSnapshot(): PromptDefinition {
    return this._definitionSnapshot;
  }

  get metadataSnapshot(): PromptMetadata {
    return this._metadataSnapshot;
  }

  get visibilitySnapshot(): LogicalVisibilityClassification {
    return this._visibilitySnapshot;
  }

  get state(): PromptLifecycleState {
    return this._state;
  }
}

// 4. Domain Events
export const PROMPT_REGISTERED = "PROMPT_REGISTERED";
export const PROMPT_UPDATED = "PROMPT_UPDATED";
export const PROMPT_PUBLISHED = "PROMPT_PUBLISHED";
export const PROMPT_DEPRECATED = "PROMPT_DEPRECATED";
export const PROMPT_ARCHIVED = "PROMPT_ARCHIVED";

export type PromptDomainEventName =
  | typeof PROMPT_REGISTERED
  | typeof PROMPT_UPDATED
  | typeof PROMPT_PUBLISHED
  | typeof PROMPT_DEPRECATED
  | typeof PROMPT_ARCHIVED;

export interface PromptRegisteredEvent {
  readonly eventType: typeof PROMPT_REGISTERED;
  readonly promptId: string;
  readonly reference: string;
  readonly ownerId: string;
}

export interface PromptUpdatedEvent {
  readonly eventType: typeof PROMPT_UPDATED;
  readonly promptId: string;
  readonly reference: string;
  readonly ownerId: string;
  readonly versionNumber: number;
}

export interface PromptPublishedEvent {
  readonly eventType: typeof PROMPT_PUBLISHED;
  readonly promptId: string;
  readonly reference: string;
  readonly ownerId: string;
  readonly versionNumber: number;
}

export interface PromptDeprecatedEvent {
  readonly eventType: typeof PROMPT_DEPRECATED;
  readonly promptId: string;
  readonly reference: string;
  readonly ownerId: string;
  readonly versionNumber: number;
}

export interface PromptArchivedEvent {
  readonly eventType: typeof PROMPT_ARCHIVED;
  readonly promptId: string;
  readonly reference: string;
  readonly ownerId: string;
}

export type PromptDomainEvent =
  | PromptRegisteredEvent
  | PromptUpdatedEvent
  | PromptPublishedEvent
  | PromptDeprecatedEvent
  | PromptArchivedEvent;

export interface PromptEventPublisher {
  publish(event: PromptDomainEvent): Promise<void>;
}

// 5. Query Projection Contract
export interface PromptQueryProjection {
  readonly id: string;
  readonly reference: string;
  readonly ownerId: string;
  readonly displayName: string;
  readonly status: PromptLifecycleState;
  readonly latestVersionNumber: number;
  readonly updatedAt: Date;
}

// 6. Persistence interfaces
export interface PromptPersistenceContract {
  checkUniqueReference(
    ownerId: string,
    reference: string,
    excludePromptId?: string,
  ): Promise<boolean>;
}

export interface PromptAggregateStore {
  save(prompt: Prompt): Promise<void>;
  findById(id: string, ownerId: string): Promise<Prompt | null>;
  findByReference(reference: string, ownerId: string): Promise<Prompt | null>;
}

// 7. Prompt Properties
export interface PromptProperties {
  id: string;
  reference: string;
  ownerId: string;
  definition: PromptDefinition;
  metadata: PromptMetadata;
  visibility: LogicalVisibilityClassification;
  status: PromptLifecycleState;
  versions: PromptVersion[];
  createdAt: Date;
  updatedAt: Date;
}

// 8. Prompt Aggregate Root
export class Prompt {
  private readonly _id: string;
  private readonly _reference: string;
  private readonly _ownerId: string;
  private _definition: PromptDefinition;
  private _metadata: PromptMetadata;
  private _visibility: LogicalVisibilityClassification;
  private _status: PromptLifecycleState;
  private readonly _versions: PromptVersion[] = [];
  private readonly _createdAt: Date;
  private _updatedAt: Date;
  private _domainEvents: PromptDomainEvent[] = [];

  constructor(properties: PromptProperties) {
    if (!properties.id || properties.id.trim() === "") {
      throw new Error("Prompt Identity is required.");
    }
    if (!properties.reference || properties.reference.trim() === "") {
      throw new Error("Prompt Reference is required.");
    }
    const referencePattern = /^[a-z0-9]+(\.[a-z0-9]+)*$/;
    if (!referencePattern.test(properties.reference)) {
      throw new Error("Invalid prompt reference format. Must be lower-case dot-separated key.");
    }
    if (!properties.ownerId || properties.ownerId.trim() === "") {
      throw new Error("Owner Reference is required.");
    }
    if (!properties.definition) {
      throw new Error("Prompt Definition is required.");
    }
    if (!properties.metadata) {
      throw new Error("Prompt Metadata is required.");
    }
    if (!properties.visibility) {
      throw new Error("Logical Visibility Classification is required.");
    }
    if (!properties.status) {
      throw new Error("Prompt Lifecycle State is required.");
    }

    this._id = properties.id;
    this._reference = properties.reference;
    this._ownerId = properties.ownerId;
    this._definition = properties.definition;
    this._metadata = properties.metadata;
    this._visibility = properties.visibility;
    this._status = properties.status;
    this._createdAt = properties.createdAt;
    this._updatedAt = properties.updatedAt;

    if (properties.versions && properties.versions.length > 0) {
      // Keep copy of initial versions to preserve append-only invariants
      this._versions = [...properties.versions];
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

  get definition(): PromptDefinition {
    return this._definition;
  }

  get metadata(): PromptMetadata {
    return this._metadata;
  }

  get visibility(): LogicalVisibilityClassification {
    return this._visibility;
  }

  get status(): PromptLifecycleState {
    return this._status;
  }

  get versions(): ReadonlyArray<PromptVersion> {
    return [...this._versions];
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }

  get domainEvents(): ReadonlyArray<PromptDomainEvent> {
    return this._domainEvents;
  }

  public clearDomainEvents(): void {
    this._domainEvents = [];
  }

  private addDomainEvent(event: PromptDomainEvent): void {
    this._domainEvents.push(event);
  }

  private validateInvariants(): void {
    // 1. Reference format
    const referencePattern = /^[a-z0-9]+(\.[a-z0-9]+)*$/;
    if (!referencePattern.test(this._reference)) {
      throw new Error("Invalid prompt reference format. Must be lower-case dot-separated key.");
    }

    // 2. Version history coherence
    if (this._versions.length > 0) {
      let previousNumber = 0;
      for (const ver of this._versions) {
        if (ver.versionNumber <= previousNumber) {
          throw new Error("Version history must be sequential and strictly increasing.");
        }
        previousNumber = ver.versionNumber;
      }
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
    definition: PromptDefinition,
    metadata: PromptMetadata,
    visibility: LogicalVisibilityClassification,
  ): Prompt {
    const now = new Date();
    const initialVersion = new PromptVersion({
      versionNumber: 1,
      createdAt: now,
      definitionSnapshot: definition,
      metadataSnapshot: metadata,
      visibilitySnapshot: visibility,
      state: "Draft",
    });

    const prompt = new Prompt({
      id,
      reference,
      ownerId,
      definition,
      metadata,
      visibility,
      status: "Draft",
      versions: [initialVersion],
      createdAt: now,
      updatedAt: now,
    });

    prompt.addDomainEvent({
      eventType: PROMPT_REGISTERED,
      promptId: prompt.id,
      reference: prompt.reference,
      ownerId: prompt.ownerId,
    });

    return prompt;
  }

  private getLatestVersion(): PromptVersion {
    if (this._versions.length === 0) {
      throw new Error("No versions found in aggregate history.");
    }
    let latest = this._versions[0]!;
    for (const ver of this._versions) {
      if (ver.versionNumber > latest.versionNumber) {
        latest = ver;
      }
    }
    return latest;
  }

  // Domain Operations
  public updateDraft(
    actorOwnerId: string,
    definition: PromptDefinition,
    metadata: PromptMetadata,
    visibility: LogicalVisibilityClassification,
  ): void {
    this.verifyOwnership(actorOwnerId);
    if (this._status !== "Draft") {
      throw new Error(`Cannot update definition or metadata in status: ${this._status}`);
    }

    this._definition = definition;
    this._metadata = metadata;
    this._visibility = visibility;
    this._updatedAt = new Date();

    // Replace the draft version snapshot in the version history using getLatestVersion helper
    const latestVersion = this.getLatestVersion();
    const latestIndex = this._versions.findIndex(
      (v) => v.versionNumber === latestVersion.versionNumber,
    );
    if (latestIndex !== -1) {
      this._versions[latestIndex] = new PromptVersion({
        versionNumber: latestVersion.versionNumber,
        createdAt: this._versions[latestIndex]!.createdAt,
        definitionSnapshot: this._definition,
        metadataSnapshot: this._metadata,
        visibilitySnapshot: this._visibility,
        state: "Draft",
      });
    }

    this.addDomainEvent({
      eventType: PROMPT_UPDATED,
      promptId: this._id,
      reference: this._reference,
      ownerId: this._ownerId,
      versionNumber: latestVersion.versionNumber,
    });
  }

  public publish(actorOwnerId: string): void {
    this.verifyOwnership(actorOwnerId);
    if (this._status !== "Draft") {
      throw new Error(`Cannot publish prompt when in status: ${this._status}`);
    }

    const now = new Date();
    this._status = "Published";
    this._updatedAt = now;

    // Freeze active version snapshot as Published using getLatestVersion helper
    const latestVersion = this.getLatestVersion();
    const latestIndex = this._versions.findIndex(
      (v) => v.versionNumber === latestVersion.versionNumber,
    );
    if (latestIndex !== -1) {
      const activeDraft = this._versions[latestIndex]!;
      this._versions[latestIndex] = new PromptVersion({
        versionNumber: activeDraft.versionNumber,
        createdAt: activeDraft.createdAt,
        publishedAt: now,
        definitionSnapshot: activeDraft.definitionSnapshot,
        metadataSnapshot: activeDraft.metadataSnapshot,
        visibilitySnapshot: activeDraft.visibilitySnapshot,
        state: "Published",
      });
    }

    this.addDomainEvent({
      eventType: PROMPT_PUBLISHED,
      promptId: this._id,
      reference: this._reference,
      ownerId: this._ownerId,
      versionNumber: latestVersion.versionNumber,
    });
  }

  public createNewDraft(
    actorOwnerId: string,
    definition: PromptDefinition,
    metadata: PromptMetadata,
    visibility: LogicalVisibilityClassification,
  ): void {
    this.verifyOwnership(actorOwnerId);
    if (this._status !== "Published" && this._status !== "Deprecated") {
      throw new Error(`Cannot create a new draft from status: ${this._status}`);
    }

    const now = new Date();
    this._status = "Draft";
    this._definition = definition;
    this._metadata = metadata;
    this._visibility = visibility;
    this._updatedAt = now;

    // Append-only new draft version to collection using getLatestVersion helper
    const latestVersion = this.getLatestVersion();
    const newVersionNumber = latestVersion.versionNumber + 1;
    const newDraftVersion = new PromptVersion({
      versionNumber: newVersionNumber,
      createdAt: now,
      definitionSnapshot: definition,
      metadataSnapshot: metadata,
      visibilitySnapshot: visibility,
      state: "Draft",
    });

    this._versions.push(newDraftVersion);

    this.addDomainEvent({
      eventType: PROMPT_UPDATED,
      promptId: this._id,
      reference: this._reference,
      ownerId: this._ownerId,
      versionNumber: newVersionNumber,
    });
  }

  public deprecate(actorOwnerId: string): void {
    this.verifyOwnership(actorOwnerId);
    if (this._status !== "Published") {
      throw new Error(`Cannot deprecate prompt in status: ${this._status}`);
    }

    const now = new Date();
    this._status = "Deprecated";
    this._updatedAt = now;

    const latestVersion = this.getLatestVersion();

    this.addDomainEvent({
      eventType: PROMPT_DEPRECATED,
      promptId: this._id,
      reference: this._reference,
      ownerId: this._ownerId,
      versionNumber: latestVersion.versionNumber,
    });
  }

  public archive(actorOwnerId: string): void {
    this.verifyOwnership(actorOwnerId);
    if (this._status === "Archived") {
      throw new Error("Prompt is already archived.");
    }

    const now = new Date();
    this._status = "Archived";
    this._updatedAt = now;

    this.addDomainEvent({
      eventType: PROMPT_ARCHIVED,
      promptId: this._id,
      reference: this._reference,
      ownerId: this._ownerId,
    });
  }
}
