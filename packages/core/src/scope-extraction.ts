// 1. Lifecycle States
export enum ScopeExtractionLifecycle {
  DRAFT = "DRAFT",
  EXTRACTED = "EXTRACTED",
  COMMITTED = "COMMITTED",
  ARCHIVED = "ARCHIVED",
}

function deepFreeze<T>(obj: T): T {
  if (obj === null || typeof obj !== "object") {
    return obj;
  }
  Object.freeze(obj);
  Object.keys(obj).forEach((key) => {
    const val = (obj as Record<string, unknown>)[key];
    if (val !== null && typeof val === "object") {
      deepFreeze(val);
    }
  });
  return obj;
}

// 2. Scope Fact Type
export type ScopeFactTypeValue =
  | "DELIVERABLE"
  | "REQUIREMENT"
  | "CONSTRAINT"
  | "ASSUMPTION"
  | "EXCLUSION"
  | "DEPENDENCY"
  | "DEADLINE"
  | "QUANTITY"
  | "SCOPE_BOUNDARY";

export class ScopeFactType {
  private readonly _value: ScopeFactTypeValue;

  constructor(value: string) {
    if (!value || value.trim() === "") {
      throw new Error("Fact type is required.");
    }
    const cleanValue = value.trim().toUpperCase();
    const validTypes: ScopeFactTypeValue[] = [
      "DELIVERABLE",
      "REQUIREMENT",
      "CONSTRAINT",
      "ASSUMPTION",
      "EXCLUSION",
      "DEPENDENCY",
      "DEADLINE",
      "QUANTITY",
      "SCOPE_BOUNDARY",
    ];
    if (!validTypes.includes(cleanValue as ScopeFactTypeValue)) {
      throw new Error(`Unsupported fact type: ${value}`);
    }
    this._value = cleanValue as ScopeFactTypeValue;
    Object.freeze(this);
  }

  get value(): ScopeFactTypeValue {
    return this._value;
  }

  public equals(other: ScopeFactType): boolean {
    if (!other) {
      return false;
    }
    return this._value === other.value;
  }
}

// 3. Scope Fact Value
export interface ScopeFactValueProperties {
  description: string;
  parameters?: Record<string, unknown>;
}

export class ScopeFactValue {
  private readonly _description: string;
  private readonly _parameters: Record<string, unknown> | undefined;

  constructor(properties: ScopeFactValueProperties) {
    if (!properties.description || properties.description.trim() === "") {
      throw new Error("Fact value description is required.");
    }
    this._description = properties.description.trim();
    if (properties.parameters) {
      this._parameters = deepFreeze(JSON.parse(JSON.stringify(properties.parameters)));
    }
    Object.freeze(this);
  }

  get description(): string {
    return this._description;
  }

  get parameters(): Record<string, unknown> | undefined {
    return this._parameters;
  }
}

// 4. Source Reference
export interface ScopeSourceReferenceProperties {
  sourceId: string;
  sourceType: "CONVERSATION" | "DOCUMENT";
  locationReference?: string;
}

export class ScopeSourceReference {
  private readonly _sourceId: string;
  private readonly _sourceType: "CONVERSATION" | "DOCUMENT";
  private readonly _locationReference: string | undefined;

  constructor(properties: ScopeSourceReferenceProperties) {
    if (!properties.sourceId || properties.sourceId.trim() === "") {
      throw new Error("Source identifier is required.");
    }
    if (!properties.sourceType) {
      throw new Error("Source type is required.");
    }
    if (properties.sourceType !== "CONVERSATION" && properties.sourceType !== "DOCUMENT") {
      throw new Error(`Unsupported source type: ${properties.sourceType}`);
    }

    this._sourceId = properties.sourceId.trim();
    this._sourceType = properties.sourceType;
    this._locationReference = properties.locationReference;
    Object.freeze(this);
  }

  get sourceId(): string {
    return this._sourceId;
  }

  get sourceType(): "CONVERSATION" | "DOCUMENT" {
    return this._sourceType;
  }

  get locationReference(): string | undefined {
    return this._locationReference;
  }
}

// 5. Scope Evidence
export interface ScopeEvidenceProperties {
  sourceReference: ScopeSourceReference;
  contentSnippet: string;
  locationRange?: string;
}

export class ScopeEvidence {
  private readonly _sourceReference: ScopeSourceReference;
  private readonly _contentSnippet: string;
  private readonly _locationRange: string | undefined;

  constructor(properties: ScopeEvidenceProperties) {
    if (!properties.sourceReference) {
      throw new Error("Source reference is required.");
    }
    if (!properties.contentSnippet || properties.contentSnippet.trim() === "") {
      throw new Error("Content snippet is required.");
    }
    this._sourceReference = properties.sourceReference;
    this._contentSnippet = properties.contentSnippet.trim();
    this._locationRange = properties.locationRange;
    Object.freeze(this);
  }

  get sourceReference(): ScopeSourceReference {
    return this._sourceReference;
  }

  get contentSnippet(): string {
    return this._contentSnippet;
  }

  get locationRange(): string | undefined {
    return this._locationRange;
  }
}

// 6. Scope Fact
export interface ScopeFactProperties {
  factId: string;
  factType: ScopeFactType;
  factValue: ScopeFactValue;
  sourceReference: ScopeSourceReference;
  evidence: ScopeEvidence;
  metadata?: Record<string, unknown>;
}

export class ScopeFact {
  private readonly _factId: string;
  private readonly _factType: ScopeFactType;
  private readonly _factValue: ScopeFactValue;
  private readonly _sourceReference: ScopeSourceReference;
  private readonly _evidence: ScopeEvidence;
  private readonly _metadata: Record<string, unknown> | undefined;

  constructor(properties: ScopeFactProperties) {
    if (!properties.factId || properties.factId.trim() === "") {
      throw new Error("Fact identifier is required.");
    }
    if (!properties.factType) {
      throw new Error("Fact type is required.");
    }
    if (!properties.factValue) {
      throw new Error("Fact value is required.");
    }
    if (!properties.sourceReference) {
      throw new Error("Source reference is required.");
    }
    if (!properties.evidence) {
      throw new Error("Evidence reference is required.");
    }

    this._factId = properties.factId.trim();
    this._factType = properties.factType;
    this._factValue = properties.factValue;
    this._sourceReference = properties.sourceReference;
    this._evidence = properties.evidence;
    if (properties.metadata) {
      this._metadata = deepFreeze(JSON.parse(JSON.stringify(properties.metadata)));
    }
    Object.freeze(this);
  }

  get factId(): string {
    return this._factId;
  }

  get factType(): ScopeFactType {
    return this._factType;
  }

  get factValue(): ScopeFactValue {
    return this._factValue;
  }

  get sourceReference(): ScopeSourceReference {
    return this._sourceReference;
  }

  get evidence(): ScopeEvidence {
    return this._evidence;
  }

  get metadata(): Record<string, unknown> | undefined {
    return this._metadata;
  }
}

// 7. Scope Extraction Snapshot
export interface ScopeExtractionSnapshotProperties {
  version: number;
  facts: ScopeFact[];
  timestamp: Date;
  state: ScopeExtractionLifecycle;
}

export class ScopeExtractionSnapshot {
  private readonly _version: number;
  private readonly _facts: ScopeFact[];
  private readonly _timestamp: Date;
  private readonly _state: ScopeExtractionLifecycle;

  constructor(properties: ScopeExtractionSnapshotProperties) {
    if (typeof properties.version !== "number" || properties.version <= 0) {
      throw new Error("Snapshot version must be a positive number.");
    }
    if (!properties.facts) {
      throw new Error("Snapshot facts list is required.");
    }
    if (!properties.timestamp) {
      throw new Error("Snapshot timestamp is required.");
    }
    if (!properties.state) {
      throw new Error("Snapshot state is required.");
    }

    this._version = properties.version;
    this._facts = [...properties.facts];
    this._timestamp = new Date(properties.timestamp.getTime());
    this._state = properties.state;

    Object.freeze(this._facts);
    Object.freeze(this);
  }

  get version(): number {
    return this._version;
  }

  get facts(): ReadonlyArray<ScopeFact> {
    return Object.freeze([...this._facts]);
  }

  get timestamp(): Date {
    return new Date(this._timestamp.getTime());
  }

  get state(): ScopeExtractionLifecycle {
    return this._state;
  }
}

// 8. Domain Events
export interface ScopeExtractionDomainEvent {
  eventName: string;
  aggregateId: string;
  timestamp: Date;
  payload: Record<string, unknown>;
}

export class ScopeExtractionDraftedEvent implements ScopeExtractionDomainEvent {
  public readonly eventName = "SCOPE_EXTRACTION_DRAFTED";
  public readonly timestamp: Date;
  public readonly payload: { clientReference: string };

  constructor(
    public readonly aggregateId: string,
    clientReference: string,
    timestamp: Date,
  ) {
    this.timestamp = new Date(timestamp.getTime());
    this.payload = { clientReference };
    Object.freeze(this.payload);
    Object.freeze(this);
  }
}

export class ScopeExtractionCompletedEvent implements ScopeExtractionDomainEvent {
  public readonly eventName = "SCOPE_EXTRACTION_COMPLETED";
  public readonly timestamp: Date;
  public readonly payload: { factsCount: number };

  constructor(
    public readonly aggregateId: string,
    factsCount: number,
    timestamp: Date,
  ) {
    this.timestamp = new Date(timestamp.getTime());
    this.payload = { factsCount };
    Object.freeze(this.payload);
    Object.freeze(this);
  }
}

export class ScopeExtractionCommittedEvent implements ScopeExtractionDomainEvent {
  public readonly eventName = "SCOPE_EXTRACTION_COMMITTED";
  public readonly timestamp: Date;
  public readonly payload: Record<string, unknown> = {};

  constructor(
    public readonly aggregateId: string,
    timestamp: Date,
  ) {
    this.timestamp = new Date(timestamp.getTime());
    Object.freeze(this.payload);
    Object.freeze(this);
  }
}

export class ScopeExtractionArchivedEvent implements ScopeExtractionDomainEvent {
  public readonly eventName = "SCOPE_EXTRACTION_ARCHIVED";
  public readonly timestamp: Date;
  public readonly payload: Record<string, unknown> = {};

  constructor(
    public readonly aggregateId: string,
    timestamp: Date,
  ) {
    this.timestamp = new Date(timestamp.getTime());
    Object.freeze(this.payload);
    Object.freeze(this);
  }
}

// 9. Scope Extraction Aggregate Root
export interface ScopeExtractionProperties {
  extractionId: string;
  clientReference: string;
  facts: ScopeFact[];
  snapshots: ScopeExtractionSnapshot[];
  state: ScopeExtractionLifecycle;
}

export class ScopeExtraction {
  private readonly _extractionId: string;
  private readonly _clientReference: string;
  private _facts: ScopeFact[];
  private readonly _snapshots: ScopeExtractionSnapshot[];
  private _state: ScopeExtractionLifecycle;
  private _domainEvents: ScopeExtractionDomainEvent[] = [];

  constructor(properties: ScopeExtractionProperties) {
    if (!properties.extractionId || properties.extractionId.trim() === "") {
      throw new Error("Extraction identifier is required.");
    }
    if (!properties.clientReference || properties.clientReference.trim() === "") {
      throw new Error("Client reference is required.");
    }
    if (!properties.facts) {
      throw new Error("Facts collection is required.");
    }
    if (!properties.snapshots) {
      throw new Error("Snapshot collection is required.");
    }
    if (!properties.state) {
      throw new Error("Lifecycle state is required.");
    }

    this._extractionId = properties.extractionId.trim();
    this._clientReference = properties.clientReference.trim();
    this._facts = [...properties.facts];
    this._snapshots = [...properties.snapshots];
    this._state = properties.state;
  }

  get extractionId(): string {
    return this._extractionId;
  }

  get clientReference(): string {
    return this._clientReference;
  }

  get facts(): ReadonlyArray<ScopeFact> {
    return Object.freeze([...this._facts]);
  }

  get snapshots(): ReadonlyArray<ScopeExtractionSnapshot> {
    return Object.freeze([...this._snapshots]);
  }

  get state(): ScopeExtractionLifecycle {
    return this._state;
  }

  get domainEvents(): ReadonlyArray<ScopeExtractionDomainEvent> {
    return Object.freeze([...this._domainEvents]);
  }

  public clearEvents(): void {
    this._domainEvents = [];
  }

  public static draft(extractionId: string, clientReference: string): ScopeExtraction {
    const extraction = new ScopeExtraction({
      extractionId,
      clientReference,
      facts: [],
      snapshots: [],
      state: ScopeExtractionLifecycle.DRAFT,
    });
    extraction._domainEvents.push(
      new ScopeExtractionDraftedEvent(extractionId, clientReference, new Date()),
    );
    return extraction;
  }

  public addFact(fact: ScopeFact): void {
    if (
      this._state === ScopeExtractionLifecycle.COMMITTED ||
      this._state === ScopeExtractionLifecycle.ARCHIVED
    ) {
      throw new Error(`Cannot add fact in state: ${this._state}`);
    }
    // Prevent duplicate fact IDs
    const exists = this._facts.some((f) => f.factId === fact.factId);
    if (exists) {
      throw new Error(`Fact with identifier ${fact.factId} already exists.`);
    }
    this._facts.push(fact);
  }

  public removeFact(factId: string): void {
    if (
      this._state === ScopeExtractionLifecycle.COMMITTED ||
      this._state === ScopeExtractionLifecycle.ARCHIVED
    ) {
      throw new Error(`Cannot remove fact in state: ${this._state}`);
    }
    const index = this._facts.findIndex((f) => f.factId === factId);
    if (index === -1) {
      throw new Error(`Fact with identifier ${factId} not found.`);
    }
    this._facts.splice(index, 1);
  }

  public completeExtraction(): void {
    if (this._state !== ScopeExtractionLifecycle.DRAFT) {
      throw new Error(`Invalid lifecycle transition from ${this._state} to EXTRACTED.`);
    }
    this._state = ScopeExtractionLifecycle.EXTRACTED;
    this._domainEvents.push(
      new ScopeExtractionCompletedEvent(this._extractionId, this._facts.length, new Date()),
    );
    this.createSnapshot();
  }

  public commitExtraction(): void {
    if (this._state !== ScopeExtractionLifecycle.EXTRACTED) {
      throw new Error(`Invalid lifecycle transition from ${this._state} to COMMITTED.`);
    }
    this._state = ScopeExtractionLifecycle.COMMITTED;
    this._domainEvents.push(new ScopeExtractionCommittedEvent(this._extractionId, new Date()));
    this.createSnapshot();
  }

  public archiveExtraction(): void {
    if (this._state === ScopeExtractionLifecycle.ARCHIVED) {
      throw new Error("Aggregate is already archived.");
    }
    this._state = ScopeExtractionLifecycle.ARCHIVED;
    this._domainEvents.push(new ScopeExtractionArchivedEvent(this._extractionId, new Date()));
    this.createSnapshot();
  }

  private createSnapshot(): void {
    const nextVersion = this._snapshots.length + 1;
    const snapshot = new ScopeExtractionSnapshot({
      version: nextVersion,
      facts: [...this._facts],
      timestamp: new Date(),
      state: this._state,
    });
    this._snapshots.push(snapshot);
  }
}

// 10. Persistence / Provider Abstractions
export interface ScopeExtractionPersistenceContract {
  save(aggregate: ScopeExtraction): Promise<void>;
  findById(extractionId: string): Promise<ScopeExtraction | null>;
}

export interface ScopeExtractionAggregateStore {
  save(aggregate: ScopeExtraction): Promise<void>;
  load(extractionId: string): Promise<ScopeExtraction>;
}

export interface ScopeExtractionQueryProjection {
  getFactsByClient(clientReference: string): Promise<ScopeFact[]>;
}
