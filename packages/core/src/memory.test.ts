import { test, describe } from "node:test";
import assert from "node:assert";
import {
  Memory,
  MemoryMetadata,
  MemoryRetentionRule,
  MemoryEntry,
  MemorySnapshot,
  MEMORY_REGISTERED,
  MEMORY_VALIDATED,
  MEMORY_PUBLISHED,
  MEMORY_ARCHIVED,
} from "./memory.js";
import type {
  MemoryAggregateStore,
  MemoryPersistenceContract,
  MemoryQueryProjection,
  MemoryDomainEvent,
} from "./memory.js";

describe("Memory Aggregate Root and Value Objects Domain Tests", () => {
  const defaultMetadata = new MemoryMetadata({
    displayName: "Client Profile Memory",
    description: "Retains client onboarding profiles.",
    purpose: "Provide logical context for assembly.",
    versionSummary: "v1 initial registration",
  });

  const alternativeMetadata = new MemoryMetadata({
    displayName: "Client Profile Memory - Updated",
    description: "Retains client profiles updated dynamically.",
    purpose: "Provide logical context for assembly.",
    versionSummary: "v2 updated registration",
  });

  const defaultRetentionRules = [
    new MemoryRetentionRule({ policyName: "ShortTermOnboarding", retentionDays: 30 }),
    new MemoryRetentionRule({ policyName: "LongTermCompliance", retentionDays: 365 }),
  ];

  const defaultEntry = new MemoryEntry({
    content: "Initial onboarding questionnaire data contents.",
    classification: "client.profile",
  });

  test("Memory creation success: state Draft, snapshots initialized, registered event emitted", () => {
    const memory = Memory.create(
      "mem-1",
      "client.profile.memory",
      "owner-123",
      defaultMetadata,
      defaultRetentionRules,
      "snap-1",
      defaultEntry,
    );

    assert.strictEqual(memory.id, "mem-1");
    assert.strictEqual(memory.reference, "client.profile.memory");
    assert.strictEqual(memory.ownerId, "owner-123");
    assert.strictEqual(memory.status, "Draft");
    assert.strictEqual(memory.metadata.displayName, "Client Profile Memory");

    // Collection validation
    assert.strictEqual(memory.snapshots.length, 1);
    assert.strictEqual(memory.snapshots[0]!.snapshotId, "snap-1");
    assert.strictEqual(
      memory.snapshots[0]!.entry.content,
      "Initial onboarding questionnaire data contents.",
    );
    assert.strictEqual(memory.snapshots[0]!.retentionRulesSnapshot.length, 2);
    assert.strictEqual(memory.retentionRules.length, 2);
    assert.strictEqual(memory.retentionRules[0]!.policyName, "ShortTermOnboarding");

    // Creation emits registration event
    assert.strictEqual(memory.domainEvents.length, 1);
    const event = memory.domainEvents[0] as MemoryDomainEvent;
    assert.strictEqual(event.eventType, MEMORY_REGISTERED);
    assert.strictEqual(event.memoryId, "mem-1");
    assert.strictEqual(event.reference, "client.profile.memory");
    assert.strictEqual(event.snapshotId, "snap-1");
    assert.strictEqual(event.ownerId, "owner-123");
  });

  test("Memory reference format validation rejects invalid keys", () => {
    assert.throws(() => {
      Memory.create(
        "mem-1",
        "client..memory",
        "owner-123",
        defaultMetadata,
        defaultRetentionRules,
        "snap-1",
        defaultEntry,
      );
    }, /Invalid memory reference format/);

    assert.throws(() => {
      Memory.create(
        "mem-1",
        "Client.memory",
        "owner-123",
        defaultMetadata,
        defaultRetentionRules,
        "snap-1",
        defaultEntry,
      );
    }, /Invalid memory reference format/);
  });

  test("Ownership validation blocks unauthorized owners", () => {
    const memory = Memory.create(
      "mem-1",
      "client.profile.memory",
      "owner-123",
      defaultMetadata,
      defaultRetentionRules,
      "snap-1",
      defaultEntry,
    );

    assert.throws(() => {
      memory.replaceMetadata("unauthorized-owner", alternativeMetadata);
    }, /Ownership validation failed: unauthorized owner context/);

    assert.throws(() => {
      memory.appendSnapshot("unauthorized-owner", "snap-2", defaultEntry, defaultMetadata);
    }, /Ownership validation failed: unauthorized owner context/);

    assert.throws(() => {
      memory.validate("unauthorized-owner");
    }, /Ownership validation failed: unauthorized owner context/);
  });

  test("Missing owner throws error", () => {
    const memory = Memory.create(
      "mem-1",
      "client.profile.memory",
      "owner-123",
      defaultMetadata,
      defaultRetentionRules,
      "snap-1",
      defaultEntry,
    );

    assert.throws(() => {
      memory.replaceMetadata("", alternativeMetadata);
    }, /Missing owner identity in caller context/);
  });

  test("Memory metadata replacement verification", () => {
    const memory = Memory.create(
      "mem-1",
      "client.profile.memory",
      "owner-123",
      defaultMetadata,
      defaultRetentionRules,
      "snap-1",
      defaultEntry,
    );

    memory.replaceMetadata("owner-123", alternativeMetadata);
    assert.strictEqual(memory.metadata.equals(alternativeMetadata), true);
  });

  test("Append snapshot to history: status unchanged, snapshot collection has append-only behavior", () => {
    const memory = Memory.create(
      "mem-1",
      "client.profile.memory",
      "owner-123",
      defaultMetadata,
      defaultRetentionRules,
      "snap-1",
      defaultEntry,
    );

    const newEntry = new MemoryEntry({
      content: "Revised questionnaire details.",
      classification: "client.profile",
    });

    memory.appendSnapshot("owner-123", "snap-2", newEntry, alternativeMetadata);

    assert.strictEqual(memory.snapshots.length, 2);
    assert.strictEqual(memory.snapshots[0]!.snapshotId, "snap-1");
    assert.strictEqual(memory.snapshots[1]!.snapshotId, "snap-2");
    assert.strictEqual(memory.snapshots[1]!.entry.equals(newEntry), true);
    assert.strictEqual(memory.snapshots[1]!.retentionRulesSnapshot.length, 2);

    // Verify snapshot collection immutability from outside
    const outsideSnapshots = memory.snapshots;
    assert.throws(() => {
      (outsideSnapshots as unknown as MemorySnapshot[]).push(
        new MemorySnapshot({
          snapshotId: "snap-hack",
          entry: defaultEntry,
          metadataSnapshot: defaultMetadata,
          retentionRulesSnapshot: defaultRetentionRules,
          capturedAt: new Date(),
        }),
      );
    });
    assert.strictEqual(memory.snapshots.length, 2);
  });

  test("Lifecycle flow: Draft -> Validated -> Published -> Archived", () => {
    const memory = Memory.create(
      "mem-1",
      "client.profile.memory",
      "owner-123",
      defaultMetadata,
      defaultRetentionRules,
      "snap-1",
      defaultEntry,
    );

    // 1. Validate Draft
    memory.clearDomainEvents();
    memory.validate("owner-123");
    assert.strictEqual(memory.status, "Validated");
    assert.strictEqual(memory.domainEvents.length, 1);
    const validatedEvent = memory.domainEvents[0] as MemoryDomainEvent;
    assert.strictEqual(validatedEvent.eventType, MEMORY_VALIDATED);
    assert.strictEqual(validatedEvent.memoryId, "mem-1");
    assert.strictEqual(validatedEvent.reference, "client.profile.memory");
    assert.strictEqual(validatedEvent.snapshotId, "snap-1");
    assert.strictEqual(validatedEvent.ownerId, "owner-123");

    // Cannot validate again
    assert.throws(() => {
      memory.validate("owner-123");
    }, /Cannot validate memory when in status: Validated/);

    // 2. Publish Validated Memory
    memory.clearDomainEvents();
    memory.publish("owner-123");
    assert.strictEqual(memory.status, "Published");
    assert.strictEqual(memory.domainEvents.length, 1);
    const publishedEvent = memory.domainEvents[0] as MemoryDomainEvent;
    assert.strictEqual(publishedEvent.eventType, MEMORY_PUBLISHED);
    assert.strictEqual(publishedEvent.memoryId, "mem-1");
    assert.strictEqual(publishedEvent.reference, "client.profile.memory");
    assert.strictEqual(publishedEvent.snapshotId, "snap-1");

    // Cannot publish again or validate
    assert.throws(() => {
      memory.publish("owner-123");
    }, /Cannot publish memory when in status: Published/);

    // 3. Archive Published Memory
    memory.clearDomainEvents();
    memory.archive("owner-123");
    assert.strictEqual(memory.status, "Archived");
    assert.strictEqual(memory.domainEvents.length, 1);
    const archivedEvent = memory.domainEvents[0] as MemoryDomainEvent;
    assert.strictEqual(archivedEvent.eventType, MEMORY_ARCHIVED);
    assert.strictEqual(archivedEvent.memoryId, "mem-1");
    assert.strictEqual(archivedEvent.reference, "client.profile.memory");
    assert.strictEqual(archivedEvent.snapshotId, "snap-1");

    // Operations blocked on Archived memory
    assert.throws(() => {
      memory.archive("owner-123");
    }, /Memory is already archived/);

    assert.throws(() => {
      memory.replaceMetadata("owner-123", alternativeMetadata);
    }, /Cannot replace metadata when in status: Archived/);

    assert.throws(() => {
      memory.appendSnapshot("owner-123", "snap-2", defaultEntry, defaultMetadata);
    }, /Cannot append snapshot to an archived memory/);
  });

  test("Metadata replacement is rejected on non-Draft states", () => {
    const memory = Memory.create(
      "mem-1",
      "client.profile.memory",
      "owner-123",
      defaultMetadata,
      defaultRetentionRules,
      "snap-1",
      defaultEntry,
    );

    memory.validate("owner-123");
    assert.throws(() => {
      memory.replaceMetadata("owner-123", alternativeMetadata);
    }, /Cannot replace metadata when in status: Validated/);
  });

  test("Draft -> Archived transition is allowed", () => {
    const memory = Memory.create(
      "mem-1",
      "client.profile.memory",
      "owner-123",
      defaultMetadata,
      defaultRetentionRules,
      "snap-1",
      defaultEntry,
    );

    memory.archive("owner-123");
    assert.strictEqual(memory.status, "Archived");
  });

  test("Validated -> Archived transition is allowed", () => {
    const memory = Memory.create(
      "mem-1",
      "client.profile.memory",
      "owner-123",
      defaultMetadata,
      defaultRetentionRules,
      "snap-1",
      defaultEntry,
    );

    memory.validate("owner-123");
    memory.archive("owner-123");
    assert.strictEqual(memory.status, "Archived");
  });

  test("Invalid lifecycle transition: cannot publish draft memory", () => {
    const memory = Memory.create(
      "mem-1",
      "client.profile.memory",
      "owner-123",
      defaultMetadata,
      defaultRetentionRules,
      "snap-1",
      defaultEntry,
    );

    assert.throws(() => {
      memory.publish("owner-123");
    }, /Cannot publish memory when in status: Draft/);
  });

  test("Retention Rule validation constraints", () => {
    // Policy name empty
    assert.throws(() => {
      new MemoryRetentionRule({ policyName: "", retentionDays: 10 });
    }, /Policy name is required/);

    // Retention days non-positive
    assert.throws(() => {
      new MemoryRetentionRule({ policyName: "PolicyName", retentionDays: 0 });
    }, /Retention days must be greater than zero/);

    assert.throws(() => {
      new MemoryRetentionRule({ policyName: "PolicyName", retentionDays: -5 });
    }, /Retention days must be greater than zero/);
  });

  test("Mock interfaces contract compliance check", async () => {
    const mockStore: MemoryAggregateStore = {
      save: async (memory: Memory) => {
        assert.ok(memory.id);
      },
      findById: async (id: string, ownerId: string) => {
        assert.ok(id);
        assert.ok(ownerId);
        return null;
      },
      findByReference: async (reference: string, ownerId: string) => {
        assert.ok(reference);
        assert.ok(ownerId);
        return null;
      },
    };

    const memory = Memory.create(
      "mem-1",
      "client.profile.memory",
      "owner-123",
      defaultMetadata,
      defaultRetentionRules,
      "snap-1",
      defaultEntry,
    );

    await mockStore.save(memory);

    const mockPersistence: MemoryPersistenceContract = {
      checkUniqueReference: async (
        ownerId: string,
        reference: string,
        excludeMemoryId?: string,
      ) => {
        assert.ok(ownerId);
        assert.ok(reference);
        if (excludeMemoryId) {
          assert.ok(excludeMemoryId);
        }
        return true;
      },
    };

    const isUnique = await mockPersistence.checkUniqueReference(
      "owner-123",
      "client.profile.memory",
    );
    assert.strictEqual(isUnique, true);

    const projection: MemoryQueryProjection = {
      id: "mem-1",
      reference: "client.profile.memory",
      ownerId: "owner-123",
      displayName: "Summary View",
      status: "Published",
      updatedAt: new Date(),
    };

    assert.strictEqual(projection.status, "Published");
  });
});
