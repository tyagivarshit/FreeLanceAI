import React, { useState, useEffect, useCallback } from "react";
import { AppLayout } from "../layouts/AppLayout.js";
import { matchingService } from "../services/matchingService.js";
import type { MatchItem } from "../types/match.js";
import { MatchDetailDrawer } from "../components/MatchDetailDrawer.js";
import { Skeleton } from "../shared/Skeleton.js";
import { Button } from "../shared/Button.js";

export const MatchingPage: React.FC = () => {
  const [matches, setMatches] = useState<MatchItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [statusFilter, setStatusFilter] = useState("");
  const [minScoreFilter, setMinScoreFilter] = useState("");
  const [platformFilter, setPlatformFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Selected Match for Detail Drawer
  const [selectedMatch, setSelectedMatch] = useState<MatchItem | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [archiving, setArchiving] = useState(false);

  // Initialize from URL params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const p = parseInt(params.get("page") || "1", 10);
    const s = params.get("status") || "";
    const minS = params.get("minScore") || "";
    const plat = params.get("platform") || "";
    const matchId = params.get("id") || "";

    if (p > 0) setPage(p);
    if (s) setStatusFilter(s);
    if (minS) setMinScoreFilter(minS);
    if (plat) setPlatformFilter(plat);

    if (matchId) {
      matchingService
        .getMatch(matchId)
        .then((res) => {
          if (res.success && res.match) {
            setSelectedMatch(res.match);
            setIsDrawerOpen(true);
          }
        })
        .catch(() => {});
    }
  }, []);

  const loadMatches = useCallback(
    async (p: number, s: string, minS: string, plat: string, signal?: AbortSignal) => {
      setLoading(true);
      setError(null);
      try {
        const params: {
          page: number;
          pageSize: number;
          status?: string;
          minScore?: string | number;
          platform?: string;
          signal?: AbortSignal;
        } = { page: p, pageSize };

        if (s) params.status = s;
        if (minS) params.minScore = minS;
        if (plat) params.platform = plat;
        if (signal) params.signal = signal;

        const res = await matchingService.getMatches(params);
        setMatches(res.matches || []);
        setTotal(res.total || 0);
        setPage(res.page || p);

        // Sync URL
        const urlParams = new URLSearchParams();
        if (p > 1) urlParams.set("page", String(p));
        if (s) urlParams.set("status", s);
        if (minS) urlParams.set("minScore", minS);
        if (plat) urlParams.set("platform", plat);
        const query = urlParams.toString();
        window.history.replaceState(null, "", query ? `/matching.html?${query}` : "/matching.html");
      } catch (err: any) {
        if (err.name === "AbortError") return;
        setError(err.message || "Failed to load job matches");
      } finally {
        setLoading(false);
      }
    },
    [pageSize],
  );

  useEffect(() => {
    const controller = new AbortController();
    loadMatches(page, statusFilter, minScoreFilter, platformFilter, controller.signal);
    return () => controller.abort();
  }, [page, statusFilter, minScoreFilter, platformFilter, loadMatches]);

  const handleOpenDetail = (match: MatchItem) => {
    setSelectedMatch(match);
    setIsDrawerOpen(true);
  };

  const handleArchive = async (matchId: string) => {
    setArchiving(true);
    try {
      const res = await matchingService.archiveMatch(matchId);
      if (res.success) {
        setMatches((prev) =>
          prev.map((m) => (m.id === matchId ? { ...m, status: "ARCHIVED" } : m)),
        );
        if (selectedMatch?.id === matchId) {
          setSelectedMatch((prev) => (prev ? { ...prev, status: "ARCHIVED" } : null));
        }
      }
    } finally {
      setArchiving(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const getScoreRangeClass = (score: number) => {
    if (score >= 90) return "high";
    if (score >= 70) return "medium";
    return "low";
  };

  return (
    <AppLayout
      currentPath="/matching.html"
      breadcrumbTitle="Matching"
      topbarActions={
        <button
          className="topbar-action-btn"
          id="matching-refresh-icon"
          aria-label="Refresh matches"
          onClick={() => loadMatches(page, statusFilter, minScoreFilter, platformFilter)}
        >
          <svg className="icon" viewBox="0 0 24 24" width="20" height="20">
            <path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h8V3l-3.35 3.35z" />
          </svg>
        </button>
      }
    >
      <section className="welcome-section matching-title-row" aria-label="Matching heading">
        <div>
          <h1 className="welcome-title font-display">Job Matching Center</h1>
          <p className="welcome-subtitle">
            Review ranked opportunities evaluated by FreelanceOS matching intelligence.
          </p>
        </div>
        <button
          className="btn btn-secondary matching-refresh-btn"
          id="matching-refresh-btn"
          type="button"
          onClick={() => loadMatches(page, statusFilter, minScoreFilter, platformFilter)}
        >
          Refresh
        </button>
      </section>

      {/* Toolbar Filters */}
      <section className="matching-toolbar" aria-label="Job match filters">
        <div className="filter-group">
          <label htmlFor="matching-status-filter">Status</label>
          <select
            id="matching-status-filter"
            className="matching-select"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All statuses</option>
            <option value="EVALUATED">Evaluated</option>
            <option value="CREATED">Created</option>
            <option value="ARCHIVED">Archived</option>
          </select>
        </div>

        <div className="filter-group">
          <label htmlFor="matching-score-filter">Min Score</label>
          <select
            id="matching-score-filter"
            className="matching-select"
            value={minScoreFilter}
            onChange={(e) => {
              setMinScoreFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All scores</option>
            <option value="90">90% and above</option>
            <option value="75">75% and above</option>
            <option value="50">50% and above</option>
          </select>
        </div>

        <div className="filter-group">
          <label htmlFor="matching-platform-filter">Platform</label>
          <select
            id="matching-platform-filter"
            className="matching-select"
            value={platformFilter}
            onChange={(e) => {
              setPlatformFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All platforms</option>
            <option value="upwork">Upwork</option>
            <option value="linkedin">LinkedIn</option>
          </select>
        </div>

        <span className="badge" id="matches-count">
          {total} {total === 1 ? "match" : "matches"}
        </span>
      </section>

      {/* Matches Feed / Grid */}
      <section className="matching-list-shell" aria-label="Matches feed">
        {loading ? (
          <div className="matching-skeleton-feed" id="matching-skeleton" aria-live="polite">
            <Skeleton variant="card" className="matching-card-skeleton" />
            <Skeleton variant="card" className="matching-card-skeleton" />
            <Skeleton variant="card" className="matching-card-skeleton" />
          </div>
        ) : error ? (
          <div className="feed-error-state card-like-error" id="matching-error" role="alert">
            <div className="error-details-row">
              <svg className="icon icon-error-alert" viewBox="0 0 24 24" width="24" height="24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
              </svg>
              <div>
                <h2 className="error-card-title">Failed to load matches</h2>
                <p className="error-card-desc" id="matching-error-msg">
                  {error}
                </p>
              </div>
            </div>
            <button
              className="btn btn-secondary btn-retry-large"
              id="matching-error-retry"
              type="button"
              onClick={() => loadMatches(page, statusFilter, minScoreFilter, platformFilter)}
            >
              Retry loading matches
            </button>
          </div>
        ) : matches.length === 0 ? (
          <div className="empty-state" id="matching-empty">
            <div className="empty-icon-wrap">
              <svg className="icon" viewBox="0 0 24 24" width="40" height="40">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />
              </svg>
            </div>
            <h2 className="empty-title font-display">No matches found</h2>
            <p className="empty-desc">
              Try adjusting your filter criteria or scanning new jobs from the opportunity
              dashboard.
            </p>
            <a href="/dashboard.html" className="btn btn-secondary empty-cta">
              Go to Dashboard
            </a>
          </div>
        ) : (
          <div className="matching-grid" id="matching-list" role="list">
            {matches.map((match) => {
              const scoreClass = getScoreRangeClass(match.score);
              return (
                <article
                  key={match.id}
                  className={`match-card status-${(match.status || "created").toLowerCase()}`}
                  role="listitem"
                  id={`match-card-${match.id}`}
                >
                  <div className="match-card-header">
                    <div className="match-card-meta">
                      <span className="platform-tag">{match.platform || "Upwork"}</span>
                      <span
                        className={`status-badge status-${(match.status || "created").toLowerCase()}`}
                      >
                        {match.status || "EVALUATED"}
                      </span>
                    </div>
                    <div className={`score-badge score-${scoreClass}`}>{match.score}% Match</div>
                  </div>

                  <h3 className="match-card-title font-display">{match.jobTitle}</h3>

                  {match.explanation && (
                    <p className="match-card-explanation">{match.explanation}</p>
                  )}

                  {match.strengths && match.strengths.length > 0 && (
                    <div className="match-card-chips">
                      {match.strengths.slice(0, 3).map((s, idx) => (
                        <span key={idx} className="match-chip chip-strength">
                          {s}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="match-card-footer">
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => handleOpenDetail(match)}
                      aria-label={`View match breakdown for ${match.jobTitle}`}
                    >
                      View Explanation
                    </Button>
                    {match.canonicalUrl && (
                      <a
                        href={match.canonicalUrl}
                        className="btn btn-secondary btn-sm"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Open Job ↗
                      </a>
                    )}
                    <button
                      className="btn-archive-icon"
                      aria-label="Archive match"
                      title="Archive match"
                      disabled={match.status === "ARCHIVED"}
                      onClick={() => handleArchive(match.id)}
                    >
                      <svg className="icon" viewBox="0 0 24 24" width="16" height="16">
                        <path d="M20.54 5.23l-1.39-1.68C18.88 3.21 18.47 3 18 3H6c-.47 0-.88.21-1.16.55L3.46 5.23C3.17 5.57 3 6.02 3 6.5V19c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V6.5c0-.48-.17-.93-.46-1.27zM12 17.5L6.5 12H10v-2h4v2h3.5L12 17.5zM5.12 5l.81-1h12l.94 1H5.12z" />
                      </svg>
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* Pagination */}
      <nav className="clients-pagination" aria-label="Matches pagination">
        <button
          className="btn btn-secondary clients-page-btn"
          id="matching-prev-page"
          type="button"
          disabled={page <= 1 || loading}
          onClick={() => setPage((p) => Math.max(1, p - 1))}
        >
          Previous
        </button>
        <span className="clients-page-summary" id="matching-page-summary" aria-live="polite">
          Page {page} of {totalPages}
        </span>
        <button
          className="btn btn-secondary clients-page-btn"
          id="matching-next-page"
          type="button"
          disabled={page >= totalPages || loading}
          onClick={() => setPage((p) => p + 1)}
        >
          Next
        </button>
      </nav>

      {/* Detail Slide-out Drawer */}
      <MatchDetailDrawer
        match={selectedMatch}
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        onArchive={handleArchive}
        archiving={archiving}
      />
    </AppLayout>
  );
};
