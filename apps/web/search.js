document.addEventListener("DOMContentLoaded", () => {
  const sidebar = document.getElementById("sidebar");
  const sidebarToggle = document.getElementById("sidebar-toggle");
  const mobileToggle = document.getElementById("mobile-drawer-toggle");
  const drawerOverlay = document.getElementById("drawer-overlay");
  const sidebarLogoutBtn = document.getElementById("sidebar-logout-btn");
  const userAvatarInitials = document.getElementById("user-avatar-initials");

  const search = {
    input: document.getElementById("search-input"),
    clearBtn: document.getElementById("search-clear-btn"),
    filterTabs: document.querySelectorAll(".search-filter-chip"),
    countBadge: document.getElementById("search-count"),
    idleContainer: document.getElementById("search-idle"),
    skeletonContainer: document.getElementById("search-skeleton"),
    resultsList: document.getElementById("search-results-list"),
    emptyContainer: document.getElementById("search-empty"),
    emptyMsg: document.getElementById("search-empty-msg"),
    errorContainer: document.getElementById("search-error"),
    errorMsg: document.getElementById("search-error-msg"),
    retryBtn: document.getElementById("search-error-retry"),
    pagination: document.getElementById("search-pagination"),
    prevBtn: document.getElementById("search-prev-page"),
    nextBtn: document.getElementById("search-next-page"),
    pageSummary: document.getElementById("search-page-summary"),
  };

  const VALID_FILTERS = ["CLIENT", "JOB", "MATCH", "TIMELINE"];
  const PAGE_SIZE = 20;
  const DEBOUNCE_MS = 300;

  let isSidebarCollapsed = localStorage.getItem("sidebar-collapsed") === "true";
  let activeController = null;
  let debounceTimer = null;
  let requestSequence = 0;
  let activeRequestKey = "";
  let selectedResultIndex = -1;

  const latestState = {
    query: "",
    filter: "",
    page: 1,
    pageSize: PAGE_SIZE,
    total: 0,
    totalPages: 0,
    count: 0,
    isEmpty: true,
    hasLoaded: false,
    isLoading: false,
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

  // Global Keyboard Shortcuts
  document.addEventListener("keydown", handleGlobalKeydown);

  // Search Input Events
  search.input?.addEventListener("input", handleSearchInput);
  search.input?.addEventListener("keydown", handleInputKeydown);
  search.clearBtn?.addEventListener("click", handleClearSearch);

  // Filter Tabs
  search.filterTabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const type = tab.getAttribute("data-type") || "";
      if (type && !VALID_FILTERS.includes(type)) {
        return;
      }
      setActiveFilter(type);
      latestState.page = 1;
      syncUrlState();
      if (latestState.query.trim()) {
        loadSearch({ reason: "filter", force: true });
      }
    });
  });

  // Pagination & Retry Handlers
  search.prevBtn?.addEventListener("click", () => {
    if (latestState.page <= 1) {
      return;
    }
    latestState.page -= 1;
    syncUrlState();
    loadSearch({ reason: "pagination" });
  });

  search.nextBtn?.addEventListener("click", () => {
    if (latestState.page >= latestState.totalPages) {
      return;
    }
    latestState.page += 1;
    syncUrlState();
    loadSearch({ reason: "pagination" });
  });

  search.retryBtn?.addEventListener("click", () => loadSearch({ reason: "retry", force: true }));

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
        if (latestState.query.trim()) {
          loadSearch({ reason: "initial", force: true });
        } else {
          renderIdleState();
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
    const q = (params.get("q") || params.get("query") || "").trim();
    const typeParam = (params.get("types") || params.get("resultTypes") || "").trim().toUpperCase();
    const pageParam = parseInt(params.get("page") || "1", 10);

    latestState.query = q;
    latestState.filter = VALID_FILTERS.includes(typeParam) ? typeParam : "";
    latestState.page = !isNaN(pageParam) && pageParam > 0 ? pageParam : 1;

    if (search.input) {
      search.input.value = latestState.query;
      updateClearButtonVisibility();
    }

    setActiveFilter(latestState.filter);
  }

  function syncUrlState() {
    const params = new URLSearchParams();
    if (latestState.query.trim()) {
      params.set("q", latestState.query.trim());
    }
    if (latestState.filter) {
      params.set("types", latestState.filter);
    }
    if (latestState.page > 1) {
      params.set("page", String(latestState.page));
    }

    const query = params.toString();
    const nextUrl = query ? `/search.html?${query}` : "/search.html";
    if (window.history?.replaceState) {
      window.history.replaceState(null, "", nextUrl);
    }
  }

  function setActiveFilter(type) {
    latestState.filter = type;
    search.filterTabs.forEach((tab) => {
      const tabType = tab.getAttribute("data-type") || "";
      const isSelected = tabType === type;
      tab.classList.toggle("active", isSelected);
      tab.setAttribute("aria-selected", isSelected ? "true" : "false");
    });
  }

  function updateClearButtonVisibility() {
    if (!search.clearBtn) {
      return;
    }
    const hasValue = search.input && search.input.value.trim().length > 0;
    search.clearBtn.classList.toggle("hidden", !hasValue);
  }

  function handleSearchInput(e) {
    const rawVal = e.target.value;
    updateClearButtonVisibility();

    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }

    const trimmed = rawVal.trim();
    latestState.query = trimmed;
    latestState.page = 1;

    if (!trimmed) {
      abortActiveRequest();
      syncUrlState();
      renderIdleState();
      return;
    }

    debounceTimer = setTimeout(() => {
      syncUrlState();
      loadSearch({ reason: "input" });
    }, DEBOUNCE_MS);
  }

  function handleClearSearch() {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
    abortActiveRequest();
    latestState.query = "";
    latestState.page = 1;
    if (search.input) {
      search.input.value = "";
      search.input.focus();
    }
    updateClearButtonVisibility();
    syncUrlState();
    renderIdleState();
  }

  function handleGlobalKeydown(e) {
    // Escape closes mobile drawer or clears search
    if (e.key === "Escape") {
      if (sidebar?.classList.contains("drawer-open")) {
        closeMobileDrawer();
        return;
      }
      if (document.activeElement === search.input && search.input?.value) {
        handleClearSearch();
        return;
      }
      search.input?.blur();
      return;
    }

    // '/' or Ctrl+K / Cmd+K focuses search input
    const isCtrlK = (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k";
    const isSlash =
      e.key === "/" && !["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName);

    if (isCtrlK || isSlash) {
      e.preventDefault();
      search.input?.focus();
      search.input?.select();
    }
  }

  function handleInputKeydown(e) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      moveSelection(1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      moveSelection(-1);
    } else if (e.key === "Enter") {
      if (selectedResultIndex >= 0) {
        e.preventDefault();
        activateSelectedResult();
      }
    }
  }

  function moveSelection(direction) {
    const resultItems = search.resultsList?.querySelectorAll(".search-result-card");
    if (!resultItems || resultItems.length === 0) {
      return;
    }

    selectedResultIndex += direction;
    if (selectedResultIndex < 0) {
      selectedResultIndex = resultItems.length - 1;
    } else if (selectedResultIndex >= resultItems.length) {
      selectedResultIndex = 0;
    }

    resultItems.forEach((item, index) => {
      const isSelected = index === selectedResultIndex;
      item.classList.toggle("selected", isSelected);
      item.setAttribute("aria-selected", isSelected ? "true" : "false");
      if (isSelected) {
        item.scrollIntoView({ block: "nearest", behavior: "smooth" });
      }
    });
  }

  function activateSelectedResult() {
    const resultItems = search.resultsList?.querySelectorAll(".search-result-card");
    if (!resultItems || selectedResultIndex < 0 || selectedResultIndex >= resultItems.length) {
      return;
    }
    const targetLink = resultItems[selectedResultIndex].querySelector(".search-result-link");
    if (targetLink && targetLink.href) {
      targetLink.click();
    }
  }

  function buildRequestKey() {
    return `${latestState.query}:${latestState.filter}:${latestState.page}:${latestState.pageSize}`;
  }

  async function loadSearch({ _reason, force = false } = {}) {
    const trimmedQuery = latestState.query.trim();
    if (!trimmedQuery) {
      renderIdleState();
      return;
    }

    const requestKey = buildRequestKey();
    if (latestState.isLoading && activeRequestKey === requestKey && !force) {
      return;
    }

    abortActiveRequest();
    activeController = new AbortController();
    activeRequestKey = requestKey;
    latestState.isLoading = true;
    const requestId = ++requestSequence;
    selectedResultIndex = -1;

    setLoadingState();

    try {
      const result = await fetchSearchResults({
        q: trimmedQuery,
        resultTypes: latestState.filter,
        page: latestState.page,
        pageSize: latestState.pageSize,
        signal: activeController.signal,
      });

      if (requestId !== requestSequence) {
        return;
      }

      latestState.isLoading = false;
      latestState.total = result.total;
      latestState.page = result.page;
      latestState.pageSize = result.pageSize;
      latestState.totalPages = result.totalPages;
      latestState.count = result.count;
      latestState.isEmpty = result.isEmpty;
      latestState.hasLoaded = true;

      renderResults(result.results);
      renderPagination();
    } catch (error) {
      if (error.name === "AbortError") {
        return;
      }
      if (requestId !== requestSequence) {
        return;
      }
      latestState.isLoading = false;
      renderError(error);
    }
  }

  async function fetchSearchResults({ q, resultTypes, page, pageSize, signal }) {
    const params = new URLSearchParams({
      q: q,
      page: String(page),
      pageSize: String(pageSize),
    });
    if (resultTypes) {
      params.set("resultTypes", resultTypes);
    }

    const response = await fetch(`/api/search?${params.toString()}`, { signal });

    if (response.status === 401) {
      window.location.href = "/login.html";
      const error = new Error("Unauthorized");
      error.name = "UnauthorizedError";
      throw error;
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const message = errorData.error || `Search failed with status ${response.status}`;
      throw new Error(message);
    }

    const data = await response.json();
    return parseSearchResponse(data);
  }

  function parseSearchResponse(data) {
    if (!data || data.success !== true || !Array.isArray(data.results)) {
      throw new Error("Malformed API response: results array is required");
    }

    const total = parseNonNegativeNumber(data.total, "total");
    const page = parsePositiveNumber(data.page, "page");
    const pageSize = parsePositiveNumber(data.pageSize, "pageSize");
    const totalPages = parseNonNegativeNumber(data.totalPages, "totalPages");
    const count = parseNonNegativeNumber(data.count ?? data.results.length, "count");
    const isEmpty = Boolean(data.isEmpty ?? data.results.length === 0);

    const parsedResults = data.results.map(parseSearchResultItem);

    return {
      results: parsedResults,
      total,
      page,
      pageSize,
      totalPages,
      count,
      isEmpty,
    };
  }

  function parseSearchResultItem(item) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw new Error("Malformed API response: result item must be an object");
    }
    if (typeof item.resultType !== "string" || !VALID_FILTERS.includes(item.resultType)) {
      throw new Error(`Malformed API response: unsupported resultType '${item.resultType}'`);
    }
    if (typeof item.entityId !== "string" || !item.entityId.trim()) {
      throw new Error("Malformed API response: entityId is required");
    }
    if (!item.display || typeof item.display !== "object" || Array.isArray(item.display)) {
      throw new Error("Malformed API response: display object is required");
    }
    if (typeof item.display.title !== "string" || !item.display.title.trim()) {
      throw new Error("Malformed API response: display.title is required");
    }

    return {
      resultType: item.resultType,
      entityId: item.entityId.trim(),
      display: {
        title: item.display.title.trim(),
        subtitle: typeof item.display.subtitle === "string" ? item.display.subtitle.trim() : null,
        snippet: typeof item.display.snippet === "string" ? item.display.snippet.trim() : null,
      },
      relevance:
        item.relevance && typeof item.relevance === "object"
          ? {
              score: typeof item.relevance.score === "number" ? item.relevance.score : null,
              matchedFields: Array.isArray(item.relevance.matchedFields)
                ? item.relevance.matchedFields.filter((f) => typeof f === "string")
                : [],
            }
          : null,
    };
  }

  function parsePositiveNumber(value, field) {
    const num = Number(value);
    if (!Number.isInteger(num) || num < 1) {
      throw new Error(`Malformed API response: ${field} must be a positive integer`);
    }
    return num;
  }

  function parseNonNegativeNumber(value, field) {
    const num = Number(value);
    if (!Number.isInteger(num) || num < 0) {
      throw new Error(`Malformed API response: ${field} must be a non-negative integer`);
    }
    return num;
  }

  function renderIdleState() {
    search.skeletonContainer?.classList.add("hidden");
    search.errorContainer?.classList.add("hidden");
    search.emptyContainer?.classList.add("hidden");
    search.resultsList?.classList.add("hidden");
    search.pagination?.classList.add("hidden");
    search.countBadge?.classList.add("hidden");

    search.idleContainer?.classList.remove("hidden");
  }

  function setLoadingState() {
    search.idleContainer?.classList.add("hidden");
    search.errorContainer?.classList.add("hidden");
    search.emptyContainer?.classList.add("hidden");
    search.resultsList?.classList.add("hidden");
    search.pagination?.classList.add("hidden");

    search.skeletonContainer?.classList.remove("hidden");
    if (search.countBadge) {
      search.countBadge.textContent = "Searching...";
      search.countBadge.classList.remove("hidden");
    }
  }

  function renderResults(results) {
    search.skeletonContainer?.classList.add("hidden");
    search.errorContainer?.classList.add("hidden");
    search.idleContainer?.classList.add("hidden");

    if (results.length === 0) {
      search.resultsList?.classList.add("hidden");
      search.pagination?.classList.add("hidden");
      if (search.countBadge) {
        search.countBadge.textContent = "0 results";
        search.countBadge.classList.remove("hidden");
      }
      if (search.emptyMsg) {
        search.emptyMsg.textContent = `No workspace items matched "${latestState.query}".`;
      }
      search.emptyContainer?.classList.remove("hidden");
      return;
    }

    search.emptyContainer?.classList.add("hidden");

    if (search.countBadge) {
      const countLabel = `${latestState.total} ${latestState.total === 1 ? "result" : "results"}`;
      search.countBadge.textContent = countLabel;
      search.countBadge.classList.remove("hidden");
    }

    if (!search.resultsList) {
      return;
    }
    search.resultsList.innerHTML = "";

    const fragment = document.createDocumentFragment();
    results.forEach((item, index) => {
      fragment.appendChild(createResultCard(item, index));
    });

    search.resultsList.appendChild(fragment);
    search.resultsList.classList.remove("hidden");
  }

  function createResultCard(item, index) {
    const card = document.createElement("article");
    card.className = "search-result-card";
    card.setAttribute("role", "option");
    card.setAttribute("id", `search-result-${index}`);
    card.setAttribute("aria-selected", "false");

    const link = document.createElement("a");
    link.className = "search-result-link";
    link.href = resolveResultDestination(item);
    link.setAttribute("aria-label", `${item.resultType}: ${item.display.title}`);

    // Card Header Row (Type Badge + Score)
    const headerRow = document.createElement("div");
    headerRow.className = "search-result-header";

    const badge = document.createElement("span");
    badge.className = `search-type-badge badge-${item.resultType.toLowerCase()}`;
    badge.textContent = item.resultType;
    headerRow.appendChild(badge);

    if (item.relevance && typeof item.relevance.score === "number") {
      const scoreBadge = document.createElement("span");
      scoreBadge.className = "search-score-badge";
      scoreBadge.textContent = `${Math.round(item.relevance.score * 100)}% match`;
      headerRow.appendChild(scoreBadge);
    }

    link.appendChild(headerRow);

    // Title & Subtitle
    const title = document.createElement("h2");
    title.className = "search-result-title font-display";
    title.textContent = item.display.title;
    link.appendChild(title);

    if (item.display.subtitle) {
      const subtitle = document.createElement("p");
      subtitle.className = "search-result-subtitle";
      subtitle.textContent = item.display.subtitle;
      link.appendChild(subtitle);
    }

    // Snippet
    if (item.display.snippet) {
      const snippet = document.createElement("p");
      snippet.className = "search-result-snippet";
      snippet.textContent = item.display.snippet;
      link.appendChild(snippet);
    }

    // Matched Fields Footer
    if (item.relevance && item.relevance.matchedFields.length > 0) {
      const footer = document.createElement("div");
      footer.className = "search-result-footer";

      const matchedLabel = document.createElement("span");
      matchedLabel.className = "search-matched-label";
      matchedLabel.textContent = "Matched in:";
      footer.appendChild(matchedLabel);

      item.relevance.matchedFields.forEach((field) => {
        const tag = document.createElement("span");
        tag.className = "search-matched-tag";
        tag.textContent = field;
        footer.appendChild(tag);
      });

      link.appendChild(footer);
    }

    card.appendChild(link);
    return card;
  }

  function resolveResultDestination(item) {
    if (item.resultType === "CLIENT") {
      return `/clients/${encodeURIComponent(item.entityId)}`;
    }
    if (item.resultType === "TIMELINE") {
      return `/clients/${encodeURIComponent(item.entityId)}`;
    }
    if (item.resultType === "JOB") {
      return "/dashboard.html";
    }
    if (item.resultType === "MATCH") {
      return "/dashboard.html";
    }
    return "/dashboard.html";
  }

  function renderPagination() {
    if (!search.pagination) {
      return;
    }

    if (latestState.total <= latestState.pageSize) {
      search.pagination.classList.add("hidden");
      return;
    }

    const totalPages = Math.max(1, latestState.totalPages);
    if (search.prevBtn) {
      search.prevBtn.disabled = latestState.page <= 1 || latestState.isLoading;
    }
    if (search.nextBtn) {
      search.nextBtn.disabled = latestState.page >= totalPages || latestState.isLoading;
    }
    if (search.pageSummary) {
      search.pageSummary.textContent = `Page ${latestState.page} of ${totalPages}`;
    }

    search.pagination.classList.remove("hidden");
  }

  function renderError(error) {
    search.skeletonContainer?.classList.add("hidden");
    search.idleContainer?.classList.add("hidden");
    search.resultsList?.classList.add("hidden");
    search.emptyContainer?.classList.add("hidden");
    search.pagination?.classList.add("hidden");

    if (search.countBadge) {
      search.countBadge.textContent = "Error";
      search.countBadge.classList.remove("hidden");
    }

    if (search.errorMsg) {
      search.errorMsg.textContent = error.message || "An error occurred while performing search.";
    }

    search.errorContainer?.classList.remove("hidden");
  }

  function abortActiveRequest() {
    if (activeController) {
      activeController.abort();
      activeController = null;
    }
  }
});
