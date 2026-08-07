// Timeline Aggregate Statuses
export type TimelineStatus = "Initialized" | "Active" | "ReadOnly";

// Abstract Event Categories
export type TimelineEventCategory =
  | "Lifecycle Event"
  | "Communication Event"
  | "Annotation Event"
  | "Status Event"
  | "Audit Event";

// Visibility Classifications
export type VisibilityClassification = "Internal" | "Public";

// Logical Domain Event Constants
export const TIMELINE_ENTRY_APPENDED = "TIMELINE_ENTRY_APPENDED";
export const TIMELINE_ARCHIVED = "TIMELINE_ARCHIVED";

export type TimelineDomainEventName = typeof TIMELINE_ENTRY_APPENDED | typeof TIMELINE_ARCHIVED;

export interface TimelineEventPublisher {
  publish(event: TimelineDomainEventName, metadata: Record<string, unknown>): Promise<void>;
}

// Immutable Timeline Entry Value Object
export interface TimelineEntryProperties {
  entryId: string;
  eventRef?: string | undefined;
  category: TimelineEventCategory;
  timestamp: Date;
  metadata: Record<string, unknown>;
  actorRef: string;
  visibility: VisibilityClassification;
}

export class TimelineEntry {
  private readonly _entryId: string;
  private readonly _eventRef: string | undefined;
  private readonly _category: TimelineEventCategory;
  private readonly _timestamp: Date;
  private readonly _metadata: Record<string, unknown>;
  private readonly _actorRef: string;
  private readonly _visibility: VisibilityClassification;

  constructor(properties: TimelineEntryProperties) {
    if (!properties.entryId || properties.entryId.trim() === "") {
      throw new Error("Entry ID is required.");
    }
    if (!properties.actorRef || properties.actorRef.trim() === "") {
      throw new Error("Actor reference is required.");
    }
    this._entryId = properties.entryId;
    this._eventRef = properties.eventRef;
    this._category = properties.category;
    this._timestamp = properties.timestamp;
    // Deep copy metadata to preserve immutability
    this._metadata = JSON.parse(JSON.stringify(properties.metadata));
    this._actorRef = properties.actorRef;
    this._visibility = properties.visibility;
  }

  get entryId(): string {
    return this._entryId;
  }

  get eventRef(): string | undefined {
    return this._eventRef;
  }

  get category(): TimelineEventCategory {
    return this._category;
  }

  get timestamp(): Date {
    return this._timestamp;
  }

  get metadata(): Record<string, unknown> {
    return JSON.parse(JSON.stringify(this._metadata));
  }

  get actorRef(): string {
    return this._actorRef;
  }

  get visibility(): VisibilityClassification {
    return this._visibility;
  }
}

// Client Timeline Aggregate Root
export interface ClientTimelineProperties {
  timelineId: string;
  clientId: string;
  ownerId: string;
  status: TimelineStatus;
  entries: TimelineEntry[];
  createdAt: Date;
  updatedAt: Date;
}

export class ClientTimeline {
  private readonly _timelineId: string;
  private readonly _clientId: string;
  private readonly _ownerId: string;
  private _status: TimelineStatus;
  private readonly _entries: TimelineEntry[];
  private readonly _createdAt: Date;
  private _updatedAt: Date;
  private _domainEvents: Array<{
    event: TimelineDomainEventName;
    metadata: Record<string, unknown>;
  }> = [];

  constructor(properties: ClientTimelineProperties) {
    if (!properties.timelineId || properties.timelineId.trim() === "") {
      throw new Error("Timeline ID is required.");
    }
    if (!properties.clientId || properties.clientId.trim() === "") {
      throw new Error("Client ID reference is required.");
    }
    if (!properties.ownerId || properties.ownerId.trim() === "") {
      throw new Error("Owner ID reference is required.");
    }
    this._timelineId = properties.timelineId;
    this._clientId = properties.clientId;
    this._ownerId = properties.ownerId;
    this._status = properties.status;
    this._entries = [...properties.entries];
    this._createdAt = properties.createdAt;
    this._updatedAt = properties.updatedAt;

    this.validateInvariants();
  }

  get timelineId(): string {
    return this._timelineId;
  }

  get clientId(): string {
    return this._clientId;
  }

  get ownerId(): string {
    return this._ownerId;
  }

  get status(): TimelineStatus {
    return this._status;
  }

  get entries(): TimelineEntry[] {
    return [...this._entries];
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }

  get domainEvents() {
    return this._domainEvents;
  }

  public clearDomainEvents() {
    this._domainEvents = [];
  }

  private addDomainEvent(event: TimelineDomainEventName, metadata: Record<string, unknown>) {
    this._domainEvents.push({ event, metadata });
  }

  // Factory Creation Method
  public static create(timelineId: string, clientId: string, ownerId: string): ClientTimeline {
    const now = new Date();
    return new ClientTimeline({
      timelineId,
      clientId,
      ownerId,
      status: "Initialized",
      entries: [],
      createdAt: now,
      updatedAt: now,
    });
  }

  // Append new entry
  public appendEntry(
    ownerId: string,
    actorId: string,
    properties: {
      entryId: string;
      eventRef?: string | undefined;
      category: TimelineEventCategory;
      timestamp: Date;
      metadata: Record<string, unknown>;
      visibility: VisibilityClassification;
    },
  ) {
    this.verifyOwnership(ownerId);

    if (this._status === "ReadOnly") {
      throw new Error("Cannot append to a read-only timeline.");
    }

    // Invariant: No future timestamps
    if (properties.timestamp.getTime() > Date.now()) {
      throw new Error("Event timestamp cannot be in the future.");
    }

    // Invariant: Monotonic chronology
    if (this._entries.length > 0) {
      const latestEntry = this._entries[this._entries.length - 1]!;
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
  public archive(ownerId: string, actorId: string) {
    this.verifyOwnership(ownerId);

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
  public reactivate(ownerId: string, _actorId: string) {
    this.verifyOwnership(ownerId);

    if (this._status !== "ReadOnly") {
      return;
    }

    this._status = "Active";
    this._updatedAt = new Date();
  }

  private verifyOwnership(ownerId: string) {
    if (ownerId !== this._ownerId) {
      throw new Error("Ownership validation failed.");
    }
  }

  private validateInvariants() {
    if (!this._clientId || this._clientId.trim() === "") {
      throw new Error("Client ID reference is required.");
    }
    if (!this._ownerId || this._ownerId.trim() === "") {
      throw new Error("Owner ID reference is required.");
    }

    // Stable Chronological Ordering
    for (let i = 1; i < this._entries.length; i++) {
      const prev = this._entries[i - 1]!;
      const curr = this._entries[i]!;
      if (curr.timestamp.getTime() < prev.timestamp.getTime()) {
        throw new Error(
          "Immutability of sequence breached: entries must be in chronological order.",
        );
      }
    }
  }
}

// Domain Persistence Contract for the Aggregate Store
export interface TimelineAggregateStore {
  save(timeline: ClientTimeline): Promise<void>;
  findById(timelineId: string, ownerId: string): Promise<ClientTimeline | null>;
  findByClientId(clientId: string, ownerId: string): Promise<ClientTimeline | null>;
}
