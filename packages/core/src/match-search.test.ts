import { test, describe } from "node:test";
import assert from "node:assert";
import {
  SearchQuery,
  AuthorizedSearchScope,
  SearchDomainError,
  assertSearchJsonSafe,
  MatchSearchEngine,
  InMemoryMatchSearchRepository,
  mapMatchToSearchResult,
} from "./index.js";
import type { MatchSearchRepository, MatchSearchResultList, InMemoryMatchRecord } from "./index.js";

describe("Phase 11D-4: Match Search Domain & Provider Tests", () => {
  // Test Data Fixtures
  const tenantA = "tenant-aaa-111";
  const ownerA = "owner-aaa-111";
  const tenantB = "tenant-bbb-222";
  const ownerB = "owner-bbb-222";

  const matchRecords: InMemoryMatchRecord[] = [
    {
      id: "match-001",
      tenantId: tenantA,
      ownerId: ownerA,
      freelancerId: "free-101",
      jobId: "job-101",
      status: "EVALUATED",
      matchingVersion: "v1",
      normalizationVersion: "v1",
      jobNormalizationId: "norm-101",
      matchedSkills: ["typescript", "nodejs", "react"],
      missingSkills: ["graphql"],
      skillCoverage: 0.75,
      semanticSimilarity: 0.88,
      experienceCompatibility: "COMPATIBLE",
      budgetCompatibility: "COMPATIBLE",
      jobTypeCompatibility: "COMPATIBLE",
      locationCompatibility: "COMPATIBLE",
      createdAt: new Date("2026-08-10T10:00:00.000Z"),
    },
    {
      id: "match-002",
      tenantId: tenantA,
      ownerId: ownerA,
      freelancerId: "free-102",
      jobId: "job-102",
      status: "CREATED",
      matchingVersion: "v1",
      normalizationVersion: "v1",
      jobNormalizationId: "norm-102",
      matchedSkills: ["python", "pytorch"],
      missingSkills: ["tensorflow"],
      skillCoverage: 0.67,
      experienceCompatibility: "PARTIAL",
      budgetCompatibility: "PARTIAL",
      createdAt: new Date("2026-08-12T12:00:00.000Z"),
    },
    {
      id: "match-003",
      tenantId: tenantA,
      ownerId: ownerA,
      freelancerId: "free-103",
      jobId: "job-103",
      status: "EVALUATED",
      matchingVersion: "v2",
      normalizationVersion: "v2",
      jobNormalizationId: "norm-103",
      matchedSkills: ["rust", "tokio", "grpc"],
      missingSkills: [],
      skillCoverage: 1.0,
      semanticSimilarity: 0.96,
      experienceCompatibility: "COMPATIBLE",
      budgetCompatibility: "COMPATIBLE",
      createdAt: new Date("2026-08-14T14:00:00.000Z"),
    },
    {
      id: "match-004",
      tenantId: tenantA,
      ownerId: ownerA,
      freelancerId: "free-104",
      jobId: "job-104",
      status: "ARCHIVED",
      matchingVersion: "v1",
      normalizationVersion: "v1",
      jobNormalizationId: "norm-104",
      matchedSkills: ["kubernetes", "terraform"],
      missingSkills: ["aws"],
      skillCoverage: 0.5,
      experienceCompatibility: "INCOMPATIBLE",
      budgetCompatibility: "INCOMPATIBLE",
      createdAt: new Date("2026-08-15T15:00:00.000Z"),
    },
    {
      id: "match-005",
      tenantId: tenantA,
      ownerId: ownerA,
      freelancerId: "free-105",
      jobId: "job-105",
      status: "EVALUATED",
      matchingVersion: "v1",
      normalizationVersion: "v1",
      jobNormalizationId: "norm-105",
      matchedSkills: ["react", "tailwind", "nextjs"],
      missingSkills: [],
      skillCoverage: 1.0,
      experienceCompatibility: "COMPATIBLE",
      budgetCompatibility: "COMPATIBLE",
      createdAt: new Date("2026-08-16T16:00:00.000Z"),
    },
    // Foreign tenant match
    {
      id: "match-foreign-001",
      tenantId: tenantB,
      ownerId: ownerB,
      freelancerId: "free-foreign-999",
      jobId: "job-foreign-999",
      status: "EVALUATED",
      matchingVersion: "v1",
      normalizationVersion: "v1",
      jobNormalizationId: "norm-foreign-999",
      matchedSkills: ["react", "vue"],
      missingSkills: [],
      skillCoverage: 1.0,
      createdAt: new Date("2026-08-16T18:00:00.000Z"),
    },
  ];

  function createTestEngine(records = matchRecords): {
    engine: MatchSearchEngine;
    repo: InMemoryMatchSearchRepository;
    scopeA: AuthorizedSearchScope;
    scopeB: AuthorizedSearchScope;
  } {
    const repo = new InMemoryMatchSearchRepository(records);
    const engine = new MatchSearchEngine(repo);
    const scopeA = new AuthorizedSearchScope({ tenantId: tenantA, ownerId: ownerA });
    const scopeB = new AuthorizedSearchScope({ tenantId: tenantB, ownerId: ownerB });
    return { engine, repo, scopeA, scopeB };
  }

  // --------------------------------------------------------------------------
  // 1. Match Search Returns Valid Results
  // --------------------------------------------------------------------------
  test("1. match search returns valid results with canonical contracts", async () => {
    const { engine, scopeA } = createTestEngine();
    const query = new SearchQuery({ query: "EVALUATED" });
    const res = await engine.search(query, scopeA);

    assert.strictEqual(res.count, 3);
    assert.strictEqual(res.total, 3);
    assert.strictEqual(res.page, 1);
    assert.strictEqual(res.pageSize, 20);
    assert.strictEqual(res.results[0]?.resultType, "MATCH");
    assert.strictEqual(res.results[0]?.entityId, "match-005");
  });

  // --------------------------------------------------------------------------
  // 2. Exact Supported-Field Matching
  // --------------------------------------------------------------------------
  test("2. exact supported-field matching returns target match with maximum score", async () => {
    const { engine, scopeA } = createTestEngine();
    const query = new SearchQuery({ query: "EVALUATED" });
    const res = await engine.search(query, scopeA);

    assert.strictEqual(res.count, 3);
    assert.strictEqual(res.results[0]?.relevance?.score, 1.0);
    assert(res.results[0]?.relevance?.matchedFields?.includes("status"));
  });

  // --------------------------------------------------------------------------
  // 3. Partial Matching Where Supported
  // --------------------------------------------------------------------------
  test("3. partial matching finds matches by token substring", async () => {
    const { engine, scopeA } = createTestEngine();
    const query = new SearchQuery({ query: "EVAL" });
    const res = await engine.search(query, scopeA);

    assert.strictEqual(res.count, 3);
    assert.strictEqual(res.results[0]?.relevance?.score, 0.9);
  });

  // --------------------------------------------------------------------------
  // 4. Case-Insensitive Matching
  // --------------------------------------------------------------------------
  test("4. case-insensitive matching produces identical results", async () => {
    const { engine, scopeA } = createTestEngine();
    const queryLower = new SearchQuery({ query: "evaluated" });
    const queryUpper = new SearchQuery({ query: "EVALUATED" });
    const queryMixed = new SearchQuery({ query: "EvAlUaTeD" });

    const resLower = await engine.search(queryLower, scopeA);
    const resUpper = await engine.search(queryUpper, scopeA);
    const resMixed = await engine.search(queryMixed, scopeA);

    assert.strictEqual(resLower.count, 3);
    assert.strictEqual(resUpper.count, 3);
    assert.strictEqual(resMixed.count, 3);
    assert.deepStrictEqual(
      resLower.results.map((r) => r.entityId),
      resUpper.results.map((r) => r.entityId),
    );
  });

  // --------------------------------------------------------------------------
  // 5. No-Result Search
  // --------------------------------------------------------------------------
  test("5. no-result search returns safe, empty SearchResultSet", async () => {
    const { engine, scopeA } = createTestEngine();
    const query = new SearchQuery({ query: "NonExistentTermXYZ999" });
    const res = await engine.search(query, scopeA);

    assert.strictEqual(res.count, 0);
    assert.strictEqual(res.total, 0);
    assert.strictEqual(res.totalPages, 0);
    assert.strictEqual(res.isEmpty, true);
    assert.deepStrictEqual(res.results, []);
  });

  // --------------------------------------------------------------------------
  // 6. Multiple Matches
  // --------------------------------------------------------------------------
  test("6. multiple matching jobs returned within total count", async () => {
    const { engine, scopeA } = createTestEngine();
    const query = new SearchQuery({ query: "react" });
    const res = await engine.search(query, scopeA);

    assert.strictEqual(res.count, 2);
    assert.strictEqual(res.total, 2);
    const ids = res.results.map((r) => r.entityId);
    assert.deepStrictEqual(ids, ["match-005", "match-001"]);
  });

  // --------------------------------------------------------------------------
  // 7. Pagination
  // --------------------------------------------------------------------------
  test("7. pagination slices results correctly across pages", async () => {
    const { engine, scopeA } = createTestEngine();
    const page1Query = new SearchQuery({ query: "EVALUATED", page: 1, pageSize: 2 });
    const page2Query = new SearchQuery({ query: "EVALUATED", page: 2, pageSize: 2 });

    const res1 = await engine.search(page1Query, scopeA);
    const res2 = await engine.search(page2Query, scopeA);

    assert.strictEqual(res1.total, 3);
    assert.strictEqual(res1.page, 1);
    assert.strictEqual(res1.pageSize, 2);
    assert.strictEqual(res1.totalPages, 2);
    assert.strictEqual(res1.count, 2);
    assert.strictEqual(res1.results[0]?.entityId, "match-005");
    assert.strictEqual(res1.results[1]?.entityId, "match-003");

    assert.strictEqual(res2.total, 3);
    assert.strictEqual(res2.page, 2);
    assert.strictEqual(res2.pageSize, 2);
    assert.strictEqual(res2.count, 1);
    assert.strictEqual(res2.results[0]?.entityId, "match-001");
  });

  // --------------------------------------------------------------------------
  // 8. PageSize Maximum 100
  // --------------------------------------------------------------------------
  test("8. pageSize maximum 100 enforced", () => {
    const query = new SearchQuery({ query: "react", pageSize: 100 });
    assert.strictEqual(query.pageSize, 100);

    assert.throws(
      () => new SearchQuery({ query: "react", pageSize: 101 }),
      (err: unknown) => {
        assert(err instanceof SearchDomainError);
        assert.strictEqual(err.code, "INVALID_PAGINATION");
        return true;
      },
    );
  });

  // --------------------------------------------------------------------------
  // 9. Deterministic Ordering
  // --------------------------------------------------------------------------
  test("9. deterministic ordering sorts strictly by recency (createdAt DESC, id DESC)", async () => {
    const { engine, scopeA } = createTestEngine();
    const query = new SearchQuery({ query: "EVALUATED" });
    const res1 = await engine.search(query, scopeA);
    const res2 = await engine.search(query, scopeA);

    assert.deepStrictEqual(
      res1.results.map((r) => r.entityId),
      res2.results.map((r) => r.entityId),
    );
    // match-005 (Aug 16) before match-003 (Aug 14) before match-001 (Aug 10)
    assert.strictEqual(res1.results[0]?.entityId, "match-005");
    assert.strictEqual(res1.results[1]?.entityId, "match-003");
    assert.strictEqual(res1.results[2]?.entityId, "match-001");
  });

  // --------------------------------------------------------------------------
  // 10. Deterministic Relevance
  // --------------------------------------------------------------------------
  test("10. deterministic relevance computes consistent scores", () => {
    const item = {
      id: "match-rel-1",
      jobId: "job-101",
      freelancerId: "free-101",
      status: "EVALUATED",
      matchingVersion: "v1",
      matchedSkills: ["typescript", "nodejs"],
      createdAt: new Date(),
    };

    const exactMatch = mapMatchToSearchResult(item, "EVALUATED");
    assert.strictEqual(exactMatch.relevance?.score, 1.0);

    const skillMatch = mapMatchToSearchResult(item, "typescript");
    assert.strictEqual(skillMatch.relevance?.score, 0.95);
  });

  // --------------------------------------------------------------------------
  // 11. Owner A Isolation
  // --------------------------------------------------------------------------
  test("11. Owner A isolation guarantees Owner A can only discover Owner A matches", async () => {
    const { engine, scopeA } = createTestEngine();
    const query = new SearchQuery({ query: "react" });
    const res = await engine.search(query, scopeA);

    assert.strictEqual(res.total, 2);
    for (const result of res.results) {
      assert.notStrictEqual(result.entityId, "match-foreign-001");
    }
  });

  // --------------------------------------------------------------------------
  // 12. Owner B Isolation
  // --------------------------------------------------------------------------
  test("12. Owner B isolation guarantees Owner B can only discover Owner B matches", async () => {
    const { engine, scopeB } = createTestEngine();
    const query = new SearchQuery({ query: "react" });
    const res = await engine.search(query, scopeB);

    assert.strictEqual(res.total, 1);
    assert.strictEqual(res.results[0]?.entityId, "match-foreign-001");
  });

  // --------------------------------------------------------------------------
  // 13. Cross-Tenant Isolation
  // --------------------------------------------------------------------------
  test("13. cross-tenant isolation prevents foreign match discovery", async () => {
    const { engine, scopeA } = createTestEngine();
    const query = new SearchQuery({ query: "free-foreign-999" });
    const res = await engine.search(query, scopeA);

    assert.strictEqual(res.total, 0);
    assert.strictEqual(res.count, 0);
  });

  // --------------------------------------------------------------------------
  // 14. Forged ownerId Rejected
  // --------------------------------------------------------------------------
  test("14. forged ownerId in search query payload is strictly rejected", () => {
    const forgedInput = {
      query: "react",
      ownerId: ownerB,
    };

    assert.throws(
      () => SearchQuery.fromRaw(forgedInput),
      (err: unknown) => {
        assert(err instanceof SearchDomainError);
        assert.strictEqual(err.code, "INVALID_SEARCH_REQUEST");
        assert.match(err.publicMessage, /Unknown search query parameter: ownerId/);
        return true;
      },
    );
  });

  // --------------------------------------------------------------------------
  // 15. Forged tenantId Rejected
  // --------------------------------------------------------------------------
  test("15. forged tenantId in search query payload is strictly rejected", () => {
    const forgedInput = {
      query: "react",
      tenantId: tenantB,
    };

    assert.throws(
      () => SearchQuery.fromRaw(forgedInput),
      (err: unknown) => {
        assert(err instanceof SearchDomainError);
        assert.strictEqual(err.code, "INVALID_SEARCH_REQUEST");
        assert.match(err.publicMessage, /Unknown search query parameter: tenantId/);
        return true;
      },
    );
  });

  // --------------------------------------------------------------------------
  // 16. Safe SearchResult Mapping
  // --------------------------------------------------------------------------
  test("16. safe SearchResult mapping formats canonical DTOs properly", () => {
    const item = {
      id: "match-dto-1",
      jobId: "12345678-aaaa-bbbb-cccc-123456789000",
      freelancerId: "87654321-aaaa-bbbb-cccc-123456789000",
      status: "EVALUATED",
      matchingVersion: "v1",
      matchedSkills: ["typescript", "react"],
      skillCoverage: 0.9,
      budgetCompatibility: "COMPATIBLE",
      createdAt: new Date(),
    };

    const searchResult = mapMatchToSearchResult(item, "typescript");

    assert.strictEqual(searchResult.resultType, "MATCH");
    assert.strictEqual(searchResult.entityId, "match-dto-1");
    assert.strictEqual(searchResult.display.title, "Match for Job 12345678...");
    assert.strictEqual(searchResult.display.subtitle, "90% Match • v1 • EVALUATED");
    assert.strictEqual(searchResult.display.snippet, "Matched Skills: typescript, react");
    assert(searchResult.relevance?.score && searchResult.relevance.score > 0);
  });

  // --------------------------------------------------------------------------
  // 17. Sensitive-Field Exclusion
  // --------------------------------------------------------------------------
  test("17. sensitive field exclusion ensures no internal DB metadata or secrets leak", async () => {
    const { engine, scopeA } = createTestEngine();
    const query = new SearchQuery({ query: "EVALUATED" });
    const res = await engine.search(query, scopeA);

    const json = res.toJSON();
    assertSearchJsonSafe(json, "MatchSearchResultJSON");

    for (const result of json.results) {
      const keys = Object.keys(result);
      assert.strictEqual(keys.includes("ownerId"), false);
      assert.strictEqual(keys.includes("tenantId"), false);
      assert.strictEqual(keys.includes("password"), false);
      assert.strictEqual(keys.includes("token"), false);
      assert.strictEqual(keys.includes("apiKey"), false);
      assert.strictEqual(keys.includes("snapshots"), false);
    }
  });

  // --------------------------------------------------------------------------
  // 18. Malformed Query Handling
  // --------------------------------------------------------------------------
  test("18. malformed search queries fail safely with domain errors", () => {
    assert.throws(
      () => new SearchQuery({ query: "   " }),
      (err: unknown) => {
        assert(err instanceof SearchDomainError);
        assert.strictEqual(err.code, "INVALID_QUERY");
        return true;
      },
    );

    assert.throws(
      () => new SearchQuery({ query: "react", page: 0 }),
      (err: unknown) => {
        assert(err instanceof SearchDomainError);
        assert.strictEqual(err.code, "INVALID_PAGINATION");
        return true;
      },
    );
  });

  // --------------------------------------------------------------------------
  // 19. Bounded Query Behavior
  // --------------------------------------------------------------------------
  test("19. bounded query behavior enforces results count bounded by pageSize", async () => {
    const { engine, scopeA } = createTestEngine();
    const query = new SearchQuery({ query: "EVALUATED", page: 1, pageSize: 2 });
    const res = await engine.search(query, scopeA);

    assert.strictEqual(res.pageSize, 2);
    assert.strictEqual(res.count, 2);
    assert.strictEqual(res.total, 3);
    assert.strictEqual(res.totalPages, 2);
  });

  // --------------------------------------------------------------------------
  // 20. No N+1 Hydration
  // --------------------------------------------------------------------------
  test("20. repository interface enforces single bounded query without N+1 hydration", async () => {
    let callCount = 0;

    const singleCallRepo: MatchSearchRepository = {
      searchMatches: async (_q, _scope, page, pageSize): Promise<MatchSearchResultList> => {
        callCount++;
        return {
          items: [
            {
              id: "match-single-1",
              jobId: "job-1",
              freelancerId: "free-1",
              status: "EVALUATED",
              matchingVersion: "v1",
              createdAt: new Date(),
            },
          ],
          total: 1,
          page,
          pageSize,
        };
      },
    };

    const engine = new MatchSearchEngine(singleCallRepo);
    const scope = new AuthorizedSearchScope({ tenantId: "t-1", ownerId: "o-1" });
    const res = await engine.search(new SearchQuery({ query: "EVALUATED" }), scope);

    assert.strictEqual(callCount, 1);
    assert.strictEqual(res.count, 1);
  });

  // --------------------------------------------------------------------------
  // 21. Provider-Independent Execution
  // --------------------------------------------------------------------------
  test("21. provider-independent execution decouples domain from persistence engines", async () => {
    const customRepo: MatchSearchRepository = {
      searchMatches: async (_q, _scope, page, pageSize): Promise<MatchSearchResultList> => ({
        items: [
          {
            id: "match-custom-1",
            jobId: "job-custom-123",
            freelancerId: "free-custom-456",
            status: "CREATED",
            matchingVersion: "v1",
            createdAt: new Date("2026-08-18T10:00:00.000Z"),
          },
        ],
        total: 1,
        page,
        pageSize,
      }),
    };

    const engine = new MatchSearchEngine(customRepo);
    const scope = new AuthorizedSearchScope({ tenantId: "t-1", ownerId: "o-1" });
    const res = await engine.search(new SearchQuery({ query: "CREATED" }), scope);

    assert.strictEqual(res.count, 1);
    assert.strictEqual(res.results[0]?.resultType, "MATCH");
    assert.match(res.results[0]?.display.title ?? "", /Match for Job/);
  });

  // --------------------------------------------------------------------------
  // 22. resultType CLIENT Does Not Execute Match Search
  // --------------------------------------------------------------------------
  test("22. resultType CLIENT does not execute Match search", async () => {
    const { engine, scopeA } = createTestEngine();
    const query = new SearchQuery({ query: "EVALUATED", resultTypes: ["CLIENT"] });
    const res = await engine.search(query, scopeA);

    assert.strictEqual(res.count, 0);
    assert.strictEqual(res.total, 0);
    assert.deepStrictEqual(res.results, []);
  });

  // --------------------------------------------------------------------------
  // 23. resultType JOB Does Not Execute Match Search
  // --------------------------------------------------------------------------
  test("23. resultType JOB does not execute Match search", async () => {
    const { engine, scopeA } = createTestEngine();
    const query = new SearchQuery({ query: "EVALUATED", resultTypes: ["JOB"] });
    const res = await engine.search(query, scopeA);

    assert.strictEqual(res.count, 0);
    assert.strictEqual(res.total, 0);
    assert.deepStrictEqual(res.results, []);
  });

  // --------------------------------------------------------------------------
  // 24. resultType MATCH Executes Match Search
  // --------------------------------------------------------------------------
  test("24. resultType MATCH executes Match search", async () => {
    const { engine, scopeA } = createTestEngine();
    const query = new SearchQuery({ query: "EVALUATED", resultTypes: ["MATCH"] });
    const res = await engine.search(query, scopeA);

    assert.strictEqual(res.count, 3);
    assert.strictEqual(res.total, 3);
    assert.strictEqual(res.results[0]?.resultType, "MATCH");
  });
});
