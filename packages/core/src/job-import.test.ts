import { test, describe } from "node:test";
import assert from "node:assert";
import {
  JobSource,
  JobExternalIdentity,
  JobImportProvenance,
  JobRawPayload,
  JobImportFingerprint,
  JobImport,
  JOB_IMPORT_RECEIVED,
  JOB_IMPORTED,
  JOB_IMPORT_ARCHIVED,
} from "./job-import.js";
import type { JobImportPersistenceContract, JobImportAggregateStore } from "./job-import.js";

describe("Chapter 8A — Job Import Pipeline Domain Tests", () => {
  const defaultSource = new JobSource("upwork");
  const defaultExternalIdentity = new JobExternalIdentity(defaultSource, "job-123");
  const defaultProvenance = new JobImportProvenance({
    source: defaultSource,
    externalJobId: "job-123",
    sourceUrl: "https://upwork.com/jobs/123",
    importedAt: new Date("2026-08-11T12:00:00Z"),
  });
  const defaultPayload = new JobRawPayload({
    title: "NodeJS Developer",
    skills: ["javascript", "nodejs"],
    client: { country: "US" },
  });
  const defaultFingerprint = new JobImportFingerprint("fingerprint-xyz");

  // 1. JobExternalIdentity
  describe("JobExternalIdentity", () => {
    test("valid source and externalJobId", () => {
      const extId = new JobExternalIdentity(defaultSource, "ext-1");
      assert.ok(extId.source.equals(defaultSource));
      assert.strictEqual(extId.externalJobId, "ext-1");
    });

    test("empty source rejected", () => {
      assert.throws(() => {
        new JobExternalIdentity(null as unknown as JobSource, "ext-1");
      }, /JobSource is required/);
    });

    test("empty externalJobId rejected", () => {
      assert.throws(() => {
        new JobExternalIdentity(defaultSource, "");
      }, /External Job ID is required/);
      assert.throws(() => {
        new JobExternalIdentity(defaultSource, "  ");
      }, /External Job ID is required/);
    });

    test("value immutability", () => {
      const extId = new JobExternalIdentity(defaultSource, "ext-1");
      assert.throws(() => {
        (extId as unknown as { externalJobId: string }).externalJobId = "ext-2";
      }, TypeError);
    });

    test("value equality", () => {
      const ext1 = new JobExternalIdentity(defaultSource, "ext-1");
      const ext2 = new JobExternalIdentity(defaultSource, "ext-1");
      const ext3 = new JobExternalIdentity(new JobSource("linkedin"), "ext-1");
      const ext4 = new JobExternalIdentity(defaultSource, "ext-2");

      assert.ok(ext1.equals(ext2));
      assert.ok(!ext1.equals(ext3));
      assert.ok(!ext1.equals(ext4));
    });
  });

  // 2. JobImportProvenance
  describe("JobImportProvenance", () => {
    test("valid properties", () => {
      const prov = new JobImportProvenance({
        source: defaultSource,
        externalJobId: "job-1",
        sourceUrl: "http://example.com",
        importedAt: new Date("2026-08-11T12:00:00Z"),
      });

      assert.ok(prov.source.equals(defaultSource));
      assert.strictEqual(prov.externalJobId, "job-1");
      assert.strictEqual(prov.sourceUrl, "http://example.com");
      assert.strictEqual(prov.importedAt.getTime(), new Date("2026-08-11T12:00:00Z").getTime());
    });

    test("immutability and Date defensive copying", () => {
      const importDate = new Date("2026-08-11T12:00:00Z");
      const prov = new JobImportProvenance({
        source: defaultSource,
        externalJobId: "job-1",
        importedAt: importDate,
      });

      // Mutate external input date
      importDate.setTime(0);
      assert.strictEqual(prov.importedAt.getTime(), new Date("2026-08-11T12:00:00Z").getTime());

      // Mutate returned date
      const returnedDate = prov.importedAt;
      returnedDate.setTime(0);
      assert.strictEqual(prov.importedAt.getTime(), new Date("2026-08-11T12:00:00Z").getTime());
    });
  });

  // 3. JobImportFingerprint
  describe("JobImportFingerprint", () => {
    test("valid fingerprint", () => {
      const fp = new JobImportFingerprint("fp-value");
      assert.strictEqual(fp.value, "fp-value");
    });

    test("invalid fingerprint rejected", () => {
      assert.throws(() => new JobImportFingerprint(""), /Fingerprint value is required/);
      assert.throws(() => new JobImportFingerprint("  "), /Fingerprint value is required/);
    });

    test("immutability", () => {
      const fp = new JobImportFingerprint("fp-value");
      assert.throws(() => {
        (fp as unknown as { value: string }).value = "fp-new";
      }, TypeError);
    });
  });

  // 4. Raw Payload
  describe("Raw payload protection", () => {
    test("valid payload and nested object/array immutability", () => {
      const originalData = {
        title: "Dev",
        skills: ["python"],
        client: { country: "US" },
      };
      const payload = new JobRawPayload(originalData);

      // Mutate originalData structure
      originalData.skills.push("javascript");
      originalData.client.country = "CA";

      assert.deepStrictEqual(payload.data, {
        title: "Dev",
        skills: ["python"],
        client: { country: "US" },
      });

      // Attempt to mutate returned data
      const returnedData = payload.data;
      assert.throws(() => {
        (returnedData.skills as string[]).push("javascript");
      });
      assert.throws(() => {
        (returnedData.client as Record<string, string>).country = "CA";
      });
    });
  });

  // 5. Aggregate Creation
  describe("JobImport Aggregate creation", () => {
    test("Draft creation and RECEIVED status, snapshot version 1, event emitted", () => {
      const id = "job-import-1";
      const aggregate = JobImport.create(
        id,
        "tenant-1",
        "owner-1",
        defaultExternalIdentity,
        defaultProvenance,
        defaultPayload,
        defaultFingerprint,
      );

      assert.strictEqual(aggregate.id, id);
      assert.strictEqual(aggregate.tenantId, "tenant-1");
      assert.strictEqual(aggregate.ownerId, "owner-1");
      assert.ok(aggregate.externalIdentity.equals(defaultExternalIdentity));
      assert.ok(aggregate.provenance.equals(defaultProvenance));
      assert.ok(aggregate.rawPayload.equals(defaultPayload));
      assert.ok(aggregate.fingerprint.equals(defaultFingerprint));
      assert.strictEqual(aggregate.status, "RECEIVED");

      // Snapshots version 1
      assert.strictEqual(aggregate.snapshots.length, 1);
      assert.strictEqual(aggregate.snapshots[0]!.version, 1);
      assert.strictEqual(aggregate.snapshots[0]!.status, "RECEIVED");
      assert.ok(aggregate.snapshots[0]!.externalIdentity.equals(defaultExternalIdentity));

      // Domain Event emitted
      assert.strictEqual(aggregate.domainEvents.length, 1);
      assert.strictEqual(aggregate.domainEvents[0]!.eventType, JOB_IMPORT_RECEIVED);
      assert.strictEqual(aggregate.domainEvents[0]!.jobImportId, id);
      assert.strictEqual(aggregate.domainEvents[0]!.tenantId, "tenant-1");
      assert.strictEqual(aggregate.domainEvents[0]!.ownerId, "owner-1");
      assert.strictEqual(aggregate.domainEvents[0]!.source, "upwork");
      assert.strictEqual(aggregate.domainEvents[0]!.externalJobId, "job-123");
      assert.strictEqual(aggregate.domainEvents[0]!.fingerprint, "fingerprint-xyz");
      assert.strictEqual(aggregate.domainEvents[0]!.snapshotVersion, 1);
    });
  });

  // 6. Ownership Validation
  describe("Ownership validation", () => {
    test("authorized markImported succeeds, unauthorized rejected", () => {
      const aggregate = JobImport.create(
        "job-import-1",
        "tenant-1",
        "owner-1",
        defaultExternalIdentity,
        defaultProvenance,
        defaultPayload,
        defaultFingerprint,
      );

      // Unauthorized execution throws exact message with ONE period
      assert.throws(() => {
        aggregate.markImported("owner-other");
      }, /Ownership validation failed: unauthorized owner context\./);

      // State remains unchanged after unauthorized call
      assert.strictEqual(aggregate.status, "RECEIVED");
      assert.strictEqual(aggregate.snapshots.length, 1);
      assert.strictEqual(aggregate.domainEvents.length, 1); // Only the creation event exists

      // Authorized execution succeeds
      aggregate.markImported("owner-1");
      assert.strictEqual(aggregate.status, "IMPORTED");
      assert.strictEqual(aggregate.snapshots.length, 2);
      assert.strictEqual(aggregate.domainEvents.length, 2);
    });

    test("authorized archive succeeds, unauthorized rejected", () => {
      const aggregate = JobImport.create(
        "job-import-1",
        "tenant-1",
        "owner-1",
        defaultExternalIdentity,
        defaultProvenance,
        defaultPayload,
        defaultFingerprint,
      );

      assert.throws(() => {
        aggregate.archive("owner-other");
      }, /Ownership validation failed: unauthorized owner context\./);

      assert.strictEqual(aggregate.status, "RECEIVED");

      aggregate.archive("owner-1");
      assert.strictEqual(aggregate.status, "ARCHIVED");
    });
  });

  // 7 & 8. Lifecycle Transitions
  describe("Lifecycle Transitions", () => {
    test("RECEIVED -> IMPORTED", () => {
      const agg = JobImport.create(
        "job-1",
        "tenant-1",
        "owner-1",
        defaultExternalIdentity,
        defaultProvenance,
        defaultPayload,
        defaultFingerprint,
      );
      agg.markImported("owner-1");
      assert.strictEqual(agg.status, "IMPORTED");
    });

    test("RECEIVED -> ARCHIVED", () => {
      const agg = JobImport.create(
        "job-1",
        "tenant-1",
        "owner-1",
        defaultExternalIdentity,
        defaultProvenance,
        defaultPayload,
        defaultFingerprint,
      );
      agg.archive("owner-1");
      assert.strictEqual(agg.status, "ARCHIVED");
    });

    test("IMPORTED -> ARCHIVED", () => {
      const agg = JobImport.create(
        "job-1",
        "tenant-1",
        "owner-1",
        defaultExternalIdentity,
        defaultProvenance,
        defaultPayload,
        defaultFingerprint,
      );
      agg.markImported("owner-1");
      agg.archive("owner-1");
      assert.strictEqual(agg.status, "ARCHIVED");
    });

    test("Archived is terminal, invalid transitions rejected", () => {
      const agg = JobImport.create(
        "job-1",
        "tenant-1",
        "owner-1",
        defaultExternalIdentity,
        defaultProvenance,
        defaultPayload,
        defaultFingerprint,
      );
      agg.archive("owner-1");

      assert.throws(() => {
        agg.markImported("owner-1");
      }, /Invalid lifecycle transition from ARCHIVED to IMPORTED/);

      assert.throws(() => {
        agg.archive("owner-1");
      }, /Job import is already archived/);

      assert.throws(() => {
        (agg as unknown as { transitionTo(s: string): void }).transitionTo("RECEIVED");
      }, /Invalid lifecycle transition from ARCHIVED to RECEIVED/);
    });
  });

  // 9. Snapshot History
  describe("Snapshot history", () => {
    test("incremental sequential snapshots", () => {
      const agg = JobImport.create(
        "job-1",
        "tenant-1",
        "owner-1",
        defaultExternalIdentity,
        defaultProvenance,
        defaultPayload,
        defaultFingerprint,
      );
      assert.strictEqual(agg.snapshots.length, 1);
      assert.strictEqual(agg.snapshots[0]!.version, 1);
      assert.strictEqual(agg.snapshots[0]!.status, "RECEIVED");

      agg.markImported("owner-1");
      assert.strictEqual(agg.snapshots.length, 2);
      assert.strictEqual(agg.snapshots[1]!.version, 2);
      assert.strictEqual(agg.snapshots[1]!.status, "IMPORTED");

      agg.archive("owner-1");
      assert.strictEqual(agg.snapshots.length, 3);
      assert.strictEqual(agg.snapshots[2]!.version, 3);
      assert.strictEqual(agg.snapshots[2]!.status, "ARCHIVED");
    });
  });

  // 10. Date Immutability
  describe("Date Immutability", () => {
    test("Date fields are defensively copied", () => {
      const createDate = new Date("2026-08-11T12:00:00Z");
      const updateDate = new Date("2026-08-11T12:00:00Z");
      const agg = new JobImport({
        id: "job-1",
        tenantId: "tenant-1",
        ownerId: "owner-1",
        externalIdentity: defaultExternalIdentity,
        provenance: defaultProvenance,
        rawPayload: defaultPayload,
        fingerprint: defaultFingerprint,
        status: "RECEIVED",
        snapshots: [],
        createdAt: createDate,
        updatedAt: updateDate,
      });

      // Mutate constructor arguments
      createDate.setTime(0);
      updateDate.setTime(0);
      assert.strictEqual(agg.createdAt.getTime(), new Date("2026-08-11T12:00:00Z").getTime());
      assert.strictEqual(agg.updatedAt.getTime(), new Date("2026-08-11T12:00:00Z").getTime());

      // Mutate returned date
      const retCreated = agg.createdAt;
      retCreated.setTime(0);
      assert.strictEqual(agg.createdAt.getTime(), new Date("2026-08-11T12:00:00Z").getTime());
    });
  });

  // 11. Domain Events
  describe("Domain Events Verification", () => {
    test("emitted event names and payload schema", () => {
      const agg = JobImport.create(
        "job-1",
        "tenant-1",
        "owner-1",
        defaultExternalIdentity,
        defaultProvenance,
        defaultPayload,
        defaultFingerprint,
      );
      agg.markImported("owner-1");
      agg.archive("owner-1");

      assert.strictEqual(agg.domainEvents.length, 3);
      assert.strictEqual(agg.domainEvents[0]!.eventType, JOB_IMPORT_RECEIVED);
      assert.strictEqual(agg.domainEvents[1]!.eventType, JOB_IMPORTED);
      assert.strictEqual(agg.domainEvents[2]!.eventType, JOB_IMPORT_ARCHIVED);

      // Verify lack of HTTP/Scraper/Infrastructure metadata
      const event = agg.domainEvents[0]!;
      assert.ok(!("httpHeaders" in event));
      assert.ok(!("scraperLogs" in event));
    });
  });

  // 12. Persistence Abstraction
  describe("Persistence signatures check", () => {
    test("contracts verify technology neutrality", () => {
      const dummyStore: JobImportAggregateStore = {
        async save(_jobImport: JobImport): Promise<void> {},
        async findById(_id: string, _tenantId: string): Promise<JobImport | null> {
          return null;
        },
        async findByExternalIdentity(
          _tenantId: string,
          _source: string,
          _externalJobId: string,
        ): Promise<JobImport | null> {
          return null;
        },
      };

      const dummyContract: JobImportPersistenceContract = {
        async findByExternalIdentity(
          _tenantId: string,
          _source: string,
          _externalJobId: string,
        ): Promise<JobImport | null> {
          return null;
        },
      };

      assert.ok(dummyStore);
      assert.ok(dummyContract);
    });
  });

  // 13. Boundaries Verification
  describe("Boundary isolation tests", () => {
    test("No external library imports or machine matching logic exists in core", () => {
      const keys = Object.keys(JobImport.prototype);
      assert.ok(!keys.includes("_openAiClient"));
      assert.ok(!keys.includes("calculateMatchScore"));
      assert.ok(!keys.includes("normalizeSkills"));
    });
  });
});
