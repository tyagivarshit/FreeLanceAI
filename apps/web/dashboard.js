document.addEventListener("DOMContentLoaded", () => {
  // DOM Elements
  const sidebar = document.getElementById("sidebar");
  const sidebarToggle = document.getElementById("sidebar-toggle");
  const mobileToggle = document.getElementById("mobile-drawer-toggle");
  const drawerOverlay = document.getElementById("drawer-overlay");
  const welcomeMessage = document.getElementById("welcome-message");
  const userAvatarInitials = document.getElementById("user-avatar-initials");
  const sidebarLogoutBtn = document.getElementById("sidebar-logout-btn");

  // KPI elements
  const kpis = {
    scanned: {
      card: document.getElementById("metric-scanned"),
      skeleton: document.querySelector("#metric-scanned .metric-skeleton"),
      valWrap: document.querySelector("#metric-scanned .metric-val-wrap"),
      val: document.getElementById("kpi-scanned-val"),
      trend: document.getElementById("kpi-scanned-trend"),
      error: document.getElementById("kpi-scanned-error"),
      retryBtn: document.querySelector("#metric-scanned .btn-retry"),
    },
    matches: {
      card: document.getElementById("metric-matches"),
      skeleton: document.querySelector("#metric-matches .metric-skeleton"),
      valWrap: document.querySelector("#metric-matches .metric-val-wrap"),
      val: document.getElementById("kpi-matches-val"),
      trend: document.getElementById("kpi-matches-trend"),
      error: document.getElementById("kpi-matches-error"),
      retryBtn: document.querySelector("#metric-matches .btn-retry"),
    },
    proposals: {
      card: document.getElementById("metric-proposals"),
      skeleton: document.querySelector("#metric-proposals .metric-skeleton"),
      valWrap: document.querySelector("#metric-proposals .metric-val-wrap"),
      val: document.getElementById("kpi-proposals-val"),
      trend: document.getElementById("kpi-proposals-trend"),
      error: document.getElementById("kpi-proposals-error"),
      retryBtn: document.querySelector("#metric-proposals .btn-retry"),
    },
  };

  // Opportunity Pulse elements
  const pulse = {
    skeleton: document.getElementById("pulse-skeleton"),
    desc: document.getElementById("pulse-desc"),
    error: document.getElementById("pulse-error"),
    retryBtn: document.querySelector(".pulse-container .btn-retry"),
  };

  // Opportunities elements
  const opps = {
    skeleton: document.getElementById("skeleton-feed"),
    list: document.getElementById("opportunities-list"),
    empty: document.getElementById("opportunities-empty"),
    error: document.getElementById("opportunities-error"),
    errorMsg: document.getElementById("opportunities-error-msg"),
    retryBtn: document.getElementById("btn-opportunities-retry"),
    countBadge: document.getElementById("opportunities-count"),
  };

  // Usage elements
  const usage = {
    skeleton: document.getElementById("usage-skeleton"),
    details: document.getElementById("usage-details"),
    error: document.getElementById("usage-error"),
    retryBtn: document.getElementById("btn-usage-retry"),
    planBadge: document.getElementById("plan-badge-val"),
    quotaFraction: document.getElementById("proposal-quota-fraction"),
    quotaDesc: document.getElementById("proposal-quota-remaining-desc"),
    progressBar: document.getElementById("proposal-progress-bar"),
    billingStatus: document.getElementById("billing-status-val"),
  };

  // Activity elements
  const activity = {
    skeleton: document.getElementById("activity-skeleton"),
    timeline: document.getElementById("activity-timeline"),
    empty: document.getElementById("activity-empty"),
    error: document.getElementById("activity-error"),
    retryBtn: document.getElementById("btn-activity-retry"),
  };

  // State
  let userSession = null;
  let isSidebarCollapsed = localStorage.getItem("sidebar-collapsed") === "true";

  // Check user session immediately
  checkAuth();

  // Initialize Sidebar state
  if (isSidebarCollapsed) {
    sidebar.classList.add("collapsed");
    sidebarToggle.setAttribute("aria-label", "Expand sidebar");
  }

  // Sidebar Toggles
  sidebarToggle.addEventListener("click", () => {
    isSidebarCollapsed = !isSidebarCollapsed;
    sidebar.classList.toggle("collapsed", isSidebarCollapsed);
    localStorage.setItem("sidebar-collapsed", isSidebarCollapsed);
    sidebarToggle.setAttribute(
      "aria-label",
      isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar",
    );
  });

  mobileToggle.addEventListener("click", () => {
    sidebar.classList.add("drawer-open");
    drawerOverlay.classList.add("visible");
    drawerOverlay.setAttribute("aria-hidden", "false");
  });

  drawerOverlay.addEventListener("click", () => {
    closeMobileDrawer();
  });

  function closeMobileDrawer() {
    sidebar.classList.remove("drawer-open");
    drawerOverlay.classList.remove("visible");
    drawerOverlay.setAttribute("aria-hidden", "true");
  }

  // Keyboard Navigation / Accessibility for Sidebar
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && sidebar.classList.contains("drawer-open")) {
      closeMobileDrawer();
    }
  });

  // Reduced motion setup
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (prefersReducedMotion) {
    document.body.classList.add("reduced-motion");
  }

  // Session & Authentication check
  async function checkAuth() {
    try {
      const response = await fetch("/api/session");
      const data = await response.json();
      if (response.ok && data.success && data.user) {
        userSession = data.user;
        const email = userSession.email || "";
        const namePart = email.split("@")[0] || "Freelancer";
        const cleanName = namePart.charAt(0).toUpperCase() + namePart.slice(1);
        welcomeMessage.textContent = `Good morning, ${cleanName}`;
        userAvatarInitials.textContent = email.charAt(0).toUpperCase() || "U";

        // Initial load of all sections
        loadDashboardData();
      } else {
        // Unauthenticated -> redirect
        window.location.href = "/login.html";
      }
    } catch {
      window.location.href = "/login.html";
    }
  }

  // Logout action
  sidebarLogoutBtn.addEventListener("click", async () => {
    try {
      const result = await window.authActions.logout();
      if (result.success) {
        window.location.href = "/login.html";
      }
    } catch (err) {
      console.error("Logout failed:", err);
      // Fallback redirect
      window.location.href = "/login.html";
    }
  });

  // Main Dashboard Data Loading Orchestrator (Parallelized requests)
  function loadDashboardData() {
    loadKPI("scanned", "/api/analytics/scanned");
    loadKPI("matches", "/api/analytics/matches");
    loadKPI("proposals", "/api/analytics/proposals");
    loadPulse();
    loadOpportunities();
    loadUsage();
    loadActivity();
  }

  // Load KPI Section
  async function loadKPI(type, url) {
    const kpiElement = kpis[type];
    kpiElement.skeleton.classList.remove("hidden");
    kpiElement.valWrap.classList.add("hidden");
    kpiElement.error.classList.add("hidden");

    // Artificial tiny delay for progressive loading transition smoothness
    await new Promise((r) => setTimeout(r, 450));

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();

      kpiElement.val.textContent = data.value !== undefined ? data.value : "0";
      kpiElement.trend.textContent = data.trend || "No trend";
      kpiElement.trend.className = "metric-trend " + getTrendClass(data.trend);

      kpiElement.skeleton.classList.add("hidden");
      kpiElement.valWrap.classList.remove("hidden");
    } catch (err) {
      console.warn(`[Dashboard] KPI ${type} load failed (MISSING BACKEND CONTRACT):`, err.message);
      kpiElement.skeleton.classList.add("hidden");
      kpiElement.error.classList.remove("hidden");
    }
  }

  // Load Opportunity Pulse Section
  async function loadPulse() {
    pulse.skeleton.classList.remove("hidden");
    pulse.desc.classList.add("hidden");
    pulse.error.classList.add("hidden");

    await new Promise((r) => setTimeout(r, 500));

    try {
      const response = await fetch("/api/analytics/pulse");
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();

      pulse.desc.textContent =
        data.description || "Scans are active. We're matching candidates against your experience.";
      pulse.skeleton.classList.add("hidden");
      pulse.desc.classList.remove("hidden");
    } catch (err) {
      console.warn("[Dashboard] Pulse load failed (MISSING BACKEND CONTRACT):", err.message);
      pulse.skeleton.classList.add("hidden");
      pulse.error.classList.remove("hidden");
    }
  }

  // Load Opportunities Section
  async function loadOpportunities() {
    opps.skeleton.classList.remove("hidden");
    opps.list.classList.add("hidden");
    opps.empty.classList.add("hidden");
    opps.error.classList.add("hidden");

    await new Promise((r) => setTimeout(r, 600));

    try {
      const response = await fetch("/api/jobs");
      if (response.status === 404) {
        throw new Error("Missing backend API contract: GET /api/jobs is not implemented.");
      }
      if (!response.ok) {
        throw new Error(`Server returned HTTP ${response.status}`);
      }
      const data = await response.json();
      const jobs = data.jobs || [];

      opps.skeleton.classList.add("hidden");

      if (jobs.length === 0) {
        opps.empty.classList.remove("hidden");
        opps.countBadge.textContent = "0 found";
      } else {
        renderOpportunitiesList(jobs);
        opps.list.classList.remove("hidden");
        opps.countBadge.textContent = `${jobs.length} found`;
      }
    } catch (err) {
      console.warn(
        "[Dashboard] Opportunities load failed (MISSING BACKEND CONTRACT):",
        err.message,
      );
      opps.skeleton.classList.add("hidden");
      opps.errorMsg.textContent =
        err.message || "Missing backend API contract: GET /api/jobs is not implemented.";
      opps.error.classList.remove("hidden");
    }
  }

  // Load Usage & Billing Section
  async function loadUsage() {
    usage.skeleton.classList.remove("hidden");
    usage.details.classList.add("hidden");
    usage.error.classList.add("hidden");

    await new Promise((r) => setTimeout(r, 400));

    try {
      const response = await fetch("/api/entitlements");
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();

      const planName = data.planId || "STARTER";
      const limits = data.limits || {};
      const usageStats = data.usage || {};
      const source = data.source || "STARTER";

      // 1. Plan Badge
      usage.planBadge.textContent = planName;
      usage.planBadge.className = `plan-badge plan-${planName.toLowerCase()}`;

      // 2. Proposal Quota progress
      const proposalLimit = limits.aiProposals;
      const proposalsUsed = usageStats.aiProposals || 0;

      if (proposalLimit && proposalLimit.type === "LIMITED") {
        const total = proposalLimit.value;
        const remaining = Math.max(0, total - proposalsUsed);
        usage.quotaFraction.textContent = `${proposalsUsed} / ${total}`;
        const pct = Math.min(100, (proposalsUsed / total) * 100);
        usage.progressBar.style.width = `${pct}%`;
        usage.quotaDesc.textContent = `${remaining} remaining`;
      } else if (proposalLimit && proposalLimit.type === "UNLIMITED") {
        usage.quotaFraction.textContent = "∞ Unlimited";
        usage.progressBar.style.width = "100%";
        usage.quotaDesc.textContent = "Unlimited proposals available on this plan.";
      } else {
        usage.quotaFraction.textContent = "—";
        usage.progressBar.style.width = "0%";
        usage.quotaDesc.textContent = "Quota limits unavailable.";
      }

      // 3. Billing Status / Trial
      if (source === "TRIAL") {
        const days = data.trialDaysRemaining !== undefined ? data.trialDaysRemaining : 7;
        usage.planBadge.textContent = `${planName} TRIAL`;
        usage.billingStatus.textContent = `${days} days remaining in your free Pro trial.`;
      } else if (source === "SUBSCRIPTION") {
        usage.billingStatus.textContent = "Your paid subscription is active.";
      } else {
        usage.billingStatus.textContent =
          "Starter plan is active. Upgrade to unlock advanced features.";
      }

      usage.skeleton.classList.add("hidden");
      usage.details.classList.remove("hidden");
    } catch (err) {
      console.warn("[Dashboard] Usage load failed (MISSING BACKEND CONTRACT):", err.message);
      usage.skeleton.classList.add("hidden");
      usage.error.classList.remove("hidden");
    }
  }

  // Load Recent Activity
  async function loadActivity() {
    activity.skeleton.classList.remove("hidden");
    activity.timeline.classList.add("hidden");
    activity.empty.classList.add("hidden");
    activity.error.classList.add("hidden");

    await new Promise((r) => setTimeout(r, 550));

    try {
      const response = await fetch("/api/activity");
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      const logs = data.activity || [];

      activity.skeleton.classList.add("hidden");

      if (logs.length === 0) {
        activity.empty.classList.remove("hidden");
      } else {
        renderActivityTimeline(logs);
        activity.timeline.classList.remove("hidden");
      }
    } catch (err) {
      console.warn("[Dashboard] Activity load failed (MISSING BACKEND CONTRACT):", err.message);
      activity.skeleton.classList.add("hidden");
      activity.error.classList.remove("hidden");
    }
  }

  // Render Opportunities list HTML
  function renderOpportunitiesList(jobs) {
    opps.list.innerHTML = "";
    jobs.forEach((job) => {
      const card = document.createElement("div");
      card.className = "opportunity-card";

      const scoreHtml = job.score
        ? `<div class="match-score-pill score-${getScoreRangeClass(job.score)}">${job.score}% match</div>`
        : "";

      const budgetHtml = job.budget ? `<span class="opp-budget">${job.budget}</span>` : "";

      const skillsHtml = (job.skills || [])
        .map((skill) => `<span class="skill-badge">${skill}</span>`)
        .join("");

      const explanationHtml = job.matchExplanation
        ? `<div class="opp-explanation"><strong>Why it fits:</strong> ${job.matchExplanation}</div>`
        : "";

      card.innerHTML = `
        <div class="opp-card-header">
          <div>
            <h4 class="opp-title font-display">${escapeHtml(job.title)}</h4>
            <span class="opp-meta">${escapeHtml(job.platform || "Upwork")} &middot; ${getRelativeTime(job.createdAt)}</span>
          </div>
          ${scoreHtml}
        </div>
        <div class="opp-body">
          <div class="skills-wrap">${skillsHtml}</div>
          ${explanationHtml}
          <div class="opp-footer">
            ${budgetHtml}
            <a href="/matching.html?jobId=${job.id}" class="btn btn-secondary btn-sm">View match details</a>
          </div>
        </div>
      `;
      opps.list.appendChild(card);
    });
  }

  // Render Activity Timeline HTML
  function renderActivityTimeline(logs) {
    activity.timeline.innerHTML = "";
    logs.forEach((log) => {
      const item = document.createElement("div");
      item.className = "timeline-item";

      item.innerHTML = `
        <div class="timeline-dot"></div>
        <div class="timeline-content">
          <p class="timeline-text">${escapeHtml(log.message)}</p>
          <span class="timeline-time">${getRelativeTime(log.timestamp)}</span>
        </div>
      `;
      activity.timeline.appendChild(item);
    });
  }

  // Trend class resolver
  function getTrendClass(trendText) {
    if (!trendText) {
      return "trend-neutral";
    }
    if (trendText.startsWith("+") || trendText.includes("up")) {
      return "trend-positive";
    }
    if (trendText.startsWith("-") || trendText.includes("down")) {
      return "trend-negative";
    }
    return "trend-neutral";
  }

  // Match Score pill class resolver
  function getScoreRangeClass(score) {
    if (score >= 90) {
      return "high";
    }
    if (score >= 70) {
      return "medium";
    }
    return "low";
  }

  // Escape HTML helper
  function escapeHtml(str) {
    if (!str) {
      return "";
    }
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // Calculate relative timestamps
  function getRelativeTime(dateInput) {
    if (!dateInput) {
      return "just now";
    }
    const date = new Date(dateInput);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHr = Math.floor(diffMin / 60);
    const diffDays = Math.floor(diffHr / 24);

    if (diffSec < 60) {
      return "just now";
    }
    if (diffMin < 60) {
      return `${diffMin}m ago`;
    }
    if (diffHr < 24) {
      return `${diffHr}h ago`;
    }
    return `${diffDays}d ago`;
  }

  // Hook all retry action triggers
  kpis.scanned.retryBtn.addEventListener("click", () =>
    loadKPI("scanned", "/api/analytics/scanned"),
  );
  kpis.matches.retryBtn.addEventListener("click", () =>
    loadKPI("matches", "/api/analytics/matches"),
  );
  kpis.proposals.retryBtn.addEventListener("click", () =>
    loadKPI("proposals", "/api/analytics/proposals"),
  );
  pulse.retryBtn.addEventListener("click", loadPulse);
  opps.retryBtn.addEventListener("click", loadOpportunities);
  usage.retryBtn.addEventListener("click", loadUsage);
  activity.retryBtn.addEventListener("click", loadActivity);
});
