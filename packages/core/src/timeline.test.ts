import { test, describe } from "node:test";
import assert from "node:assert";
import {
  ClientTimeline,
  TimelineEntry,
  TIMELINE_ENTRY_APPENDED,
  TIMELINE_ARCHIVED,
} from "./timeline.js";
import type { TimelineAggregateStore } from "./timeline.js";

describe("Client Timeline Aggregate & Entry Invariants Tests", () => {
  test("Client Timeline creation (Initial state is Initialized, no entries, no events)", () => {
    const timeline = ClientTimeline.create("timeline-1", "client-1", "owner-1");
    assert.strictEqual(timeline.timelineId, "timeline-1");
    assert.strictEqual(timeline.clientId, "client-1");
    assert.strictEqual(timeline.ownerId, "owner-1");
    assert.strictEqual(timeline.status, "Initialized");
    assert.strictEqual(timeline.entries.length, 0);
    assert.strictEqual(timeline.domainEvents.length, 0);
  });

  test("Creation validations (Client ID and Owner ID are required)", () => {
    assert.throws(() => {
      new ClientTimeline({
        timelineId: "timeline-1",
        clientId: "",
        ownerId: "owner-1",
        status: "Initialized",
        entries: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }, /Client ID reference is required/);

    assert.throws(() => {
      new ClientTimeline({
        timelineId: "timeline-1",
        clientId: "client-1",
        ownerId: "  ",
        status: "Initialized",
        entries: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }, /Owner ID reference is required/);
  });

  test("Append entry success: transitions to Active on first append, assigns visibility, generates TIMELINE_ENTRY_APPENDED", () => {
    const timeline = ClientTimeline.create("timeline-1", "client-1", "owner-1");

    timeline.appendEntry("owner-1", "actor-1", {
      entryId: "entry-1",
      category: "Lifecycle Event",
      timestamp: new Date(),
      metadata: { info: "Init lead event" },
      visibility: "Public",
    });

    assert.strictEqual(timeline.status, "Active");
    assert.strictEqual(timeline.entries.length, 1);

    const entry = timeline.entries[0]!;
    assert.strictEqual(entry.entryId, "entry-1");
    assert.strictEqual(entry.category, "Lifecycle Event");
    assert.strictEqual(entry.visibility, "Public");
    assert.strictEqual(entry.actorRef, "actor-1");
    assert.strictEqual(entry.metadata.info, "Init lead event");

    assert.strictEqual(timeline.domainEvents.length, 1);
    assert.strictEqual(timeline.domainEvents[0]!.event, TIMELINE_ENTRY_APPENDED);
    assert.strictEqual(timeline.domainEvents[0]!.metadata.entryId, "entry-1");
  });

  test("Ownership validation fails when appending/archiving/reactivating with wrong OwnerId", () => {
    const timeline = ClientTimeline.create("timeline-1", "client-1", "owner-1");

    assert.throws(() => {
      timeline.appendEntry("owner-wrong", "actor-1", {
        entryId: "entry-1",
        category: "Lifecycle Event",
        timestamp: new Date(),
        metadata: {},
        visibility: "Public",
      });
    }, /Ownership validation failed/);

    assert.throws(() => {
      timeline.archive("owner-wrong", "actor-1");
    }, /Ownership validation failed/);

    assert.throws(() => {
      timeline.reactivate("owner-wrong", "actor-1");
    }, /Ownership validation failed/);
  });

  test("Monotonic chronology invariant: appending older timestamp fails", () => {
    const timeline = ClientTimeline.create("timeline-1", "client-1", "owner-1");
    const now = Date.now();

    timeline.appendEntry("owner-1", "actor-1", {
      entryId: "entry-1",
      category: "Communication Event",
      timestamp: new Date(now),
      metadata: {},
      visibility: "Public",
    });

    // Attempt to append with older timestamp
    assert.throws(() => {
      timeline.appendEntry("owner-1", "actor-1", {
        entryId: "entry-2",
        category: "Annotation Event",
        timestamp: new Date(now - 1000),
        metadata: {},
        visibility: "Internal",
      });
    }, /Event timestamp must be monotonic/);
  });

  test("Future timestamp invariant: appending future date fails", () => {
    const timeline = ClientTimeline.create("timeline-1", "client-1", "owner-1");

    assert.throws(() => {
      timeline.appendEntry("owner-1", "actor-1", {
        entryId: "entry-1",
        category: "Communication Event",
        timestamp: new Date(Date.now() + 100000),
        metadata: {},
        visibility: "Public",
      });
    }, /Event timestamp cannot be in the future/);
  });

  test("Archiving timeline transitions to ReadOnly, blocks further appends, emits TIMELINE_ARCHIVED", () => {
    const timeline = ClientTimeline.create("timeline-1", "client-1", "owner-1");
    timeline.appendEntry("owner-1", "actor-1", {
      entryId: "entry-1",
      category: "Lifecycle Event",
      timestamp: new Date(),
      metadata: {},
      visibility: "Public",
    });

    timeline.clearDomainEvents();

    timeline.archive("owner-1", "actor-1");
    assert.strictEqual(timeline.status, "ReadOnly");
    assert.strictEqual(timeline.domainEvents.length, 1);
    assert.strictEqual(timeline.domainEvents[0]!.event, TIMELINE_ARCHIVED);

    // Attempt append in ReadOnly state fails
    assert.throws(() => {
      timeline.appendEntry("owner-1", "actor-1", {
        entryId: "entry-2",
        category: "Communication Event",
        timestamp: new Date(),
        metadata: {},
        visibility: "Public",
      });
    }, /Cannot append to a read-only timeline/);
  });

  test("Reactivation transitions ReadOnly back to Active", () => {
    const timeline = ClientTimeline.create("timeline-1", "client-1", "owner-1");
    timeline.archive("owner-1", "actor-1");
    assert.strictEqual(timeline.status, "ReadOnly");

    timeline.reactivate("owner-1", "actor-1");
    assert.strictEqual(timeline.status, "Active");
  });

  test("Logical sequence chronology validation on initialization", () => {
    const now = new Date();
    const entry1 = new TimelineEntry({
      entryId: "entry-1",
      category: "Lifecycle Event",
      timestamp: now,
      metadata: {},
      actorRef: "actor-1",
      visibility: "Public",
    });

    const entry2 = new TimelineEntry({
      entryId: "entry-2",
      category: "Communication Event",
      timestamp: new Date(now.getTime() - 1000),
      metadata: {},
      actorRef: "actor-1",
      visibility: "Public",
    });

    assert.throws(() => {
      new ClientTimeline({
        timelineId: "timeline-1",
        clientId: "client-1",
        ownerId: "owner-1",
        status: "Active",
        entries: [entry1, entry2],
        createdAt: now,
        updatedAt: now,
      });
    }, /entries must be in chronological order/);
  });

  test("Mock aggregate store abstraction compliance", async () => {
    const timeline = ClientTimeline.create("timeline-1", "client-1", "owner-1");
    let saveCalled = false;

    const mockStore: TimelineAggregateStore = {
      async save(t) {
        assert.strictEqual(t.timelineId, "timeline-1");
        saveCalled = true;
      },
      async findById(id, ownerId) {
        assert.strictEqual(id, "timeline-1");
        assert.strictEqual(ownerId, "owner-1");
        return timeline;
      },
      async findByClientId(clientId, ownerId) {
        assert.strictEqual(clientId, "client-1");
        assert.strictEqual(ownerId, "owner-1");
        return timeline;
      },
    };

    await mockStore.save(timeline);
    assert.strictEqual(saveCalled, true);

    const fetched = await mockStore.findById("timeline-1", "owner-1");
    assert.strictEqual(fetched, timeline);
  });
});
