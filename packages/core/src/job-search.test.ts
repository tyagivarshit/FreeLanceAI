import { test, describe } from "node:test";
import assert from "node:assert";
import {
  SearchQuery,
  AuthorizedSearchScope,
  SearchDomainError,
  assertSearchJsonSafe,
  JobSearchEngine,
  InMemoryJobSearchRepository,
  mapJobToSearchResult,
} from "./index.js";
import type { JobSearchRepository, JobSearchResultList, InMemoryJobRecord } from "./index.js";

describe("Phase 11D-3: Job Search Domain & Provider Tests", () => {
  // Test Data Fixtures
  const tenantA = "tenant-aaa-111";
  const ownerA = "owner-aaa-111";
  const tenantB = "tenant-bbb-222";
  const ownerB = "owner-bbb-222";

  const jobRecords: InMemoryJobRecord[] = [
    {
      id: "job-001",
      tenantId: tenantA,
      ownerId: ownerA,
      title: "Senior Full-Stack TypeScript Engineer",
      source: "upwork",
      status: "IMPORTED",
      description: "Build high-throughput distributed systems using Node.js and PostgreSQL.",
      skills: ["typescript", "nodejs", "postgresql", "react"],
      category: "Software Development",
      externalJobId: "upwork-1001",
      sourceUrl: "https://upwork.com/jobs/1001",
      clientId: "cli-001",
      createdAt: new Date("2026-08-10T10:00:00.000Z"),
    },
    {
      id: "job-002",
      tenantId: tenantA,
      ownerId: ownerA,
      title: "React Frontend Architect",
      source: "linkedin",
      status: "RECEIVED",
      description:
        "Design accessible and high performance UI components with Tailwind and Next.js.",
      skills: ["react", "nextjs", "tailwind", "typescript"],
      category: "Frontend Development",
      externalJobId: "linkedin-2002",
      sourceUrl: "https://linkedin.com/jobs/2002",
      createdAt: new Date("2026-08-12T12:00:00.000Z"),
    },
    {
      id: "job-003",
      tenantId: tenantA,
      ownerId: ownerA,
      title: "Python Machine Learning Lead",
      source: "freelancer",
      status: "IMPORTED",
      description: "Train and deploy specialized LLM fine-tuning pipelines.",
      skills: ["python", "pytorch", "transformers", "docker"],
      category: "AI & Data Science",
      externalJobId: "freelancer-3003",
      sourceUrl: "https://freelancer.com/jobs/3003",
      createdAt: new Date("2026-08-14T14:00:00.000Z"),
    },
    {
      id: "job-004",
      tenantId: tenantA,
      ownerId: ownerA,
      title: "Senior DevOps Infrastructure Engineer",
      source: "indeed",
      status: "ARCHIVED",
      description:
        "Manage multi-cloud Kubernetes clusters, Terraform modules, and Prometheus alerting.",
      skills: ["kubernetes", "terraform", "aws", "docker"],
      category: "DevOps & Cloud",
      externalJobId: "indeed-4004",
      sourceUrl: "https://indeed.com/jobs/4004",
      createdAt: new Date("2026-08-15T15:00:00.000Z"),
    },
    {
      id: "job-005",
      tenantId: tenantA,
      ownerId: ownerA,
      title: "Senior Backend Rust Developer",
      source: "toptal",
      status: "IMPORTED",
      description: "Develop low-latency messaging proxies and protocol converters in Rust.",
      skills: ["rust", "tokio", "grpc", "docker"],
      category: "Systems Engineering",
      externalJobId: "toptal-5005",
      sourceUrl: "https://toptal.com/jobs/5005",
      createdAt: new Date("2026-08-16T16:00:00.000Z"),
    },
    // Foreign tenant job
    {
      id: "job-foreign-001",
      tenantId: tenantB,
      ownerId: ownerB,
      title: "Senior Full-Stack TypeScript Engineer Foreign",
      source: "upwork",
      status: "IMPORTED",
      description: "Build foreign applications for Tenant B.",
      skills: ["typescript", "vue"],
      category: "Software Development",
      externalJobId: "upwork-foreign-999",
      sourceUrl: "https://upwork.com/jobs/foreign-999",
      createdAt: new Date("2026-08-16T18:00:00.000Z"),
    },
  ];

  function createTestEngine(records = jobRecords): {
    engine: JobSearchEngine;
    repo: InMemoryJobSearchRepository;
    scopeA: AuthorizedSearchScope;
    scopeB: AuthorizedSearchScope;
  } {
    const repo = new InMemoryJobSearchRepository(records);
    const engine = new JobSearchEngine(repo);
    const scopeA = new AuthorizedSearchScope({ tenantId: tenantA, ownerId: ownerA });
    const scopeB = new AuthorizedSearchScope({ tenantId: tenantB, ownerId: ownerB });
    return { engine, repo, scopeA, scopeB };
  }

  // --------------------------------------------------------------------------
  // 1. Exact Job Title Search
  // --------------------------------------------------------------------------
  test("1. exact job title search returns matched job with maximum relevance score", async () => {
    const { engine, scopeA } = createTestEngine();
    const query = new SearchQuery({ query: "Senior Full-Stack TypeScript Engineer" });
    const res = await engine.search(query, scopeA);

    assert.strictEqual(res.count, 1);
    assert.strictEqual(res.total, 1);
    const item = res.results[0]!;
    assert.strictEqual(item.entityId, "job-001");
    assert.strictEqual(item.display.title, "Senior Full-Stack TypeScript Engineer");
    assert.strictEqual(item.display.subtitle, "Upwork • IMPORTED");
    assert.strictEqual(item.relevance?.score, 1.0);
    assert.deepStrictEqual(item.relevance?.matchedFields, ["title"]);
  });

  // --------------------------------------------------------------------------
  // 2. Partial Job Title Search
  // --------------------------------------------------------------------------
  test("2. partial job title search returns all matching jobs", async () => {
    const { engine, scopeA } = createTestEngine();
    const query = new SearchQuery({ query: "Senior" });
    const res = await engine.search(query, scopeA);

    assert.strictEqual(res.count, 3);
    assert.strictEqual(res.total, 3);
    const ids = res.results.map((r) => r.entityId);
    assert.deepStrictEqual(ids, ["job-005", "job-004", "job-001"]);
  });

  // --------------------------------------------------------------------------
  // 3. Case-Insensitive Search
  // --------------------------------------------------------------------------
  test("3. case-insensitive search produces identical matches regardless of casing", async () => {
    const { engine, scopeA } = createTestEngine();
    const queryLower = new SearchQuery({ query: "architect" });
    const queryUpper = new SearchQuery({ query: "ARCHITECT" });
    const queryMixed = new SearchQuery({ query: "ArChItEcT" });

    const resLower = await engine.search(queryLower, scopeA);
    const resUpper = await engine.search(queryUpper, scopeA);
    const resMixed = await engine.search(queryMixed, scopeA);

    assert.strictEqual(resLower.count, 1);
    assert.strictEqual(resUpper.count, 1);
    assert.strictEqual(resMixed.count, 1);
    assert.strictEqual(resLower.results[0]?.entityId, "job-002");
    assert.strictEqual(resUpper.results[0]?.entityId, "job-002");
    assert.strictEqual(resMixed.results[0]?.entityId, "job-002");
  });

  // --------------------------------------------------------------------------
  // 4. Description Search
  // --------------------------------------------------------------------------
  test("4. description search matches relevant job details", async () => {
    const { engine, scopeA } = createTestEngine();
    const query = new SearchQuery({ query: "distributed systems" });
    const res = await engine.search(query, scopeA);

    assert.strictEqual(res.count, 1);
    assert.strictEqual(res.results[0]?.entityId, "job-001");
    assert(res.results[0]?.relevance?.matchedFields?.includes("description"));
  });

  // --------------------------------------------------------------------------
  // 5. Skill Search
  // --------------------------------------------------------------------------
  test("5. skill search matches jobs by required technical skill tag", async () => {
    const { engine, scopeA } = createTestEngine();
    const query = new SearchQuery({ query: "pytorch" });
    const res = await engine.search(query, scopeA);

    assert.strictEqual(res.count, 1);
    assert.strictEqual(res.results[0]?.entityId, "job-003");
    assert(res.results[0]?.relevance?.matchedFields?.includes("skills"));
  });

  // --------------------------------------------------------------------------
  // 6. Category / Source Search
  // --------------------------------------------------------------------------
  test("6. category and source platform search discovers matching jobs", async () => {
    const { engine, scopeA } = createTestEngine();
    // Source search
    const sourceQuery = new SearchQuery({ query: "linkedin" });
    const sourceRes = await engine.search(sourceQuery, scopeA);
    assert.strictEqual(sourceRes.count, 1);
    assert.strictEqual(sourceRes.results[0]?.entityId, "job-002");
    assert(sourceRes.results[0]?.relevance?.matchedFields?.includes("source"));

    // Category search
    const catQuery = new SearchQuery({ query: "Systems Engineering" });
    const catRes = await engine.search(catQuery, scopeA);
    assert.strictEqual(catRes.count, 1);
    assert.strictEqual(catRes.results[0]?.entityId, "job-005");
    assert(catRes.results[0]?.relevance?.matchedFields?.includes("category"));
  });

  // --------------------------------------------------------------------------
  // 7. No-Result Search
  // --------------------------------------------------------------------------
  test("7. no-result search returns safe, empty SearchResultSet", async () => {
    const { engine, scopeA } = createTestEngine();
    const query = new SearchQuery({ query: "NonExistentJobTermCobolMainframe999" });
    const res = await engine.search(query, scopeA);

    assert.strictEqual(res.count, 0);
    assert.strictEqual(res.total, 0);
    assert.strictEqual(res.totalPages, 0);
    assert.strictEqual(res.isEmpty, true);
    assert.deepStrictEqual(res.results, []);
  });

  // --------------------------------------------------------------------------
  // 8. Multiple Matching Jobs
  // --------------------------------------------------------------------------
  test("8. multiple matching jobs returned within total count", async () => {
    const { engine, scopeA } = createTestEngine();
    const query = new SearchQuery({ query: "docker" });
    const res = await engine.search(query, scopeA);

    assert.strictEqual(res.count, 3);
    assert.strictEqual(res.total, 3);
    const ids = res.results.map((r) => r.entityId);
    assert.deepStrictEqual(ids, ["job-005", "job-004", "job-003"]);
  });

  // --------------------------------------------------------------------------
  // 9. Pagination
  // --------------------------------------------------------------------------
  test("9. pagination slices results correctly across pages", async () => {
    const { engine, scopeA } = createTestEngine();
    const page1Query = new SearchQuery({ query: "docker", page: 1, pageSize: 2 });
    const page2Query = new SearchQuery({ query: "docker", page: 2, pageSize: 2 });

    const res1 = await engine.search(page1Query, scopeA);
    const res2 = await engine.search(page2Query, scopeA);

    assert.strictEqual(res1.total, 3);
    assert.strictEqual(res1.page, 1);
    assert.strictEqual(res1.pageSize, 2);
    assert.strictEqual(res1.totalPages, 2);
    assert.strictEqual(res1.count, 2);
    assert.strictEqual(res1.results[0]?.entityId, "job-005");
    assert.strictEqual(res1.results[1]?.entityId, "job-004");

    assert.strictEqual(res2.total, 3);
    assert.strictEqual(res2.page, 2);
    assert.strictEqual(res2.pageSize, 2);
    assert.strictEqual(res2.count, 1);
    assert.strictEqual(res2.results[0]?.entityId, "job-003");
  });

  // --------------------------------------------------------------------------
  // 10. Maximum PageSize = 100
  // --------------------------------------------------------------------------
  test("10. maximum pageSize = 100 enforced", () => {
    const query = new SearchQuery({ query: "engineer", pageSize: 100 });
    assert.strictEqual(query.pageSize, 100);

    assert.throws(
      () => new SearchQuery({ query: "engineer", pageSize: 101 }),
      (err: unknown) => {
        assert(err instanceof SearchDomainError);
        assert.strictEqual(err.code, "INVALID_PAGINATION");
        return true;
      },
    );
  });

  // --------------------------------------------------------------------------
  // 11. Deterministic Ordering
  // --------------------------------------------------------------------------
  test("11. deterministic ordering sorts strictly by recency (createdAt DESC, id DESC)", async () => {
    const { engine, scopeA } = createTestEngine();
    const query = new SearchQuery({ query: "engineer" });
    const res1 = await engine.search(query, scopeA);
    const res2 = await engine.search(query, scopeA);

    assert.deepStrictEqual(
      res1.results.map((r) => r.entityId),
      res2.results.map((r) => r.entityId),
    );
    // job-005 (Aug 16) before job-004 (Aug 15) before job-001 (Aug 10)
    assert.strictEqual(res1.results[0]?.entityId, "job-005");
    assert.strictEqual(res1.results[1]?.entityId, "job-004");
    assert.strictEqual(res1.results[2]?.entityId, "job-001");
  });

  // --------------------------------------------------------------------------
  // 12. Deterministic Relevance
  // --------------------------------------------------------------------------
  test("12. deterministic relevance score computes consistent weights", () => {
    const item: InMemoryJobRecord = {
      id: "job-rel-1",
      tenantId: tenantA,
      ownerId: ownerA,
      title: "Kubernetes Cloud Architect",
      source: "upwork",
      status: "IMPORTED",
      description: "Build robust cloud infrastructure.",
      skills: ["kubernetes", "aws"],
      createdAt: new Date(),
    };

    const exactMatch = mapJobToSearchResult(item, "Kubernetes Cloud Architect");
    assert.strictEqual(exactMatch.relevance?.score, 1.0);

    const partialMatch = mapJobToSearchResult(item, "Kubernetes");
    assert.strictEqual(partialMatch.relevance?.score, 0.9);

    const skillMatch = mapJobToSearchResult(item, "aws");
    assert.strictEqual(skillMatch.relevance?.score, 0.85);
  });

  // --------------------------------------------------------------------------
  // 13. Owner A Isolation
  // --------------------------------------------------------------------------
  test("13. Owner A isolation guarantees Owner A can only discover Owner A jobs", async () => {
    const { engine, scopeA } = createTestEngine();
    const query = new SearchQuery({ query: "TypeScript" });
    const res = await engine.search(query, scopeA);

    assert.strictEqual(res.total, 2);
    for (const result of res.results) {
      assert.notStrictEqual(result.entityId, "job-foreign-001");
    }
  });

  // --------------------------------------------------------------------------
  // 14. Owner B Isolation
  // --------------------------------------------------------------------------
  test("14. Owner B isolation guarantees Owner B can only discover Owner B jobs", async () => {
    const { engine, scopeB } = createTestEngine();
    const query = new SearchQuery({ query: "TypeScript" });
    const res = await engine.search(query, scopeB);

    assert.strictEqual(res.total, 1);
    assert.strictEqual(res.results[0]?.entityId, "job-foreign-001");
  });

  // --------------------------------------------------------------------------
  // 15. Cross-Tenant Isolation
  // --------------------------------------------------------------------------
  test("15. cross-tenant isolation prevents foreign job discovery", async () => {
    const { engine, scopeA } = createTestEngine();
    const query = new SearchQuery({ query: "upwork-foreign-999" });
    const res = await engine.search(query, scopeA);

    assert.strictEqual(res.total, 0);
    assert.strictEqual(res.count, 0);
  });

  // --------------------------------------------------------------------------
  // 16. Forged ownerId Rejection
  // --------------------------------------------------------------------------
  test("16. forged ownerId in search query payload is strictly rejected", () => {
    const forgedInput = {
      query: "engineer",
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
  // 17. Forged tenantId Rejection
  // --------------------------------------------------------------------------
  test("17. forged tenantId in search query payload is strictly rejected", () => {
    const forgedInput = {
      query: "engineer",
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
  // 18. Safe SearchResult Mapping
  // --------------------------------------------------------------------------
  test("18. safe SearchResult mapping formats canonical DTOs properly", () => {
    const item = {
      id: "job-dto-1",
      title: "Staff Security Architect",
      source: "upwork",
      status: "IMPORTED",
      description: "Lead zero-trust migration and enterprise threat models.",
      skills: ["security", "cloud"],
      createdAt: new Date(),
    };

    const searchResult = mapJobToSearchResult(item, "Security");

    assert.strictEqual(searchResult.resultType, "JOB");
    assert.strictEqual(searchResult.entityId, "job-dto-1");
    assert.strictEqual(searchResult.display.title, "Staff Security Architect");
    assert.strictEqual(searchResult.display.subtitle, "Upwork • IMPORTED");
    assert.strictEqual(
      searchResult.display.snippet,
      "Lead zero-trust migration and enterprise threat models.",
    );
    assert(searchResult.relevance?.score && searchResult.relevance.score > 0);
  });

  // --------------------------------------------------------------------------
  // 19. Sensitive Field Exclusion
  // --------------------------------------------------------------------------
  test("19. sensitive field exclusion ensures no internal database metadata or secrets leak", async () => {
    const { engine, scopeA } = createTestEngine();
    const query = new SearchQuery({ query: "TypeScript" });
    const res = await engine.search(query, scopeA);

    const json = res.toJSON();
    assertSearchJsonSafe(json, "JobSearchResultJSON");

    for (const result of json.results) {
      const keys = Object.keys(result);
      assert.strictEqual(keys.includes("ownerId"), false);
      assert.strictEqual(keys.includes("tenantId"), false);
      assert.strictEqual(keys.includes("password"), false);
      assert.strictEqual(keys.includes("token"), false);
      assert.strictEqual(keys.includes("apiKey"), false);
      assert.strictEqual(keys.includes("rawPayload"), false);
      assert.strictEqual(keys.includes("fingerprint"), false);
    }
  });

  // --------------------------------------------------------------------------
  // 20. Malformed Query Handling
  // --------------------------------------------------------------------------
  test("20. malformed search queries fail safely with domain errors", () => {
    assert.throws(
      () => new SearchQuery({ query: "" }),
      (err: unknown) => {
        assert(err instanceof SearchDomainError);
        assert.strictEqual(err.code, "INVALID_QUERY");
        return true;
      },
    );

    assert.throws(
      () => new SearchQuery({ query: "valid", pageSize: 0 }),
      (err: unknown) => {
        assert(err instanceof SearchDomainError);
        assert.strictEqual(err.code, "INVALID_PAGINATION");
        return true;
      },
    );
  });

  // --------------------------------------------------------------------------
  // 21. Bounded Query Behavior
  // --------------------------------------------------------------------------
  test("21. bounded query behavior enforces results count bounded by pageSize", async () => {
    const { engine, scopeA } = createTestEngine();
    const query = new SearchQuery({ query: "Senior", page: 1, pageSize: 2 });
    const res = await engine.search(query, scopeA);

    assert.strictEqual(res.pageSize, 2);
    assert.strictEqual(res.count, 2);
    assert.strictEqual(res.total, 3);
    assert.strictEqual(res.totalPages, 2);
  });

  // --------------------------------------------------------------------------
  // 22. No N+1 Behavior
  // --------------------------------------------------------------------------
  test("22. repository interface enforces single bounded execution without N+1 queries", async () => {
    let callCount = 0;

    const singleCallRepo: JobSearchRepository = {
      searchJobs: async (_q, _scope, page, pageSize): Promise<JobSearchResultList> => {
        callCount++;
        return {
          items: [
            {
              id: "job-single-1",
              title: "Single Call Job",
              source: "upwork",
              status: "IMPORTED",
              createdAt: new Date(),
            },
          ],
          total: 1,
          page,
          pageSize,
        };
      },
    };

    const engine = new JobSearchEngine(singleCallRepo);
    const scope = new AuthorizedSearchScope({ tenantId: "t-1", ownerId: "o-1" });
    const res = await engine.search(new SearchQuery({ query: "Single" }), scope);

    assert.strictEqual(callCount, 1);
    assert.strictEqual(res.count, 1);
  });

  // --------------------------------------------------------------------------
  // 23. Provider-Independent Execution
  // --------------------------------------------------------------------------
  test("23. provider-independent execution decouples domain from persistence engines", async () => {
    const customRepo: JobSearchRepository = {
      searchJobs: async (_q, _scope, page, pageSize): Promise<JobSearchResultList> => ({
        items: [
          {
            id: "job-custom-1",
            title: "Custom In-Memory Job",
            source: "toptal",
            status: "IMPORTED",
            createdAt: new Date("2026-08-18T10:00:00.000Z"),
          },
        ],
        total: 1,
        page,
        pageSize,
      }),
    };

    const engine = new JobSearchEngine(customRepo);
    const scope = new AuthorizedSearchScope({ tenantId: "t-1", ownerId: "o-1" });
    const res = await engine.search(new SearchQuery({ query: "Custom" }), scope);

    assert.strictEqual(res.count, 1);
    assert.strictEqual(res.results[0]?.resultType, "JOB");
    assert.strictEqual(res.results[0]?.display.title, "Custom In-Memory Job");
  });

  // --------------------------------------------------------------------------
  // 24. resultType CLIENT Must Not Execute Job Search
  // --------------------------------------------------------------------------
  test("24. resultType CLIENT must not execute Job search", async () => {
    const { engine, scopeA } = createTestEngine();
    const query = new SearchQuery({ query: "Senior", resultTypes: ["CLIENT"] });
    const res = await engine.search(query, scopeA);

    // Fast path bypass returns empty set immediately
    assert.strictEqual(res.count, 0);
    assert.strictEqual(res.total, 0);
    assert.deepStrictEqual(res.results, []);
  });

  // --------------------------------------------------------------------------
  // 25. resultType JOB Executes Job Search
  // --------------------------------------------------------------------------
  test("25. resultType JOB executes Job search", async () => {
    const { engine, scopeA } = createTestEngine();
    const query = new SearchQuery({ query: "Senior", resultTypes: ["JOB"] });
    const res = await engine.search(query, scopeA);

    assert.strictEqual(res.count, 3);
    assert.strictEqual(res.total, 3);
    assert.strictEqual(res.results[0]?.resultType, "JOB");
  });
});
