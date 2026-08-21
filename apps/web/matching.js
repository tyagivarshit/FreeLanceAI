document.addEventListener("DOMContentLoaded", () => {
  const sidebar = document.getElementById("sidebar");
  const sidebarToggle = document.getElementById("sidebar-toggle");
  const mobileToggle = document.getElementById("mobile-drawer-toggle");
  const drawerOverlay = document.getElementById("drawer-overlay");
  const sidebarLogoutBtn = document.getElementById("sidebar-logout-btn");
  const userAvatarInitials = document.getElementById("user-avatar-initials");

  const matching = {
    refreshBtn: document.getElementById("matching-refresh-btn"),
    statusFilter: document.getElementById("matching-status-filter"),
    scoreFilter: document.getElementById("matching-score-filter"),
    platformFilter: document.getElementById("matching-platform-filter"),
    countBadge: document.getElementById("matching-count"),
    skeletonContainer: document.getElementById("matching-skeleton"),
    listContainer: document.getElementById("matching-list"),
    emptyContainer: document.getElementById("matching-empty"),
    emptyMsg: document.getElementById("matching-empty-msg"),
    errorContainer: document.getElementById("matching-error"),
    errorMsg: document.getElementById("matching-error-msg"),
    retryBtn: document.getElementById("matching-error-retry"),
    pagination: document.getElementById("matching-pagination"),
    prevBtn: document.getElementById("matching-prev-page"),
    nextBtn: document.getElementById("matching-next-page"),
    pageSummary: document.getElementById("matching-page-summary"),

    // Detail Modal Elements
    modal: document.getElementById("matching-detail-modal"),
    backdrop: document.getElementById("matching-detail-backdrop"),
    closeBtn: document.getElementById("matching-detail-close-btn"),
    closeBottomBtn: document.getElementById("detail-close-bottom-btn"),
    detailPlatformTag: document.getElementById("detail-platform-tag"),
    detailStatusBadge: document.getElementById("detail-status-badge"),
    detailCacheBadge: document.getElementById("detail-cache-badge"),
    detailTitle: document.getElementById("detail-title"),
    detailScoreVal: document.getElementById("detail-score-val"),
    breakdownSkillsVal: document.getElementById("breakdown-skills-val"),
    breakdownSkillsBar: document.getElementById("breakdown-skills-bar"),
    breakdownSemanticVal: document.getElementById("breakdown-semantic-val"),
    breakdownSemanticBar: document.getElementById("breakdown-semantic-bar"),
    breakdownExpTag: document.getElementById("breakdown-exp-tag"),
    breakdownBudgetTag: document.getElementById("breakdown-budget-tag"),
    breakdownJobTypeTag: document.getElementById("breakdown-jobtype-tag"),
    breakdownLocationTag: document.getElementById("breakdown-location-tag"),
    detailExplanationText: document.getElementById("detail-explanation-text"),
    detailStrengthsList: document.getElementById("detail-strengths-list"),
    detailGapsList: document.getElementById("detail-gaps-list"),
    detailRisksText: document.getElementById("detail-risks-text"),
    detailRecommendationsText: document.getElementById("detail-recommendations-text"),
    detailJobBudget: document.getElementById("detail-job-budget"),
    detailJobDescription: document.getElementById("detail-job-description"),
    detailPlatformLink: document.getElementById("detail-platform-link"),
    detailArchiveBtn: document.getElementById("detail-archive-btn"),
  };

  const PAGE_SIZE = 20;
  let isSidebarCollapsed = localStorage.getItem("sidebar-collapsed") === "true";
  let activeController = null;
  let requestSequence = 0;
  let activeDetailMatchId = null;
  let lastFocusedElement = null;

  const latestState = {
    status: "",
    minScore: "",
    platform: "",
    page: 1,
    pageSize: PAGE_SIZE,
    total: 0,
    totalPages: 0,
    count: 0,
    isEmpty: true,
    isLoading: false,
    hasLoaded: false,
    selectedId: null,
  };

  if (isSidebarCollapsed && sidebar) {
    sidebar.classList.add("collapsed");
    sidebarToggle?.setAttribute("aria-label", "Expand sidebar");
  }

  const prefersReducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  if (prefersReducedMotion) {
    document.body.classList.add("reduced-motion");
  }

  // Sidebar Controls
  sidebarToggle?.addEventListener("click", () => {
    isSidebarCollapsed = !isSidebarCollapsed;
    sidebar.classList.toggle("collapsed", isSidebarCollapsed);
    localStorage.setItem("sidebar-collapsed", isSidebarCollapsed);
    sidebarToggle.setAttribute(
      "aria-label",
      isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar",
    );
  });

  mobileToggle?.addEventListener("click", () => {
    sidebar?.classList.add("drawer-open");
    drawerOverlay?.classList.add("visible");
    drawerOverlay?.setAttribute("aria-hidden", "false");
  });

  drawerOverlay?.addEventListener("click", closeMobileDrawer);

  sidebarLogoutBtn?.addEventListener("click", async () => {
    try {
      const result = await window.authActions?.logout();
      if (result?.success) {
        window.location.href = "/login.html";
      }
    } catch {
      window.location.href = "/login.html";
    }
  });

  window.addEventListener("pagehide", abortActiveRequest);

  // Filter Events
  matching.statusFilter?.addEventListener("change", (e) => {
    latestState.status = e.target.value.trim();
    latestState.page = 1;
    syncUrlState();
    loadMatches({ _reason: "filter" });
  });

  matching.scoreFilter?.addEventListener("change", (e) => {
    latestState.minScore = e.target.value.trim();
    latestState.page = 1;
    syncUrlState();
    loadMatches({ _reason: "filter" });
  });

  matching.platformFilter?.addEventListener("change", (e) => {
    latestState.platform = e.target.value.trim();
    latestState.page = 1;
    syncUrlState();
    loadMatches({ _reason: "filter" });
  });

  matching.refreshBtn?.addEventListener("click", () => {
    loadMatches({ _reason: "refresh", force: true });
  });

  matching.retryBtn?.addEventListener("click", () => {
    loadMatches({ _reason: "retry", force: true });
  });

  // Pagination Handlers
  matching.prevBtn?.addEventListener("click", () => {
    if (latestState.page <= 1) {
      return;
    }
    latestState.page -= 1;
    syncUrlState();
    loadMatches({ _reason: "pagination" });
  });

  matching.nextBtn?.addEventListener("click", () => {
    if (latestState.page >= latestState.totalPages) {
      return;
    }
    latestState.page += 1;
    syncUrlState();
    loadMatches({ _reason: "pagination" });
  });

  // Modal Handlers
  matching.backdrop?.addEventListener("click", closeModal);
  matching.closeBtn?.addEventListener("click", closeModal);
  matching.closeBottomBtn?.addEventListener("click", closeModal);

  matching.detailArchiveBtn?.addEventListener("click", async () => {
    if (!activeDetailMatchId) {
      return;
    }
    await archiveMatch(activeDetailMatchId);
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (matching.modal && !matching.modal.classList.contains("hidden")) {
        closeModal();
        return;
      }
      if (sidebar?.classList.contains("drawer-open")) {
        closeMobileDrawer();
      }
    }
  });

  // Startup Lifecycle
  initializeFromUrl();
  checkAuth();

  function closeMobileDrawer() {
    sidebar?.classList.remove("drawer-open");
    drawerOverlay?.classList.remove("visible");
    drawerOverlay?.setAttribute("aria-hidden", "true");
  }

  async function checkAuth() {
    try {
      const response = await fetch("/api/session");
      const data = await response.json();
      if (response.ok && data.success && data.user) {
        const email = data.user.email || "";
        if (userAvatarInitials) {
          userAvatarInitials.textContent = email.charAt(0).toUpperCase() || "U";
        }
        await loadMatches({ _reason: "initial", force: true });
        if (latestState.selectedId) {
          openDetailModalById(latestState.selectedId);
        }
        return;
      }
      window.location.href = "/login.html";
    } catch {
      window.location.href = "/login.html";
    }
  }

  function initializeFromUrl() {
    const params = new URLSearchParams(window.location.search || "");
    const statusParam = (params.get("status") || "").trim().toUpperCase();
    const scoreParam = (params.get("minScore") || params.get("score") || "").trim();
    const platformParam = (params.get("platform") || "").trim().toLowerCase();
    const pageParam = parseInt(params.get("page") || "1", 10);
    const idParam = (params.get("id") || "").trim();

    latestState.status = ["CREATED", "EVALUATED", "ARCHIVED"].includes(statusParam)
      ? statusParam
      : "";
    latestState.minScore = ["90", "75", "50"].includes(scoreParam) ? scoreParam : "";
    latestState.platform = ["upwork", "linkedin"].includes(platformParam) ? platformParam : "";
    latestState.page = !isNaN(pageParam) && pageParam > 0 ? pageParam : 1;
    latestState.selectedId = idParam || null;

    if (matching.statusFilter) {
      matching.statusFilter.value = latestState.status;
    }
    if (matching.scoreFilter) {
      matching.scoreFilter.value = latestState.minScore;
    }
    if (matching.platformFilter) {
      matching.platformFilter.value = latestState.platform;
    }
  }

  function syncUrlState() {
    const params = new URLSearchParams();
    if (latestState.status) {
      params.set("status", latestState.status);
    }
    if (latestState.minScore) {
      params.set("minScore", latestState.minScore);
    }
    if (latestState.platform) {
      params.set("platform", latestState.platform);
    }
    if (latestState.page > 1) {
      params.set("page", String(latestState.page));
    }
    if (activeDetailMatchId) {
      params.set("id", activeDetailMatchId);
    }

    const query = params.toString();
    const nextUrl = query ? `/matching.html?${query}` : "/matching.html";
    if (window.history?.replaceState) {
      window.history.replaceState(null, "", nextUrl);
    }
  }

  async function loadMatches({ _reason } = {}) {
    abortActiveRequest();
    activeController = new AbortController();
    latestState.isLoading = true;
    const requestId = ++requestSequence;

    setLoadingState();

    try {
      const params = new URLSearchParams({
        page: String(latestState.page),
        pageSize: String(latestState.pageSize),
      });
      if (latestState.status) {
        params.set("status", latestState.status);
      }
      if (latestState.minScore) {
        params.set("minScore", latestState.minScore);
      }
      if (latestState.platform) {
        params.set("platform", latestState.platform);
      }

      const response = await fetch(`/api/matches?${params.toString()}`, {
        signal: activeController.signal,
      });

      if (response.status === 401) {
        window.location.href = "/login.html";
        return;
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP error ${response.status}`);
      }

      const data = await response.json();
      if (requestId !== requestSequence) {
        return;
      }

      latestState.isLoading = false;
      latestState.total = data.total ?? (Array.isArray(data.matches) ? data.matches.length : 0);
      latestState.page = data.page ?? 1;
      latestState.pageSize = data.pageSize ?? PAGE_SIZE;
      latestState.totalPages =
        data.totalPages ?? Math.max(1, Math.ceil(latestState.total / latestState.pageSize));
      latestState.count = Array.isArray(data.matches) ? data.matches.length : 0;
      latestState.isEmpty = latestState.count === 0;
      latestState.hasLoaded = true;

      renderMatches(Array.isArray(data.matches) ? data.matches : []);
      renderPagination();
    } catch (err) {
      if (err.name === "AbortError") {
        return;
      }
      if (requestId !== requestSequence) {
        return;
      }
      latestState.isLoading = false;
      renderError(err);
    }
  }

  function setLoadingState() {
    matching.errorContainer?.classList.add("hidden");
    matching.emptyContainer?.classList.add("hidden");
    matching.listContainer?.classList.add("hidden");
    matching.pagination?.classList.add("hidden");

    matching.skeletonContainer?.classList.remove("hidden");
    if (matching.countBadge) {
      matching.countBadge.textContent = "Loading...";
    }
  }

  function renderMatches(items) {
    matching.skeletonContainer?.classList.add("hidden");
    matching.errorContainer?.classList.add("hidden");

    if (items.length === 0) {
      matching.listContainer?.classList.add("hidden");
      matching.pagination?.classList.add("hidden");
      if (matching.countBadge) {
        matching.countBadge.textContent = "0 matches";
      }
      matching.emptyContainer?.classList.remove("hidden");
      return;
    }

    matching.emptyContainer?.classList.add("hidden");
    if (matching.countBadge) {
      const label = `${latestState.total} ${latestState.total === 1 ? "match" : "matches"}`;
      matching.countBadge.textContent = label;
    }

    if (!matching.listContainer) {
      return;
    }
    matching.listContainer.innerHTML = "";

    const fragment = document.createDocumentFragment();
    items.forEach((item) => {
      fragment.appendChild(createMatchCard(item));
    });

    matching.listContainer.appendChild(fragment);
    matching.listContainer.classList.remove("hidden");
  }

  function createMatchCard(item) {
    const card = document.createElement("article");
    card.className = "matching-card";
    card.setAttribute("id", `match-card-${item.id}`);
    card.setAttribute("tabindex", "0");
    card.setAttribute("aria-label", `Match: ${item.jobTitle || "Job"}`);

    // Card Header Row
    const headerRow = document.createElement("div");
    headerRow.className = "matching-card-header";

    const tagsWrap = document.createElement("div");
    tagsWrap.className = "matching-card-tags";

    const platformTag = document.createElement("span");
    platformTag.className = "platform-tag";
    platformTag.textContent = item.platform || "Platform";
    tagsWrap.appendChild(platformTag);

    const statusBadge = document.createElement("span");
    statusBadge.className = `status-badge status-${(item.status || "created").toLowerCase()}`;
    statusBadge.textContent = item.status || "EVALUATED";
    tagsWrap.appendChild(statusBadge);

    if (item.cacheState) {
      const cacheTag = document.createElement("span");
      cacheTag.className = `cache-badge cache-${item.cacheState.toLowerCase()}`;
      cacheTag.textContent = item.cacheState === "CACHED" ? "Cached" : "Fresh";
      tagsWrap.appendChild(cacheTag);
    }

    headerRow.appendChild(tagsWrap);

    const scoreBadge = document.createElement("div");
    scoreBadge.className = "matching-card-score";
    const scoreVal = typeof item.score === "number" ? `${item.score}%` : "—";
    scoreBadge.textContent = `${scoreVal} Match`;
    headerRow.appendChild(scoreBadge);

    card.appendChild(headerRow);

    // Title
    const title = document.createElement("h2");
    title.className = "matching-card-title font-display";
    title.textContent = item.jobTitle || "Untitled Opportunity";
    card.appendChild(title);

    // Short Explanation Summary
    if (item.explanation) {
      const explanation = document.createElement("p");
      explanation.className = "matching-card-explanation";
      explanation.textContent = item.explanation;
      card.appendChild(explanation);
    }

    // Factors / Strengths & Gaps Row
    const factorsRow = document.createElement("div");
    factorsRow.className = "matching-card-factors";

    if (Array.isArray(item.strengths) && item.strengths.length > 0) {
      const strengthsWrap = document.createElement("div");
      strengthsWrap.className = "factor-chips-wrap";
      const sLabel = document.createElement("span");
      sLabel.className = "factor-chip-label strengths-label";
      sLabel.textContent = "Strengths:";
      strengthsWrap.appendChild(sLabel);

      item.strengths.slice(0, 4).forEach((skill) => {
        const chip = document.createElement("span");
        chip.className = "factor-chip factor-chip-strength";
        chip.textContent = skill;
        strengthsWrap.appendChild(chip);
      });
      factorsRow.appendChild(strengthsWrap);
    }

    if (Array.isArray(item.gaps) && item.gaps.length > 0) {
      const gapsWrap = document.createElement("div");
      gapsWrap.className = "factor-chips-wrap";
      const gLabel = document.createElement("span");
      gLabel.className = "factor-chip-label gaps-label";
      gLabel.textContent = "Gaps:";
      gapsWrap.appendChild(gLabel);

      item.gaps.slice(0, 3).forEach((skill) => {
        const chip = document.createElement("span");
        chip.className = "factor-chip factor-chip-gap";
        chip.textContent = skill;
        gapsWrap.appendChild(chip);
      });
      factorsRow.appendChild(gapsWrap);
    }

    card.appendChild(factorsRow);

    // Action Controls Footer
    const footer = document.createElement("div");
    footer.className = "matching-card-footer";

    const detailBtn = document.createElement("button");
    detailBtn.type = "button";
    detailBtn.className = "btn btn-secondary btn-sm";
    detailBtn.textContent = "View Explanation";
    detailBtn.setAttribute("aria-label", `View match explanation for ${item.jobTitle || "Job"}`);
    detailBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      openDetailModal(item, detailBtn);
    });
    footer.appendChild(detailBtn);

    if (item.canonicalUrl && isValidHttpUrl(item.canonicalUrl)) {
      const platformLink = document.createElement("a");
      platformLink.href = item.canonicalUrl;
      platformLink.target = "_blank";
      platformLink.rel = "noopener noreferrer";
      platformLink.className = "btn btn-secondary btn-sm";
      platformLink.textContent = "Open Job ↗";
      platformLink.addEventListener("click", (e) => e.stopPropagation());
      footer.appendChild(platformLink);
    }

    if (item.status !== "ARCHIVED") {
      const archiveBtn = document.createElement("button");
      archiveBtn.type = "button";
      archiveBtn.className = "btn btn-secondary btn-sm btn-archive";
      archiveBtn.textContent = "Archive";
      archiveBtn.setAttribute("aria-label", `Archive match for ${item.jobTitle || "Job"}`);
      archiveBtn.addEventListener("click", async (e) => {
        e.stopPropagation();
        await archiveMatch(item.id);
      });
      footer.appendChild(archiveBtn);
    }

    card.appendChild(footer);

    card.addEventListener("click", () => {
      openDetailModal(item, card);
    });

    card.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && document.activeElement === card) {
        openDetailModal(item, card);
      }
    });

    return card;
  }

  async function openDetailModalById(matchId) {
    try {
      const response = await fetch(`/api/matches/${encodeURIComponent(matchId)}`);
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.match) {
          openDetailModal(data.match);
        }
      }
    } catch {
      // Degrade silently if detail lookup fails on load
    }
  }

  function openDetailModal(item, triggerEl = null) {
    if (!matching.modal) {
      return;
    }
    lastFocusedElement = triggerEl || document.activeElement;
    activeDetailMatchId = item.id;
    syncUrlState();

    if (matching.detailPlatformTag) {
      matching.detailPlatformTag.textContent = item.platform || "Platform";
    }
    if (matching.detailStatusBadge) {
      matching.detailStatusBadge.textContent = item.status || "EVALUATED";
      matching.detailStatusBadge.className = `status-badge status-${(item.status || "created").toLowerCase()}`;
    }
    if (matching.detailCacheBadge) {
      matching.detailCacheBadge.textContent = item.cacheState === "CACHED" ? "Cached" : "Fresh";
    }
    if (matching.detailTitle) {
      matching.detailTitle.textContent = item.jobTitle || "Untitled Opportunity";
    }
    if (matching.detailScoreVal) {
      matching.detailScoreVal.textContent = typeof item.score === "number" ? `${item.score}%` : "—";
    }

    // Breakdown Bars & Values
    const b = item.scoreBreakdown || {};
    const skillPct = Math.round((b.skills ?? 0) * 100);
    const semanticPct = typeof b.semantic === "number" ? Math.round(b.semantic * 100) : 0;

    if (matching.breakdownSkillsVal) {
      matching.breakdownSkillsVal.textContent = `${skillPct}%`;
    }
    if (matching.breakdownSkillsBar) {
      matching.breakdownSkillsBar.style.width = `${skillPct}%`;
    }

    if (matching.breakdownSemanticVal) {
      matching.breakdownSemanticVal.textContent = `${semanticPct}%`;
    }
    if (matching.breakdownSemanticBar) {
      matching.breakdownSemanticBar.style.width = `${semanticPct}%`;
    }

    updateCompatibilityTag(matching.breakdownExpTag, b.experience);
    updateCompatibilityTag(matching.breakdownBudgetTag, b.budget);
    updateCompatibilityTag(matching.breakdownJobTypeTag, b.jobType);
    updateCompatibilityTag(matching.breakdownLocationTag, b.location);

    // Explanation Summary & Lists
    if (matching.detailExplanationText) {
      matching.detailExplanationText.textContent =
        item.explanation || "Detailed fit analysis based on skills and preferences.";
    }

    renderTagList(matching.detailStrengthsList, item.strengths, "factor-chip-strength");
    renderTagList(matching.detailGapsList, item.gaps, "factor-chip-gap");

    if (matching.detailRisksText) {
      matching.detailRisksText.textContent =
        item.risks || "No significant compatibility risks identified.";
    }

    if (matching.detailRecommendationsText) {
      matching.detailRecommendationsText.textContent =
        item.recommendations || "Review client expectations and submit tailored proposal.";
    }

    if (matching.detailJobBudget) {
      matching.detailJobBudget.textContent = item.budget
        ? `Budget: ${item.budget}`
        : "Budget: Flexible / Unspecified";
    }

    if (matching.detailJobDescription) {
      matching.detailJobDescription.textContent =
        item.jobDescription || "No detailed job description available.";
    }

    // Platform External Link
    if (matching.detailPlatformLink) {
      if (item.canonicalUrl && isValidHttpUrl(item.canonicalUrl)) {
        matching.detailPlatformLink.href = item.canonicalUrl;
        matching.detailPlatformLink.classList.remove("hidden");
      } else {
        matching.detailPlatformLink.classList.add("hidden");
      }
    }

    if (matching.detailArchiveBtn) {
      matching.detailArchiveBtn.textContent =
        item.status === "ARCHIVED" ? "Archived" : "Archive Match";
      matching.detailArchiveBtn.disabled = item.status === "ARCHIVED";
    }

    matching.modal.classList.remove("hidden");
    matching.closeBtn?.focus();
  }

  function updateCompatibilityTag(element, value) {
    if (!element) {
      return;
    }
    const tag = (value || "UNKNOWN").toUpperCase();
    element.textContent = tag;
    element.className = `breakdown-status-tag tag-${tag.toLowerCase()}`;
  }

  function renderTagList(container, items, className) {
    if (!container) {
      return;
    }
    container.innerHTML = "";
    if (!Array.isArray(items) || items.length === 0) {
      const none = document.createElement("span");
      none.className = "factor-none";
      none.textContent = "None identified";
      container.appendChild(none);
      return;
    }
    items.forEach((item) => {
      const chip = document.createElement("span");
      chip.className = `factor-chip ${className}`;
      chip.textContent = item;
      container.appendChild(chip);
    });
  }

  function closeModal() {
    if (!matching.modal) {
      return;
    }
    matching.modal.classList.add("hidden");
    activeDetailMatchId = null;
    syncUrlState();
    if (lastFocusedElement && typeof lastFocusedElement.focus === "function") {
      lastFocusedElement.focus();
    }
  }

  async function archiveMatch(matchId) {
    try {
      const response = await fetch(`/api/matches/${encodeURIComponent(matchId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "ARCHIVED" }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.match) {
          // Update card in DOM
          const card = document.getElementById(`match-card-${matchId}`);
          if (card) {
            const statusBadge = card.querySelector(".status-badge");
            if (statusBadge) {
              statusBadge.textContent = "ARCHIVED";
              statusBadge.className = "status-badge status-archived";
            }
            const archiveBtn = card.querySelector(".btn-archive");
            if (archiveBtn) {
              archiveBtn.remove();
            }
          }

          if (activeDetailMatchId === matchId && matching.detailStatusBadge) {
            matching.detailStatusBadge.textContent = "ARCHIVED";
            matching.detailStatusBadge.className = "status-badge status-archived";
            if (matching.detailArchiveBtn) {
              matching.detailArchiveBtn.textContent = "Archived";
              matching.detailArchiveBtn.disabled = true;
            }
          }
        }
      }
    } catch {
      // Safe fallback on mutation error
    }
  }

  function renderPagination() {
    if (!matching.pagination) {
      return;
    }
    if (latestState.total <= latestState.pageSize) {
      matching.pagination.classList.add("hidden");
      return;
    }

    const totalPages = Math.max(1, latestState.totalPages);
    if (matching.prevBtn) {
      matching.prevBtn.disabled = latestState.page <= 1 || latestState.isLoading;
    }
    if (matching.nextBtn) {
      matching.nextBtn.disabled = latestState.page >= totalPages || latestState.isLoading;
    }
    if (matching.pageSummary) {
      matching.pageSummary.textContent = `Page ${latestState.page} of ${totalPages}`;
    }

    matching.pagination.classList.remove("hidden");
  }

  function renderError(err) {
    matching.skeletonContainer?.classList.add("hidden");
    matching.listContainer?.classList.add("hidden");
    matching.emptyContainer?.classList.add("hidden");
    matching.pagination?.classList.add("hidden");

    if (matching.countBadge) {
      matching.countBadge.textContent = "Error";
    }
    if (matching.errorMsg) {
      matching.errorMsg.textContent =
        err.message || "An unexpected error occurred while loading matches.";
    }
    matching.errorContainer?.classList.remove("hidden");
  }

  function abortActiveRequest() {
    if (activeController) {
      activeController.abort();
      activeController = null;
    }
  }

  function isValidHttpUrl(string) {
    try {
      const url = new URL(string);
      return url.protocol === "http:" || url.protocol === "https:";
    } catch {
      return false;
    }
  }
});
