import { test, describe } from "node:test";
import assert from "node:assert";
import {
  EmbeddingReference,
  EmbeddingSourceReference,
  EmbeddingVector,
  EmbeddingSpace,
  EmbeddingFingerprint,
  EmbeddingSnapshot,
  Embedding,
  EMBEDDING_REGISTERED,
  EMBEDDING_VALIDATED,
  EMBEDDING_AVAILABLE,
  EMBEDDING_ARCHIVED,
} from "./embedding.js";
import type {
  EmbeddingPersistenceContract,
  EmbeddingAggregateStore,
  EmbeddingQueryProjection,
} from "./embedding.js";

describe("Embedding Aggregate & Invariants Domain Tests", () => {
  const defaultRef = new EmbeddingReference("embedding.reference-001");
  const alternativeRef = new EmbeddingReference("embedding.reference-002");

  const defaultSourceRef = new EmbeddingSourceReference("conversation-import-123");
  const alternativeSourceRef = new EmbeddingSourceReference("conversation-import-456");

  const defaultVector = new EmbeddingVector([0.1, -0.2, 0.35]);
  const alternativeVector = new EmbeddingVector([0.9, -0.8, 0.77]);

  const defaultSpace = new EmbeddingSpace("semantic.space-abc");
  const alternativeSpace = new EmbeddingSpace("semantic.space-xyz");

  const defaultFingerprint = new EmbeddingFingerprint("logical-fingerprint-v1");
  const alternativeFingerprint = new EmbeddingFingerprint("logical-fingerprint-v2");

  test("Aggregate creation: status Draft, snapshot version 1, properties matched", () => {
    const embedding = Embedding.create(
      "emb-123",
      defaultRef,
      defaultSourceRef,
      defaultVector,
      defaultSpace,
      defaultFingerprint,
      "snap-1",
    );

    assert.strictEqual(embedding.id, "emb-123");
    assert.ok(embedding.embeddingReference.equals(defaultRef));
    assert.ok(embedding.sourceReference.equals(defaultSourceRef));
    assert.ok(embedding.vector.equals(defaultVector));
    assert.strictEqual(embedding.dimension, 3);
    assert.ok(embedding.space.equals(defaultSpace));
    assert.ok(embedding.fingerprint.equals(defaultFingerprint));
    assert.strictEqual(embedding.lifecycle, "Draft");

    // Snapshot checking
    assert.strictEqual(embedding.snapshots.length, 1);
    const snap = embedding.snapshots[0]!;
    assert.strictEqual(snap.version, 1);
    assert.strictEqual(snap.lifecycle, "Draft");
    assert.ok(snap.embeddingReference.equals(defaultRef));
    assert.ok(snap.sourceReference.equals(defaultSourceRef));
    assert.ok(snap.vector.equals(defaultVector));
    assert.strictEqual(snap.dimension, 3);
    assert.ok(snap.space.equals(defaultSpace));
    assert.ok(snap.fingerprint.equals(defaultFingerprint));
    assert.strictEqual(snap.snapshotId, "snap-1");
    assert.ok(snap.createdAt instanceof Date);

    assert.strictEqual(embedding.domainEvents.length, 0);
  });

  test("EmbeddingVector constraints validation", () => {
    // 1. Vector is present / non-empty
    assert.throws(() => {
      new EmbeddingVector([]);
    }, /Vector array must not be empty\./);

    // 2. Reject non-numeric elements
    assert.throws(() => {
      new EmbeddingVector([1, 2, "three" as unknown as number]);
    }, /Every element in the vector must be numeric\./);

    // 3. Reject NaN
    assert.throws(() => {
      new EmbeddingVector([1, 2, NaN]);
    }, /Every element in the vector must be a finite number\./);

    // 4. Reject Infinity
    assert.throws(() => {
      new EmbeddingVector([1, 2, Infinity]);
    }, /Every element in the vector must be a finite number\./);

    // 5. Reject negative Infinity
    assert.throws(() => {
      new EmbeddingVector([1, 2, -Infinity]);
    }, /Every element in the vector must be a finite number\./);
  });

  test("EmbeddingVector immutability check", () => {
    const rawArray = [0.1, 0.2, 0.3];
    const vector = new EmbeddingVector(rawArray);

    // Caller mutating original raw array shouldn't modify Vector values
    rawArray[0] = 9.9;
    assert.strictEqual(vector.values[0], 0.1);

    // Getter return array is copy-protected
    const retrieved = vector.values;
    retrieved[0] = 8.8;
    assert.strictEqual(vector.values[0], 0.1);

    // Internal values array is frozen
    assert.throws(() => {
      (vector as unknown as { _values: number[] })._values[0] = 5.5;
    }, TypeError);
  });

  test("Dimension mismatches and validations", () => {
    const vector = new EmbeddingVector([0.1, 0.2]);

    // Derived correctly
    assert.strictEqual(vector.length, 2);

    // Dimension mismatch in Snapshot throws error
    assert.throws(() => {
      new EmbeddingSnapshot({
        version: 1,
        createdAt: new Date(),
        embeddingReference: defaultRef,
        sourceReference: defaultSourceRef,
        vector,
        dimension: 3, // vector is dimension 2
        space: defaultSpace,
        fingerprint: defaultFingerprint,
        lifecycle: "Draft",
        snapshotId: "snap-1",
      });
    }, /Vector dimension mismatch\./);
  });

  test("Value Object Invariants: format check and immutability", () => {
    // Reference pattern validations
    assert.ok(new EmbeddingReference("emb.v1"));
    assert.throws(() => {
      new EmbeddingReference("Emb..1");
    }, /Invalid embedding reference format/);

    assert.ok(new EmbeddingSourceReference("source.v1"));
    assert.throws(() => {
      new EmbeddingSourceReference("Source..1");
    }, /Invalid source reference format/);

    assert.ok(new EmbeddingSpace("space.sem.001"));
    assert.throws(() => {
      new EmbeddingSpace("Space..1");
    }, /Invalid embedding space format/);

    // Value Objects immutability
    const ref = new EmbeddingReference("emb.v1");
    assert.throws(() => {
      (ref as unknown as Record<string, string>).value = "mutated";
    }, TypeError);

    const spaceObj = new EmbeddingSpace("space.sem");
    assert.throws(() => {
      (spaceObj as unknown as Record<string, string>).value = "mutated";
    }, TypeError);

    const fp = new EmbeddingFingerprint("logical-fp");
    assert.throws(() => {
      (fp as unknown as Record<string, string>).value = "mutated";
    }, TypeError);
  });

  test("Date immutability: defensive copy on constructors and getters", () => {
    const originalDate = new Date("2026-08-08T12:00:00Z");
    const embedding = new Embedding({
      id: "emb-123",
      embeddingReference: defaultRef,
      sourceReference: defaultSourceRef,
      vector: defaultVector,
      dimension: 3,
      space: defaultSpace,
      fingerprint: defaultFingerprint,
      lifecycle: "Draft",
      snapshots: [],
      createdAt: originalDate,
      updatedAt: originalDate,
    });

    // 1. Modifying original Date must not mutate aggregate state
    originalDate.setTime(0);
    assert.notStrictEqual(embedding.createdAt.getTime(), 0);
    assert.notStrictEqual(embedding.updatedAt.getTime(), 0);

    // 2. Modifying returned Date must not mutate aggregate state
    const retrievedCreated = embedding.createdAt;
    retrievedCreated.setTime(9999);
    assert.notStrictEqual(embedding.createdAt.getTime(), 9999);

    const retrievedUpdated = embedding.updatedAt;
    retrievedUpdated.setTime(7777);
    assert.notStrictEqual(embedding.updatedAt.getTime(), 7777);
  });

  test("EmbeddingSnapshot Date immutability", () => {
    const originalDate = new Date("2026-08-08T12:00:00Z");
    const snap = new EmbeddingSnapshot({
      version: 1,
      createdAt: originalDate,
      embeddingReference: defaultRef,
      sourceReference: defaultSourceRef,
      vector: defaultVector,
      dimension: 3,
      space: defaultSpace,
      fingerprint: defaultFingerprint,
      lifecycle: "Draft",
      snapshotId: "snap-1",
    });

    originalDate.setTime(0);
    assert.notStrictEqual(snap.createdAt.getTime(), 0);

    const retrieved = snap.createdAt;
    retrieved.setTime(8888);
    assert.notStrictEqual(snap.createdAt.getTime(), 8888);
  });

  test("Snapshot history append-only and immutability", () => {
    const embedding = Embedding.create(
      "emb-123",
      defaultRef,
      defaultSourceRef,
      defaultVector,
      defaultSpace,
      defaultFingerprint,
      "snap-1",
    );

    embedding.update(alternativeVector, alternativeSpace, alternativeFingerprint, "snap-2");

    assert.strictEqual(embedding.snapshots.length, 2);
    const snap1 = embedding.snapshots[0]!;
    const snap2 = embedding.snapshots[1]!;

    assert.strictEqual(snap1.version, 1);
    assert.strictEqual(snap2.version, 2);

    // Try modifying snapshots array
    assert.throws(() => {
      (embedding.snapshots as unknown as unknown[]).push({});
    }, TypeError);

    // Try modifying snapshot property
    assert.throws(() => {
      (snap1 as unknown as Record<string, unknown>).version = 99;
    }, TypeError);
  });

  test("Lifecycle transitions: valid flows and domain events", () => {
    const embedding = Embedding.create(
      "emb-123",
      defaultRef,
      defaultSourceRef,
      defaultVector,
      defaultSpace,
      defaultFingerprint,
      "snap-1",
    );

    assert.strictEqual(embedding.lifecycle, "Draft");

    // Transition: Draft -> Registered
    embedding.register("snap-2");
    assert.strictEqual(embedding.lifecycle, "Registered");
    assert.strictEqual(embedding.snapshots.length, 2);
    assert.strictEqual(embedding.domainEvents.length, 1);
    assert.strictEqual(embedding.domainEvents[0]!.eventType, EMBEDDING_REGISTERED);
    // Payload Purity check: only identifiers, no vector exposed!
    assert.deepStrictEqual(embedding.domainEvents[0], {
      eventType: EMBEDDING_REGISTERED,
      embeddingId: "emb-123",
      embeddingReference: defaultRef.value,
      sourceReference: defaultSourceRef.value,
      snapshotId: "snap-2",
    });

    // Transition: Registered -> Validated
    embedding.validate("snap-3");
    assert.strictEqual(embedding.lifecycle, "Validated");
    assert.strictEqual(embedding.snapshots.length, 3);
    assert.strictEqual(embedding.domainEvents.length, 2);
    assert.strictEqual(embedding.domainEvents[1]!.eventType, EMBEDDING_VALIDATED);

    // Transition: Validated -> Available
    embedding.makeAvailable("snap-4");
    assert.strictEqual(embedding.lifecycle, "Available");
    assert.strictEqual(embedding.snapshots.length, 4);
    assert.strictEqual(embedding.domainEvents.length, 3);
    assert.strictEqual(embedding.domainEvents[2]!.eventType, EMBEDDING_AVAILABLE);

    // Transition: Available -> Archived
    embedding.archive("snap-5");
    assert.strictEqual(embedding.lifecycle, "Archived");
    assert.strictEqual(embedding.snapshots.length, 5);
    assert.strictEqual(embedding.domainEvents.length, 4);
    assert.strictEqual(embedding.domainEvents[3]!.eventType, EMBEDDING_ARCHIVED);
  });

  test("Lifecycle transitions: invalid paths", () => {
    const embedding = Embedding.create(
      "emb-123",
      defaultRef,
      defaultSourceRef,
      defaultVector,
      defaultSpace,
      defaultFingerprint,
      "snap-1",
    );

    // Cannot validate or make available directly from Draft
    assert.throws(() => {
      embedding.validate("snap-2");
    }, /Cannot validate/);

    assert.throws(() => {
      embedding.makeAvailable("snap-2");
    }, /Cannot make embedding available/);

    // Cannot update once Archived
    embedding.archive("snap-archive");
    assert.throws(() => {
      embedding.update(alternativeVector, alternativeSpace, alternativeFingerprint, "snap-3");
    }, /Cannot update archived embedding\./);
  });

  test("Aggregate invariant enforcement on properties", () => {
    // Missing ID throws
    assert.throws(() => {
      new Embedding({
        id: "",
        embeddingReference: defaultRef,
        sourceReference: defaultSourceRef,
        vector: defaultVector,
        dimension: 3,
        space: defaultSpace,
        fingerprint: defaultFingerprint,
        lifecycle: "Draft",
        snapshots: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }, /Embedding Identity is required/);
  });

  test("Mock store interface compliance check", async () => {
    const mockStore: EmbeddingAggregateStore = {
      save: async (embObj: Embedding) => {
        assert.ok(embObj.id);
      },
      findById: async (id: string) => {
        assert.ok(id);
        return null;
      },
      findByReference: async (reference: string) => {
        assert.ok(reference);
        return null;
      },
    };

    const embObj = Embedding.create(
      "emb-123",
      defaultRef,
      defaultSourceRef,
      defaultVector,
      defaultSpace,
      defaultFingerprint,
      "snap-1",
    );

    await mockStore.save(embObj);

    const mockPersist: EmbeddingPersistenceContract = {
      checkUniqueReference: async (reference: string, excludeEmbeddingId?: string) => {
        assert.ok(reference);
        if (excludeEmbeddingId) {
          assert.ok(excludeEmbeddingId);
        }
        return true;
      },
    };

    const unique = await mockPersist.checkUniqueReference("embedding.reference-001");
    assert.strictEqual(unique, true);

    const projection: EmbeddingQueryProjection = {
      id: "emb-123",
      embeddingReference: "embedding.reference-001",
      sourceReference: "conversation-import-123",
      dimension: 3,
      space: "semantic.space-abc",
      lifecycle: "Draft",
      versionCount: 1,
      updatedAt: new Date(),
    };

    assert.strictEqual(projection.id, "emb-123");
    assert.strictEqual(projection.space, "semantic.space-abc");
  });

  test("Embedding aggregate properties immutability checks", () => {
    const embedding = Embedding.create(
      "emb-123",
      defaultRef,
      defaultSourceRef,
      defaultVector,
      defaultSpace,
      defaultFingerprint,
      "snap-1",
    );

    // Assert that attempting to write to properties throws TypeError
    assert.throws(() => {
      (embedding as unknown as Record<string, unknown>).id = "mutated-id";
    }, TypeError);

    assert.throws(() => {
      (embedding as unknown as Record<string, unknown>).embeddingReference = alternativeRef;
    }, TypeError);

    assert.throws(() => {
      (embedding as unknown as Record<string, unknown>).sourceReference = alternativeSourceRef;
    }, TypeError);

    assert.throws(() => {
      (embedding as unknown as Record<string, unknown>).vector = alternativeVector;
    }, TypeError);

    assert.throws(() => {
      (embedding as unknown as Record<string, unknown>).space = alternativeSpace;
    }, TypeError);

    assert.throws(() => {
      (embedding as unknown as Record<string, unknown>).fingerprint = alternativeFingerprint;
    }, TypeError);
  });
});
