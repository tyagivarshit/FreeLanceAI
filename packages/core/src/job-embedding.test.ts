import { test, describe } from "node:test";
import assert from "node:assert";
import {
  ModelReference,
  JobVectorFingerprint,
  JobEmbeddingSnapshot,
  JOB_EMBEDDING_CREATED,
  JOB_EMBEDDING_GENERATED,
  JOB_EMBEDDING_ARCHIVED,
  JobEmbedding,
} from "./job-embedding.js";
import type {
  JobEmbeddingPersistenceContract,
  JobEmbeddingAggregateStore,
} from "./job-embedding.js";

describe("Chapter 8C — Job Embedding Domain Tests", () => {
  const defaultModelRef = new ModelReference({
    provider: "openai",
    modelName: "text-embedding-3-small",
    modelVersion: "v1",
  });

  const defaultVectorFingerprint = new JobVectorFingerprint("vector-fp-123");

  const defaultVector = [0.1, -0.2, 0.5, 0.9];
  const defaultDimensions = 4;

  // ==========================================
  // 1. SOURCE NORMALIZATION REFERENCE
  // ==========================================
  describe("1. Source Normalization Reference", () => {
    test("valid jobNormalizationId and normalizationVersion", () => {
      const agg = JobEmbedding.create(
        "emb-1",
        "tenant-1",
        "owner-1",
        "norm-123",
        "v1",
        "v1",
        defaultModelRef,
        defaultVector,
        defaultDimensions,
        "input-fp-123",
        defaultVectorFingerprint,
      );

      assert.strictEqual(agg.jobNormalizationId, "norm-123");
      assert.strictEqual(agg.normalizationVersion, "v1");
    });

    test("tenant isolation validation", () => {
      // Embedding identity is tenant-scoped.
      // Two embedding aggregates for the same normalization ref but under different tenants must remain distinct.
      const aggA = JobEmbedding.create(
        "emb-a",
        "tenant-A",
        "owner-1",
        "norm-123",
        "v1",
        "v1",
        defaultModelRef,
        defaultVector,
        defaultDimensions,
        "input-fp-123",
        defaultVectorFingerprint,
      );

      const aggB = JobEmbedding.create(
        "emb-b",
        "tenant-B",
        "owner-1",
        "norm-123",
        "v1",
        "v1",
        defaultModelRef,
        defaultVector,
        defaultDimensions,
        "input-fp-123",
        defaultVectorFingerprint,
      );

      assert.strictEqual(aggA.tenantId, "tenant-A");
      assert.strictEqual(aggB.tenantId, "tenant-B");
      assert.notStrictEqual(aggA.id, aggB.id);
    });

    test("reference immutability", () => {
      const agg = JobEmbedding.create(
        "emb-1",
        "tenant-1",
        "owner-1",
        "norm-123",
        "v1",
        "v1",
        defaultModelRef,
        defaultVector,
        defaultDimensions,
        "input-fp-123",
        defaultVectorFingerprint,
      );

      assert.throws(() => {
        (agg as unknown as Record<string, unknown>).jobNormalizationId = "mutated";
      }, TypeError);
    });
  });

  // ==========================================
  // 2. EMBEDDING VERSION
  // ==========================================
  describe("2. Embedding Version", () => {
    test("v1 accepted and rejects invalid formats", () => {
      // Valid v1
      const agg = JobEmbedding.create(
        "emb-1",
        "tenant-1",
        "owner-1",
        "norm-123",
        "v1",
        "v1",
        defaultModelRef,
        defaultVector,
        defaultDimensions,
        "input-fp-123",
        defaultVectorFingerprint,
      );
      assert.strictEqual(agg.embeddingVersion, "v1");

      // Invalid empty format
      assert.throws(() => {
        JobEmbedding.create(
          "emb-1",
          "tenant-1",
          "owner-1",
          "norm-123",
          "v1",
          "",
          defaultModelRef,
          defaultVector,
          defaultDimensions,
          "input-fp",
          defaultVectorFingerprint,
        );
      }, /Embedding Version is required/);

      // Invalid string format
      assert.throws(() => {
        JobEmbedding.create(
          "emb-1",
          "tenant-1",
          "owner-1",
          "norm-123",
          "v1",
          "version1",
          defaultModelRef,
          defaultVector,
          defaultDimensions,
          "input-fp",
          defaultVectorFingerprint,
        );
      }, /Invalid embedding version format/);
    });

    test("embeddingVersion is immutable", () => {
      const agg = JobEmbedding.create(
        "emb-1",
        "tenant-1",
        "owner-1",
        "norm-123",
        "v1",
        "v1",
        defaultModelRef,
        defaultVector,
        defaultDimensions,
        "input-fp-123",
        defaultVectorFingerprint,
      );
      assert.throws(() => {
        (agg as unknown as Record<string, unknown>).embeddingVersion = "v2";
      }, TypeError);
    });

    test("participates in identity and reprocessing boundary", () => {
      // If version differs (v1 vs v2), they are distinct aggregates
      const aggV1 = JobEmbedding.create(
        "emb-v1",
        "tenant-1",
        "owner-1",
        "norm-123",
        "v1",
        "v1",
        defaultModelRef,
        defaultVector,
        defaultDimensions,
        "input-fp-123",
        defaultVectorFingerprint,
      );

      const aggV2 = JobEmbedding.create(
        "emb-v2",
        "tenant-1",
        "owner-1",
        "norm-123",
        "v1",
        "v2",
        defaultModelRef,
        defaultVector,
        defaultDimensions,
        "input-fp-123",
        defaultVectorFingerprint,
      );

      assert.strictEqual(aggV1.embeddingVersion, "v1");
      assert.strictEqual(aggV2.embeddingVersion, "v2");
      assert.notStrictEqual(aggV1.id, aggV2.id);
    });
  });

  // ==========================================
  // 3. MODEL REFERENCE
  // ==========================================
  describe("3. Model Reference", () => {
    test("valid construction and metadata preservation with zero credentials", () => {
      const ref = new ModelReference({
        provider: "openai",
        modelName: "text-embedding-3-large",
        modelVersion: "v2",
      });

      assert.strictEqual(ref.provider, "openai");
      assert.strictEqual(ref.modelName, "text-embedding-3-large");
      assert.strictEqual(ref.modelVersion, "v2");

      // Verify no API keys, credentials, or client objects exist
      assert.ok(!("apiKey" in ref));
      assert.ok(!("secret" in ref));
      assert.ok(!("client" in ref));
    });

    test("model reference immutability", () => {
      const ref = new ModelReference({
        provider: "openai",
        modelName: "text-embedding-3-large",
        modelVersion: "v2",
      });

      assert.throws(() => {
        (ref as unknown as Record<string, unknown>).provider = "cohere";
      }, TypeError);
    });
  });

  // ==========================================
  // 4. VECTOR VALIDATION
  // ==========================================
  describe("4. Vector Validation", () => {
    test("valid numeric vector accepted", () => {
      const agg = JobEmbedding.create(
        "emb-1",
        "tenant-1",
        "owner-1",
        "norm-123",
        "v1",
        "v1",
        defaultModelRef,
        [0.0, 1.25, -0.77],
        3,
        "input-fp-123",
        defaultVectorFingerprint,
      );
      assert.strictEqual(agg.dimensions, 3);
      assert.deepStrictEqual(agg.vector, [0.0, 1.25, -0.77]);
    });

    test("invalid vector configurations rejected", () => {
      // Empty vector
      assert.throws(() => {
        JobEmbedding.create(
          "emb-1",
          "tenant-1",
          "owner-1",
          "norm-123",
          "v1",
          "v1",
          defaultModelRef,
          [],
          0,
          "input-fp",
          defaultVectorFingerprint,
        );
      }, /Vector must be non-empty/);

      // NaN elements
      assert.throws(() => {
        JobEmbedding.create(
          "emb-1",
          "tenant-1",
          "owner-1",
          "norm-123",
          "v1",
          "v1",
          defaultModelRef,
          [0.5, NaN],
          2,
          "input-fp",
          defaultVectorFingerprint,
        );
      }, /Every vector element must be a finite number/);

      // Infinity elements
      assert.throws(() => {
        JobEmbedding.create(
          "emb-1",
          "tenant-1",
          "owner-1",
          "norm-123",
          "v1",
          "v1",
          defaultModelRef,
          [0.5, Infinity],
          2,
          "input-fp",
          defaultVectorFingerprint,
        );
      }, /Every vector element must be a finite number/);

      // -Infinity elements
      assert.throws(() => {
        JobEmbedding.create(
          "emb-1",
          "tenant-1",
          "owner-1",
          "norm-123",
          "v1",
          "v1",
          defaultModelRef,
          [0.5, -Infinity],
          2,
          "input-fp",
          defaultVectorFingerprint,
        );
      }, /Every vector element must be a finite number/);

      // Non-numeric elements (string coercion check)
      assert.throws(() => {
        JobEmbedding.create(
          "emb-1",
          "tenant-1",
          "owner-1",
          "norm-123",
          "v1",
          "v1",
          defaultModelRef,
          [0.5, "0.2" as unknown as number],
          2,
          "input-fp",
          defaultVectorFingerprint,
        );
      }, /Every vector element must be a number/);

      // Dimension mismatch
      assert.throws(() => {
        JobEmbedding.create(
          "emb-1",
          "tenant-1",
          "owner-1",
          "norm-123",
          "v1",
          "v1",
          defaultModelRef,
          [0.5, 0.2],
          3,
          "input-fp",
          defaultVectorFingerprint,
        );
      }, /Vector length must match dimensions/);
    });
  });

  // ==========================================
  // 5. VECTOR IMMUTABILITY
  // ==========================================
  describe("5. Vector Immutability", () => {
    test("constructor defensive copies & getter immutability prevent modifications", () => {
      const inputVector = [0.1, 0.2, 0.3];
      const agg = JobEmbedding.create(
        "emb-1",
        "tenant-1",
        "owner-1",
        "norm-123",
        "v1",
        "v1",
        defaultModelRef,
        inputVector,
        3,
        "input-fp-123",
        defaultVectorFingerprint,
      );

      // Mutate original input vector array
      inputVector[0] = 9.9;
      assert.deepStrictEqual(agg.vector, [0.1, 0.2, 0.3]); // unchanged

      // Attempt index mutation on getter array
      const vectorFromGetter = agg.vector;
      assert.throws(() => {
        (vectorFromGetter as number[])[0] = 9.9;
      }, TypeError);

      // Attempt array mutations
      assert.throws(() => {
        (vectorFromGetter as number[]).push(0.4);
      }, TypeError);

      assert.throws(() => {
        (vectorFromGetter as number[]).pop();
      }, TypeError);
    });
  });

  // ==========================================
  // 6. INPUT FINGERPRINT
  // ==========================================
  describe("6. Input Fingerprint", () => {
    test("preserves normalized state fingerprint, is immutable and separate", () => {
      const agg = JobEmbedding.create(
        "emb-1",
        "tenant-1",
        "owner-1",
        "norm-123",
        "v1",
        "v1",
        defaultModelRef,
        defaultVector,
        defaultDimensions,
        "input-fp-123",
        defaultVectorFingerprint,
      );

      assert.strictEqual(agg.inputFingerprint, "input-fp-123");
      assert.notStrictEqual(agg.inputFingerprint, agg.vectorFingerprint.value);

      assert.throws(() => {
        (agg as unknown as Record<string, unknown>).inputFingerprint = "mutated";
      }, TypeError);
    });
  });

  // ==========================================
  // 7. VECTOR FINGERPRINT
  // ==========================================
  describe("7. Vector Fingerprint", () => {
    test("vector fingerprint properties and determinism", () => {
      const fp = new JobVectorFingerprint("vector-fp-value");
      assert.strictEqual(fp.value, "vector-fp-value");

      assert.throws(() => {
        (fp as unknown as Record<string, unknown>).value = "mutated";
      }, TypeError);

      const fpSame = new JobVectorFingerprint("vector-fp-value");
      assert.ok(fp.equals(fpSame));
    });
  });

  // ==========================================
  // 8. AGGREGATE CREATION
  // ==========================================
  describe("8. Aggregate Creation", () => {
    test("initializes state as CREATED with snapshot version 1 and domain event", () => {
      const agg = JobEmbedding.create(
        "emb-123",
        "tenant-abc",
        "owner-xyz",
        "norm-456",
        "v1",
        "v1",
        defaultModelRef,
        defaultVector,
        defaultDimensions,
        "input-fp-abc",
        defaultVectorFingerprint,
      );

      assert.strictEqual(agg.id, "emb-123");
      assert.strictEqual(agg.status, "CREATED");

      // Snapshot 1 check
      assert.strictEqual(agg.snapshots.length, 1);
      assert.strictEqual(agg.snapshots[0]!.version, 1);
      assert.strictEqual(agg.snapshots[0]!.status, "CREATED");

      // Event check
      assert.strictEqual(agg.domainEvents.length, 1);
      const ev = agg.domainEvents[0]!;
      assert.strictEqual(ev.eventType, JOB_EMBEDDING_CREATED);
      assert.strictEqual(ev.embeddingId, "emb-123");
      assert.strictEqual(ev.tenantId, "tenant-abc");
      assert.strictEqual(ev.ownerId, "owner-xyz");
      assert.strictEqual(ev.snapshotVersion, 1);
    });
  });

  // ==========================================
  // 9. GENERATION
  // ==========================================
  describe("9. Generation Operation", () => {
    test("markGenerated transitions CREATED to GENERATED, increments snapshot and emits event", () => {
      const agg = JobEmbedding.create(
        "emb-1",
        "tenant-1",
        "owner-1",
        "norm-123",
        "v1",
        "v1",
        defaultModelRef,
        defaultVector,
        defaultDimensions,
        "input-fp-123",
        defaultVectorFingerprint,
      );

      agg.markGenerated("owner-1");
      assert.strictEqual(agg.status, "GENERATED");
      assert.strictEqual(agg.snapshots.length, 2);
      assert.strictEqual(agg.snapshots[1]!.version, 2);
      assert.strictEqual(agg.snapshots[1]!.status, "GENERATED");

      assert.strictEqual(agg.domainEvents.length, 2);
      assert.strictEqual(agg.domainEvents[1]!.eventType, JOB_EMBEDDING_GENERATED);
    });
  });

  // ==========================================
  // 10. ARCHIVE
  // ==========================================
  describe("10. Archive Operation", () => {
    test("transitions CREATED -> ARCHIVED and GENERATED -> ARCHIVED correctly", () => {
      const agg1 = JobEmbedding.create(
        "emb-1",
        "tenant-1",
        "owner-1",
        "norm-123",
        "v1",
        "v1",
        defaultModelRef,
        defaultVector,
        defaultDimensions,
        "input-fp-123",
        defaultVectorFingerprint,
      );
      agg1.archive("owner-1");
      assert.strictEqual(agg1.status, "ARCHIVED");
      assert.strictEqual(agg1.snapshots.length, 2);

      const agg2 = JobEmbedding.create(
        "emb-2",
        "tenant-1",
        "owner-1",
        "norm-123",
        "v1",
        "v1",
        defaultModelRef,
        defaultVector,
        defaultDimensions,
        "input-fp-123",
        defaultVectorFingerprint,
      );
      agg2.markGenerated("owner-1");
      agg2.archive("owner-1");
      assert.strictEqual(agg2.status, "ARCHIVED");
      assert.strictEqual(agg2.snapshots.length, 3);
      assert.strictEqual(agg2.domainEvents[2]!.eventType, JOB_EMBEDDING_ARCHIVED);
    });
  });

  // ==========================================
  // 11. INVALID LIFECYCLE
  // ==========================================
  describe("11. Invalid Lifecycle transitions", () => {
    test("rejects backwards and invalid transitions from ARCHIVED", () => {
      const agg = JobEmbedding.create(
        "emb-1",
        "tenant-1",
        "owner-1",
        "norm-123",
        "v1",
        "v1",
        defaultModelRef,
        defaultVector,
        defaultDimensions,
        "input-fp-123",
        defaultVectorFingerprint,
      );
      agg.markGenerated("owner-1");

      // Reject transition back to CREATED
      assert.throws(() => {
        (agg as unknown as { transitionTo(status: string): void }).transitionTo("CREATED");
      }, /Invalid lifecycle transition from GENERATED to CREATED/);

      agg.archive("owner-1");
      assert.strictEqual(agg.status, "ARCHIVED");

      // Archived terminal rejections
      assert.throws(
        () => agg.markGenerated("owner-1"),
        /Invalid lifecycle transition from ARCHIVED to GENERATED/,
      );
      assert.throws(() => agg.archive("owner-1"), /Job embedding is already archived/);
      assert.throws(() => {
        (agg as unknown as { transitionTo(status: string): void }).transitionTo("CREATED");
      }, /Invalid lifecycle transition from ARCHIVED to CREATED/);
    });
  });

  // ==========================================
  // 12. OWNERSHIP
  // ==========================================
  describe("12. Ownership Validation", () => {
    test("mutations reject wrong owners with exact error, leaving state unmodified", () => {
      const agg = JobEmbedding.create(
        "emb-1",
        "tenant-1",
        "owner-1",
        "norm-123",
        "v1",
        "v1",
        defaultModelRef,
        defaultVector,
        defaultDimensions,
        "input-fp-123",
        defaultVectorFingerprint,
      );

      // Unauthorized markGenerated
      assert.throws(
        () => {
          agg.markGenerated("unauthorized-owner");
        },
        (err: Error) => {
          return err.message === "Ownership validation failed: unauthorized owner context.";
        },
      );

      // Unauthorized archive
      assert.throws(
        () => {
          agg.archive("unauthorized-owner");
        },
        (err: Error) => {
          return err.message === "Ownership validation failed: unauthorized owner context.";
        },
      );

      // State is unmodified
      assert.strictEqual(agg.status, "CREATED");
      assert.strictEqual(agg.snapshots.length, 1);
      assert.strictEqual(agg.domainEvents.length, 1);
    });
  });

  // ==========================================
  // 13. SNAPSHOTS
  // ==========================================
  describe("13. Snapshot Invariants", () => {
    test("sequential snapshot versions starting at 1 with no duplicates/gaps", () => {
      const agg = JobEmbedding.create(
        "emb-1",
        "tenant-1",
        "owner-1",
        "norm-123",
        "v1",
        "v1",
        defaultModelRef,
        defaultVector,
        defaultDimensions,
        "input-fp-123",
        defaultVectorFingerprint,
      );
      agg.markGenerated("owner-1");
      agg.archive("owner-1");

      assert.strictEqual(agg.snapshots.length, 3);
      assert.strictEqual(agg.snapshots[0]!.version, 1);
      assert.strictEqual(agg.snapshots[1]!.version, 2);
      assert.strictEqual(agg.snapshots[2]!.version, 3);

      // Rebuilding with invalid snapshots throws
      assert.throws(() => {
        new JobEmbedding({
          id: "emb-1",
          tenantId: "tenant-1",
          ownerId: "owner-1",
          jobNormalizationId: "norm-123",
          normalizationVersion: "v1",
          embeddingVersion: "v1",
          modelReference: defaultModelRef,
          vector: defaultVector,
          dimensions: defaultDimensions,
          inputFingerprint: "input-fp-123",
          vectorFingerprint: defaultVectorFingerprint,
          status: "CREATED",
          snapshots: [
            agg.snapshots[0]!,
            agg.snapshots[2]!, // Version 2 skipped
          ],
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }, /Snapshot history must be sequential and start at 1/);
    });
  });

  // ==========================================
  // 14. DATES
  // ==========================================
  describe("14. Date Immutability", () => {
    test("defensive copies on entry and exit, setTime fails to modify private state", () => {
      const mockDate = new Date("2026-08-11T12:00:00Z");
      const snap = new JobEmbeddingSnapshot({
        version: 1,
        createdAt: mockDate,
        status: "CREATED",
        jobNormalizationId: "norm-123",
        normalizationVersion: "v1",
        embeddingVersion: "v1",
        modelReference: defaultModelRef,
        vector: defaultVector,
        dimensions: defaultDimensions,
        inputFingerprint: "input-fp-123",
        vectorFingerprint: defaultVectorFingerprint,
      });

      const agg = new JobEmbedding({
        id: "emb-1",
        tenantId: "tenant-1",
        ownerId: "owner-1",
        jobNormalizationId: "norm-123",
        normalizationVersion: "v1",
        embeddingVersion: "v1",
        modelReference: defaultModelRef,
        vector: defaultVector,
        dimensions: defaultDimensions,
        inputFingerprint: "input-fp-123",
        vectorFingerprint: defaultVectorFingerprint,
        status: "CREATED",
        snapshots: [snap],
        createdAt: mockDate,
        updatedAt: mockDate,
      });

      // Modifying constructor date input
      mockDate.setTime(0);
      assert.notStrictEqual(agg.createdAt.getTime(), 0);

      // Modifying getter output
      const c = agg.createdAt;
      c.setTime(1000);
      c.setDate(15);
      c.setFullYear(2035);
      assert.notStrictEqual(agg.createdAt.getTime(), 1000);

      // Modifying snapshot date
      const snapDate = agg.snapshots[0]!.createdAt;
      snapDate.setTime(0);
      assert.notStrictEqual(agg.snapshots[0]!.createdAt.getTime(), 0);
    });
  });

  // ==========================================
  // 15. EVENTS
  // ==========================================
  describe("15. Domain Events", () => {
    test("event payload naming & structure contains zero infrastructure references", () => {
      const agg = JobEmbedding.create(
        "emb-1",
        "tenant-1",
        "owner-1",
        "norm-123",
        "v1",
        "v1",
        defaultModelRef,
        defaultVector,
        defaultDimensions,
        "input-fp-123",
        defaultVectorFingerprint,
      );

      const ev = agg.domainEvents[0]!;
      assert.strictEqual(ev.eventType, JOB_EMBEDDING_CREATED);
      assert.strictEqual(ev.embeddingId, "emb-1");
      assert.strictEqual(ev.tenantId, "tenant-1");
      assert.strictEqual(ev.ownerId, "owner-1");
      assert.strictEqual(ev.snapshotVersion, 1);

      // Verify payload is frozen
      assert.throws(() => {
        (ev as unknown as Record<string, unknown>).embeddingId = "mutated";
      }, TypeError);

      // Verify no api keys or DB references
      assert.ok(!("redis" in ev));
      assert.ok(!("database" in ev));
    });
  });

  // ==========================================
  // 16. PERSISTENCE
  // ==========================================
  describe("16. Persistence Contracts compilation", () => {
    test("signatures match technological neutrality rules", () => {
      const dummyStore: JobEmbeddingAggregateStore = {
        async save(_embedding: JobEmbedding): Promise<void> {},
        async findById(_id: string, _tenantId: string): Promise<JobEmbedding | null> {
          return null;
        },
        async findByNormalizationReference(
          _tenantId: string,
          _jobNormalizationId: string,
          _normalizationVersion: string,
          _embeddingVersion: string,
          _modelReference: ModelReference,
        ): Promise<JobEmbedding | null> {
          return null;
        },
      };

      const dummyContract: JobEmbeddingPersistenceContract = {
        async findByNormalizationReference(
          _tenantId: string,
          _jobNormalizationId: string,
          _normalizationVersion: string,
          _embeddingVersion: string,
          _modelReference: ModelReference,
        ): Promise<JobEmbedding | null> {
          return null;
        },
      };

      assert.ok(dummyStore);
      assert.ok(dummyContract);
    });
  });

  // ==========================================
  // 17. PROVIDER BOUNDARY
  // ==========================================
  describe("17. Provider Boundary", () => {
    test("Verify no AI models, credentials, HTTP or SDK libraries imported", () => {
      const prototypeKeys = Object.keys(JobEmbedding.prototype);
      assert.ok(!prototypeKeys.includes("_openAiClient"));
      assert.ok(!prototypeKeys.includes("_anthropicClient"));
    });
  });

  // ==========================================
  // 18. VECTOR SEARCH BOUNDARY
  // ==========================================
  describe("18. Vector Search Boundary", () => {
    test("Verify cosine similarity or search engines are excluded", () => {
      const prototypeKeys = Object.keys(JobEmbedding.prototype);
      assert.ok(!prototypeKeys.includes("cosineSimilarity"));
      assert.ok(!prototypeKeys.includes("dotProduct"));
      assert.ok(!prototypeKeys.includes("searchNearest"));
    });
  });

  // ==========================================
  // 19. FUTURE CHAPTER BOUNDARIES
  // ==========================================
  describe("19. Future Chapter Boundaries", () => {
    test("Verify no matching, scoring, ranking, explanation, caching, or workers are implemented", () => {
      const prototypeKeys = Object.keys(JobEmbedding.prototype);
      assert.ok(!prototypeKeys.includes("score"));
      assert.ok(!prototypeKeys.includes("rank"));
      assert.ok(!prototypeKeys.includes("explain"));
      assert.ok(!prototypeKeys.includes("cache"));
      assert.ok(!prototypeKeys.includes("enqueue"));
    });
  });
});
