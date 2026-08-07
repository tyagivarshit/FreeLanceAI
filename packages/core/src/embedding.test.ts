import { test, describe } from "node:test";
import assert from "node:assert";
import {
  Embedding,
  EmbeddingMetadata,
  EmbeddingGenerationPolicy,
  RepresentationFingerprint,
  EmbeddingSnapshot,
  EmbeddingClassification,
  EmbeddingReference,
  EMBEDDING_REGISTERED,
  EMBEDDING_GENERATED,
  EMBEDDING_VALIDATED,
  EMBEDDING_PUBLISHED,
  EMBEDDING_ARCHIVED,
} from "./embedding.js";
import type {
  EmbeddingAggregateStore,
  EmbeddingPersistenceContract,
  EmbeddingQueryProjection,
  EmbeddingDomainEvent,
} from "./embedding.js";

describe("Embedding Aggregate Root and Value Objects Domain Tests", () => {
  const defaultMetadata = new EmbeddingMetadata({
    displayName: "Client Profile Embedding",
    description: "Represents client profiles logical model.",
    purpose: "Describe contextual proximity.",
    classificationSummary: "Client",
  });

  const alternativeMetadata = new EmbeddingMetadata({
    displayName: "Client Profile Embedding Updated",
    description: "Represents client profiles updated logic.",
    purpose: "Describe contextual proximity.",
    classificationSummary: "ClientUpdated",
  });

  const defaultPolicy = new EmbeddingGenerationPolicy({
    generationStrategyReference: "SemanticMatchOnly",
    compatibilityClassification: "v1.compat",
    logicalRefreshClassification: "OnProfileUpdate",
  });

  const defaultFingerprint = new RepresentationFingerprint({
    fingerprintIdentifier: "fp-abc-123",
    fingerprintStrategyReference: "MurmurHash3",
  });

  const alternativeFingerprint = new RepresentationFingerprint({
    fingerprintIdentifier: "fp-xyz-999",
    fingerprintStrategyReference: "MurmurHash3",
  });

  const defaultClassification = new EmbeddingClassification({
    classificationTag: "client.profile",
  });

  test("Embedding creation success: state Draft, snapshots initialized, registered event emitted", () => {
    const embedding = Embedding.create(
      "emb-1",
      "client.profile.embedding",
      "owner-123",
      defaultMetadata,
      defaultPolicy,
      defaultClassification,
      "snap-1",
      defaultFingerprint,
    );

    assert.strictEqual(embedding.id, "emb-1");
    assert.strictEqual(embedding.reference, "client.profile.embedding");
    assert.strictEqual(embedding.ownerId, "owner-123");
    assert.strictEqual(embedding.status, "Draft");
    assert.strictEqual(embedding.metadata.displayName, "Client Profile Embedding");

    // Snapshot completeness checks
    assert.strictEqual(embedding.snapshots.length, 1);
    assert.strictEqual(embedding.snapshots[0]!.snapshotId, "snap-1");
    assert.strictEqual(
      embedding.snapshots[0]!.representationFingerprint.fingerprintIdentifier,
      "fp-abc-123",
    );
    assert.strictEqual(
      embedding.snapshots[0]!.metadataSnapshot.displayName,
      "Client Profile Embedding",
    );
    assert.strictEqual(
      embedding.snapshots[0]!.generationPolicySnapshot.generationStrategyReference,
      "SemanticMatchOnly",
    );
    assert.strictEqual(
      embedding.snapshots[0]!.classificationSnapshot.classificationTag,
      "client.profile",
    );

    // Events validation
    assert.strictEqual(embedding.domainEvents.length, 1);
    const event = embedding.domainEvents[0] as EmbeddingDomainEvent;
    assert.strictEqual(event.eventType, EMBEDDING_REGISTERED);
    assert.strictEqual(event.embeddingId, "emb-1");
    assert.strictEqual(event.reference, "client.profile.embedding");
    assert.strictEqual(event.snapshotId, "snap-1");
    assert.strictEqual(event.ownerId, "owner-123");
  });

  test("Embedding reference format validation rejects invalid keys", () => {
    assert.throws(() => {
      Embedding.create(
        "emb-1",
        "client..embedding",
        "owner-123",
        defaultMetadata,
        defaultPolicy,
        defaultClassification,
        "snap-1",
        defaultFingerprint,
      );
    }, /Invalid embedding reference format/);

    assert.throws(() => {
      Embedding.create(
        "emb-1",
        "Client.embedding",
        "owner-123",
        defaultMetadata,
        defaultPolicy,
        defaultClassification,
        "snap-1",
        defaultFingerprint,
      );
    }, /Invalid embedding reference format/);
  });

  test("EmbeddingReference validation and format checks", () => {
    assert.throws(() => {
      new EmbeddingReference("");
    }, /Embedding Reference is required/);

    assert.throws(() => {
      new EmbeddingReference("Client.embedding");
    }, /Invalid embedding reference format/);

    const ref = new EmbeddingReference("client.profile.embedding");
    assert.strictEqual(ref.value, "client.profile.embedding");
  });

  test("Ownership validation blocks unauthorized owners", () => {
    const embedding = Embedding.create(
      "emb-1",
      "client.profile.embedding",
      "owner-123",
      defaultMetadata,
      defaultPolicy,
      defaultClassification,
      "snap-1",
      defaultFingerprint,
    );

    assert.throws(() => {
      embedding.replaceMetadata("unauthorized-owner", alternativeMetadata);
    }, /Ownership validation failed: unauthorized owner context/);

    assert.throws(() => {
      embedding.generateRepresentation("unauthorized-owner", "snap-2", alternativeFingerprint);
    }, /Ownership validation failed: unauthorized owner context/);

    assert.throws(() => {
      embedding.validate("unauthorized-owner");
    }, /Ownership validation failed: unauthorized owner context/);
  });

  test("Missing owner throws error", () => {
    const embedding = Embedding.create(
      "emb-1",
      "client.profile.embedding",
      "owner-123",
      defaultMetadata,
      defaultPolicy,
      defaultClassification,
      "snap-1",
      defaultFingerprint,
    );

    assert.throws(() => {
      embedding.replaceMetadata("", alternativeMetadata);
    }, /Missing owner identity in caller context/);
  });

  test("Metadata replacement is allowed in Draft but rejected in non-Draft states", () => {
    const embedding = Embedding.create(
      "emb-1",
      "client.profile.embedding",
      "owner-123",
      defaultMetadata,
      defaultPolicy,
      defaultClassification,
      "snap-1",
      defaultFingerprint,
    );

    // 1. Success in Draft
    embedding.replaceMetadata("owner-123", alternativeMetadata);
    assert.strictEqual(embedding.metadata.equals(alternativeMetadata), true);

    // 2. Reject in Generated
    embedding.generateRepresentation("owner-123", "snap-2", alternativeFingerprint);
    assert.strictEqual(embedding.status, "Generated");

    assert.throws(() => {
      embedding.replaceMetadata("owner-123", defaultMetadata);
    }, /Cannot replace metadata when in status: Generated/);
  });

  test("Append snapshot to history is append-only and previous snapshots are immutable", () => {
    const embedding = Embedding.create(
      "emb-1",
      "client.profile.embedding",
      "owner-123",
      defaultMetadata,
      defaultPolicy,
      defaultClassification,
      "snap-1",
      defaultFingerprint,
    );

    embedding.generateRepresentation("owner-123", "snap-2", alternativeFingerprint);

    assert.strictEqual(embedding.snapshots.length, 2);
    assert.strictEqual(embedding.snapshots[0]!.snapshotId, "snap-1");
    assert.strictEqual(embedding.snapshots[1]!.snapshotId, "snap-2");
    assert.strictEqual(
      embedding.snapshots[1]!.representationFingerprint.equals(alternativeFingerprint),
      true,
    );
    assert.strictEqual(
      embedding.snapshots[1]!.classificationSnapshot.equals(defaultClassification),
      true,
    );

    // Verify snapshots array immutability from outside
    const outsideSnapshots = embedding.snapshots;
    assert.throws(() => {
      (outsideSnapshots as unknown as EmbeddingSnapshot[]).push(
        new EmbeddingSnapshot({
          snapshotId: "snap-hack",
          representationFingerprint: defaultFingerprint,
          metadataSnapshot: defaultMetadata,
          generationPolicySnapshot: defaultPolicy,
          classificationSnapshot: defaultClassification,
          lifecycleStateSnapshot: "Draft",
          capturedAt: new Date(),
        }),
      );
    });
    assert.strictEqual(embedding.snapshots.length, 2);
  });

  test("Lifecycle flow: Draft -> Generated -> Validated -> Published -> Archived", () => {
    const embedding = Embedding.create(
      "emb-1",
      "client.profile.embedding",
      "owner-123",
      defaultMetadata,
      defaultPolicy,
      defaultClassification,
      "snap-1",
      defaultFingerprint,
    );

    // 1. Draft -> Generated (via representation generation)
    embedding.clearDomainEvents();
    embedding.generateRepresentation("owner-123", "snap-2", alternativeFingerprint);
    assert.strictEqual(embedding.status, "Generated");
    assert.strictEqual(embedding.domainEvents.length, 1);
    const genEvent = embedding.domainEvents[0] as EmbeddingDomainEvent;
    assert.strictEqual(genEvent.eventType, EMBEDDING_GENERATED);
    assert.strictEqual(genEvent.embeddingId, "emb-1");
    assert.strictEqual(genEvent.snapshotId, "snap-2");

    // 2. Generated -> Validated
    embedding.clearDomainEvents();
    embedding.validate("owner-123");
    assert.strictEqual(embedding.status, "Validated");
    assert.strictEqual(embedding.domainEvents.length, 1);
    const valEvent = embedding.domainEvents[0] as EmbeddingDomainEvent;
    assert.strictEqual(valEvent.eventType, EMBEDDING_VALIDATED);
    assert.strictEqual(valEvent.embeddingId, "emb-1");
    assert.strictEqual(valEvent.snapshotId, "snap-2");

    // Cannot validate again
    assert.throws(() => {
      embedding.validate("owner-123");
    }, /Cannot validate embedding when in status: Validated/);

    // 3. Validated -> Published
    embedding.clearDomainEvents();
    embedding.publish("owner-123");
    assert.strictEqual(embedding.status, "Published");
    assert.strictEqual(embedding.domainEvents.length, 1);
    const pubEvent = embedding.domainEvents[0] as EmbeddingDomainEvent;
    assert.strictEqual(pubEvent.eventType, EMBEDDING_PUBLISHED);
    assert.strictEqual(pubEvent.embeddingId, "emb-1");
    assert.strictEqual(pubEvent.snapshotId, "snap-2");

    // Cannot publish again
    assert.throws(() => {
      embedding.publish("owner-123");
    }, /Cannot publish embedding when in status: Published/);

    // 4. Published -> Archived
    embedding.clearDomainEvents();
    embedding.archive("owner-123");
    assert.strictEqual(embedding.status, "Archived");
    assert.strictEqual(embedding.domainEvents.length, 1);
    const archEvent = embedding.domainEvents[0] as EmbeddingDomainEvent;
    assert.strictEqual(archEvent.eventType, EMBEDDING_ARCHIVED);
    assert.strictEqual(archEvent.embeddingId, "emb-1");
    assert.strictEqual(archEvent.snapshotId, "snap-2");

    // Already archived blocks mutation
    assert.throws(() => {
      embedding.archive("owner-123");
    }, /Embedding is already archived/);

    assert.throws(() => {
      embedding.generateRepresentation("owner-123", "snap-3", defaultFingerprint);
    }, /Cannot generate representation when in status: Archived/);
  });

  test("Invalid lifecycle transition: cannot validate or publish directly from Draft", () => {
    const embedding = Embedding.create(
      "emb-1",
      "client.profile.embedding",
      "owner-123",
      defaultMetadata,
      defaultPolicy,
      defaultClassification,
      "snap-1",
      defaultFingerprint,
    );

    assert.throws(() => {
      embedding.validate("owner-123");
    }, /Cannot validate embedding when in status: Draft/);

    assert.throws(() => {
      embedding.publish("owner-123");
    }, /Cannot publish embedding when in status: Draft/);
  });

  test("RepresentationFingerprint value object validations and comparison checks", () => {
    assert.throws(() => {
      new RepresentationFingerprint({
        fingerprintIdentifier: "",
        fingerprintStrategyReference: "hash",
      });
    }, /Fingerprint identifier is required/);

    assert.throws(() => {
      new RepresentationFingerprint({
        fingerprintIdentifier: "hash",
        fingerprintStrategyReference: "",
      });
    }, /Fingerprint strategy reference is required/);

    const fp1 = new RepresentationFingerprint({
      fingerprintIdentifier: "hash-1",
      fingerprintStrategyReference: "algo-1",
    });
    const fp2 = new RepresentationFingerprint({
      fingerprintIdentifier: "hash-1",
      fingerprintStrategyReference: "algo-1",
    });
    const fp3 = new RepresentationFingerprint({
      fingerprintIdentifier: "hash-2",
      fingerprintStrategyReference: "algo-1",
    });

    assert.strictEqual(fp1.equals(fp2), true);
    assert.strictEqual(fp1.equals(fp3), false);
  });

  test("EmbeddingClassification value object validations and comparison checks", () => {
    assert.throws(() => {
      new EmbeddingClassification({ classificationTag: "" });
    }, /Classification tag is required/);

    const cl1 = new EmbeddingClassification({ classificationTag: "tag-1" });
    const cl2 = new EmbeddingClassification({ classificationTag: "tag-1" });
    const cl3 = new EmbeddingClassification({ classificationTag: "tag-2" });

    assert.strictEqual(cl1.equals(cl2), true);
    assert.strictEqual(cl1.equals(cl3), false);
  });

  test("Mock store interface compliance check", async () => {
    const mockStore: EmbeddingAggregateStore = {
      save: async (embedding: Embedding) => {
        assert.ok(embedding.id);
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

    const embedding = Embedding.create(
      "emb-1",
      "client.profile.embedding",
      "owner-123",
      defaultMetadata,
      defaultPolicy,
      defaultClassification,
      "snap-1",
      defaultFingerprint,
    );

    await mockStore.save(embedding);

    const mockPersistence: EmbeddingPersistenceContract = {
      checkUniqueReference: async (
        ownerId: string,
        reference: string,
        excludeEmbeddingId?: string,
      ) => {
        assert.ok(ownerId);
        assert.ok(reference);
        if (excludeEmbeddingId) {
          assert.ok(excludeEmbeddingId);
        }
        return true;
      },
    };

    const isUnique = await mockPersistence.checkUniqueReference(
      "owner-123",
      "client.profile.embedding",
    );
    assert.strictEqual(isUnique, true);

    const projection: EmbeddingQueryProjection = {
      id: "emb-1",
      reference: "client.profile.embedding",
      ownerId: "owner-123",
      displayName: "Summary View",
      status: "Published",
      updatedAt: new Date(),
    };

    assert.strictEqual(projection.status, "Published");
  });
});
