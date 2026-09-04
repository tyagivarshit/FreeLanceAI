/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect, useCallback } from "react";
import { AppLayout } from "../layouts/AppLayout.js";
import { clientsService } from "../services/clientsService.js";
import type { Client } from "../types/client.js";
import { Skeleton } from "../shared/Skeleton.js";

export const ClientsPage: React.FC = () => {
  const [clients, setClients] = useState<Client[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Initialize from URL params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const p = parseInt(params.get("page") || "1", 10);
    const s = params.get("status") || "";
    if (p > 0) setPage(p);
    if (s) setStatusFilter(s);
  }, []);

  const loadClients = useCallback(
    async (p: number, s: string, signal?: AbortSignal) => {
      setLoading(true);
      setError(null);
      try {
        const params: { page: number; pageSize: number; status?: string; signal?: AbortSignal } = {
          page: p,
          pageSize,
        };
        if (s) params.status = s;
        if (signal) params.signal = signal;

        const res = await clientsService.getClients(params);
        setClients(res.clients || []);
        setTotal(res.total || 0);
        setPage(res.page || p);

        // Sync URL
        const urlParams = new URLSearchParams();
        if (p > 1) urlParams.set("page", String(p));
        if (s) urlParams.set("status", s);
        const query = urlParams.toString();
        window.history.replaceState(null, "", query ? `/clients.html?${query}` : "/clients.html");
      } catch (err: any) {
        if (err.name === "AbortError") return;
        setError(err.message || "Failed to load clients");
      } finally {
        setLoading(false);
      }
    },
    [pageSize],
  );

  useEffect(() => {
    const controller = new AbortController();
    loadClients(page, statusFilter, controller.signal);
    return () => controller.abort();
  }, [page, statusFilter, loadClients]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const formatUpdatedAt = (dateValue?: string | null) => {
    if (!dateValue) return "Updated date unavailable";
    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) return "Updated date unavailable";
    return `Updated ${date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })}`;
  };

  const getStatusClass = (status: string) => {
    return `status-${status.toLowerCase()}`;
  };

  return (
    <AppLayout
      currentPath="/clients.html"
      breadcrumbTitle="Clients"
      topbarActions={
        <button
          className="topbar-action-btn"
          id="clients-refresh-icon"
          aria-label="Refresh clients"
          onClick={() => loadClients(page, statusFilter)}
        >
          <svg className="icon" viewBox="0 0 24 24" width="20" height="20">
            <path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h8V3l-3.35 3.35z" />
          </svg>
        </button>
      }
    >
      <section className="welcome-section clients-title-row" aria-label="Clients heading">
        <div>
          <h1 className="welcome-title font-display">Clients</h1>
          <p className="welcome-subtitle">
            Review the client relationships connected to your workspace.
          </p>
        </div>
        <button
          className="btn btn-secondary clients-refresh-btn"
          id="clients-refresh-btn"
          type="button"
          onClick={() => loadClients(page, statusFilter)}
        >
          Refresh
        </button>
      </section>

      {/* Toolbar */}
      <section className="clients-toolbar" aria-label="Client list controls">
        <label className="clients-filter-label" htmlFor="client-status-filter">
          Status
        </label>
        <select
          id="client-status-filter"
          className="clients-select"
          aria-label="Filter clients by status"
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All statuses</option>
          <option value="Lead">Lead</option>
          <option value="Active">Active</option>
          <option value="Suspended">Suspended</option>
          <option value="Archived">Archived</option>
          <option value="Closed">Closed</option>
        </select>
        <span className="badge" id="clients-count">
          {total} {total === 1 ? "client" : "clients"}
        </span>
      </section>

      {/* List Shell */}
      <section className="clients-list-shell" aria-label="Client list">
        {loading ? (
          <div
            className="clients-skeleton"
            id="clients-skeleton"
            aria-live="polite"
            aria-label="Loading clients"
          >
            <Skeleton variant="row" className="client-row-skeleton" />
            <Skeleton variant="row" className="client-row-skeleton" />
            <Skeleton variant="row" className="client-row-skeleton" />
          </div>
        ) : error ? (
          <div className="feed-error-state card-like-error" id="clients-error" role="alert">
            <div className="error-details-row">
              <svg className="icon icon-error-alert" viewBox="0 0 24 24" width="24" height="24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
              </svg>
              <div>
                <h2 className="error-card-title">Failed to load clients</h2>
                <p className="error-card-desc" id="clients-error-msg">
                  {error}
                </p>
              </div>
            </div>
            <button
              className="btn btn-secondary btn-retry-large"
              id="clients-error-retry"
              type="button"
              onClick={() => loadClients(page, statusFilter)}
            >
              Retry loading clients
            </button>
          </div>
        ) : clients.length === 0 ? (
          <div className="empty-state" id="clients-empty">
            <div className="empty-icon-wrap">
              <svg className="icon" viewBox="0 0 24 24" width="40" height="40">
                <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 1.34 5 8s1.34 3 8 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
              </svg>
            </div>
            <h2 className="empty-title font-display">No clients yet</h2>
            <p className="empty-desc">The API returned an empty client list for this workspace.</p>
          </div>
        ) : (
          <div className="clients-list" id="clients-list" role="list">
            {clients.map((client) => (
              <article key={client.id} className="client-list-row" role="listitem">
                <a
                  href={`/clients/${encodeURIComponent(client.id)}`}
                  className="client-row-link"
                  aria-label={`Open client ${client.name}`}
                >
                  <div className="client-identity">
                    <div className="client-avatar" aria-hidden="true">
                      {client.name.trim().charAt(0).toUpperCase()}
                    </div>
                    <div className="client-copy">
                      <h2 className="client-name font-display">{client.name}</h2>
                      <p className="client-email">{client.email || "No contact email"}</p>
                    </div>
                  </div>

                  <div className="client-meta">
                    <span className={`client-status ${getStatusClass(client.status)}`}>
                      {client.status}
                    </span>
                    <span className="client-updated">
                      {formatUpdatedAt(client.updatedAt || client.createdAt)}
                    </span>
                  </div>
                </a>
              </article>
            ))}
          </div>
        )}
      </section>

      {/* Pagination */}
      <nav className="clients-pagination" aria-label="Client list pagination">
        <button
          className="btn btn-secondary clients-page-btn"
          id="clients-prev-page"
          type="button"
          disabled={page <= 1 || loading}
          onClick={() => setPage((prev) => Math.max(1, prev - 1))}
        >
          Previous
        </button>
        <span className="clients-page-summary" id="clients-page-summary" aria-live="polite">
          Page {page} of {totalPages}
        </span>
        <button
          className="btn btn-secondary clients-page-btn"
          id="clients-next-page"
          type="button"
          disabled={page >= totalPages || loading}
          onClick={() => setPage((prev) => prev + 1)}
        >
          Next
        </button>
      </nav>
    </AppLayout>
  );
};

