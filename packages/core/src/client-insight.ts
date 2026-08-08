// 1. Value Objects

export interface InsightContentProperties {
  observation: string;
  implication: string;
  evidenceSummary: string;
}

export class InsightContent {
  private readonly _observation: string;
  private readonly _implication: string;
  private readonly _evidenceSummary: string;

  constructor(properties: InsightContentProperties) {
    if (!properties.observation || properties.observation.trim() === "") {
      throw new Error("Observation is required.");
    }
    if (!properties.implication || properties.implication.trim() === "") {
      throw new Error("Implication is required.");
    }
    if (!properties.evidenceSummary || properties.evidenceSummary.trim() === "") {
      throw new Error("Evidence summary is required.");
    }

    this._observation = properties.observation.trim();
    this._implication = properties.implication.trim();
    this._evidenceSummary = properties.evidenceSummary.trim();
    Object.freeze(this);
  }

  get observation(): string {
    return this._observation;
  }

  get implication(): string {
    return this._implication;
  }

  get evidenceSummary(): string {
    return this._evidenceSummary;
  }

  public equals(other: InsightContent): boolean {
    if (!other) {
      return false;
    }
    return (
      this._observation === other.observation &&
      this._implication === other.implication &&
      this._evidenceSummary === other.evidenceSummary
    );
  }
}

export type InsightClassificationValue =
  | "Goal"
  | "Concern"
  | "Preference"
  | "Risk"
  | "Opportunity"
  | "RelationshipSignal";

export class InsightClassification {
  private readonly _value: InsightClassificationValue;

  constructor(value: string) {
    if (!value || value.trim() === "") {
      throw new Error("Insight classification value is required.");
    }
    const cleanValue = value.trim();
    const validCategories = [
      "Goal",
      "Concern",
      "Preference",
      "Risk",
      "Opportunity",
      "RelationshipSignal",
    ];

    // Find case-insensitive match
    const matchedCategory = validCategories.find(
      (c) => c.toLowerCase() === cleanValue.toLowerCase(),
    );
    if (!matchedCategory) {
      throw new Error(`Invalid Insight classification category: ${cleanValue}.`);
    }

    this._value = matchedCategory as InsightClassificationValue;
    Object.freeze(this);
  }

  get value(): InsightClassificationValue {
    return this._value;
  }

  public equals(other: InsightClassification): boolean {
    if (!other) {
      return false;
    }
    return this._value === other.value;
  }
}

export type InsightConfidenceValue = "Low" | "Moderate" | "High";

export class InsightConfidence {
  private readonly _value: InsightConfidenceValue;

  constructor(value: string) {
    if (!value || value.trim() === "") {
      throw new Error("Insight confidence value is required.");
    }
    const cleanValue = value.trim();
    const validConfidences = ["Low", "Moderate", "High"];

    const matchedConfidence = validConfidences.find(
      (c) => c.toLowerCase() === cleanValue.toLowerCase(),
    );
    if (!matchedConfidence) {
      throw new Error(`Invalid Insight confidence: ${cleanValue}.`);
    }

    this._value = matchedConfidence as InsightConfidenceValue;
    Object.freeze(this);
  }

  get value(): InsightConfidenceValue {
    return this._value;
  }

  public equals(other: InsightConfidence): boolean {
    if (!other) {
      return false;
    }
    return this._value === other.value;
  }
}

export class InsightSourceReference {
  private readonly _value: string;

  constructor(value: string) {
    if (!value || value.trim() === "") {
      throw new Error("Insight source reference value is required.");
    }
    const cleanValue = value.trim();
    // Validate logical reference pattern
    const pattern = /^[a-z0-9]+([.-][a-z0-9]+)*$/;
    if (!pattern.test(cleanValue)) {
      throw new Error("Invalid source reference format.");
    }
    this._value = cleanValue;
    Object.freeze(this);
  }

  get value(): string {
    return this._value;
  }

  public equals(other: InsightSourceReference): boolean {
    if (!other) {
      return false;
    }
    return this._value === other.value;
  }
}

export interface InsightMetadataProperties {
  displayName: string;
  description: string;
  purpose: string;
  scope: string;
}

export class InsightMetadata {
  private readonly _displayName: string;
  private readonly _description: string;
  private readonly _purpose: string;
  private readonly _scope: string;

  constructor(properties: InsightMetadataProperties) {
    if (!properties.displayName || properties.displayName.trim() === "") {
      throw new Error("Display Name is required.");
    }
    if (!properties.description || properties.description.trim() === "") {
      throw new Error("Description is required.");
    }
    if (!properties.purpose || properties.purpose.trim() === "") {
      throw new Error("Purpose is required.");
    }
    if (!properties.scope || properties.scope.trim() === "") {
      throw new Error("Scope is required.");
    }

    this._displayName = properties.displayName.trim();
    this._description = properties.description.trim();
    this._purpose = properties.purpose.trim();
    this._scope = properties.scope.trim();
    Object.freeze(this);
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

  get scope(): string {
    return this._scope;
  }

  public equals(other: InsightMetadata): boolean {
    if (!other) {
      return false;
    }
    return (
      this._displayName === other.displayName &&
      this._description === other.description &&
      this._purpose === other.purpose &&
      this._scope === other.scope
    );
  }
}

export class InsightFingerprint {
  private readonly _value: string;

  constructor(value: string) {
    if (!value || value.trim() === "") {
      throw new Error("Fingerprint value is required.");
    }
    this._value = value.trim();
    Object.freeze(this);
  }

  get value(): string {
    return this._value;
  }

  public equals(other: InsightFingerprint): boolean {
    if (!other) {
      return false;
    }
    return this._value === other.value;
  }
}

export class InsightReference {
  private readonly _value: string;

  constructor(value: string) {
    if (!value || value.trim() === "") {
      throw new Error("Insight reference value is required.");
    }
    const cleanValue = value.trim();
    const pattern = /^[a-z0-9]+([.-][a-z0-9]+)*$/;
    if (!pattern.test(cleanValue)) {
      throw new Error("Invalid insight reference format.");
    }
    this._value = cleanValue;
    Object.freeze(this);
  }

  get value(): string {
    return this._value;
  }

  public equals(other: InsightReference): boolean {
    if (!other) {
      return false;
    }
    return this._value === other.value;
  }
}

// 2. Lifecycle State
export type ClientInsightLifecycle =
  | "Draft"
  | "Identified"
  | "Validated"
  | "Published"
  | "Archived";

// 3. Snapshot
export interface ClientInsightSnapshotProperties {
  version: number;
  createdAt: Date;
  insightReference: InsightReference;
  clientId: string;
  ownerId: string;
  content: InsightContent;
  classification: InsightClassification;
  confidence: InsightConfidence;
  sourceReference: InsightSourceReference;
  metadata: InsightMetadata;
  fingerprint: InsightFingerprint;
  lifecycle: ClientInsightLifecycle;
}

export class ClientInsightSnapshot {
  private readonly _version: number;
  private readonly _createdAt: Date;
  private readonly _insightReference: InsightReference;
  private readonly _clientId: string;
  private readonly _ownerId: string;
  private readonly _content: InsightContent;
  private readonly _classification: InsightClassification;
  private readonly _confidence: InsightConfidence;
  private readonly _sourceReference: InsightSourceReference;
  private readonly _metadata: InsightMetadata;
  private readonly _fingerprint: InsightFingerprint;
  private readonly _lifecycle: ClientInsightLifecycle;

  constructor(properties: ClientInsightSnapshotProperties) {
    if (properties.version <= 0) {
      throw new Error("Snapshot version must be greater than zero.");
    }
    if (!properties.createdAt) {
      throw new Error("Snapshot creation date is required.");
    }
    if (!properties.insightReference) {
      throw new Error("Insight reference is required.");
    }
    if (!properties.clientId || properties.clientId.trim() === "") {
      throw new Error("Client reference is required.");
    }
    if (!properties.ownerId || properties.ownerId.trim() === "") {
      throw new Error("Owner reference is required.");
    }
    if (!properties.content) {
      throw new Error("Insight content is required.");
    }
    if (!properties.classification) {
      throw new Error("Insight classification is required.");
    }
    if (!properties.confidence) {
      throw new Error("Insight confidence is required.");
    }
    if (!properties.sourceReference) {
      throw new Error("Insight source reference is required.");
    }
    if (!properties.metadata) {
      throw new Error("Insight metadata is required.");
    }
    if (!properties.fingerprint) {
      throw new Error("Insight fingerprint is required.");
    }
    if (!properties.lifecycle) {
      throw new Error("Lifecycle state is required.");
    }

    this._version = properties.version;
    this._createdAt = new Date(properties.createdAt.getTime());
    this._insightReference = properties.insightReference;
    this._clientId = properties.clientId;
    this._ownerId = properties.ownerId;
    this._content = properties.content;
    this._classification = properties.classification;
    this._confidence = properties.confidence;
    this._sourceReference = properties.sourceReference;
    this._metadata = properties.metadata;
    this._fingerprint = properties.fingerprint;
    this._lifecycle = properties.lifecycle;
    Object.freeze(this);
  }

  get version(): number {
    return this._version;
  }

  get createdAt(): Date {
    return new Date(this._createdAt.getTime());
  }

  get insightReference(): InsightReference {
    return this._insightReference;
  }

  get clientId(): string {
    return this._clientId;
  }

  get ownerId(): string {
    return this._ownerId;
  }

  get content(): InsightContent {
    return this._content;
  }

  get classification(): InsightClassification {
    return this._classification;
  }

  get confidence(): InsightConfidence {
    return this._confidence;
  }

  get sourceReference(): InsightSourceReference {
    return this._sourceReference;
  }

  get metadata(): InsightMetadata {
    return this._metadata;
  }

  get fingerprint(): InsightFingerprint {
    return this._fingerprint;
  }

  get lifecycle(): ClientInsightLifecycle {
    return this._lifecycle;
  }
}

// 4. Domain Events
export const CLIENT_INSIGHT_IDENTIFIED = "CLIENT_INSIGHT_IDENTIFIED";
export const CLIENT_INSIGHT_VALIDATED = "CLIENT_INSIGHT_VALIDATED";
export const CLIENT_INSIGHT_PUBLISHED = "CLIENT_INSIGHT_PUBLISHED";
export const CLIENT_INSIGHT_ARCHIVED = "CLIENT_INSIGHT_ARCHIVED";

export type ClientInsightDomainEventName =
  | typeof CLIENT_INSIGHT_IDENTIFIED
  | typeof CLIENT_INSIGHT_VALIDATED
  | typeof CLIENT_INSIGHT_PUBLISHED
  | typeof CLIENT_INSIGHT_ARCHIVED;

export interface ClientInsightIdentifiedEvent {
  readonly eventType: typeof CLIENT_INSIGHT_IDENTIFIED;
  readonly insightId: string;
  readonly insightReference: string;
  readonly clientId: string;
  readonly ownerId: string;
  readonly snapshotVersion: number;
}

export interface ClientInsightValidatedEvent {
  readonly eventType: typeof CLIENT_INSIGHT_VALIDATED;
  readonly insightId: string;
  readonly insightReference: string;
  readonly clientId: string;
  readonly ownerId: string;
  readonly snapshotVersion: number;
}

export interface ClientInsightPublishedEvent {
  readonly eventType: typeof CLIENT_INSIGHT_PUBLISHED;
  readonly insightId: string;
  readonly insightReference: string;
  readonly clientId: string;
  readonly ownerId: string;
  readonly snapshotVersion: number;
}

export interface ClientInsightArchivedEvent {
  readonly eventType: typeof CLIENT_INSIGHT_ARCHIVED;
  readonly insightId: string;
  readonly insightReference: string;
  readonly clientId: string;
  readonly ownerId: string;
  readonly snapshotVersion: number;
}

export type ClientInsightDomainEvent =
  | ClientInsightIdentifiedEvent
  | ClientInsightValidatedEvent
  | ClientInsightPublishedEvent
  | ClientInsightArchivedEvent;

// 5. Persistence & Query Contracts
export interface ClientInsightQueryProjection {
  readonly id: string;
  readonly insightReference: string;
  readonly clientId: string;
  readonly ownerId: string;
  readonly lifecycle: ClientInsightLifecycle;
  readonly category: string;
  readonly confidence: string;
  readonly versionCount: number;
  readonly updatedAt: Date;
}

export interface ClientInsightPersistenceContract {
  checkUniqueReference(
    ownerId: string,
    reference: string,
    excludeInsightId?: string,
  ): Promise<boolean>;
}

export interface ClientInsightAggregateStore {
  save(insight: ClientInsight): Promise<void>;
  findById(id: string, ownerId: string): Promise<ClientInsight | null>;
  findByReference(reference: string, ownerId: string): Promise<ClientInsight | null>;
}

// 6. ClientInsight Aggregate Root Properties
export interface ClientInsightProperties {
  id: string;
  insightReference: InsightReference;
  clientId: string;
  ownerId: string;
  content: InsightContent;
  classification: InsightClassification;
  confidence: InsightConfidence;
  sourceReference: InsightSourceReference;
  metadata: InsightMetadata;
  fingerprint: InsightFingerprint;
  lifecycle: ClientInsightLifecycle;
  snapshots: ClientInsightSnapshot[];
  createdAt: Date;
  updatedAt: Date;
}

// 7. ClientInsight Aggregate Root
export class ClientInsight {
  private readonly _id: string;
  private readonly _insightReference: InsightReference;
  private readonly _clientId: string;
  private readonly _ownerId: string;
  private _content: InsightContent;
  private _classification: InsightClassification;
  private _confidence: InsightConfidence;
  private _sourceReference: InsightSourceReference;
  private _metadata: InsightMetadata;
  private _fingerprint: InsightFingerprint;
  private _lifecycle: ClientInsightLifecycle;
  private readonly _snapshots: ClientInsightSnapshot[] = [];
  private readonly _createdAt: Date;
  private _updatedAt: Date;
  private _domainEvents: ClientInsightDomainEvent[] = [];

  constructor(properties: ClientInsightProperties) {
    this._id = properties.id;
    this._insightReference = properties.insightReference;
    this._clientId = properties.clientId;
    this._ownerId = properties.ownerId;
    this._content = properties.content;
    this._classification = properties.classification;
    this._confidence = properties.confidence;
    this._sourceReference = properties.sourceReference;
    this._metadata = properties.metadata;
    this._fingerprint = properties.fingerprint;
    this._lifecycle = properties.lifecycle;
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

  get insightReference(): InsightReference {
    return this._insightReference;
  }

  get clientId(): string {
    return this._clientId;
  }

  get ownerId(): string {
    return this._ownerId;
  }

  get content(): InsightContent {
    return this._content;
  }

  get classification(): InsightClassification {
    return this._classification;
  }

  get confidence(): InsightConfidence {
    return this._confidence;
  }

  get sourceReference(): InsightSourceReference {
    return this._sourceReference;
  }

  get metadata(): InsightMetadata {
    return this._metadata;
  }

  get fingerprint(): InsightFingerprint {
    return this._fingerprint;
  }

  get lifecycle(): ClientInsightLifecycle {
    return this._lifecycle;
  }

  get snapshots(): ReadonlyArray<ClientInsightSnapshot> {
    return Object.freeze([...this._snapshots]);
  }

  get createdAt(): Date {
    return new Date(this._createdAt.getTime());
  }

  get updatedAt(): Date {
    return new Date(this._updatedAt.getTime());
  }

  get domainEvents(): ReadonlyArray<ClientInsightDomainEvent> {
    return this._domainEvents;
  }

  public clearDomainEvents(): void {
    this._domainEvents = [];
  }

  private addDomainEvent(event: ClientInsightDomainEvent): void {
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

  private validateInvariants(): void {
    if (!this._id || this._id.trim() === "") {
      throw new Error("Insight Identity is required.");
    }
    if (!this._insightReference) {
      throw new Error("Insight Reference is required.");
    }
    if (!this._clientId || this._clientId.trim() === "") {
      throw new Error("Client Reference is required.");
    }
    if (!this._ownerId || this._ownerId.trim() === "") {
      throw new Error("Owner Reference is required.");
    }
    if (!this._content) {
      throw new Error("Insight Content is required.");
    }
    if (!this._classification) {
      throw new Error("Insight Classification is required.");
    }
    if (!this._confidence) {
      throw new Error("Insight Confidence is required.");
    }
    if (!this._sourceReference) {
      throw new Error("Insight Source Reference is required.");
    }
    if (!this._metadata) {
      throw new Error("Insight Metadata is required.");
    }
    if (!this._fingerprint) {
      throw new Error("Insight Fingerprint is required.");
    }
    if (!this._lifecycle) {
      throw new Error("Lifecycle state is required.");
    }

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
    const newSnapshot = new ClientInsightSnapshot({
      version: nextVersion,
      createdAt: new Date(),
      insightReference: this._insightReference,
      clientId: this._clientId,
      ownerId: this._ownerId,
      content: this._content,
      classification: this._classification,
      confidence: this._confidence,
      sourceReference: this._sourceReference,
      metadata: this._metadata,
      fingerprint: this._fingerprint,
      lifecycle: this._lifecycle,
    });
    this._snapshots.push(newSnapshot);
  }

  // Factory Creation Method
  public static create(
    id: string,
    insightReference: InsightReference,
    clientId: string,
    ownerId: string,
    content: InsightContent,
    classification: InsightClassification,
    confidence: InsightConfidence,
    sourceReference: InsightSourceReference,
    metadata: InsightMetadata,
    fingerprint: InsightFingerprint,
  ): ClientInsight {
    const now = new Date();
    const insight = new ClientInsight({
      id,
      insightReference,
      clientId,
      ownerId,
      content,
      classification,
      confidence,
      sourceReference,
      metadata,
      fingerprint,
      lifecycle: "Draft",
      snapshots: [],
      createdAt: now,
      updatedAt: now,
    });

    insight.appendSnapshot();
    return insight;
  }

  // Domain Operations
  public identify(actorOwnerId: string): void {
    this.verifyOwnership(actorOwnerId);
    if (this._lifecycle !== "Draft") {
      throw new Error(`Cannot identify insight when in status: ${this._lifecycle}`);
    }

    this._lifecycle = "Identified";
    this._updatedAt = new Date();
    this.appendSnapshot();

    this.addDomainEvent({
      eventType: CLIENT_INSIGHT_IDENTIFIED,
      insightId: this._id,
      insightReference: this._insightReference.value,
      clientId: this._clientId,
      ownerId: this._ownerId,
      snapshotVersion: this._snapshots.length,
    });
  }

  public validate(actorOwnerId: string): void {
    this.verifyOwnership(actorOwnerId);
    if (this._lifecycle !== "Identified") {
      throw new Error(`Cannot validate insight when in status: ${this._lifecycle}`);
    }

    this._lifecycle = "Validated";
    this._updatedAt = new Date();
    this.appendSnapshot();

    this.addDomainEvent({
      eventType: CLIENT_INSIGHT_VALIDATED,
      insightId: this._id,
      insightReference: this._insightReference.value,
      clientId: this._clientId,
      ownerId: this._ownerId,
      snapshotVersion: this._snapshots.length,
    });
  }

  public publish(actorOwnerId: string): void {
    this.verifyOwnership(actorOwnerId);
    if (this._lifecycle !== "Validated") {
      throw new Error(`Cannot publish insight when in status: ${this._lifecycle}`);
    }

    this._lifecycle = "Published";
    this._updatedAt = new Date();
    this.appendSnapshot();

    this.addDomainEvent({
      eventType: CLIENT_INSIGHT_PUBLISHED,
      insightId: this._id,
      insightReference: this._insightReference.value,
      clientId: this._clientId,
      ownerId: this._ownerId,
      snapshotVersion: this._snapshots.length,
    });
  }

  public archive(actorOwnerId: string): void {
    this.verifyOwnership(actorOwnerId);
    if (this._lifecycle === "Archived") {
      throw new Error("Insight is already archived.");
    }

    this._lifecycle = "Archived";
    this._updatedAt = new Date();
    this.appendSnapshot();

    this.addDomainEvent({
      eventType: CLIENT_INSIGHT_ARCHIVED,
      insightId: this._id,
      insightReference: this._insightReference.value,
      clientId: this._clientId,
      ownerId: this._ownerId,
      snapshotVersion: this._snapshots.length,
    });
  }

  public update(
    actorOwnerId: string,
    content: InsightContent,
    classification: InsightClassification,
    confidence: InsightConfidence,
    sourceReference: InsightSourceReference,
    metadata: InsightMetadata,
    fingerprint: InsightFingerprint,
  ): void {
    this.verifyOwnership(actorOwnerId);
    if (this._lifecycle === "Published" || this._lifecycle === "Archived") {
      throw new Error(`Cannot update insight in status: ${this._lifecycle}`);
    }

    this._content = content;
    this._classification = classification;
    this._confidence = confidence;
    this._sourceReference = sourceReference;
    this._metadata = metadata;
    this._fingerprint = fingerprint;
    this._updatedAt = new Date();
    this.appendSnapshot();
  }
}
