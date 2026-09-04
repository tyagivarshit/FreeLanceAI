import React, { useState, useEffect, useCallback, useRef } from "react";
import { AppLayout } from "../layouts/AppLayout.js";
import { searchService } from "../services/searchService.js";
import type { SearchResultItem } from "../types/search.js";
import { useDebounce } from "../hooks/useDebounce.js";
import { Skeleton } from "../shared/Skeleton.js";

export const SearchPage: React.FC = () => {
  const [query, setQuery] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("q") || "";
  });
  const [selectedType, setSelectedType] = useState<string>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("types") || "";
  });
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState<number>(() => {
    const params = new URLSearchParams(window.location.search);
    const p = parseInt(params.get("page") || "1", 10);
    return p > 0 ? p : 1;
  });
  const [pageSize] = useState(20);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [focusedIndex, setFocusedIndex] = useState<number>(-1);

  const inputRef = useRef<HTMLInputElement>(null);
  const isFirstRender = useRef(true);
  const debouncedQuery = useDebounce(query, 300);

  useEffect(() => {
    (window as any).__setSearchQuery = (val: string) => {
      setQuery(val);
      setPage(1);
    };
    return () => {
      delete (window as any).__setSearchQuery;
    };
  }, []);

  useEffect(() => {
    const handleUrlChange = () => {
      const params = new URLSearchParams(window.location.search);
      const q = params.get("q") || "";
      const types = params.get("types") || "";
      const p = parseInt(params.get("page") || "1", 10);
      if (q !== query) setQuery(q);
      if (types !== selectedType) setSelectedType(types);
      if (p > 0 && p !== page) setPage(p);
    };
    window.addEventListener("popstate", handleUrlChange);
    return () => window.removeEventListener("popstate", handleUrlChange);
  }, [query, selectedType, page]);

  // Global keyboard shortcuts (Ctrl+K or / to focus search, Escape to blur/clear)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      } else if (
        e.key === "/" &&
        document.activeElement !== inputRef.current &&
        document.activeElement?.tagName !== "INPUT"
      ) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const performSearch = useCallback(
    async (q: string, types: string, p: number, signal?: AbortSignal) => {
      const trimmed = q.trim();
      if (!trimmed) {
        setResults([]);
        setTotal(0);
        setLoading(false);
        setError(null);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const searchParams: {
          q: string;
          page: number;
          pageSize: number;
          resultTypes?: string;
          signal?: AbortSignal;
        } = {
          q: trimmed,
          page: p,
          pageSize,
        };
        if (types) {
          searchParams.resultTypes = types;
        }
        if (signal) {
          searchParams.signal = signal;
        }
        const res = await searchService.search(searchParams);

        setResults(res.results || []);
        setTotal(res.total || 0);
        setPage(res.page || p);
      } catch (err: any) {
        if (err.name === "AbortError") return;
        setError(err.message || "Failed to complete search");
      } finally {
        setLoading(false);
      }
    },
    [pageSize],
  );

  // Proactively synchronize URL search parameters with current query and filters
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    const trimmed = debouncedQuery.trim();
    const params = new URLSearchParams();
    if (trimmed) params.set("q", trimmed);
    if (selectedType) params.set("types", selectedType);
    if (page > 1) params.set("page", String(page));
    const targetUrl =
      trimmed || selectedType || page > 1 ? `/search.html?${params.toString()}` : "/search.html";
    window.history.replaceState(null, "", targetUrl);
  }, [debouncedQuery, selectedType, page]);

  useEffect(() => {
    const controller = new AbortController();
    performSearch(debouncedQuery, selectedType, page, controller.signal);
    return () => controller.abort();
  }, [debouncedQuery, selectedType, page, performSearch]);

  const handleClear = () => {
    setQuery("");
    setResults([]);
    setTotal(0);
    window.history.replaceState(null, "", "/search.html");
    inputRef.current?.focus();
  };

  // Keyboard navigation through results
  const handleResultsKeyDown = (e: React.KeyboardEvent) => {
    if (results.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setFocusedIndex((prev) => (prev < results.length - 1 ? prev + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setFocusedIndex((prev) => (prev > 0 ? prev - 1 : results.length - 1));
    } else if (e.key === "Enter" && focusedIndex >= 0 && focusedIndex < results.length) {
      e.preventDefault();
      const target = results[focusedIndex];
      if (target) {
        const url = getResultUrl(target);
        if (url) window.location.href = url;
      }
    }
  };

  const getResultUrl = (item: SearchResultItem) => {
    switch (item.resultType) {
      case "CLIENT":
        return `/clients/${encodeURIComponent(item.entityId)}`;
      case "TIMELINE":
        return `/clients/${encodeURIComponent(item.entityId)}`;
      case "MATCH":
        return `/matching.html?id=${encodeURIComponent(item.entityId)}`;
      case "JOB":
        return `/dashboard.html`;
      default:
        return "/dashboard.html";
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <AppLayout currentPath="/search.html" breadcrumbTitle="Search">
      <section className="search-page-container" aria-label="Global search">
        {/* Command Search Bar */}
        <div className="search-command-bar">
          <div className="search-input-wrapper">
            <svg
              className="search-icon"
              viewBox="0 0 24 24"
              width="22"
              height="22"
              aria-hidden="true"
            >
              <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
            </svg>
            <input
              ref={inputRef}
              id="search-input"
              type="search"
              className="search-input"
              placeholder="Search clients, jobs, matches, timeline activity... (Ctrl+K)"
              value={query}
              onInput={(e) => {
                setQuery((e.target as HTMLInputElement).value);
                setPage(1);
              }}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
              onKeyDown={handleResultsKeyDown}
              autoFocus
              aria-label="Search across workspace"
            />
            {query && (
              <button
                className="search-clear-btn"
                aria-label="Clear search input"
                onClick={handleClear}
              >
                ×
              </button>
            )}
            <div className="search-shortcut-badge" aria-hidden="true">
              <kbd>Ctrl+K</kbd>
            </div>
          </div>

          {/* Filter Type Pills */}
          <div
            className="search-filter-pills"
            role="tablist"
            aria-label="Search entity type filters"
          >
            {[
              { label: "All Types", value: "" },
              { label: "Clients", value: "CLIENT" },
              { label: "Jobs", value: "JOB" },
              { label: "Matches", value: "MATCH" },
              { label: "Timeline", value: "TIMELINE" },
            ].map((tab) => {
              const active = selectedType === tab.value;
              return (
                <button
                  key={tab.value}
                  className={`search-filter-pill ${active ? "active" : ""}`}
                  role="tab"
                  aria-selected={active}
                  onClick={() => {
                    setSelectedType(tab.value);
                    setPage(1);
                  }}
                >
                  {tab.label}
                </button>
              );
            })}
            <span className="badge" id="search-total-count">
              {total} {total === 1 ? "result" : "results"}
            </span>
          </div>
        </div>

        {/* Results Area */}
        <div className="search-results-wrapper">
          {loading ? (
            <div className="search-skeleton-feed" id="search-skeleton" aria-live="polite">
              <Skeleton variant="card" className="search-card-skeleton" />
              <Skeleton variant="card" className="search-card-skeleton" />
              <Skeleton variant="card" className="search-card-skeleton" />
            </div>
          ) : error ? (
            <div className="feed-error-state card-like-error" id="search-error" role="alert">
              <div className="error-details-row">
                <svg className="icon icon-error-alert" viewBox="0 0 24 24" width="24" height="24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
                </svg>
                <div>
                  <h2 className="error-card-title">Failed to perform search</h2>
                  <p className="error-card-desc" id="search-error-msg">
                    {error}
                  </p>
                </div>
              </div>
              <button
                className="btn btn-secondary btn-retry-large"
                id="search-retry-btn"
                type="button"
                onClick={() => performSearch(query, selectedType, page)}
              >
                Retry Search
              </button>
            </div>
          ) : !query.trim() ? (
            <div className="empty-state search-empty-initial" id="search-initial">
              <div className="empty-icon-wrap">
                <svg className="icon" viewBox="0 0 24 24" width="40" height="40">
                  <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
                </svg>
              </div>
              <h3 className="empty-title font-display">Discover Workspace Resources</h3>
              <p className="empty-desc">
                Type client names, skills, job titles, or keywords to search across your workspace
                records in real time.
              </p>
            </div>
          ) : results.length === 0 ? (
            <div className="empty-state" id="search-no-results">
              <div className="empty-icon-wrap">
                <svg className="icon" viewBox="0 0 24 24" width="40" height="40">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
                </svg>
              </div>
              <h3 className="empty-title font-display">No results found</h3>
              <p className="empty-desc">
                No workspace items matched "<strong>{query}</strong>". Try a different query or
                switch entity filters.
              </p>
            </div>
          ) : (
            <div className="search-results-list" id="search-results-list" role="list">
              {results.map((item, index) => {
                const targetUrl = getResultUrl(item);
                const isSelected = focusedIndex === index;
                const scorePct = item.relevance?.score
                  ? Math.round(item.relevance.score * 100)
                  : null;

                return (
                  <article
                    key={`${item.resultType}-${item.entityId}-${index}`}
                    className={`search-result-card ${isSelected ? "focused" : ""}`}
                    role="listitem"
                  >
                    <a href={targetUrl} className="search-result-link">
                      <div className="search-result-header">
                        <div className="search-result-type-tag">
                          <span className={`entity-pill pill-${item.resultType.toLowerCase()}`}>
                            {item.resultType}
                          </span>
                        </div>
                        {scorePct !== null && (
                          <span className="search-relevance-score">{scorePct}% match</span>
                        )}
                      </div>

                      <h4 className="search-result-title font-display">{item.display.title}</h4>

                      {item.display.subtitle && (
                        <p className="search-result-subtitle">{item.display.subtitle}</p>
                      )}

                      {item.display.snippet && (
                        <p className="search-result-snippet">{item.display.snippet}</p>
                      )}

                      {item.relevance?.matchedFields && item.relevance.matchedFields.length > 0 && (
                        <div className="search-matched-fields">
                          <span className="matched-fields-label">Matched in:</span>
                          {item.relevance.matchedFields.map((f, i) => (
                            <span key={i} className="field-tag">
                              {f}
                            </span>
                          ))}
                        </div>
                      )}
                    </a>
                  </article>
                );
              })}
            </div>
          )}

          {/* Pagination */}
          {results.length > 0 && total > pageSize && (
            <nav className="clients-pagination search-pagination" aria-label="Search pagination">
              <button
                className="btn btn-secondary clients-page-btn"
                id="search-prev-page"
                type="button"
                disabled={page <= 1 || loading}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </button>
              <span className="clients-page-summary" id="search-page-summary" aria-live="polite">
                Page {page} of {totalPages}
              </span>
              <button
                className="btn btn-secondary clients-page-btn"
                id="search-next-page"
                type="button"
                disabled={page >= totalPages || loading}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </button>
            </nav>
          )}
        </div>
      </section>
    </AppLayout>
  );
};
