import { test, describe } from "node:test";
import assert from "node:assert";
import {
  MemoryUpdateReference,
  TargetMemoryReference,
  MemoryUpdateSpecification,
  MemoryUpdateClassification,
  MemoryUpdateSourceReference,
  MemoryUpdatePriority,
  MemoryUpdateFingerprint,
  ClientMemoryUpdateSnapshot,
  ClientMemoryUpdate,
  CLIENT_MEMORY_UPDATE_PROPOSED,
  CLIENT_MEMORY_UPDATE_VALIDATED,
  CLIENT_MEMORY_UPDATE_APPROVED,
  CLIENT_MEMORY_UPDATE_APPLIED,
  CLIENT_MEMORY_UPDATE_REJECTED,
  CLIENT_MEMORY_UPDATE_ARCHIVED,
} from "./client-memory-update.js";
import type {
  ClientMemoryUpdatePersistenceContract,
  ClientMemoryUpdateAggregateStore,
  ClientMemoryUpdateQueryProjection,
} from "./client-memory-update.js";

describe("Client Memory Update Aggregate & Invariants Tests", () => {
  const defaultUpdateRef = new MemoryUpdateReference("mem.update-001");
  const alternativeUpdateRef = new MemoryUpdateReference("mem.update-002");

  const defaultTargetRef = new TargetMemoryReference("memory.preference.weekly-meeting");
  const alternativeTargetRef = new TargetMemoryReference("memory.preference.billing-cycle");

  const createDefaultSpec = () =>
    new MemoryUpdateSpecification({
      operation: "Create",
      target: "weekly-meeting-frequency",
      proposedValue: "Weekly sync scheduled for Mondays at 10 AM EST.",
      reason: "Requested by client during onboarding call.",
    });

  const createAlternativeSpec = () =>
    new MemoryUpdateSpecification({
      operation: "Replace",
      target: "weekly-meeting-frequency",
      proposedValue: "Weekly sync scheduled for Tuesdays at 2 PM EST.",
      reason: "Client request due to timezone conflict.",
    });

  const defaultClassification = new MemoryUpdateClassification("Preference");
  const alternativeClassification = new MemoryUpdateClassification("Goal");

  const defaultSourceReference = new MemoryUpdateSourceReference("insight-123");
  const alternativeSourceReference = new MemoryUpdateSourceReference("insight-456");

  const defaultPriority = new MemoryUpdatePriority("Normal");
  const alternativePriority = new MemoryUpdatePriority("High");

  const defaultFingerprint = new MemoryUpdateFingerprint("logical-update-fingerprint-v1");
  const alternativeFingerprint = new MemoryUpdateFingerprint("logical-update-fingerprint-v2");

  test("Aggregate creation: status Draft, snapshot version 1, properties matched", () => {
    const spec = createDefaultSpec();
    const update = ClientMemoryUpdate.create(
      "update-123",
      defaultUpdateRef,
      "client-456",
      "owner-789",
      defaultTargetRef,
      spec,
      defaultClassification,
      defaultSourceReference,
      defaultPriority,
      defaultFingerprint,
    );

    assert.strictEqual(update.id, "update-123");
    assert.ok(update.updateReference.equals(defaultUpdateRef));
    assert.strictEqual(update.clientId, "client-456");
    assert.strictEqual(update.ownerId, "owner-789");
    assert.ok(update.targetMemoryReference.equals(defaultTargetRef));
    assert.ok(update.specification.equals(spec));
    assert.ok(update.classification.equals(defaultClassification));
    assert.ok(update.sourceReference.equals(defaultSourceReference));
    assert.ok(update.priority.equals(defaultPriority));
    assert.ok(update.fingerprint.equals(defaultFingerprint));
    assert.strictEqual(update.lifecycle, "Draft");

    // Version 1 snapshot verification
    assert.strictEqual(update.snapshots.length, 1);
    const snap = update.snapshots[0]!;
    assert.strictEqual(snap.version, 1);
    assert.strictEqual(snap.lifecycle, "Draft");
    assert.ok(snap.updateReference.equals(defaultUpdateRef));
    assert.strictEqual(snap.clientId, "client-456");
    assert.strictEqual(snap.ownerId, "owner-789");
    assert.ok(snap.targetMemoryReference.equals(defaultTargetRef));
    assert.ok(snap.specification.equals(spec));
    assert.ok(snap.classification.equals(defaultClassification));
    assert.ok(snap.sourceReference.equals(defaultSourceReference));
    assert.ok(snap.priority.equals(defaultPriority));
    assert.ok(snap.fingerprint.equals(defaultFingerprint));
    assert.ok(snap.createdAt instanceof Date);

    assert.strictEqual(update.domainEvents.length, 0);
  });

  test("Value Object Invariants: operation types and classifications", () => {
    // Operation case-insensitivity support
    assert.strictEqual(
      new MemoryUpdateSpecification({
        operation: "create",
        target: "t",
        proposedValue: "v",
        reason: "r",
      }).operation,
      "Create",
    );

    assert.throws(() => {
      new MemoryUpdateSpecification({
        operation: "InvalidOperation",
        target: "t",
        proposedValue: "v",
        reason: "r",
      });
    }, /Invalid operation type/);

    // Classification case-insensitivity support
    assert.strictEqual(new MemoryUpdateClassification("goal").value, "Goal");
    assert.throws(() => {
      new MemoryUpdateClassification("InvalidCategory");
    }, /Invalid Memory update classification category/);

    // Priority case-insensitivity support
    assert.strictEqual(new MemoryUpdatePriority("critical").value, "Critical");
    assert.throws(() => {
      new MemoryUpdatePriority("SuperCritical");
    }, /Invalid Memory update priority/);

    // Reference pattern validations
    assert.ok(new MemoryUpdateReference("update-v1.test"));
    assert.throws(() => {
      new MemoryUpdateReference("Update..123");
    }, /Invalid memory update reference format/);

    assert.ok(new TargetMemoryReference("target.ref-abc.123"));
    assert.throws(() => {
      new TargetMemoryReference("target..ref");
    }, /Invalid target memory reference format/);
  });

  test("Date immutability: defensive copy on constructors and getters", () => {
    const originalDate = new Date("2026-08-08T12:00:00Z");
    const spec = createDefaultSpec();

    const update = new ClientMemoryUpdate({
      id: "update-123",
      updateReference: defaultUpdateRef,
      clientId: "client-456",
      ownerId: "owner-789",
      targetMemoryReference: defaultTargetRef,
      specification: spec,
      classification: defaultClassification,
      sourceReference: defaultSourceReference,
      priority: defaultPriority,
      fingerprint: defaultFingerprint,
      lifecycle: "Draft",
      snapshots: [],
      createdAt: originalDate,
      updatedAt: originalDate,
    });

    // 1. Modifying original Date must not mutate aggregate state
    originalDate.setTime(0);
    assert.notStrictEqual(update.createdAt.getTime(), 0);
    assert.notStrictEqual(update.updatedAt.getTime(), 0);

    // 2. Modifying returned Date must not mutate aggregate state
    const retrievedCreated = update.createdAt;
    retrievedCreated.setTime(9999);
    assert.notStrictEqual(update.createdAt.getTime(), 9999);

    const retrievedUpdated = update.updatedAt;
    retrievedUpdated.setTime(7777);
    assert.notStrictEqual(update.updatedAt.getTime(), 7777);
  });

  test("ClientMemoryUpdateSnapshot Date immutability", () => {
    const originalDate = new Date("2026-08-08T12:00:00Z");
    const snap = new ClientMemoryUpdateSnapshot({
      version: 1,
      createdAt: originalDate,
      updateReference: defaultUpdateRef,
      clientId: "client-456",
      ownerId: "owner-789",
      targetMemoryReference: defaultTargetRef,
      specification: createDefaultSpec(),
      classification: defaultClassification,
      sourceReference: defaultSourceReference,
      priority: defaultPriority,
      fingerprint: defaultFingerprint,
      lifecycle: "Draft",
    });

    originalDate.setTime(0);
    assert.notStrictEqual(snap.createdAt.getTime(), 0);

    const retrieved = snap.createdAt;
    retrieved.setTime(8888);
    assert.notStrictEqual(snap.createdAt.getTime(), 8888);
  });

  test("Snapshot history append-only and immutability", () => {
    const update = ClientMemoryUpdate.create(
      "update-123",
      defaultUpdateRef,
      "client-456",
      "owner-789",
      defaultTargetRef,
      createDefaultSpec(),
      defaultClassification,
      defaultSourceReference,
      defaultPriority,
      defaultFingerprint,
    );

    update.update(
      "owner-789",
      alternativeTargetRef,
      createAlternativeSpec(),
      alternativeClassification,
      alternativeSourceReference,
      alternativePriority,
      alternativeFingerprint,
    );

    assert.strictEqual(update.snapshots.length, 2);
    const snap1 = update.snapshots[0]!;
    const snap2 = update.snapshots[1]!;

    assert.strictEqual(snap1.version, 1);
    assert.strictEqual(snap2.version, 2);

    // Try modifying snapshots array
    assert.throws(() => {
      (update.snapshots as unknown as unknown[]).push({});
    }, TypeError);

    // Try modifying snapshot property
    assert.throws(() => {
      (snap1 as unknown as Record<string, unknown>).version = 99;
    }, TypeError);
  });

  test("Lifecycle transitions: valid flows and domain events", () => {
    const update = ClientMemoryUpdate.create(
      "update-123",
      defaultUpdateRef,
      "client-456",
      "owner-789",
      defaultTargetRef,
      createDefaultSpec(),
      defaultClassification,
      defaultSourceReference,
      defaultPriority,
      defaultFingerprint,
    );

    assert.strictEqual(update.lifecycle, "Draft");

    // Transition: Draft -> Proposed
    update.propose("owner-789");
    assert.strictEqual(update.lifecycle, "Proposed");
    assert.strictEqual(update.snapshots.length, 2);
    assert.strictEqual(update.domainEvents.length, 1);
    assert.strictEqual(update.domainEvents[0]!.eventType, CLIENT_MEMORY_UPDATE_PROPOSED);
    // Payload Purity Check (only identifiers)
    assert.deepStrictEqual(update.domainEvents[0], {
      eventType: CLIENT_MEMORY_UPDATE_PROPOSED,
      updateId: "update-123",
      updateReference: defaultUpdateRef.value,
      clientId: "client-456",
      ownerId: "owner-789",
      targetMemoryReference: defaultTargetRef.value,
      snapshotVersion: 2,
    });

    // Transition: Proposed -> Validated
    update.validate("owner-789");
    assert.strictEqual(update.lifecycle, "Validated");
    assert.strictEqual(update.snapshots.length, 3);
    assert.strictEqual(update.domainEvents.length, 2);
    assert.strictEqual(update.domainEvents[1]!.eventType, CLIENT_MEMORY_UPDATE_VALIDATED);

    // Transition: Validated -> Approved
    update.approve("owner-789");
    assert.strictEqual(update.lifecycle, "Approved");
    assert.strictEqual(update.snapshots.length, 4);
    assert.strictEqual(update.domainEvents.length, 3);
    assert.strictEqual(update.domainEvents[2]!.eventType, CLIENT_MEMORY_UPDATE_APPROVED);

    // Transition: Approved -> Applied
    update.apply("owner-789");
    assert.strictEqual(update.lifecycle, "Applied");
    assert.strictEqual(update.snapshots.length, 5);
    assert.strictEqual(update.domainEvents.length, 4);
    assert.strictEqual(update.domainEvents[3]!.eventType, CLIENT_MEMORY_UPDATE_APPLIED);

    // Transition: Applied -> Archived (terminal state archived)
    update.archive("owner-789");
    assert.strictEqual(update.lifecycle, "Archived");
    assert.strictEqual(update.snapshots.length, 6);
    assert.strictEqual(update.domainEvents.length, 5);
    assert.strictEqual(update.domainEvents[4]!.eventType, CLIENT_MEMORY_UPDATE_ARCHIVED);
  });

  test("Lifecycle transitions: rejection flow and domain event", () => {
    const update = ClientMemoryUpdate.create(
      "update-123",
      defaultUpdateRef,
      "client-456",
      "owner-789",
      defaultTargetRef,
      createDefaultSpec(),
      defaultClassification,
      defaultSourceReference,
      defaultPriority,
      defaultFingerprint,
    );

    // Can reject from Draft state
    update.reject("owner-789");
    assert.strictEqual(update.lifecycle, "Rejected");
    assert.strictEqual(update.snapshots.length, 2);
    assert.strictEqual(update.domainEvents.length, 1);
    assert.strictEqual(update.domainEvents[0]!.eventType, CLIENT_MEMORY_UPDATE_REJECTED);
  });

  test("Lifecycle transitions: invalid paths", () => {
    const update = ClientMemoryUpdate.create(
      "update-123",
      defaultUpdateRef,
      "client-456",
      "owner-789",
      defaultTargetRef,
      createDefaultSpec(),
      defaultClassification,
      defaultSourceReference,
      defaultPriority,
      defaultFingerprint,
    );

    // Cannot validate or approve directly from Draft
    assert.throws(() => {
      update.validate("owner-789");
    }, /Cannot validate/);

    assert.throws(() => {
      update.approve("owner-789");
    }, /Cannot approve/);

    // Cannot update once Applied, Rejected, or Archived
    update.propose("owner-789");
    update.validate("owner-789");
    update.approve("owner-789");
    update.apply("owner-789");
    assert.throws(() => {
      update.update(
        "owner-789",
        alternativeTargetRef,
        createAlternativeSpec(),
        alternativeClassification,
        alternativeSourceReference,
        alternativePriority,
        alternativeFingerprint,
      );
    }, /Cannot update/);
  });

  test("Ownership verification checking", () => {
    const update = ClientMemoryUpdate.create(
      "update-123",
      defaultUpdateRef,
      "client-456",
      "owner-789",
      defaultTargetRef,
      createDefaultSpec(),
      defaultClassification,
      defaultSourceReference,
      defaultPriority,
      defaultFingerprint,
    );

    assert.throws(() => {
      update.propose("unauthorized-owner");
    }, /Ownership validation failed/);
  });

  test("Aggregate invariant enforcement on properties", () => {
    // Missing ID throws
    assert.throws(() => {
      new ClientMemoryUpdate({
        id: "",
        updateReference: defaultUpdateRef,
        clientId: "client-456",
        ownerId: "owner-789",
        targetMemoryReference: defaultTargetRef,
        specification: createDefaultSpec(),
        classification: defaultClassification,
        sourceReference: defaultSourceReference,
        priority: defaultPriority,
        fingerprint: defaultFingerprint,
        lifecycle: "Draft",
        snapshots: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }, /Update Identity is required/);
  });

  test("Mock store interface compliance check", async () => {
    const mockStore: ClientMemoryUpdateAggregateStore = {
      save: async (updateObj: ClientMemoryUpdate) => {
        assert.ok(updateObj.id);
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

    const updateObj = ClientMemoryUpdate.create(
      "update-123",
      defaultUpdateRef,
      "client-456",
      "owner-789",
      defaultTargetRef,
      createDefaultSpec(),
      defaultClassification,
      defaultSourceReference,
      defaultPriority,
      defaultFingerprint,
    );

    await mockStore.save(updateObj);

    const mockPersist: ClientMemoryUpdatePersistenceContract = {
      checkUniqueReference: async (
        ownerId: string,
        reference: string,
        excludeUpdateId?: string,
      ) => {
        assert.ok(ownerId);
        assert.ok(reference);
        if (excludeUpdateId) {
          assert.ok(excludeUpdateId);
        }
        return true;
      },
    };

    const unique = await mockPersist.checkUniqueReference("owner-789", "mem.update-001");
    assert.strictEqual(unique, true);

    const projection: ClientMemoryUpdateQueryProjection = {
      id: "update-123",
      updateReference: "mem.update-001",
      clientId: "client-456",
      ownerId: "owner-789",
      targetMemoryReference: "memory.preference.weekly-meeting",
      lifecycle: "Draft",
      operation: "Create",
      classification: "Preference",
      priority: "Normal",
      versionCount: 1,
      updatedAt: new Date(),
    };

    assert.strictEqual(projection.id, "update-123");
    assert.strictEqual(projection.operation, "Create");
  });

  test("ClientMemoryUpdate properties immutability checks", () => {
    const update = ClientMemoryUpdate.create(
      "update-123",
      defaultUpdateRef,
      "client-456",
      "owner-789",
      defaultTargetRef,
      createDefaultSpec(),
      defaultClassification,
      defaultSourceReference,
      defaultPriority,
      defaultFingerprint,
    );

    // Assert that attempting to write to properties throws TypeError
    assert.throws(() => {
      (update as unknown as Record<string, unknown>).id = "mutated-id";
    }, TypeError);

    assert.throws(() => {
      (update as unknown as Record<string, unknown>).updateReference = alternativeUpdateRef;
    }, TypeError);

    assert.throws(() => {
      (update as unknown as Record<string, unknown>).clientId = "client-mutated";
    }, TypeError);

    assert.throws(() => {
      (update as unknown as Record<string, unknown>).ownerId = "owner-mutated";
    }, TypeError);

    assert.throws(() => {
      (update as unknown as Record<string, unknown>).targetMemoryReference = alternativeTargetRef;
    }, TypeError);

    assert.throws(() => {
      (update as unknown as Record<string, unknown>).specification = createAlternativeSpec();
    }, TypeError);

    assert.throws(() => {
      (update as unknown as Record<string, unknown>).classification = alternativeClassification;
    }, TypeError);

    assert.throws(() => {
      (update as unknown as Record<string, unknown>).sourceReference = alternativeSourceReference;
    }, TypeError);

    assert.throws(() => {
      (update as unknown as Record<string, unknown>).priority = alternativePriority;
    }, TypeError);

    assert.throws(() => {
      (update as unknown as Record<string, unknown>).fingerprint = alternativeFingerprint;
    }, TypeError);
  });

  test("Memory Mutation Boundary Safety (ClientMemoryUpdate does NOT mutate actual memory)", () => {
    const update = ClientMemoryUpdate.create(
      "update-123",
      defaultUpdateRef,
      "client-456",
      "owner-789",
      defaultTargetRef,
      createDefaultSpec(),
      defaultClassification,
      defaultSourceReference,
      defaultPriority,
      defaultFingerprint,
    );

    // 1. Proving that the transition only affects the aggregate's own status
    assert.strictEqual(update.lifecycle, "Draft");
    update.propose("owner-789");
    assert.strictEqual(update.lifecycle, "Proposed");

    update.validate("owner-789");
    assert.strictEqual(update.lifecycle, "Validated");

    update.approve("owner-789");
    assert.strictEqual(update.lifecycle, "Approved");

    update.apply("owner-789");
    assert.strictEqual(update.lifecycle, "Applied");

    // 2. Inspection: Verify that the class defines only technology-neutral properties
    // without imports of Drizzle schemas or memory vectors database drivers
    const keys = Object.keys(update);
    assert.ok(!keys.includes("_memoryRepository"));
    assert.ok(!keys.includes("_vectorIndex"));
  });
});
