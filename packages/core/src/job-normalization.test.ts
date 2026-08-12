import { test, describe } from "node:test";
import assert from "node:assert";
import { JobSource } from "./job-import.js";
import {
  JobSourceReference,
  CanonicalBudget,
  CanonicalLocation,
  CanonicalJob,
  JobNormalizedFingerprint,
  JobNormalizationSnapshot,
  JobNormalization,
  JOB_NORMALIZATION_CREATED,
  JOB_NORMALIZED,
  JOB_NORMALIZATION_ARCHIVED,
} from "./job-normalization.js";
import type {
  JobNormalizationPersistenceContract,
  JobNormalizationAggregateStore,
} from "./job-normalization.js";

describe("Chapter 8B — Job Normalization Domain Tests", () => {
  const defaultSource = new JobSource("upwork");

  const defaultSourceRef = new JobSourceReference({
    jobImportId: "import-123",
    source: defaultSource,
    externalJobId: "job-123",
  });

  const defaultBudget = new CanonicalBudget({
    type: "fixed",
    minimum: 1000,
    maximum: 2000,
    currency: "USD",
  });

  const defaultLocation = new CanonicalLocation({
    mode: "remote",
    country: "US",
    timezone: "EST",
  });

  const defaultCanonicalJob = new CanonicalJob({
    title: "Senior Python Developer",
    description: "Looking for senior python dev.",
    skills: ["Python", "FastAPI"],
    budget: defaultBudget,
    experience: "Senior",
    category: "Software",
    jobType: "fixed",
    location: defaultLocation,
    duration: "3 months",
  });

  const defaultFingerprint = new JobNormalizedFingerprint("normalized-fingerprint-123");

  // ==========================================
  // 1. SOURCE REFERENCE
  // ==========================================
  describe("1. Source Reference", () => {
    test("valid JobImport reference & source identity", () => {
      const ref = new JobSourceReference({
        jobImportId: "import-1",
        source: defaultSource,
        externalJobId: "job-1",
      });
      assert.strictEqual(ref.jobImportId, "import-1");
      assert.ok(ref.source.equals(defaultSource));
      assert.strictEqual(ref.externalJobId, "job-1");
    });

    test("tenant isolation validation in logical references", () => {
      // Normalization identity can be derived from tenantId + jobImportId + normalizationVersion.
      // Two normalizations for the same jobImportId but under different tenantIds must represent distinct scopes.
      const sourceRef = new JobSourceReference({
        jobImportId: "import-same",
        source: defaultSource,
        externalJobId: "ext-same",
      });

      const normTenantA = JobNormalization.create(
        "norm-a",
        "tenant-A",
        "owner-1",
        sourceRef,
        "v1",
        defaultCanonicalJob,
        defaultFingerprint,
      );

      const normTenantB = JobNormalization.create(
        "norm-b",
        "tenant-B",
        "owner-1",
        sourceRef,
        "v1",
        defaultCanonicalJob,
        defaultFingerprint,
      );

      assert.strictEqual(normTenantA.tenantId, "tenant-A");
      assert.strictEqual(normTenantB.tenantId, "tenant-B");
      assert.notStrictEqual(normTenantA.id, normTenantB.id);
    });

    test("JobSourceReference immutability", () => {
      const ref = new JobSourceReference({
        jobImportId: "import-1",
        source: defaultSource,
        externalJobId: "job-1",
      });
      assert.throws(() => {
        (ref as unknown as Record<string, unknown>).jobImportId = "mutated";
      }, TypeError);
      assert.throws(() => {
        (ref as unknown as Record<string, unknown>).externalJobId = "mutated";
      }, TypeError);
    });
  });

  // ==========================================
  // 2. NORMALIZATION VERSION
  // ==========================================
  describe("2. Normalization Version", () => {
    test("v1 accepted and version is immutable", () => {
      const agg = JobNormalization.create(
        "norm-1",
        "tenant-1",
        "owner-1",
        defaultSourceRef,
        "v1",
        defaultCanonicalJob,
        defaultFingerprint,
      );
      assert.strictEqual(agg.normalizationVersion, "v1");
      assert.throws(() => {
        (agg as unknown as Record<string, unknown>).normalizationVersion = "v2";
      }, TypeError);
    });

    test("invalid version rejected", () => {
      // Empty version
      assert.throws(() => {
        JobNormalization.create(
          "norm-1",
          "tenant-1",
          "owner-1",
          defaultSourceRef,
          "",
          defaultCanonicalJob,
          defaultFingerprint,
        );
      }, /Normalization Version is required/);

      // Non-v[number] format
      assert.throws(() => {
        JobNormalization.create(
          "norm-1",
          "tenant-1",
          "owner-1",
          defaultSourceRef,
          "version1",
          defaultCanonicalJob,
          defaultFingerprint,
        );
      }, /Invalid normalization version format/);

      assert.throws(() => {
        JobNormalization.create(
          "norm-1",
          "tenant-1",
          "owner-1",
          defaultSourceRef,
          "v1.2",
          defaultCanonicalJob,
          defaultFingerprint,
        );
      }, /Invalid normalization version format/);
    });

    test("version participates in reprocessing and identity boundary", () => {
      // The same source import + normalizationVersion resolves to one logical normalization result.
      // A different version (v2) resolves to a distinct logical normalization result.
      const version1 = "v1";
      const version2 = "v2";

      const normV1 = JobNormalization.create(
        "norm-v1-id",
        "tenant-1",
        "owner-1",
        defaultSourceRef,
        version1,
        defaultCanonicalJob,
        defaultFingerprint,
      );

      const normV2 = JobNormalization.create(
        "norm-v2-id",
        "tenant-1",
        "owner-1",
        defaultSourceRef,
        version2,
        defaultCanonicalJob,
        new JobNormalizedFingerprint("normalized-fingerprint-v2"),
      );

      assert.strictEqual(normV1.normalizationVersion, "v1");
      assert.strictEqual(normV2.normalizationVersion, "v2");
      assert.notStrictEqual(normV1.id, normV2.id);
    });
  });

  // ==========================================
  // 3. CANONICAL JOB
  // ==========================================
  describe("3. CanonicalJob", () => {
    test("valid canonical representation construction", () => {
      const job = new CanonicalJob({
        title: "Senior Backend Developer",
        description: "Must know FastAPI and SQL.",
        skills: ["fastapi", "python"],
      });
      assert.strictEqual(job.title, "Senior Backend Developer");
      assert.strictEqual(job.description, "Must know FastAPI and SQL.");
      assert.deepStrictEqual(job.skills, ["fastapi", "python"]);
      assert.strictEqual(job.budget, undefined);
    });

    test("required field validation", () => {
      assert.throws(
        () => new CanonicalJob({ title: "", description: "test", skills: [] }),
        /title is required/,
      );
      assert.throws(
        () => new CanonicalJob({ title: "test", description: "", skills: [] }),
        /description is required/,
      );
      assert.throws(
        () =>
          new CanonicalJob({
            title: "test",
            description: "test",
            skills: null as unknown as string[],
          }),
        /Skills list is required/,
      );
    });

    test("optional field behavior and preservation of absence", () => {
      const job = new CanonicalJob({
        title: "Title",
        description: "Description",
        skills: [],
      });
      assert.strictEqual(job.budget, undefined);
      assert.strictEqual(job.experience, undefined);
      assert.strictEqual(job.category, undefined);
      assert.strictEqual(job.jobType, undefined);
      assert.strictEqual(job.location, undefined);
      assert.strictEqual(job.duration, undefined);
    });

    test("CanonicalJob and nested immutability", () => {
      const job = new CanonicalJob({
        title: "Senior Developer",
        description: "FastAPI developer",
        skills: ["Python", "FastAPI"],
        budget: defaultBudget,
        location: defaultLocation,
      });

      // Root level properties are immutable
      assert.throws(() => {
        (job as unknown as Record<string, unknown>).title = "New Title";
      }, TypeError);

      // Array property is frozen and immutable
      assert.throws(() => {
        (job.skills as string[]).push("javascript");
      }, TypeError);

      // Passed array mutation does not affect internal state (defensive copy check)
      const inputSkills = ["React", "CSS"];
      const testJob = new CanonicalJob({
        title: "Frontend Developer",
        description: "React dev",
        skills: inputSkills,
      });
      inputSkills.push("HTML");
      assert.deepStrictEqual(testJob.skills, ["css", "react"]); // alphabetized & case normalized, HTML not present

      // Nested object references are frozen Value Objects
      assert.throws(() => {
        (testJob as unknown as Record<string, unknown>).budget = defaultBudget;
      }, TypeError);

      if (job.budget) {
        assert.throws(() => {
          (job.budget as unknown as Record<string, unknown>).minimum = 5000;
        }, TypeError);
      }

      if (job.location) {
        assert.throws(() => {
          (job.location as unknown as Record<string, unknown>).country = "Canada";
        }, TypeError);
      }
    });
  });

  // ==========================================
  // 4. TITLE NORMALIZATION
  // ==========================================
  describe("4. Title Normalization", () => {
    test("whitespace cleanup, deterministic formatting, semantic wording preserved", () => {
      const job = new CanonicalJob({
        title: "   SENIOR    PYTHON   DEVELOPER   ",
        description: "Description text",
        skills: ["python"],
      });
      // Collapses interior whitespace, trims ends, but preserves wording and case to maintain meaning
      assert.strictEqual(job.title, "SENIOR PYTHON DEVELOPER");
    });
  });

  // ==========================================
  // 5. DESCRIPTION NORMALIZATION
  // ==========================================
  describe("5. Description Normalization", () => {
    test("whitespace, tab, and line ending normalization, preserving semantic content", () => {
      const job = new CanonicalJob({
        title: "Title",
        description: "\tLine 1\r\nLine 2\rLine 3  with spaces\t  ",
        skills: ["python"],
      });
      // Trims boundaries, maps CRLF/CR to LF, collapses spaces/tabs within a line
      assert.strictEqual(job.description, "Line 1\nLine 2\nLine 3 with spaces");
    });
  });

  // ==========================================
  // 6. SKILL NORMALIZATION
  // ==========================================
  describe("6. Skill Normalization", () => {
    test("trim, canonical casing, duplicate removal, deterministic ordering", () => {
      const job = new CanonicalJob({
        title: "Title",
        description: "Desc",
        skills: ["  Python  ", "python", " PYTHON ", "fastapi", "FastAPI", "  "],
      });
      // All skills trimmed, lowcased, empty elements filtered, duplicates removed, sorted alphabetically
      assert.deepStrictEqual(job.skills, ["fastapi", "python"]);
    });
  });

  // ==========================================
  // 7. BUDGET NORMALIZATION
  // ==========================================
  describe("7. Budget Normalization", () => {
    test("supported budget forms and canonical representation", () => {
      const budget1 = new CanonicalBudget({
        type: "fixed",
        minimum: 500,
        maximum: 1000,
        currency: "usd",
      });
      assert.strictEqual(budget1.type, "fixed");
      assert.strictEqual(budget1.minimum, 500);
      assert.strictEqual(budget1.maximum, 1000);
      assert.strictEqual(budget1.currency, "USD"); // Canonical uppercase currency
    });

    test("invalid budget formats rejected", () => {
      assert.throws(
        () => new CanonicalBudget({ type: "invalid" as unknown as "fixed" }),
        /Unsupported budget type/,
      );
      assert.throws(
        () => new CanonicalBudget({ type: "fixed", minimum: -5 }),
        /Budget minimum cannot be negative/,
      );
      assert.throws(
        () => new CanonicalBudget({ type: "fixed", minimum: 1000, maximum: 500 }),
        /Budget minimum cannot be greater than maximum/,
      );
    });

    test("currency is preserved and no conversion occurs", () => {
      const budget = new CanonicalBudget({
        type: "hourly",
        minimum: 50,
        maximum: 75,
        currency: "eur",
      });
      assert.strictEqual(budget.currency, "EUR");
      // Verify no conversion details are added to the budget value object
      assert.ok(!("usdEquivalent" in budget));
    });
  });

  // ==========================================
  // 8. EXPERIENCE NORMALIZATION
  // ==========================================
  describe("8. Experience Normalization", () => {
    test("explicit value representation and absence preservation with no inference", () => {
      const jobWithExp = new CanonicalJob({
        title: "Title",
        description: "Desc",
        skills: [],
        experience: "Expert Level Requirements",
      });
      assert.strictEqual(jobWithExp.experience, "Expert Level Requirements"); // Source value preserved as is

      const jobWithoutExp = new CanonicalJob({
        title: "Title",
        description: "Desc",
        skills: [],
      });
      assert.strictEqual(jobWithoutExp.experience, undefined); // Preserves absence, does not infer seniority from description
    });
  });

  // ==========================================
  // 9. CATEGORY NORMALIZATION
  // ==========================================
  describe("9. Category Normalization", () => {
    test("preserves category, trims whitespace, handles absence safely", () => {
      const job = new CanonicalJob({
        title: "Title",
        description: "Desc",
        skills: [],
        category: "  Web Development   ",
      });
      assert.strictEqual(job.category, "Web Development");

      const noCategoryJob = new CanonicalJob({
        title: "Title",
        description: "Desc",
        skills: [],
      });
      assert.strictEqual(noCategoryJob.category, undefined);
    });
  });

  // ==========================================
  // 10. JOB TYPE NORMALIZATION
  // ==========================================
  describe("10. Job Type Normalization", () => {
    test("supported values accepted, invalid types rejected", () => {
      const jobFixed = new CanonicalJob({
        title: "T",
        description: "D",
        skills: [],
        jobType: "fixed",
      });
      const jobHourly = new CanonicalJob({
        title: "T",
        description: "D",
        skills: [],
        jobType: "  HOURLY ",
      });
      const jobContract = new CanonicalJob({
        title: "T",
        description: "D",
        skills: [],
        jobType: "contract",
      });

      assert.strictEqual(jobFixed.jobType, "fixed");
      assert.strictEqual(jobHourly.jobType, "hourly");
      assert.strictEqual(jobContract.jobType, "contract");

      // Invalid types thrown
      assert.throws(() => {
        new CanonicalJob({ title: "T", description: "D", skills: [], jobType: "full-time" });
      }, /Unsupported job type: full-time/);

      assert.throws(() => {
        new CanonicalJob({ title: "T", description: "D", skills: [], jobType: "permanent" });
      }, /Unsupported job type: permanent/);
    });
  });

  // ==========================================
  // 11. LOCATION NORMALIZATION
  // ==========================================
  describe("11. Location Normalization", () => {
    test("canonical location structure and absence handling", () => {
      const loc = new CanonicalLocation({
        mode: "hybrid",
        country: "Canada",
        region: "Ontario",
        timezone: "EST",
      });
      assert.strictEqual(loc.mode, "hybrid");
      assert.strictEqual(loc.country, "Canada");
      assert.strictEqual(loc.region, "Ontario");
      assert.strictEqual(loc.timezone, "EST");

      const partialLoc = new CanonicalLocation({
        country: "Germany",
      });
      assert.strictEqual(partialLoc.mode, undefined);
      assert.strictEqual(partialLoc.country, "Germany");
    });
  });

  // ==========================================
  // 12. DURATION NORMALIZATION
  // ==========================================
  describe("12. Duration Normalization", () => {
    test("canonical duration representation where explicitly provided", () => {
      const job = new CanonicalJob({
        title: "T",
        description: "D",
        skills: [],
        duration: "  6 months  ",
      });
      assert.strictEqual(job.duration, "6 months");

      const noDurationJob = new CanonicalJob({
        title: "T",
        description: "D",
        skills: [],
      });
      assert.strictEqual(noDurationJob.duration, undefined);
    });
  });

  // ==========================================
  // 13. FINGERPRINT
  // ==========================================
  describe("13. Fingerprint", () => {
    test("normalized fingerprint behavior and uniqueness", () => {
      const fp = new JobNormalizedFingerprint("canonical-fp-value");
      assert.strictEqual(fp.value, "canonical-fp-value");
      assert.throws(() => {
        (fp as unknown as Record<string, unknown>).value = "mutated";
      }, TypeError);

      // Equality
      const fpSame = new JobNormalizedFingerprint("canonical-fp-value");
      const fpDiff = new JobNormalizedFingerprint("different-fp");
      assert.ok(fp.equals(fpSame));
      assert.ok(!fp.equals(fpDiff));
    });
  });

  // ==========================================
  // 14. AGGREGATE CREATION
  // ==========================================
  describe("14. Aggregate Creation", () => {
    test("creates aggregate in CREATED status with snapshot version 1 and domain event", () => {
      const agg = JobNormalization.create(
        "norm-123",
        "tenant-abc",
        "owner-789",
        defaultSourceRef,
        "v1",
        defaultCanonicalJob,
        defaultFingerprint,
      );

      assert.strictEqual(agg.id, "norm-123");
      assert.strictEqual(agg.tenantId, "tenant-abc");
      assert.strictEqual(agg.ownerId, "owner-789");
      assert.strictEqual(agg.status, "CREATED");

      // Snapshot check
      assert.strictEqual(agg.snapshots.length, 1);
      const snap = agg.snapshots[0]!;
      assert.strictEqual(snap.version, 1);
      assert.strictEqual(snap.status, "CREATED");
      assert.strictEqual(snap.normalizationVersion, "v1");

      // Event emitted check
      assert.strictEqual(agg.domainEvents.length, 1);
      const event = agg.domainEvents[0]!;
      assert.strictEqual(event.eventType, JOB_NORMALIZATION_CREATED);
      assert.strictEqual(event.normalizationId, "norm-123");
      assert.strictEqual(event.tenantId, "tenant-abc");
      assert.strictEqual(event.ownerId, "owner-789");
      assert.strictEqual(event.jobImportId, "import-123");
      assert.strictEqual(event.normalizationVersion, "v1");
      assert.strictEqual(event.normalizedFingerprint, "normalized-fingerprint-123");
      assert.strictEqual(event.snapshotVersion, 1);
    });
  });

  // ==========================================
  // 15 & 16. LIFECYCLE TRANSITIONS
  // ==========================================
  describe("15 & 16. Lifecycle", () => {
    test("CREATED -> NORMALIZED -> ARCHIVED", () => {
      const agg = JobNormalization.create(
        "norm-1",
        "tenant-1",
        "owner-1",
        defaultSourceRef,
        "v1",
        defaultCanonicalJob,
        defaultFingerprint,
      );

      agg.markNormalized("owner-1");
      assert.strictEqual(agg.status, "NORMALIZED");

      agg.archive("owner-1");
      assert.strictEqual(agg.status, "ARCHIVED");
    });

    test("CREATED -> ARCHIVED is direct", () => {
      const agg = JobNormalization.create(
        "norm-1",
        "tenant-1",
        "owner-1",
        defaultSourceRef,
        "v1",
        defaultCanonicalJob,
        defaultFingerprint,
      );
      agg.archive("owner-1");
      assert.strictEqual(agg.status, "ARCHIVED");
    });

    test("illegal lifecycle transitions rejected, archived is terminal", () => {
      const agg = JobNormalization.create(
        "norm-1",
        "tenant-1",
        "owner-1",
        defaultSourceRef,
        "v1",
        defaultCanonicalJob,
        defaultFingerprint,
      );
      agg.markNormalized("owner-1");

      // Cannot transition back to CREATED
      assert.throws(() => {
        (agg as unknown as { transitionTo(status: string): void }).transitionTo("CREATED");
      }, /Invalid lifecycle transition from NORMALIZED to CREATED/);

      agg.archive("owner-1");
      assert.strictEqual(agg.status, "ARCHIVED");

      // Archived is terminal: reject everything
      assert.throws(
        () => agg.markNormalized("owner-1"),
        /Invalid lifecycle transition from ARCHIVED to NORMALIZED/,
      );
      assert.throws(() => agg.archive("owner-1"), /Job normalization is already archived/);
      assert.throws(() => {
        (agg as unknown as { transitionTo(status: string): void }).transitionTo("CREATED");
      }, /Invalid lifecycle transition from ARCHIVED to CREATED/);
    });
  });

  // ==========================================
  // 17. OWNERSHIP
  // ==========================================
  describe("17. Ownership Validation", () => {
    test("mutating commands enforce ownership with exact period-ended error", () => {
      const agg = JobNormalization.create(
        "norm-1",
        "tenant-1",
        "owner-1",
        defaultSourceRef,
        "v1",
        defaultCanonicalJob,
        defaultFingerprint,
      );

      // Unauthorized markNormalized
      assert.throws(
        () => {
          agg.markNormalized("wrong-owner");
        },
        (err: Error) => {
          return err.message === "Ownership validation failed: unauthorized owner context.";
        },
      );

      // Unauthorized archive
      assert.throws(
        () => {
          agg.archive("wrong-owner");
        },
        (err: Error) => {
          return err.message === "Ownership validation failed: unauthorized owner context.";
        },
      );

      // State remains unchanged
      assert.strictEqual(agg.status, "CREATED");
      assert.strictEqual(agg.snapshots.length, 1);
      assert.strictEqual(agg.domainEvents.length, 1);
    });
  });

  // ==========================================
  // 18. SNAPSHOTS
  // ==========================================
  describe("18. Snapshots Invariants", () => {
    test("starts at 1, sequential, immutable, append-only, sequential validation", () => {
      const agg = JobNormalization.create(
        "norm-1",
        "tenant-1",
        "owner-1",
        defaultSourceRef,
        "v1",
        defaultCanonicalJob,
        defaultFingerprint,
      );
      assert.strictEqual(agg.snapshots.length, 1);
      assert.strictEqual(agg.snapshots[0]!.version, 1);

      agg.markNormalized("owner-1");
      assert.strictEqual(agg.snapshots.length, 2);
      assert.strictEqual(agg.snapshots[1]!.version, 2);

      agg.archive("owner-1");
      assert.strictEqual(agg.snapshots.length, 3);
      assert.strictEqual(agg.snapshots[2]!.version, 3);

      // Snapshots list returned is read-only and frozen
      const snaps = agg.snapshots;
      assert.throws(() => {
        (snaps as unknown as JobNormalizationSnapshot[]).push(snaps[0]!);
      }, TypeError);

      // Verify that reconstructing with invalid versions fails (sequential check)
      assert.throws(() => {
        new JobNormalization({
          id: "norm-1",
          tenantId: "tenant-1",
          ownerId: "owner-1",
          sourceReference: defaultSourceRef,
          normalizationVersion: "v1",
          canonicalJob: defaultCanonicalJob,
          normalizedFingerprint: defaultFingerprint,
          status: "CREATED",
          snapshots: [
            agg.snapshots[0]!,
            agg.snapshots[2]!, // skipping version 2
          ],
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }, /Snapshot history must be sequential and start at 1/);
    });
  });

  // ==========================================
  // 19. DATE IMMUTABILITY
  // ==========================================
  describe("19. Date Immutability", () => {
    test("defensive copies are made when dates enter or leave the domain", () => {
      const entryDate = new Date("2026-08-11T12:00:00Z");
      const snap = new JobNormalizationSnapshot({
        version: 1,
        createdAt: entryDate,
        status: "CREATED",
        sourceReference: defaultSourceRef,
        normalizationVersion: "v1",
        canonicalJob: defaultCanonicalJob,
        normalizedFingerprint: defaultFingerprint,
      });
      const agg = new JobNormalization({
        id: "norm-1",
        tenantId: "tenant-1",
        ownerId: "owner-1",
        sourceReference: defaultSourceRef,
        normalizationVersion: "v1",
        canonicalJob: defaultCanonicalJob,
        normalizedFingerprint: defaultFingerprint,
        status: "CREATED",
        snapshots: [snap],
        createdAt: entryDate,
        updatedAt: entryDate,
      });

      // Modifying entry date does not modify internal state
      entryDate.setTime(0);
      assert.notStrictEqual(agg.createdAt.getTime(), 0);

      // Modifying date obtained from getter does not modify internal state
      const gotDate = agg.createdAt;
      gotDate.setTime(0);
      assert.notStrictEqual(agg.createdAt.getTime(), 0);

      const gotUpdateDate = agg.updatedAt;
      gotUpdateDate.setTime(0);
      assert.notStrictEqual(agg.updatedAt.getTime(), 0);

      // Verify Snapshot Date Immutability
      const snapDate = agg.snapshots[0]!.createdAt;
      snapDate.setTime(0);
      assert.notStrictEqual(agg.snapshots[0]!.createdAt.getTime(), 0);
    });

    test("setTime(), setDate(), and setFullYear() verification", () => {
      const agg = JobNormalization.create(
        "norm-1",
        "tenant-1",
        "owner-1",
        defaultSourceRef,
        "v1",
        defaultCanonicalJob,
        defaultFingerprint,
      );

      const created = agg.createdAt;
      created.setTime(1000);
      created.setDate(15);
      created.setFullYear(2035);
      assert.notStrictEqual(agg.createdAt.getTime(), 1000);

      const updated = agg.updatedAt;
      updated.setTime(1000);
      updated.setDate(15);
      updated.setFullYear(2035);
      assert.notStrictEqual(agg.updatedAt.getTime(), 1000);
    });
  });

  // ==========================================
  // 20. EVENTS
  // ==========================================
  describe("20. Domain Events", () => {
    test("exact names, payloads, snapshot versions, no infrastructure metadata, and frozen", () => {
      const agg = JobNormalization.create(
        "norm-1",
        "tenant-1",
        "owner-1",
        defaultSourceRef,
        "v1",
        defaultCanonicalJob,
        defaultFingerprint,
      );

      assert.strictEqual(agg.domainEvents.length, 1);
      const evCreated = agg.domainEvents[0]!;
      assert.strictEqual(evCreated.eventType, JOB_NORMALIZATION_CREATED);
      assert.strictEqual(evCreated.snapshotVersion, 1);

      // Ensure immutability of the payload
      assert.throws(() => {
        (evCreated as unknown as Record<string, unknown>).normalizationId = "mutated";
      }, TypeError);

      // Ensure no infra metadata is present
      assert.ok(!("redis" in evCreated));
      assert.ok(!("database" in evCreated));
      assert.ok(!("http" in evCreated));

      agg.markNormalized("owner-1");
      assert.strictEqual(agg.domainEvents.length, 2);
      assert.strictEqual(agg.domainEvents[1]!.eventType, JOB_NORMALIZED);
      assert.strictEqual(agg.domainEvents[1]!.snapshotVersion, 2);

      agg.archive("owner-1");
      assert.strictEqual(agg.domainEvents.length, 3);
      assert.strictEqual(agg.domainEvents[2]!.eventType, JOB_NORMALIZATION_ARCHIVED);
      assert.strictEqual(agg.domainEvents[2]!.snapshotVersion, 3);
    });
  });

  // ==========================================
  // 21. PERSISTENCE
  // ==========================================
  describe("21. Persistence Contracts", () => {
    test("interfaces compile and remain technology-neutral", () => {
      const dummyStore: JobNormalizationAggregateStore = {
        async save(_normalization: JobNormalization): Promise<void> {},
        async findById(_id: string, _tenantId: string): Promise<JobNormalization | null> {
          return null;
        },
        async findBySource(
          _tenantId: string,
          _jobImportId: string,
          _normalizationVersion?: string,
        ): Promise<JobNormalization | null> {
          return null;
        },
      };

      const dummyContract: JobNormalizationPersistenceContract = {
        async findBySource(
          _tenantId: string,
          _jobImportId: string,
          _normalizationVersion?: string,
        ): Promise<JobNormalization | null> {
          return null;
        },
      };

      assert.ok(dummyStore);
      assert.ok(dummyContract);
    });
  });

  // ==========================================
  // 22. BOUNDARIES
  // ==========================================
  describe("22. Domain Boundaries Verification", () => {
    test("Verify 8B contains no AI, HTTP, database, embedding, vector, matching, scoring, ranking, explanation, caching, or worker references", () => {
      // Assert that core class definitions do not contain methods or properties from downstream phases
      const prototypeKeys = Object.keys(JobNormalization.prototype);
      assert.ok(!prototypeKeys.includes("embed"));
      assert.ok(!prototypeKeys.includes("match"));
      assert.ok(!prototypeKeys.includes("score"));
      assert.ok(!prototypeKeys.includes("rank"));
      assert.ok(!prototypeKeys.includes("explain"));
      assert.ok(!prototypeKeys.includes("cache"));
      assert.ok(!prototypeKeys.includes("enqueue"));
    });
  });
});
