import { test, describe } from "node:test";
import assert from "node:assert";
import {
  SearchQuery,
  AuthorizedSearchScope,
  SearchDomainError,
  assertSearchJsonSafe,
  ClientSearchEngine,
  InMemoryClientSearchRepository,
  mapClientToSearchResult,
} from "./index.js";
import type {
  ClientSearchRepository,
  ClientSearchResultList,
  InMemoryClientRecord,
} from "./index.js";

describe("Phase 11D-2: Client Search Domain & Provider Tests", () => {
  // Test Data Fixtures
  const tenantA = "tenant-aaa-111";
  const ownerA = "owner-aaa-111";
  const tenantB = "tenant-bbb-222";
  const ownerB = "owner-bbb-222";

  const clientRecords: InMemoryClientRecord[] = [
    {
      id: "cli-001",
      tenantId: tenantA,
      ownerId: ownerA,
      name: "Acme Corporation",
      status: "Active",
      email: "contact@acme.com",
      website: "https://acme.com",
      firstName: "Alice",
      lastName: "Smith",
      phone: "+1-555-0101",
      createdAt: new Date("2026-08-10T10:00:00.000Z"),
    },
    {
      id: "cli-002",
      tenantId: tenantA,
      ownerId: ownerA,
      name: "Acme Technologies LLC",
      status: "Lead",
      email: "support@acmetech.io",
      website: "https://acmetech.io",
      firstName: "Bob",
      lastName: "Jones",
      phone: "+1-555-0102",
      createdAt: new Date("2026-08-12T12:00:00.000Z"),
    },
    {
      id: "cli-003",
      tenantId: tenantA,
      ownerId: ownerA,
      name: "Stripe Integrations Group",
      status: "Active",
      email: "payments@stripe-partner.com",
      website: "https://stripe-partner.com",
      firstName: "Carol",
      lastName: "White",
      phone: "+1-555-0103",
      createdAt: new Date("2026-08-14T14:00:00.000Z"),
    },
    {
      id: "cli-004",
      tenantId: tenantA,
      ownerId: ownerA,
      name: "Beta Global Solutions",
      status: "Suspended",
      email: "info@betaglobal.com",
      website: "https://betaglobal.org",
      firstName: "David",
      lastName: "Brown",
      phone: "+1-555-0104",
      createdAt: new Date("2026-08-15T15:00:00.000Z"),
    },
    {
      id: "cli-005",
      tenantId: tenantA,
      ownerId: ownerA,
      name: "Beta Dynamics",
      status: "Lead",
      email: "hello@betadynamics.com",
      website: "https://betadynamics.com",
      firstName: "Eve",
      lastName: "Davis",
      phone: "+1-555-0105",
      createdAt: new Date("2026-08-16T16:00:00.000Z"),
    },
    // Foreign tenant client
    {
      id: "cli-foreign-001",
      tenantId: tenantB,
      ownerId: ownerB,
      name: "Acme Foreign Subsidiary",
      status: "Active",
      email: "contact@acme.foreign.com",
      website: "https://acme-foreign.com",
      firstName: "Frank",
      lastName: "Foreigner",
      phone: "+1-555-9999",
      createdAt: new Date("2026-08-16T18:00:00.000Z"),
    },
  ];

  function createTestEngine(records = clientRecords): {
    engine: ClientSearchEngine;
    repo: InMemoryClientSearchRepository;
    scopeA: AuthorizedSearchScope;
    scopeB: AuthorizedSearchScope;
  } {
    const repo = new InMemoryClientSearchRepository(records);
    const engine = new ClientSearchEngine(repo);
    const scopeA = new AuthorizedSearchScope({ tenantId: tenantA, ownerId: ownerA });
    const scopeB = new AuthorizedSearchScope({ tenantId: tenantB, ownerId: ownerB });
    return { engine, repo, scopeA, scopeB };
  }

  // --------------------------------------------------------------------------
  // 1. Exact Client-Name Search
  // --------------------------------------------------------------------------
  test("1. exact client-name search returns matched client with maximum relevance", async () => {
    const { engine, scopeA } = createTestEngine();
    const query = new SearchQuery({ query: "Acme Corporation" });
    const res = await engine.search(query, scopeA);

    assert.strictEqual(res.count, 1);
    assert.strictEqual(res.total, 1);
    const item = res.results[0]!;
    assert.strictEqual(item.entityId, "cli-001");
    assert.strictEqual(item.display.title, "Acme Corporation");
    assert.strictEqual(item.display.subtitle, "Active");
    assert.strictEqual(item.relevance?.score, 1.0);
    assert.deepStrictEqual(item.relevance?.matchedFields, ["name"]);
  });

  // --------------------------------------------------------------------------
  // 2. Partial Client-Name Search
  // --------------------------------------------------------------------------
  test("2. partial client-name search returns all matching clients", async () => {
    const { engine, scopeA } = createTestEngine();
    const query = new SearchQuery({ query: "Acme" });
    const res = await engine.search(query, scopeA);

    assert.strictEqual(res.count, 2);
    assert.strictEqual(res.total, 2);
    const names = res.results.map((r) => r.display.title);
    assert.deepStrictEqual(names, ["Acme Technologies LLC", "Acme Corporation"]);
  });

  // --------------------------------------------------------------------------
  // 3. Case-Insensitive Search
  // --------------------------------------------------------------------------
  test("3. case-insensitive search produces identical matches regardless of casing", async () => {
    const { engine, scopeA } = createTestEngine();
    const queryLower = new SearchQuery({ query: "stripe" });
    const queryUpper = new SearchQuery({ query: "STRIPE" });
    const queryMixed = new SearchQuery({ query: "StRiPe" });

    const resLower = await engine.search(queryLower, scopeA);
    const resUpper = await engine.search(queryUpper, scopeA);
    const resMixed = await engine.search(queryMixed, scopeA);

    assert.strictEqual(resLower.count, 1);
    assert.strictEqual(resUpper.count, 1);
    assert.strictEqual(resMixed.count, 1);
    assert.strictEqual(resLower.results[0]?.entityId, "cli-003");
    assert.strictEqual(resUpper.results[0]?.entityId, "cli-003");
    assert.strictEqual(resMixed.results[0]?.entityId, "cli-003");
  });

  // --------------------------------------------------------------------------
  // 4. Email Search
  // --------------------------------------------------------------------------
  test("4. primary contact email search discovers client safely", async () => {
    const { engine, scopeA } = createTestEngine();
    const query = new SearchQuery({ query: "support@acmetech.io" });
    const res = await engine.search(query, scopeA);

    assert.strictEqual(res.count, 1);
    assert.strictEqual(res.results[0]?.entityId, "cli-002");
    assert.strictEqual(res.results[0]?.display.snippet, "Contact: support@acmetech.io");
    assert(res.results[0]?.relevance?.matchedFields?.includes("email"));
  });

  // --------------------------------------------------------------------------
  // 5. Website Search
  // --------------------------------------------------------------------------
  test("5. client website search matches domain url correctly", async () => {
    const { engine, scopeA } = createTestEngine();
    const query = new SearchQuery({ query: "betaglobal.org" });
    const res = await engine.search(query, scopeA);

    assert.strictEqual(res.count, 1);
    assert.strictEqual(res.results[0]?.entityId, "cli-004");
    assert(res.results[0]?.relevance?.matchedFields?.includes("website"));
  });

  // --------------------------------------------------------------------------
  // 6. No-Result Search
  // --------------------------------------------------------------------------
  test("6. no-result search returns safe, empty SearchResultSet", async () => {
    const { engine, scopeA } = createTestEngine();
    const query = new SearchQuery({ query: "NonExistentClientIdentifier999" });
    const res = await engine.search(query, scopeA);

    assert.strictEqual(res.count, 0);
    assert.strictEqual(res.total, 0);
    assert.strictEqual(res.totalPages, 0);
    assert.strictEqual(res.isEmpty, true);
    assert.deepStrictEqual(res.results, []);
  });

  // --------------------------------------------------------------------------
  // 7. Multiple Matching Clients
  // --------------------------------------------------------------------------
  test("7. multiple matching clients are returned within total count", async () => {
    const { engine, scopeA } = createTestEngine();
    const query = new SearchQuery({ query: "Beta" });
    const res = await engine.search(query, scopeA);

    assert.strictEqual(res.count, 2);
    assert.strictEqual(res.total, 2);
    const ids = res.results.map((r) => r.entityId);
    assert.deepStrictEqual(ids, ["cli-005", "cli-004"]);
  });

  // --------------------------------------------------------------------------
  // 8. Pagination
  // --------------------------------------------------------------------------
  test("8. pagination slices results correctly across pages", async () => {
    const { engine, scopeA } = createTestEngine();
    // Query matching all Beta & Acme (4 items)
    const page1Query = new SearchQuery({ query: "beta", page: 1, pageSize: 1 });
    const page2Query = new SearchQuery({ query: "beta", page: 2, pageSize: 1 });

    const res1 = await engine.search(page1Query, scopeA);
    const res2 = await engine.search(page2Query, scopeA);

    assert.strictEqual(res1.total, 2);
    assert.strictEqual(res1.page, 1);
    assert.strictEqual(res1.pageSize, 1);
    assert.strictEqual(res1.totalPages, 2);
    assert.strictEqual(res1.count, 1);
    assert.strictEqual(res1.results[0]?.entityId, "cli-005");

    assert.strictEqual(res2.total, 2);
    assert.strictEqual(res2.page, 2);
    assert.strictEqual(res2.pageSize, 1);
    assert.strictEqual(res2.count, 1);
    assert.strictEqual(res2.results[0]?.entityId, "cli-004");
  });

  // --------------------------------------------------------------------------
  // 9. PageSize Bound
  // --------------------------------------------------------------------------
  test("9. pageSize maximum bound of 100 enforced", async () => {
    const query = new SearchQuery({ query: "Acme", pageSize: 100 });
    assert.strictEqual(query.pageSize, 100);

    assert.throws(
      () => new SearchQuery({ query: "Acme", pageSize: 101 }),
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
  test("10. deterministic ordering sorts strictly by recency (createdAt DESC, id DESC)", async () => {
    const { engine, scopeA } = createTestEngine();
    const query = new SearchQuery({ query: "Acme" });
    const res1 = await engine.search(query, scopeA);
    const res2 = await engine.search(query, scopeA);

    // Identical query + dataset produces identical ordering
    assert.deepStrictEqual(
      res1.results.map((r) => r.entityId),
      res2.results.map((r) => r.entityId),
    );
    // cli-002 (Aug 12) was created after cli-001 (Aug 10)
    assert.strictEqual(res1.results[0]?.entityId, "cli-002");
    assert.strictEqual(res1.results[1]?.entityId, "cli-001");
  });

  // --------------------------------------------------------------------------
  // 11. Owner A Isolation
  // --------------------------------------------------------------------------
  test("11. Owner A isolation guarantees Owner A can only discover Owner A clients", async () => {
    const { engine, scopeA } = createTestEngine();
    const query = new SearchQuery({ query: "Acme" });
    const res = await engine.search(query, scopeA);

    assert.strictEqual(res.total, 2);
    for (const result of res.results) {
      assert.notStrictEqual(result.entityId, "cli-foreign-001");
    }
  });

  // --------------------------------------------------------------------------
  // 12. Owner B Isolation
  // --------------------------------------------------------------------------
  test("12. Owner B isolation guarantees Owner B can only discover Owner B clients", async () => {
    const { engine, scopeB } = createTestEngine();
    const query = new SearchQuery({ query: "Acme" });
    const res = await engine.search(query, scopeB);

    assert.strictEqual(res.total, 1);
    assert.strictEqual(res.results[0]?.entityId, "cli-foreign-001");
    assert.strictEqual(res.results[0]?.display.title, "Acme Foreign Subsidiary");
  });

  // --------------------------------------------------------------------------
  // 13. Cross-Tenant Isolation
  // --------------------------------------------------------------------------
  test("13. cross-tenant isolation prevents tenant scope leakage", async () => {
    const { engine, scopeA } = createTestEngine();
    // Search query specifically targeting the foreign client's unique email domain
    const query = new SearchQuery({ query: "acme.foreign.com" });
    const res = await engine.search(query, scopeA);

    // Must return 0 results under Scope A
    assert.strictEqual(res.total, 0);
    assert.strictEqual(res.count, 0);
  });

  // --------------------------------------------------------------------------
  // 14. Forged ownerId Attempt
  // --------------------------------------------------------------------------
  test("14. forged ownerId in search query payload is strictly rejected", () => {
    const forgedInput = {
      query: "Acme",
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
  // 15. Forged tenantId Attempt
  // --------------------------------------------------------------------------
  test("15. forged tenantId in search query payload is strictly rejected", () => {
    const forgedInput = {
      query: "Acme",
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
      id: "cli-test-99",
      name: "Nebula Labs",
      status: "Active",
      email: "ceo@nebulalabs.io",
      website: "https://nebulalabs.io",
      createdAt: new Date(),
    };

    const searchResult = mapClientToSearchResult(item, "Nebula");

    assert.strictEqual(searchResult.resultType, "CLIENT");
    assert.strictEqual(searchResult.entityId, "cli-test-99");
    assert.strictEqual(searchResult.display.title, "Nebula Labs");
    assert.strictEqual(searchResult.display.subtitle, "Active");
    assert.strictEqual(searchResult.display.snippet, "Contact: ceo@nebulalabs.io");
    assert(searchResult.relevance?.score && searchResult.relevance.score > 0);
  });

  // --------------------------------------------------------------------------
  // 17. Sensitive Field Exclusion
  // --------------------------------------------------------------------------
  test("17. sensitive field exclusion ensures no internal database metadata or secrets leak", async () => {
    const { engine, scopeA } = createTestEngine();
    const query = new SearchQuery({ query: "Acme" });
    const res = await engine.search(query, scopeA);

    const json = res.toJSON();
    assertSearchJsonSafe(json, "ClientSearchResultJSON");

    for (const result of json.results) {
      const keys = Object.keys(result);
      assert.strictEqual(keys.includes("ownerId"), false);
      assert.strictEqual(keys.includes("tenantId"), false);
      assert.strictEqual(keys.includes("password"), false);
      assert.strictEqual(keys.includes("token"), false);
      assert.strictEqual(keys.includes("stripeSecret"), false);
      assert.strictEqual(keys.includes("billingDetails"), false);
    }
  });

  // --------------------------------------------------------------------------
  // 18. Malformed Query
  // --------------------------------------------------------------------------
  test("18. malformed search queries fail safely with domain errors", async () => {
    assert.throws(
      () => new SearchQuery({ query: "   " }),
      (err: unknown) => {
        assert(err instanceof SearchDomainError);
        assert.strictEqual(err.code, "INVALID_QUERY");
        return true;
      },
    );

    assert.throws(
      () => new SearchQuery({ query: "valid", page: -1 }),
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
    const query = new SearchQuery({ query: "Acme", page: 1, pageSize: 1 });
    const res = await engine.search(query, scopeA);

    assert.strictEqual(res.pageSize, 1);
    assert.strictEqual(res.count, 1);
    assert.strictEqual(res.total, 2);
    assert.strictEqual(res.totalPages, 2);
  });

  // --------------------------------------------------------------------------
  // 20. No Full-Dataset Client-Side Filtering
  // --------------------------------------------------------------------------
  test("20. repository interface enforces query-level pagination without full-dataset loading", async () => {
    let capturedPage = -1;
    let capturedPageSize = -1;

    const mockRepo: ClientSearchRepository = {
      searchClients: async (_q, _scope, page, pageSize): Promise<ClientSearchResultList> => {
        capturedPage = page;
        capturedPageSize = pageSize;
        return {
          items: [
            {
              id: "cli-mock-1",
              name: "Mock Client",
              status: "Active",
              createdAt: new Date(),
            },
          ],
          total: 100,
          page,
          pageSize,
        };
      },
    };

    const engine = new ClientSearchEngine(mockRepo);
    const scope = new AuthorizedSearchScope({ tenantId: "t-1", ownerId: "o-1" });
    const query = new SearchQuery({ query: "Mock", page: 3, pageSize: 15 });

    const res = await engine.search(query, scope);

    assert.strictEqual(capturedPage, 3);
    assert.strictEqual(capturedPageSize, 15);
    assert.strictEqual(res.page, 3);
    assert.strictEqual(res.pageSize, 15);
    assert.strictEqual(res.total, 100);
    assert.strictEqual(res.totalPages, 7);
  });

  // --------------------------------------------------------------------------
  // 21. Provider-Independent Execution & Type Filter Bypass
  // --------------------------------------------------------------------------
  test("21. provider-independent execution and resultTypes filter bypass", async () => {
    const { engine, scopeA } = createTestEngine();

    // 1. Query explicitly searching for "CLIENT"
    const clientQuery = new SearchQuery({ query: "Acme", resultTypes: ["CLIENT"] });
    const clientRes = await engine.search(clientQuery, scopeA);
    assert.strictEqual(clientRes.count, 2);

    // 2. Query filtering for "JOB" (should bypass client repo and return empty)
    const jobQuery = new SearchQuery({ query: "Acme", resultTypes: ["JOB"] });
    const jobRes = await engine.search(jobQuery, scopeA);
    assert.strictEqual(jobRes.count, 0);
    assert.strictEqual(jobRes.total, 0);
  });
});
