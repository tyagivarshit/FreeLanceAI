// 1. Lifecycle States
export var ScopeExtractionLifecycle;
(function (ScopeExtractionLifecycle) {
    ScopeExtractionLifecycle["DRAFT"] = "DRAFT";
    ScopeExtractionLifecycle["EXTRACTED"] = "EXTRACTED";
    ScopeExtractionLifecycle["COMMITTED"] = "COMMITTED";
    ScopeExtractionLifecycle["ARCHIVED"] = "ARCHIVED";
})(ScopeExtractionLifecycle || (ScopeExtractionLifecycle = {}));
function deepFreeze(obj) {
    if (obj === null || typeof obj !== "object") {
        return obj;
    }
    Object.freeze(obj);
    Object.keys(obj).forEach((key) => {
        const val = obj[key];
        if (val !== null && typeof val === "object") {
            deepFreeze(val);
        }
    });
    return obj;
}
export class ScopeFactType {
    _value;
    constructor(value) {
        if (!value || value.trim() === "") {
            throw new Error("Fact type is required.");
        }
        const cleanValue = value.trim().toUpperCase();
        const validTypes = [
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
        if (!validTypes.includes(cleanValue)) {
            throw new Error(`Unsupported fact type: ${value}`);
        }
        this._value = cleanValue;
        Object.freeze(this);
    }
    get value() {
        return this._value;
    }
    equals(other) {
        if (!other) {
            return false;
        }
        return this._value === other.value;
    }
}
export class ScopeFactValue {
    _description;
    _parameters;
    constructor(properties) {
        if (!properties.description || properties.description.trim() === "") {
            throw new Error("Fact value description is required.");
        }
        this._description = properties.description.trim();
        if (properties.parameters) {
            this._parameters = deepFreeze(JSON.parse(JSON.stringify(properties.parameters)));
        }
        Object.freeze(this);
    }
    get description() {
        return this._description;
    }
    get parameters() {
        return this._parameters;
    }
}
export class ScopeSourceReference {
    _sourceId;
    _sourceType;
    _locationReference;
    constructor(properties) {
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
    get sourceId() {
        return this._sourceId;
    }
    get sourceType() {
        return this._sourceType;
    }
    get locationReference() {
        return this._locationReference;
    }
}
export class ScopeEvidence {
    _sourceReference;
    _contentSnippet;
    _locationRange;
    constructor(properties) {
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
    get sourceReference() {
        return this._sourceReference;
    }
    get contentSnippet() {
        return this._contentSnippet;
    }
    get locationRange() {
        return this._locationRange;
    }
}
export class ScopeFact {
    _factId;
    _factType;
    _factValue;
    _sourceReference;
    _evidence;
    _metadata;
    constructor(properties) {
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
    get factId() {
        return this._factId;
    }
    get factType() {
        return this._factType;
    }
    get factValue() {
        return this._factValue;
    }
    get sourceReference() {
        return this._sourceReference;
    }
    get evidence() {
        return this._evidence;
    }
    get metadata() {
        return this._metadata;
    }
}
export class ScopeExtractionSnapshot {
    _version;
    _facts;
    _timestamp;
    _state;
    constructor(properties) {
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
    get version() {
        return this._version;
    }
    get facts() {
        return Object.freeze([...this._facts]);
    }
    get timestamp() {
        return new Date(this._timestamp.getTime());
    }
    get state() {
        return this._state;
    }
}
export class ScopeExtractionDraftedEvent {
    aggregateId;
    eventName = "SCOPE_EXTRACTION_DRAFTED";
    timestamp;
    payload;
    constructor(aggregateId, clientReference, timestamp) {
        this.aggregateId = aggregateId;
        this.timestamp = new Date(timestamp.getTime());
        this.payload = { clientReference };
        Object.freeze(this.payload);
        Object.freeze(this);
    }
}
export class ScopeExtractionCompletedEvent {
    aggregateId;
    eventName = "SCOPE_EXTRACTION_COMPLETED";
    timestamp;
    payload;
    constructor(aggregateId, factsCount, timestamp) {
        this.aggregateId = aggregateId;
        this.timestamp = new Date(timestamp.getTime());
        this.payload = { factsCount };
        Object.freeze(this.payload);
        Object.freeze(this);
    }
}
export class ScopeExtractionCommittedEvent {
    aggregateId;
    eventName = "SCOPE_EXTRACTION_COMMITTED";
    timestamp;
    payload = {};
    constructor(aggregateId, timestamp) {
        this.aggregateId = aggregateId;
        this.timestamp = new Date(timestamp.getTime());
        Object.freeze(this.payload);
        Object.freeze(this);
    }
}
export class ScopeExtractionArchivedEvent {
    aggregateId;
    eventName = "SCOPE_EXTRACTION_ARCHIVED";
    timestamp;
    payload = {};
    constructor(aggregateId, timestamp) {
        this.aggregateId = aggregateId;
        this.timestamp = new Date(timestamp.getTime());
        Object.freeze(this.payload);
        Object.freeze(this);
    }
}
export class ScopeExtraction {
    _extractionId;
    _clientReference;
    _facts;
    _snapshots;
    _state;
    _domainEvents = [];
    constructor(properties) {
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
    get extractionId() {
        return this._extractionId;
    }
    get clientReference() {
        return this._clientReference;
    }
    get facts() {
        return Object.freeze([...this._facts]);
    }
    get snapshots() {
        return Object.freeze([...this._snapshots]);
    }
    get state() {
        return this._state;
    }
    get domainEvents() {
        return Object.freeze([...this._domainEvents]);
    }
    clearEvents() {
        this._domainEvents = [];
    }
    static draft(extractionId, clientReference) {
        const extraction = new ScopeExtraction({
            extractionId,
            clientReference,
            facts: [],
            snapshots: [],
            state: ScopeExtractionLifecycle.DRAFT,
        });
        extraction._domainEvents.push(new ScopeExtractionDraftedEvent(extractionId, clientReference, new Date()));
        return extraction;
    }
    addFact(fact) {
        if (this._state === ScopeExtractionLifecycle.COMMITTED ||
            this._state === ScopeExtractionLifecycle.ARCHIVED) {
            throw new Error(`Cannot add fact in state: ${this._state}`);
        }
        // Prevent duplicate fact IDs
        const exists = this._facts.some((f) => f.factId === fact.factId);
        if (exists) {
            throw new Error(`Fact with identifier ${fact.factId} already exists.`);
        }
        this._facts.push(fact);
    }
    removeFact(factId) {
        if (this._state === ScopeExtractionLifecycle.COMMITTED ||
            this._state === ScopeExtractionLifecycle.ARCHIVED) {
            throw new Error(`Cannot remove fact in state: ${this._state}`);
        }
        const index = this._facts.findIndex((f) => f.factId === factId);
        if (index === -1) {
            throw new Error(`Fact with identifier ${factId} not found.`);
        }
        this._facts.splice(index, 1);
    }
    completeExtraction() {
        if (this._state !== ScopeExtractionLifecycle.DRAFT) {
            throw new Error(`Invalid lifecycle transition from ${this._state} to EXTRACTED.`);
        }
        this._state = ScopeExtractionLifecycle.EXTRACTED;
        this._domainEvents.push(new ScopeExtractionCompletedEvent(this._extractionId, this._facts.length, new Date()));
        this.createSnapshot();
    }
    commitExtraction() {
        if (this._state !== ScopeExtractionLifecycle.EXTRACTED) {
            throw new Error(`Invalid lifecycle transition from ${this._state} to COMMITTED.`);
        }
        this._state = ScopeExtractionLifecycle.COMMITTED;
        this._domainEvents.push(new ScopeExtractionCommittedEvent(this._extractionId, new Date()));
        this.createSnapshot();
    }
    archiveExtraction() {
        if (this._state === ScopeExtractionLifecycle.ARCHIVED) {
            throw new Error("Aggregate is already archived.");
        }
        this._state = ScopeExtractionLifecycle.ARCHIVED;
        this._domainEvents.push(new ScopeExtractionArchivedEvent(this._extractionId, new Date()));
        this.createSnapshot();
    }
    createSnapshot() {
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
