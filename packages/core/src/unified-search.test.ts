import { test, describe } from "node:test";
import assert from "node:assert";
import {
  SearchQuery,
  AuthorizedSearchScope,
  SearchResult,
  SearchResultSet,
  SearchDomainError,
  assertSearchJsonSafe,
  UnifiedSearchEngine,
  ClientSearchEngine,
  InMemoryClientSearchRepository,
  JobSearchEngine,
  InMemoryJobSearchRepository,
  MatchSearchEngine,
  InMemoryMatchSearchRepository,
  TimelineSearchEngine,
  InMemoryTimelineSearchRepository,
} from "./index.js";
import type { SearchEngine } from "./index.js";

describe("Phase 11D-7: Unified Search Orchestration Tests", () => {
  // Test Tenants & Scopes
  const tenantA = "tenant-aaa-111";
  const ownerA = "owner-aaa-111";
  const tenantB = "tenant-bbb-222";
  const ownerB = "owner-bbb-222";

  const scopeA = new AuthorizedSearchScope({ tenantId: tenantA, ownerId: ownerA });
  const scopeB = new AuthorizedSearchScope({ tenantId: tenantB, ownerId: ownerB });
  void scopeB;

  // Test Fixture Setup
  function createTestHarness() {
    const clientRepo = new InMemoryClientSearchRepository([
      {
        id: "client-001",
        tenantId: tenantA,
        ownerId: ownerA,
        name: "Acme Corporation",
        status: "Active",
        email: "alice@acme.com",
        firstName: "Alice",
        lastName: "Acme",
        createdAt: new Date("2026-08-10T10:00:00.000Z"),
      },
      {
        id: "client-002",
        tenantId: tenantA,
        ownerId: ownerA,
        name: "Beta Logistics",
        status: "Lead",
        createdAt: new Date("2026-08-12T12:00:00.000Z"),
      },
      {
        id: "client-foreign",
        tenantId: tenantB,
        ownerId: ownerB,
        name: "Foreign Client",
        status: "Active",
        createdAt: new Date("2026-08-14T14:00:00.000Z"),
      },
    ]);
    const clientEngine = new ClientSearchEngine(clientRepo);

    const jobRepo = new InMemoryJobSearchRepository([
      {
        id: "job-001",
        tenantId: tenantA,
        ownerId: ownerA,
        source: "upwork",
        externalJobId: "upwork-101",
        status: "RECEIVED",
        title: "Senior React Engineer",
        description: "Looking for a seasoned React & TypeScript developer",
        skills: ["react", "typescript"],
        category: "Web Development",
        createdAt: new Date("2026-08-11T11:00:00.000Z"),
      },
      {
        id: "job-002",
        tenantId: tenantA,
        ownerId: ownerA,
        source: "linkedin",
        externalJobId: "linkedin-202",
        status: "IMPORTED",
        title: "Backend Node.js Architect",
        description: "Building scalable distributed systems",
        skills: ["nodejs", "typescript"],
        category: "Backend Development",
        createdAt: new Date("2026-08-13T13:00:00.000Z"),
      },
    ]);
    const jobEngine = new JobSearchEngine(jobRepo);

    const matchRepo = new InMemoryMatchSearchRepository([
      {
        id: "match-001",
        tenantId: tenantA,
        ownerId: ownerA,
        freelancerId: "free-101",
        jobId: "job-001",
        status: "EVALUATED",
        matchingVersion: "v1",
        matchedSkills: ["react", "typescript"],
        skillCoverage: 1.0,
        createdAt: new Date("2026-08-14T14:00:00.000Z"),
      },
    ]);
    const matchEngine = new MatchSearchEngine(matchRepo);

    const timelineRepo = new InMemoryTimelineSearchRepository([
      {
        id: "entry-001",
        timelineId: "tl-001",
        clientId: "client-001",
        tenantId: tenantA,
        ownerId: ownerA,
        category: "Communication Event",
        timestamp: new Date("2026-08-15T15:00:00.000Z"),
        eventRef: "meeting-kickoff",
        actorRef: "agent-alice",
        visibility: "Public",
        metadata: { note: "Discussed project deliverables with Acme" },
        createdAt: new Date("2026-08-15T15:00:00.000Z"),
      },
    ]);
    const timelineEngine = new TimelineSearchEngine(timelineRepo);

    const unifiedEngine = new UnifiedSearchEngine({
      clientEngine,
      jobEngine,
      matchEngine,
      timelineEngine,
    });

    return {
      clientRepo,
      clientEngine,
      jobRepo,
      jobEngine,
      matchRepo,
      matchEngine,
      timelineRepo,
      timelineEngine,
      unifiedEngine,
    };
  }

  // --------------------------------------------------------------------------
  // 1. All four engines execute for unrestricted search
  // --------------------------------------------------------------------------
  test("1. all four engines execute for unrestricted search", async () => {
    let clientCalls = 0;
    let jobCalls = 0;
    let matchCalls = 0;
    let timelineCalls = 0;

    const mockClient: SearchEngine = {
      search: async () => {
        clientCalls++;
        return new SearchResultSet({ results: [], total: 0, page: 1, pageSize: 20 });
      },
    };
    const mockJob: SearchEngine = {
      search: async () => {
        jobCalls++;
        return new SearchResultSet({ results: [], total: 0, page: 1, pageSize: 20 });
      },
    };
    const mockMatch: SearchEngine = {
      search: async () => {
        matchCalls++;
        return new SearchResultSet({ results: [], total: 0, page: 1, pageSize: 20 });
      },
    };
    const mockTimeline: SearchEngine = {
      search: async () => {
        timelineCalls++;
        return new SearchResultSet({ results: [], total: 0, page: 1, pageSize: 20 });
      },
    };

    const engine = new UnifiedSearchEngine({
      clientEngine: mockClient,
      jobEngine: mockJob,
      matchEngine: mockMatch,
      timelineEngine: mockTimeline,
    });

    await engine.search(new SearchQuery({ query: "test" }), scopeA);

    assert.strictEqual(clientCalls, 1);
    assert.strictEqual(jobCalls, 1);
    assert.strictEqual(matchCalls, 1);
    assert.strictEqual(timelineCalls, 1);
  });

  // --------------------------------------------------------------------------
  // 2. CLIENT filter executes only Client engine
  // --------------------------------------------------------------------------
  test("2. CLIENT filter executes only Client engine", async () => {
    let clientCalls = 0;
    let otherCalls = 0;

    const engine = new UnifiedSearchEngine({
      clientEngine: {
        search: async () => {
          clientCalls++;
          return new SearchResultSet({ results: [], total: 0, page: 1, pageSize: 20 });
        },
      },
      jobEngine: {
        search: async () => {
          otherCalls++;
          return new SearchResultSet({ results: [], total: 0, page: 1, pageSize: 20 });
        },
      },
      matchEngine: {
        search: async () => {
          otherCalls++;
          return new SearchResultSet({ results: [], total: 0, page: 1, pageSize: 20 });
        },
      },
      timelineEngine: {
        search: async () => {
          otherCalls++;
          return new SearchResultSet({ results: [], total: 0, page: 1, pageSize: 20 });
        },
      },
    });

    await engine.search(new SearchQuery({ query: "test", resultTypes: ["CLIENT"] }), scopeA);

    assert.strictEqual(clientCalls, 1);
    assert.strictEqual(otherCalls, 0);
  });

  // --------------------------------------------------------------------------
  // 3. JOB filter executes only Job engine
  // --------------------------------------------------------------------------
  test("3. JOB filter executes only Job engine", async () => {
    let jobCalls = 0;
    let otherCalls = 0;

    const engine = new UnifiedSearchEngine({
      clientEngine: {
        search: async () => {
          otherCalls++;
          return new SearchResultSet({ results: [], total: 0, page: 1, pageSize: 20 });
        },
      },
      jobEngine: {
        search: async () => {
          jobCalls++;
          return new SearchResultSet({ results: [], total: 0, page: 1, pageSize: 20 });
        },
      },
      matchEngine: {
        search: async () => {
          otherCalls++;
          return new SearchResultSet({ results: [], total: 0, page: 1, pageSize: 20 });
        },
      },
      timelineEngine: {
        search: async () => {
          otherCalls++;
          return new SearchResultSet({ results: [], total: 0, page: 1, pageSize: 20 });
        },
      },
    });

    await engine.search(new SearchQuery({ query: "test", resultTypes: ["JOB"] }), scopeA);

    assert.strictEqual(jobCalls, 1);
    assert.strictEqual(otherCalls, 0);
  });

  // --------------------------------------------------------------------------
  // 4. MATCH filter executes only Match engine
  // --------------------------------------------------------------------------
  test("4. MATCH filter executes only Match engine", async () => {
    let matchCalls = 0;
    let otherCalls = 0;

    const engine = new UnifiedSearchEngine({
      clientEngine: {
        search: async () => {
          otherCalls++;
          return new SearchResultSet({ results: [], total: 0, page: 1, pageSize: 20 });
        },
      },
      jobEngine: {
        search: async () => {
          otherCalls++;
          return new SearchResultSet({ results: [], total: 0, page: 1, pageSize: 20 });
        },
      },
      matchEngine: {
        search: async () => {
          matchCalls++;
          return new SearchResultSet({ results: [], total: 0, page: 1, pageSize: 20 });
        },
      },
      timelineEngine: {
        search: async () => {
          otherCalls++;
          return new SearchResultSet({ results: [], total: 0, page: 1, pageSize: 20 });
        },
      },
    });

    await engine.search(new SearchQuery({ query: "test", resultTypes: ["MATCH"] }), scopeA);

    assert.strictEqual(matchCalls, 1);
    assert.strictEqual(otherCalls, 0);
  });

  // --------------------------------------------------------------------------
  // 5. TIMELINE filter executes only Timeline engine
  // --------------------------------------------------------------------------
  test("5. TIMELINE filter executes only Timeline engine", async () => {
    let timelineCalls = 0;
    let otherCalls = 0;

    const engine = new UnifiedSearchEngine({
      clientEngine: {
        search: async () => {
          otherCalls++;
          return new SearchResultSet({ results: [], total: 0, page: 1, pageSize: 20 });
        },
      },
      jobEngine: {
        search: async () => {
          otherCalls++;
          return new SearchResultSet({ results: [], total: 0, page: 1, pageSize: 20 });
        },
      },
      matchEngine: {
        search: async () => {
          otherCalls++;
          return new SearchResultSet({ results: [], total: 0, page: 1, pageSize: 20 });
        },
      },
      timelineEngine: {
        search: async () => {
          timelineCalls++;
          return new SearchResultSet({ results: [], total: 0, page: 1, pageSize: 20 });
        },
      },
    });

    await engine.search(new SearchQuery({ query: "test", resultTypes: ["TIMELINE"] }), scopeA);

    assert.strictEqual(timelineCalls, 1);
    assert.strictEqual(otherCalls, 0);
  });

  // --------------------------------------------------------------------------
  // 6. Subset filtering skips excluded engines
  // --------------------------------------------------------------------------
  test("6. subset filtering skips excluded engines", async () => {
    let clientCalls = 0;
    let jobCalls = 0;
    let matchCalls = 0;
    let timelineCalls = 0;

    const engine = new UnifiedSearchEngine({
      clientEngine: {
        search: async () => {
          clientCalls++;
          return new SearchResultSet({ results: [], total: 0, page: 1, pageSize: 20 });
        },
      },
      jobEngine: {
        search: async () => {
          jobCalls++;
          return new SearchResultSet({ results: [], total: 0, page: 1, pageSize: 20 });
        },
      },
      matchEngine: {
        search: async () => {
          matchCalls++;
          return new SearchResultSet({ results: [], total: 0, page: 1, pageSize: 20 });
        },
      },
      timelineEngine: {
        search: async () => {
          timelineCalls++;
          return new SearchResultSet({ results: [], total: 0, page: 1, pageSize: 20 });
        },
      },
    });

    await engine.search(
      new SearchQuery({ query: "test", resultTypes: ["CLIENT", "TIMELINE"] }),
      scopeA,
    );

    assert.strictEqual(clientCalls, 1);
    assert.strictEqual(timelineCalls, 1);
    assert.strictEqual(jobCalls, 0);
    assert.strictEqual(matchCalls, 0);
  });

  // --------------------------------------------------------------------------
  // 7. Single-type fast path delegates page/pageSize directly
  // --------------------------------------------------------------------------
  test("7. single-type fast path delegates page/pageSize directly", async () => {
    let capturedQuery: SearchQuery | undefined;

    const engine = new UnifiedSearchEngine({
      clientEngine: {
        search: async (q) => {
          capturedQuery = q;
          return new SearchResultSet({
            results: [],
            total: 10,
            page: q.page,
            pageSize: q.pageSize,
          });
        },
      },
    });

    const query = new SearchQuery({
      query: "test",
      resultTypes: ["CLIENT"],
      page: 3,
      pageSize: 15,
    });
    const res = await engine.search(query, scopeA);

    assert(capturedQuery !== undefined);
    assert.strictEqual(capturedQuery.page, 3);
    assert.strictEqual(capturedQuery.pageSize, 15);
    assert.strictEqual(res.page, 3);
    assert.strictEqual(res.pageSize, 15);
  });

  // --------------------------------------------------------------------------
  // 8. Multi-type search aggregates results
  // --------------------------------------------------------------------------
  test("8. multi-type search aggregates results across multiple domains", async () => {
    const { unifiedEngine } = createTestHarness();
    const query = new SearchQuery({ query: "React" });
    const res = await unifiedEngine.search(query, scopeA);

    // Matches Job ("Senior React Engineer") and Match ("react")
    assert.strictEqual(res.total, 2);
    assert.strictEqual(res.count, 2);
    const types = res.results.map((r) => r.resultType);
    assert(types.includes("JOB"));
    assert(types.includes("MATCH"));
  });

  // --------------------------------------------------------------------------
  // 9. Global total equals sum of active engine totals
  // --------------------------------------------------------------------------
  test("9. global total equals sum of active engine totals", async () => {
    const engine = new UnifiedSearchEngine({
      clientEngine: {
        search: async () => new SearchResultSet({ results: [], total: 5, page: 1, pageSize: 20 }),
      },
      jobEngine: {
        search: async () => new SearchResultSet({ results: [], total: 12, page: 1, pageSize: 20 }),
      },
      matchEngine: {
        search: async () => new SearchResultSet({ results: [], total: 3, page: 1, pageSize: 20 }),
      },
      timelineEngine: {
        search: async () => new SearchResultSet({ results: [], total: 7, page: 1, pageSize: 20 }),
      },
    });

    const res = await engine.search(new SearchQuery({ query: "test" }), scopeA);
    assert.strictEqual(res.total, 27); // 5 + 12 + 3 + 7 = 27
  });

  // --------------------------------------------------------------------------
  // 10. Global page slicing is correct
  // --------------------------------------------------------------------------
  test("10. global page slicing slices merged results correctly across pages", async () => {
    const createItem = (id: string, score: number, type: "CLIENT" | "JOB") =>
      new SearchResult({
        resultType: type,
        entityId: id,
        display: { title: id, subtitle: "sub" },
        relevance: { score, matchedFields: ["field"] },
      });

    const engine = new UnifiedSearchEngine({
      clientEngine: {
        search: async () =>
          new SearchResultSet({
            results: [createItem("c1", 1.0, "CLIENT"), createItem("c2", 0.8, "CLIENT")],
            total: 2,
            page: 1,
            pageSize: 20,
          }),
      },
      jobEngine: {
        search: async () =>
          new SearchResultSet({
            results: [createItem("j1", 0.9, "JOB"), createItem("j2", 0.7, "JOB")],
            total: 2,
            page: 1,
            pageSize: 20,
          }),
      },
    });

    // Page 1 with pageSize 2 (should return c1 [1.0] and j1 [0.9])
    const res1 = await engine.search(
      new SearchQuery({ query: "test", page: 1, pageSize: 2 }),
      scopeA,
    );
    assert.strictEqual(res1.results.length, 2);
    assert.strictEqual(res1.results[0]?.entityId, "c1");
    assert.strictEqual(res1.results[1]?.entityId, "j1");

    // Page 2 with pageSize 2 (should return c2 [0.8] and j2 [0.7])
    const res2 = await engine.search(
      new SearchQuery({ query: "test", page: 2, pageSize: 2 }),
      scopeA,
    );
    assert.strictEqual(res2.results.length, 2);
    assert.strictEqual(res2.results[0]?.entityId, "c2");
    assert.strictEqual(res2.results[1]?.entityId, "j2");
  });

  // --------------------------------------------------------------------------
  // 11. PageSize never exceeded
  // --------------------------------------------------------------------------
  test("11. pageSize is never exceeded", async () => {
    const createItems = (count: number, type: "CLIENT") =>
      Array.from(
        { length: count },
        (_, i) =>
          new SearchResult({
            resultType: type,
            entityId: `id-${i}`,
            display: { title: `title-${i}`, subtitle: "sub" },
            relevance: { score: 1.0, matchedFields: ["name"] },
          }),
      );

    const engine = new UnifiedSearchEngine({
      clientEngine: {
        search: async () =>
          new SearchResultSet({
            results: createItems(50, "CLIENT"),
            total: 50,
            page: 1,
            pageSize: 50,
          }),
      },
      jobEngine: {
        search: async () => new SearchResultSet({ results: [], total: 0, page: 1, pageSize: 50 }),
      },
    });

    const res = await engine.search(new SearchQuery({ query: "test", pageSize: 5 }), scopeA);
    assert.strictEqual(res.results.length, 5);
    assert.strictEqual(res.pageSize, 5);
  });

  // --------------------------------------------------------------------------
  // 12. Page beyond available results returns empty results
  // --------------------------------------------------------------------------
  test("12. page beyond available results returns empty results array with accurate metadata", async () => {
    const { unifiedEngine } = createTestHarness();
    const query = new SearchQuery({ query: "Acme", page: 99, pageSize: 10 });
    const res = await unifiedEngine.search(query, scopeA);

    assert.strictEqual(res.results.length, 0);
    assert.strictEqual(res.total, 2); // 1 Client + 1 Timeline entry
    assert.strictEqual(res.page, 99);
    assert.strictEqual(res.pageSize, 10);
    assert.strictEqual(res.totalPages, 1);
  });

  // --------------------------------------------------------------------------
  // 13. Relevance score DESC ordering
  // --------------------------------------------------------------------------
  test("13. relevance score DESC ordering ranks higher scores first globally", async () => {
    const engine = new UnifiedSearchEngine({
      clientEngine: {
        search: async () =>
          new SearchResultSet({
            results: [
              new SearchResult({
                resultType: "CLIENT",
                entityId: "c-low",
                display: { title: "Low", subtitle: "sub" },
                relevance: { score: 0.6, matchedFields: ["name"] },
              }),
            ],
            total: 1,
            page: 1,
            pageSize: 20,
          }),
      },
      jobEngine: {
        search: async () =>
          new SearchResultSet({
            results: [
              new SearchResult({
                resultType: "JOB",
                entityId: "j-high",
                display: { title: "High", subtitle: "sub" },
                relevance: { score: 0.95, matchedFields: ["title"] },
              }),
            ],
            total: 1,
            page: 1,
            pageSize: 20,
          }),
      },
    });

    const res = await engine.search(new SearchQuery({ query: "test" }), scopeA);
    assert.strictEqual(res.results[0]?.entityId, "j-high");
    assert.strictEqual(res.results[1]?.entityId, "c-low");
  });

  // --------------------------------------------------------------------------
  // 14. CLIENT → JOB → MATCH → TIMELINE tie-break ordering
  // --------------------------------------------------------------------------
  test("14. CLIENT -> JOB -> MATCH -> TIMELINE tie-break ordering applies on identical scores", async () => {
    const createItem = (id: string, type: "CLIENT" | "JOB" | "MATCH" | "TIMELINE") =>
      new SearchResult({
        resultType: type,
        entityId: id,
        display: { title: id, subtitle: "sub" },
        relevance: { score: 1.0, matchedFields: ["field"] },
      });

    const engine = new UnifiedSearchEngine({
      timelineEngine: {
        search: async () =>
          new SearchResultSet({
            results: [createItem("t1", "TIMELINE")],
            total: 1,
            page: 1,
            pageSize: 20,
          }),
      },
      matchEngine: {
        search: async () =>
          new SearchResultSet({
            results: [createItem("m1", "MATCH")],
            total: 1,
            page: 1,
            pageSize: 20,
          }),
      },
      jobEngine: {
        search: async () =>
          new SearchResultSet({
            results: [createItem("j1", "JOB")],
            total: 1,
            page: 1,
            pageSize: 20,
          }),
      },
      clientEngine: {
        search: async () =>
          new SearchResultSet({
            results: [createItem("c1", "CLIENT")],
            total: 1,
            page: 1,
            pageSize: 20,
          }),
      },
    });

    const res = await engine.search(new SearchQuery({ query: "test" }), scopeA);
    const types = res.results.map((r) => r.resultType);
    assert.deepStrictEqual(types, ["CLIENT", "JOB", "MATCH", "TIMELINE"]);
  });

  // --------------------------------------------------------------------------
  // 15. entityId deterministic tie-break
  // --------------------------------------------------------------------------
  test("15. entityId deterministic tie-break orders descending lexicographically", async () => {
    const createItem = (id: string) =>
      new SearchResult({
        resultType: "CLIENT",
        entityId: id,
        display: { title: id, subtitle: "sub" },
        relevance: { score: 1.0, matchedFields: ["name"] },
      });

    const engine = new UnifiedSearchEngine({
      clientEngine: {
        search: async () =>
          new SearchResultSet({
            results: [createItem("client-aaa"), createItem("client-zzz"), createItem("client-mmm")],
            total: 3,
            page: 1,
            pageSize: 20,
          }),
      },
      jobEngine: {
        search: async () => new SearchResultSet({ results: [], total: 0, page: 1, pageSize: 20 }),
      },
    });

    const res = await engine.search(new SearchQuery({ query: "test" }), scopeA);
    const ids = res.results.map((r) => r.entityId);
    assert.deepStrictEqual(ids, ["client-zzz", "client-mmm", "client-aaa"]);
  });

  // --------------------------------------------------------------------------
  // 16. Duplicate same type/entityId is removed
  // --------------------------------------------------------------------------
  test("16. duplicate same type/entityId is removed during aggregation", async () => {
    const item1 = new SearchResult({
      resultType: "CLIENT",
      entityId: "client-dup-1",
      display: { title: "Dup", subtitle: "sub" },
      relevance: { score: 0.8, matchedFields: ["name"] },
    });
    const item2 = new SearchResult({
      resultType: "CLIENT",
      entityId: "client-dup-1",
      display: { title: "Dup", subtitle: "sub" },
      relevance: { score: 0.8, matchedFields: ["name"] },
    });

    const engine = new UnifiedSearchEngine({
      clientEngine: {
        search: async () =>
          new SearchResultSet({ results: [item1, item2], total: 2, page: 1, pageSize: 20 }),
      },
      jobEngine: {
        search: async () => new SearchResultSet({ results: [], total: 0, page: 1, pageSize: 20 }),
      },
    });

    const res = await engine.search(new SearchQuery({ query: "test" }), scopeA);
    assert.strictEqual(res.results.length, 1);
    assert.strictEqual(res.results[0]?.entityId, "client-dup-1");
  });

  // --------------------------------------------------------------------------
  // 17. Same ID across different types is preserved
  // --------------------------------------------------------------------------
  test("17. same ID across different types is preserved and not merged", async () => {
    const clientItem = new SearchResult({
      resultType: "CLIENT",
      entityId: "shared-id-123",
      display: { title: "Client Shared", subtitle: "sub" },
      relevance: { score: 1.0, matchedFields: ["name"] },
    });
    const jobItem = new SearchResult({
      resultType: "JOB",
      entityId: "shared-id-123",
      display: { title: "Job Shared", subtitle: "sub" },
      relevance: { score: 1.0, matchedFields: ["title"] },
    });

    const engine = new UnifiedSearchEngine({
      clientEngine: {
        search: async () =>
          new SearchResultSet({ results: [clientItem], total: 1, page: 1, pageSize: 20 }),
      },
      jobEngine: {
        search: async () =>
          new SearchResultSet({ results: [jobItem], total: 1, page: 1, pageSize: 20 }),
      },
    });

    const res = await engine.search(new SearchQuery({ query: "test" }), scopeA);
    assert.strictEqual(res.results.length, 2);
    assert.strictEqual(res.results[0]?.resultType, "CLIENT");
    assert.strictEqual(res.results[1]?.resultType, "JOB");
  });

  // --------------------------------------------------------------------------
  // 18. Higher-score duplicate wins
  // --------------------------------------------------------------------------
  test("18. higher-score duplicate wins when duplicate composite keys exist", async () => {
    const lowScore = new SearchResult({
      resultType: "CLIENT",
      entityId: "client-dup-score",
      display: { title: "Low Score", subtitle: "sub" },
      relevance: { score: 0.6, matchedFields: ["industry"] },
    });
    const highScore = new SearchResult({
      resultType: "CLIENT",
      entityId: "client-dup-score",
      display: { title: "High Score", subtitle: "sub" },
      relevance: { score: 1.0, matchedFields: ["name"] },
    });

    const engine = new UnifiedSearchEngine({
      clientEngine: {
        search: async () =>
          new SearchResultSet({
            results: [lowScore, highScore],
            total: 2,
            page: 1,
            pageSize: 20,
          }),
      },
      jobEngine: {
        search: async () => new SearchResultSet({ results: [], total: 0, page: 1, pageSize: 20 }),
      },
    });

    const res = await engine.search(new SearchQuery({ query: "test" }), scopeA);
    assert.strictEqual(res.results.length, 1);
    assert.strictEqual(res.results[0]?.relevance?.score, 1.0);
    assert.strictEqual(res.results[0]?.display.title, "High Score");
  });

  // --------------------------------------------------------------------------
  // 19. AuthorizedSearchScope is passed to every active engine
  // --------------------------------------------------------------------------
  test("19. AuthorizedSearchScope is passed unmodified to every active engine", async () => {
    let capturedScopeClient: AuthorizedSearchScope | null = null;
    let capturedScopeJob: AuthorizedSearchScope | null = null;

    const engine = new UnifiedSearchEngine({
      clientEngine: {
        search: async (_q, s) => {
          capturedScopeClient = s;
          return new SearchResultSet({ results: [], total: 0, page: 1, pageSize: 20 });
        },
      },
      jobEngine: {
        search: async (_q, s) => {
          capturedScopeJob = s;
          return new SearchResultSet({ results: [], total: 0, page: 1, pageSize: 20 });
        },
      },
    });

    await engine.search(new SearchQuery({ query: "test" }), scopeA);

    assert.strictEqual(capturedScopeClient, scopeA);
    assert.strictEqual(capturedScopeJob, scopeA);
  });

  // --------------------------------------------------------------------------
  // 20. Forged ownerId/tenantId cannot override scope
  // --------------------------------------------------------------------------
  test("20. forged ownerId and tenantId in search query payload are rejected", () => {
    assert.throws(
      () => SearchQuery.fromRaw({ query: "test", ownerId: ownerB }),
      (err: unknown) => {
        assert(err instanceof SearchDomainError);
        assert.strictEqual(err.code, "INVALID_SEARCH_REQUEST");
        return true;
      },
    );

    assert.throws(
      () => SearchQuery.fromRaw({ query: "test", tenantId: tenantB }),
      (err: unknown) => {
        assert(err instanceof SearchDomainError);
        assert.strictEqual(err.code, "INVALID_SEARCH_REQUEST");
        return true;
      },
    );
  });

  // --------------------------------------------------------------------------
  // 21. Unauthorized scope fails
  // --------------------------------------------------------------------------
  test("21. unauthorized scope fails fast", async () => {
    const { unifiedEngine } = createTestHarness();
    const query = new SearchQuery({ query: "test" });

    await assert.rejects(
      async () => unifiedEngine.search(query, null as unknown as AuthorizedSearchScope),
      (err: unknown) => {
        assert(err instanceof SearchDomainError);
        assert.strictEqual(err.code, "UNAUTHORIZED_SCOPE");
        return true;
      },
    );
  });

  // --------------------------------------------------------------------------
  // 22. Validation errors fail
  // --------------------------------------------------------------------------
  test("22. validation errors fail fast", async () => {
    const { unifiedEngine } = createTestHarness();

    await assert.rejects(
      async () => unifiedEngine.search(null as unknown as SearchQuery, scopeA),
      (err: unknown) => {
        assert(err instanceof SearchDomainError);
        assert.strictEqual(err.code, "INVALID_SEARCH_REQUEST");
        return true;
      },
    );

    assert.throws(
      () => new SearchQuery({ query: "   " }),
      (err: unknown) => {
        assert(err instanceof SearchDomainError);
        assert.strictEqual(err.code, "INVALID_QUERY");
        return true;
      },
    );
  });

  // --------------------------------------------------------------------------
  // 23. Provider error does not become empty success
  // --------------------------------------------------------------------------
  test("23. provider error in an active engine fails unified search instead of empty success", async () => {
    const engine = new UnifiedSearchEngine({
      clientEngine: {
        search: async () => {
          throw new SearchDomainError("SEARCH_PROVIDER_ERROR", "DB connection lost");
        },
      },
      jobEngine: {
        search: async () =>
          new SearchResultSet({
            results: [
              new SearchResult({
                resultType: "JOB",
                entityId: "j1",
                display: { title: "J1", subtitle: "sub" },
              }),
            ],
            total: 1,
            page: 1,
            pageSize: 20,
          }),
      },
    });

    await assert.rejects(
      async () => engine.search(new SearchQuery({ query: "test" }), scopeA),
      (err: unknown) => {
        assert(err instanceof SearchDomainError);
        assert.strictEqual(err.code, "SEARCH_PROVIDER_ERROR");
        return true;
      },
    );
  });

  // --------------------------------------------------------------------------
  // 24. Zero-result engines aggregate safely
  // --------------------------------------------------------------------------
  test("24. zero-result engines aggregate safely with active matches", async () => {
    const engine = new UnifiedSearchEngine({
      clientEngine: {
        search: async () => new SearchResultSet({ results: [], total: 0, page: 1, pageSize: 20 }),
      },
      jobEngine: {
        search: async () =>
          new SearchResultSet({
            results: [
              new SearchResult({
                resultType: "JOB",
                entityId: "job-found-1",
                display: { title: "Job Title", subtitle: "sub" },
                relevance: { score: 1.0, matchedFields: ["title"] },
              }),
            ],
            total: 1,
            page: 1,
            pageSize: 20,
          }),
      },
    });

    const res = await engine.search(new SearchQuery({ query: "test" }), scopeA);
    assert.strictEqual(res.total, 1);
    assert.strictEqual(res.results.length, 1);
    assert.strictEqual(res.results[0]?.entityId, "job-found-1");
  });

  // --------------------------------------------------------------------------
  // 25. All engines returning zero produces valid empty SearchResultSet
  // --------------------------------------------------------------------------
  test("25. all engines returning zero produces valid empty SearchResultSet", async () => {
    const { unifiedEngine } = createTestHarness();
    const query = new SearchQuery({ query: "NonExistentGlobalTerm999" });
    const res = await unifiedEngine.search(query, scopeA);

    assert.strictEqual(res.total, 0);
    assert.strictEqual(res.count, 0);
    assert.strictEqual(res.isEmpty, true);
    assert.strictEqual(res.totalPages, 0);
    assert.deepStrictEqual(res.results, []);
  });

  // --------------------------------------------------------------------------
  // 26. JSON-safe result output
  // --------------------------------------------------------------------------
  test("26. JSON-safe result output conforms to serialization contracts", async () => {
    const { unifiedEngine } = createTestHarness();
    const query = new SearchQuery({ query: "Acme" });
    const res = await unifiedEngine.search(query, scopeA);

    const json = res.toJSON();
    assertSearchJsonSafe(json, "UnifiedSearchResultJSON");

    for (const r of json.results) {
      assert.strictEqual("ownerId" in r, false);
      assert.strictEqual("tenantId" in r, false);
      assert.strictEqual("password" in r, false);
      assert.strictEqual("token" in r, false);
      assert.strictEqual("apiKey" in r, false);
    }
  });

  // --------------------------------------------------------------------------
  // 27. Secret-containing result data is sanitized
  // --------------------------------------------------------------------------
  test("27. secret-containing result data fails JSON safety assertion if tainted", () => {
    const taintedResult = {
      results: [
        {
          resultType: "CLIENT",
          entityId: "client-1",
          display: { title: "Client", subtitle: "Client subtitle" },
          apiKey: "sk_live_secret123",
        },
      ],
      total: 1,
      page: 1,
      pageSize: 20,
    };

    assert.throws(
      () => assertSearchJsonSafe(taintedResult, "TaintedResult"),
      (err: unknown) => {
        assert(err instanceof SearchDomainError);
        return true;
      },
    );
  });

  // --------------------------------------------------------------------------
  // 28. Excluded engines are never called
  // --------------------------------------------------------------------------
  test("28. excluded engines are never called during filtered searches", async () => {
    let uncalledTriggered = false;

    const engine = new UnifiedSearchEngine({
      clientEngine: {
        search: async () => new SearchResultSet({ results: [], total: 0, page: 1, pageSize: 20 }),
      },
      jobEngine: {
        search: async () => {
          uncalledTriggered = true;
          return new SearchResultSet({ results: [], total: 0, page: 1, pageSize: 20 });
        },
      },
    });

    await engine.search(new SearchQuery({ query: "test", resultTypes: ["CLIENT"] }), scopeA);
    assert.strictEqual(uncalledTriggered, false);
  });

  // --------------------------------------------------------------------------
  // 29. Deterministic results across repeated identical searches
  // --------------------------------------------------------------------------
  test("29. deterministic results across repeated identical searches", async () => {
    const { unifiedEngine } = createTestHarness();
    const query = new SearchQuery({ query: "React" });

    const res1 = await unifiedEngine.search(query, scopeA);
    const res2 = await unifiedEngine.search(query, scopeA);

    assert.deepStrictEqual(
      res1.results.map((r) => `${r.resultType}:${r.entityId}`),
      res2.results.map((r) => `${r.resultType}:${r.entityId}`),
    );
  });

  // --------------------------------------------------------------------------
  // 30. Bounded execution never exceeds four canonical engines
  // --------------------------------------------------------------------------
  test("30. bounded execution never exceeds four canonical engines", async () => {
    const calls: string[] = [];

    const engine = new UnifiedSearchEngine({
      clientEngine: {
        search: async () => {
          calls.push("CLIENT");
          return new SearchResultSet({ results: [], total: 0, page: 1, pageSize: 20 });
        },
      },
      jobEngine: {
        search: async () => {
          calls.push("JOB");
          return new SearchResultSet({ results: [], total: 0, page: 1, pageSize: 20 });
        },
      },
      matchEngine: {
        search: async () => {
          calls.push("MATCH");
          return new SearchResultSet({ results: [], total: 0, page: 1, pageSize: 20 });
        },
      },
      timelineEngine: {
        search: async () => {
          calls.push("TIMELINE");
          return new SearchResultSet({ results: [], total: 0, page: 1, pageSize: 20 });
        },
      },
    });

    await engine.search(new SearchQuery({ query: "test" }), scopeA);
    assert.strictEqual(calls.length, 4);
    assert.deepStrictEqual(calls.sort(), ["CLIENT", "JOB", "MATCH", "TIMELINE"]);
  });
});
