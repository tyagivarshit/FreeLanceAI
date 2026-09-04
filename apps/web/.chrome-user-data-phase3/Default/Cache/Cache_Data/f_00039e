/**
 * FreelanceOS — Settings Page Controller
 *
 * Manages Profile, Security & Sessions, Data & Privacy Export,
 * Extension Settings, and Billing Quick-Settings.
 * Enforces XSS safety, in-flight action locks, hash routing, and AbortController.
 */

(function () {
  "use strict";

  // Active state & in-flight locks
  let activeAbortController = null;
  let latestRequestId = 0;
  let isPasswordChangeInFlight = false;
  let isSessionRevocationInFlight = false;
  let isExportInFlight = false;
  let isPortalInFlight = false;
  let pendingModalAction = null;

  // Cached DOM elements
  const elements = {
    avatar: document.getElementById("user-avatar"),
    btnLogout: document.getElementById("btn-logout"),
    skeleton: document.getElementById("settings-skeleton"),
    errorContainer: document.getElementById("settings-error"),
    errorMsg: document.getElementById("settings-error-msg"),
    retryBtn: document.getElementById("settings-retry-btn"),
    content: document.getElementById("settings-content"),
    tabs: document.querySelectorAll(".settings-tab-btn"),
    panels: {
      profile: document.getElementById("panel-profile"),
      security: document.getElementById("panel-security"),
      data: document.getElementById("panel-data"),
      extension: document.getElementById("panel-extension"),
      billing: document.getElementById("panel-billing"),
    },
    // Profile
    profileEmail: document.getElementById("profile-email"),
    profileUserId: document.getElementById("profile-user-id"),
    profileStatusBadge: document.getElementById("profile-status-badge"),
    profileCreatedAt: document.getElementById("profile-created-at"),
    // Security
    formPasswordChange: document.getElementById("form-password-change"),
    currentPassword: document.getElementById("current-password"),
    newPassword: document.getElementById("new-password"),
    confirmPassword: document.getElementById("confirm-password"),
    btnChangePassword: document.getElementById("btn-change-password"),
    passwordAlert: document.getElementById("password-alert"),
    sessionsList: document.getElementById("sessions-list"),
    btnRevokeAllSessions: document.getElementById("btn-revoke-all-sessions"),
    // Data
    btnExportData: document.getElementById("btn-export-data"),
    btnDangerReset: document.getElementById("btn-danger-reset"),
    // Extension
    extStatusBadge: document.getElementById("extension-status-badge"),
    extVersion: document.getElementById("ext-version"),
    extEnv: document.getElementById("ext-env"),
    extPlatformsList: document.getElementById("ext-platforms-list"),
    toggleAutoImport: document.getElementById("toggle-auto-import"),
    toggleBgSync: document.getElementById("toggle-bg-sync"),
    // Billing
    billingStatusBadge: document.getElementById("billing-status-badge"),
    billingPlanName: document.getElementById("billing-plan-name"),
    billingPeriodInfo: document.getElementById("billing-period-info"),
    billingTrialInfo: document.getElementById("billing-trial-info"),
    btnSettingsPortal: document.getElementById("btn-settings-portal"),
    linkSettingsUpgrade: document.getElementById("link-settings-upgrade"),
    // Modal
    modal: document.getElementById("confirmation-modal"),
    modalTitle: document.getElementById("modal-title"),
    modalMsg: document.getElementById("modal-msg"),
    modalCloseBtn: document.getElementById("modal-close-btn"),
    modalCancelBtn: document.getElementById("modal-cancel-btn"),
    modalConfirmBtn: document.getElementById("modal-confirm-btn"),
    // Toast
    toast: document.getElementById("toast-container"),
    toastMsg: document.getElementById("toast-msg"),
  };

  /**
   * Safe URL validator to prevent open redirects and script injection.
   */
  function isSafeExternalUrl(url) {
    if (!url || typeof url !== "string") {
      return false;
    }
    const trimmed = url.trim();
    try {
      const parsed = new URL(trimmed);
      if (parsed.protocol === "https:") {
        return Boolean(parsed.hostname && parsed.hostname.length > 0);
      }
      if (parsed.protocol === "http:" && parsed.hostname === "localhost") {
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  /**
   * Displays an accessible toast notification.
   */
  function showToast(message, isError = false) {
    if (!elements.toast || !elements.toastMsg) {
      return;
    }
    elements.toastMsg.textContent = message;
    elements.toast.classList.remove("hidden", "toast-error", "toast-success");
    elements.toast.classList.add(isError ? "toast-error" : "toast-success");

    setTimeout(() => {
      if (elements.toast) {
        elements.toast.classList.add("hidden");
      }
    }, 5000);
  }

  /**
   * Formats ISO date string into human-readable date.
   */
  function formatDate(isoString) {
    if (!isoString) {
      return "—";
    }
    try {
      const d = new Date(isoString);
      if (Number.isNaN(d.getTime())) {
        return "—";
      }
      return d.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return "—";
    }
  }

  /**
   * Formats relative or absolute time for last active indicators.
   */
  function formatLastActive(isoString) {
    if (!isoString) {
      return "Active recently";
    }
    try {
      const d = new Date(isoString);
      if (Number.isNaN(d.getTime())) {
        return "Active recently";
      }
      const now = new Date();
      const diffMs = now.getTime() - d.getTime();
      const diffMins = Math.floor(diffMs / 60000);

      if (diffMins < 2) {
        return "Active just now";
      }
      if (diffMins < 60) {
        return `Active ${diffMins}m ago`;
      }
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) {
        return `Active ${diffHours}h ago`;
      }
      const diffDays = Math.floor(diffHours / 24);
      return `Active ${diffDays}d ago`;
    } catch {
      return "Active recently";
    }
  }

  /**
   * Sets UI state to loading.
   */
  function setLoadingState() {
    if (elements.skeleton) {
      elements.skeleton.classList.remove("hidden");
    }
    if (elements.content) {
      elements.content.classList.add("hidden");
    }
    if (elements.errorContainer) {
      elements.errorContainer.classList.add("hidden");
    }
  }

  /**
   * Sets UI state to success.
   */
  function setSuccessState() {
    if (elements.skeleton) {
      elements.skeleton.classList.add("hidden");
    }
    if (elements.content) {
      elements.content.classList.remove("hidden");
    }
    if (elements.errorContainer) {
      elements.errorContainer.classList.add("hidden");
    }
  }

  /**
   * Sets UI state to error.
   */
  function setErrorState(errorMessage) {
    if (elements.skeleton) {
      elements.skeleton.classList.add("hidden");
    }
    if (elements.content) {
      elements.content.classList.add("hidden");
    }
    if (elements.errorContainer) {
      elements.errorContainer.classList.remove("hidden");
    }
    if (elements.errorMsg) {
      elements.errorMsg.textContent = errorMessage || "Failed to load settings.";
    }
  }

  /**
   * Tab Switching with hash routing.
   */
  function switchTab(tabKey, updateHash = true) {
    const validTabs = ["profile", "security", "data", "extension", "billing"];
    const targetTab = validTabs.includes(tabKey) ? tabKey : "profile";

    elements.tabs.forEach((btn) => {
      const isSelected = btn.getAttribute("data-tab") === targetTab;
      btn.classList.toggle("active", isSelected);
      btn.setAttribute("aria-selected", isSelected ? "true" : "false");
    });

    Object.keys(elements.panels).forEach((key) => {
      const panel = elements.panels[key];
      if (panel) {
        const isActive = key === targetTab;
        panel.classList.toggle("active", isActive);
        panel.classList.toggle("hidden", !isActive);
      }
    });

    if (updateHash && window.location.hash !== `#${targetTab}`) {
      window.history.replaceState(null, "", `#${targetTab}`);
    }
  }

  /**
   * Resolves initial active tab from window URL hash.
   */
  function initTabFromHash() {
    const hash = window.location.hash.replace("#", "").toLowerCase();
    switchTab(hash || "profile", false);
  }

  /**
   * Opens confirmation modal dialog.
   */
  function openConfirmationModal(title, message, confirmLabel, isDanger, onConfirm) {
    if (!elements.modal) {
      return;
    }
    if (elements.modalTitle) {
      elements.modalTitle.textContent = title;
    }
    if (elements.modalMsg) {
      elements.modalMsg.textContent = message;
    }
    if (elements.modalConfirmBtn) {
      elements.modalConfirmBtn.textContent = confirmLabel || "Confirm";
      elements.modalConfirmBtn.className = isDanger ? "btn btn-danger" : "btn btn-primary";
    }
    pendingModalAction = onConfirm;
    elements.modal.classList.remove("hidden");
    if (elements.modalConfirmBtn) {
      elements.modalConfirmBtn.focus();
    }
  }

  /**
   * Closes confirmation modal dialog.
   */
  function closeConfirmationModal() {
    if (!elements.modal) {
      return;
    }
    elements.modal.classList.add("hidden");
    pendingModalAction = null;
  }

  /**
   * Renders Profile tab content.
   */
  function renderProfile(profile) {
    if (!profile) {
      return;
    }
    if (elements.profileEmail) {
      elements.profileEmail.value = profile.email || "";
    }
    if (elements.profileUserId) {
      elements.profileUserId.value = profile.userId || "";
    }
    if (elements.profileStatusBadge) {
      elements.profileStatusBadge.textContent = (profile.status || "active").toUpperCase();
      elements.profileStatusBadge.className =
        profile.status === "active" ? "badge badge-success" : "badge badge-warning";
    }
    if (elements.profileCreatedAt) {
      elements.profileCreatedAt.textContent = formatDate(profile.createdAt);
    }
  }

  /**
   * Renders Active Sessions list.
   */
  function renderSessions(sessionsList, currentSessionId) {
    if (!elements.sessionsList) {
      return;
    }
    elements.sessionsList.textContent = ""; // Clear existing

    if (!Array.isArray(sessionsList) || sessionsList.length === 0) {
      const emptyItem = document.createElement("div");
      emptyItem.className = "empty-session-text";
      emptyItem.textContent = "No active sessions found.";
      elements.sessionsList.appendChild(emptyItem);
      return;
    }

    sessionsList.forEach((session) => {
      const item = document.createElement("div");
      item.className = "session-item-card";
      if (session.isCurrent || session.sessionId === currentSessionId) {
        item.classList.add("session-item-current");
      }

      // Device icon
      const iconDiv = document.createElement("div");
      iconDiv.className = "session-icon-wrap";
      iconDiv.innerHTML = `
        <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
          <path d="M4 6h16v10H4z" fill="none" stroke="currentColor" stroke-width="2"/>
          <path d="M2 18h20v2H2z"/>
        </svg>
      `;

      // Session info
      const infoDiv = document.createElement("div");
      infoDiv.className = "session-info-wrap";

      const titleRow = document.createElement("div");
      titleRow.className = "session-title-row";

      const deviceName = document.createElement("span");
      deviceName.className = "session-device-name";
      deviceName.textContent =
        session.deviceName ||
        `${session.browser || "Web Browser"} on ${session.platform || "Device"}`;
      titleRow.appendChild(deviceName);

      if (session.isCurrent || session.sessionId === currentSessionId) {
        const badge = document.createElement("span");
        badge.className = "badge badge-success badge-sm";
        badge.textContent = "Current Device";
        titleRow.appendChild(badge);
      }
      infoDiv.appendChild(titleRow);

      const metaRow = document.createElement("div");
      metaRow.className = "session-meta-row";

      const ipSpan = document.createElement("span");
      ipSpan.className = "session-meta-item";
      ipSpan.textContent = `IP: ${session.ipAddress || "Unknown"}`;
      metaRow.appendChild(ipSpan);

      const timeSpan = document.createElement("span");
      timeSpan.className = "session-meta-item";
      timeSpan.textContent = formatLastActive(session.lastActivityAt || session.createdAt);
      metaRow.appendChild(timeSpan);

      infoDiv.appendChild(metaRow);
      item.appendChild(iconDiv);
      item.appendChild(infoDiv);

      // Action button
      if (!session.isCurrent && session.sessionId !== currentSessionId) {
        const btnRevoke = document.createElement("button");
        btnRevoke.className = "btn btn-secondary btn-sm session-revoke-btn";
        btnRevoke.textContent = "Revoke";
        btnRevoke.setAttribute("aria-label", `Revoke session on ${session.deviceName || "device"}`);
        btnRevoke.addEventListener("click", () => {
          openConfirmationModal(
            "Revoke Session",
            `Are you sure you want to log out ${session.deviceName || "this device"}?`,
            "Revoke Access",
            true,
            () => revokeSingleSession(session.sessionId, btnRevoke),
          );
        });
        item.appendChild(btnRevoke);
      }

      elements.sessionsList.appendChild(item);
    });
  }

  /**
   * Renders Extension tab content.
   */
  function renderExtension(extension) {
    if (!extension) {
      return;
    }
    if (elements.extStatusBadge) {
      elements.extStatusBadge.textContent =
        extension.connectionStatus === "available" ? "Ready to Connect" : "Connected";
      elements.extStatusBadge.className = "badge badge-success";
    }
    if (elements.extVersion) {
      elements.extVersion.textContent = `${extension.name || "FreelanceOS Job Matcher"} v${extension.version || "0.1.0"}`;
    }
    if (elements.extEnv) {
      elements.extEnv.textContent = "Manifest V3 (Secure)";
    }
  }

  /**
   * Renders Billing Quick-Settings tab content.
   */
  function renderBilling(subscription) {
    if (!subscription) {
      return;
    }
    const planId = subscription.planId || "STARTER";
    const status = subscription.status || "free";
    const hasCustomer = subscription.hasCustomer || false;

    if (elements.billingPlanName) {
      elements.billingPlanName.textContent = subscription.planName || `${planId} Plan`;
    }

    if (elements.billingStatusBadge) {
      let badgeLabel = "Free";
      let badgeClass = "badge badge-primary";
      if (status === "active") {
        badgeLabel = "Active";
        badgeClass = "badge badge-success";
      } else if (status === "trialing" || subscription.source === "TRIAL") {
        badgeLabel = "Trial";
        badgeClass = "badge badge-trial";
      } else if (status === "past_due") {
        badgeLabel = "Past Due";
        badgeClass = "badge badge-danger";
      } else if (status === "canceled") {
        badgeLabel = "Canceled";
        badgeClass = "badge badge-neutral";
      }
      elements.billingStatusBadge.textContent = badgeLabel;
      elements.billingStatusBadge.className = badgeClass;
    }

    if (elements.billingPeriodInfo) {
      if (subscription.period && subscription.period.endsAt) {
        elements.billingPeriodInfo.textContent = `Renews on ${formatDate(subscription.period.endsAt)}`;
      } else {
        elements.billingPeriodInfo.textContent = "Standard tier billing cycle";
      }
    }

    if (elements.billingTrialInfo) {
      if (
        subscription.trialDaysRemaining !== null &&
        subscription.trialDaysRemaining !== undefined
      ) {
        elements.billingTrialInfo.textContent = `${subscription.trialDaysRemaining} days remaining on Pro Trial`;
        elements.billingTrialInfo.classList.remove("hidden");
      } else {
        elements.billingTrialInfo.classList.add("hidden");
      }
    }

    // Portal button visibility
    if (elements.btnSettingsPortal) {
      if (hasCustomer || planId !== "STARTER") {
        elements.btnSettingsPortal.classList.remove("hidden");
      } else {
        elements.btnSettingsPortal.classList.add("hidden");
      }
    }
  }

  /**
   * Concurrently loads settings data.
   */
  async function loadSettingsData() {
    if (activeAbortController) {
      activeAbortController.abort();
    }
    activeAbortController = new AbortController();
    const { signal } = activeAbortController;

    const requestId = ++latestRequestId;
    setLoadingState();

    try {
      const [profileRes, sessionsRes, extRes, billingRes] = await Promise.all([
        fetch("/api/settings/profile", { signal }),
        fetch("/api/settings/security/sessions", { signal }),
        fetch("/api/settings/extension", { signal }),
        fetch("/api/billing/subscription", { signal }),
      ]);

      if (profileRes.status === 401 || sessionsRes.status === 401 || billingRes.status === 401) {
        window.location.assign("/login.html");
        return;
      }

      if (!profileRes.ok || !sessionsRes.ok) {
        throw new Error("Failed to load settings from server.");
      }

      const profileData = await profileRes.json();
      const sessionsData = await sessionsRes.json();
      const extData = extRes.ok ? await extRes.json() : { extension: null };
      const billingData = billingRes.ok ? await billingRes.json() : null;

      if (requestId !== latestRequestId) {
        return;
      }

      renderProfile(profileData.profile);
      renderSessions(sessionsData.sessions, sessionsData.currentSessionId);
      if (extData.extension) {
        renderExtension(extData.extension);
      }
      if (billingData) {
        renderBilling(billingData);
      }

      setSuccessState();
    } catch (err) {
      if (err.name === "AbortError") {
        return;
      }
      if (requestId === latestRequestId) {
        setErrorState(err.message || "Failed to load settings.");
      }
    }
  }

  /**
   * Password Change submission handler.
   */
  async function handlePasswordChange(e) {
    if (e) {
      e.preventDefault();
    }
    if (isPasswordChangeInFlight) {
      return;
    }

    const currentPassword = elements.currentPassword ? elements.currentPassword.value : "";
    const newPassword = elements.newPassword ? elements.newPassword.value : "";
    const confirmPassword = elements.confirmPassword ? elements.confirmPassword.value : "";

    if (!currentPassword) {
      showPasswordAlert("Please enter your current password.", true);
      return;
    }

    if (!newPassword || newPassword.length < 8) {
      showPasswordAlert("New password must be at least 8 characters long.", true);
      return;
    }

    if (newPassword !== confirmPassword) {
      showPasswordAlert("New passwords do not match.", true);
      return;
    }

    isPasswordChangeInFlight = true;
    if (elements.btnChangePassword) {
      elements.btnChangePassword.disabled = true;
      elements.btnChangePassword.textContent = "Updating Password...";
    }

    try {
      const response = await fetch("/api/settings/security/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });

      if (response.status === 401) {
        window.location.assign("/login.html");
        return;
      }

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Failed to update password.");
      }

      // Clear form
      if (elements.formPasswordChange) {
        elements.formPasswordChange.reset();
      }
      showPasswordAlert("Password updated successfully.", false);
      showToast("Password updated successfully.", false);
    } catch (err) {
      showPasswordAlert(err.message || "Failed to update password.", true);
      showToast(err.message || "Failed to update password.", true);
    } finally {
      isPasswordChangeInFlight = false;
      if (elements.btnChangePassword) {
        elements.btnChangePassword.disabled = false;
        elements.btnChangePassword.textContent = "Update Password";
      }
    }
  }

  /**
   * Helper to display password form alert.
   */
  function showPasswordAlert(message, isError) {
    if (!elements.passwordAlert) {
      return;
    }
    elements.passwordAlert.textContent = message;
    elements.passwordAlert.className = isError
      ? "alert-box alert-error"
      : "alert-box alert-success";
    elements.passwordAlert.classList.remove("hidden");
  }

  /**
   * Revokes a single session.
   */
  async function revokeSingleSession(sessionId, buttonElement) {
    if (isSessionRevocationInFlight) {
      return;
    }
    isSessionRevocationInFlight = true;

    if (buttonElement) {
      buttonElement.disabled = true;
      buttonElement.textContent = "Revoking...";
    }

    try {
      const response = await fetch(
        `/api/settings/security/sessions/${encodeURIComponent(sessionId)}`,
        {
          method: "DELETE",
        },
      );

      if (response.status === 401) {
        window.location.assign("/login.html");
        return;
      }

      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || "Failed to revoke session.");
      }

      showToast("Session revoked successfully.", false);
      // Reload sessions list
      loadSettingsData();
    } catch (err) {
      showToast(err.message || "Could not revoke session.", true);
      if (buttonElement) {
        buttonElement.disabled = false;
        buttonElement.textContent = "Revoke";
      }
    } finally {
      isSessionRevocationInFlight = false;
      closeConfirmationModal();
    }
  }

  /**
   * Revokes all other sessions.
   */
  async function revokeAllOtherSessions() {
    if (isSessionRevocationInFlight) {
      return;
    }
    isSessionRevocationInFlight = true;

    if (elements.btnRevokeAllSessions) {
      elements.btnRevokeAllSessions.disabled = true;
      elements.btnRevokeAllSessions.textContent = "Logging out others...";
    }

    try {
      const response = await fetch("/api/settings/security/sessions", {
        method: "DELETE",
      });

      if (response.status === 401) {
        window.location.assign("/login.html");
        return;
      }

      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || "Failed to revoke other sessions.");
      }

      showToast("All other sessions logged out.", false);
      loadSettingsData();
    } catch (err) {
      showToast(err.message || "Could not revoke sessions.", true);
    } finally {
      isSessionRevocationInFlight = false;
      if (elements.btnRevokeAllSessions) {
        elements.btnRevokeAllSessions.disabled = false;
        elements.btnRevokeAllSessions.textContent = "Log Out All Other Devices";
      }
      closeConfirmationModal();
    }
  }

  /**
   * Handles tenant-scoped data export download.
   */
  async function handleDataExport() {
    if (isExportInFlight) {
      return;
    }
    isExportInFlight = true;

    if (elements.btnExportData) {
      elements.btnExportData.disabled = true;
      elements.btnExportData.textContent = "Generating Export...";
    }

    try {
      const response = await fetch("/api/settings/data/export");

      if (response.status === 401) {
        window.location.assign("/login.html");
        return;
      }

      const result = await response.json();
      if (!response.ok || !result.success || !result.export) {
        throw new Error(result.error || "Failed to generate data export.");
      }

      // Trigger client-side file download
      const dataStr =
        "data:text/json;charset=utf-8," +
        encodeURIComponent(JSON.stringify(result.export, null, 2));
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
    } catch (err) {
      showToast(err.message || "Data export failed.", true);
    } finally {
      isExportInFlight = false;
      if (elements.btnExportData) {
        elements.btnExportData.disabled = false;
        elements.btnExportData.textContent = "Download Data Archive (.json)";
      }
    }
  }

  /**
   * Opens Stripe Customer Portal session.
   */
  async function handlePortalOpen() {
    if (isPortalInFlight) {
      return;
    }
    isPortalInFlight = true;

    if (elements.btnSettingsPortal) {
      elements.btnSettingsPortal.disabled = true;
      elements.btnSettingsPortal.textContent = "Opening Portal...";
    }

    try {
      const response = await fetch("/api/billing/portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (response.status === 401) {
        window.location.assign("/login.html");
        return;
      }

      const result = await response.json();
      if (!response.ok || !result.success || !result.portalUrl) {
        throw new Error(result.error || "Failed to open billing portal.");
      }

      if (!isSafeExternalUrl(result.portalUrl)) {
        throw new Error("Invalid or insecure portal URL.");
      }

      window.location.assign(result.portalUrl);
    } catch (err) {
      showToast(err.message || "Could not open billing portal.", true);
      if (elements.btnSettingsPortal) {
        elements.btnSettingsPortal.disabled = false;
        elements.btnSettingsPortal.textContent = "Manage in Stripe Portal ↗";
      }
    } finally {
      isPortalInFlight = false;
    }
  }

  /**
   * Initializes user session and topbar avatar initials.
   */
  async function initSession() {
    try {
      const res = await fetch("/api/session");
      if (res.status === 401) {
        window.location.assign("/login.html");
        return;
      }
      if (res.ok) {
        const data = await res.json();
        if (data.user && data.user.email && elements.avatar) {
          elements.avatar.textContent = data.user.email.charAt(0).toUpperCase();
        }
      }
    } catch {
      // Ignore network errors in session avatar fetch
    }
  }

  /**
   * Sets up event listeners.
   */
  function setupEventListeners() {
    // Tab switching
    elements.tabs.forEach((tabBtn) => {
      tabBtn.addEventListener("click", () => {
        const tabKey = tabBtn.getAttribute("data-tab");
        switchTab(tabKey, true);
      });
    });

    // Hash change routing
    window.addEventListener("hashchange", initTabFromHash);

    // Retry button
    if (elements.retryBtn) {
      elements.retryBtn.addEventListener("click", loadSettingsData);
    }

    // Password change form
    if (elements.formPasswordChange) {
      elements.formPasswordChange.addEventListener("submit", handlePasswordChange);
    }

    // Revoke all other sessions button
    if (elements.btnRevokeAllSessions) {
      elements.btnRevokeAllSessions.addEventListener("click", () => {
        openConfirmationModal(
          "Log Out All Other Devices",
          "This will end all active sessions across your other browsers and devices. Your current session will remain active.",
          "Log Out Other Devices",
          true,
          revokeAllOtherSessions,
        );
      });
    }

    // Data export button
    if (elements.btnExportData) {
      elements.btnExportData.addEventListener("click", handleDataExport);
    }

    // Danger zone reset button
    if (elements.btnDangerReset) {
      elements.btnDangerReset.addEventListener("click", () => {
        openConfirmationModal(
          "Reset Workspace Data",
          "This will clear all imported jobs, match history, and timeline events for your workspace. This action cannot be undone.",
          "Reset Workspace",
          true,
          () => {
            showToast("Workspace data reset requested.", false);
            closeConfirmationModal();
          },
        );
      });
    }

    // Billing portal button
    if (elements.btnSettingsPortal) {
      elements.btnSettingsPortal.addEventListener("click", handlePortalOpen);
    }

    // Modal close and cancel
    if (elements.modalCloseBtn) {
      elements.modalCloseBtn.addEventListener("click", closeConfirmationModal);
    }
    if (elements.modalCancelBtn) {
      elements.modalCancelBtn.addEventListener("click", closeConfirmationModal);
    }
    if (elements.modalConfirmBtn) {
      elements.modalConfirmBtn.addEventListener("click", () => {
        if (typeof pendingModalAction === "function") {
          pendingModalAction();
        } else {
          closeConfirmationModal();
        }
      });
    }

    // Keyboard Escape to close modal
    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && elements.modal && !elements.modal.classList.contains("hidden")) {
        closeConfirmationModal();
      }
    });

    // Logout
    if (elements.btnLogout) {
      elements.btnLogout.addEventListener("click", async () => {
        try {
          await fetch("/api/logout", { method: "POST" });
        } finally {
          window.location.assign("/login.html");
        }
      });
    }

    // Cancellation on page unload
    window.addEventListener("pagehide", () => {
      if (activeAbortController) {
        activeAbortController.abort();
      }
    });
  }

  // Initialization
  initTabFromHash();
  initSession();
  setupEventListeners();
  loadSettingsData();

  // Expose controller for testing
  if (typeof window !== "undefined") {
    window.__settingsController = {
      isSafeExternalUrl,
      switchTab,
      loadSettingsData,
      renderProfile,
      renderSessions,
      renderExtension,
      renderBilling,
      handlePasswordChange,
      revokeSingleSession,
      revokeAllOtherSessions,
      handleDataExport,
      handlePortalOpen,
    };
  }
})();
