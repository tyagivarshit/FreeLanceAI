/* eslint-disable @typescript-eslint/no-explicit-any */
import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import { db } from "../client.js";
import { clientTimelines, timelineEntries } from "../schema/timeline.js";
import { PostgresTimelineRepository } from "./timeline-repository.js";
import { ClientTimeline, AuthorizedSearchScope, SearchQuery } from "@freelanceos/core";

const originalSelect = db.select;
const originalInsert = db.insert;
const originalTransaction = db.transaction;

describe("PostgresTimelineRepository Unit Tests", () => {
  let selectMockResult: any[] = [];
  let insertedTimelines: any[] = [];
  let insertedEntries: any[] = [];

  beforeEach(() => {
    selectMockResult = [];
    insertedTimelines = [];
    insertedEntries = [];

    // Mock db.transaction boundary
    db.transaction = async function (callback: any) {
      const mockTx = {
        insert: (table: any) => ({
          values: (val: any) => {
            if (table === clientTimelines) {
              insertedTimelines.push({ table, val });
            } else if (table === timelineEntries) {
              if (Array.isArray(val)) {
                insertedEntries.push(...val.map((item) => ({ table, val: item })));
              } else {
                insertedEntries.push({ table, val });
              }
            }
            return {
              onConflictDoUpdate: () => Promise.resolve([{ id: val.id }]),
              onConflictDoNothing: () => Promise.resolve([{ id: val.id }]),
            };
          },
        }),
      };
      return await callback(mockTx);
    };

    // Mock db.select chain for joins and queries
    // @ts-expect-error db.select is read-only
    db.select = function (fields?: any) {
      const isCount = Boolean(fields && typeof fields === "object" && "count" in fields);
      let hasInnerJoin = false;
      let targetTable: any = null;
      const builder = {
        from: (table: any) => {
          targetTable = table;
          return builder;
        },
        innerJoin: () => {
          hasInnerJoin = true;
          return builder;
        },
        where: () => builder,
        orderBy: () => builder,
        limit: (_limitVal: number) => builder,
        offset: (_offsetVal: number) => builder,
        then: (onfulfilled: any) => {
          if (isCount) {
            return Promise.resolve([{ count: selectMockResult.length }]).then(onfulfilled);
          }
          if (hasInnerJoin) {
            return Promise.resolve(selectMockResult).then(onfulfilled);
          }
          if (targetTable === timelineEntries) {
            const defaultEntries = [
              {
                id: "1b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
                timelineId: "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
                category: "Lifecycle Event",
                timestamp: new Date("2026-08-14T00:00:00.000Z"),
                metadata: { desc: "Loaded from Database" },
                actorRef: "actor_123",
                visibility: "Public",
              },
            ];
            return Promise.resolve(defaultEntries).then(onfulfilled);
          }
          return Promise.resolve(selectMockResult).then(onfulfilled);
        },
      };
      return builder;
    };
  });

  afterEach(() => {
    db.select = originalSelect;
    db.insert = originalInsert;
    db.transaction = originalTransaction;
  });

  test("1. Saves client timeline and its entries correctly inside a transaction", async () => {
    const repo = new PostgresTimelineRepository();
    const timeline = ClientTimeline.create(
      "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
      "8b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6e",
      "8b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6f",
    );

    timeline.appendEntry("8b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6f", "actor_123", {
      entryId: "1b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
      category: "Lifecycle Event",
      timestamp: new Date("2026-08-14T00:00:00.000Z"),
      metadata: { desc: "Created client account" },
      visibility: "Public",
    });

    await repo.save(timeline);

    assert.strictEqual(insertedTimelines.length, 1);
    assert.strictEqual(insertedTimelines[0].val.id, "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d");
    assert.strictEqual(insertedTimelines[0].val.clientId, "8b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6e");
    assert.strictEqual(insertedTimelines[0].val.ownerId, "8b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6f");
    assert.strictEqual(insertedTimelines[0].val.status, "Active");

    assert.strictEqual(insertedEntries.length, 1);
    assert.strictEqual(insertedEntries[0].val.id, "1b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d");
    assert.strictEqual(insertedEntries[0].val.timelineId, "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d");
    assert.strictEqual(insertedEntries[0].val.category, "Lifecycle Event");
    assert.strictEqual(insertedEntries[0].val.metadata.desc, "Created client account");
  });

  test("2. Retrieves ClientTimeline correctly with chronological entries", async () => {
    const repo = new PostgresTimelineRepository();
    selectMockResult = [
      {
        id: "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
        clientId: "8b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6e",
        ownerId: "8b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6f",
        status: "Active",
        createdAt: new Date("2026-08-14T00:00:00.000Z"),
        updatedAt: new Date("2026-08-14T00:00:00.000Z"),
      },
    ];

    const result = await repo.findById(
      "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
      "8b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6f",
    );

    assert.ok(result);
    assert.strictEqual(result.timelineId, "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d");
    assert.strictEqual(result.entries.length, 1);
    assert.strictEqual(result.entries[0]!.entryId, "1b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d");
    assert.strictEqual(result.entries[0]!.metadata.desc, "Loaded from Database");
  });

  test("3. searchTimeline performs scoped query and returns bounded result list", async () => {
    const repo = new PostgresTimelineRepository();
    selectMockResult = [
      {
        id: "1b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
        timelineId: "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
        clientId: "8b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6e",
        category: "Communication Event",
        timestamp: new Date("2026-08-14T00:00:00.000Z"),
        eventRef: "meeting-1",
        actorRef: "actor_123",
        visibility: "Public",
        metadata: { note: "Quarterly review meeting" },
        createdAt: new Date("2026-08-14T00:00:00.000Z"),
      },
    ];

    const scope = new AuthorizedSearchScope({
      tenantId: "8b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6e",
      ownerId: "8b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6f",
    });

    const res = await repo.searchTimeline("Communication", scope, 1, 10);
    assert.strictEqual(res.items.length, 1);
    assert.strictEqual(res.items[0]?.category, "Communication Event");
    assert.strictEqual(res.items[0]?.eventRef, "meeting-1");
    assert.strictEqual(res.page, 1);
    assert.strictEqual(res.pageSize, 10);
  });

  test("4. search provider executes query and maps to canonical SearchResultSet", async () => {
    const repo = new PostgresTimelineRepository();
    selectMockResult = [
      {
        id: "1b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
        timelineId: "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
        clientId: "8b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6e",
        category: "Communication Event",
        timestamp: new Date("2026-08-14T00:00:00.000Z"),
        eventRef: "meeting-1",
        actorRef: "actor_123",
        visibility: "Public",
        metadata: { note: "Quarterly review meeting" },
        createdAt: new Date("2026-08-14T00:00:00.000Z"),
      },
    ];

    const scope = new AuthorizedSearchScope({
      tenantId: "8b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6e",
      ownerId: "8b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6f",
    });
    const query = new SearchQuery({ query: "Communication" });

    const resultSet = await repo.search(query, scope);
    assert.strictEqual(resultSet.count, 1);
    assert.strictEqual(resultSet.results[0]?.resultType, "TIMELINE");
    assert.strictEqual(resultSet.results[0]?.entityId, "1b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d");
    assert.match(resultSet.results[0]?.display.title ?? "", /Communication Event/);
  });
});
