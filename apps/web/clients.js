document.addEventListener("DOMContentLoaded", () => {
  const sidebar = document.getElementById("sidebar");
  const sidebarToggle = document.getElementById("sidebar-toggle");
  const mobileToggle = document.getElementById("mobile-drawer-toggle");
  const drawerOverlay = document.getElementById("drawer-overlay");
  const sidebarLogoutBtn = document.getElementById("sidebar-logout-btn");
  const userAvatarInitials = document.getElementById("user-avatar-initials");

  const clients = {
    skeleton: document.getElementById("clients-skeleton"),
    list: document.getElementById("clients-list"),
    empty: document.getElementById("clients-empty"),
    error: document.getElementById("clients-error"),
    errorMsg: document.getElementById("clients-error-msg"),
    retryBtn: document.getElementById("clients-error-retry"),
    refreshBtn: document.getElementById("clients-refresh-btn"),
    refreshIcon: document.getElementById("clients-refresh-icon"),
    count: document.getElementById("clients-count"),
    statusFilter: document.getElementById("client-status-filter"),
    prevBtn: document.getElementById("clients-prev-page"),
    nextBtn: document.getElementById("clients-next-page"),
    pageSummary: document.getElementById("clients-page-summary"),
  };

  const CLIENT_STATUSES = ["Lead", "Active", "Suspended", "Archived", "Closed"];
  const PAGE_SIZE = 20;

  let isSidebarCollapsed = localStorage.getItem("sidebar-collapsed") === "true";
  let activeController = null;
  let requestSequence = 0;
  let activeRequestKey = "";
  const latestState = {
    page: 1,
    pageSize: PAGE_SIZE,
    total: 0,
    status: "",
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

  window.addEventListener("pagehide", abortActiveRequest);

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

  clients.statusFilter.addEventListener("change", () => {
    latestState.status = clients.statusFilter.value;
    latestState.page = 1;
    syncUrlState();
    loadClients({ reason: "filter" });
  });

  clients.prevBtn.addEventListener("click", () => {
    if (latestState.page <= 1) {
      return;
    }
    latestState.page -= 1;
    syncUrlState();
    loadClients({ reason: "pagination" });
  });

  clients.nextBtn.addEventListener("click", () => {
    if (!hasNextPage()) {
      return;
    }
    latestState.page += 1;
    syncUrlState();
    loadClients({ reason: "pagination" });
  });

  clients.retryBtn.addEventListener("click", () => loadClients({ reason: "retry", force: true }));
  clients.refreshBtn.addEventListener("click", () =>
    loadClients({ reason: "refresh", force: false }),
  );
  clients.refreshIcon.addEventListener("click", () =>
    loadClients({ reason: "refresh", force: false }),
  );

  initializeFromUrl();
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
        loadClients({ reason: "initial", force: true });
        return;
      }
      window.location.href = "/login.html";
    } catch {
      window.location.href = "/login.html";
    }
  }

  function initializeFromUrl() {
    const params = new URLSearchParams(window.location.search || "");
    const page = Number(params.get("page") || "1");
    const status = params.get("status") || "";

    latestState.page = Number.isInteger(page) && page > 0 ? page : 1;
    latestState.status = CLIENT_STATUSES.includes(status) ? status : "";
    clients.statusFilter.value = latestState.status;
    syncUrlState();
  }

  function syncUrlState() {
    const params = new URLSearchParams();
    if (latestState.page > 1) {
      params.set("page", String(latestState.page));
    }
    if (latestState.status) {
      params.set("status", latestState.status);
    }
    const query = params.toString();
    const nextUrl = query ? `/clients.html?${query}` : "/clients.html";
    if (window.history?.replaceState) {
      window.history.replaceState(null, "", nextUrl);
    }
  }

  function buildRequestKey() {
    return `${latestState.page}:${latestState.pageSize}:${latestState.status}`;
  }

  async function loadClients({ reason, force = true } = {}) {
    const requestKey = buildRequestKey();
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
      const result = await getClients({
        page: latestState.page,
        pageSize: latestState.pageSize,
        status: latestState.status,
        signal: activeController.signal,
      });

      if (requestId !== requestSequence) {
        return;
      }

      latestState.isLoading = false;
      latestState.total = result.total;
      latestState.page = result.page;
      latestState.pageSize = result.pageSize;
      latestState.hasLoaded = true;
      renderClients(result.clients);
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

  async function getClients({ page, pageSize, status, signal }) {
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
    });
    if (status) {
      params.set("status", status);
    }

    const response = await fetch(`/api/clients?${params.toString()}`, { signal });

    if (response.status === 401) {
      window.location.href = "/login.html";
      const error = new Error("Unauthorized");
      error.name = "UnauthorizedError";
      throw error;
    }

    if (response.status === 403) {
      throw new Error("You do not have access to the client list.");
    }

    if (!response.ok) {
      throw new Error(`Client list request failed with status ${response.status}`);
    }

    const data = await response.json();
    return parseClientsResponse(data);
  }

  function parseClientsResponse(data) {
    if (!data || data.success !== true || !Array.isArray(data.clients)) {
      throw new Error("Malformed API response: clients array is required");
    }

    const total = parseNonNegativeNumber(data.total, "total");
    const page = parsePositiveNumber(data.page, "page");
    const pageSize = parsePositiveNumber(data.pageSize, "pageSize");
    const parsedClients = data.clients.map(parseClient);

    return {
      clients: parsedClients,
      total,
      page,
      pageSize,
    };
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
      name: client.name,
      email: typeof client.email === "string" && client.email.trim() ? client.email : null,
      status: client.status,
      website: typeof client.website === "string" && client.website.trim() ? client.website : null,
      updatedAt:
        typeof client.updatedAt === "string" && client.updatedAt.trim() ? client.updatedAt : null,
      createdAt:
        typeof client.createdAt === "string" && client.createdAt.trim() ? client.createdAt : null,
    };
  }

  function parsePositiveNumber(value, field) {
    if (!Number.isInteger(value) || value < 1) {
      throw new Error(`Malformed API response: ${field} must be a positive integer`);
    }
    return value;
  }

  function parseNonNegativeNumber(value, field) {
    if (!Number.isInteger(value) || value < 0) {
      throw new Error(`Malformed API response: ${field} must be a non-negative integer`);
    }
    return value;
  }

  function setLoadingState(reason) {
    clients.error.classList.add("hidden");
    clients.empty.classList.add("hidden");

    if (!latestState.hasLoaded || reason === "pagination" || reason === "filter") {
      clients.skeleton.classList.remove("hidden");
      clients.list.classList.add("hidden");
    }

    clients.refreshBtn.disabled = true;
    clients.refreshIcon.disabled = true;
  }

  function renderClients(items) {
    clients.skeleton.classList.add("hidden");
    clients.error.classList.add("hidden");
    clients.refreshBtn.disabled = false;
    clients.refreshIcon.disabled = false;
    clients.list.innerHTML = "";

    clients.count.textContent = `${latestState.total} ${latestState.total === 1 ? "client" : "clients"}`;

    if (items.length === 0) {
      clients.list.classList.add("hidden");
      clients.empty.classList.remove("hidden");
      return;
    }

    const fragment = document.createDocumentFragment();
    items.forEach((client) => fragment.appendChild(createClientRow(client)));
    clients.list.appendChild(fragment);
    clients.list.classList.remove("hidden");
    clients.empty.classList.add("hidden");
  }

  function createClientRow(client) {
    const item = document.createElement("article");
    item.className = "client-list-row";
    item.setAttribute("role", "listitem");

    const link = document.createElement("a");
    link.className = "client-row-link";
    link.href = `/clients/${encodeURIComponent(client.id)}`;
    link.setAttribute("aria-label", `Open client ${client.name}`);

    const identity = document.createElement("div");
    identity.className = "client-identity";

    const avatar = document.createElement("div");
    avatar.className = "client-avatar";
    avatar.setAttribute("aria-hidden", "true");
    avatar.textContent = client.name.trim().charAt(0).toUpperCase();

    const copy = document.createElement("div");
    copy.className = "client-copy";

    const name = document.createElement("h2");
    name.className = "client-name font-display";
    name.textContent = client.name;

    const email = document.createElement("p");
    email.className = "client-email";
    email.textContent = client.email || "No contact email";

    copy.appendChild(name);
    copy.appendChild(email);
    identity.appendChild(avatar);
    identity.appendChild(copy);

    const meta = document.createElement("div");
    meta.className = "client-meta";

    const status = document.createElement("span");
    status.classList.add("client-status");
    status.classList.add(getStatusClass(client.status));
    status.textContent = client.status;

    const updated = document.createElement("span");
    updated.className = "client-updated";
    updated.textContent = formatUpdatedAt(client.updatedAt || client.createdAt);

    meta.appendChild(status);
    meta.appendChild(updated);
    link.appendChild(identity);
    link.appendChild(meta);
    item.appendChild(link);
    return item;
  }

  function getStatusClass(status) {
    if (!CLIENT_STATUSES.includes(status)) {
      return "status-unknown";
    }
    return `status-${status.toLowerCase()}`;
  }

  function formatUpdatedAt(dateValue) {
    if (!dateValue) {
      return "Updated date unavailable";
    }
    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) {
      return "Updated date unavailable";
    }
    return `Updated ${date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    })}`;
  }

  function renderPagination() {
    const totalPages = Math.max(1, Math.ceil(latestState.total / latestState.pageSize));
    clients.prevBtn.disabled = latestState.page <= 1 || latestState.isLoading;
    clients.nextBtn.disabled = !hasNextPage() || latestState.isLoading;
    clients.pageSummary.textContent = `Page ${latestState.page} of ${totalPages}`;
  }

  function hasNextPage() {
    return latestState.page * latestState.pageSize < latestState.total;
  }

  function renderError(error) {
    clients.skeleton.classList.add("hidden");
    clients.empty.classList.add("hidden");
    clients.list.classList.add("hidden");
    clients.refreshBtn.disabled = false;
    clients.refreshIcon.disabled = false;
    clients.count.textContent = "0 clients";
    clients.errorMsg.textContent = error.message || "Client data could not be retrieved.";
    clients.error.classList.remove("hidden");
    renderPagination();
  }

  function abortActiveRequest() {
    if (activeController) {
      activeController.abort();
      activeController = null;
    }
  }
});
