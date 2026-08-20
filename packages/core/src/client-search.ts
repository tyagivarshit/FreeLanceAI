// ============================================================================
// FreelanceOS - Phase 11D-2 Client Search Domain Implementation
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
// Client Search Repository Contracts (Ports)
// ----------------------------------------------------------------------------

export interface ClientSearchResultItem {
  id: string;
  name: string;
  status: string;
  email?: string | undefined;
  website?: string | undefined;
  firstName?: string | undefined;
  lastName?: string | undefined;
  phone?: string | undefined;
  createdAt: Date;
}

export interface ClientSearchResultList {
  items: ClientSearchResultItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ClientSearchRepository {
  searchClients(
    queryText: string,
    scope: AuthorizedSearchScope,
    page: number,
    pageSize: number,
  ): Promise<ClientSearchResultList>;
}

// ----------------------------------------------------------------------------
// Canonical Result Mapping
// ----------------------------------------------------------------------------

/**
 * Maps a raw/persisted client search record to the canonical SearchResult DTO.
 * Excludes all internal DB fields, tenant IDs, owner IDs, and credentials.
 */
export function mapClientToSearchResult(
  item: ClientSearchResultItem,
  queryText: string,
): SearchResult {
  const matchedFields: string[] = [];
  const q = queryText.toLowerCase().trim();
  const nameLower = item.name.toLowerCase();

  let score = 0.5;

  if (nameLower === q) {
    matchedFields.push("name");
    score = 1.0;
  } else if (nameLower.includes(q)) {
    matchedFields.push("name");
    score = 0.9;
  }

  if (item.email) {
    const emailLower = item.email.toLowerCase();
    if (emailLower === q) {
      matchedFields.push("email");
      score = Math.max(score, 0.95);
    } else if (emailLower.includes(q)) {
      matchedFields.push("email");
      score = Math.max(score, 0.85);
    }
  }

  if (item.website) {
    const webLower = item.website.toLowerCase();
    if (webLower === q) {
      matchedFields.push("website");
      score = Math.max(score, 0.9);
    } else if (webLower.includes(q)) {
      matchedFields.push("website");
      score = Math.max(score, 0.75);
    }
  }

  if (item.firstName || item.lastName) {
    const contactName = `${item.firstName ?? ""} ${item.lastName ?? ""}`.trim().toLowerCase();
    if (contactName === q) {
      matchedFields.push("contactName");
      score = Math.max(score, 0.9);
    } else if (contactName.includes(q)) {
      matchedFields.push("contactName");
      score = Math.max(score, 0.8);
    }
  }

  if (item.phone) {
    const phoneClean = item.phone.toLowerCase().replace(/[^a-z0-9]/g, "");
    const qClean = q.replace(/[^a-z0-9]/g, "");
    if (qClean.length > 0 && phoneClean.includes(qClean)) {
      matchedFields.push("phone");
      score = Math.max(score, 0.7);
    }
  }

  // Safe display formatting
  let snippet: string | undefined;
  if (item.email) {
    snippet = `Contact: ${item.email}`;
  } else if (item.website) {
    snippet = `Website: ${item.website}`;
  }

  return new SearchResult({
    resultType: "CLIENT",
    entityId: item.id,
    display: {
      title: item.name,
      subtitle: item.status,
      ...(snippet !== undefined ? { snippet } : {}),
    },
    relevance: {
      score: Math.round(score * 100) / 100,
      matchedFields: matchedFields.length > 0 ? matchedFields : ["name"],
    },
  });
}

// ----------------------------------------------------------------------------
// Client Search Engine
// ----------------------------------------------------------------------------

export class ClientSearchEngine implements SearchEngine, SearchProvider {
  private readonly _repository: ClientSearchRepository;

  constructor(repository: ClientSearchRepository) {
    if (!repository || typeof repository.searchClients !== "function") {
      throw new SearchDomainError(
        "INVALID_SEARCH_REQUEST",
        "ClientSearchRepository implementation is required.",
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

    // Fast path: if the query restricts resultTypes and "CLIENT" is not included, return empty result set
    if (query.hasTypeFilter() && !query.includesType("CLIENT")) {
      return new SearchResultSet({
        results: [],
        total: 0,
        page: query.page,
        pageSize: query.pageSize,
      });
    }

    try {
      const searchResultList = await this._repository.searchClients(
        query.query,
        scope,
        query.page,
        query.pageSize,
      );

      const results = searchResultList.items.map((item) =>
        mapClientToSearchResult(item, query.query),
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
      throw new SearchDomainError("SEARCH_PROVIDER_ERROR", "Client search failed.");
    }
  }
}

// ----------------------------------------------------------------------------
// In-Memory Client Search Repository (Provider-Independent Execution)
// ----------------------------------------------------------------------------

export interface InMemoryClientRecord {
  id: string;
  tenantId: string;
  ownerId: string;
  name: string;
  status: string;
  email?: string | undefined;
  website?: string | undefined;
  firstName?: string | undefined;
  lastName?: string | undefined;
  phone?: string | undefined;
  createdAt: Date;
}

export class InMemoryClientSearchRepository implements ClientSearchRepository {
  private readonly _records: InMemoryClientRecord[] = [];

  constructor(initialRecords: InMemoryClientRecord[] = []) {
    this._records = [...initialRecords];
  }

  public addClient(record: InMemoryClientRecord): void {
    this._records.push({ ...record });
  }

  public async searchClients(
    queryText: string,
    scope: AuthorizedSearchScope,
    page = DEFAULT_SEARCH_PAGE,
    pageSize = DEFAULT_SEARCH_PAGE_SIZE,
  ): Promise<ClientSearchResultList> {
    const q = queryText.toLowerCase().trim();

    // Enforce tenant and owner isolation authoritative boundary
    const scoped = this._records.filter(
      (r) => scope.matchesTenant(r.tenantId) && scope.matchesOwner(r.ownerId),
    );

    // Case-insensitive, partial/token matching on supported client fields
    const matched = scoped.filter((r) => {
      const nameMatch = r.name.toLowerCase().includes(q);
      const emailMatch = r.email ? r.email.toLowerCase().includes(q) : false;
      const websiteMatch = r.website ? r.website.toLowerCase().includes(q) : false;
      const firstNameMatch = r.firstName ? r.firstName.toLowerCase().includes(q) : false;
      const lastNameMatch = r.lastName ? r.lastName.toLowerCase().includes(q) : false;
      const phoneMatch = r.phone ? r.phone.toLowerCase().includes(q) : false;
      return (
        nameMatch || emailMatch || websiteMatch || firstNameMatch || lastNameMatch || phoneMatch
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

    const items: ClientSearchResultItem[] = paged.map((r) => {
      const item: ClientSearchResultItem = {
        id: r.id,
        name: r.name,
        status: r.status,
        createdAt: r.createdAt,
      };
      if (r.email !== undefined) {
        item.email = r.email;
      }
      if (r.website !== undefined) {
        item.website = r.website;
      }
      if (r.firstName !== undefined) {
        item.firstName = r.firstName;
      }
      if (r.lastName !== undefined) {
        item.lastName = r.lastName;
      }
      if (r.phone !== undefined) {
        item.phone = r.phone;
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
