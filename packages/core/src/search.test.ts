import { test, describe } from "node:test";
import assert from "node:assert";
import {
  DEFAULT_SEARCH_PAGE,
  DEFAULT_SEARCH_PAGE_SIZE,
  MIN_SEARCH_PAGE_SIZE,
  MAX_SEARCH_PAGE_SIZE,
  MAX_SEARCH_QUERY_LENGTH,
  SUPPORTED_SEARCH_RESULT_TYPES,
  SearchDomainError,
  SearchFailure,
  defaultStatusCodeForSearchFailure,
  isRetryableSearchFailure,
  requireSearchReference,
  assertSearchJsonSafe,
  isSearchResultType,
  parseSearchResultType,
  AuthorizedSearchScope,
  SearchQuery,
  SearchResult,
  SearchResultSet,
} from "./search.js";
import type {
  SearchResultType,
  SearchProvider,
  SearchEngine,
  AuthorizedSearchScopeProperties,
  SearchQueryProperties,
  SearchResultProperties,
  SearchResultSetProperties,
} from "./search.js";

describe("Phase 11D-1: Search Architecture & Domain Contract Tests", () => {
  // --------------------------------------------------------------------------
  // 1. Valid SearchQuery
  // --------------------------------------------------------------------------
  test("1. valid SearchQuery creates successfully with defaults and explicit options", () => {
    const defaultQuery = new SearchQuery({ query: "Design System" });
    assert.strictEqual(defaultQuery.query, "Design System");
    assert.strictEqual(defaultQuery.page, DEFAULT_SEARCH_PAGE);
    assert.strictEqual(defaultQuery.pageSize, DEFAULT_SEARCH_PAGE_SIZE);
    assert.strictEqual(defaultQuery.resultTypes.length, 0);
    assert.strictEqual(defaultQuery.hasTypeFilter(), false);
    assert.strictEqual(defaultQuery.includesType("CLIENT"), true);
    assert.strictEqual(defaultQuery.includesType("JOB"), true);

    const explicitQueryProps: SearchQueryProperties = {
      query: "  Frontend Engineer  ",
      resultTypes: ["JOB", "MATCH"],
      page: 2,
      pageSize: 10,
    };
    const explicitQuery = new SearchQuery(explicitQueryProps);
    assert.strictEqual(explicitQuery.query, "Frontend Engineer"); // trimmed
    assert.strictEqual(explicitQuery.page, 2);
    assert.strictEqual(explicitQuery.pageSize, 10);
    assert.deepStrictEqual(explicitQuery.resultTypes, ["JOB", "MATCH"]);
    assert.strictEqual(explicitQuery.hasTypeFilter(), true);
    assert.strictEqual(explicitQuery.includesType("JOB"), true);
    assert.strictEqual(explicitQuery.includesType("MATCH"), true);
    assert.strictEqual(explicitQuery.includesType("CLIENT"), false);
    assert.strictEqual(explicitQuery.includesType("TIMELINE"), false);
  });

  // --------------------------------------------------------------------------
  // 2. Whitespace-Only Query Rejected
  // --------------------------------------------------------------------------
  test("2. whitespace-only and empty query rejected with INVALID_QUERY domain error", () => {
    assert.throws(
      () => new SearchQuery({ query: "" }),
      (err: unknown) => {
        assert(err instanceof SearchDomainError);
        assert.strictEqual(err.code, "INVALID_QUERY");
        assert.strictEqual(err.statusCode, 400);
        return true;
      },
    );

    assert.throws(
      () => new SearchQuery({ query: "   \t\n  " }),
      (err: unknown) => {
        assert(err instanceof SearchDomainError);
        assert.strictEqual(err.code, "INVALID_QUERY");
        return true;
      },
    );

    assert.throws(
      () => new SearchQuery({ query: null as unknown as string }),
      (err: unknown) => {
        assert(err instanceof SearchDomainError);
        assert.strictEqual(err.code, "INVALID_QUERY");
        return true;
      },
    );
  });

  // --------------------------------------------------------------------------
  // 3. Query Length Limit
  // --------------------------------------------------------------------------
  test("3. query length limit enforces maximum 500 characters", () => {
    const maxQueryText = "a".repeat(MAX_SEARCH_QUERY_LENGTH);
    const validQuery = new SearchQuery({ query: maxQueryText });
    assert.strictEqual(validQuery.query.length, 500);

    const excessiveQueryText = "a".repeat(MAX_SEARCH_QUERY_LENGTH + 1);
    assert.throws(
      () => new SearchQuery({ query: excessiveQueryText }),
      (err: unknown) => {
        assert(err instanceof SearchDomainError);
        assert.strictEqual(err.code, "INVALID_QUERY");
        assert.match(err.publicMessage, /exceeds maximum length of 500/);
        return true;
      },
    );
  });

  // --------------------------------------------------------------------------
  // 4. Invalid Page
  // --------------------------------------------------------------------------
  test("4. invalid page values (0, negative, float, NaN, non-number) rejected", () => {
    const invalidPages = [0, -1, -99, 1.5, NaN, Number.POSITIVE_INFINITY, "1" as unknown as number];

    for (const page of invalidPages) {
      assert.throws(
        () => new SearchQuery({ query: "valid", page }),
        (err: unknown) => {
          assert(err instanceof SearchDomainError);
          assert.strictEqual(err.code, "INVALID_PAGINATION");
          return true;
        },
      );
    }
  });

  // --------------------------------------------------------------------------
  // 5. Invalid PageSize
  // --------------------------------------------------------------------------
  test("5. invalid pageSize values (0, negative, float, NaN, non-number) rejected", () => {
    assert.strictEqual(MIN_SEARCH_PAGE_SIZE, 1);
    const invalidSizes = [
      0,
      -1,
      -50,
      2.5,
      NaN,
      Number.POSITIVE_INFINITY,
      "20" as unknown as number,
    ];

    for (const pageSize of invalidSizes) {
      assert.throws(
        () => new SearchQuery({ query: "valid", pageSize }),
        (err: unknown) => {
          assert(err instanceof SearchDomainError);
          assert.strictEqual(err.code, "INVALID_PAGINATION");
          return true;
        },
      );
    }
  });

  // --------------------------------------------------------------------------
  // 6. PageSize Maximum
  // --------------------------------------------------------------------------
  test("6. pageSize maximum of 100 enforced", () => {
    const maxPageSizeQuery = new SearchQuery({ query: "valid", pageSize: MAX_SEARCH_PAGE_SIZE });
    assert.strictEqual(maxPageSizeQuery.pageSize, 100);

    assert.throws(
      () => new SearchQuery({ query: "valid", pageSize: 101 }),
      (err: unknown) => {
        assert(err instanceof SearchDomainError);
        assert.strictEqual(err.code, "INVALID_PAGINATION");
        assert.match(err.publicMessage, /cannot exceed maximum of 100/);
        return true;
      },
    );

    assert.throws(
      () => new SearchQuery({ query: "valid", pageSize: 1000 }),
      (err: unknown) => {
        assert(err instanceof SearchDomainError);
        assert.strictEqual(err.code, "INVALID_PAGINATION");
        return true;
      },
    );
  });

  // --------------------------------------------------------------------------
  // 7. Unsupported Result Type
  // --------------------------------------------------------------------------
  test("7. unsupported result type rejected with UNSUPPORTED_RESULT_TYPE", () => {
    assert.deepStrictEqual(SUPPORTED_SEARCH_RESULT_TYPES, ["CLIENT", "JOB", "MATCH", "TIMELINE"]);

    assert.throws(
      () => new SearchQuery({ query: "valid", resultTypes: ["INVALID_TYPE" as SearchResultType] }),
      (err: unknown) => {
        assert(err instanceof SearchDomainError);
        assert.strictEqual(err.code, "UNSUPPORTED_RESULT_TYPE");
        return true;
      },
    );

    assert.throws(
      () => new SearchQuery({ query: "valid", resultTypes: ["USER" as SearchResultType] }),
      (err: unknown) => {
        assert(err instanceof SearchDomainError);
        assert.strictEqual(err.code, "UNSUPPORTED_RESULT_TYPE");
        return true;
      },
    );

    assert.strictEqual(isSearchResultType("CLIENT"), true);
    assert.strictEqual(isSearchResultType("JOB"), true);
    assert.strictEqual(isSearchResultType("MATCH"), true);
    assert.strictEqual(isSearchResultType("TIMELINE"), true);
    assert.strictEqual(isSearchResultType("UNKNOWN"), false);
    assert.strictEqual(parseSearchResultType("opportunity"), "MATCH");
  });

  // --------------------------------------------------------------------------
  // 8. Duplicate Result Type
  // --------------------------------------------------------------------------
  test("8. duplicate result types rejected with INVALID_SEARCH_REQUEST", () => {
    assert.throws(
      () => new SearchQuery({ query: "valid", resultTypes: ["CLIENT", "CLIENT"] }),
      (err: unknown) => {
        assert(err instanceof SearchDomainError);
        assert.strictEqual(err.code, "INVALID_SEARCH_REQUEST");
        assert.match(err.publicMessage, /Duplicate result type/);
        return true;
      },
    );

    assert.throws(
      () => new SearchQuery({ query: "valid", resultTypes: ["JOB", "MATCH", "JOB"] }),
      (err: unknown) => {
        assert(err instanceof SearchDomainError);
        assert.strictEqual(err.code, "INVALID_SEARCH_REQUEST");
        return true;
      },
    );
  });

  // --------------------------------------------------------------------------
  // 9. Unknown Fields
  // --------------------------------------------------------------------------
  test("9. unknown fields in SearchQuery payload are strictly rejected", () => {
    const forgedInput = {
      query: "Acme",
      ownerId: "attacker-id",
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

    assert.throws(
      () => SearchQuery.fromRaw({ query: "Acme", tenantId: "foreign-tenant" }),
      (err: unknown) => {
        assert(err instanceof SearchDomainError);
        assert.strictEqual(err.code, "INVALID_SEARCH_REQUEST");
        assert.match(err.publicMessage, /Unknown search query parameter: tenantId/);
        return true;
      },
    );

    assert.throws(
      () => SearchQuery.fromRaw({ query: "Acme", sqlInjection: "'; DROP TABLE clients; --" }),
      (err: unknown) => {
        assert(err instanceof SearchDomainError);
        assert.strictEqual(err.code, "INVALID_SEARCH_REQUEST");
        return true;
      },
    );
  });

  // --------------------------------------------------------------------------
  // 10. Valid SearchResult
  // --------------------------------------------------------------------------
  test("10. valid SearchResult creates successfully with minimal metadata and relevance", () => {
    const validProps: SearchResultProperties = {
      resultType: "CLIENT",
      entityId: "client-123",
      display: {
        title: "Acme International",
        subtitle: "Active Enterprise Client",
        snippet: "Key stakeholder in cloud migration",
      },
      relevance: {
        score: 0.98,
        matchedFields: ["name", "profile.description"],
      },
    };
    const result = new SearchResult(validProps);

    assert.strictEqual(result.resultType, "CLIENT");
    assert.strictEqual(result.entityId, "client-123");
    assert.strictEqual(result.display.title, "Acme International");
    assert.strictEqual(result.display.subtitle, "Active Enterprise Client");
    assert.strictEqual(result.display.snippet, "Key stakeholder in cloud migration");
    assert.strictEqual(result.relevance?.score, 0.98);
    assert.deepStrictEqual(result.relevance?.matchedFields, ["name", "profile.description"]);

    // Immutability check
    assert(Object.isFrozen(result));
    assert(Object.isFrozen(result.display));
    assert(Object.isFrozen(result.relevance));
  });

  // --------------------------------------------------------------------------
  // 11. Invalid SearchResult
  // --------------------------------------------------------------------------
  test("11. invalid SearchResult properties rejected", () => {
    // Missing/empty entityId
    assert.throws(
      () =>
        new SearchResult({
          resultType: "CLIENT",
          entityId: "",
          display: { title: "Valid Title" },
        }),
      (err: unknown) => {
        assert(err instanceof SearchDomainError);
        assert.strictEqual(err.code, "INVALID_SEARCH_REQUEST");
        return true;
      },
    );

    // Empty display title
    assert.throws(
      () =>
        new SearchResult({
          resultType: "CLIENT",
          entityId: "cli-1",
          display: { title: "   " },
        }),
      (err: unknown) => {
        assert(err instanceof SearchDomainError);
        assert.strictEqual(err.code, "INVALID_SEARCH_REQUEST");
        return true;
      },
    );

    // Negative relevance score
    assert.throws(
      () =>
        new SearchResult({
          resultType: "JOB",
          entityId: "job-1",
          display: { title: "Job Title" },
          relevance: { score: -0.5 },
        }),
      (err: unknown) => {
        assert(err instanceof SearchDomainError);
        assert.strictEqual(err.code, "INVALID_SEARCH_REQUEST");
        return true;
      },
    );

    // Unknown property on SearchResult
    assert.throws(
      () =>
        new SearchResult({
          resultType: "CLIENT",
          entityId: "cli-1",
          display: { title: "Valid Title" },
          rawDatabaseRow: { id: "cli-1", secret: "foo" } as unknown,
        } as SearchResultProperties),
      (err: unknown) => {
        assert(err instanceof SearchDomainError);
        assert.strictEqual(err.code, "INVALID_SEARCH_REQUEST");
        return true;
      },
    );
  });

  // --------------------------------------------------------------------------
  // 12. SearchResultSet Pagination
  // --------------------------------------------------------------------------
  test("12. SearchResultSet computes pagination and bounded boundaries correctly", () => {
    const item1 = new SearchResult({
      resultType: "CLIENT",
      entityId: "cli-1",
      display: { title: "Client 1" },
    });
    const item2 = new SearchResult({
      resultType: "CLIENT",
      entityId: "cli-2",
      display: { title: "Client 2" },
    });

    const setProps: SearchResultSetProperties = {
      results: [item1, item2],
      total: 55,
      page: 2,
      pageSize: 20,
    };
    const set = new SearchResultSet(setProps);

    assert.strictEqual(set.count, 2);
    assert.strictEqual(set.total, 55);
    assert.strictEqual(set.page, 2);
    assert.strictEqual(set.pageSize, 20);
    assert.strictEqual(set.totalPages, 3); // ceil(55 / 20)
    assert.strictEqual(set.isEmpty, false);

    // Empty set
    const emptySet = new SearchResultSet({
      results: [],
      total: 0,
      page: 1,
      pageSize: 20,
    });
    assert.strictEqual(emptySet.count, 0);
    assert.strictEqual(emptySet.total, 0);
    assert.strictEqual(emptySet.totalPages, 0);
    assert.strictEqual(emptySet.isEmpty, true);

    // Over-pageSize rejection
    assert.throws(
      () =>
        new SearchResultSet({
          results: [item1, item2],
          total: 2,
          page: 1,
          pageSize: 1, // results count 2 > pageSize 1
        }),
      (err: unknown) => {
        assert(err instanceof SearchDomainError);
        assert.strictEqual(err.code, "INVALID_PAGINATION");
        return true;
      },
    );
  });

  // --------------------------------------------------------------------------
  // 13. Deterministic Ordering Contract
  // --------------------------------------------------------------------------
  test("13. deterministic ordering contract preserves exact provider ranking and freezes results", () => {
    const itemA = new SearchResult({
      resultType: "JOB",
      entityId: "job-1",
      display: { title: "High Rank Job" },
      relevance: { score: 0.99 },
    });
    const itemB = new SearchResult({
      resultType: "JOB",
      entityId: "job-2",
      display: { title: "Medium Rank Job" },
      relevance: { score: 0.85 },
    });
    const itemC = new SearchResult({
      resultType: "JOB",
      entityId: "job-3",
      display: { title: "Low Rank Job" },
      relevance: { score: 0.42 },
    });

    const set = new SearchResultSet({
      results: [itemA, itemB, itemC],
      total: 3,
      page: 1,
      pageSize: 20,
    });

    assert.strictEqual(set.results[0]?.entityId, "job-1");
    assert.strictEqual(set.results[1]?.entityId, "job-2");
    assert.strictEqual(set.results[2]?.entityId, "job-3");

    // Immutability: array cannot be mutated externally
    assert(Object.isFrozen(set.results));
    assert.throws(() => {
      (set.results as SearchResult[]).push(itemA);
    });
  });

  // --------------------------------------------------------------------------
  // 14. Authorized Scope
  // --------------------------------------------------------------------------
  test("14. authorized scope validates tenantId, ownerId, and actorId", () => {
    const scopeProps: AuthorizedSearchScopeProperties = {
      tenantId: "tenant-primary",
      ownerId: "user-owner-1",
      actorId: "actor-session-42",
    };
    const scope = new AuthorizedSearchScope(scopeProps);

    assert.strictEqual(scope.tenantId, "tenant-primary");
    assert.strictEqual(scope.ownerId, "user-owner-1");
    assert.strictEqual(scope.actorId, "actor-session-42");
    assert.strictEqual(scope.matchesTenant("tenant-primary"), true);
    assert.strictEqual(scope.matchesTenant("tenant-other"), false);
    assert.strictEqual(scope.matchesOwner("user-owner-1"), true);
    assert.strictEqual(scope.matchesOwner("user-owner-2"), false);

    const sameScope = new AuthorizedSearchScope({
      tenantId: "tenant-primary",
      ownerId: "user-owner-1",
      actorId: "actor-session-42",
    });
    assert.strictEqual(scope.equals(sameScope), true);

    // Reference validation helper test
    assert.strictEqual(requireSearchReference("ref-123", "Reference"), "ref-123");
  });

  // --------------------------------------------------------------------------
  // 15. Missing Authorization Scope
  // --------------------------------------------------------------------------
  test("15. missing or invalid authorization scope rejected with UNAUTHORIZED_SCOPE", () => {
    assert.throws(
      () =>
        new AuthorizedSearchScope({
          tenantId: "",
          ownerId: "owner-1",
        }),
      (err: unknown) => {
        assert(err instanceof SearchDomainError);
        assert.strictEqual(err.code, "UNAUTHORIZED_SCOPE");
        assert.strictEqual(err.statusCode, 403);
        return true;
      },
    );

    assert.throws(
      () =>
        new AuthorizedSearchScope({
          tenantId: "tenant-1",
          ownerId: "   ",
        }),
      (err: unknown) => {
        assert(err instanceof SearchDomainError);
        assert.strictEqual(err.code, "UNAUTHORIZED_SCOPE");
        assert.strictEqual(err.statusCode, 403);
        return true;
      },
    );

    assert.throws(
      () =>
        new AuthorizedSearchScope({
          tenantId: "tenant with invalid spaces!",
          ownerId: "owner-1",
        }),
      (err: unknown) => {
        assert(err instanceof SearchDomainError);
        assert.strictEqual(err.code, "UNAUTHORIZED_SCOPE");
        return true;
      },
    );
  });

  // --------------------------------------------------------------------------
  // 16. Tenant Isolation Contract
  // --------------------------------------------------------------------------
  test("16. tenant isolation contract prevents caller tenant tampering and scope leakage", () => {
    // 1. SearchQuery explicitly excludes tenantId property
    const rawQueryWithTenant = {
      query: "Acme",
      tenantId: "foreign-tenant-xyz",
    };
    assert.throws(
      () => SearchQuery.fromRaw(rawQueryWithTenant),
      (err: unknown) => {
        assert(err instanceof SearchDomainError);
        assert.strictEqual(err.code, "INVALID_SEARCH_REQUEST");
        return true;
      },
    );

    // 2. AuthorizedSearchScope enforces tenant matching
    const authoritativeScope = new AuthorizedSearchScope({
      tenantId: "isolated-tenant-a",
      ownerId: "owner-a",
    });

    assert.strictEqual(authoritativeScope.matchesTenant("isolated-tenant-a"), true);
    assert.strictEqual(authoritativeScope.matchesTenant("isolated-tenant-b"), false);
  });

  // --------------------------------------------------------------------------
  // 17. Owner Isolation Contract
  // --------------------------------------------------------------------------
  test("17. owner isolation contract prevents foreign owner tampering", () => {
    const rawQueryWithOwner = {
      query: "Design project",
      ownerId: "foreign-user-hacker",
    };
    assert.throws(
      () => SearchQuery.fromRaw(rawQueryWithOwner),
      (err: unknown) => {
        assert(err instanceof SearchDomainError);
        assert.strictEqual(err.code, "INVALID_SEARCH_REQUEST");
        return true;
      },
    );

    const authoritativeScope = new AuthorizedSearchScope({
      tenantId: "tenant-a",
      ownerId: "legitimate-owner",
    });
    assert.strictEqual(authoritativeScope.matchesOwner("legitimate-owner"), true);
    assert.strictEqual(authoritativeScope.matchesOwner("foreign-user-hacker"), false);
  });

  // --------------------------------------------------------------------------
  // 18. JSON-Safe Serialization
  // --------------------------------------------------------------------------
  test("18. JSON-safe serialization generates valid DTOs and rejects non-serializable objects", () => {
    const query = new SearchQuery({
      query: "Next.js Architecture",
      resultTypes: ["CLIENT", "TIMELINE"],
      page: 1,
      pageSize: 20,
    });
    const queryJson = query.toJSON();
    assert.deepStrictEqual(JSON.parse(JSON.stringify(queryJson)), queryJson);

    const result = new SearchResult({
      resultType: "TIMELINE",
      entityId: "timeline-entry-1",
      display: {
        title: "Contract Signed",
        subtitle: "Enterprise Tier",
        snippet: "Client signed annual agreement",
      },
      relevance: { score: 1.0 },
    });
    const resultJson = result.toJSON();
    assert.deepStrictEqual(JSON.parse(JSON.stringify(resultJson)), resultJson);

    const resultSet = new SearchResultSet({
      results: [result],
      total: 1,
      page: 1,
      pageSize: 20,
    });
    const setJson = resultSet.toJSON();
    assert.deepStrictEqual(JSON.parse(JSON.stringify(setJson)), setJson);

    // Rejects functions
    assert.throws(
      () => assertSearchJsonSafe({ func: () => "evil" }, "testPayload"),
      (err: unknown) => {
        assert(err instanceof SearchDomainError);
        assert.strictEqual(err.code, "INVALID_SEARCH_REQUEST");
        return true;
      },
    );

    // Rejects symbols
    assert.throws(
      () => assertSearchJsonSafe({ sym: Symbol("secret") }, "testPayload"),
      (err: unknown) => {
        assert(err instanceof SearchDomainError);
        assert.strictEqual(err.code, "INVALID_SEARCH_REQUEST");
        return true;
      },
    );

    // Rejects BigInt
    assert.throws(
      () => assertSearchJsonSafe({ count: BigInt(123) }, "testPayload"),
      (err: unknown) => {
        assert(err instanceof SearchDomainError);
        assert.strictEqual(err.code, "INVALID_SEARCH_REQUEST");
        return true;
      },
    );
  });

  // --------------------------------------------------------------------------
  // 19. Secret Exclusion Boundary
  // --------------------------------------------------------------------------
  test("19. secret exclusion boundary rejects secret keys and tokens in search payloads", () => {
    const secretKeys = [
      "password",
      "user_password",
      "apiKey",
      "api_key",
      "stripeSecret",
      "token",
      "auth_token",
      "bearerToken",
      "cookie",
      "credential",
    ];

    for (const secretKey of secretKeys) {
      assert.throws(
        () => assertSearchJsonSafe({ [secretKey]: "super-confidential-value" }, "SecretCheck"),
        (err: unknown) => {
          assert(err instanceof SearchDomainError);
          assert.strictEqual(err.code, "INVALID_SEARCH_REQUEST");
          assert.match(err.publicMessage, /must not contain secret fields/);
          return true;
        },
      );
    }
  });

  // --------------------------------------------------------------------------
  // 20. Provider-Independent Interface
  // --------------------------------------------------------------------------
  test("20. provider-independent interface can be implemented and executed in pure domain context", async () => {
    // Pure in-memory mock search provider implementing the SearchProvider contract
    class MockSearchProvider implements SearchProvider, SearchEngine {
      private readonly _records: Array<{
        tenantId: string;
        ownerId: string;
        resultType: SearchResultType;
        entityId: string;
        title: string;
        subtitle: string;
        snippet: string;
        keywords: string[];
      }> = [
        {
          tenantId: "tenant-100",
          ownerId: "owner-100",
          resultType: "CLIENT",
          entityId: "client-101",
          title: "Stripe Integrations Ltd",
          subtitle: "Enterprise",
          snippet: "Payment processor integration project",
          keywords: ["stripe", "payment", "integration"],
        },
        {
          tenantId: "tenant-100",
          ownerId: "owner-100",
          resultType: "JOB",
          entityId: "job-201",
          title: "Senior TypeScript Architect",
          subtitle: "Contract",
          snippet: "Lead backend architecture for payment flow",
          keywords: ["typescript", "architect", "payment"],
        },
        {
          tenantId: "tenant-foreign",
          ownerId: "owner-foreign",
          resultType: "CLIENT",
          entityId: "client-secret",
          title: "Foreign Tenant Private Record",
          subtitle: "Confidential",
          snippet: "Should never be visible",
          keywords: ["stripe", "payment"],
        },
      ];

      public async search(
        query: SearchQuery,
        scope: AuthorizedSearchScope,
      ): Promise<SearchResultSet> {
        // Enforce tenant and owner isolation authoritative boundary
        const scopedRecords = this._records.filter(
          (r) => scope.matchesTenant(r.tenantId) && scope.matchesOwner(r.ownerId),
        );

        // Filter by result types if query specifies filters
        const typeFiltered = query.hasTypeFilter()
          ? scopedRecords.filter((r) => query.includesType(r.resultType))
          : scopedRecords;

        // Perform keyword matching
        const q = query.query.toLowerCase();
        const matched = typeFiltered.filter(
          (r) =>
            r.title.toLowerCase().includes(q) ||
            r.snippet.toLowerCase().includes(q) ||
            r.keywords.some((k) => k.includes(q)),
        );

        // Map to canonical SearchResult items
        const results = matched.map(
          (r) =>
            new SearchResult({
              resultType: r.resultType,
              entityId: r.entityId,
              display: {
                title: r.title,
                subtitle: r.subtitle,
                snippet: r.snippet,
              },
              relevance: { score: 1.0 },
            }),
        );

        return new SearchResultSet({
          results,
          total: results.length,
          page: query.page,
          pageSize: query.pageSize,
        });
      }
    }

    const provider: SearchProvider = new MockSearchProvider();
    const authorizedScope = new AuthorizedSearchScope({
      tenantId: "tenant-100",
      ownerId: "owner-100",
    });

    // 1. Multi-type search
    const query1 = new SearchQuery({ query: "payment" });
    const res1 = await provider.search(query1, authorizedScope);

    assert.strictEqual(res1.count, 2);
    assert.strictEqual(res1.total, 2);
    assert.strictEqual(res1.results[0]?.entityId, "client-101");
    assert.strictEqual(res1.results[1]?.entityId, "job-201");
    // Verify foreign tenant record was never returned
    assert.strictEqual(
      res1.results.some((r) => r.entityId === "client-secret"),
      false,
    );

    // 2. Type-filtered search
    const query2 = new SearchQuery({
      query: "payment",
      resultTypes: ["JOB"],
    });
    const res2 = await provider.search(query2, authorizedScope);

    assert.strictEqual(res2.count, 1);
    assert.strictEqual(res2.results[0]?.entityId, "job-201");
    assert.strictEqual(res2.results[0]?.resultType, "JOB");
  });

  // --------------------------------------------------------------------------
  // Additional Edge Cases & Error Contract Tests
  // --------------------------------------------------------------------------
  test("Error contract and SearchFailure mapping verify safe domain error structures", () => {
    const err = new SearchDomainError("INVALID_QUERY", "Custom invalid query message", 400);
    assert.strictEqual(err.code, "INVALID_QUERY");
    assert.strictEqual(err.publicMessage, "Custom invalid query message");
    assert.strictEqual(err.statusCode, 400);

    const failure = err.toFailure();
    assert(failure instanceof SearchFailure);
    assert.strictEqual(failure.code, "INVALID_QUERY");
    assert.strictEqual(failure.message, "Custom invalid query message");
    assert.strictEqual(failure.retryable, false);
    assert.deepStrictEqual(failure.toJSON(), {
      code: "INVALID_QUERY",
      message: "Custom invalid query message",
      retryable: false,
    });

    assert.strictEqual(defaultStatusCodeForSearchFailure("UNAUTHORIZED_SCOPE"), 403);
    assert.strictEqual(defaultStatusCodeForSearchFailure("SEARCH_PROVIDER_ERROR"), 500);
    assert.strictEqual(isRetryableSearchFailure("SEARCH_PROVIDER_ERROR"), true);
    assert.strictEqual(isRetryableSearchFailure("INVALID_QUERY"), false);
  });
});
