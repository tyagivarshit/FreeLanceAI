/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect, useCallback } from "react";
import { AppLayout } from "../layouts/AppLayout.js";
import { clientsService } from "../services/clientsService.js";
import { Skeleton } from "../shared/Skeleton.js";
export const ClientDetailPage = () => {
    const [clientId, setClientId] = useState("");
    const [client, setClient] = useState(null);
    const [clientLoading, setClientLoading] = useState(true);
    const [clientError, setClientError] = useState(null);
    const [notFound, setNotFound] = useState(false);
    // Timeline state
    const [timeline, setTimeline] = useState(null);
    const [timelineLoading, setTimelineLoading] = useState(true);
    const [timelineError, setTimelineError] = useState(null);
    const [timelinePage, setTimelinePage] = useState(1);
    // Resolve clientId from URL
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const queryId = params.get("id");
        if (queryId) {
            setClientId(queryId.trim());
            return;
        }
        const match = window.location.pathname.match(/^\/clients\/([^/]+)$/);
        if (match && match[1]) {
            setClientId(decodeURIComponent(match[1]).trim());
        }
    }, []);
    const loadClient = useCallback(async (id, signal) => {
        if (!id)
            return;
        setClientLoading(true);
        setClientError(null);
        setNotFound(false);
        try {
            const res = await clientsService.getClient(id, signal);
            if (res.success && res.client) {
                setClient(res.client);
                document.title = `${res.client.name} — FreelanceOS`;
            }
        }
        catch (err) {
            if (err.name === "AbortError")
                return;
            if (err.statusCode === 404 || err.name === "NotFoundError") {
                setNotFound(true);
            }
            else {
                setClientError(err.message || "Failed to load client details");
            }
        }
        finally {
            setClientLoading(false);
        }
    }, []);
    const loadTimeline = useCallback(async (id, page, signal) => {
        if (!id)
            return;
        setTimelineLoading(true);
        setTimelineError(null);
        try {
            const params = {
                page,
                pageSize: 20,
            };
            if (signal)
                params.signal = signal;
            const res = await clientsService.getClientTimeline(id, params);
            if (res.success && res.timeline) {
                setTimeline(res.timeline);
            }
        }
        catch (err) {
            if (err.name === "AbortError")
                return;
            setTimelineError(err.message || "Failed to retrieve client timeline.");
        }
        finally {
            setTimelineLoading(false);
        }
    }, []);
    useEffect(() => {
        if (!clientId)
            return;
        const controller = new AbortController();
        loadClient(clientId, controller.signal);
        loadTimeline(clientId, timelinePage, controller.signal);
        return () => controller.abort();
    }, [clientId, timelinePage, loadClient, loadTimeline]);
    const formatDate = (dateValue) => {
        if (!dateValue)
            return "Unavailable";
        const date = new Date(dateValue);
        if (Number.isNaN(date.getTime()))
            return "Unavailable";
        return date.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
        });
    };
    const formatDateTime = (dateValue) => {
        const date = new Date(dateValue);
        if (Number.isNaN(date.getTime()))
            return "Unavailable";
        return date.toLocaleString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
            hour: "numeric",
            minute: "2-digit",
        });
    };
    const timelineTotalPages = timeline
        ? Math.max(1, Math.ceil(timeline.total / timeline.pageSize))
        : 1;
    return (<AppLayout currentPath="/clients.html" breadcrumbTitle={client?.name || "Detail"} parentBreadcrumb={{ label: "Clients", href: "/clients.html" }} topbarActions={<button className="topbar-action-btn" id="client-detail-refresh-icon" aria-label="Refresh client" onClick={() => {
                loadClient(clientId);
                loadTimeline(clientId, timelinePage);
            }}>
          <svg className="icon" viewBox="0 0 24 24" width="20" height="20">
            <path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h8V3l-3.35 3.35z"/>
          </svg>
        </button>}>
      <section className="welcome-section client-detail-title-row" aria-label="Client detail heading">
        <div>
          <a href="/clients.html" className="back-link" id="client-detail-back-link">
            &larr; Back to Clients
          </a>
          <h1 className="welcome-title font-display" id="client-detail-title">
            {client?.name || "Client Detail"}
          </h1>
          <p className="welcome-subtitle" id="client-detail-subtitle">
            Review this client relationship.
          </p>
        </div>
        <button className="btn btn-secondary client-detail-refresh-btn" id="client-detail-refresh-btn" type="button" onClick={() => {
            loadClient(clientId);
            loadTimeline(clientId, timelinePage);
        }}>
          Refresh
        </button>
      </section>

      <section className="client-detail-shell" aria-label="Client detail">
        {clientLoading ? (<div className="client-detail-skeleton" id="client-detail-skeleton" aria-live="polite">
            <Skeleton variant="card" className="client-detail-hero-skeleton"/>
            <div className="client-detail-grid">
              <Skeleton variant="card" className="client-detail-card-skeleton"/>
              <Skeleton variant="card" className="client-detail-card-skeleton"/>
            </div>
          </div>) : notFound ? (<div className="empty-state client-detail-not-found" id="client-detail-not-found" role="status">
            <div className="empty-icon-wrap">
              <svg className="icon" viewBox="0 0 24 24" width="40" height="40">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
              </svg>
            </div>
            <h2 className="empty-title font-display">Client not found</h2>
            <p className="empty-desc" id="client-detail-not-found-msg">
              This client could not be found for your workspace.
            </p>
            <a href="/clients.html" className="btn btn-secondary empty-cta">
              Back to Clients
            </a>
          </div>) : clientError ? (<div className="feed-error-state card-like-error" id="client-detail-error" role="alert">
            <div className="error-details-row">
              <svg className="icon icon-error-alert" viewBox="0 0 24 24" width="24" height="24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
              </svg>
              <div>
                <h2 className="error-card-title">Failed to load client</h2>
                <p className="error-card-desc" id="client-detail-error-msg">
                  {clientError}
                </p>
              </div>
            </div>
            <button className="btn btn-secondary btn-retry-large" id="client-detail-error-retry" type="button" onClick={() => loadClient(clientId)}>
              Retry loading client
            </button>
          </div>) : client ? (<article className="client-detail-panel" id="client-detail-panel">
            {/* Hero Header */}
            <div className="client-detail-hero">
              <div className="client-avatar client-detail-avatar" id="client-detail-avatar" aria-hidden="true">
                {client.name.charAt(0).toUpperCase()}
              </div>
              <div className="client-detail-heading-copy">
                <h2 className="client-detail-name font-display" id="client-detail-name">
                  {client.name}
                </h2>
                <p className="client-detail-contact" id="client-detail-contact">
                  {client.email || "Contact unavailable"}
                </p>
              </div>
              <span className={`client-status status-${(client.status || "unknown").toLowerCase()}`} id="client-detail-status">
                {client.status}
              </span>
            </div>

            {/* Grid for Profile and Metadata */}
            <div className="client-detail-grid">
              <section className="client-detail-section" aria-labelledby="client-profile-heading">
                <h3 className="client-detail-section-title font-display" id="client-profile-heading">
                  Profile
                </h3>
                <dl className="client-detail-fields">
                  <div className="client-detail-field-row">
                    <dt>Email</dt>
                    <dd id="client-detail-email">
                      {client.email ? (<a href={`mailto:${client.email}`} className="client-detail-value-link">
                          {client.email}
                        </a>) : ("Not provided")}
                    </dd>
                  </div>
                  <div className="client-detail-field-row">
                    <dt>Website</dt>
                    <dd id="client-detail-website">
                      {client.website ? (<a href={client.website} className="client-detail-value-link" target="_blank" rel="noopener noreferrer">
                          {client.website}
                        </a>) : ("Not provided")}
                    </dd>
                  </div>
                  <div className="client-detail-field-row">
                    <dt>Phone</dt>
                    <dd id="client-detail-phone">{client.phone || "Not provided"}</dd>
                  </div>
                </dl>
              </section>

              <section className="client-detail-section" aria-labelledby="client-metadata-heading">
                <h3 className="client-detail-section-title font-display" id="client-metadata-heading">
                  Metadata
                </h3>
                <dl className="client-detail-fields">
                  <div className="client-detail-field-row">
                    <dt>Created</dt>
                    <dd id="client-detail-created">{formatDate(client.createdAt)}</dd>
                  </div>
                  <div className="client-detail-field-row">
                    <dt>Updated</dt>
                    <dd id="client-detail-updated">{formatDate(client.updatedAt)}</dd>
                  </div>
                </dl>
              </section>
            </div>

            {/* Client Timeline Section */}
            <section className="client-detail-section client-timeline-section" aria-labelledby="client-timeline-heading">
              <div className="client-timeline-header">
                <div>
                  <h3 className="client-detail-section-title font-display" id="client-timeline-heading">
                    Timeline
                  </h3>
                  <p className="client-timeline-subtitle">
                    Recent events recorded for this client.
                  </p>
                </div>
                <span className="badge" id="client-timeline-count">
                  {timeline?.total ?? 0} {timeline?.total === 1 ? "event" : "events"}
                </span>
              </div>

              {timelineLoading ? (<div className="client-timeline-skeleton" id="client-timeline-skeleton" aria-live="polite">
                  <Skeleton variant="row" className="client-timeline-row-skeleton"/>
                  <Skeleton variant="row" className="client-timeline-row-skeleton"/>
                </div>) : timelineError ? (<div className="component-error" id="client-timeline-error" role="alert">
                  <span className="error-msg" id="client-timeline-error-msg">
                    {timelineError}
                  </span>
                  <button className="btn-retry" id="client-timeline-retry" type="button" onClick={() => loadTimeline(clientId, timelinePage)}>
                    Retry
                  </button>
                </div>) : !timeline || timeline.entries.length === 0 ? (<div className="empty-state timeline-empty" id="client-timeline-empty">
                  <p className="empty-desc">
                    No timeline events have been recorded for this client yet.
                  </p>
                </div>) : (<div className="activity-timeline client-timeline-list" id="client-timeline-list" role="list">
                  {timeline.entries.map((entry) => (<article key={entry.id} className="timeline-item client-timeline-item" role="listitem" aria-label={`${entry.category} on ${formatDateTime(entry.timestamp)}`}>
                      <div className="timeline-dot" aria-hidden="true"/>
                      <div className="timeline-content">
                        <p className="timeline-text">{entry.message || entry.category}</p>
                        <span className="timeline-time">
                          {entry.category} - {formatDateTime(entry.timestamp)}
                        </span>
                      </div>
                    </article>))}
                </div>)}

              {/* Timeline Pagination */}
              {timeline && timeline.total > timeline.pageSize && (<nav className="clients-pagination client-timeline-pagination" aria-label="Client timeline pagination">
                  <button className="btn btn-secondary clients-page-btn" id="client-timeline-prev" type="button" disabled={timelinePage <= 1 || timelineLoading} onClick={() => setTimelinePage((p) => Math.max(1, p - 1))}>
                    Previous
                  </button>
                  <span className="clients-page-summary" id="client-timeline-page-summary" aria-live="polite">
                    Page {timelinePage} of {timelineTotalPages}
                  </span>
                  <button className="btn btn-secondary clients-page-btn" id="client-timeline-next" type="button" disabled={timelinePage >= timelineTotalPages || timelineLoading} onClick={() => setTimelinePage((p) => p + 1)}>
                    Next
                  </button>
                </nav>)}
            </section>
          </article>) : null}
      </section>
    </AppLayout>);
};
