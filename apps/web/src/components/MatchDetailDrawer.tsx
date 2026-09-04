import React, { useEffect } from "react";
import type { MatchItem } from "../types/match.js";
import { Button } from "../shared/Button.js";

export interface MatchDetailDrawerProps {
  match: MatchItem | null;
  isOpen: boolean;
  onClose: () => void;
  onArchive?: (matchId: string) => Promise<void>;
  archiving?: boolean;
}

export const MatchDetailDrawer: React.FC<MatchDetailDrawerProps> = ({
  match,
  isOpen,
  onClose,
  onArchive,
  archiving = false,
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !match) return null;

  const breakdown = match.scoreBreakdown || {};
  const skillsPct = Math.round((breakdown.skills ?? 0) * 100);
  const semanticPct =
    typeof breakdown.semantic === "number" ? Math.round(breakdown.semantic * 100) : 0;

  return (
    <div
      id="matching-detail-modal"
      className="matching-detail-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="detail-title"
    >
      <div
        id="matching-detail-backdrop"
        className="matching-detail-backdrop"
        aria-hidden="true"
        onClick={onClose}
      />
      <div className="matching-detail-drawer" id="matching-detail-drawer">
        <header className="detail-header">
          <div className="detail-header-top">
            <div className="detail-tags">
              <span className="platform-tag" id="detail-platform-tag">
                {match.platform || "Upwork"}
              </span>
              <span
                className={`status-badge status-${(match.status || "created").toLowerCase()}`}
                id="detail-status-badge"
              >
                {match.status || "EVALUATED"}
              </span>
              {match.cacheState && (
                <span className="cache-badge" id="detail-cache-badge">
                  {match.cacheState === "CACHED" ? "Cached" : "Fresh"}
                </span>
              )}
            </div>
            <button
              className="detail-close-btn"
              id="matching-detail-close-btn"
              aria-label="Close match details"
              onClick={onClose}
            >
              <svg className="icon" viewBox="0 0 24 24" width="20" height="20">
                <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
              </svg>
            </button>
          </div>

          <div className="detail-title-score-row">
            <h2 className="detail-title font-display" id="detail-title">
              {match.jobTitle || "Job Title"}
            </h2>
            <div className="detail-score-gauge" id="detail-score-gauge">
              <span className="gauge-value" id="detail-score-val">
                {typeof match.score === "number" ? `${match.score}%` : "—"}
              </span>
              <span className="gauge-label">Match</span>
            </div>
          </div>
        </header>

        <div className="detail-body">
          {/* Multidimensional Score Breakdown */}
          <section className="detail-section" aria-labelledby="heading-breakdown">
            <h3 className="detail-section-title font-display" id="heading-breakdown">
              Score Breakdown
            </h3>
            <div className="breakdown-grid" id="detail-score-breakdown">
              <div className="breakdown-item">
                <div className="breakdown-label-row">
                  <span>Skill Coverage</span>
                  <span className="breakdown-val" id="breakdown-skills-val">
                    {skillsPct}%
                  </span>
                </div>
                <div className="progress-bar-wrap">
                  <div
                    className="progress-bar"
                    id="breakdown-skills-bar"
                    style={{ width: `${skillsPct}%` }}
                  />
                </div>
              </div>

              <div className="breakdown-item">
                <div className="breakdown-label-row">
                  <span>Semantic Fit</span>
                  <span className="breakdown-val" id="breakdown-semantic-val">
                    {semanticPct}%
                  </span>
                </div>
                <div className="progress-bar-wrap">
                  <div
                    className="progress-bar"
                    id="breakdown-semantic-bar"
                    style={{ width: `${semanticPct}%` }}
                  />
                </div>
              </div>

              <div className="breakdown-item">
                <div className="breakdown-label-row">
                  <span>Experience Compatibility</span>
                  <span
                    className={`breakdown-status-tag tag-${(breakdown.experience || "unknown").toLowerCase()}`}
                    id="breakdown-exp-tag"
                  >
                    {(breakdown.experience || "UNKNOWN").toUpperCase()}
                  </span>
                </div>
              </div>

              <div className="breakdown-item">
                <div className="breakdown-label-row">
                  <span>Budget Compatibility</span>
                  <span
                    className={`breakdown-status-tag tag-${(breakdown.budget || "unknown").toLowerCase()}`}
                    id="breakdown-budget-tag"
                  >
                    {(breakdown.budget || "UNKNOWN").toUpperCase()}
                  </span>
                </div>
              </div>

              <div className="breakdown-item">
                <div className="breakdown-label-row">
                  <span>Job Type Fit</span>
                  <span
                    className={`breakdown-status-tag tag-${(breakdown.jobType || "unknown").toLowerCase()}`}
                    id="breakdown-jobtype-tag"
                  >
                    {(breakdown.jobType || "UNKNOWN").toUpperCase()}
                  </span>
                </div>
              </div>

              <div className="breakdown-item">
                <div className="breakdown-label-row">
                  <span>Location Fit</span>
                  <span
                    className={`breakdown-status-tag tag-${(breakdown.location || "unknown").toLowerCase()}`}
                    id="breakdown-location-tag"
                  >
                    {(breakdown.location || "UNKNOWN").toUpperCase()}
                  </span>
                </div>
              </div>
            </div>
          </section>

          {/* Match Explanation & Factors */}
          <section className="detail-section" aria-labelledby="heading-explanation">
            <h3 className="detail-section-title font-display" id="heading-explanation">
              Match Explanation
            </h3>
            <p className="detail-explanation-summary" id="detail-explanation-text">
              {match.explanation || "No explanation summary available."}
            </p>

            {/* Strengths */}
            <div className="factor-group" id="factor-strengths-group">
              <h4 className="factor-title factor-title-strengths">
                Strengths &amp; Matched Skills
              </h4>
              <div className="factor-tags" id="detail-strengths-list">
                {match.strengths && match.strengths.length > 0 ? (
                  match.strengths.map((s, i) => (
                    <span key={i} className="factor-chip factor-chip-strength">
                      {s}
                    </span>
                  ))
                ) : (
                  <span className="factor-none">None identified</span>
                )}
              </div>
            </div>

            {/* Gaps */}
            <div className="factor-group" id="factor-gaps-group">
              <h4 className="factor-title factor-title-gaps">Missing Skills &amp; Gaps</h4>
              <div className="factor-tags" id="detail-gaps-list">
                {match.gaps && match.gaps.length > 0 ? (
                  match.gaps.map((g, i) => (
                    <span key={i} className="factor-chip factor-chip-gap">
                      {g}
                    </span>
                  ))
                ) : (
                  <span className="factor-none">None identified</span>
                )}
              </div>
            </div>

            {/* Risks */}
            <div className="factor-group" id="factor-risks-group">
              <h4 className="factor-title factor-title-risks">Compatibility Risks</h4>
              <p className="factor-text" id="detail-risks-text">
                {match.risks || "None identified."}
              </p>
            </div>

            {/* Recommendations */}
            <div className="factor-group" id="factor-recommendations-group">
              <h4 className="factor-title factor-title-recommendations">Recommended Action</h4>
              <p className="factor-text" id="detail-recommendations-text">
                {match.recommendations || "Review job specifications and submit tailored proposal."}
              </p>
            </div>
          </section>

          {/* Job Overview */}
          <section className="detail-section" aria-labelledby="heading-job-context">
            <h3 className="detail-section-title font-display" id="heading-job-context">
              Job Overview
            </h3>
            <p className="detail-job-budget" id="detail-job-budget">
              {match.budget ? `Budget: ${match.budget}` : "Budget: Flexible / Unspecified"}
            </p>
            <p className="detail-job-description" id="detail-job-description">
              {match.jobDescription || "No detailed job description provided."}
            </p>
          </section>
        </div>

        {/* Action Footer */}
        <footer className="detail-footer" id="detail-action-bar">
          {match.canonicalUrl && (
            <a
              href={match.canonicalUrl}
              className="btn btn-primary detail-platform-btn"
              id="detail-platform-link"
              target="_blank"
              rel="noopener noreferrer"
            >
              Open on Platform ↗
            </a>
          )}
          {onArchive && (
            <Button
              variant="secondary"
              id="detail-archive-btn"
              className="detail-archive-btn"
              disabled={match.status === "ARCHIVED" || archiving}
              loading={archiving}
              onClick={() => onArchive(match.id)}
            >
              {match.status === "ARCHIVED" ? "Archived" : "Archive Match"}
            </Button>
          )}
          <Button variant="secondary" id="detail-close-bottom-btn" onClick={onClose}>
            Close
          </Button>
        </footer>
      </div>
    </div>
  );
};
