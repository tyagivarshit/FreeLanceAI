// 2. Value Objects
/**
 * Encapsulates validation and representation of the dots-separated, lower-case Policy Reference.
 *
 * This value object is fully immutable.
 */
export class PolicyReference {
    _value;
    constructor(value) {
        if (!value || value.trim() === "") {
            throw new Error("Policy Reference is required.");
        }
        const referencePattern = /^[a-z0-9]+(\.[a-z0-9]+)*$/;
        if (!referencePattern.test(value)) {
            throw new Error("Invalid policy reference format. Must be lower-case dot-separated key.");
        }
        this._value = value.trim();
    }
    get value() {
        return this._value;
    }
    equals(other) {
        return this._value === other.value;
    }
}
/**
 * Represents the logical governance definition configuration of a Policy.
 *
 * This value object is fully immutable.
 */
export class PolicyDefinition {
    _governanceSpecification;
    constructor(governanceSpecification) {
        if (!governanceSpecification || governanceSpecification.trim() === "") {
            throw new Error("Governance specification is required.");
        }
        this._governanceSpecification = governanceSpecification.trim();
    }
    get governanceSpecification() {
        return this._governanceSpecification;
    }
    equals(other) {
        return this._governanceSpecification === other.governanceSpecification;
    }
}
/**
 * Represents metadata descriptive fields for the Policy.
 *
 * This value object is fully immutable.
 */
export class PolicyMetadata {
    _displayName;
    _description;
    _purpose;
    _policySummary;
    constructor(properties) {
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
    get displayName() {
        return this._displayName;
    }
    get description() {
        return this._description;
    }
    get purpose() {
        return this._purpose;
    }
    get policySummary() {
        return this._policySummary;
    }
    equals(other) {
        return (this._displayName === other.displayName &&
            this._description === other.description &&
            this._purpose === other.purpose &&
            this._policySummary === other.policySummary);
    }
}
/**
 * Represents the strategic logical constraints of the Policy.
 *
 * This value object is fully immutable.
 */
export class PolicyRuleSet {
    _logicalConstraints;
    _complianceCriteria;
    constructor(properties) {
        if (!properties.logicalConstraints || properties.logicalConstraints.length === 0) {
            throw new Error("Logical constraints must not be empty.");
        }
        if (!properties.complianceCriteria || properties.complianceCriteria.length === 0) {
            throw new Error("Compliance criteria must not be empty.");
        }
        this._logicalConstraints = [...properties.logicalConstraints];
        this._complianceCriteria = [...properties.complianceCriteria];
    }
    get logicalConstraints() {
        return Object.freeze([...this._logicalConstraints]);
    }
    get complianceCriteria() {
        return Object.freeze([...this._complianceCriteria]);
    }
    equals(other) {
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
/**
 * Represents the immutable result of evaluating a policy logical constraints ruleset.
 *
 * This value object is fully immutable.
 */
export class PolicyEvaluationResult {
    _decision;
    _reasonCode;
    _evaluationSummary;
    _evaluatedAt;
    constructor(properties) {
        if (!properties.decision) {
            throw new Error("Decision is required.");
        }
        if (properties.decision !== "ALLOW" &&
            properties.decision !== "REJECT" &&
            properties.decision !== "REQUIRES_REVIEW") {
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
    get decision() {
        return this._decision;
    }
    get reasonCode() {
        return this._reasonCode;
    }
    get evaluationSummary() {
        return this._evaluationSummary;
    }
    get evaluatedAt() {
        return this._evaluatedAt;
    }
    equals(other) {
        return (this._decision === other.decision &&
            this._reasonCode === other.reasonCode &&
            this._evaluationSummary === other.evaluationSummary &&
            this._evaluatedAt.getTime() === other.evaluatedAt.getTime());
    }
}
/**
 * Represents the logical identity of a governance decision.
 *
 * This value object is fully immutable. It owns only validation, equality, and logical
 * identity checks, and MUST NEVER expose hashes, algorithms, provider IDs, execution metadata,
 * or runtime data.
 */
export class DecisionFingerprint {
    _decisionIdentifier;
    _policyReferenceValue;
    _decisionType;
    constructor(properties) {
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
    get decisionIdentifier() {
        return this._decisionIdentifier;
    }
    get policyReferenceValue() {
        return this._policyReferenceValue;
    }
    get decisionType() {
        return this._decisionType;
    }
    equals(other) {
        return (this._decisionIdentifier === other.decisionIdentifier &&
            this._policyReferenceValue === other.policyReferenceValue &&
            this._decisionType === other.decisionType);
    }
}
/**
 * Represents a historical frozen snapshot of a Policy's state.
 *
 * This value object is fully immutable.
 */
export class PolicySnapshot {
    _snapshotId;
    _policyReferenceSnapshot;
    _definitionSnapshot;
    _metadataSnapshot;
    _ruleSetSnapshot;
    _evaluationResultSnapshot;
    _decisionFingerprintSnapshot;
    _lifecycleSnapshot;
    _capturedAt;
    constructor(properties) {
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
    get snapshotId() {
        return this._snapshotId;
    }
    get policyReferenceSnapshot() {
        return this._policyReferenceSnapshot;
    }
    get definitionSnapshot() {
        return this._definitionSnapshot;
    }
    get metadataSnapshot() {
        return this._metadataSnapshot;
    }
    get ruleSetSnapshot() {
        return this._ruleSetSnapshot;
    }
    get evaluationResultSnapshot() {
        return this._evaluationResultSnapshot;
    }
    get decisionFingerprintSnapshot() {
        return this._decisionFingerprintSnapshot;
    }
    get lifecycleSnapshot() {
        return this._lifecycleSnapshot;
    }
    get capturedAt() {
        return this._capturedAt;
    }
}
// 3. Domain Events
export const POLICY_REGISTERED = "POLICY_REGISTERED";
export const POLICY_VALIDATED = "POLICY_VALIDATED";
export const POLICY_PUBLISHED = "POLICY_PUBLISHED";
export const POLICY_ARCHIVED = "POLICY_ARCHIVED";
export const POLICY_EVALUATED = "POLICY_EVALUATED";
// 7. Policy Aggregate Root
export class Policy {
    _id;
    _reference;
    _ownerId;
    _definition;
    _metadata;
    _ruleSet;
    _evaluationResult = null;
    _decisionFingerprint = null;
    _snapshots = [];
    _status;
    _createdAt;
    _updatedAt;
    _domainEvents = [];
    constructor(properties) {
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
    get id() {
        return this._id;
    }
    get reference() {
        return this._reference.value;
    }
    get ownerId() {
        return this._ownerId;
    }
    get definition() {
        return this._definition;
    }
    get metadata() {
        return this._metadata;
    }
    get ruleSet() {
        return this._ruleSet;
    }
    get evaluationResult() {
        return this._evaluationResult;
    }
    get decisionFingerprint() {
        return this._decisionFingerprint;
    }
    get snapshots() {
        return Object.freeze([...this._snapshots]);
    }
    get status() {
        return this._status;
    }
    get createdAt() {
        return this._createdAt;
    }
    get updatedAt() {
        return this._updatedAt;
    }
    get domainEvents() {
        return this._domainEvents;
    }
    /**
     * Dedicated helper abstraction to retrieve the latest snapshot from history.
     */
    get latestSnapshot() {
        if (this._snapshots.length === 0) {
            throw new Error("Invalid aggregate state: snapshots history is empty.");
        }
        return this._snapshots[this._snapshots.length - 1];
    }
    clearDomainEvents() {
        this._domainEvents = [];
    }
    addDomainEvent(event) {
        this._domainEvents.push(event);
    }
    verifyOwnership(actorOwnerId) {
        if (!actorOwnerId || actorOwnerId.trim() === "") {
            throw new Error("Missing owner identity in caller context.");
        }
        if (actorOwnerId !== this._ownerId) {
            throw new Error("Ownership validation failed: unauthorized owner context.");
        }
    }
    // Domain Factory
    static create(id, referenceValue, ownerId, definition, metadata, ruleSet, initialSnapshotId) {
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
    replaceMetadata(actorOwnerId, metadata) {
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
    validate(actorOwnerId) {
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
    publish(actorOwnerId) {
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
    archive(actorOwnerId) {
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
    evaluate(actorOwnerId, newSnapshotId, evaluationResult, decisionFingerprint) {
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
