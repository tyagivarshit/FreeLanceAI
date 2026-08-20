// ============================================================================
// FreelanceOS - Phase 11D-4 Match Search Domain Implementation
// ============================================================================

import {
  AuthorizedSearchScope,
  SearchQuery,
  SearchResult,
  SearchResultSet,
  SearchDomainError,
  DEFAULT_SEARCH_PAGE,
  DEFAULT_SEARCH_PAGE_SIZE,
  MAX_SEARCH_PAGE_SIZE,
  type SearchEngine,
  type SearchProvider,
} from "./search.js";

// ----------------------------------------------------------------------------
// Match Search Repository Contracts (Ports)
// ----------------------------------------------------------------------------

export interface MatchSearchResultItem {
  id: string;
  jobId: string;
  freelancerId: string;
  status: string;
  matchingVersion: string;
  normalizationVersion?: string | undefined;
  jobNormalizationId?: string | undefined;
  matchedSkills?: readonly string[] | undefined;
  missingSkills?: readonly string[] | undefined;
  skillCoverage?: number | undefined;
  semanticSimilarity?: number | undefined;
  experienceCompatibility?: string | undefined;
  budgetCompatibility?: string | undefined;
  jobTypeCompatibility?: string | undefined;
  locationCompatibility?: string | undefined;
  createdAt: Date;
}

export interface MatchSearchResultList {
  items: MatchSearchResultItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface MatchSearchRepository {
  searchMatches(
    queryText: string,
    scope: AuthorizedSearchScope,
    page: number,
    pageSize: number,
  ): Promise<MatchSearchResultList>;
}

// ----------------------------------------------------------------------------
// Canonical Result Mapping
// ----------------------------------------------------------------------------

/**
 * Maps a raw/persisted match search record to the canonical SearchResult DTO.
 * Excludes internal DB metadata, tenant IDs, owner IDs, and credentials.
 */
export function mapMatchToSearchResult(
  item: MatchSearchResultItem,
  queryText: string,
): SearchResult {
  const matchedFields: string[] = [];
  const q = queryText.toLowerCase().trim();
  const statusLower = item.status.toLowerCase();
  const versionLower = item.matchingVersion.toLowerCase();

  let score = 0.5;

  if (statusLower === q) {
    matchedFields.push("status");
    score = 1.0;
  } else if (statusLower.includes(q)) {
    matchedFields.push("status");
    score = 0.9;
  }

  if (item.matchedSkills && item.matchedSkills.some((s) => s.toLowerCase().includes(q))) {
    matchedFields.push("matchedSkills");
    score = Math.max(score, 0.95);
  }

  if (item.jobId.toLowerCase().includes(q)) {
    matchedFields.push("jobId");
    score = Math.max(score, 0.85);
  }

  if (item.freelancerId.toLowerCase().includes(q)) {
    matchedFields.push("freelancerId");
    score = Math.max(score, 0.85);
  }

  if (versionLower === q || versionLower.includes(q)) {
    matchedFields.push("matchingVersion");
    score = Math.max(score, 0.8);
  }

  if (item.experienceCompatibility && item.experienceCompatibility.toLowerCase().includes(q)) {
    matchedFields.push("experienceCompatibility");
    score = Math.max(score, 0.75);
  }

  if (item.budgetCompatibility && item.budgetCompatibility.toLowerCase().includes(q)) {
    matchedFields.push("budgetCompatibility");
    score = Math.max(score, 0.75);
  }

  // Safe display formatting
  let snippet: string | undefined;
  if (item.matchedSkills && item.matchedSkills.length > 0) {
    snippet = `Matched Skills: ${item.matchedSkills.join(", ")}`;
  } else if (item.budgetCompatibility || item.experienceCompatibility) {
    snippet = `Compatibility: Budget ${item.budgetCompatibility ?? "N/A"}, Exp ${item.experienceCompatibility ?? "N/A"}`;
  }

  const coveragePercent =
    item.skillCoverage !== undefined ? `${Math.round(item.skillCoverage * 100)}% Match` : undefined;
  const subtitleParts = [item.matchingVersion, item.status];
  if (coveragePercent) {
    subtitleParts.unshift(coveragePercent);
  }
  const subtitle = subtitleParts.join(" • ");

  const shortJobId = item.jobId.length > 8 ? `${item.jobId.slice(0, 8)}...` : item.jobId;
  const title = `Match for Job ${shortJobId}`;

  return new SearchResult({
    resultType: "MATCH",
    entityId: item.id,
    display: {
      title,
      subtitle,
      ...(snippet !== undefined ? { snippet } : {}),
    },
    relevance: {
      score: Math.round(score * 100) / 100,
      matchedFields: matchedFields.length > 0 ? matchedFields : ["status"],
    },
  });
}

// ----------------------------------------------------------------------------
// Match Search Engine
// ----------------------------------------------------------------------------

export class MatchSearchEngine implements SearchEngine, SearchProvider {
  private readonly _repository: MatchSearchRepository;

  constructor(repository: MatchSearchRepository) {
    if (!repository || typeof repository.searchMatches !== "function") {
      throw new SearchDomainError(
        "INVALID_SEARCH_REQUEST",
        "MatchSearchRepository implementation is required.",
      );
    }
    this._repository = repository;
  }

  public async search(query: SearchQuery, scope: AuthorizedSearchScope): Promise<SearchResultSet> {
    if (!query || !(query instanceof SearchQuery)) {
      throw new SearchDomainError("INVALID_SEARCH_REQUEST", "Valid SearchQuery is required.");
    }
    if (!scope || !(scope instanceof AuthorizedSearchScope)) {
      throw new SearchDomainError("UNAUTHORIZED_SCOPE", "AuthorizedSearchScope is required.");
    }

    // Fast path: if query restricts resultTypes and "MATCH" is not included, return empty result set
    if (query.hasTypeFilter() && !query.includesType("MATCH")) {
      return new SearchResultSet({
        results: [],
        total: 0,
        page: query.page,
        pageSize: query.pageSize,
      });
    }

    try {
      const searchResultList = await this._repository.searchMatches(
        query.query,
        scope,
        query.page,
        query.pageSize,
      );

      const results = searchResultList.items.map((item) =>
        mapMatchToSearchResult(item, query.query),
      );

      return new SearchResultSet({
        results,
        total: searchResultList.total,
        page: searchResultList.page,
        pageSize: searchResultList.pageSize,
      });
    } catch (error: unknown) {
      if (error instanceof SearchDomainError) {
        throw error;
      }
      throw new SearchDomainError("SEARCH_PROVIDER_ERROR", "Match search failed.");
    }
  }
}

// ----------------------------------------------------------------------------
// In-Memory Match Search Repository (Provider-Independent Execution)
// ----------------------------------------------------------------------------

export interface InMemoryMatchRecord {
  id: string;
  tenantId: string;
  ownerId: string;
  freelancerId: string;
  jobId: string;
  status: string;
  matchingVersion: string;
  normalizationVersion?: string | undefined;
  jobNormalizationId?: string | undefined;
  matchedSkills?: readonly string[] | undefined;
  missingSkills?: readonly string[] | undefined;
  skillCoverage?: number | undefined;
  semanticSimilarity?: number | undefined;
  experienceCompatibility?: string | undefined;
  budgetCompatibility?: string | undefined;
  jobTypeCompatibility?: string | undefined;
  locationCompatibility?: string | undefined;
  createdAt: Date;
}

export class InMemoryMatchSearchRepository implements MatchSearchRepository {
  private readonly _records: InMemoryMatchRecord[] = [];

  constructor(initialRecords: InMemoryMatchRecord[] = []) {
    this._records = [...initialRecords];
  }

  public addMatch(record: InMemoryMatchRecord): void {
    this._records.push({ ...record });
  }

  public async searchMatches(
    queryText: string,
    scope: AuthorizedSearchScope,
    page = DEFAULT_SEARCH_PAGE,
    pageSize = DEFAULT_SEARCH_PAGE_SIZE,
  ): Promise<MatchSearchResultList> {
    const q = queryText.toLowerCase().trim();

    // Enforce tenant and owner isolation authoritative boundary
    const scoped = this._records.filter(
      (r) => scope.matchesTenant(r.tenantId) && scope.matchesOwner(r.ownerId),
    );

    // Case-insensitive, partial/token matching on supported match fields
    const matched = scoped.filter((r) => {
      const statusMatch = r.status.toLowerCase().includes(q);
      const versionMatch = r.matchingVersion.toLowerCase().includes(q);
      const jobIdMatch = r.jobId.toLowerCase().includes(q);
      const freelancerIdMatch = r.freelancerId.toLowerCase().includes(q);
      const normIdMatch = r.jobNormalizationId
        ? r.jobNormalizationId.toLowerCase().includes(q)
        : false;
      const skillsMatch = r.matchedSkills
        ? r.matchedSkills.some((s) => s.toLowerCase().includes(q))
        : false;
      const missingSkillsMatch = r.missingSkills
        ? r.missingSkills.some((s) => s.toLowerCase().includes(q))
        : false;
      const expMatch = r.experienceCompatibility
        ? r.experienceCompatibility.toLowerCase().includes(q)
        : false;
      const budgetMatch = r.budgetCompatibility
        ? r.budgetCompatibility.toLowerCase().includes(q)
        : false;
      const jobTypeMatch = r.jobTypeCompatibility
        ? r.jobTypeCompatibility.toLowerCase().includes(q)
        : false;
      const locMatch = r.locationCompatibility
        ? r.locationCompatibility.toLowerCase().includes(q)
        : false;

      return (
        statusMatch ||
        versionMatch ||
        jobIdMatch ||
        freelancerIdMatch ||
        normIdMatch ||
        skillsMatch ||
        missingSkillsMatch ||
        expMatch ||
        budgetMatch ||
        jobTypeMatch ||
        locMatch
      );
    });

    // Deterministic ordering: createdAt DESC, then id DESC
    matched.sort((a, b) => {
      const timeDiff = b.createdAt.getTime() - a.createdAt.getTime();
      if (timeDiff !== 0) {
        return timeDiff;
      }
      return b.id.localeCompare(a.id);
    });

    const total = matched.length;
    const boundedPage = Math.max(1, page);
    const boundedPageSize = Math.min(MAX_SEARCH_PAGE_SIZE, Math.max(1, pageSize));
    const offset = (boundedPage - 1) * boundedPageSize;
    const paged = matched.slice(offset, offset + boundedPageSize);

    const items: MatchSearchResultItem[] = paged.map((r) => {
      const item: MatchSearchResultItem = {
        id: r.id,
        jobId: r.jobId,
        freelancerId: r.freelancerId,
        status: r.status,
        matchingVersion: r.matchingVersion,
        createdAt: r.createdAt,
      };
      if (r.normalizationVersion !== undefined) {
        item.normalizationVersion = r.normalizationVersion;
      }
      if (r.jobNormalizationId !== undefined) {
        item.jobNormalizationId = r.jobNormalizationId;
      }
      if (r.matchedSkills !== undefined) {
        item.matchedSkills = r.matchedSkills;
      }
      if (r.missingSkills !== undefined) {
        item.missingSkills = r.missingSkills;
      }
      if (r.skillCoverage !== undefined) {
        item.skillCoverage = r.skillCoverage;
      }
      if (r.semanticSimilarity !== undefined) {
        item.semanticSimilarity = r.semanticSimilarity;
      }
      if (r.experienceCompatibility !== undefined) {
        item.experienceCompatibility = r.experienceCompatibility;
      }
      if (r.budgetCompatibility !== undefined) {
        item.budgetCompatibility = r.budgetCompatibility;
      }
      if (r.jobTypeCompatibility !== undefined) {
        item.jobTypeCompatibility = r.jobTypeCompatibility;
      }
      if (r.locationCompatibility !== undefined) {
        item.locationCompatibility = r.locationCompatibility;
      }
      return item;
    });

    return {
      items,
      total,
      page: boundedPage,
      pageSize: boundedPageSize,
    };
  }
}
