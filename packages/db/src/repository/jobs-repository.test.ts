/* eslint-disable @typescript-eslint/no-explicit-any */
import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import { db } from "../client.js";
import { jobImports } from "../schema/jobs.js";
import { PostgresJobsRepository } from "./jobs-repository.js";
import {
  JobImport,
  JobSource,
  JobExternalIdentity,
  JobImportProvenance,
  JobRawPayload,
  JobImportFingerprint,
  AuthorizedSearchScope,
  SearchQuery,
} from "@freelanceos/core";

const originalSelect = db.select;
const originalInsert = db.insert;

describe("PostgresJobsRepository Unit Tests", () => {
  let selectMockResult: any[] = [];
  let insertedValues: any[] = [];

  beforeEach(() => {
    selectMockResult = [];
    insertedValues = [];

    // Mock db.select chain
    // @ts-expect-error db.select is read-only
    db.select = function () {
      const builder = {
        from: () => builder,
        where: () => builder,
        orderBy: () => builder,
        limit: () => {
          const promise = Promise.resolve(selectMockResult);
          // Chain offset for paginated queries
          // @ts-expect-error adding offset chain helper to Promise
          promise.offset = () => Promise.resolve(selectMockResult);
          return promise;
        },
      };
      return builder;
    };

    // Mock db.insert chain
    // @ts-expect-error db.insert is read-only
    db.insert = function (table: any) {
      return {
        values: (val: any) => {
          insertedValues.push({ table, val });
          return {
            onConflictDoUpdate: () => Promise.resolve([{ id: val.id }]),
          };
        },
      };
    };
  });

  afterEach(() => {
    db.select = originalSelect;
    db.insert = originalInsert;
  });

  test("1. Saves and serializes JobImport aggregate correctly", async () => {
    const repo = new PostgresJobsRepository();
    const source = new JobSource("upwork");
    const externalIdentity = new JobExternalIdentity(source, "job_123");
    const provenance = new JobImportProvenance({
      source,
      externalJobId: "job_123",
      sourceUrl: "https://upwork.com/jobs/123",
      importedAt: new Date("2026-08-14T00:00:00.000Z"),
    });
    const rawPayload = new JobRawPayload({ title: "Developer Required" });
    const fingerprint = new JobImportFingerprint("fingerprint_abc");

    const job = new JobImport({
      id: "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
      tenantId: "8b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
      ownerId: "8b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
      externalIdentity,
      provenance,
      rawPayload,
      fingerprint,
      status: "RECEIVED",
      snapshots: [],
      createdAt: new Date("2026-08-14T00:00:00.000Z"),
      updatedAt: new Date("2026-08-14T00:00:00.000Z"),
    });

    await repo.save(job);

    assert.strictEqual(insertedValues.length, 1);
    assert.strictEqual(insertedValues[0].table, jobImports);
    assert.strictEqual(insertedValues[0].val.id, "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d");
    assert.strictEqual(insertedValues[0].val.tenantId, "8b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d");
    assert.strictEqual(insertedValues[0].val.source, "upwork");
    assert.strictEqual(insertedValues[0].val.externalJobId, "job_123");
    assert.strictEqual(insertedValues[0].val.fingerprint, "fingerprint_abc");
  });

  test("2. Retrieves and maps JobImport aggregate correctly in findById", async () => {
    const repo = new PostgresJobsRepository();
    selectMockResult = [
      {
        id: "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
        tenantId: "8b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
        ownerId: "8b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
        source: "linkedin",
        externalJobId: "job_999",
        sourceUrl: "https://linkedin.com/jobs/999",
        importedAt: new Date("2026-08-14T00:00:00.000Z"),
        rawPayload: { title: "Lead Architect" },
        fingerprint: "fingerprint_xyz",
        status: "IMPORTED",
        snapshots: [],
        createdAt: new Date("2026-08-14T00:00:00.000Z"),
        updatedAt: new Date("2026-08-14T00:00:00.000Z"),
      },
    ];

    const result = await repo.findById(
      "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
      "8b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
    );

    assert.ok(result);
    assert.strictEqual(result.id, "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d");
    assert.strictEqual(result.tenantId, "8b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d");
    assert.strictEqual(result.externalIdentity.source.value, "linkedin");
    assert.strictEqual(result.externalIdentity.externalJobId, "job_999");
    assert.strictEqual(result.status, "IMPORTED");
  });

  test("3. Enforces tenant scope filter on findByTenant", async () => {
    const repo = new PostgresJobsRepository();
    let queryConditions: any = null;

    // @ts-expect-error select is read-only
    db.select = function () {
      const builder = {
        from: () => builder,
        where: (cond: any) => {
          queryConditions = cond;
          return builder;
        },
        orderBy: () => builder,
        limit: () => {
          const promise = Promise.resolve([]);
          // @ts-expect-error adding offset chain helper to Promise
          promise.offset = () => Promise.resolve([]);
          return promise;
        },
      };
      return builder;
    };

    await repo.findByTenant("8b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d", {
      page: 1,
      pageSize: 20,
    });

    assert.ok(queryConditions);
  });

  test("4. searchJobs performs scoped query and returns bounded result list", async () => {
    const repo = new PostgresJobsRepository();
    selectMockResult = [
      {
        id: "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
        tenantId: "8b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
        ownerId: "8b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
        source: "upwork",
        externalJobId: "upwork_555",
        sourceUrl: "https://upwork.com/jobs/555",
        importedAt: new Date("2026-08-14T00:00:00.000Z"),
        rawPayload: {
          title: "Full-Stack Engineer",
          description: "Build robust distributed backend systems.",
          skills: ["typescript", "nodejs"],
          category: "Software Development",
        },
        fingerprint: "fingerprint_123",
        status: "IMPORTED",
        snapshots: [],
        createdAt: new Date("2026-08-14T00:00:00.000Z"),
        updatedAt: new Date("2026-08-14T00:00:00.000Z"),
      },
    ];

    const scope = new AuthorizedSearchScope({
      tenantId: "8b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
      ownerId: "8b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
    });

    const res = await repo.searchJobs("Full-Stack", scope, 1, 10);
    assert.strictEqual(res.items.length, 1);
    assert.strictEqual(res.items[0]?.title, "Full-Stack Engineer");
    assert.strictEqual(res.items[0]?.source, "upwork");
    assert.strictEqual(res.page, 1);
    assert.strictEqual(res.pageSize, 10);
  });

  test("5. search provider executes query and maps to canonical SearchResultSet", async () => {
    const repo = new PostgresJobsRepository();
    selectMockResult = [
      {
        id: "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
        tenantId: "8b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
        ownerId: "8b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
        source: "upwork",
        externalJobId: "upwork_555",
        sourceUrl: "https://upwork.com/jobs/555",
        importedAt: new Date("2026-08-14T00:00:00.000Z"),
        rawPayload: {
          title: "Full-Stack Engineer",
          description: "Build robust distributed backend systems.",
          skills: ["typescript", "nodejs"],
          category: "Software Development",
        },
        fingerprint: "fingerprint_123",
        status: "IMPORTED",
        snapshots: [],
        createdAt: new Date("2026-08-14T00:00:00.000Z"),
        updatedAt: new Date("2026-08-14T00:00:00.000Z"),
      },
    ];

    const scope = new AuthorizedSearchScope({
      tenantId: "8b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
      ownerId: "8b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
    });
    const query = new SearchQuery({ query: "Full-Stack" });

    const resultSet = await repo.search(query, scope);
    assert.strictEqual(resultSet.count, 1);
    assert.strictEqual(resultSet.results[0]?.resultType, "JOB");
    assert.strictEqual(resultSet.results[0]?.entityId, "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d");
    assert.strictEqual(resultSet.results[0]?.display.title, "Full-Stack Engineer");
    assert.strictEqual(resultSet.results[0]?.display.subtitle, "Upwork • IMPORTED");
  });
});
