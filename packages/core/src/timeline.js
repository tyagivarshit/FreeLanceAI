// Logical Domain Event Constants
export const TIMELINE_ENTRY_APPENDED = "TIMELINE_ENTRY_APPENDED";
export const TIMELINE_ARCHIVED = "TIMELINE_ARCHIVED";
export class TimelineEntry {
    _entryId;
    _sequenceNumber;
    _eventRef;
    _category;
    _timestamp;
    _metadata;
    _actorRef;
    _visibility;
    constructor(properties) {
        if (!properties.entryId || properties.entryId.trim() === "") {
            throw new Error("Entry ID is required.");
        }
        if (!properties.actorRef || properties.actorRef.trim() === "") {
            throw new Error("Actor reference is required.");
        }
        this._entryId = properties.entryId;
        if (properties.sequenceNumber !== undefined) {
            this._sequenceNumber = properties.sequenceNumber;
        }
        this._eventRef = properties.eventRef;
        this._category = properties.category;
        this._timestamp = properties.timestamp;
        // Deep copy metadata to preserve immutability
        this._metadata = JSON.parse(JSON.stringify(properties.metadata));
        this._actorRef = properties.actorRef;
        this._visibility = properties.visibility;
    }
    get entryId() {
        return this._entryId;
    }
    get sequenceNumber() {
        return this._sequenceNumber;
    }
    get eventRef() {
        return this._eventRef;
    }
    get category() {
        return this._category;
    }
    get timestamp() {
        return this._timestamp;
    }
    get metadata() {
        return JSON.parse(JSON.stringify(this._metadata));
    }
    get actorRef() {
        return this._actorRef;
    }
    get visibility() {
        return this._visibility;
    }
}
export class ClientTimeline {
    _timelineId;
    _clientId;
    _tenantId;
    _ownerId;
    _status;
    _entries;
    _createdAt;
    _updatedAt;
    _domainEvents = [];
    constructor(properties) {
        if (!properties.timelineId || properties.timelineId.trim() === "") {
            throw new Error("Timeline ID is required.");
        }
        if (!properties.clientId || properties.clientId.trim() === "") {
            throw new Error("Client ID reference is required.");
        }
        if (!properties.tenantId || properties.tenantId.trim() === "") {
            throw new Error("Tenant ID reference is required.");
        }
        this._timelineId = properties.timelineId;
        this._clientId = properties.clientId;
        this._tenantId = properties.tenantId;
        this._ownerId = properties.ownerId;
        this._status = properties.status;
        this._entries = [...properties.entries];
        this._createdAt = properties.createdAt;
        this._updatedAt = properties.updatedAt;
        this.validateInvariants();
    }
    get timelineId() {
        return this._timelineId;
    }
    get clientId() {
        return this._clientId;
    }
    get tenantId() {
        return this._tenantId;
    }
    get ownerId() {
        return this._ownerId;
    }
    get status() {
        return this._status;
    }
    get entries() {
        return [...this._entries];
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
    clearDomainEvents() {
        this._domainEvents = [];
    }
    addDomainEvent(event, metadata) {
        this._domainEvents.push({ event, metadata });
    }
    // Factory Creation Method
    static create(timelineId, clientId, tenantId, ownerId) {
        const now = new Date();
        return new ClientTimeline({
            timelineId,
            clientId,
            tenantId,
            ownerId,
            status: "Initialized",
            entries: [],
            createdAt: now,
            updatedAt: now,
        });
    }
    // Append new entry
    appendEntry(tenantId, actorId, properties) {
        this.verifyOwnership(tenantId);
        if (this._status === "ReadOnly") {
            throw new Error("Cannot append to a read-only timeline.");
        }
        // Invariant: No future timestamps
        if (properties.timestamp.getTime() > Date.now()) {
            throw new Error("Event timestamp cannot be in the future.");
        }
        // Idempotency: Ignore duplicate entry IDs to safely handle retries
        if (this._entries.some((entry) => entry.entryId === properties.entryId)) {
            return; // Silently ignore duplicate appending
        }
        // Invariant: Monotonic chronology
        if (this._entries.length > 0) {
            const latestEntry = this._entries[this._entries.length - 1];
            if (properties.timestamp.getTime() < latestEntry.timestamp.getTime()) {
                throw new Error("Event timestamp must be monotonic (cannot be older than previous entry).");
            }
        }
        const newEntry = new TimelineEntry({
            entryId: properties.entryId,
            eventRef: properties.eventRef,
            category: properties.category,
            timestamp: properties.timestamp,
            metadata: properties.metadata,
            actorRef: actorId,
            visibility: properties.visibility,
        });
        this._entries.push(newEntry);
        this._updatedAt = new Date();
        // Transition state from Initialized to Active on first append
        if (this._status === "Initialized") {
            this._status = "Active";
        }
        this.addDomainEvent(TIMELINE_ENTRY_APPENDED, {
            timelineId: this._timelineId,
            clientId: this._clientId,
            entryId: properties.entryId,
        });
    }
    // Archive entire timeline (transitions to ReadOnly)
    archive(tenantId, actorId) {
        this.verifyOwnership(tenantId);
        if (this._status === "ReadOnly") {
            return;
        }
        this._status = "ReadOnly";
        this._updatedAt = new Date();
        this.addDomainEvent(TIMELINE_ARCHIVED, {
            timelineId: this._timelineId,
            clientId: this._clientId,
            actorRef: actorId,
        });
    }
    // Reactivate timeline (ReadOnly -> Active)
    reactivate(tenantId, _actorId) {
        this.verifyOwnership(tenantId);
        if (this._status !== "ReadOnly") {
            return;
        }
        this._status = "Active";
        this._updatedAt = new Date();
    }
    verifyOwnership(tenantId) {
        if (tenantId !== this._tenantId) {
            throw new Error("Ownership validation failed.");
        }
    }
    validateInvariants() {
        if (!this._clientId || this._clientId.trim() === "") {
            throw new Error("Client ID reference is required.");
        }
        if (!this._tenantId || this._tenantId.trim() === "") {
            throw new Error("Tenant ID reference is required.");
        }
        // Stable Chronological Ordering
        for (let i = 1; i < this._entries.length; i++) {
            const prev = this._entries[i - 1];
            const curr = this._entries[i];
            if (curr.timestamp.getTime() < prev.timestamp.getTime()) {
                throw new Error("Immutability of sequence breached: entries must be in chronological order.");
            }
        }
    }
}
