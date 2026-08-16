document.addEventListener("DOMContentLoaded", () => {
  const sidebar = document.getElementById("sidebar");
  const sidebarToggle = document.getElementById("sidebar-toggle");
  const mobileToggle = document.getElementById("mobile-drawer-toggle");
  const drawerOverlay = document.getElementById("drawer-overlay");
  const sidebarLogoutBtn = document.getElementById("sidebar-logout-btn");
  const userAvatarInitials = document.getElementById("user-avatar-initials");

  const detail = {
    skeleton: document.getElementById("client-detail-skeleton"),
    panel: document.getElementById("client-detail-panel"),
    notFound: document.getElementById("client-detail-not-found"),
    notFoundMsg: document.getElementById("client-detail-not-found-msg"),
    error: document.getElementById("client-detail-error"),
    errorMsg: document.getElementById("client-detail-error-msg"),
    retryBtn: document.getElementById("client-detail-error-retry"),
    refreshBtn: document.getElementById("client-detail-refresh-btn"),
    refreshIcon: document.getElementById("client-detail-refresh-icon"),
    title: document.getElementById("client-detail-title"),
    subtitle: document.getElementById("client-detail-subtitle"),
    breadcrumb: document.getElementById("client-detail-breadcrumb"),
    avatar: document.getElementById("client-detail-avatar"),
    name: document.getElementById("client-detail-name"),
    contact: document.getElementById("client-detail-contact"),
    status: document.getElementById("client-detail-status"),
    email: document.getElementById("client-detail-email"),
    website: document.getElementById("client-detail-website"),
    phone: document.getElementById("client-detail-phone"),
    created: document.getElementById("client-detail-created"),
    updated: document.getElementById("client-detail-updated"),
  };

  const timeline = {
    skeleton: document.getElementById("client-timeline-skeleton"),
    list: document.getElementById("client-timeline-list"),
    empty: document.getElementById("client-timeline-empty"),
    error: document.getElementById("client-timeline-error"),
    errorMsg: document.getElementById("client-timeline-error-msg"),
    retryBtn: document.getElementById("client-timeline-retry"),
    count: document.getElementById("client-timeline-count"),
    prevBtn: document.getElementById("client-timeline-prev"),
    nextBtn: document.getElementById("client-timeline-next"),
    pageSummary: document.getElementById("client-timeline-page-summary"),
  };

  const CLIENT_STATUSES = ["Lead", "Active", "Suspended", "Archived", "Closed"];
  const CLIENT_ID_PATTERN = /^[a-zA-Z0-9-]{1,128}$/;
  const TIMELINE_PAGE_SIZE = 20;

  let isSidebarCollapsed = localStorage.getItem("sidebar-collapsed") === "true";
  let activeController = null;
  let activeRequestKey = "";
  let requestSequence = 0;
  let activeTimelineController = null;
  let activeTimelineRequestKey = "";
  let timelineRequestSequence = 0;
  const latestState = {
    clientId: resolveClientId(),
    hasLoaded: false,
    isLoading: false,
  };
  let timelineState = {
    page: 1,
    pageSize: TIMELINE_PAGE_SIZE,
    total: 0,
    hasLoaded: false,
    isLoading: false,
  };

  if (isSidebarCollapsed) {
    sidebar.classList.add("collapsed");
    sidebarToggle.setAttribute("aria-label", "Expand sidebar");
  }

  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (prefersReducedMotion) {
    document.body.classList.add("reduced-motion");
  }

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

  drawerOverlay.addEventListener("click", closeMobileDrawer);

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && sidebar.classList.contains("drawer-open")) {
      closeMobileDrawer();
    }
  });

  window.addEventListener("pagehide", abortAllRequests);

  sidebarLogoutBtn.addEventListener("click", async () => {
    try {
      const result = await window.authActions.logout();
      if (result.success) {
        window.location.href = "/login.html";
      }
    } catch {
      window.location.href = "/login.html";
    }
  });

  detail.retryBtn.addEventListener("click", () => loadClient({ reason: "retry", force: true }));
  detail.refreshBtn.addEventListener("click", () =>
    loadClient({ reason: "refresh", force: false }),
  );
  detail.refreshIcon.addEventListener("click", () =>
    loadClient({ reason: "refresh", force: false }),
  );
  timeline.retryBtn.addEventListener("click", () =>
    loadTimeline({ reason: "retry", page: timelineState.page, force: false }),
  );
  timeline.prevBtn.addEventListener("click", () => {
    if (timelineState.page > 1) {
      loadTimeline({ reason: "page", page: timelineState.page - 1, force: true });
    }
  });
  timeline.nextBtn.addEventListener("click", () => {
    if (timelineState.page * timelineState.pageSize < timelineState.total) {
      loadTimeline({ reason: "page", page: timelineState.page + 1, force: true });
    }
  });

  checkAuth();

  function closeMobileDrawer() {
    sidebar.classList.remove("drawer-open");
    drawerOverlay.classList.remove("visible");
    drawerOverlay.setAttribute("aria-hidden", "true");
  }

  async function checkAuth() {
    try {
      const response = await fetch("/api/session");
      const data = await response.json();
      if (response.ok && data.success && data.user) {
        const email = data.user.email || "";
        userAvatarInitials.textContent = email.charAt(0).toUpperCase() || "U";
        if (!isValidClientId(latestState.clientId)) {
          renderNotFound("This client could not be found for your workspace.");
          return;
        }
        loadClient({ reason: "initial", force: true });
        return;
      }
      window.location.href = "/login.html";
    } catch {
      window.location.href = "/login.html";
    }
  }

  function resolveClientId() {
    const params = new URLSearchParams(window.location.search || "");
    const queryId = params.get("id");
    if (queryId) {
      return queryId.trim();
    }
    const match = (window.location.pathname || "").match(/^\/clients\/([^/]+)$/);
    return match ? decodeURIComponent(match[1]).trim() : "";
  }

  function isValidClientId(clientId) {
    return typeof clientId === "string" && CLIENT_ID_PATTERN.test(clientId);
  }

  async function loadClient({ reason, force = true } = {}) {
    if (!isValidClientId(latestState.clientId)) {
      renderNotFound("This client could not be found for your workspace.");
      return;
    }

    const requestKey = latestState.clientId;
    if (latestState.isLoading && activeRequestKey === requestKey && !force) {
      return;
    }

    abortActiveRequest();
    activeController = new AbortController();
    activeRequestKey = requestKey;
    latestState.isLoading = true;
    const requestId = ++requestSequence;

    setLoadingState(reason);

    try {
      const client = await getClient({
        id: latestState.clientId,
        signal: activeController.signal,
      });

      if (requestId !== requestSequence) {
        return;
      }

      latestState.isLoading = false;
      latestState.hasLoaded = true;
      renderClient(client);
      loadTimeline({ reason: "client-loaded", page: 1, force: false });
    } catch (error) {
      if (error.name === "AbortError") {
        return;
      }
      if (requestId !== requestSequence) {
        return;
      }
      latestState.isLoading = false;
      if (error.name === "NotFoundError") {
        renderNotFound("This client could not be found for your workspace.");
        return;
      }
      renderError(error);
    }
  }

  async function getClient({ id, signal }) {
    const response = await fetch(`/api/clients/${encodeURIComponent(id)}`, { signal });

    if (response.status === 401) {
      window.location.href = "/login.html";
      const error = new Error("Unauthorized");
      error.name = "UnauthorizedError";
      throw error;
    }

    if (response.status === 403) {
      throw new Error("You do not have access to this client.");
    }

    if (response.status === 404) {
      const error = new Error("Client not found");
      error.name = "NotFoundError";
      throw error;
    }

    if (!response.ok) {
      throw new Error(`Client detail request failed with status ${response.status}`);
    }

    const data = await response.json();
    return parseClientResponse(data);
  }

  function parseClientResponse(data) {
    if (!data || data.success !== true || !data.client) {
      throw new Error("Malformed API response: client object is required");
    }
    return parseClient(data.client);
  }

  function parseClient(client) {
    if (!client || typeof client !== "object" || Array.isArray(client)) {
      throw new Error("Malformed API response: client item must be an object");
    }
    if (typeof client.id !== "string" || client.id.trim() === "") {
      throw new Error("Malformed API response: client id is required");
    }
    if (typeof client.name !== "string" || client.name.trim() === "") {
      throw new Error("Malformed API response: client name is required");
    }
    if (typeof client.status !== "string" || client.status.trim() === "") {
      throw new Error("Malformed API response: client status is required");
    }

    return {
      id: client.id,
      name: client.name.trim(),
      email: parseOptionalString(client.email),
      phone: parseOptionalString(client.phone),
      website: parseSafeUrl(client.website),
      status: client.status.trim(),
      createdAt: parseOptionalString(client.createdAt),
      updatedAt: parseOptionalString(client.updatedAt),
    };
  }

  function parseOptionalString(value) {
    return typeof value === "string" && value.trim() ? value.trim() : null;
  }

  function parseSafeUrl(value) {
    const url = parseOptionalString(value);
    if (!url) {
      return null;
    }
    try {
      const parsed = new URL(url);
      if (!["http:", "https:"].includes(parsed.protocol)) {
        return null;
      }
      return parsed.href;
    } catch {
      return null;
    }
  }

  function setLoadingState(reason) {
    detail.error.classList.add("hidden");
    detail.notFound.classList.add("hidden");

    if (!latestState.hasLoaded || reason === "retry") {
      detail.skeleton.classList.remove("hidden");
      detail.panel.classList.add("hidden");
    }

    detail.refreshBtn.disabled = true;
    detail.refreshIcon.disabled = true;
  }

  function renderClient(client) {
    detail.skeleton.classList.add("hidden");
    detail.error.classList.add("hidden");
    detail.notFound.classList.add("hidden");
    detail.refreshBtn.disabled = false;
    detail.refreshIcon.disabled = false;

    detail.title.textContent = client.name;
    detail.subtitle.textContent = "Client relationship details from the API.";
    detail.breadcrumb.textContent = client.name;
    detail.avatar.textContent = client.name.charAt(0).toUpperCase();
    detail.name.textContent = client.name;
    detail.contact.textContent = client.email || "Contact email not provided";
    renderStatus(client.status);
    renderEmail(client.email);
    renderWebsite(client.website);
    detail.phone.textContent = client.phone || "Not provided";
    detail.created.textContent = formatDate(client.createdAt);
    detail.updated.textContent = formatDate(client.updatedAt);
    document.title = `${client.name} - FreelanceOS`;
    detail.panel.classList.remove("hidden");
  }

  async function loadTimeline({ reason, page = timelineState.page, force = true } = {}) {
    if (!isValidClientId(latestState.clientId)) {
      renderTimelineError(new Error("Client timeline is unavailable."));
      return;
    }

    const requestPage = Math.max(1, page);
    const requestKey = `${latestState.clientId}:${requestPage}:${timelineState.pageSize}`;
    if (timelineState.isLoading && activeTimelineRequestKey === requestKey) {
      return;
    }
    if (timelineState.isLoading && activeTimelineRequestKey !== requestKey && !force) {
      return;
    }

    abortTimelineRequest();
    activeTimelineController = new AbortController();
    activeTimelineRequestKey = requestKey;
    timelineState.isLoading = true;
    const requestId = ++timelineRequestSequence;

    setTimelineLoadingState(reason);

    try {
      const result = await getTimeline({
        id: latestState.clientId,
        page: requestPage,
        pageSize: timelineState.pageSize,
        signal: activeTimelineController.signal,
      });

      if (requestId !== timelineRequestSequence) {
        return;
      }

      timelineState = {
        ...timelineState,
        page: result.page,
        pageSize: result.pageSize,
        total: result.total,
        hasLoaded: true,
        isLoading: false,
      };
      renderTimeline(result);
    } catch (error) {
      if (error.name === "AbortError") {
        return;
      }
      if (requestId !== timelineRequestSequence) {
        return;
      }
      timelineState.isLoading = false;
      if (error.name === "UnauthorizedError") {
        return;
      }
      renderTimelineError(error);
    }
  }

  async function getTimeline({ id, page, pageSize, signal }) {
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
    });
    const response = await fetch(`/api/clients/${encodeURIComponent(id)}/timeline?${params}`, {
      signal,
    });

    if (response.status === 401) {
      window.location.href = "/login.html";
      const error = new Error("Unauthorized");
      error.name = "UnauthorizedError";
      throw error;
    }

    if (response.status === 403) {
      throw new Error("You do not have access to this timeline.");
    }

    if (response.status === 404) {
      throw new Error("Timeline could not be found for this client.");
    }

    if (!response.ok) {
      throw new Error(`Client timeline request failed with status ${response.status}`);
    }

    const data = await response.json();
    return parseTimelineResponse(data);
  }

  function parseTimelineResponse(data) {
    if (!data || data.success !== true || !data.timeline) {
      throw new Error("Malformed API response: timeline object is required");
    }
    const source = data.timeline;
    if (!Array.isArray(source.entries)) {
      throw new Error("Malformed API response: timeline entries are required");
    }
    if (!Number.isInteger(source.total) || source.total < 0) {
      throw new Error("Malformed API response: timeline total is required");
    }
    if (!Number.isInteger(source.page) || source.page < 1) {
      throw new Error("Malformed API response: timeline page is required");
    }
    if (!Number.isInteger(source.pageSize) || source.pageSize < 1 || source.pageSize > 100) {
      throw new Error("Malformed API response: timeline pageSize is required");
    }

    return {
      id: parseOptionalString(source.id),
      clientId: parseOptionalString(source.clientId),
      status: parseOptionalString(source.status) || "Initialized",
      entries: source.entries.map(parseTimelineEntry),
      total: source.total,
      page: source.page,
      pageSize: source.pageSize,
    };
  }

  function parseTimelineEntry(entry) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      throw new Error("Malformed API response: timeline entry must be an object");
    }
    if (typeof entry.id !== "string" || entry.id.trim() === "") {
      throw new Error("Malformed API response: timeline entry id is required");
    }
    if (typeof entry.category !== "string" || entry.category.trim() === "") {
      throw new Error("Malformed API response: timeline entry category is required");
    }
    if (typeof entry.timestamp !== "string" || Number.isNaN(new Date(entry.timestamp).getTime())) {
      throw new Error("Malformed API response: timeline entry timestamp is required");
    }

    return {
      id: entry.id.trim(),
      eventRef: parseOptionalString(entry.eventRef),
      category: entry.category.trim(),
      timestamp: entry.timestamp,
      message: parseOptionalString(entry.message),
      visibility: parseOptionalString(entry.visibility),
    };
  }

  function setTimelineLoadingState() {
    timeline.error.classList.add("hidden");
    timeline.empty.classList.add("hidden");
    timeline.list.classList.add("hidden");
    timeline.skeleton.classList.remove("hidden");
    timeline.retryBtn.disabled = true;
    timeline.prevBtn.disabled = true;
    timeline.nextBtn.disabled = true;
  }

  function renderTimeline(result) {
    timeline.skeleton.classList.add("hidden");
    timeline.error.classList.add("hidden");
    timeline.retryBtn.disabled = false;
    timeline.list.innerHTML = "";

    timeline.count.textContent = `${result.total} ${result.total === 1 ? "event" : "events"}`;
    updateTimelinePagination(result);

    if (result.entries.length === 0) {
      timeline.list.classList.add("hidden");
      timeline.empty.classList.remove("hidden");
      return;
    }

    const fragment = document.createDocumentFragment();
    result.entries.forEach((entry) => {
      fragment.appendChild(createTimelineEntryNode(entry));
    });
    timeline.list.appendChild(fragment);
    timeline.empty.classList.add("hidden");
    timeline.list.classList.remove("hidden");
  }

  function createTimelineEntryNode(entry) {
    const item = document.createElement("article");
    item.className = "timeline-item client-timeline-item";
    item.setAttribute("role", "listitem");
    item.setAttribute("aria-label", `${entry.category} on ${formatDateTime(entry.timestamp)}`);

    const dot = document.createElement("div");
    dot.className = "timeline-dot";
    dot.setAttribute("aria-hidden", "true");

    const content = document.createElement("div");
    content.className = "timeline-content";

    const title = document.createElement("p");
    title.className = "timeline-text";
    title.textContent = entry.message || entry.category;

    const meta = document.createElement("span");
    meta.className = "timeline-time";
    meta.textContent = `${entry.category} - ${formatDateTime(entry.timestamp)}`;

    content.appendChild(title);
    content.appendChild(meta);
    item.appendChild(dot);
    item.appendChild(content);
    return item;
  }

  function updateTimelinePagination(result) {
    const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize));
    timeline.pageSummary.textContent = `Page ${result.page} of ${totalPages}`;
    timeline.prevBtn.disabled = result.page <= 1;
    timeline.nextBtn.disabled = result.page >= totalPages;
  }

  function renderTimelineError(error) {
    timeline.skeleton.classList.add("hidden");
    timeline.list.classList.add("hidden");
    timeline.empty.classList.add("hidden");
    timeline.errorMsg.textContent = error.message || "Failed to retrieve client timeline.";
    timeline.error.classList.remove("hidden");
    timeline.retryBtn.disabled = false;
    timeline.prevBtn.disabled = true;
    timeline.nextBtn.disabled = true;
  }

  function renderEmail(email) {
    detail.email.innerHTML = "";
    if (!email) {
      detail.email.textContent = "Not provided";
      return;
    }
    const link = document.createElement("a");
    link.href = `mailto:${email}`;
    link.textContent = email;
    link.className = "client-detail-value-link";
    detail.email.appendChild(link);
  }

  function renderWebsite(website) {
    detail.website.innerHTML = "";
    if (!website) {
      detail.website.textContent = "Not provided";
      return;
    }
    const link = document.createElement("a");
    link.href = website;
    link.textContent = website;
    link.className = "client-detail-value-link";
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    detail.website.appendChild(link);
  }

  function renderStatus(statusValue) {
    detail.status.className = "client-status";
    detail.status.classList.add(getStatusClass(statusValue));
    detail.status.textContent = statusValue;
  }

  function getStatusClass(status) {
    if (!CLIENT_STATUSES.includes(status)) {
      return "status-unknown";
    }
    return `status-${status.toLowerCase()}`;
  }

  function renderNotFound(message) {
    abortActiveRequest();
    abortTimelineRequest();
    latestState.isLoading = false;
    detail.skeleton.classList.add("hidden");
    detail.panel.classList.add("hidden");
    detail.error.classList.add("hidden");
    detail.notFoundMsg.textContent = message;
    detail.notFound.classList.remove("hidden");
    detail.refreshBtn.disabled = true;
    detail.refreshIcon.disabled = true;
  }

  function renderError(error) {
    detail.skeleton.classList.add("hidden");
    detail.panel.classList.add("hidden");
    detail.notFound.classList.add("hidden");
    detail.refreshBtn.disabled = false;
    detail.refreshIcon.disabled = false;
    detail.errorMsg.textContent = error.message || "Client data could not be retrieved.";
    detail.error.classList.remove("hidden");
  }

  function formatDate(dateValue) {
    if (!dateValue) {
      return "Unavailable";
    }
    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) {
      return "Unavailable";
    }
    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  function formatDateTime(dateValue) {
    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) {
      return "Unavailable";
    }
    return date.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  function abortActiveRequest() {
    if (activeController) {
      activeController.abort();
      activeController = null;
    }
  }

  function abortTimelineRequest() {
    if (activeTimelineController) {
      activeTimelineController.abort();
      activeTimelineController = null;
    }
  }

  function abortAllRequests() {
    abortActiveRequest();
    abortTimelineRequest();
  }
});
