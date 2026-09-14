/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect, useCallback } from "react";
import { AppLayout } from "../layouts/AppLayout.js";
import { useAuth } from "../hooks/useAuth.js";
import { dashboardService } from "../services/dashboardService.js";
import { Skeleton } from "../shared/Skeleton.js";
import { Button } from "../shared/Button.js";
export const DashboardPage = () => {
    const { user } = useAuth();
    const emailPrefix = user?.email ? user.email.split("@")[0] : "";
    const displayName = emailPrefix && emailPrefix.length > 0
        ? emailPrefix.charAt(0).toUpperCase() + emailPrefix.slice(1)
        : "Freelancer";
    // KPIs
    const [scannedKpi, setScannedKpi] = useState({
        data: null,
        loading: true,
        error: false,
    });
    const [matchesKpi, setMatchesKpi] = useState({
        data: null,
        loading: true,
        error: false,
    });
    const [proposalsKpi, setProposalsKpi] = useState({
        data: null,
        loading: true,
        error: false,
    });
    // Pulse
    const [pulse, setPulse] = useState({
        data: null,
        loading: true,
        error: false,
    });
    // Opportunities / Jobs Feed
    const [jobs, setJobs] = useState([]);
    const [jobsLoading, setJobsLoading] = useState(true);
    const [jobsError, setJobsError] = useState(null);
    const [matchingJobId, setMatchingJobId] = useState(null);
    // Usage & Quota limits
    const [entitlements, setEntitlements] = useState(null);
    const [entitlementsLoading, setEntitlementsLoading] = useState(true);
    const [entitlementsError, setEntitlementsError] = useState(false);
    // Activity Timeline
    const [activities, setActivities] = useState([]);
    const [activityLoading, setActivityLoading] = useState(true);
    const [activityError, setActivityError] = useState(false);
    // Load KPI
    const loadScanned = useCallback(async (signal) => {
        setScannedKpi((prev) => ({ ...prev, loading: true, error: false }));
        try {
            const data = await dashboardService.getScannedKpi(signal);
            setScannedKpi({ data, loading: false, error: false });
        }
        catch (err) {
            if (err?.name === "AbortError" || signal?.aborted)
                return;
            setScannedKpi({ data: null, loading: false, error: true });
        }
    }, []);
    const loadMatches = useCallback(async (signal) => {
        setMatchesKpi((prev) => ({ ...prev, loading: true, error: false }));
        try {
            const data = await dashboardService.getMatchesKpi(signal);
            setMatchesKpi({ data, loading: false, error: false });
        }
        catch (err) {
            if (err?.name === "AbortError" || signal?.aborted)
                return;
            setMatchesKpi({ data: null, loading: false, error: true });
        }
    }, []);
    const loadProposals = useCallback(async (signal) => {
        setProposalsKpi((prev) => ({ ...prev, loading: true, error: false }));
        try {
            const data = await dashboardService.getProposalsKpi(signal);
            setProposalsKpi({ data, loading: false, error: false });
        }
        catch (err) {
            if (err?.name === "AbortError" || signal?.aborted)
                return;
            setProposalsKpi({ data: null, loading: false, error: true });
        }
    }, []);
    // Load Pulse
    const loadPulse = useCallback(async (signal) => {
        setPulse((prev) => ({ ...prev, loading: true, error: false }));
        try {
            const data = await dashboardService.getPulse(signal);
            setPulse({ data, loading: false, error: false });
        }
        catch (err) {
            if (err?.name === "AbortError" || signal?.aborted)
                return;
            setPulse({ data: null, loading: false, error: true });
        }
    }, []);
    // Load Opportunities
    const loadJobs = useCallback(async (signal) => {
        setJobsLoading(true);
        setJobsError(null);
        try {
            const res = await dashboardService.getJobs(signal);
            setJobs(res.jobs || []);
        }
        catch (err) {
            if (err?.name === "AbortError" || signal?.aborted)
                return;
            setJobsError(err?.message || "Failed to load opportunities");
        }
        finally {
            if (!signal?.aborted) {
                setJobsLoading(false);
            }
        }
    }, []);
    // Load Usage / Entitlements
    const loadUsage = useCallback(async (signal) => {
        setEntitlementsLoading(true);
        setEntitlementsError(false);
        try {
            const res = await dashboardService.getEntitlements(signal);
            setEntitlements(res);
        }
        catch (err) {
            if (err?.name === "AbortError" || signal?.aborted)
                return;
            setEntitlementsError(true);
        }
        finally {
            if (!signal?.aborted) {
                setEntitlementsLoading(false);
            }
        }
    }, []);
    // Load Activity
    const loadActivity = useCallback(async (signal) => {
        setActivityLoading(true);
        setActivityError(false);
        try {
            const res = await dashboardService.getActivity(signal);
            setActivities(res.activity || []);
        }
        catch (err) {
            if (err?.name === "AbortError" || signal?.aborted)
                return;
            setActivityError(true);
        }
        finally {
            if (!signal?.aborted) {
                setActivityLoading(false);
            }
        }
    }, []);
    useEffect(() => {
        const controller = new AbortController();
        const { signal } = controller;
        loadScanned(signal);
        loadMatches(signal);
        loadProposals(signal);
        loadPulse(signal);
        loadJobs(signal);
        loadUsage(signal);
        loadActivity(signal);
        return () => controller.abort();
    }, [loadScanned, loadMatches, loadProposals, loadPulse, loadJobs, loadUsage, loadActivity]);
    // Handle Run Match
    const handleRunMatch = async (jobId) => {
        setMatchingJobId(jobId);
        try {
            const res = await dashboardService.runJobMatch(jobId);
            if (res.score !== undefined) {
                setJobs((prev) => prev.map((j) => j.id === jobId
                    ? {
                        ...j,
                        score: res.score,
                        matchExplanation: res.matchExplanation || `Matched with score ${res.score}%.`,
                    }
                    : j));
                // Refresh dependencies
                loadMatches();
                loadUsage();
                loadActivity();
            }
        }
        catch {
            // Error handled
        }
        finally {
            setMatchingJobId(null);
        }
    };
    const getScoreRangeClass = (score) => {
        if (score >= 90)
            return "high";
        if (score >= 70)
            return "medium";
        return "low";
    };
    const formatRelativeTime = (dateInput) => {
        if (!dateInput)
            return "just now";
        const date = new Date(dateInput);
        const now = new Date();
        const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);
        if (diffSec < 60)
            return "just now";
        const diffMin = Math.floor(diffSec / 60);
        if (diffMin < 60)
            return `${diffMin}m ago`;
        const diffHr = Math.floor(diffMin / 60);
        if (diffHr < 24)
            return `${diffHr}h ago`;
        const diffDays = Math.floor(diffHr / 24);
        return `${diffDays}d ago`;
    };
    return (<AppLayout currentPath="/dashboard.html" breadcrumbTitle="Dashboard">
      {/* Welcome Header */}
      <section className="welcome-section" aria-label="User greeting">
        <h1 className="welcome-title font-display" id="welcome-message">
          Good morning, {displayName}
        </h1>
        <p className="welcome-subtitle">Here's what your freelance pipeline looks like today.</p>
      </section>

      {/* KPI metrics container */}
      <section className="kpi-grid" aria-label="Key Performance Indicators" id="kpi-grid">
        {/* Jobs Scanned */}
        <div className="metric-card" id="metric-scanned">
          <div className="metric-card-header">
            <span className="metric-label">Jobs Scanned</span>
            <div className="metric-icon-wrap">
              <svg className="icon" viewBox="0 0 24 24" width="18" height="18">
                <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14zM7 10h2v7H7zm4-3h2v10h-2zm4 6h2v4h-2z"/>
              </svg>
            </div>
          </div>
          <div className="metric-body">
            {scannedKpi.loading ? (<Skeleton variant="card" className="metric-skeleton"/>) : scannedKpi.error ? (<div className="component-error" id="kpi-scanned-error">
                <span className="error-msg">Failed to load</span>
                <button className="btn-retry" aria-label="Retry loading jobs scanned" onClick={() => loadScanned()}>
                  Retry
                </button>
              </div>) : (<div className="metric-val-wrap">
                <span className="metric-value" id="kpi-scanned-val">
                  {scannedKpi.data?.value ?? 0}
                </span>
                <span className="metric-trend trend-neutral" id="kpi-scanned-trend">
                  {scannedKpi.data?.trend || "No trend"}
                </span>
              </div>)}
          </div>
        </div>

        {/* Strong Matches */}
        <div className="metric-card" id="metric-matches">
          <div className="metric-card-header">
            <span className="metric-label">Strong Matches</span>
            <div className="metric-icon-wrap">
              <svg className="icon" viewBox="0 0 24 24" width="18" height="18">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
              </svg>
            </div>
          </div>
          <div className="metric-body">
            {matchesKpi.loading ? (<Skeleton variant="card" className="metric-skeleton"/>) : matchesKpi.error ? (<div className="component-error" id="kpi-matches-error">
                <span className="error-msg">Failed to load</span>
                <button className="btn-retry" aria-label="Retry loading matches" onClick={() => loadMatches()}>
                  Retry
                </button>
              </div>) : (<div className="metric-val-wrap">
                <span className="metric-value" id="kpi-matches-val">
                  {matchesKpi.data?.value ?? 0}
                </span>
                <span className="metric-trend trend-neutral" id="kpi-matches-trend">
                  {matchesKpi.data?.trend || "No trend"}
                </span>
              </div>)}
          </div>
        </div>

        {/* AI Proposals */}
        <div className="metric-card" id="metric-proposals">
          <div className="metric-card-header">
            <span className="metric-label">AI Proposals</span>
            <div className="metric-icon-wrap">
              <svg className="icon" viewBox="0 0 24 24" width="18" height="18">
                <path d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 9h12v2H6V9zm8 5H6v-2h8v2zm4-6H6V6h12v2z"/>
              </svg>
            </div>
          </div>
          <div className="metric-body">
            {proposalsKpi.loading ? (<Skeleton variant="card" className="metric-skeleton"/>) : proposalsKpi.error ? (<div className="component-error" id="kpi-proposals-error">
                <span className="error-msg">Failed to load</span>
                <button className="btn-retry" aria-label="Retry loading proposals" onClick={() => loadProposals()}>
                  Retry
                </button>
              </div>) : (<div className="metric-val-wrap">
                <span className="metric-value" id="kpi-proposals-val">
                  {proposalsKpi.data?.value ?? 0}
                </span>
                <span className="metric-trend trend-neutral" id="kpi-proposals-trend">
                  {proposalsKpi.data?.trend || "No trend"}
                </span>
              </div>)}
          </div>
        </div>
      </section>

      {/* Opportunity Pulse Section */}
      <section className="pulse-container" aria-label="Opportunity Pulse">
        <div className="pulse-card">
          <div className="pulse-left">
            <div className="pulse-indicator">
              <div className="pulse-ping"/>
              <div className="pulse-dot"/>
            </div>
            <div className="pulse-details">
              <h2 className="pulse-title font-display">AI Opportunity Pulse</h2>
              {pulse.loading ? (<Skeleton variant="text" className="pulse-skeleton" id="pulse-skeleton"/>) : pulse.error ? (<div className="component-error" id="pulse-error">
                  <span className="error-msg">API connection missing</span>
                  <button className="btn-retry" aria-label="Retry pulse scan details" onClick={() => loadPulse()}>
                    Retry
                  </button>
                </div>) : (<p className="pulse-description" id="pulse-desc">
                  {pulse.data?.description ||
                "Scans are active. We're matching candidates against your experience."}
                </p>)}
            </div>
          </div>
          <div className="pulse-right">
            <a href="/matching.html" className="pulse-cta" id="pulse-cta-link">
              <span>View matches</span>
              <svg className="icon icon-arrow" viewBox="0 0 24 24" width="16" height="16">
                <path d="M8.59 16.59L13.17 12 8.59 7.41L10 6l6 6-6 6-1.41-1.41z"/>
              </svg>
            </a>
          </div>
        </div>
      </section>

      {/* Main 2-Column Grid */}
      <div className="dashboard-grid">
        {/* Left: Top Opportunities Feed */}
        <section className="feed-column" aria-label="Top Opportunities">
          <div className="section-header">
            <h3 className="section-title font-display">Top Opportunities</h3>
            <span className="badge" id="opportunities-count">
              {jobsLoading ? "Loading..." : `${jobs.length} found`}
            </span>
          </div>

          {jobsLoading ? (<div className="skeleton-feed" id="skeleton-feed">
              <Skeleton variant="card" className="card-skeleton"/>
              <Skeleton variant="card" className="card-skeleton"/>
              <Skeleton variant="card" className="card-skeleton"/>
            </div>) : jobsError ? (<div className="feed-error-state card-like-error" id="opportunities-error">
              <div className="error-details-row">
                <svg className="icon icon-error-alert" viewBox="0 0 24 24" width="24" height="24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
                </svg>
                <div>
                  <h4 className="error-card-title">Failed to load opportunities</h4>
                  <p className="error-card-desc" id="opportunities-error-msg">
                    {jobsError}
                  </p>
                </div>
              </div>
              <button className="btn btn-secondary btn-retry-large" id="btn-opportunities-retry" onClick={() => loadJobs()}>
                Retry loading feed
              </button>
            </div>) : jobs.length === 0 ? (<div className="empty-state" id="opportunities-empty">
              <div className="empty-icon-wrap">
                <svg className="icon" viewBox="0 0 24 24" width="40" height="40">
                  <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 14H4V8h16v10z"/>
                </svg>
              </div>
              <h4 className="empty-title font-display">Your opportunity feed is empty</h4>
              <p className="empty-desc">
                Connect a platform or run your first job search scanning query to discover matches.
              </p>
              <a href="/search.html" className="btn btn-secondary empty-cta">
                Run first search
              </a>
            </div>) : (<div className="opportunities-list" id="opportunities-list">
              {jobs.map((job) => {
                const hasScore = typeof job.score === "number" && job.score !== null;
                const isMatching = matchingJobId === job.id;
                return (<div key={job.id} className="opportunity-card" id={`opp-card-${job.id}`}>
                    <div className="opp-card-header">
                      <div>
                        <h4 className="opp-title font-display">{job.title}</h4>
                        <span className="opp-meta">
                          {job.platform || "Upwork"} &middot; {formatRelativeTime(job.createdAt)}
                        </span>
                      </div>
                      {hasScore && (<div className={`match-score-pill score-${getScoreRangeClass(job.score)}`}>
                          {job.score}% match
                        </div>)}
                    </div>

                    <div className="opp-body">
                      <div className="skills-wrap">
                        {job.skills?.map((skill, i) => (<span key={i} className="skill-badge">
                            {skill}
                          </span>))}
                      </div>

                      {job.matchExplanation && (<div className="opp-explanation">
                          <strong>Why it fits:</strong> {job.matchExplanation}
                        </div>)}

                      <div className="opp-footer">
                        {job.budget && <span className="opp-budget">{job.budget}</span>}
                        {hasScore ? (<a href={`/matching.html?id=${job.id}`} className="btn btn-secondary btn-sm">
                            View match details
                          </a>) : isMatching ? (<Button variant="secondary" size="sm" disabled loading>
                            Matching...
                          </Button>) : (<Button variant="primary" size="sm" className="btn-run-match" onClick={() => handleRunMatch(job.id)}>
                            Run Match
                          </Button>)}
                      </div>
                    </div>
                  </div>);
            })}
            </div>)}
        </section>

        {/* Right: Widgets Column */}
        <div className="widgets-column">
          {/* Plan & Usage Widget */}
          <section className="widget-card" aria-label="Subscription and Usage Limits">
            <div className="widget-header">
              <h3 className="widget-title font-display">Plan &amp; Quota Limits</h3>
              <span className="plan-badge" id="plan-badge-val">
                {entitlements?.planId || "STARTER"}
              </span>
            </div>
            <div className="widget-body">
              {entitlementsLoading ? (<Skeleton variant="card" className="usage-skeleton" id="usage-skeleton"/>) : entitlementsError ? (<div className="component-error" id="usage-error">
                  <span className="error-msg">Failed to resolve billing details</span>
                  <button className="btn-retry" id="btn-usage-retry" onClick={() => loadUsage()}>
                    Retry
                  </button>
                </div>) : (<div className="usage-details-wrap" id="usage-details">
                  <div className="quota-row">
                    <div className="quota-labels">
                      <span className="quota-name">AI Proposal Quota</span>
                      <span className="quota-values" id="proposal-quota-fraction">
                        {entitlements?.limits?.aiProposals?.type === "LIMITED"
                ? `${entitlements.usage?.aiProposals ?? 0} / ${entitlements.limits.aiProposals.value}`
                : "∞ Unlimited"}
                      </span>
                    </div>
                    <div className="progress-track">
                      <div className="progress-fill" id="proposal-progress-bar" style={{
                width: `${entitlements?.limits?.aiProposals?.type === "LIMITED" &&
                    entitlements.limits.aiProposals.value
                    ? Math.min(100, ((entitlements.usage?.aiProposals ?? 0) /
                        entitlements.limits.aiProposals.value) *
                        100)
                    : 100}%`,
            }}/>
                    </div>
                    <p className="quota-desc" id="proposal-quota-remaining-desc">
                      {entitlements?.limits?.aiProposals?.type === "LIMITED" &&
                entitlements.limits.aiProposals.value
                ? `${Math.max(0, entitlements.limits.aiProposals.value -
                    (entitlements.usage?.aiProposals ?? 0))} remaining`
                : "Unlimited proposals available on this plan."}
                    </p>
                  </div>

                  <div className="billing-status-row">
                    <div className="billing-status-label" id="billing-status-val">
                      {entitlements?.source === "TRIAL"
                ? `${entitlements.trialDaysRemaining ?? 7} days remaining in your free Pro trial.`
                : entitlements?.source === "SUBSCRIPTION"
                    ? "Your paid subscription is active."
                    : "Starter plan is active."}
                    </div>
                    <a href="/billing.html" className="billing-action-link">
                      Manage plan &rarr;
                    </a>
                  </div>
                </div>)}
            </div>
          </section>

          {/* Recent Activity Timeline Widget */}
          <section className="widget-card" aria-label="Recent Activity">
            <div className="widget-header">
              <h3 className="widget-title font-display">Recent Activity</h3>
            </div>
            <div className="widget-body">
              {activityLoading ? (<Skeleton variant="card" className="activity-skeleton" id="activity-skeleton"/>) : activityError ? (<div className="component-error" id="activity-error">
                  <span className="error-msg">Failed to retrieve activity logs</span>
                  <button className="btn-retry" id="btn-activity-retry" onClick={() => loadActivity()}>
                    Retry
                  </button>
                </div>) : activities.length === 0 ? (<div className="empty-state timeline-empty" id="activity-empty">
                  <p className="empty-desc">No activity recorded yet in your workspace.</p>
                </div>) : (<div className="activity-timeline" id="activity-timeline">
                  {activities.map((log, index) => (<div key={index} className="timeline-item">
                      <div className="timeline-dot"/>
                      <div className="timeline-content">
                        <p className="timeline-text">{log.message}</p>
                        <span className="timeline-time">{formatRelativeTime(log.timestamp)}</span>
                      </div>
                    </div>))}
                </div>)}
            </div>
          </section>
        </div>
      </div>
    </AppLayout>);
};
