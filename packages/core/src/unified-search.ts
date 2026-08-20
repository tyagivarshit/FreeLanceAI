// ============================================================================
// FreelanceOS - Phase 11D-7 Unified Search Orchestration Implementation
// ============================================================================

import {
  AuthorizedSearchScope,
  SearchQuery,
  SearchResult,
  SearchResultSet,
  SearchResultType,
  SearchDomainError,
  MAX_SEARCH_PAGE_SIZE,
  type SearchEngine,
  type SearchProvider,
} from "./search.js";

// ----------------------------------------------------------------------------
// Options / Configuration
// ----------------------------------------------------------------------------

export interface UnifiedSearchEngineOptions {
  clientEngine?: SearchEngine | undefined;
  jobEngine?: SearchEngine | undefined;
  matchEngine?: SearchEngine | undefined;
  timelineEngine?: SearchEngine | undefined;
}

// ----------------------------------------------------------------------------
// Deterministic Cross-Type Sort Hierarchy
// ----------------------------------------------------------------------------

const TYPE_PRECEDENCE: Record<SearchResultType, number> = {
  CLIENT: 0,
  JOB: 1,
  MATCH: 2,
  TIMELINE: 3,
};

function compareSearchResults(a: SearchResult, b: SearchResult): number {
  // 1. Primary: relevance.score DESC
  const scoreA = a.relevance?.score ?? 0;
  const scoreB = b.relevance?.score ?? 0;
  if (scoreB !== scoreA) {
    return scoreB - scoreA;
  }

  // 2. Secondary: Canonical resultType precedence (CLIENT -> JOB -> MATCH -> TIMELINE)
  const typeA = TYPE_PRECEDENCE[a.resultType] ?? 99;
  const typeB = TYPE_PRECEDENCE[b.resultType] ?? 99;
  if (typeA !== typeB) {
    return typeA - typeB;
  }

  // 3. Tertiary: entityId DESC (stable tie-breaker)
  return b.entityId.localeCompare(a.entityId);
}

// ----------------------------------------------------------------------------
// Unified Search Engine (Composite Aggregator)
// ----------------------------------------------------------------------------

export class UnifiedSearchEngine implements SearchEngine, SearchProvider {
  private readonly _clientEngine?: SearchEngine | undefined;
  private readonly _jobEngine?: SearchEngine | undefined;
  private readonly _matchEngine?: SearchEngine | undefined;
  private readonly _timelineEngine?: SearchEngine | undefined;

  constructor(options: UnifiedSearchEngineOptions = {}) {
    this._clientEngine = options.clientEngine;
    this._jobEngine = options.jobEngine;
    this._matchEngine = options.matchEngine;
    this._timelineEngine = options.timelineEngine;
  }

  public async search(query: SearchQuery, scope: AuthorizedSearchScope): Promise<SearchResultSet> {
    if (!query || !(query instanceof SearchQuery)) {
      throw new SearchDomainError("INVALID_SEARCH_REQUEST", "Valid SearchQuery is required.");
    }
    if (!scope || !(scope instanceof AuthorizedSearchScope)) {
      throw new SearchDomainError("UNAUTHORIZED_SCOPE", "AuthorizedSearchScope is required.");
    }

    // 1. Determine active engines based on query.resultTypes
    const activeEngines: Array<{ type: SearchResultType; engine: SearchEngine }> = [];

    if (!query.hasTypeFilter() || query.includesType("CLIENT")) {
      if (this._clientEngine) {
        activeEngines.push({ type: "CLIENT", engine: this._clientEngine });
      }
    }
    if (!query.hasTypeFilter() || query.includesType("JOB")) {
      if (this._jobEngine) {
        activeEngines.push({ type: "JOB", engine: this._jobEngine });
      }
    }
    if (!query.hasTypeFilter() || query.includesType("MATCH")) {
      if (this._matchEngine) {
        activeEngines.push({ type: "MATCH", engine: this._matchEngine });
      }
    }
    if (!query.hasTypeFilter() || query.includesType("TIMELINE")) {
      if (this._timelineEngine) {
        activeEngines.push({ type: "TIMELINE", engine: this._timelineEngine });
      }
    }

    // If no matching configured engine is available
    if (activeEngines.length === 0) {
      return new SearchResultSet({
        results: [],
        total: 0,
        page: query.page,
        pageSize: query.pageSize,
      });
    }

    // 2. Single-Type Fast Path:
    // If exactly one type is requested and active, delegate directly using original query & pagination
    if (activeEngines.length === 1 && query.resultTypes && query.resultTypes.length === 1) {
      const singleEngine = activeEngines[0]!.engine;
      return singleEngine.search(query, scope);
    }

    // 3. Multi-Type Pagination & Search:
    const page = query.page;
    const pageSize = query.pageSize;
    const depth = Math.min(MAX_SEARCH_PAGE_SIZE, page * pageSize);

    try {
      // Execute active engines concurrently with bounded Promise.all (max 4 parallel operations)
      const enginePromises = activeEngines.map(async ({ type, engine }) => {
        const subQuery = new SearchQuery({
          query: query.query,
          page: 1,
          pageSize: depth,
          resultTypes: [type],
        });
        return engine.search(subQuery, scope);
      });

      const resultSets = await Promise.all(enginePromises);

      // 4. Calculate global total from active engines
      let globalTotal = 0;
      for (const rs of resultSets) {
        globalTotal += rs.total;
      }

      if (globalTotal === 0) {
        return new SearchResultSet({
          results: [],
          total: 0,
          page,
          pageSize,
        });
      }

      // 5. Deduplicate across collected results
      // Canonical composite key: resultType + ":" + entityId
      // If duplicate occurs, retain the one with highest relevance score
      const dedupMap = new Map<string, SearchResult>();

      for (const rs of resultSets) {
        for (const item of rs.results) {
          const compositeKey = `${item.resultType}:${item.entityId}`;
          const existing = dedupMap.get(compositeKey);
          if (!existing) {
            dedupMap.set(compositeKey, item);
          } else {
            const existingScore = existing.relevance?.score ?? 0;
            const newScore = item.relevance?.score ?? 0;
            if (newScore > existingScore) {
              dedupMap.set(compositeKey, item);
            }
          }
        }
      }

      const uniqueResults = Array.from(dedupMap.values());

      // 6. Deterministic global sorting
      uniqueResults.sort(compareSearchResults);

      // 7. Global window slicing
      const start = (page - 1) * pageSize;
      const end = start + pageSize;
      const slicedResults = start >= globalTotal ? [] : uniqueResults.slice(start, end);

      return new SearchResultSet({
        results: slicedResults,
        total: globalTotal,
        page,
        pageSize,
      });
    } catch (error: unknown) {
      if (error instanceof SearchDomainError) {
        throw error;
      }
      throw new SearchDomainError("SEARCH_PROVIDER_ERROR", "Unified search execution failed.");
    }
  }
}
