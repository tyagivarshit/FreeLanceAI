// ============================================================================
// FreelanceOS - Phase 11D-3 Job Search Domain Implementation
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
// Job Search Repository Contracts (Ports)
// ----------------------------------------------------------------------------

export interface JobSearchResultItem {
  id: string;
  title: string;
  source: string;
  status: string;
  description?: string | undefined;
  skills?: readonly string[] | undefined;
  category?: string | undefined;
  externalJobId?: string | undefined;
  sourceUrl?: string | undefined;
  clientId?: string | undefined;
  createdAt: Date;
}

export interface JobSearchResultList {
  items: JobSearchResultItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface JobSearchRepository {
  searchJobs(
    queryText: string,
    scope: AuthorizedSearchScope,
    page: number,
    pageSize: number,
  ): Promise<JobSearchResultList>;
}

// ----------------------------------------------------------------------------
// Canonical Result Mapping
// ----------------------------------------------------------------------------

/**
 * Maps a raw/persisted job search record to the canonical SearchResult DTO.
 * Excludes internal DB metadata, tenant IDs, owner IDs, and credentials.
 */
export function mapJobToSearchResult(item: JobSearchResultItem, queryText: string): SearchResult {
  const matchedFields: string[] = [];
  const q = queryText.toLowerCase().trim();
  const titleLower = item.title.toLowerCase();

  let score = 0.5;

  if (titleLower === q) {
    matchedFields.push("title");
    score = 1.0;
  } else if (titleLower.includes(q)) {
    matchedFields.push("title");
    score = 0.9;
  }

  if (item.skills && item.skills.length > 0) {
    const matchedSkills = item.skills.filter((s) => s.toLowerCase().includes(q));
    if (matchedSkills.length > 0) {
      matchedFields.push("skills");
      score = Math.max(score, 0.85);
    }
  }

  if (item.source && item.source.toLowerCase().includes(q)) {
    matchedFields.push("source");
    score = Math.max(score, 0.8);
  }

  if (item.externalJobId && item.externalJobId.toLowerCase().includes(q)) {
    matchedFields.push("externalJobId");
    score = Math.max(score, 0.8);
  }

  if (item.category && item.category.toLowerCase().includes(q)) {
    matchedFields.push("category");
    score = Math.max(score, 0.75);
  }

  if (item.description && item.description.toLowerCase().includes(q)) {
    matchedFields.push("description");
    score = Math.max(score, 0.7);
  }

  // Safe display snippet formatting
  let snippet: string | undefined;
  if (item.description) {
    const cleanDesc = item.description.trim().replace(/\s+/g, " ");
    snippet = cleanDesc.length > 120 ? `${cleanDesc.substring(0, 117)}...` : cleanDesc;
  } else if (item.skills && item.skills.length > 0) {
    snippet = `Skills: ${item.skills.join(", ")}`;
  } else if (item.sourceUrl) {
    snippet = `Source: ${item.sourceUrl}`;
  }

  const subtitle = item.source
    ? `${item.source.charAt(0).toUpperCase() + item.source.slice(1)} • ${item.status}`
    : item.status;

  return new SearchResult({
    resultType: "JOB",
    entityId: item.id,
    display: {
      title: item.title,
      subtitle,
      ...(snippet !== undefined ? { snippet } : {}),
    },
    relevance: {
      score: Math.round(score * 100) / 100,
      matchedFields: matchedFields.length > 0 ? matchedFields : ["title"],
    },
  });
}

// ----------------------------------------------------------------------------
// Job Search Engine
// ----------------------------------------------------------------------------

export class JobSearchEngine implements SearchEngine, SearchProvider {
  private readonly _repository: JobSearchRepository;

  constructor(repository: JobSearchRepository) {
    if (!repository || typeof repository.searchJobs !== "function") {
      throw new SearchDomainError(
        "INVALID_SEARCH_REQUEST",
        "JobSearchRepository implementation is required.",
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

    // Fast path: if query restricts resultTypes and "JOB" is not included, return empty result set
    if (query.hasTypeFilter() && !query.includesType("JOB")) {
      return new SearchResultSet({
        results: [],
        total: 0,
        page: query.page,
        pageSize: query.pageSize,
      });
    }

    try {
      const searchResultList = await this._repository.searchJobs(
        query.query,
        scope,
        query.page,
        query.pageSize,
      );

      const results = searchResultList.items.map((item) => mapJobToSearchResult(item, query.query));

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
      throw new SearchDomainError("SEARCH_PROVIDER_ERROR", "Job search failed.");
    }
  }
}

// ----------------------------------------------------------------------------
// In-Memory Job Search Repository (Provider-Independent Execution)
// ----------------------------------------------------------------------------

export interface InMemoryJobRecord {
  id: string;
  tenantId: string;
  ownerId: string;
  title: string;
  source: string;
  status: string;
  description?: string | undefined;
  skills?: readonly string[] | undefined;
  category?: string | undefined;
  externalJobId?: string | undefined;
  sourceUrl?: string | undefined;
  clientId?: string | undefined;
  createdAt: Date;
}

export class InMemoryJobSearchRepository implements JobSearchRepository {
  private readonly _records: InMemoryJobRecord[] = [];

  constructor(initialRecords: InMemoryJobRecord[] = []) {
    this._records = [...initialRecords];
  }

  public addJob(record: InMemoryJobRecord): void {
    this._records.push({ ...record });
  }

  public async searchJobs(
    queryText: string,
    scope: AuthorizedSearchScope,
    page = DEFAULT_SEARCH_PAGE,
    pageSize = DEFAULT_SEARCH_PAGE_SIZE,
  ): Promise<JobSearchResultList> {
    const q = queryText.toLowerCase().trim();

    // Enforce tenant and owner isolation authoritative boundary
    const scoped = this._records.filter(
      (r) => scope.matchesTenant(r.tenantId) && scope.matchesOwner(r.ownerId),
    );

    // Case-insensitive, partial/token matching on supported job fields
    const matched = scoped.filter((r) => {
      const titleMatch = r.title.toLowerCase().includes(q);
      const descMatch = r.description ? r.description.toLowerCase().includes(q) : false;
      const skillsMatch = r.skills ? r.skills.some((s) => s.toLowerCase().includes(q)) : false;
      const sourceMatch = r.source.toLowerCase().includes(q);
      const externalIdMatch = r.externalJobId ? r.externalJobId.toLowerCase().includes(q) : false;
      const categoryMatch = r.category ? r.category.toLowerCase().includes(q) : false;
      const statusMatch = r.status.toLowerCase().includes(q);

      return (
        titleMatch ||
        descMatch ||
        skillsMatch ||
        sourceMatch ||
        externalIdMatch ||
        categoryMatch ||
        statusMatch
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

    const items: JobSearchResultItem[] = paged.map((r) => {
      const item: JobSearchResultItem = {
        id: r.id,
        title: r.title,
        source: r.source,
        status: r.status,
        createdAt: r.createdAt,
      };
      if (r.description !== undefined) {
        item.description = r.description;
      }
      if (r.skills !== undefined) {
        item.skills = r.skills;
      }
      if (r.category !== undefined) {
        item.category = r.category;
      }
      if (r.externalJobId !== undefined) {
        item.externalJobId = r.externalJobId;
      }
      if (r.sourceUrl !== undefined) {
        item.sourceUrl = r.sourceUrl;
      }
      if (r.clientId !== undefined) {
        item.clientId = r.clientId;
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
