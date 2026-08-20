/* eslint-disable @typescript-eslint/no-explicit-any */
import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import { db } from "../client.js";
import { jobMatches } from "../schema/matches.js";
import { PostgresJobMatchRepository } from "./match-repository.js";
import { JobMatch, MatchSignals, AuthorizedSearchScope, SearchQuery } from "@freelanceos/core";

const originalSelect = db.select;
const originalInsert = db.insert;

describe("PostgresJobMatchRepository Unit Tests", () => {
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
          // @ts-expect-error offset chain helper
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

  test("1. Saves and serializes JobMatch aggregate correctly", async () => {
    const repo = new PostgresJobMatchRepository();
    const signals: MatchSignals = {
      semanticSimilarity: 0.88,
      matchedSkills: ["Node.js"],
      missingSkills: ["Python"],
      skillCoverage: 0.5,
      experienceCompatibility: "COMPATIBLE",
      budgetCompatibility: "PARTIAL",
      jobTypeCompatibility: "COMPATIBLE",
      locationCompatibility: "COMPATIBLE",
    };

    const match = new JobMatch({
      id: "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
      tenantId: "8b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
      ownerId: "8b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
      freelancerId: "8b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
      jobId: "7b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
      jobNormalizationId: "norm_id_123",
      normalizationVersion: "v1",
      matchingVersion: "v1",
      matchSignals: signals,
      status: "EVALUATED",
      snapshots: [],
      createdAt: new Date("2026-08-14T00:00:00.000Z"),
      updatedAt: new Date("2026-08-14T00:00:00.000Z"),
    });

    await repo.save(match);

    assert.strictEqual(insertedValues.length, 1);
    assert.strictEqual(insertedValues[0].table, jobMatches);
    assert.strictEqual(insertedValues[0].val.id, "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d");
    assert.strictEqual(insertedValues[0].val.jobId, "7b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d");
    assert.strictEqual(insertedValues[0].val.normalizationVersion, "v1");
    assert.strictEqual(insertedValues[0].val.matchingVersion, "v1");
    assert.strictEqual(insertedValues[0].val.matchSignals.semanticSimilarity, 0.88);
    assert.strictEqual(insertedValues[0].val.status, "EVALUATED");
  });

  test("2. Retrieves and maps JobMatch aggregate correctly in findById", async () => {
    const repo = new PostgresJobMatchRepository();
    selectMockResult = [
      {
        id: "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
        tenantId: "8b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
        ownerId: "8b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
        freelancerId: "8b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
        jobId: "7b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
        jobNormalizationId: "norm_id_123",
        normalizationVersion: "v1",
        jobEmbeddingId: "emb_id",
        embeddingVersion: "v1",
        matchingVersion: "v1",
        matchSignals: {
          semanticSimilarity: 0.95,
          matchedSkills: ["React"],
          missingSkills: [],
          skillCoverage: 1.0,
          experienceCompatibility: "COMPATIBLE",
          budgetCompatibility: "COMPATIBLE",
          jobTypeCompatibility: "COMPATIBLE",
          locationCompatibility: "COMPATIBLE",
        },
        status: "EVALUATED",
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
    assert.strictEqual(result.jobId, "7b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d");
    assert.strictEqual(result.matchSignals?.semanticSimilarity, 0.95);
    assert.strictEqual(result.status, "EVALUATED");
  });

  test("3. searchMatches performs scoped query and returns bounded result list", async () => {
    const repo = new PostgresJobMatchRepository();
    selectMockResult = [
      {
        id: "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
        tenantId: "8b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
        ownerId: "8b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
        freelancerId: "8b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
        jobId: "7b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
        jobNormalizationId: "norm_id_123",
        normalizationVersion: "v1",
        matchingVersion: "v1",
        matchSignals: {
          matchedSkills: ["React", "TypeScript"],
          missingSkills: [],
          skillCoverage: 1.0,
          experienceCompatibility: "COMPATIBLE",
        },
        status: "EVALUATED",
        snapshots: [],
        createdAt: new Date("2026-08-14T00:00:00.000Z"),
        updatedAt: new Date("2026-08-14T00:00:00.000Z"),
      },
    ];

    const scope = new AuthorizedSearchScope({
      tenantId: "8b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
      ownerId: "8b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
    });

    const res = await repo.searchMatches("React", scope, 1, 10);
    assert.strictEqual(res.items.length, 1);
    assert.strictEqual(res.items[0]?.status, "EVALUATED");
    assert.strictEqual(res.items[0]?.matchingVersion, "v1");
    assert.strictEqual(res.page, 1);
    assert.strictEqual(res.pageSize, 10);
  });

  test("4. search provider executes query and maps to canonical SearchResultSet", async () => {
    const repo = new PostgresJobMatchRepository();
    selectMockResult = [
      {
        id: "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
        tenantId: "8b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
        ownerId: "8b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
        freelancerId: "8b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
        jobId: "7b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
        jobNormalizationId: "norm_id_123",
        normalizationVersion: "v1",
        matchingVersion: "v1",
        matchSignals: {
          matchedSkills: ["React", "TypeScript"],
          missingSkills: [],
          skillCoverage: 1.0,
        },
        status: "EVALUATED",
        snapshots: [],
        createdAt: new Date("2026-08-14T00:00:00.000Z"),
        updatedAt: new Date("2026-08-14T00:00:00.000Z"),
      },
    ];

    const scope = new AuthorizedSearchScope({
      tenantId: "8b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
      ownerId: "8b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
    });
    const query = new SearchQuery({ query: "EVALUATED" });

    const resultSet = await repo.search(query, scope);
    assert.strictEqual(resultSet.count, 1);
    assert.strictEqual(resultSet.results[0]?.resultType, "MATCH");
    assert.strictEqual(resultSet.results[0]?.entityId, "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d");
    assert.match(resultSet.results[0]?.display.title ?? "", /Match for Job/);
  });
});
