import { test, describe } from "node:test";
import assert from "node:assert";
import {
  SearchQuery,
  AuthorizedSearchScope,
  SearchDomainError,
  assertSearchJsonSafe,
  TimelineSearchEngine,
  InMemoryTimelineSearchRepository,
  mapTimelineEntryToSearchResult,
} from "./index.js";
import type {
  TimelineSearchRepository,
  TimelineSearchResultList,
  InMemoryTimelineRecord,
} from "./index.js";

describe("Phase 11D-6: Timeline Search Domain & Provider Tests", () => {
  // Test Data Fixtures
  const tenantA = "tenant-aaa-111";
  const ownerA = "owner-aaa-111";
  const tenantB = "tenant-bbb-222";
  const ownerB = "owner-bbb-222";

  const timelineRecords: InMemoryTimelineRecord[] = [
    {
      id: "entry-001",
      timelineId: "tl-001",
      clientId: "client-101",
      tenantId: tenantA,
      ownerId: ownerA,
      category: "Lifecycle Event",
      timestamp: new Date("2026-08-10T10:00:00.000Z"),
      eventRef: "onboarding-v1",
      actorRef: "agent-alpha",
      visibility: "Public",
      metadata: { note: "Initial client onboarding completed" },
      createdAt: new Date("2026-08-10T10:00:00.000Z"),
    },
    {
      id: "entry-002",
      timelineId: "tl-001",
      clientId: "client-101",
      tenantId: tenantA,
      ownerId: ownerA,
      category: "Communication Event",
      timestamp: new Date("2026-08-12T12:00:00.000Z"),
      eventRef: "meeting-kickoff",
      actorRef: "agent-beta",
      visibility: "Internal",
      metadata: { note: "Discussed project deliverables and milestones" },
      createdAt: new Date("2026-08-12T12:00:00.000Z"),
    },
    {
      id: "entry-003",
      timelineId: "tl-002",
      clientId: "client-102",
      tenantId: tenantA,
      ownerId: ownerA,
      category: "Annotation Event",
      timestamp: new Date("2026-08-14T14:00:00.000Z"),
      eventRef: "note-billing",
      actorRef: "agent-alpha",
      visibility: "Internal",
      metadata: { message: "Client requested net-30 payment terms" },
      createdAt: new Date("2026-08-14T14:00:00.000Z"),
    },
    {
      id: "entry-004",
      timelineId: "tl-002",
      clientId: "client-102",
      tenantId: tenantA,
      ownerId: ownerA,
      category: "Status Event",
      timestamp: new Date("2026-08-15T15:00:00.000Z"),
      eventRef: "status-active",
      actorRef: "system-admin",
      visibility: "Public",
      metadata: { summary: "Client account activated" },
      createdAt: new Date("2026-08-15T15:00:00.000Z"),
    },
    {
      id: "entry-005",
      timelineId: "tl-003",
      clientId: "client-103",
      tenantId: tenantA,
      ownerId: ownerA,
      category: "Audit Event",
      timestamp: new Date("2026-08-16T16:00:00.000Z"),
      eventRef: "security-audit",
      actorRef: "auditor-007",
      visibility: "Internal",
      metadata: { note: "Quarterly security compliance audit verified" },
      createdAt: new Date("2026-08-16T16:00:00.000Z"),
    },
    // Foreign tenant record
    {
      id: "entry-foreign-001",
      timelineId: "tl-foreign-001",
      clientId: "client-foreign-999",
      tenantId: tenantB,
      ownerId: ownerB,
      category: "Communication Event",
      timestamp: new Date("2026-08-16T18:00:00.000Z"),
      eventRef: "foreign-meeting",
      actorRef: "agent-foreign",
      visibility: "Public",
      metadata: { note: "Confidential foreign strategy discussion" },
      createdAt: new Date("2026-08-16T18:00:00.000Z"),
    },
  ];

  function createTestEngine(records = timelineRecords): {
    engine: TimelineSearchEngine;
    repo: InMemoryTimelineSearchRepository;
    scopeA: AuthorizedSearchScope;
    scopeB: AuthorizedSearchScope;
  } {
    const repo = new InMemoryTimelineSearchRepository(records);
    const engine = new TimelineSearchEngine(repo);
    const scopeA = new AuthorizedSearchScope({ tenantId: tenantA, ownerId: ownerA });
    const scopeB = new AuthorizedSearchScope({ tenantId: tenantB, ownerId: ownerB });
    return { engine, repo, scopeA, scopeB };
  }

  // --------------------------------------------------------------------------
  // 1. Valid Timeline Search
  // --------------------------------------------------------------------------
  test("1. valid timeline search returns canonical results with TIMELINE resultType", async () => {
    const { engine, scopeA } = createTestEngine();
    const query = new SearchQuery({ query: "Communication" });
    const res = await engine.search(query, scopeA);

    assert.strictEqual(res.count, 1);
    assert.strictEqual(res.total, 1);
    assert.strictEqual(res.page, 1);
    assert.strictEqual(res.pageSize, 20);
    assert.strictEqual(res.results[0]?.resultType, "TIMELINE");
    assert.strictEqual(res.results[0]?.entityId, "entry-002");
  });

  // --------------------------------------------------------------------------
  // 2. Empty Result
  // --------------------------------------------------------------------------
  test("2. empty result search returns safe empty SearchResultSet", async () => {
    const { engine, scopeA } = createTestEngine();
    const query = new SearchQuery({ query: "NonExistentTimelineEvent999" });
    const res = await engine.search(query, scopeA);

    assert.strictEqual(res.count, 0);
    assert.strictEqual(res.total, 0);
    assert.strictEqual(res.isEmpty, true);
    assert.deepStrictEqual(res.results, []);
  });

  // --------------------------------------------------------------------------
  // 3. Category Matching
  // --------------------------------------------------------------------------
  test("3. category matching finds events and assigns maximum score on exact match", async () => {
    const { engine, scopeA } = createTestEngine();
    const query = new SearchQuery({ query: "Audit Event" });
    const res = await engine.search(query, scopeA);

    assert.strictEqual(res.count, 1);
    assert.strictEqual(res.results[0]?.entityId, "entry-005");
    assert.strictEqual(res.results[0]?.relevance?.score, 1.0);
    assert(res.results[0]?.relevance?.matchedFields?.includes("category"));
  });

  // --------------------------------------------------------------------------
  // 4. eventRef Matching
  // --------------------------------------------------------------------------
  test("4. eventRef matching finds timeline entry by business event reference", async () => {
    const { engine, scopeA } = createTestEngine();
    const query = new SearchQuery({ query: "meeting-kickoff" });
    const res = await engine.search(query, scopeA);

    assert.strictEqual(res.count, 1);
    assert.strictEqual(res.results[0]?.entityId, "entry-002");
    assert.strictEqual(res.results[0]?.relevance?.score, 1.0);
    assert(res.results[0]?.relevance?.matchedFields?.includes("eventRef"));
  });

  // --------------------------------------------------------------------------
  // 5. actorRef Matching
  // --------------------------------------------------------------------------
  test("5. actorRef matching finds all entries generated by a specific actor", async () => {
    const { engine, scopeA } = createTestEngine();
    const query = new SearchQuery({ query: "agent-alpha" });
    const res = await engine.search(query, scopeA);

    assert.strictEqual(res.count, 2);
    assert.deepStrictEqual(
      res.results.map((r) => r.entityId),
      ["entry-003", "entry-001"],
    );
  });

  // --------------------------------------------------------------------------
  // 6. Visibility Matching
  // --------------------------------------------------------------------------
  test("6. visibility matching filters entries by visibility classification", async () => {
    const { engine, scopeA } = createTestEngine();
    const query = new SearchQuery({ query: "Public" });
    const res = await engine.search(query, scopeA);

    assert.strictEqual(res.count, 2);
    assert.deepStrictEqual(
      res.results.map((r) => r.entityId),
      ["entry-004", "entry-001"],
    );
  });

  // --------------------------------------------------------------------------
  // 7. Metadata Text Matching
  // --------------------------------------------------------------------------
  test("7. metadata text matching discovers entries based on note text", async () => {
    const { engine, scopeA } = createTestEngine();
    const query = new SearchQuery({ query: "deliverables" });
    const res = await engine.search(query, scopeA);

    assert.strictEqual(res.count, 1);
    assert.strictEqual(res.results[0]?.entityId, "entry-002");
    assert(res.results[0]?.display.snippet?.includes("deliverables"));
  });

  // --------------------------------------------------------------------------
  // 8. Pagination
  // --------------------------------------------------------------------------
  test("8. pagination slices results correctly across pages", async () => {
    const { engine, scopeA } = createTestEngine();
    const page1Query = new SearchQuery({ query: "agent", page: 1, pageSize: 2 });
    const page2Query = new SearchQuery({ query: "agent", page: 2, pageSize: 2 });

    const res1 = await engine.search(page1Query, scopeA);
    const res2 = await engine.search(page2Query, scopeA);

    assert.strictEqual(res1.total, 3);
    assert.strictEqual(res1.page, 1);
    assert.strictEqual(res1.pageSize, 2);
    assert.strictEqual(res1.count, 2);
    assert.strictEqual(res1.totalPages, 2);

    assert.strictEqual(res2.total, 3);
    assert.strictEqual(res2.page, 2);
    assert.strictEqual(res2.count, 1);
  });

  // --------------------------------------------------------------------------
  // 9. Maximum pageSize = 100
  // --------------------------------------------------------------------------
  test("9. maximum pageSize = 100 enforced", () => {
    const query = new SearchQuery({ query: "event", pageSize: 100 });
    assert.strictEqual(query.pageSize, 100);

    assert.throws(
      () => new SearchQuery({ query: "event", pageSize: 101 }),
      (err: unknown) => {
        assert(err instanceof SearchDomainError);
        assert.strictEqual(err.code, "INVALID_PAGINATION");
        return true;
      },
    );
  });

  // --------------------------------------------------------------------------
  // 10. Deterministic Ordering
  // --------------------------------------------------------------------------
  test("10. deterministic ordering sorts strictly by timestamp DESC, then id DESC", async () => {
    const { engine, scopeA } = createTestEngine();
    const query = new SearchQuery({ query: "Event" });
    const res1 = await engine.search(query, scopeA);
    const res2 = await engine.search(query, scopeA);

    assert.deepStrictEqual(
      res1.results.map((r) => r.entityId),
      res2.results.map((r) => r.entityId),
    );
    // entry-005 (Aug 16) before entry-004 (Aug 15) before entry-003 (Aug 14) before entry-002 (Aug 12) before entry-001 (Aug 10)
    assert.strictEqual(res1.results[0]?.entityId, "entry-005");
    assert.strictEqual(res1.results[1]?.entityId, "entry-004");
    assert.strictEqual(res1.results[2]?.entityId, "entry-003");
    assert.strictEqual(res1.results[3]?.entityId, "entry-002");
    assert.strictEqual(res1.results[4]?.entityId, "entry-001");
  });

  // --------------------------------------------------------------------------
  // 11. Owner A Isolation
  // --------------------------------------------------------------------------
  test("11. Owner A isolation guarantees Owner A only discovers Owner A timeline entries", async () => {
    const { engine, scopeA } = createTestEngine();
    const query = new SearchQuery({ query: "Event" });
    const res = await engine.search(query, scopeA);

    assert.strictEqual(res.total, 5);
    for (const result of res.results) {
      assert.notStrictEqual(result.entityId, "entry-foreign-001");
    }
  });

  // --------------------------------------------------------------------------
  // 12. Owner B Isolation
  // --------------------------------------------------------------------------
  test("12. Owner B isolation guarantees Owner B only discovers Owner B timeline entries", async () => {
    const { engine, scopeB } = createTestEngine();
    const query = new SearchQuery({ query: "Event" });
    const res = await engine.search(query, scopeB);

    assert.strictEqual(res.total, 1);
    assert.strictEqual(res.results[0]?.entityId, "entry-foreign-001");
  });

  // --------------------------------------------------------------------------
  // 13. Tenant Isolation
  // --------------------------------------------------------------------------
  test("13. tenant isolation prevents cross-tenant timeline discovery", async () => {
    const { engine, scopeA } = createTestEngine();
    const query = new SearchQuery({ query: "foreign-meeting" });
    const res = await engine.search(query, scopeA);

    assert.strictEqual(res.total, 0);
    assert.strictEqual(res.count, 0);
  });

  // --------------------------------------------------------------------------
  // 14. Forged Scope Protection
  // --------------------------------------------------------------------------
  test("14. forged ownerId and tenantId in search query payload are strictly rejected", () => {
    assert.throws(
      () => SearchQuery.fromRaw({ query: "event", ownerId: ownerB }),
      (err: unknown) => {
        assert(err instanceof SearchDomainError);
        assert.strictEqual(err.code, "INVALID_SEARCH_REQUEST");
        assert.match(err.publicMessage, /Unknown search query parameter: ownerId/);
        return true;
      },
    );

    assert.throws(
      () => SearchQuery.fromRaw({ query: "event", tenantId: tenantB }),
      (err: unknown) => {
        assert(err instanceof SearchDomainError);
        assert.strictEqual(err.code, "INVALID_SEARCH_REQUEST");
        assert.match(err.publicMessage, /Unknown search query parameter: tenantId/);
        return true;
      },
    );
  });

  // --------------------------------------------------------------------------
  // 15. Safe SearchResult Mapping
  // --------------------------------------------------------------------------
  test("15. safe SearchResult mapping formats canonical DTOs properly", () => {
    const item = {
      id: "entry-dto-1",
      timelineId: "tl-dto-1",
      clientId: "client-dto-1",
      category: "Communication Event",
      timestamp: new Date("2026-08-14T10:00:00.000Z"),
      eventRef: "meeting-quarterly",
      actorRef: "agent-main",
      visibility: "Public",
      metadataSummary: "Executive quarterly sync",
      createdAt: new Date(),
    };

    const searchResult = mapTimelineEntryToSearchResult(item, "meeting-quarterly");

    assert.strictEqual(searchResult.resultType, "TIMELINE");
    assert.strictEqual(searchResult.entityId, "entry-dto-1");
    assert.strictEqual(searchResult.display.title, "Communication Event • 2026-08-14");
    assert.strictEqual(
      searchResult.display.subtitle,
      "Public • Actor: agent-main • Ref: meeting-quarterly",
    );
    assert.strictEqual(searchResult.display.snippet, "Executive quarterly sync");
    assert(searchResult.relevance?.score && searchResult.relevance.score > 0);
  });

  // --------------------------------------------------------------------------
  // 16. Secret Exclusion
  // --------------------------------------------------------------------------
  test("16. secret exclusion ensures no credentials or secrets leak in JSON output", async () => {
    const { engine, scopeA } = createTestEngine();
    const query = new SearchQuery({ query: "Event" });
    const res = await engine.search(query, scopeA);

    const json = res.toJSON();
    assertSearchJsonSafe(json, "TimelineSearchResultJSON");

    for (const result of json.results) {
      const keys = Object.keys(result);
      assert.strictEqual(keys.includes("ownerId"), false);
      assert.strictEqual(keys.includes("tenantId"), false);
      assert.strictEqual(keys.includes("password"), false);
      assert.strictEqual(keys.includes("token"), false);
      assert.strictEqual(keys.includes("apiKey"), false);
    }
  });

  // --------------------------------------------------------------------------
  // 17. Malformed Query Handling
  // --------------------------------------------------------------------------
  test("17. malformed search queries fail safely with domain errors", () => {
    assert.throws(
      () => new SearchQuery({ query: "   " }),
      (err: unknown) => {
        assert(err instanceof SearchDomainError);
        assert.strictEqual(err.code, "INVALID_QUERY");
        return true;
      },
    );

    assert.throws(
      () => new SearchQuery({ query: "event", page: -1 }),
      (err: unknown) => {
        assert(err instanceof SearchDomainError);
        assert.strictEqual(err.code, "INVALID_PAGINATION");
        return true;
      },
    );
  });

  // --------------------------------------------------------------------------
  // 18. Bounded Result Count
  // --------------------------------------------------------------------------
  test("18. bounded result count ensures results count bounded by pageSize", async () => {
    const { engine, scopeA } = createTestEngine();
    const query = new SearchQuery({ query: "Event", page: 1, pageSize: 3 });
    const res = await engine.search(query, scopeA);

    assert.strictEqual(res.pageSize, 3);
    assert.strictEqual(res.count, 3);
    assert.strictEqual(res.total, 5);
  });

  // --------------------------------------------------------------------------
  // 19. No Duplicate Results
  // --------------------------------------------------------------------------
  test("19. no duplicate results returned across paginated windows", async () => {
    const { engine, scopeA } = createTestEngine();
    const p1 = await engine.search(
      new SearchQuery({ query: "Event", page: 1, pageSize: 3 }),
      scopeA,
    );
    const p2 = await engine.search(
      new SearchQuery({ query: "Event", page: 2, pageSize: 3 }),
      scopeA,
    );

    const ids1 = p1.results.map((r) => r.entityId);
    const ids2 = p2.results.map((r) => r.entityId);

    const intersection = ids1.filter((id) => ids2.includes(id));
    assert.strictEqual(intersection.length, 0);
  });

  // --------------------------------------------------------------------------
  // 20. Provider-Independent Execution
  // --------------------------------------------------------------------------
  test("20. provider-independent execution decouples domain from persistence engines", async () => {
    const customRepo: TimelineSearchRepository = {
      searchTimeline: async (_q, _scope, page, pageSize): Promise<TimelineSearchResultList> => ({
        items: [
          {
            id: "custom-entry-1",
            timelineId: "tl-cust-1",
            clientId: "cli-cust-1",
            category: "Audit Event",
            timestamp: new Date("2026-08-18T10:00:00.000Z"),
            actorRef: "cust-actor",
            visibility: "Public",
            createdAt: new Date(),
          },
        ],
        total: 1,
        page,
        pageSize,
      }),
    };

    const engine = new TimelineSearchEngine(customRepo);
    const scope = new AuthorizedSearchScope({ tenantId: "t-1", ownerId: "o-1" });
    const res = await engine.search(new SearchQuery({ query: "Audit" }), scope);

    assert.strictEqual(res.count, 1);
    assert.strictEqual(res.results[0]?.resultType, "TIMELINE");
    assert.match(res.results[0]?.display.title ?? "", /Audit Event/);
  });
});
