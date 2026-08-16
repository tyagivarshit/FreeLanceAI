import test from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientsJsContent = fs.readFileSync(path.join(__dirname, "clients.js"), "utf8");

function createMockElement(id, tag = "div", classes = []) {
  const listeners = {};
  const element = {
    id,
    tagName: tag.toUpperCase(),
    className: classes.join(" "),
    disabled: false,
    value: "",
    href: "",
    textContent: "",
    children: [],
    style: {},
    attributes: {},
    classList: {
      classes,
      add(c) {
        if (!this.classes.includes(c)) {
          this.classes.push(c);
        }
        element.className = this.classes.join(" ");
      },
      remove(c) {
        this.classes = this.classes.filter((item) => item !== c);
        element.className = this.classes.join(" ");
      },
      toggle(c, force) {
        const shouldHave = force === undefined ? !this.contains(c) : force;
        if (shouldHave) {
          this.add(c);
        } else {
          this.remove(c);
        }
      },
      contains(c) {
        return this.classes.includes(c);
      },
    },
    _innerHTML: "",
    get innerHTML() {
      return this._innerHTML;
    },
    set innerHTML(value) {
      this._innerHTML = value;
      if (value === "") {
        this.children = [];
      }
    },
    setAttribute(name, value) {
      this.attributes[name] = String(value);
    },
    getAttribute(name) {
      return this.attributes[name];
    },
    addEventListener(event, callback) {
      listeners[event] = listeners[event] || [];
      listeners[event].push(callback);
    },
    trigger(event, data = {}) {
      (listeners[event] || []).forEach((callback) => callback(data));
    },
    click() {
      this.trigger("click", { preventDefault: () => {} });
    },
    appendChild(child) {
      if (child && Array.isArray(child.children) && !child.tagName) {
        child.children.forEach((fragmentChild) => this.children.push(fragmentChild));
        return child;
      }
      this.children.push(child);
      return child;
    },
  };
  return element;
}

function createMockEnvironment(fetchMock, { search = "" } = {}) {
  const ids = [
    "sidebar",
    "sidebar-toggle",
    "mobile-drawer-toggle",
    "drawer-overlay",
    "sidebar-logout-btn",
    "user-avatar-initials",
    "clients-skeleton",
    "clients-list",
    "clients-empty",
    "clients-error",
    "clients-error-msg",
    "clients-error-retry",
    "clients-refresh-btn",
    "clients-refresh-icon",
    "clients-count",
    "client-status-filter",
    "clients-prev-page",
    "clients-next-page",
    "clients-page-summary",
  ];

  const elements = {};
  ids.forEach((id) => {
    elements[id] = createMockElement(id);
  });

  elements["clients-list"].classList.add("hidden");
  elements["clients-empty"].classList.add("hidden");
  elements["clients-error"].classList.add("hidden");

  const documentListeners = {};
  const createdElements = [];
  const bodyClasses = [];
  const documentMock = {
    body: {
      classList: {
        add: (value) => bodyClasses.push(value),
      },
    },
    addEventListener(event, callback) {
      documentListeners[event] = documentListeners[event] || [];
      documentListeners[event].push(callback);
    },
    trigger(event) {
      (documentListeners[event] || []).forEach((callback) => callback());
    },
    getElementById(id) {
      return elements[id] || createdElements.find((item) => item.id === id) || null;
    },
    createElement(tag) {
      const element = createMockElement(`created-${createdElements.length}`, tag);
      createdElements.push(element);
      return element;
    },
    createDocumentFragment() {
      return {
        children: [],
        appendChild(child) {
          this.children.push(child);
          return child;
        },
      };
    },
  };

  const windowListeners = {};
  const historyCalls = [];
  const windowMock = {
    location: { href: "", search },
    history: {
      replaceState(_state, _title, url) {
        historyCalls.push(url);
        const queryIndex = url.indexOf("?");
        windowMock.location.search = queryIndex === -1 ? "" : url.substring(queryIndex);
      },
    },
    authActions: { logout: async () => ({ success: true }) },
    matchMedia: () => ({ matches: false }),
    addEventListener(event, callback) {
      windowListeners[event] = windowListeners[event] || [];
      windowListeners[event].push(callback);
    },
    trigger(event) {
      (windowListeners[event] || []).forEach((callback) => callback());
    },
  };

  const store = {};
  const localStorageMock = {
    getItem: (key) => store[key] || null,
    setItem: (key, value) => {
      store[key] = String(value);
    },
  };

  return {
    window: windowMock,
    document: documentMock,
    localStorage: localStorageMock,
    fetch: fetchMock,
    elements,
    bodyClasses,
    historyCalls,
    createdElements,
  };
}

function runController(env) {
  const runner = new Function("window", "document", "localStorage", "fetch", clientsJsContent);
  runner(env.window, env.document, env.localStorage, env.fetch);
  env.document.trigger("DOMContentLoaded");
}

function okSession() {
  return {
    ok: true,
    status: 200,
    json: async () => ({ success: true, user: { email: "u@test.dev" } }),
  };
}

function clientsResponse({ clients = [], total = clients.length, page = 1, pageSize = 20 } = {}) {
  return {
    ok: true,
    status: 200,
    json: async () => ({ success: true, clients, total, page, pageSize }),
  };
}

function sampleClient(overrides = {}) {
  return {
    id: "client-1",
    name: "Acme Client",
    email: "hello@acme.test",
    status: "Lead",
    createdAt: "2026-08-14T10:00:00.000Z",
    updatedAt: "2026-08-15T10:00:00.000Z",
    ...overrides,
  };
}

async function flush(ms = 0) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

test("authenticated Client List loads real API data", async () => {
  const calls = [];
  const env = createMockEnvironment(async (url, options) => {
    calls.push({ url, options });
    if (url === "/api/session") {
      return okSession();
    }
    return clientsResponse({ clients: [sampleClient()] });
  });

  runController(env);
  await flush(10);

  assert.strictEqual(calls[1].url, "/api/clients?page=1&pageSize=20");
  assert.strictEqual(env.elements["clients-list"].classList.contains("hidden"), false);
  assert.strictEqual(env.elements["clients-count"].textContent, "1 client");
  assert.strictEqual(env.elements["clients-list"].children.length, 1);
  assert.strictEqual(
    env.elements["clients-list"].children[0].children[0].href,
    "/clients/client-1",
  );
});

test("empty, loading, and malformed response states are safe", async () => {
  let mode = "empty";
  const env = createMockEnvironment(async (url) => {
    if (url === "/api/session") {
      return okSession();
    }
    if (mode === "malformed") {
      return { ok: true, status: 200, json: async () => ({ success: true, clients: null }) };
    }
    return clientsResponse({ clients: [], total: 0 });
  });

  runController(env);
  assert.strictEqual(env.elements["clients-skeleton"].classList.contains("hidden"), false);
  await flush(10);
  assert.strictEqual(env.elements["clients-empty"].classList.contains("hidden"), false);

  mode = "malformed";
  env.elements["clients-error-retry"].click();
  await flush(10);
  assert.strictEqual(env.elements["clients-error"].classList.contains("hidden"), false);
  assert.ok(env.elements["clients-error-msg"].textContent.includes("Malformed API response"));
});

test("API errors, retry, and 401 auth redirect are handled", async () => {
  let clientsCalls = 0;
  const env = createMockEnvironment(async (url) => {
    if (url === "/api/session") {
      return okSession();
    }
    clientsCalls++;
    if (clientsCalls === 1) {
      return { ok: false, status: 500, json: async () => ({}) };
    }
    if (clientsCalls === 2) {
      return clientsResponse({ clients: [sampleClient()] });
    }
    return { ok: false, status: 401, json: async () => ({}) };
  });

  runController(env);
  await flush(10);
  assert.strictEqual(env.elements["clients-error"].classList.contains("hidden"), false);

  env.elements["clients-error-retry"].click();
  await flush(10);
  assert.strictEqual(env.elements["clients-list"].classList.contains("hidden"), false);

  env.elements["clients-refresh-btn"].click();
  await flush(10);
  assert.strictEqual(env.window.location.href, "/login.html");
});

test("status filter and pagination update API request URL state", async () => {
  const calls = [];
  const env = createMockEnvironment(async (url) => {
    calls.push(url);
    if (url === "/api/session") {
      return okSession();
    }
    const page = url.includes("page=2") ? 2 : 1;
    return clientsResponse({ clients: [sampleClient()], total: 25, page });
  });

  runController(env);
  await flush(10);

  env.elements["client-status-filter"].value = "Active";
  env.elements["client-status-filter"].trigger("change");
  await flush(10);

  assert.ok(calls.includes("/api/clients?page=1&pageSize=20&status=Active"));
  assert.ok(env.historyCalls.includes("/clients.html?status=Active"));

  env.elements["clients-next-page"].click();
  await flush(10);
  assert.ok(calls.includes("/api/clients?page=2&pageSize=20&status=Active"));
});

test("stale response protection keeps latest request authoritative", async () => {
  let firstResolve;
  const calls = [];
  const env = createMockEnvironment(async (url) => {
    calls.push(url);
    if (url === "/api/session") {
      return okSession();
    }
    if (calls.filter((item) => item.startsWith("/api/clients")).length === 1) {
      await new Promise((resolve) => {
        firstResolve = resolve;
      });
      return clientsResponse({ clients: [sampleClient({ id: "old", name: "Old Client" })] });
    }
    return clientsResponse({ clients: [sampleClient({ id: "new", name: "New Client" })] });
  });

  runController(env);
  await flush(5);
  env.elements["client-status-filter"].value = "Active";
  env.elements["client-status-filter"].trigger("change");
  await flush(10);
  firstResolve();
  await flush(10);

  const link = env.elements["clients-list"].children[0].children[0];
  assert.strictEqual(link.href, "/clients/new");
});

test("request cancellation aborts stale and unmounted requests", async () => {
  const signals = [];
  const env = createMockEnvironment(async (url, options = {}) => {
    if (url === "/api/session") {
      return okSession();
    }
    signals.push(options.signal);
    return clientsResponse({ clients: [sampleClient()] });
  });

  runController(env);
  await flush(10);
  env.elements["clients-refresh-btn"].click();
  await flush(10);
  assert.strictEqual(signals[0].aborted, true);

  env.window.trigger("pagehide");
  assert.strictEqual(signals[1].aborted, true);
});

test("refresh prevents duplicate simultaneous same-state requests", async () => {
  let release;
  let clientCalls = 0;
  const env = createMockEnvironment(async (url) => {
    if (url === "/api/session") {
      return okSession();
    }
    clientCalls++;
    await new Promise((resolve) => {
      release = resolve;
    });
    return clientsResponse({ clients: [sampleClient()] });
  });

  runController(env);
  await flush(5);
  env.elements["clients-refresh-btn"].click();
  env.elements["clients-refresh-icon"].click();
  release();
  await flush(10);

  assert.strictEqual(clientCalls, 1);
});

test("long names, unknown status, responsive hooks, and accessibility basics render", async () => {
  const longName = "Acme International Strategic Transformation Client With A Very Long Legal Name";
  const env = createMockEnvironment(async (url) => {
    if (url === "/api/session") {
      return okSession();
    }
    return clientsResponse({
      clients: [
        sampleClient({
          name: longName,
          status: "Unexpected",
          email: "very.long.address.for.billing@acme-international.example",
        }),
      ],
    });
  });

  runController(env);
  await flush(10);

  const row = env.elements["clients-list"].children[0];
  assert.strictEqual(row.getAttribute("role"), "listitem");
  assert.strictEqual(row.children[0].getAttribute("aria-label"), `Open client ${longName}`);
  assert.strictEqual(
    row.children[0].children[1].children[0].classList.contains("status-unknown"),
    true,
  );
  assert.strictEqual(env.elements["clients-prev-page"].disabled, true);
  assert.strictEqual(env.elements["clients-next-page"].disabled, true);
});

test("no mock production data or unsupported search UI exists", () => {
  const html = fs.readFileSync(path.join(__dirname, "clients.html"), "utf8");
  assert.strictEqual(html.includes("demo client"), false);
  assert.strictEqual(html.includes("mock client"), false);
  assert.strictEqual(html.includes('type="search"'), false);
  assert.strictEqual(html.includes("Add Client"), false);
});
