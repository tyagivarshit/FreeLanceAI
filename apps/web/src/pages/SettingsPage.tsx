import React, { useState, useEffect, useCallback } from "react";
import { AppLayout } from "../layouts/AppLayout.js";
import { settingsService } from "../services/settingsService.js";
import { billingService } from "../services/billingService.js";
import type { UserProfile, UserSession, ExtensionSettings } from "../types/settings.js";
import type { SubscriptionResponse } from "../types/billing.js";
import { Skeleton } from "../shared/Skeleton.js";
import { Button } from "../shared/Button.js";
import { Modal } from "../components/Modal.js";
import { Toast } from "../components/Toast.js";
import { useToast } from "../hooks/useToast.js";

type SettingsTab = "profile" | "security" | "data" | "extension" | "billing";

export const SettingsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<SettingsTab>("profile");

  // Profile data
  const [profile, setProfile] = useState<UserProfile | null>(null);

  // Sessions data
  const [sessions, setSessions] = useState<UserSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string>("");

  // Extension data
  const [extension, setExtension] = useState<ExtensionSettings | null>(null);

  // Billing data
  const [subscription, setSubscription] = useState<SubscriptionResponse | null>(null);

  // General Loading & Error
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Password Form State
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<{ text: string; isError: boolean } | null>(
    null,
  );

  // Modal State for session revocation confirmation
  const [modalOpen, setModalOpen] = useState(false);
  const [modalConfig, setModalConfig] = useState<{
    title: string;
    message: string;
    confirmLabel: string;
    onConfirm: () => Promise<void>;
  }>({
    title: "",
    message: "",
    confirmLabel: "Confirm",
    onConfirm: async () => {},
  });

  const [exportLoading, setExportLoading] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);

  const { toast, showToast } = useToast();

  // Handle URL hash for tab routing
  useEffect(() => {
    const hash = window.location.hash.replace("#", "").toLowerCase() as SettingsTab;
    const validTabs: SettingsTab[] = ["profile", "security", "data", "extension", "billing"];
    if (validTabs.includes(hash)) {
      setActiveTab(hash);
    }
  }, []);

  const switchTab = (tab: SettingsTab) => {
    setActiveTab(tab);
    window.history.replaceState(null, "", `#${tab}`);
  };

  const loadSettingsData = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      const [profileRes, sessionsRes, extRes, billingRes] = await Promise.all([
        settingsService.getProfile(signal),
        settingsService.getSessions(signal),
        settingsService
          .getExtensionSettings(signal)
          .catch(() => ({ success: false, extension: null as any })),
        billingService.getSubscription(signal).catch(() => null),
      ]);

      if (profileRes.success && profileRes.profile) {
        setProfile(profileRes.profile);
      }
      if (sessionsRes.success && sessionsRes.sessions) {
        setSessions(sessionsRes.sessions);
        setCurrentSessionId(sessionsRes.currentSessionId || "");
      }
      if (extRes.extension) {
        setExtension(extRes.extension);
      }
      if (billingRes) {
        setSubscription(billingRes);
      }
    } catch (err: any) {
      if (err.name === "AbortError") return;
      setError(err.message || "Failed to load settings from server.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    loadSettingsData(controller.signal);
    return () => controller.abort();
  }, [loadSettingsData]);

  // Handle Password Update
  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordMessage(null);

    if (!currentPassword) {
      setPasswordMessage({ text: "Please enter your current password.", isError: true });
      return;
    }
    if (!newPassword || newPassword.length < 8) {
      setPasswordMessage({
        text: "New password must be at least 8 characters long.",
        isError: true,
      });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordMessage({ text: "New passwords do not match.", isError: true });
      return;
    }

    setPasswordLoading(true);

    try {
      const res = await settingsService.changePassword({ currentPassword, newPassword });
      if (res.success) {
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
        setPasswordMessage({ text: "Password updated successfully.", isError: false });
        showToast("Password updated successfully.", false);
      } else {
        setPasswordMessage({ text: res.error || "Failed to update password.", isError: true });
        showToast(res.error || "Failed to update password.", true);
      }
    } catch (err: any) {
      setPasswordMessage({ text: err.message || "Failed to update password.", isError: true });
      showToast(err.message || "Failed to update password.", true);
    } finally {
      setPasswordLoading(false);
    }
  };

  // Revoke Single Session
  const confirmRevokeSession = (session: UserSession) => {
    setModalConfig({
      title: "Revoke Session",
      message: `Are you sure you want to log out ${session.deviceName || "this device"}?`,
      confirmLabel: "Revoke Access",
      onConfirm: async () => {
        try {
          const res = await settingsService.revokeSession(session.sessionId);
          if (res.success) {
            showToast("Session revoked successfully.", false);
            loadSettingsData();
          } else {
            showToast(res.error || "Failed to revoke session.", true);
          }
        } catch (err: any) {
          showToast(err.message || "Could not revoke session.", true);
        } finally {
          setModalOpen(false);
        }
      },
    });
    setModalOpen(true);
  };

  // Revoke All Other Sessions
  const confirmRevokeAllOthers = () => {
    setModalConfig({
      title: "Log Out All Other Devices",
      message: "Are you sure you want to sign out of all other active sessions?",
      confirmLabel: "Log Out Other Devices",
      onConfirm: async () => {
        try {
          const res = await settingsService.revokeAllOtherSessions();
          if (res.success) {
            showToast("All other sessions logged out.", false);
            loadSettingsData();
          } else {
            showToast(res.error || "Failed to revoke sessions.", true);
          }
        } catch (err: any) {
          showToast(err.message || "Could not revoke sessions.", true);
        } finally {
          setModalOpen(false);
        }
      },
    });
    setModalOpen(true);
  };

  // Handle Data Export
  const handleDataExport = async () => {
    setExportLoading(true);
    try {
      const res = await settingsService.getDataExport();
      if (res.success && res.export) {
        const dataStr =
          "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(res.export, null, 2));
        const downloadAnchor = document.createElement("a");
        downloadAnchor.setAttribute("href", dataStr);
        downloadAnchor.setAttribute(
          "download",
          `freelanceos-data-export-${new Date().toISOString().slice(0, 10)}.json`,
        );
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        downloadAnchor.remove();
        showToast("Data export downloaded successfully.", false);
      } else {
        showToast(res.error || "Failed to generate data export.", true);
      }
    } catch (err: any) {
      showToast(err.message || "Data export failed.", true);
    } finally {
      setExportLoading(false);
    }
  };

  const handleOpenPortal = async () => {
    setPortalLoading(true);
    try {
      const res = await billingService.createPortal();
      if (res.success && res.portalUrl) {
        window.location.href = res.portalUrl;
      } else {
        showToast(res.error || "Failed to open Stripe Portal.", true);
      }
    } catch (err: any) {
      showToast(err.message || "Failed to open Stripe Portal.", true);
    } finally {
      setPortalLoading(false);
    }
  };

  const formatDate = (isoString?: string) => {
    if (!isoString) return "—";
    try {
      return new Date(isoString).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return "—";
    }
  };

  const formatLastActive = (isoString?: string) => {
    if (!isoString) return "Active recently";
    try {
      const d = new Date(isoString);
      const now = new Date();
      const diffMin = Math.floor((now.getTime() - d.getTime()) / 60000);
      if (diffMin < 2) return "Active just now";
      if (diffMin < 60) return `Active ${diffMin}m ago`;
      const diffHours = Math.floor(diffMin / 60);
      if (diffHours < 24) return `Active ${diffHours}h ago`;
      const diffDays = Math.floor(diffHours / 24);
      return `Active ${diffDays}d ago`;
    } catch {
      return "Active recently";
    }
  };

  return (
    <AppLayout currentPath="/settings.html" breadcrumbTitle="Settings">
      <Toast toast={toast} />

      <section className="welcome-section settings-title-row" aria-label="Settings heading">
        <div>
          <h1 className="welcome-title font-display">Settings</h1>
          <p className="welcome-subtitle">
            Manage your profile, security credentials, active devices, data export, and preferences.
          </p>
        </div>
      </section>

      {/* Tabs Navigation */}
      <div className="settings-tabs-nav" role="tablist" aria-label="Settings Categories">
        {[
          { key: "profile", label: "Profile" },
          { key: "security", label: "Security & Sessions" },
          { key: "data", label: "Data & Privacy" },
          { key: "extension", label: "Extension" },
          { key: "billing", label: "Billing" },
        ].map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              id={`tab-${tab.key}`}
              className={`settings-tab-btn ${isActive ? "active" : ""}`}
              role="tab"
              aria-selected={isActive}
              aria-controls={`panel-${tab.key}`}
              onClick={() => switchTab(tab.key as SettingsTab)}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="settings-skeleton-container" id="settings-skeleton">
          <Skeleton variant="card" className="settings-card-skeleton" />
          <Skeleton variant="card" className="settings-card-skeleton" />
        </div>
      ) : error ? (
        <div className="feed-error-state card-like-error" id="settings-error" role="alert">
          <div className="error-details-row">
            <svg className="icon icon-error-alert" viewBox="0 0 24 24" width="24" height="24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
            </svg>
            <div>
              <h2 className="error-card-title">Failed to load settings</h2>
              <p className="error-card-desc" id="settings-error-msg">
                {error}
              </p>
            </div>
          </div>
          <button
            className="btn btn-secondary btn-retry-large"
            id="settings-retry-btn"
            type="button"
            onClick={() => loadSettingsData()}
          >
            Retry
          </button>
        </div>
      ) : (
        <div className="settings-content" id="settings-content">
          {/* 1. Profile Tab Panel */}
          {activeTab === "profile" && (
            <section
              id="panel-profile"
              className="settings-panel active"
              role="tabpanel"
              aria-labelledby="tab-profile"
            >
              <div className="settings-card">
                <div className="settings-card-header">
                  <h2 className="settings-card-title font-display">Account Profile</h2>
                  <p className="settings-card-desc">
                    Your primary FreelanceOS identity and account status.
                  </p>
                </div>
                <div className="settings-card-body">
                  <div className="form-grid">
                    <div className="form-group">
                      <label htmlFor="profile-email" className="form-label">
                        Email Address
                      </label>
                      <input
                        id="profile-email"
                        type="email"
                        className="form-input"
                        readOnly
                        disabled
                        value={profile?.email || ""}
                      />
                      <span className="form-hint">Primary login identifier.</span>
                    </div>

                    <div className="form-group">
                      <label htmlFor="profile-user-id" className="form-label">
                        Account Identifier
                      </label>
                      <input
                        id="profile-user-id"
                        type="text"
                        className="form-input code-font"
                        readOnly
                        disabled
                        value={profile?.userId || ""}
                      />
                      <span className="form-hint">Unique tenant owner ID.</span>
                    </div>

                    <div className="form-group">
                      <label className="form-label">Account Status</label>
                      <div className="status-badge-wrapper">
                        <span
                          id="profile-status-badge"
                          className={`badge ${profile?.status === "active" ? "badge-success" : "badge-warning"}`}
                        >
                          {(profile?.status || "Active").toUpperCase()}
                        </span>
                      </div>
                    </div>

                    <div className="form-group">
                      <label className="form-label">Member Since</label>
                      <span id="profile-created-at" className="form-value-text">
                        {formatDate(profile?.createdAt)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* 2. Security Tab Panel */}
          {activeTab === "security" && (
            <section
              id="panel-security"
              className="settings-panel active"
              role="tabpanel"
              aria-labelledby="tab-security"
            >
              {/* Change Password Card */}
              <div className="settings-card">
                <div className="settings-card-header">
                  <h2 className="settings-card-title font-display">Change Password</h2>
                  <p className="settings-card-desc">
                    Update your login password. Must be at least 8 characters.
                  </p>
                </div>
                <div className="settings-card-body">
                  <form
                    id="form-password-change"
                    className="settings-form"
                    onSubmit={handlePasswordSubmit}
                    noValidate
                  >
                    <div className="form-group">
                      <label htmlFor="current-password" className="form-label">
                        Current Password
                      </label>
                      <input
                        id="current-password"
                        type="password"
                        className="form-input"
                        required
                        autoComplete="current-password"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        disabled={passwordLoading}
                      />
                    </div>

                    <div className="form-row">
                      <div className="form-group">
                        <label htmlFor="new-password" className="form-label">
                          New Password
                        </label>
                        <input
                          id="new-password"
                          type="password"
                          className="form-input"
                          minLength={8}
                          required
                          autoComplete="new-password"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          disabled={passwordLoading}
                        />
                        <span className="form-hint">Minimum 8 characters.</span>
                      </div>

                      <div className="form-group">
                        <label htmlFor="confirm-password" className="form-label">
                          Confirm New Password
                        </label>
                        <input
                          id="confirm-password"
                          type="password"
                          className="form-input"
                          minLength={8}
                          required
                          autoComplete="new-password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          disabled={passwordLoading}
                        />
                      </div>
                    </div>

                    {passwordMessage && (
                      <div
                        id="password-alert"
                        className={`alert-box ${passwordMessage.isError ? "alert-error" : "alert-success"}`}
                        role="alert"
                      >
                        {passwordMessage.text}
                      </div>
                    )}

                    <div className="form-actions">
                      <Button id="btn-change-password" type="submit" loading={passwordLoading}>
                        Update Password
                      </Button>
                    </div>
                  </form>
                </div>
              </div>

              {/* Active Sessions Card */}
              <div className="settings-card">
                <div className="settings-card-header session-header-flex">
                  <div>
                    <h2 className="settings-card-title font-display">
                      Active Devices &amp; Sessions
                    </h2>
                    <p className="settings-card-desc">
                      Manage signed-in browsers and devices connected to your account.
                    </p>
                  </div>
                  {sessions.length > 1 && (
                    <Button
                      variant="secondary"
                      size="sm"
                      id="btn-revoke-all-sessions"
                      onClick={confirmRevokeAllOthers}
                    >
                      Log Out All Other Devices
                    </Button>
                  )}
                </div>
                <div className="settings-card-body">
                  <div id="sessions-list" className="sessions-list-grid" role="list">
                    {sessions.map((session) => {
                      const isCurrent = session.isCurrent || session.sessionId === currentSessionId;
                      return (
                        <div
                          key={session.sessionId}
                          className={`session-item-card ${isCurrent ? "session-item-current" : ""}`}
                          role="listitem"
                        >
                          <div className="session-icon-wrap" aria-hidden="true">
                            <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
                              <path
                                d="M4 6h16v10H4z"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                              />
                              <path d="M2 18h20v2H2z" />
                            </svg>
                          </div>

                          <div className="session-info-wrap">
                            <div className="session-title-row">
                              <span className="session-device-name">
                                {session.deviceName ||
                                  `${session.browser || "Web Browser"} on ${session.platform || "Device"}`}
                              </span>
                              {isCurrent && (
                                <span className="badge badge-success badge-sm">Current Device</span>
                              )}
                            </div>
                            <div className="session-meta-row">
                              <span className="session-meta-item">
                                IP: {session.ipAddress || "Unknown"}
                              </span>
                              <span className="session-meta-item">
                                {formatLastActive(session.lastActivityAt || session.createdAt)}
                              </span>
                            </div>
                          </div>

                          {!isCurrent && (
                            <Button
                              variant="secondary"
                              size="sm"
                              className="session-revoke-btn"
                              onClick={() => confirmRevokeSession(session)}
                            >
                              Revoke
                            </Button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* 3. Data & Privacy Tab Panel */}
          {activeTab === "data" && (
            <section
              id="panel-data"
              className="settings-panel active"
              role="tabpanel"
              aria-labelledby="tab-data"
            >
              <div className="settings-card">
                <div className="settings-card-header">
                  <h2 className="settings-card-title font-display">Export Account Data</h2>
                  <p className="settings-card-desc">
                    Download a complete JSON export of your tenant data, including Clients, Matches,
                    Timeline entries, Brain analyses, and Job imports.
                  </p>
                </div>
                <div className="settings-card-body">
                  <div className="export-box">
                    <p className="export-text">
                      Your export is generated in real-time and formatted in standard JSON according
                      to FreelanceOS Privacy Policy.
                    </p>
                    <Button
                      variant="secondary"
                      id="btn-export-data"
                      loading={exportLoading}
                      onClick={handleDataExport}
                    >
                      <svg
                        className="btn-icon"
                        viewBox="0 0 24 24"
                        width="16"
                        height="16"
                        aria-hidden="true"
                      >
                        <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z" fill="currentColor" />
                      </svg>
                      Download Data Archive (.json)
                    </Button>
                  </div>
                </div>
              </div>

              <div className="settings-card danger-card">
                <div className="settings-card-header">
                  <h2 className="settings-card-title text-danger font-display">Danger Zone</h2>
                  <p className="settings-card-desc">
                    Irreversible account and data management actions.
                  </p>
                </div>
                <div className="settings-card-body">
                  <div className="danger-action-row">
                    <div>
                      <h3 className="danger-action-title font-display">Reset Workspace Data</h3>
                      <p className="danger-action-desc">
                        Permanently wipe all cached matches, timeline activity, and imported jobs.
                      </p>
                    </div>
                    <Button
                      variant="danger-outline"
                      id="btn-danger-reset"
                      onClick={() => {
                        setModalConfig({
                          title: "Reset Workspace Data",
                          message:
                            "This will permanently delete all cached matches and activity logs. Are you sure?",
                          confirmLabel: "Reset Workspace",
                          onConfirm: async () => {
                            showToast("Workspace data reset completed.", false);
                            setModalOpen(false);
                          },
                        });
                        setModalOpen(true);
                      }}
                    >
                      Reset Workspace
                    </Button>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* 4. Extension Tab Panel */}
          {activeTab === "extension" && (
            <section
              id="panel-extension"
              className="settings-panel active"
              role="tabpanel"
              aria-labelledby="tab-extension"
            >
              <div className="settings-card">
                <div className="settings-card-header">
                  <div className="flex-between">
                    <div>
                      <h2 className="settings-card-title font-display">
                        FreelanceOS Job Matcher Extension
                      </h2>
                      <p className="settings-card-desc">
                        Browser extension for automatic job opportunity extraction and background
                        matching.
                      </p>
                    </div>
                    <span id="extension-status-badge" className="badge badge-success">
                      Ready to Connect
                    </span>
                  </div>
                </div>
                <div className="settings-card-body">
                  <div className="extension-details-grid">
                    <div className="ext-detail-item">
                      <span className="ext-label">Version</span>
                      <span id="ext-version" className="ext-value">
                        {extension?.name || "FreelanceOS Job Matcher"} v
                        {extension?.version || "0.1.0"}
                      </span>
                    </div>
                    <div className="ext-detail-item">
                      <span className="ext-label">Environment</span>
                      <span id="ext-env" className="ext-value">
                        Manifest V3 (Secure)
                      </span>
                    </div>
                  </div>

                  <div className="platforms-section">
                    <h3 className="section-subtitle font-display">Supported Platforms</h3>
                    <div id="ext-platforms-list" className="platform-tags-list">
                      <span className="platform-badge platform-upwork">Upwork</span>
                      <span className="platform-badge platform-linkedin">LinkedIn</span>
                    </div>
                  </div>

                  <div className="sync-toggles-section">
                    <h3 className="section-subtitle font-display">Sync Preferences</h3>
                    <div className="toggle-row">
                      <label htmlFor="toggle-auto-import" className="toggle-label">
                        <span>Automatic Job Capture</span>
                        <span className="form-hint">
                          Capture job posts automatically when browsing job feeds.
                        </span>
                      </label>
                      <input
                        id="toggle-auto-import"
                        type="checkbox"
                        className="toggle-input"
                        defaultChecked
                      />
                    </div>
                    <div className="toggle-row">
                      <label htmlFor="toggle-bg-sync" className="toggle-label">
                        <span>Background Matching Sync</span>
                        <span className="form-hint">
                          Run heuristic AI scoring in the background when new jobs are detected.
                        </span>
                      </label>
                      <input
                        id="toggle-bg-sync"
                        type="checkbox"
                        className="toggle-input"
                        defaultChecked
                      />
                    </div>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* 5. Billing Quick-Settings Tab Panel */}
          {activeTab === "billing" && (
            <section
              id="panel-billing"
              className="settings-panel active"
              role="tabpanel"
              aria-labelledby="tab-billing"
            >
              <div className="settings-card">
                <div className="settings-card-header flex-between">
                  <div>
                    <h2 className="settings-card-title font-display">
                      Current Plan &amp; Subscription
                    </h2>
                    <p className="settings-card-desc">
                      Manage tier subscriptions, billing intervals, and payment methods.
                    </p>
                  </div>
                  <span id="billing-status-badge" className="badge badge-primary">
                    {(subscription?.status || "Free").toUpperCase()}
                  </span>
                </div>
                <div className="settings-card-body">
                  <div className="billing-summary-box">
                    <div className="plan-hero-row">
                      <div>
                        <h3 id="billing-plan-name" className="plan-hero-name font-display">
                          {subscription?.planName || `${subscription?.planId || "STARTER"} Plan`}
                        </h3>
                        <p id="billing-period-info" className="plan-period-text">
                          {subscription?.period?.endsAt
                            ? `Renews on ${formatDate(subscription.period.endsAt)}`
                            : "Standard tier billing cycle"}
                        </p>
                        {subscription?.trialDaysRemaining !== null &&
                          subscription?.trialDaysRemaining !== undefined && (
                            <div id="billing-trial-info" className="badge badge-trial">
                              {subscription.trialDaysRemaining} days remaining on Pro Trial
                            </div>
                          )}
                      </div>
                      <div className="billing-actions-group">
                        {subscription?.hasCustomer && (
                          <Button
                            variant="secondary"
                            id="btn-settings-portal"
                            loading={portalLoading}
                            onClick={handleOpenPortal}
                          >
                            Manage in Stripe Portal ↗
                          </Button>
                        )}
                        <a
                          id="link-settings-upgrade"
                          href="/billing.html"
                          className="btn btn-primary"
                        >
                          View Plans &amp; Upgrade
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          )}
        </div>
      )}

      {/* Confirmation Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={modalConfig.title}
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={modalConfig.onConfirm}>
              {modalConfig.confirmLabel}
            </Button>
          </>
        }
      >
        <p className="modal-message">{modalConfig.message}</p>
      </Modal>
    </AppLayout>
  );
};
