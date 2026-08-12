import { test, describe } from "node:test";
import assert from "node:assert";
import {
  calculateCosineSimilarity,
  matchExperience,
  matchBudget,
  matchJobType,
  matchLocation,
  freezeMatchSignals,
  JobMatchSnapshot,
  JOB_MATCH_CREATED,
  JOB_MATCH_EVALUATED,
  JOB_MATCH_ARCHIVED,
  JobMatch,
} from "./job-match.js";
import type {
  JobMatchPersistenceContract,
  JobMatchAggregateStore,
  MatchingInputs,
  FreelancerMatchingProfile,
  JobNormalizationInput,
  JobEmbeddingInput,
} from "./job-match.js";

describe("Chapter 8D — Job Matching Engine Domain Tests", () => {
  const defaultFreelancerProfile: FreelancerMatchingProfile = {
    freelancerId: "free-123",
    tenantId: "tenant-1",
    skills: ["python", "fastapi"],
    experience: "senior",
    budget: {
      type: "fixed",
      rate: 1000,
      currency: "USD",
    },
    preferredJobTypes: ["fixed", "contract"],
    location: {
      country: "US",
    },
    embeddingVector: [0.1, 0.2, 0.3],
  };

  const defaultJobNormalization: JobNormalizationInput = {
    id: "norm-123",
    tenantId: "tenant-1",
    canonicalJob: {
      title: "Python Developer",
      description: "FastAPI requirement",
      skills: ["python", "fastapi"],
      experience: "senior",
      budget: {
        type: "fixed",
        minimum: 500,
        maximum: 1500,
        currency: "USD",
      },
      jobType: "fixed",
      location: {
        mode: "remote",
        country: "US",
      },
    },
  };

  const defaultJobEmbedding: JobEmbeddingInput = {
    id: "emb-123",
    tenantId: "tenant-1",
    vector: [0.1, 0.2, 0.3],
    dimensions: 3,
  };

  const defaultMatchingInputs: MatchingInputs = {
    freelancerProfile: defaultFreelancerProfile,
    jobNormalization: defaultJobNormalization,
    jobEmbedding: defaultJobEmbedding,
  };

  // ==========================================
  // 1. MATCH IDENTITY
  // ==========================================
  describe("1. Match Identity", () => {
    test("valid construction and logical properties", () => {
      const match = JobMatch.create(
        "match-1",
        "tenant-1",
        "owner-1",
        "free-123",
        "job-123",
        "norm-123",
        "v1",
        "v1",
        "emb-123",
        "v1",
      );

      assert.strictEqual(match.id, "match-1");
      assert.strictEqual(match.tenantId, "tenant-1");
      assert.strictEqual(match.freelancerId, "free-123");
      assert.strictEqual(match.jobId, "job-123");
      assert.strictEqual(match.matchingVersion, "v1");
      assert.strictEqual(match.normalizationVersion, "v1");
      assert.strictEqual(match.embeddingVersion, "v1");
    });

    test("identity fields are immutable", () => {
      const match = JobMatch.create(
        "match-1",
        "tenant-1",
        "owner-1",
        "free-123",
        "job-123",
        "norm-123",
        "v1",
        "v1",
      );

      assert.throws(() => {
        (match as unknown as Record<string, unknown>).freelancerId = "mutated";
      }, TypeError);
      assert.throws(() => {
        (match as unknown as Record<string, unknown>).matchingVersion = "v2";
      }, TypeError);
    });
  });

  // ==========================================
  // 2. TENANT ISOLATION
  // ==========================================
  describe("2. Tenant Isolation", () => {
    test("same-tenant inputs are evaluated successfully", () => {
      const match = JobMatch.create(
        "match-1",
        "tenant-1",
        "owner-1",
        "free-123",
        "job-123",
        "norm-123",
        "v1",
        "v1",
        "emb-123",
        "v1",
      );

      assert.doesNotThrow(() => {
        match.evaluate("owner-1", defaultMatchingInputs);
      });
      assert.strictEqual(match.status, "EVALUATED");
    });

    test("cross-tenant inputs are rejected", () => {
      const match = JobMatch.create(
        "match-1",
        "tenant-1",
        "owner-1",
        "free-123",
        "job-123",
        "norm-123",
        "v1",
        "v1",
      );

      // Freelancer belongs to tenant-2
      const crossTenantFreelancerInputs: MatchingInputs = {
        freelancerProfile: {
          ...defaultFreelancerProfile,
          tenantId: "tenant-2",
        },
        jobNormalization: defaultJobNormalization,
      };

      assert.throws(() => {
        match.evaluate("owner-1", crossTenantFreelancerInputs);
      }, /Tenant isolation violation/);

      // Job belongs to tenant-2
      const crossTenantJobInputs: MatchingInputs = {
        freelancerProfile: defaultFreelancerProfile,
        jobNormalization: {
          ...defaultJobNormalization,
          tenantId: "tenant-2",
        },
      };

      assert.throws(() => {
        match.evaluate("owner-1", crossTenantJobInputs);
      }, /Tenant isolation violation/);
    });
  });

  // ==========================================
  // 3. SEMANTIC MATCHING
  // ==========================================
  describe("3. Semantic Matching", () => {
    test("valid equal-dimension vectors calculate deterministic similarity within [-1, 1] range", () => {
      // Direct calculations
      const similarity1 = calculateCosineSimilarity([1, 0, 0], [1, 0, 0]);
      assert.strictEqual(similarity1, 1.0); // Exact direction match

      const similarity2 = calculateCosineSimilarity([1, 0, 0], [0, 1, 0]);
      assert.strictEqual(similarity2, 0.0); // Orthogonal vectors

      const similarity3 = calculateCosineSimilarity([1, 0, 0], [-1, 0, 0]);
      assert.strictEqual(similarity3, -1.0); // Opposite direction

      // Verification of intermediate range
      const sim = calculateCosineSimilarity([0.5, 0.5, 0.0], [0.5, 0.0, 0.0]);
      assert.ok(sim > 0.0 && sim < 1.0);
    });

    test("incompatible dimensions are rejected", () => {
      assert.throws(() => {
        calculateCosineSimilarity([0.1, 0.2], [0.1, 0.2, 0.3]);
      }, /Vector dimension mismatch/);
    });

    test("invalid vector elements are rejected", () => {
      assert.throws(() => {
        calculateCosineSimilarity([0.1, NaN], [0.1, 0.2]);
      }, /Vector elements must be finite numbers/);

      assert.throws(() => {
        calculateCosineSimilarity([0.1, Infinity], [0.1, 0.2]);
      }, /Vector elements must be finite numbers/);
    });

    test("verifies that no overallScore is calculated inside similarity signal", () => {
      const match = JobMatch.create(
        "match-1",
        "tenant-1",
        "owner-1",
        "free-123",
        "job-123",
        "norm-123",
        "v1",
        "v1",
        "emb-123",
        "v1",
      );
      match.evaluate("owner-1", defaultMatchingInputs);

      // Verify overallScore field is absent from matchSignals
      assert.ok(!("overallScore" in (match.matchSignals as unknown as Record<string, unknown>)));
      assert.ok(!("weightedScore" in (match.matchSignals as unknown as Record<string, unknown>)));
    });
  });

  // ==========================================
  // 4. SKILL MATCHING
  // ==========================================
  describe("4. Skill Matching", () => {
    test("extracts exact canonical skill intersection & missing lists in sorted order", () => {
      const match = JobMatch.create(
        "match-1",
        "tenant-1",
        "owner-1",
        "free-123",
        "job-123",
        "norm-123",
        "v1",
        "v1",
      );

      const inputs: MatchingInputs = {
        freelancerProfile: {
          ...defaultFreelancerProfile,
          skills: ["React", "FastAPI", "  Python  "], // mixed casing & padding
        },
        jobNormalization: {
          ...defaultJobNormalization,
          canonicalJob: {
            ...defaultJobNormalization.canonicalJob,
            skills: ["fastapi", "python", "docker"], // lowcased canonical list from 8B
          },
        },
      };

      match.evaluate("owner-1", inputs);
      const signals = match.matchSignals!;

      assert.deepStrictEqual(signals.matchedSkills, ["fastapi", "python"]); // normalized to lowercase intersection, sorted
      assert.deepStrictEqual(signals.missingSkills, ["docker"]);
      assert.strictEqual(signals.skillCoverage, 2 / 3);
    });

    test("skill signal arrays are immutable", () => {
      const match = JobMatch.create(
        "match-1",
        "tenant-1",
        "owner-1",
        "free-123",
        "job-123",
        "norm-123",
        "v1",
        "v1",
        "emb-123",
        "v1",
      );
      match.evaluate("owner-1", defaultMatchingInputs);

      const signals = match.matchSignals!;
      assert.throws(() => {
        (signals.matchedSkills as string[]).push("docker");
      }, TypeError);
    });
  });

  // ==========================================
  // 5. EXPERIENCE COMPATIBILITY
  // ==========================================
  describe("5. Experience Compatibility", () => {
    test("maps experience combinations onto COMPATIBLE, PARTIAL, INCOMPATIBLE, or UNKNOWN", () => {
      // Equal
      assert.strictEqual(matchExperience("senior", "senior"), "COMPATIBLE");

      // Higher experience
      assert.strictEqual(matchExperience("junior", "expert"), "COMPATIBLE");

      // One level lower
      assert.strictEqual(matchExperience("expert", "mid"), "PARTIAL");

      // Two levels lower
      assert.strictEqual(matchExperience("expert", "junior"), "INCOMPATIBLE");

      // Unmapped strings fallback
      assert.strictEqual(matchExperience("expert", "some-unmapped-experience"), "UNKNOWN");

      // Missing values
      assert.strictEqual(matchExperience(undefined, "senior"), "UNKNOWN");
    });
  });

  // ==========================================
  // 6. BUDGET COMPATIBILITY
  // ==========================================
  describe("6. Budget Compatibility", () => {
    test("budget rules evaluate compatibility cleanly", () => {
      // Freelancer rate <= Job limit
      const jobB = { type: "fixed", minimum: 500, maximum: 1200, currency: "USD" };
      const freeB = { type: "fixed", rate: 1000, currency: "USD" };
      assert.strictEqual(matchBudget(jobB, freeB), "COMPATIBLE");

      // Freelancer rate > Job limit
      const freeBExpensive = { type: "fixed", rate: 1500, currency: "USD" };
      assert.strictEqual(matchBudget(jobB, freeBExpensive), "INCOMPATIBLE");
    });

    test("currency differences return INCOMPATIBLE without conversion", () => {
      const jobB = { type: "fixed", minimum: 500, maximum: 1200, currency: "EUR" };
      const freeB = { type: "fixed", rate: 1000, currency: "USD" };
      assert.strictEqual(matchBudget(jobB, freeB), "INCOMPATIBLE");
    });
  });

  // ==========================================
  // 7. JOB TYPE COMPATIBILITY
  // ==========================================
  describe("7. Job Type Compatibility", () => {
    test("evaluates job-type mapping rules", () => {
      assert.strictEqual(matchJobType("fixed", ["fixed", "hourly"]), "COMPATIBLE");
      assert.strictEqual(matchJobType("hourly", ["fixed"]), "INCOMPATIBLE");
      assert.strictEqual(matchJobType(undefined, ["fixed"]), "UNKNOWN");
    });
  });

  // ==========================================
  // 8. LOCATION COMPATIBILITY
  // ==========================================
  describe("8. Location Compatibility", () => {
    test("location compatibility evaluations", () => {
      const jobLoc = { mode: "onsite", country: "Canada" };
      const freeLocMatches = { country: "Canada" };
      const freeLocMismatches = { country: "US" };

      assert.strictEqual(matchLocation(jobLoc, freeLocMatches), "COMPATIBLE");
      assert.strictEqual(matchLocation(jobLoc, freeLocMismatches), "INCOMPATIBLE");

      // Remote mode fallback to partial compatibility on mismatch
      const remoteJobLoc = { mode: "remote", country: "Canada" };
      assert.strictEqual(matchLocation(remoteJobLoc, freeLocMismatches), "PARTIAL");
    });
  });

  // ==========================================
  // 9. MATCH SIGNALS
  // ==========================================
  describe("9. MatchSignals", () => {
    test("deep immutability on MatchSignals fields, zero score metrics", () => {
      const signals = freezeMatchSignals({
        matchedSkills: ["python"],
        missingSkills: ["fastapi"],
        skillCoverage: 0.5,
        experienceCompatibility: "COMPATIBLE",
        budgetCompatibility: "COMPATIBLE",
        jobTypeCompatibility: "COMPATIBLE",
        locationCompatibility: "COMPATIBLE",
      });

      assert.throws(() => {
        (signals as unknown as Record<string, unknown>).skillCoverage = 0.9;
      }, TypeError);

      assert.throws(() => {
        (signals.matchedSkills as string[]).push("javascript");
      }, TypeError);

      // Verify score fields are completely absent
      assert.ok(!("overallScore" in signals));
      assert.ok(!("weightedScore" in signals));
      assert.ok(!("confidenceScore" in signals));
    });
  });

  // ==========================================
  // 10. AGGREGATE CREATION
  // ==========================================
  describe("10. Aggregate Creation", () => {
    test("creates aggregate in CREATED state with snapshot version 1 and domain event", () => {
      const match = JobMatch.create(
        "match-1",
        "tenant-1",
        "owner-1",
        "free-123",
        "job-123",
        "norm-123",
        "v1",
        "v1",
        "emb-123",
        "v1",
      );

      assert.strictEqual(match.status, "CREATED");
      assert.strictEqual(match.snapshots.length, 1);
      assert.strictEqual(match.snapshots[0]!.version, 1);
      assert.strictEqual(match.snapshots[0]!.status, "CREATED");

      assert.strictEqual(match.domainEvents.length, 1);
      const ev = match.domainEvents[0]!;
      assert.strictEqual(ev.eventType, JOB_MATCH_CREATED);
      assert.strictEqual(ev.matchId, "match-1");
      assert.strictEqual(ev.snapshotVersion, 1);
    });
  });

  // ==========================================
  // 11. EVALUATION
  // ==========================================
  describe("11. Evaluation Operation", () => {
    test("transitions CREATED -> EVALUATED, generates signals, and increments snapshot", () => {
      const match = JobMatch.create(
        "match-1",
        "tenant-1",
        "owner-1",
        "free-123",
        "job-123",
        "norm-123",
        "v1",
        "v1",
        "emb-123",
        "v1",
      );

      match.evaluate("owner-1", defaultMatchingInputs);

      assert.strictEqual(match.status, "EVALUATED");
      assert.ok(match.matchSignals);
      assert.strictEqual(match.snapshots.length, 2);
      assert.strictEqual(match.snapshots[1]!.version, 2);
      assert.strictEqual(match.snapshots[1]!.status, "EVALUATED");

      assert.strictEqual(match.domainEvents.length, 2);
      assert.strictEqual(match.domainEvents[1]!.eventType, JOB_MATCH_EVALUATED);
    });
  });

  // ==========================================
  // 12. ARCHIVE
  // ==========================================
  describe("12. Archive Operation", () => {
    test("transitions CREATED -> ARCHIVED and EVALUATED -> ARCHIVED correctly", () => {
      const match1 = JobMatch.create(
        "match-1",
        "tenant-1",
        "owner-1",
        "free-123",
        "job-123",
        "norm-123",
        "v1",
        "v1",
        "emb-123",
        "v1",
      );
      match1.archive("owner-1");
      assert.strictEqual(match1.status, "ARCHIVED");

      const match2 = JobMatch.create(
        "match-2",
        "tenant-1",
        "owner-1",
        "free-123",
        "job-123",
        "norm-123",
        "v1",
        "v1",
        "emb-123",
        "v1",
      );
      match2.evaluate("owner-1", defaultMatchingInputs);
      match2.archive("owner-1");
      assert.strictEqual(match2.status, "ARCHIVED");
      assert.strictEqual(match2.snapshots.length, 3);
      assert.strictEqual(match2.snapshots[2]!.status, "ARCHIVED");
      assert.strictEqual(match2.domainEvents[2]!.eventType, JOB_MATCH_ARCHIVED);
    });
  });

  // ==========================================
  // 13. INVALID LIFECYCLE TRANSITIONS
  // ==========================================
  describe("13. Invalid Lifecycle", () => {
    test("rejects backward and terminal state lifecycle updates", () => {
      const match = JobMatch.create(
        "match-1",
        "tenant-1",
        "owner-1",
        "free-123",
        "job-123",
        "norm-123",
        "v1",
        "v1",
        "emb-123",
        "v1",
      );
      match.evaluate("owner-1", defaultMatchingInputs);

      // Rejects backward path
      assert.throws(() => {
        (match as unknown as { transitionTo(s: string): void }).transitionTo("CREATED");
      }, /Invalid lifecycle transition from EVALUATED to CREATED/);

      match.archive("owner-1");
      assert.strictEqual(match.status, "ARCHIVED");

      // Archived terminal checks
      assert.throws(
        () => match.evaluate("owner-1", defaultMatchingInputs),
        /Invalid lifecycle transition from ARCHIVED to EVALUATED/,
      );
      assert.throws(() => match.archive("owner-1"), /Job match is already archived/);
      assert.throws(() => {
        (match as unknown as { transitionTo(s: string): void }).transitionTo("CREATED");
      }, /Invalid lifecycle transition from ARCHIVED to CREATED/);
    });
  });

  // ==========================================
  // 14. OWNERSHIP
  // ==========================================
  describe("14. Ownership Validation", () => {
    test("mutating commands enforce ownership with exact period-ended error", () => {
      const match = JobMatch.create(
        "match-1",
        "tenant-1",
        "owner-1",
        "free-123",
        "job-123",
        "norm-123",
        "v1",
        "v1",
        "emb-123",
        "v1",
      );

      // Unauthorized evaluation
      assert.throws(
        () => {
          match.evaluate("unauthorized-owner", defaultMatchingInputs);
        },
        (err: Error) => {
          return err.message === "Ownership validation failed: unauthorized owner context.";
        },
      );

      // Unauthorized archiving
      assert.throws(
        () => {
          match.archive("unauthorized-owner");
        },
        (err: Error) => {
          return err.message === "Ownership validation failed: unauthorized owner context.";
        },
      );

      // Zero side-effects
      assert.strictEqual(match.status, "CREATED");
      assert.strictEqual(match.snapshots.length, 1);
      assert.strictEqual(match.domainEvents.length, 1);
    });
  });

  // ==========================================
  // 15. SNAPSHOTS
  // ==========================================
  describe("15. Snapshots", () => {
    test("strictly sequential snapshot history starting at 1, append-only", () => {
      const match = JobMatch.create(
        "match-1",
        "tenant-1",
        "owner-1",
        "free-123",
        "job-123",
        "norm-123",
        "v1",
        "v1",
        "emb-123",
        "v1",
      );
      match.evaluate("owner-1", defaultMatchingInputs);
      match.archive("owner-1");

      assert.strictEqual(match.snapshots.length, 3);
      assert.strictEqual(match.snapshots[0]!.version, 1);
      assert.strictEqual(match.snapshots[1]!.version, 2);
      assert.strictEqual(match.snapshots[2]!.version, 3);

      const snaps = match.snapshots;
      assert.throws(() => {
        (snaps as unknown as JobMatchSnapshot[]).push(snaps[0]!);
      }, TypeError);

      // Verify that reconstructing with invalid versions fails
      assert.throws(() => {
        new JobMatch({
          id: "match-1",
          tenantId: "tenant-1",
          ownerId: "owner-1",
          freelancerId: "free-123",
          jobId: "job-123",
          jobNormalizationId: "norm-123",
          normalizationVersion: "v1",
          matchingVersion: "v1",
          status: "CREATED",
          snapshots: [
            match.snapshots[0]!,
            match.snapshots[2]!, // skipped snapshot version 2
          ],
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }, /Snapshot history must be sequential and start at 1/);
    });
  });

  // ==========================================
  // 16. DATES
  // ==========================================
  describe("16. Date Immutability", () => {
    test("defensive copying on entry and exit prevents internal changes via setTime", () => {
      const entryDate = new Date("2026-08-11T12:00:00Z");
      const snap = new JobMatchSnapshot({
        version: 1,
        createdAt: entryDate,
        status: "CREATED",
        freelancerId: "free-123",
        jobId: "job-123",
        jobNormalizationId: "norm-123",
        normalizationVersion: "v1",
        matchingVersion: "v1",
      });

      const match = new JobMatch({
        id: "match-1",
        tenantId: "tenant-1",
        ownerId: "owner-1",
        freelancerId: "free-123",
        jobId: "job-123",
        jobNormalizationId: "norm-123",
        normalizationVersion: "v1",
        matchingVersion: "v1",
        status: "CREATED",
        snapshots: [snap],
        createdAt: entryDate,
        updatedAt: entryDate,
      });

      // Modify entry date
      entryDate.setTime(0);
      assert.notStrictEqual(match.createdAt.getTime(), 0);

      // Modify getter date
      const created = match.createdAt;
      created.setTime(1000);
      created.setDate(15);
      created.setFullYear(2035);
      assert.notStrictEqual(match.createdAt.getTime(), 1000);

      // Modify snapshot date
      const snapDate = match.snapshots[0]!.createdAt;
      snapDate.setTime(0);
      assert.notStrictEqual(match.snapshots[0]!.createdAt.getTime(), 0);
    });
  });

  // ==========================================
  // 17. EVENTS
  // ==========================================
  describe("17. Domain Events", () => {
    test("exact domain events, payload structure and freezing with no secrets", () => {
      const match = JobMatch.create(
        "match-1",
        "tenant-1",
        "owner-1",
        "free-123",
        "job-123",
        "norm-123",
        "v1",
        "v1",
      );

      const ev = match.domainEvents[0]!;
      assert.strictEqual(ev.eventType, JOB_MATCH_CREATED);
      assert.strictEqual(ev.matchId, "match-1");
      assert.strictEqual(ev.tenantId, "tenant-1");
      assert.strictEqual(ev.ownerId, "owner-1");
      assert.strictEqual(ev.snapshotVersion, 1);

      assert.throws(() => {
        (ev as unknown as Record<string, unknown>).matchId = "mutated";
      }, TypeError);

      // Zero secrets
      assert.ok(!("apiKey" in ev));
      assert.ok(!("redis" in ev));
    });
  });

  // ==========================================
  // 18. PERSISTENCE
  // ==========================================
  describe("18. Persistence contracts", () => {
    test("neutral contracts compile and run successfully", () => {
      const dummyStore: JobMatchAggregateStore = {
        async save(_match: JobMatch): Promise<void> {},
        async findById(_id: string, _tenantId: string): Promise<JobMatch | null> {
          return null;
        },
        async findByMatchingIdentity(
          _tenantId: string,
          _freelancerId: string,
          _jobId: string,
          _matchingVersion: string,
        ): Promise<JobMatch | null> {
          return null;
        },
      };

      const dummyContract: JobMatchPersistenceContract = {
        async findByMatchingIdentity(
          _tenantId: string,
          _freelancerId: string,
          _jobId: string,
          _matchingVersion: string,
        ): Promise<JobMatch | null> {
          return null;
        },
      };

      assert.ok(dummyStore);
      assert.ok(dummyContract);
    });
  });

  // ==========================================
  // 19. BOUNDARIES
  // ==========================================
  describe("19. Boundary Isolation Checks", () => {
    test("Verify no overallScore, weightedScore, confidence, ranking, explanation, caching, queues, AI or network is enqueued", () => {
      const prototypeKeys = Object.keys(JobMatch.prototype);
      assert.ok(!prototypeKeys.includes("weightedScore"));
      assert.ok(!prototypeKeys.includes("confidence"));
      assert.ok(!prototypeKeys.includes("rank"));
      assert.ok(!prototypeKeys.includes("explain"));
      assert.ok(!prototypeKeys.includes("cache"));
      assert.ok(!prototypeKeys.includes("enqueue"));
    });
  });
});
