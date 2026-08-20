// ============================================================================
// FreelanceOS - Phase 11D-1 Canonical Search Architecture & Domain Contract
// ============================================================================

export const DEFAULT_SEARCH_PAGE = 1;
export const DEFAULT_SEARCH_PAGE_SIZE = 20;
export const MIN_SEARCH_PAGE_SIZE = 1;
export const MAX_SEARCH_PAGE_SIZE = 100;
export const MAX_SEARCH_QUERY_LENGTH = 500;

export const SUPPORTED_SEARCH_RESULT_TYPES = ["CLIENT", "JOB", "MATCH", "TIMELINE"] as const;

export type SearchResultType = (typeof SUPPORTED_SEARCH_RESULT_TYPES)[number];

// ----------------------------------------------------------------------------
// Domain Errors & Failure Reporting
// ----------------------------------------------------------------------------

export type SearchFailureCode =
  | "INVALID_QUERY"
  | "INVALID_PAGINATION"
  | "UNSUPPORTED_RESULT_TYPE"
  | "UNAUTHORIZED_SCOPE"
  | "INVALID_SEARCH_REQUEST"
  | "SEARCH_PROVIDER_ERROR";

export class SearchDomainError extends Error {
  public readonly code: SearchFailureCode;
  public readonly publicMessage: string;
  public readonly statusCode: number;

  constructor(code: SearchFailureCode, publicMessage: string, statusCode?: number) {
    super(publicMessage);
    this.name = "SearchDomainError";
    this.code = code;
    this.publicMessage = publicMessage;
    this.statusCode = statusCode ?? defaultStatusCodeForSearchFailure(code);
    Object.setPrototypeOf(this, SearchDomainError.prototype);
  }

  public toFailure(): SearchFailure {
    return new SearchFailure({
      code: this.code,
      message: this.publicMessage,
      retryable: isRetryableSearchFailure(this.code),
    });
  }

  public toJSON(): SearchFailureProperties {
    return {
      code: this.code,
      message: this.publicMessage,
      retryable: isRetryableSearchFailure(this.code),
    };
  }
}

export function defaultStatusCodeForSearchFailure(code: SearchFailureCode): number {
  switch (code) {
    case "INVALID_QUERY":
    case "INVALID_PAGINATION":
    case "UNSUPPORTED_RESULT_TYPE":
    case "INVALID_SEARCH_REQUEST":
      return 400;
    case "UNAUTHORIZED_SCOPE":
      return 403;
    case "SEARCH_PROVIDER_ERROR":
      return 500;
    default:
      return 400;
  }
}

export function isRetryableSearchFailure(code: SearchFailureCode): boolean {
  return code === "SEARCH_PROVIDER_ERROR";
}

export interface SearchFailureProperties {
  code: SearchFailureCode;
  message: string;
  retryable?: boolean;
}

export class SearchFailure {
  private readonly _code: SearchFailureCode;
  private readonly _message: string;
  private readonly _retryable: boolean;

  constructor(properties: SearchFailureProperties) {
    this._code = properties.code;
    this._message = properties.message?.trim() || "Search operation could not be completed.";
    this._retryable = properties.retryable ?? isRetryableSearchFailure(properties.code);
    Object.freeze(this);
  }

  get code(): SearchFailureCode {
    return this._code;
  }

  get message(): string {
    return this._message;
  }

  get retryable(): boolean {
    return this._retryable;
  }

  public toJSON(): SearchFailureProperties {
    return { code: this._code, message: this._message, retryable: this._retryable };
  }
}

// ----------------------------------------------------------------------------
// JSON-Safety & Secret Exclusion Boundary
// ----------------------------------------------------------------------------

const REFERENCE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const SECRET_KEY_PATTERN =
  /(password|secret|token|credential|apiKey|api_key|stripeSecret|cookie|authorization|auth_token|bearer)/i;

export function requireSearchReference(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new SearchDomainError("UNAUTHORIZED_SCOPE", `${label} is required.`);
  }
  const clean = value.trim();
  if (!REFERENCE_PATTERN.test(clean)) {
    throw new SearchDomainError("UNAUTHORIZED_SCOPE", `${label} has an invalid reference format.`);
  }
  return clean;
}

export function assertSearchJsonSafe(
  value: unknown,
  label: string,
  seen = new WeakSet<object>(),
): void {
  if (value === undefined) {
    return;
  }
  if (typeof value === "function" || typeof value === "symbol" || typeof value === "bigint") {
    throw new SearchDomainError("INVALID_SEARCH_REQUEST", `${label} must be JSON serializable.`);
  }
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value) || Number.isNaN(value)) {
      throw new SearchDomainError(
        "INVALID_SEARCH_REQUEST",
        `${label} contains a non-finite number.`,
      );
    }
    return;
  }
  if (typeof value !== "object") {
    throw new SearchDomainError("INVALID_SEARCH_REQUEST", `${label} must be JSON serializable.`);
  }
  if (seen.has(value)) {
    throw new SearchDomainError(
      "INVALID_SEARCH_REQUEST",
      `${label} must not contain circular references.`,
    );
  }
  seen.add(value);

  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      assertSearchJsonSafe(value[i], `${label}[${i}]`, seen);
    }
  } else {
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      if (SECRET_KEY_PATTERN.test(key)) {
        throw new SearchDomainError(
          "INVALID_SEARCH_REQUEST",
          `${label} must not contain secret fields: ${key}`,
        );
      }
      assertSearchJsonSafe(nested, `${label}.${key}`, seen);
    }
  }

  seen.delete(value);
}

// ----------------------------------------------------------------------------
// Result Type Helpers
// ----------------------------------------------------------------------------

export function isSearchResultType(value: unknown): value is SearchResultType {
  return (
    typeof value === "string" &&
    (SUPPORTED_SEARCH_RESULT_TYPES as readonly string[]).includes(value)
  );
}

export function parseSearchResultType(value: unknown): SearchResultType {
  if (typeof value !== "string" || value.trim() === "") {
    throw new SearchDomainError("UNSUPPORTED_RESULT_TYPE", "Result type cannot be empty.");
  }
  const normalized = value
    .trim()
    .toUpperCase()
    .replace(/[-\s]+/g, "_");
  if (normalized === "OPPORTUNITY") {
    return "MATCH";
  }
  if (isSearchResultType(normalized)) {
    return normalized;
  }
  throw new SearchDomainError(
    "UNSUPPORTED_RESULT_TYPE",
    `Unsupported search result type: ${value}`,
  );
}

// ----------------------------------------------------------------------------
// Authorization Scope Contract
// ----------------------------------------------------------------------------

export interface AuthorizedSearchScopeProperties {
  tenantId: string;
  ownerId: string;
  actorId?: string;
}

export class AuthorizedSearchScope {
  private readonly _tenantId: string;
  private readonly _ownerId: string;
  private readonly _actorId?: string;

  constructor(properties: AuthorizedSearchScopeProperties) {
    if (!properties || typeof properties !== "object" || Array.isArray(properties)) {
      throw new SearchDomainError(
        "UNAUTHORIZED_SCOPE",
        "Authorized search scope properties must be an object.",
      );
    }
    assertSearchJsonSafe(properties, "AuthorizedSearchScope");

    this._tenantId = requireSearchReference(properties.tenantId, "Tenant ID");
    this._ownerId = requireSearchReference(properties.ownerId, "Owner ID");
    if (properties.actorId !== undefined) {
      this._actorId = requireSearchReference(properties.actorId, "Actor ID");
    }
    Object.freeze(this);
  }

  get tenantId(): string {
    return this._tenantId;
  }

  get ownerId(): string {
    return this._ownerId;
  }

  get actorId(): string | undefined {
    return this._actorId;
  }

  public matchesTenant(tenantId: string): boolean {
    return this._tenantId === tenantId;
  }

  public matchesOwner(ownerId: string): boolean {
    return this._ownerId === ownerId;
  }

  public equals(other: AuthorizedSearchScope | null | undefined): boolean {
    if (!other || !(other instanceof AuthorizedSearchScope)) {
      return false;
    }
    return (
      this._tenantId === other.tenantId &&
      this._ownerId === other.ownerId &&
      this._actorId === other.actorId
    );
  }

  public toJSON(): AuthorizedSearchScopeProperties {
    return {
      tenantId: this._tenantId,
      ownerId: this._ownerId,
      ...(this._actorId !== undefined ? { actorId: this._actorId } : {}),
    };
  }
}

// ----------------------------------------------------------------------------
// Canonical Search Query Contract
// ----------------------------------------------------------------------------

export interface SearchQueryProperties {
  query: string;
  resultTypes?: readonly SearchResultType[];
  page?: number;
  pageSize?: number;
}

const ALLOWED_SEARCH_QUERY_KEYS = new Set(["query", "resultTypes", "page", "pageSize"]);

export class SearchQuery {
  private readonly _query: string;
  private readonly _resultTypes: readonly SearchResultType[];
  private readonly _page: number;
  private readonly _pageSize: number;

  constructor(properties: SearchQueryProperties) {
    if (!properties || typeof properties !== "object" || Array.isArray(properties)) {
      throw new SearchDomainError(
        "INVALID_SEARCH_REQUEST",
        "Search query parameters must be an object.",
      );
    }

    // Strict unknown field checking
    for (const key of Object.keys(properties)) {
      if (!ALLOWED_SEARCH_QUERY_KEYS.has(key)) {
        throw new SearchDomainError(
          "INVALID_SEARCH_REQUEST",
          `Unknown search query parameter: ${key}`,
        );
      }
    }

    // Validate query string
    if (typeof properties.query !== "string") {
      throw new SearchDomainError("INVALID_QUERY", "Search query must be a string.");
    }
    const cleanQuery = properties.query.trim();
    if (cleanQuery.length === 0) {
      throw new SearchDomainError(
        "INVALID_QUERY",
        "Search query cannot be empty or whitespace-only.",
      );
    }
    if (cleanQuery.length > MAX_SEARCH_QUERY_LENGTH) {
      throw new SearchDomainError(
        "INVALID_QUERY",
        `Search query exceeds maximum length of ${MAX_SEARCH_QUERY_LENGTH} characters.`,
      );
    }
    this._query = cleanQuery;

    // Validate pagination: page
    if (properties.page !== undefined) {
      if (
        typeof properties.page !== "number" ||
        !Number.isFinite(properties.page) ||
        !Number.isInteger(properties.page) ||
        properties.page < 1
      ) {
        throw new SearchDomainError("INVALID_PAGINATION", "Page must be a positive integer >= 1.");
      }
      this._page = properties.page;
    } else {
      this._page = DEFAULT_SEARCH_PAGE;
    }

    // Validate pagination: pageSize
    if (properties.pageSize !== undefined) {
      if (
        typeof properties.pageSize !== "number" ||
        !Number.isFinite(properties.pageSize) ||
        !Number.isInteger(properties.pageSize) ||
        properties.pageSize < MIN_SEARCH_PAGE_SIZE
      ) {
        throw new SearchDomainError(
          "INVALID_PAGINATION",
          `Page size must be a positive integer >= ${MIN_SEARCH_PAGE_SIZE}.`,
        );
      }
      if (properties.pageSize > MAX_SEARCH_PAGE_SIZE) {
        throw new SearchDomainError(
          "INVALID_PAGINATION",
          `Page size cannot exceed maximum of ${MAX_SEARCH_PAGE_SIZE}.`,
        );
      }
      this._pageSize = properties.pageSize;
    } else {
      this._pageSize = DEFAULT_SEARCH_PAGE_SIZE;
    }

    // Validate resultTypes filter
    if (properties.resultTypes !== undefined) {
      if (!Array.isArray(properties.resultTypes)) {
        throw new SearchDomainError(
          "INVALID_SEARCH_REQUEST",
          "Result types filter must be an array.",
        );
      }

      const seenTypes = new Set<SearchResultType>();
      const validatedTypes: SearchResultType[] = [];

      for (const item of properties.resultTypes) {
        const parsed = parseSearchResultType(item);
        if (seenTypes.has(parsed)) {
          throw new SearchDomainError(
            "INVALID_SEARCH_REQUEST",
            `Duplicate result type detected: ${parsed}`,
          );
        }
        seenTypes.add(parsed);
        validatedTypes.push(parsed);
      }

      this._resultTypes = Object.freeze(validatedTypes);
    } else {
      this._resultTypes = Object.freeze([]);
    }

    assertSearchJsonSafe(properties, "SearchQuery");

    Object.freeze(this);
  }

  get query(): string {
    return this._query;
  }

  get resultTypes(): readonly SearchResultType[] {
    return this._resultTypes;
  }

  get page(): number {
    return this._page;
  }

  get pageSize(): number {
    return this._pageSize;
  }

  public hasTypeFilter(): boolean {
    return this._resultTypes.length > 0;
  }

  public includesType(type: SearchResultType): boolean {
    if (this._resultTypes.length === 0) {
      return true;
    }
    return this._resultTypes.includes(type);
  }

  public static fromRaw(input: unknown): SearchQuery {
    if (!input || typeof input !== "object" || Array.isArray(input)) {
      throw new SearchDomainError(
        "INVALID_SEARCH_REQUEST",
        "Raw search query must be a valid JSON object.",
      );
    }
    return new SearchQuery(input as SearchQueryProperties);
  }

  public toJSON(): SearchQueryProperties {
    return {
      query: this._query,
      ...(this._resultTypes.length > 0 ? { resultTypes: this._resultTypes } : {}),
      page: this._page,
      pageSize: this._pageSize,
    };
  }
}

// ----------------------------------------------------------------------------
// Canonical Search Result Contract
// ----------------------------------------------------------------------------

export interface SearchResultDisplay {
  title: string;
  subtitle?: string | undefined;
  snippet?: string | undefined;
}

export interface SearchResultRelevance {
  score?: number | undefined;
  matchedFields?: readonly string[] | undefined;
}

export interface SearchResultProperties {
  resultType: SearchResultType;
  entityId: string;
  display: SearchResultDisplay;
  relevance?: SearchResultRelevance | undefined;
}

const ALLOWED_SEARCH_RESULT_KEYS = new Set(["resultType", "entityId", "display", "relevance"]);
const ALLOWED_DISPLAY_KEYS = new Set(["title", "subtitle", "snippet"]);
const ALLOWED_RELEVANCE_KEYS = new Set(["score", "matchedFields"]);

export class SearchResult {
  private readonly _resultType: SearchResultType;
  private readonly _entityId: string;
  private readonly _display: Readonly<SearchResultDisplay>;
  private readonly _relevance?: Readonly<SearchResultRelevance>;

  constructor(properties: SearchResultProperties) {
    if (!properties || typeof properties !== "object" || Array.isArray(properties)) {
      throw new SearchDomainError(
        "INVALID_SEARCH_REQUEST",
        "Search result properties must be an object.",
      );
    }

    for (const key of Object.keys(properties)) {
      if (!ALLOWED_SEARCH_RESULT_KEYS.has(key)) {
        throw new SearchDomainError(
          "INVALID_SEARCH_REQUEST",
          `Unknown search result property: ${key}`,
        );
      }
    }

    // Validate resultType
    this._resultType = parseSearchResultType(properties.resultType);

    // Validate entityId
    if (typeof properties.entityId !== "string" || properties.entityId.trim() === "") {
      throw new SearchDomainError("INVALID_SEARCH_REQUEST", "Entity ID is required.");
    }
    const cleanEntityId = properties.entityId.trim();
    if (!REFERENCE_PATTERN.test(cleanEntityId)) {
      throw new SearchDomainError(
        "INVALID_SEARCH_REQUEST",
        "Entity ID has an invalid reference format.",
      );
    }
    this._entityId = cleanEntityId;

    // Validate display
    if (
      !properties.display ||
      typeof properties.display !== "object" ||
      Array.isArray(properties.display)
    ) {
      throw new SearchDomainError(
        "INVALID_SEARCH_REQUEST",
        "Display object is required for SearchResult.",
      );
    }
    for (const key of Object.keys(properties.display)) {
      if (!ALLOWED_DISPLAY_KEYS.has(key)) {
        throw new SearchDomainError(
          "INVALID_SEARCH_REQUEST",
          `Unknown display property in SearchResult: ${key}`,
        );
      }
    }
    if (
      typeof properties.display.title !== "string" ||
      properties.display.title.trim().length === 0
    ) {
      throw new SearchDomainError(
        "INVALID_SEARCH_REQUEST",
        "Display title is required and cannot be empty.",
      );
    }
    if (
      properties.display.subtitle !== undefined &&
      typeof properties.display.subtitle !== "string"
    ) {
      throw new SearchDomainError("INVALID_SEARCH_REQUEST", "Display subtitle must be a string.");
    }
    if (
      properties.display.snippet !== undefined &&
      typeof properties.display.snippet !== "string"
    ) {
      throw new SearchDomainError("INVALID_SEARCH_REQUEST", "Display snippet must be a string.");
    }

    const displayObj: SearchResultDisplay = {
      title: properties.display.title.trim(),
      ...(properties.display.subtitle !== undefined
        ? { subtitle: properties.display.subtitle.trim() }
        : {}),
      ...(properties.display.snippet !== undefined
        ? { snippet: properties.display.snippet.trim() }
        : {}),
    };
    this._display = Object.freeze(displayObj);

    // Validate relevance if provided
    if (properties.relevance !== undefined) {
      if (
        !properties.relevance ||
        typeof properties.relevance !== "object" ||
        Array.isArray(properties.relevance)
      ) {
        throw new SearchDomainError(
          "INVALID_SEARCH_REQUEST",
          "Relevance metadata must be an object.",
        );
      }
      for (const key of Object.keys(properties.relevance)) {
        if (!ALLOWED_RELEVANCE_KEYS.has(key)) {
          throw new SearchDomainError(
            "INVALID_SEARCH_REQUEST",
            `Unknown relevance property in SearchResult: ${key}`,
          );
        }
      }
      if (properties.relevance.score !== undefined) {
        if (
          typeof properties.relevance.score !== "number" ||
          !Number.isFinite(properties.relevance.score) ||
          properties.relevance.score < 0
        ) {
          throw new SearchDomainError(
            "INVALID_SEARCH_REQUEST",
            "Relevance score must be a non-negative finite number.",
          );
        }
      }
      if (properties.relevance.matchedFields !== undefined) {
        if (!Array.isArray(properties.relevance.matchedFields)) {
          throw new SearchDomainError(
            "INVALID_SEARCH_REQUEST",
            "Relevance matchedFields must be an array.",
          );
        }
        for (const field of properties.relevance.matchedFields) {
          if (typeof field !== "string" || field.trim() === "") {
            throw new SearchDomainError(
              "INVALID_SEARCH_REQUEST",
              "Matched field name must be a non-empty string.",
            );
          }
        }
      }

      const relevanceObj: SearchResultRelevance = {
        ...(properties.relevance.score !== undefined ? { score: properties.relevance.score } : {}),
        ...(properties.relevance.matchedFields !== undefined
          ? {
              matchedFields: Object.freeze(properties.relevance.matchedFields.map((f) => f.trim())),
            }
          : {}),
      };
      this._relevance = Object.freeze(relevanceObj);
    }

    assertSearchJsonSafe(properties, "SearchResult");

    Object.freeze(this);
  }

  get resultType(): SearchResultType {
    return this._resultType;
  }

  get entityId(): string {
    return this._entityId;
  }

  get display(): Readonly<SearchResultDisplay> {
    return this._display;
  }

  get relevance(): Readonly<SearchResultRelevance> | undefined {
    return this._relevance;
  }

  public toJSON(): SearchResultProperties {
    return {
      resultType: this._resultType,
      entityId: this._entityId,
      display: { ...this._display },
      ...(this._relevance !== undefined ? { relevance: { ...this._relevance } } : {}),
    };
  }
}

// ----------------------------------------------------------------------------
// Canonical Search Result Set Contract
// ----------------------------------------------------------------------------

export interface SearchResultSetProperties {
  results: readonly SearchResult[];
  total: number;
  page: number;
  pageSize: number;
}

const ALLOWED_RESULT_SET_KEYS = new Set(["results", "total", "page", "pageSize"]);

export class SearchResultSet {
  private readonly _results: readonly SearchResult[];
  private readonly _total: number;
  private readonly _page: number;
  private readonly _pageSize: number;
  private readonly _totalPages: number;

  constructor(properties: SearchResultSetProperties) {
    if (!properties || typeof properties !== "object" || Array.isArray(properties)) {
      throw new SearchDomainError(
        "INVALID_SEARCH_REQUEST",
        "Search result set properties must be an object.",
      );
    }

    for (const key of Object.keys(properties)) {
      if (!ALLOWED_RESULT_SET_KEYS.has(key)) {
        throw new SearchDomainError(
          "INVALID_SEARCH_REQUEST",
          `Unknown search result set property: ${key}`,
        );
      }
    }

    // Validate page
    if (
      typeof properties.page !== "number" ||
      !Number.isFinite(properties.page) ||
      !Number.isInteger(properties.page) ||
      properties.page < 1
    ) {
      throw new SearchDomainError("INVALID_PAGINATION", "Page must be a positive integer >= 1.");
    }
    this._page = properties.page;

    // Validate pageSize
    if (
      typeof properties.pageSize !== "number" ||
      !Number.isFinite(properties.pageSize) ||
      !Number.isInteger(properties.pageSize) ||
      properties.pageSize < MIN_SEARCH_PAGE_SIZE
    ) {
      throw new SearchDomainError(
        "INVALID_PAGINATION",
        `Page size must be a positive integer >= ${MIN_SEARCH_PAGE_SIZE}.`,
      );
    }
    if (properties.pageSize > MAX_SEARCH_PAGE_SIZE) {
      throw new SearchDomainError(
        "INVALID_PAGINATION",
        `Page size cannot exceed maximum of ${MAX_SEARCH_PAGE_SIZE}.`,
      );
    }
    this._pageSize = properties.pageSize;

    // Validate total
    if (
      typeof properties.total !== "number" ||
      !Number.isFinite(properties.total) ||
      !Number.isInteger(properties.total) ||
      properties.total < 0
    ) {
      throw new SearchDomainError(
        "INVALID_PAGINATION",
        "Total results count must be a non-negative integer >= 0.",
      );
    }
    this._total = properties.total;

    // Validate results array
    if (!Array.isArray(properties.results)) {
      throw new SearchDomainError("INVALID_SEARCH_REQUEST", "Results must be an array.");
    }

    if (properties.results.length > this._pageSize) {
      throw new SearchDomainError(
        "INVALID_PAGINATION",
        `Results count (${properties.results.length}) cannot exceed requested page size (${this._pageSize}).`,
      );
    }

    const validatedResults: SearchResult[] = [];
    for (let i = 0; i < properties.results.length; i++) {
      const item = properties.results[i];
      if (!(item instanceof SearchResult)) {
        throw new SearchDomainError(
          "INVALID_SEARCH_REQUEST",
          `Result item at index ${i} must be an instance of SearchResult.`,
        );
      }
      validatedResults.push(item);
    }

    this._results = Object.freeze(validatedResults);
    this._totalPages = this._total === 0 ? 0 : Math.ceil(this._total / this._pageSize);

    assertSearchJsonSafe(properties, "SearchResultSet");

    Object.freeze(this);
  }

  get results(): readonly SearchResult[] {
    return this._results;
  }

  get total(): number {
    return this._total;
  }

  get page(): number {
    return this._page;
  }

  get pageSize(): number {
    return this._pageSize;
  }

  get totalPages(): number {
    return this._totalPages;
  }

  get count(): number {
    return this._results.length;
  }

  get isEmpty(): boolean {
    return this._results.length === 0;
  }

  public toJSON(): {
    results: SearchResultProperties[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  } {
    return {
      results: this._results.map((r) => r.toJSON()),
      total: this._total,
      page: this._page,
      pageSize: this._pageSize,
      totalPages: this._totalPages,
    };
  }
}

// ----------------------------------------------------------------------------
// Provider-Independent Search Engine & Provider Interfaces
// ----------------------------------------------------------------------------

export interface SearchProvider {
  search(query: SearchQuery, scope: AuthorizedSearchScope): Promise<SearchResultSet>;
}

export interface SearchEngine {
  search(query: SearchQuery, scope: AuthorizedSearchScope): Promise<SearchResultSet>;
}
