// 1. Lifecycle State
export type PolicyLifecycleState = "Draft" | "Validated" | "Published" | "Archived";

// 2. Value Objects

/**
 * Encapsulates validation and representation of the dots-separated, lower-case Policy Reference.
 *
 * This value object is fully immutable.
 */
export class PolicyReference {
  private readonly _value: string;

  constructor(value: string) {
    if (!value || value.trim() === "") {
      throw new Error("Policy Reference is required.");
    }
    const referencePattern = /^[a-z0-9]+(\.[a-z0-9]+)*$/;
    if (!referencePattern.test(value)) {
      throw new Error("Invalid policy reference format. Must be lower-case dot-separated key.");
    }
    this._value = value.trim();
  }

  get value(): string {
    return this._value;
  }

  public equals(other: PolicyReference): boolean {
    return this._value === other.value;
  }
}

/**
 * Represents the logical governance definition configuration of a Policy.
 *
 * This value object is fully immutable.
 */
export class PolicyDefinition {
  private readonly _governanceSpecification: string;

  constructor(governanceSpecification: string) {
    if (!governanceSpecification || governanceSpecification.trim() === "") {
      throw new Error("Governance specification is required.");
    }
    this._governanceSpecification = governanceSpecification.trim();
  }

  get governanceSpecification(): string {
    return this._governanceSpecification;
  }

  public equals(other: PolicyDefinition): boolean {
    return this._governanceSpecification === other.governanceSpecification;
  }
}

export interface PolicyMetadataProperties {
  displayName: string;
  description: string;
  purpose: string;
  policySummary: string;
}

/**
 * Represents metadata descriptive fields for the Policy.
 *
 * This value object is fully immutable.
 */
export class PolicyMetadata {
  private readonly _displayName: string;
  private readonly _description: string;
  private readonly _purpose: string;
  private readonly _policySummary: string;

  constructor(properties: PolicyMetadataProperties) {
    if (!properties.displayName || properties.displayName.trim() === "") {
      throw new Error("Display Name is required.");
    }
    if (!properties.description || properties.description.trim() === "") {
      throw new Error("Description is required.");
    }
    if (!properties.purpose || properties.purpose.trim() === "") {
      throw new Error("Purpose is required.");
    }
    if (!properties.policySummary || properties.policySummary.trim() === "") {
      throw new Error("Policy summary is required.");
    }

    this._displayName = properties.displayName.trim();
    this._description = properties.description.trim();
    this._purpose = properties.purpose.trim();
    this._policySummary = properties.policySummary.trim();
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

  get policySummary(): string {
    return this._policySummary;
  }

  public equals(other: PolicyMetadata): boolean {
    return (
      this._displayName === other.displayName &&
      this._description === other.description &&
      this._purpose === other.purpose &&
      this._policySummary === other.policySummary
    );
  }
}

export interface PolicyRuleSetProperties {
  logicalConstraints: string[];
  complianceCriteria: string[];
}

/**
 * Represents the strategic logical constraints of the Policy.
 *
 * This value object is fully immutable.
 */
export class PolicyRuleSet {
  private readonly _logicalConstraints: string[];
  private readonly _complianceCriteria: string[];

  constructor(properties: PolicyRuleSetProperties) {
    if (!properties.logicalConstraints || properties.logicalConstraints.length === 0) {
      throw new Error("Logical constraints must not be empty.");
    }
    if (!properties.complianceCriteria || properties.complianceCriteria.length === 0) {
      throw new Error("Compliance criteria must not be empty.");
    }
    this._logicalConstraints = [...properties.logicalConstraints];
    this._complianceCriteria = [...properties.complianceCriteria];
  }

  get logicalConstraints(): ReadonlyArray<string> {
    return Object.freeze([...this._logicalConstraints]);
  }

  get complianceCriteria(): ReadonlyArray<string> {
    return Object.freeze([...this._complianceCriteria]);
  }

  public equals(other: PolicyRuleSet): boolean {
    if (this._logicalConstraints.length !== other.logicalConstraints.length) {
      return false;
    }
    if (this._complianceCriteria.length !== other.complianceCriteria.length) {
      return false;
    }

    for (let i = 0; i < this._logicalConstraints.length; i++) {
      if (this._logicalConstraints[i] !== other.logicalConstraints[i]) {
        return false;
      }
    }
    for (let i = 0; i < this._complianceCriteria.length; i++) {
      if (this._complianceCriteria[i] !== other.complianceCriteria[i]) {
        return false;
      }
    }
    return true;
  }
}

export type PolicyDecision = "ALLOW" | "REJECT" | "REQUIRES_REVIEW";

export interface PolicyEvaluationResultProperties {
  decision: PolicyDecision;
  reasonCode: string;
  evaluationSummary: string;
  evaluatedAt: Date;
}

/**
 * Represents the immutable result of evaluating a policy logical constraints ruleset.
 *
 * This value object is fully immutable.
 */
export class PolicyEvaluationResult {
  private readonly _decision: PolicyDecision;
  private readonly _reasonCode: string;
  private readonly _evaluationSummary: string;
  private readonly _evaluatedAt: Date;

  constructor(properties: PolicyEvaluationResultProperties) {
    if (!properties.decision) {
      throw new Error("Decision is required.");
    }
    if (
      properties.decision !== "ALLOW" &&
      properties.decision !== "REJECT" &&
      properties.decision !== "REQUIRES_REVIEW"
    ) {
      throw new Error("Invalid policy decision value.");
    }
    if (!properties.reasonCode || properties.reasonCode.trim() === "") {
      throw new Error("Reason code is required.");
    }
    if (!properties.evaluationSummary || properties.evaluationSummary.trim() === "") {
      throw new Error("Evaluation summary is required.");
    }
    if (!properties.evaluatedAt) {
      throw new Error("Evaluation timestamp is required.");
    }
    this._decision = properties.decision;
    this._reasonCode = properties.reasonCode.trim();
    this._evaluationSummary = properties.evaluationSummary.trim();
    this._evaluatedAt = properties.evaluatedAt;
  }

  get decision(): PolicyDecision {
    return this._decision;
  }

  get reasonCode(): string {
    return this._reasonCode;
  }

  get evaluationSummary(): string {
    return this._evaluationSummary;
  }

  get evaluatedAt(): Date {
    return this._evaluatedAt;
  }

  public equals(other: PolicyEvaluationResult): boolean {
    return (
      this._decision === other.decision &&
      this._reasonCode === other.reasonCode &&
      this._evaluationSummary === other.evaluationSummary &&
      this._evaluatedAt.getTime() === other.evaluatedAt.getTime()
    );
  }
}

export interface DecisionFingerprintProperties {
  decisionIdentifier: string;
  policyReferenceValue: string;
  decisionType: string;
}

/**
 * Represents the logical identity of a governance decision.
 *
 * This value object is fully immutable. It owns only validation, equality, and logical
 * identity checks, and MUST NEVER expose hashes, algorithms, provider IDs, execution metadata,
 * or runtime data.
 */
export class DecisionFingerprint {
  private readonly _decisionIdentifier: string;
  private readonly _policyReferenceValue: string;
  private readonly _decisionType: string;

  constructor(properties: DecisionFingerprintProperties) {
    if (!properties.decisionIdentifier || properties.decisionIdentifier.trim() === "") {
      throw new Error("Decision identifier is required.");
    }
    if (!properties.policyReferenceValue || properties.policyReferenceValue.trim() === "") {
      throw new Error("Policy reference value is required.");
    }
    if (!properties.decisionType || properties.decisionType.trim() === "") {
      throw new Error("Decision type is required.");
    }
    this._decisionIdentifier = properties.decisionIdentifier.trim();
    this._policyReferenceValue = properties.policyReferenceValue.trim();
    this._decisionType = properties.decisionType.trim();
  }

  get decisionIdentifier(): string {
    return this._decisionIdentifier;
  }

  get policyReferenceValue(): string {
    return this._policyReferenceValue;
  }

  get decisionType(): string {
    return this._decisionType;
  }

  public equals(other: DecisionFingerprint): boolean {
    return (
      this._decisionIdentifier === other.decisionIdentifier &&
      this._policyReferenceValue === other.policyReferenceValue &&
      this._decisionType === other.decisionType
    );
  }
}

export interface PolicySnapshotProperties {
  snapshotId: string;
  policyReferenceSnapshot: PolicyReference;
  definitionSnapshot: PolicyDefinition;
  metadataSnapshot: PolicyMetadata;
  ruleSetSnapshot: PolicyRuleSet;
  evaluationResultSnapshot: PolicyEvaluationResult | null;
  decisionFingerprintSnapshot: DecisionFingerprint | null;
  lifecycleSnapshot: PolicyLifecycleState;
  capturedAt: Date;
}

/**
 * Represents a historical frozen snapshot of a Policy's state.
 *
 * This value object is fully immutable.
 */
export class PolicySnapshot {
  private readonly _snapshotId: string;
  private readonly _policyReferenceSnapshot: PolicyReference;
  private readonly _definitionSnapshot: PolicyDefinition;
  private readonly _metadataSnapshot: PolicyMetadata;
  private readonly _ruleSetSnapshot: PolicyRuleSet;
  private readonly _evaluationResultSnapshot: PolicyEvaluationResult | null;
  private readonly _decisionFingerprintSnapshot: DecisionFingerprint | null;
  private readonly _lifecycleSnapshot: PolicyLifecycleState;
  private readonly _capturedAt: Date;

  constructor(properties: PolicySnapshotProperties) {
    if (!properties.snapshotId || properties.snapshotId.trim() === "") {
      throw new Error("Snapshot ID is required.");
    }
    if (!properties.policyReferenceSnapshot) {
      throw new Error("Policy reference snapshot is required.");
    }
    if (!properties.definitionSnapshot) {
      throw new Error("Definition snapshot is required.");
    }
    if (!properties.metadataSnapshot) {
      throw new Error("Metadata snapshot is required.");
    }
    if (!properties.ruleSetSnapshot) {
      throw new Error("Rule set snapshot is required.");
    }
    if (!properties.lifecycleSnapshot) {
      throw new Error("Lifecycle snapshot is required.");
    }
    if (!properties.capturedAt) {
      throw new Error("Captured date is required.");
    }

    this._snapshotId = properties.snapshotId.trim();
    this._policyReferenceSnapshot = properties.policyReferenceSnapshot;
    this._definitionSnapshot = properties.definitionSnapshot;
    this._metadataSnapshot = properties.metadataSnapshot;
    this._ruleSetSnapshot = properties.ruleSetSnapshot;
    this._evaluationResultSnapshot = properties.evaluationResultSnapshot;
    this._decisionFingerprintSnapshot = properties.decisionFingerprintSnapshot;
    this._lifecycleSnapshot = properties.lifecycleSnapshot;
    this._capturedAt = properties.capturedAt;
  }

  get snapshotId(): string {
    return this._snapshotId;
  }

  get policyReferenceSnapshot(): PolicyReference {
    return this._policyReferenceSnapshot;
  }

  get definitionSnapshot(): PolicyDefinition {
    return this._definitionSnapshot;
  }

  get metadataSnapshot(): PolicyMetadata {
    return this._metadataSnapshot;
  }

  get ruleSetSnapshot(): PolicyRuleSet {
    return this._ruleSetSnapshot;
  }

  get evaluationResultSnapshot(): PolicyEvaluationResult | null {
    return this._evaluationResultSnapshot;
  }

  get decisionFingerprintSnapshot(): DecisionFingerprint | null {
    return this._decisionFingerprintSnapshot;
  }

  get lifecycleSnapshot(): PolicyLifecycleState {
    return this._lifecycleSnapshot;
  }

  get capturedAt(): Date {
    return this._capturedAt;
  }
}

// 3. Domain Events
export const POLICY_REGISTERED = "POLICY_REGISTERED";
export const POLICY_VALIDATED = "POLICY_VALIDATED";
export const POLICY_PUBLISHED = "POLICY_PUBLISHED";
export const POLICY_ARCHIVED = "POLICY_ARCHIVED";
export const POLICY_EVALUATED = "POLICY_EVALUATED";

export type PolicyDomainEventName =
  | typeof POLICY_REGISTERED
  | typeof POLICY_VALIDATED
  | typeof POLICY_PUBLISHED
  | typeof POLICY_ARCHIVED
  | typeof POLICY_EVALUATED;

export interface PolicyRegisteredEvent {
  readonly eventType: typeof POLICY_REGISTERED;
  readonly policyId: string;
  readonly reference: string;
  readonly snapshotId: string;
  readonly ownerId: string;
}

export interface PolicyValidatedEvent {
  readonly eventType: typeof POLICY_VALIDATED;
  readonly policyId: string;
  readonly reference: string;
  readonly snapshotId: string;
  readonly ownerId: string;
}

export interface PolicyPublishedEvent {
  readonly eventType: typeof POLICY_PUBLISHED;
  readonly policyId: string;
  readonly reference: string;
  readonly snapshotId: string;
  readonly ownerId: string;
}

export interface PolicyArchivedEvent {
  readonly eventType: typeof POLICY_ARCHIVED;
  readonly policyId: string;
  readonly reference: string;
  readonly snapshotId: string;
  readonly ownerId: string;
}

export interface PolicyEvaluatedEvent {
  readonly eventType: typeof POLICY_EVALUATED;
  readonly policyId: string;
  readonly reference: string;
  readonly snapshotId: string;
  readonly ownerId: string;
}

export type PolicyDomainEvent =
  | PolicyRegisteredEvent
  | PolicyValidatedEvent
  | PolicyPublishedEvent
  | PolicyArchivedEvent
  | PolicyEvaluatedEvent;

export interface PolicyEventPublisher {
  publish(event: PolicyDomainEvent): Promise<void>;
}

// 4. Query-Side Projection
export interface PolicyQueryProjection {
  readonly id: string;
  readonly reference: string;
  readonly ownerId: string;
  readonly displayName: string;
  readonly status: PolicyLifecycleState;
  readonly updatedAt: Date;
}

// 5. Persistence Interfaces
export interface PolicyPersistenceContract {
  checkUniqueReference(
    ownerId: string,
    reference: string,
    excludePolicyId?: string,
  ): Promise<boolean>;
}

export interface PolicyAggregateStore {
  save(policy: Policy): Promise<void>;
  findById(id: string, ownerId: string): Promise<Policy | null>;
  findByReference(reference: string, ownerId: string): Promise<Policy | null>;
}

// 6. Policy Properties
export interface PolicyProperties {
  id: string;
  reference: PolicyReference;
  ownerId: string;
  definition: PolicyDefinition;
  metadata: PolicyMetadata;
  ruleSet: PolicyRuleSet;
  evaluationResult: PolicyEvaluationResult | null;
  decisionFingerprint: DecisionFingerprint | null;
  snapshots: PolicySnapshot[];
  status: PolicyLifecycleState;
  createdAt: Date;
  updatedAt: Date;
}

// 7. Policy Aggregate Root
export class Policy {
  private readonly _id: string;
  private readonly _reference: PolicyReference;
  private readonly _ownerId: string;
  private readonly _definition: PolicyDefinition;
  private _metadata: PolicyMetadata;
  private readonly _ruleSet: PolicyRuleSet;
  private _evaluationResult: PolicyEvaluationResult | null = null;
  private _decisionFingerprint: DecisionFingerprint | null = null;
  private _snapshots: PolicySnapshot[] = [];
  private _status: PolicyLifecycleState;
  private readonly _createdAt: Date;
  private _updatedAt: Date;
  private _domainEvents: PolicyDomainEvent[] = [];

  constructor(properties: PolicyProperties) {
    if (!properties.id || properties.id.trim() === "") {
      throw new Error("Policy Identity is required.");
    }
    if (!properties.reference) {
      throw new Error("Policy Reference is required.");
    }
    if (!properties.ownerId || properties.ownerId.trim() === "") {
      throw new Error("Owner Reference is required.");
    }
    if (!properties.definition) {
      throw new Error("Policy Definition is required.");
    }
    if (!properties.metadata) {
      throw new Error("Policy Metadata is required.");
    }
    if (!properties.ruleSet) {
      throw new Error("Policy Rule Set is required.");
    }
    if (!properties.snapshots || properties.snapshots.length === 0) {
      throw new Error("Snapshot history must not be empty.");
    }
    if (!properties.status) {
      throw new Error("Policy Lifecycle State is required.");
    }

    this._id = properties.id;
    this._reference = properties.reference;
    this._ownerId = properties.ownerId;
    this._definition = properties.definition;
    this._metadata = properties.metadata;
    this._ruleSet = properties.ruleSet;
    this._evaluationResult = properties.evaluationResult;
    this._decisionFingerprint = properties.decisionFingerprint;
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

  get definition(): PolicyDefinition {
    return this._definition;
  }

  get metadata(): PolicyMetadata {
    return this._metadata;
  }

  get ruleSet(): PolicyRuleSet {
    return this._ruleSet;
  }

  get evaluationResult(): PolicyEvaluationResult | null {
    return this._evaluationResult;
  }

  get decisionFingerprint(): DecisionFingerprint | null {
    return this._decisionFingerprint;
  }

  get snapshots(): ReadonlyArray<PolicySnapshot> {
    return Object.freeze([...this._snapshots]);
  }

  get status(): PolicyLifecycleState {
    return this._status;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }

  get domainEvents(): ReadonlyArray<PolicyDomainEvent> {
    return this._domainEvents;
  }

  /**
   * Dedicated helper abstraction to retrieve the latest snapshot from history.
   */
  get latestSnapshot(): PolicySnapshot {
    if (this._snapshots.length === 0) {
      throw new Error("Invalid aggregate state: snapshots history is empty.");
    }
    return this._snapshots[this._snapshots.length - 1]!;
  }

  public clearDomainEvents(): void {
    this._domainEvents = [];
  }

  private addDomainEvent(event: PolicyDomainEvent): void {
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
    definition: PolicyDefinition,
    metadata: PolicyMetadata,
    ruleSet: PolicyRuleSet,
    initialSnapshotId: string,
  ): Policy {
    const reference = new PolicyReference(referenceValue);
    const now = new Date();
    const initialSnapshot = new PolicySnapshot({
      snapshotId: initialSnapshotId,
      policyReferenceSnapshot: reference,
      definitionSnapshot: definition,
      metadataSnapshot: metadata,
      ruleSetSnapshot: ruleSet,
      evaluationResultSnapshot: null,
      decisionFingerprintSnapshot: null,
      lifecycleSnapshot: "Draft",
      capturedAt: now,
    });

    const policy = new Policy({
      id,
      reference,
      ownerId,
      definition,
      metadata,
      ruleSet,
      evaluationResult: null,
      decisionFingerprint: null,
      snapshots: [initialSnapshot],
      status: "Draft",
      createdAt: now,
      updatedAt: now,
    });

    policy.addDomainEvent({
      eventType: POLICY_REGISTERED,
      policyId: policy.id,
      reference: policy.reference,
      snapshotId: initialSnapshotId,
      ownerId: policy.ownerId,
    });

    return policy;
  }

  // Domain Operations
  /**
   * Replaces the metadata of the aggregate.
   *
   * Mutation Rules:
   * - Must verify caller ownership.
   * - Operation is restricted strictly to the "Draft" lifecycle state.
   */
  public replaceMetadata(actorOwnerId: string, metadata: PolicyMetadata): void {
    this.verifyOwnership(actorOwnerId);
    if (this._status !== "Draft") {
      throw new Error("Cannot replace metadata when in status: " + this._status);
    }
    this._metadata = metadata;
    this._updatedAt = new Date();
  }

  /**
   * Validates the Policy definition and transitions to Validated status.
   */
  public validate(actorOwnerId: string): void {
    this.verifyOwnership(actorOwnerId);
    if (this._status !== "Draft") {
      throw new Error("Cannot validate policy when in status: " + this._status);
    }

    this._status = "Validated";
    this._updatedAt = new Date();

    this.addDomainEvent({
      eventType: POLICY_VALIDATED,
      policyId: this._id,
      reference: this._reference.value,
      snapshotId: this.latestSnapshot.snapshotId,
      ownerId: this._ownerId,
    });
  }

  /**
   * Publishes the Policy definition and transitions to Published status.
   */
  public publish(actorOwnerId: string): void {
    this.verifyOwnership(actorOwnerId);
    if (this._status !== "Validated") {
      throw new Error("Cannot publish policy when in status: " + this._status);
    }

    this._status = "Published";
    this._updatedAt = new Date();

    this.addDomainEvent({
      eventType: POLICY_PUBLISHED,
      policyId: this._id,
      reference: this._reference.value,
      snapshotId: this.latestSnapshot.snapshotId,
      ownerId: this._ownerId,
    });
  }

  /**
   * Archives the Policy definition and transitions to Archived status.
   */
  public archive(actorOwnerId: string): void {
    this.verifyOwnership(actorOwnerId);
    if (this._status === "Archived") {
      throw new Error("Policy is already archived.");
    }

    this._status = "Archived";
    this._updatedAt = new Date();

    this.addDomainEvent({
      eventType: POLICY_ARCHIVED,
      policyId: this._id,
      reference: this._reference.value,
      snapshotId: this.latestSnapshot.snapshotId,
      ownerId: this._ownerId,
    });
  }

  /**
   * Evaluates the policy, updating evaluation result and decision fingerprint without mutating core definitions.
   *
   * Rules:
   * - Must verify caller ownership.
   * - Operation is restricted strictly to the "Published" lifecycle state.
   */
  public evaluate(
    actorOwnerId: string,
    newSnapshotId: string,
    evaluationResult: PolicyEvaluationResult,
    decisionFingerprint: DecisionFingerprint,
  ): void {
    this.verifyOwnership(actorOwnerId);
    if (this._status !== "Published") {
      throw new Error("Cannot evaluate policy when in status: " + this._status);
    }

    this._evaluationResult = evaluationResult;
    this._decisionFingerprint = decisionFingerprint;
    this._updatedAt = new Date();

    const newSnapshot = new PolicySnapshot({
      snapshotId: newSnapshotId,
      policyReferenceSnapshot: this._reference,
      definitionSnapshot: this._definition,
      metadataSnapshot: this._metadata,
      ruleSetSnapshot: this._ruleSet,
      evaluationResultSnapshot: this._evaluationResult,
      decisionFingerprintSnapshot: this._decisionFingerprint,
      lifecycleSnapshot: this._status,
      capturedAt: new Date(),
    });

    this._snapshots.push(newSnapshot);

    this.addDomainEvent({
      eventType: POLICY_EVALUATED,
      policyId: this._id,
      reference: this._reference.value,
      snapshotId: newSnapshotId,
      ownerId: this._ownerId,
    });
  }
}
