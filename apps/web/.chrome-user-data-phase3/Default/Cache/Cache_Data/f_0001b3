/**
 * FreelanceOS Billing & Plans Controller
 *
 * Responsibilities:
 * - Session verification & user profile
 * - Concurrent loading of plan catalog and subscription/usage metrics
 * - AbortController cancellation & stale response protection
 * - Dynamic regional pricing resolution without hardcoded amounts
 * - Upgrade Stripe Checkout session flow with HTTPS verification
 * - Stripe Customer Portal session flow with HTTPS verification
 * - XSS-safe DOM population via textContent
 * - Full accessibility and keyboard navigation
 */

(function () {
  "use strict";

  // State Management
  let activeAbortController = null;
  let latestRequestId = 0;
  let plansData = [];
  let subscriptionData = null;
  let selectedCurrency = "USD";

  // DOM Elements Cache
  const elements = {
    // Skeletons, Errors & Live containers
    skeleton: document.getElementById("billing-skeleton"),
    errorContainer: document.getElementById("billing-error"),
    errorMsg: document.getElementById("billing-error-msg"),
    errorRetryBtn: document.getElementById("billing-error-retry"),
    content: document.getElementById("billing-content"),
    toast: document.getElementById("billing-toast"),
    toastMsg: document.getElementById("billing-toast-msg"),

    // Currency selector
    currencySelector: document.getElementById("currency-selector"),

    // Topbar & Sidebar
    userAvatar: document.getElementById("user-avatar-initials"),
    sidebarToggle: document.getElementById("sidebar-toggle"),
    mobileDrawerToggle: document.getElementById("mobile-drawer-toggle"),
    drawerOverlay: document.getElementById("drawer-overlay"),
    sidebar: document.getElementById("sidebar"),
    logoutBtn: document.getElementById("sidebar-logout-btn"),

    // Current Plan & Usage Summary
    currentPlanName: document.getElementById("current-plan-name"),
    currentStatusBadge: document.getElementById("current-plan-status-badge"),
    currentTrialBadge: document.getElementById("current-trial-badge"),
    currentPlanPeriod: document.getElementById("current-plan-period"),
    portalBtn: document.getElementById("billing-portal-btn"),

    // Usage Meters
    proposalsVal: document.getElementById("usage-proposals-val"),
    proposalsBar: document.getElementById("usage-proposals-bar"),
    proposalsProgress: document.getElementById("usage-proposals-progress"),
    scansVal: document.getElementById("usage-scans-val"),
    scansBar: document.getElementById("usage-scans-bar"),
    scansProgress: document.getElementById("usage-scans-progress"),
    workspacesVal: document.getElementById("usage-workspaces-val"),
    workspacesBar: document.getElementById("usage-workspaces-bar"),
    workspacesProgress: document.getElementById("usage-workspaces-progress"),

    // Plan Cards & CTAs
    planPriceStarter: document.querySelector('[data-plan-price="STARTER"]'),
    planPricePro: document.querySelector('[data-plan-price="PRO"]'),
    planPricePowerBidder: document.querySelector('[data-plan-price="POWER_BIDDER"]'),
    btnStarter: document.getElementById("btn-plan-starter"),
    btnPro: document.getElementById("btn-upgrade-pro"),
    btnPowerBidder: document.getElementById("btn-upgrade-power-bidder"),
    cardStarter: document.getElementById("plan-card-STARTER"),
    cardPro: document.getElementById("plan-card-PRO"),
    cardPowerBidder: document.getElementById("plan-card-POWER_BIDDER"),
  };

  // In-flight operation guards
  let isCheckoutInFlight = false;
  let isPortalInFlight = false;

  /**
   * Safe URL validator to prevent open redirects and javascript: injection.
   * Strictly enforces HTTPS or localhost HTTP and validates hostname.
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
      return "";
    }
    try {
      const d = new Date(isoString);
      if (Number.isNaN(d.getTime())) {
        return "";
      }
      return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    } catch {
      return "";
    }
  }

  /**
   * Sets initial loading skeleton UI state.
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
   * Sets success UI state.
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
   * Sets error UI state with a sanitized message.
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
      if (elements.errorMsg) {
        elements.errorMsg.textContent =
          errorMessage || "Failed to load billing information. Please try again.";
      }
    }
  }

  /**
   * Formats a plan price based on currency and minor units.
   */
  function getFormattedPlanPrice(plan, currency) {
    if (!plan || !plan.prices || plan.prices.length === 0) {
      return "Free";
    }

    const priceMatch =
      plan.prices.find((p) => p.currency.toUpperCase() === currency.toUpperCase()) ||
      plan.prices.find((p) => p.region === "GLOBAL") ||
      plan.prices[0];

    if (!priceMatch || priceMatch.amountMinor === 0) {
      return "Free";
    }

    if (priceMatch.formatted) {
      return priceMatch.formatted;
    }

    const amount = (priceMatch.amountMinor / 100).toFixed(
      priceMatch.amountMinor % 100 === 0 ? 0 : 2,
    );
    if (priceMatch.currency === "USD") {
      return `$${amount}`;
    }
    if (priceMatch.currency === "INR") {
      return `₹${(priceMatch.amountMinor / 100).toFixed(0)}`;
    }
    if (priceMatch.currency === "GBP") {
      return `£${amount}`;
    }
    if (priceMatch.currency === "EUR") {
      return `€${amount}`;
    }
    return `${priceMatch.currency} ${amount}`;
  }

  /**
   * Renders the plan pricing cards from server-authoritative plan data.
   */
  function renderPlanPrices() {
    if (!plansData || plansData.length === 0) {
      return;
    }

    const starter = plansData.find((p) => p.planId === "STARTER");
    const pro = plansData.find((p) => p.planId === "PRO");
    const pb = plansData.find((p) => p.planId === "POWER_BIDDER");

    if (elements.planPriceStarter) {
      elements.planPriceStarter.textContent = getFormattedPlanPrice(starter, selectedCurrency);
    }
    if (elements.planPricePro) {
      elements.planPricePro.textContent = getFormattedPlanPrice(pro, selectedCurrency);
    }
    if (elements.planPricePowerBidder) {
      elements.planPricePowerBidder.textContent = getFormattedPlanPrice(pb, selectedCurrency);
    }
  }

  /**
   * Renders current subscription, trial countdown, usage limits, and active card states.
   */
  function renderSubscriptionAndUsage() {
    if (!subscriptionData) {
      return;
    }

    const sub = subscriptionData;
    const currentPlanId = (sub.planId || "STARTER").toUpperCase();

    // 1. Plan Name & Status Badge
    if (elements.currentPlanName) {
      elements.currentPlanName.textContent =
        sub.planName ||
        (currentPlanId === "POWER_BIDDER"
          ? "Power Bidder Plan"
          : currentPlanId === "PRO"
            ? "Pro Plan"
            : "Starter Plan");
    }

    if (elements.currentStatusBadge) {
      elements.currentStatusBadge.classList.remove(
        "status-evaluated",
        "status-created",
        "status-archived",
      );
      if (sub.source === "SUBSCRIPTION" && sub.status === "active") {
        elements.currentStatusBadge.textContent = "Active";
        elements.currentStatusBadge.classList.add("status-evaluated");
      } else if (sub.source === "TRIAL") {
        elements.currentStatusBadge.textContent = "Trial";
        elements.currentStatusBadge.classList.add("status-created");
      } else if (sub.status === "past_due") {
        elements.currentStatusBadge.textContent = "Past Due";
        elements.currentStatusBadge.classList.add("status-archived");
      } else if (sub.status === "canceled") {
        elements.currentStatusBadge.textContent = "Canceled";
        elements.currentStatusBadge.classList.add("status-archived");
      } else {
        elements.currentStatusBadge.textContent = "Free";
        elements.currentStatusBadge.classList.add("status-created");
      }
    }

    // 2. Trial Countdown Badge
    if (elements.currentTrialBadge) {
      if (sub.source === "TRIAL" && typeof sub.trialDaysRemaining === "number") {
        elements.currentTrialBadge.textContent = `${sub.trialDaysRemaining} days left in trial`;
        elements.currentTrialBadge.classList.remove("hidden");
      } else {
        elements.currentTrialBadge.classList.add("hidden");
      }
    }

    // 3. Billing Period Dates
    if (elements.currentPlanPeriod) {
      if (sub.period && sub.period.startedAt && sub.period.endsAt) {
        const startStr = formatDate(sub.period.startedAt);
        const endStr = formatDate(sub.period.endsAt);
        elements.currentPlanPeriod.textContent = `Current period: ${startStr} – ${endStr}`;
      } else {
        elements.currentPlanPeriod.textContent = "Active billing period";
      }
    }

    // 4. Portal Button Visibility
    if (elements.portalBtn) {
      if (sub.hasCustomer || sub.source === "SUBSCRIPTION") {
        elements.portalBtn.classList.remove("hidden");
      } else {
        elements.portalBtn.classList.add("hidden");
      }
    }

    // 5. Usage Progress Meters
    const limits = sub.limits || {};
    const usage = sub.usage || {};

    // AI Proposals Meter
    const proposalsUsed = typeof usage.aiProposals === "number" ? usage.aiProposals : 0;
    if (limits.aiProposals && limits.aiProposals.type === "LIMITED") {
      const maxProposals = limits.aiProposals.value;
      if (elements.proposalsVal) {
        elements.proposalsVal.textContent = `${proposalsUsed} / ${maxProposals}`;
      }
      const pct = maxProposals > 0 ? Math.min(100, (proposalsUsed / maxProposals) * 100) : 0;
      if (elements.proposalsBar) {
        elements.proposalsBar.style.width = `${pct}%`;
      }
      if (elements.proposalsProgress) {
        elements.proposalsProgress.setAttribute("aria-valuenow", String(proposalsUsed));
        elements.proposalsProgress.setAttribute("aria-valuemax", String(maxProposals));
      }
    } else {
      if (elements.proposalsVal) {
        elements.proposalsVal.textContent = `${proposalsUsed} (Unlimited)`;
      }
      if (elements.proposalsBar) {
        elements.proposalsBar.style.width = "100%";
      }
      if (elements.proposalsProgress) {
        elements.proposalsProgress.setAttribute("aria-valuenow", String(proposalsUsed));
        elements.proposalsProgress.setAttribute("aria-valuemax", "100");
      }
    }

    // Job Scans Meter
    const scansUsed = typeof usage.jobScans === "number" ? usage.jobScans : 0;
    if (limits.jobScans && limits.jobScans.type === "LIMITED") {
      const maxScans = limits.jobScans.value;
      if (elements.scansVal) {
        elements.scansVal.textContent = `${scansUsed} / ${maxScans}`;
      }
      const pct = maxScans > 0 ? Math.min(100, (scansUsed / maxScans) * 100) : 0;
      if (elements.scansBar) {
        elements.scansBar.style.width = `${pct}%`;
      }
      if (elements.scansProgress) {
        elements.scansProgress.setAttribute("aria-valuenow", String(scansUsed));
        elements.scansProgress.setAttribute("aria-valuemax", String(maxScans));
      }
    } else {
      if (elements.scansVal) {
        elements.scansVal.textContent = `${scansUsed} (Unlimited)`;
      }
      if (elements.scansBar) {
        elements.scansBar.style.width = "100%";
      }
      if (elements.scansProgress) {
        elements.scansProgress.setAttribute("aria-valuenow", String(scansUsed));
        elements.scansProgress.setAttribute("aria-valuemax", "100");
      }
    }

    // Workspaces Meter
    if (limits.maxWorkspaces && limits.maxWorkspaces.type === "LIMITED") {
      const maxWs = limits.maxWorkspaces.value;
      if (elements.workspacesVal) {
        elements.workspacesVal.textContent = `${maxWs} ${maxWs === 1 ? "workspace" : "workspaces"}`;
      }
      if (elements.workspacesBar) {
        elements.workspacesBar.style.width = "100%";
      }
      if (elements.workspacesProgress) {
        elements.workspacesProgress.setAttribute("aria-valuenow", String(maxWs));
        elements.workspacesProgress.setAttribute("aria-valuemax", String(maxWs));
      }
    } else {
      if (elements.workspacesVal) {
        elements.workspacesVal.textContent = "Unlimited workspaces";
      }
      if (elements.workspacesBar) {
        elements.workspacesBar.style.width = "100%";
      }
      if (elements.workspacesProgress) {
        elements.workspacesProgress.setAttribute("aria-valuenow", "100");
        elements.workspacesProgress.setAttribute("aria-valuemax", "100");
      }
    }

    // 6. Plan Cards Active States & Buttons
    [elements.cardStarter, elements.cardPro, elements.cardPowerBidder].forEach((card) => {
      if (card) {
        card.classList.remove("plan-card-current");
      }
    });

    if (currentPlanId === "STARTER") {
      if (elements.cardStarter) {
        elements.cardStarter.classList.add("plan-card-current");
      }
      if (elements.btnStarter) {
        elements.btnStarter.textContent = "Current Plan";
        elements.btnStarter.disabled = true;
      }
      if (elements.btnPro) {
        elements.btnPro.textContent = "Upgrade to Pro";
        elements.btnPro.disabled = false;
      }
      if (elements.btnPowerBidder) {
        elements.btnPowerBidder.textContent = "Upgrade to Power Bidder";
        elements.btnPowerBidder.disabled = false;
      }
    } else if (currentPlanId === "PRO") {
      if (elements.cardPro) {
        elements.cardPro.classList.add("plan-card-current");
      }
      if (elements.btnStarter) {
        elements.btnStarter.textContent = "Starter Tier";
        elements.btnStarter.disabled = true;
      }
      if (elements.btnPro) {
        elements.btnPro.textContent = "Current Plan";
        elements.btnPro.disabled = true;
      }
      if (elements.btnPowerBidder) {
        elements.btnPowerBidder.textContent = "Upgrade to Power Bidder";
        elements.btnPowerBidder.disabled = false;
      }
    } else if (currentPlanId === "POWER_BIDDER") {
      if (elements.cardPowerBidder) {
        elements.cardPowerBidder.classList.add("plan-card-current");
      }
      if (elements.btnStarter) {
        elements.btnStarter.textContent = "Starter Tier";
        elements.btnStarter.disabled = true;
      }
      if (elements.btnPro) {
        elements.btnPro.textContent = "Pro Tier";
        elements.btnPro.disabled = true;
      }
      if (elements.btnPowerBidder) {
        elements.btnPowerBidder.textContent = "Current Plan";
        elements.btnPowerBidder.disabled = true;
      }
    }
  }

  /**
   * Concurrently loads plans catalog and user subscription with AbortController and stale response protection.
   */
  async function loadBillingData() {
    // Abort active request if in flight
    if (activeAbortController) {
      activeAbortController.abort();
    }
    activeAbortController = new AbortController();
    const { signal } = activeAbortController;

    const requestId = ++latestRequestId;
    setLoadingState();

    try {
      // Concurrently fetch plans and subscription
      const [plansRes, subRes] = await Promise.all([
        fetch("/api/billing/plans", { signal }),
        fetch("/api/billing/subscription", { signal }),
      ]);

      // Check if another request superseded this one
      if (requestId !== latestRequestId) {
        return;
      }

      if (subRes.status === 401) {
        window.location.assign("/login.html");
        return;
      }

      if (!plansRes.ok || !subRes.ok) {
        throw new Error("Failed to retrieve authoritative billing data.");
      }

      const [plansJson, subJson] = await Promise.all([plansRes.json(), subRes.json()]);

      if (requestId !== latestRequestId) {
        return;
      }

      if (!plansJson.success || !subJson.success) {
        throw new Error(plansJson.error || subJson.error || "Billing API returned an error.");
      }

      plansData = plansJson.plans || [];
      subscriptionData = subJson;

      renderPlanPrices();
      renderSubscriptionAndUsage();
      setSuccessState();
    } catch (err) {
      if (err.name === "AbortError") {
        return;
      }
      if (requestId === latestRequestId) {
        setErrorState(err.message || "Failed to load billing information.");
      }
    }
  }

  /**
   * Initiates Stripe Checkout session for plan upgrades.
   */
  async function handleCheckout(planId, buttonElement) {
    if (isCheckoutInFlight) {
      return;
    }
    if (!planId || !["PRO", "POWER_BIDDER"].includes(planId)) {
      showToast("Invalid plan selected for checkout.", true);
      return;
    }

    isCheckoutInFlight = true;
    if (buttonElement) {
      buttonElement.disabled = true;
      buttonElement.textContent = "Redirecting to Stripe...";
    }

    try {
      const response = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId,
          version: 1,
        }),
      });

      if (response.status === 401) {
        window.location.assign("/login.html");
        return;
      }

      const result = await response.json();

      if (!response.ok || !result.success || !result.checkoutUrl) {
        throw new Error(result.error || "Failed to create Stripe checkout session.");
      }

      if (!isSafeExternalUrl(result.checkoutUrl)) {
        throw new Error("Received an insecure or invalid checkout URL.");
      }

      // Safe navigation to Stripe Checkout
      window.location.assign(result.checkoutUrl);
    } catch (err) {
      showToast(err.message || "Checkout failed. Please try again.", true);
      if (buttonElement) {
        buttonElement.disabled = false;
        buttonElement.textContent = planId === "PRO" ? "Upgrade to Pro" : "Upgrade to Power Bidder";
      }
    } finally {
      isCheckoutInFlight = false;
    }
  }

  /**
   * Initiates Stripe Customer Portal session.
   */
  async function handlePortal(buttonElement) {
    if (isPortalInFlight) {
      return;
    }
    isPortalInFlight = true;

    if (buttonElement) {
      buttonElement.disabled = true;
      buttonElement.textContent = "Opening Portal...";
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
        throw new Error(result.error || "Failed to create Stripe billing portal session.");
      }

      if (!isSafeExternalUrl(result.portalUrl)) {
        throw new Error("Received an insecure or invalid portal URL.");
      }

      // Safe navigation to Stripe Customer Portal
      window.location.assign(result.portalUrl);
    } catch (err) {
      showToast(err.message || "Could not open billing portal. Please try again.", true);
      if (buttonElement) {
        buttonElement.disabled = false;
        buttonElement.textContent = "Manage Subscription ↗";
      }
    } finally {
      isPortalInFlight = false;
    }
  }

  /**
   * Initializes user session and avatar initials.
   */
  async function initSession() {
    try {
      const res = await fetch("/api/session");
      if (res.status === 401) {
        window.location.assign("/login.html");
        return;
      }
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.user && elements.userAvatar) {
          const email = json.user.email || "";
          elements.userAvatar.textContent = email.charAt(0).toUpperCase() || "U";
        }
      }
    } catch {
      // Session fetch error handled gracefully
    }
  }

  /**
   * Setup event listeners.
   */
  function setupEventListeners() {
    // Retry button
    if (elements.errorRetryBtn) {
      elements.errorRetryBtn.addEventListener("click", loadBillingData);
    }

    // Currency selector
    if (elements.currencySelector) {
      elements.currencySelector.addEventListener("change", (e) => {
        selectedCurrency = e.target.value;
        renderPlanPrices();
      });
    }

    // Upgrade Pro button
    if (elements.btnPro) {
      elements.btnPro.addEventListener("click", (e) => {
        handleCheckout("PRO", e.currentTarget);
      });
    }

    // Upgrade Power Bidder button
    if (elements.btnPowerBidder) {
      elements.btnPowerBidder.addEventListener("click", (e) => {
        handleCheckout("POWER_BIDDER", e.currentTarget);
      });
    }

    // Portal button
    if (elements.portalBtn) {
      elements.portalBtn.addEventListener("click", (e) => {
        handlePortal(e.currentTarget);
      });
    }

    // Sidebar & Mobile Drawer Toggles
    if (elements.sidebarToggle && elements.sidebar) {
      elements.sidebarToggle.addEventListener("click", () => {
        elements.sidebar.classList.toggle("collapsed");
      });
    }

    if (elements.mobileDrawerToggle && elements.sidebar && elements.drawerOverlay) {
      elements.mobileDrawerToggle.addEventListener("click", () => {
        elements.sidebar.classList.add("mobile-open");
        elements.drawerOverlay.classList.add("open");
      });

      elements.drawerOverlay.addEventListener("click", () => {
        elements.sidebar.classList.remove("mobile-open");
        elements.drawerOverlay.classList.remove("open");
      });
    }

    // Logout
    if (elements.logoutBtn) {
      elements.logoutBtn.addEventListener("click", async () => {
        try {
          await fetch("/api/logout", { method: "POST" });
        } finally {
          window.location.assign("/login.html");
        }
      });
    }

    // Pagehide / beforeunload abort
    window.addEventListener("pagehide", () => {
      if (activeAbortController) {
        activeAbortController.abort();
      }
    });
    window.addEventListener("beforeunload", () => {
      if (activeAbortController) {
        activeAbortController.abort();
      }
    });

    // Check URL parameters for checkout feedback
    const urlParams = new URLSearchParams(window.location.search);
    const checkoutStatus = urlParams.get("checkout");
    if (checkoutStatus === "success") {
      showToast("Subscription updated successfully! Welcome to your new plan.");
      // Clean up URL without reloading
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (checkoutStatus === "cancel") {
      showToast("Checkout was cancelled. Your plan remains unchanged.");
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }

  // Self-initialization
  initSession();
  setupEventListeners();
  loadBillingData();

  // Export for unit tests
  if (typeof window !== "undefined") {
    window.__billingController = {
      loadBillingData,
      handleCheckout,
      handlePortal,
      renderPlanPrices,
      renderSubscriptionAndUsage,
      isSafeExternalUrl,
      getFormattedPlanPrice,
      formatDate,
      setLoadingState,
      setSuccessState,
      setErrorState,
      getPlansData: () => plansData,
      getSubscriptionData: () => subscriptionData,
      setPlansData: (p) => {
        plansData = p;
      },
      setSubscriptionData: (s) => {
        subscriptionData = s;
      },
      elements,
    };
  }
})();
