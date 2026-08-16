import test from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const detailJsContent = fs.readFileSync(path.join(__dirname, "client-detail.js"), "utf8");

function createMockElement(id, tag = "div", classes = []) {
  const listeners = {};
  const element = {
    id,
    tagName: tag.toUpperCase(),
    className: classes.join(" "),
    disabled: false,
    href: "",
    target: "",
    rel: "",
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

function createMockEnvironment(fetchMock, { pathname = "/clients/client-1", search = "" } = {}) {
  const ids = [
    "sidebar",
    "sidebar-toggle",
    "mobile-drawer-toggle",
    "drawer-overlay",
    "sidebar-logout-btn",
    "user-avatar-initials",
    "client-detail-skeleton",
    "client-detail-panel",
    "client-detail-not-found",
    "client-detail-not-found-msg",
    "client-detail-error",
    "client-detail-error-msg",
    "client-detail-error-retry",
    "client-detail-refresh-btn",
    "client-detail-refresh-icon",
    "client-detail-title",
    "client-detail-subtitle",
    "client-detail-breadcrumb",
    "client-detail-avatar",
    "client-detail-name",
    "client-detail-contact",
    "client-detail-status",
    "client-detail-email",
    "client-detail-website",
    "client-detail-phone",
    "client-detail-created",
    "client-detail-updated",
    "client-timeline-skeleton",
    "client-timeline-list",
    "client-timeline-empty",
    "client-timeline-error",
    "client-timeline-error-msg",
    "client-timeline-retry",
    "client-timeline-count",
    "client-timeline-prev",
    "client-timeline-next",
    "client-timeline-page-summary",
  ];

  const elements = {};
  ids.forEach((id) => {
    elements[id] = createMockElement(id);
  });
  elements["client-detail-panel"].classList.add("hidden");
  elements["client-detail-not-found"].classList.add("hidden");
  elements["client-detail-error"].classList.add("hidden");
  elements["client-timeline-list"].classList.add("hidden");
  elements["client-timeline-empty"].classList.add("hidden");
  elements["client-timeline-error"].classList.add("hidden");

  const documentListeners = {};
  const createdElements = [];
  const documentMock = {
    title: "Client Detail - FreelanceOS",
    body: { classList: { add() {} } },
    addEventListener(event, callback) {
      documentListeners[event] = documentListeners[event] || [];
      documentListeners[event].push(callback);
    },
    trigger(event) {
      (documentListeners[event] || []).forEach((callback) => callback());
    },
    getElementById(id) {
      return elements[id] || null;
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
  const windowMock = {
    location: { href: "", pathname, search },
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
    createdElements,
  };
}

function runController(env) {
  const runner = new Function("window", "document", "localStorage", "fetch", detailJsContent);
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

function clientResponse(client = sampleClient()) {
  return {
    ok: true,
    status: 200,
    json: async () => ({ success: true, client }),
  };
}

function timelineResponse({ entries = [], total = entries.length, page = 1, pageSize = 20 } = {}) {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      success: true,
      timeline: {
        id: "timeline-1",
        clientId: "client-1",
        status: "Active",
        entries,
        total,
        page,
        pageSize,
      },
    }),
  };
}

function sampleTimelineEntry(overrides = {}) {
  return {
    id: "entry-1",
    eventRef: null,
    category: "Lifecycle Event",
    timestamp: "2026-08-15T10:00:00.000Z",
    message: "Client status changed",
    visibility: "Public",
    ...overrides,
  };
}

function sampleClient(overrides = {}) {
  return {
    id: "client-1",
    name: "Acme Client",
    email: "hello@acme.test",
    phone: "+1 555 0100",
    website: "https://acme.test/profile",
    status: "Active",
    createdAt: "2026-08-14T10:00:00.000Z",
    updatedAt: "2026-08-15T10:00:00.000Z",
    ownerId: "must-not-render",
    tenantId: "must-not-render",
    ...overrides,
  };
}

async function flush(ms = 0) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

test("valid Client Detail loads real API data and renders identity, status, website, contact, timestamps, and back navigation", async () => {
  const calls = [];
  const env = createMockEnvironment(async (url, options) => {
    calls.push({ url, options });
    if (url === "/api/session") {
      return okSession();
    }
    if (url.startsWith("/api/clients/client-1/timeline")) {
      return timelineResponse();
    }
    return clientResponse();
  });

  runController(env);
  assert.strictEqual(env.elements["client-detail-skeleton"].classList.contains("hidden"), false);
  await flush(10);

  assert.strictEqual(calls[1].url, "/api/clients/client-1");
  assert.strictEqual(calls[2].url, "/api/clients/client-1/timeline?page=1&pageSize=20");
  assert.strictEqual(env.elements["client-detail-panel"].classList.contains("hidden"), false);
  assert.strictEqual(env.elements["client-detail-title"].textContent, "Acme Client");
  assert.strictEqual(env.elements["client-detail-status"].textContent, "Active");
  assert.strictEqual(
    env.elements["client-detail-status"].classList.contains("status-active"),
    true,
  );
  assert.strictEqual(
    env.elements["client-detail-email"].children[0].href,
    "mailto:hello@acme.test",
  );
  assert.strictEqual(
    env.elements["client-detail-website"].children[0].href,
    "https://acme.test/profile",
  );
  assert.strictEqual(env.elements["client-detail-website"].children[0].rel, "noopener noreferrer");
  assert.ok(env.elements["client-detail-created"].textContent.includes("2026"));
  assert.ok(
    fs.readFileSync(path.join(__dirname, "client-detail.html"), "utf8").includes("Back to Clients"),
  );
});

test("missing and malformed Client IDs show not-found without calling the Client API", async () => {
  const calls = [];
  const env = createMockEnvironment(
    async (url) => {
      calls.push(url);
      return okSession();
    },
    { pathname: "/client-detail.html", search: "?id=../../bad" },
  );

  runController(env);
  await flush(10);

  assert.deepStrictEqual(calls, ["/api/session"]);
  assert.strictEqual(env.elements["client-detail-not-found"].classList.contains("hidden"), false);
  assert.strictEqual(env.elements["client-detail-refresh-btn"].disabled, true);
});

test("404 not-found, 401 authentication, and 403 authorization states are handled safely", async () => {
  let mode = "404";
  const env = createMockEnvironment(async (url) => {
    if (url === "/api/session") {
      return okSession();
    }
    if (url.includes("/timeline")) {
      return timelineResponse();
    }
    if (mode === "401") {
      return { ok: false, status: 401, json: async () => ({}) };
    }
    if (mode === "403") {
      return { ok: false, status: 403, json: async () => ({}) };
    }
    return { ok: false, status: 404, json: async () => ({}) };
  });

  runController(env);
  await flush(10);
  assert.strictEqual(env.elements["client-detail-not-found"].classList.contains("hidden"), false);

  mode = "403";
  env.elements["client-detail-error-retry"].click();
  await flush(10);
  assert.strictEqual(env.elements["client-detail-error"].classList.contains("hidden"), false);
  assert.ok(env.elements["client-detail-error-msg"].textContent.includes("access"));

  mode = "401";
  env.elements["client-detail-error-retry"].click();
  await flush(10);
  assert.strictEqual(env.window.location.href, "/login.html");
});

test("500 server error, network failure, malformed API response, and retry render safely", async () => {
  let mode = "500";
  const env = createMockEnvironment(async (url) => {
    if (url === "/api/session") {
      return okSession();
    }
    if (url.includes("/timeline")) {
      return timelineResponse();
    }
    if (mode === "network") {
      throw new Error("Network unavailable");
    }
    if (mode === "malformed") {
      return { ok: true, status: 200, json: async () => ({ success: true }) };
    }
    if (mode === "ok") {
      return clientResponse(sampleClient({ name: "Recovered Client" }));
    }
    return { ok: false, status: 500, json: async () => ({}) };
  });

  runController(env);
  await flush(10);
  assert.strictEqual(env.elements["client-detail-error"].classList.contains("hidden"), false);

  mode = "network";
  env.elements["client-detail-error-retry"].click();
  await flush(10);
  assert.ok(env.elements["client-detail-error-msg"].textContent.includes("Network unavailable"));

  mode = "malformed";
  env.elements["client-detail-error-retry"].click();
  await flush(10);
  assert.ok(env.elements["client-detail-error-msg"].textContent.includes("Malformed API response"));

  mode = "ok";
  env.elements["client-detail-error-retry"].click();
  await flush(10);
  assert.strictEqual(env.elements["client-detail-title"].textContent, "Recovered Client");
});

test("missing optional fields, unsafe website, invalid timestamps, long values, and unknown status render without undefined or null text", async () => {
  const longName = "Acme International Strategic Transformation Client With A Very Long Legal Name";
  const longEmail = "very.long.address.for.billing@acme-international.example";
  const env = createMockEnvironment(async (url) => {
    if (url === "/api/session") {
      return okSession();
    }
    if (url.includes("/timeline")) {
      return timelineResponse();
    }
    return clientResponse(
      sampleClient({
        name: longName,
        email: longEmail,
        phone: null,
        website: "javascript:alert(1)",
        status: "Unexpected",
        createdAt: "not-a-date",
        updatedAt: null,
      }),
    );
  });

  runController(env);
  await flush(10);

  assert.strictEqual(env.elements["client-detail-title"].textContent, longName);
  assert.strictEqual(env.elements["client-detail-email"].children[0].href, `mailto:${longEmail}`);
  assert.strictEqual(env.elements["client-detail-website"].textContent, "Not provided");
  assert.strictEqual(env.elements["client-detail-phone"].textContent, "Not provided");
  assert.strictEqual(
    env.elements["client-detail-status"].classList.contains("status-unknown"),
    true,
  );
  assert.strictEqual(env.elements["client-detail-created"].textContent, "Unavailable");
  assert.strictEqual(env.elements["client-detail-updated"].textContent, "Unavailable");
  assert.strictEqual(JSON.stringify(env.elements).includes("undefined"), false);
  assert.strictEqual(JSON.stringify(env.elements).includes("null"), false);
});

test("request cancellation aborts stale and pagehide requests", async () => {
  const signals = [];
  const env = createMockEnvironment(async (url, options = {}) => {
    if (url === "/api/session") {
      return okSession();
    }
    if (url.includes("/timeline")) {
      return timelineResponse();
    }
    signals.push(options.signal);
    return clientResponse();
  });

  runController(env);
  await flush(10);
  env.elements["client-detail-error-retry"].click();
  await flush(10);
  assert.strictEqual(signals[0].aborted, true);

  env.window.trigger("pagehide");
  assert.strictEqual(signals[1].aborted, true);
});

test("stale response protection keeps the latest Client Detail response authoritative", async () => {
  let firstResolve;
  const env = createMockEnvironment(async (url) => {
    if (url === "/api/session") {
      return okSession();
    }
    if (url.includes("/timeline")) {
      return timelineResponse();
    }
    if (!firstResolve) {
      await new Promise((resolve) => {
        firstResolve = resolve;
      });
      return clientResponse(sampleClient({ name: "Old Client" }));
    }
    return clientResponse(sampleClient({ name: "New Client" }));
  });

  runController(env);
  await flush(5);
  env.elements["client-detail-error-retry"].click();
  await flush(10);
  firstResolve();
  await flush(10);

  assert.strictEqual(env.elements["client-detail-title"].textContent, "New Client");
});

test("refresh prevents duplicate simultaneous same-client requests", async () => {
  let release;
  let clientCalls = 0;
  const env = createMockEnvironment(async (url) => {
    if (url === "/api/session") {
      return okSession();
    }
    if (url.includes("/timeline")) {
      return timelineResponse();
    }
    clientCalls++;
    await new Promise((resolve) => {
      release = resolve;
    });
    return clientResponse();
  });

  runController(env);
  await flush(5);
  env.elements["client-detail-refresh-btn"].click();
  env.elements["client-detail-refresh-icon"].click();
  release();
  await flush(10);

  assert.strictEqual(clientCalls, 1);
});

test("query-string Client ID route convention is supported", async () => {
  const calls = [];
  const env = createMockEnvironment(
    async (url) => {
      calls.push(url);
      if (url === "/api/session") {
        return okSession();
      }
      if (url.includes("/timeline")) {
        return timelineResponse();
      }
      return clientResponse();
    },
    { pathname: "/client-detail.html", search: "?id=query-client" },
  );

  runController(env);
  await flush(10);

  assert.ok(calls.includes("/api/clients/query-client"));
});

test("timeline renders empty, populated, paginated, and accessible states without fabricated events", async () => {
  let mode = "empty";
  const env = createMockEnvironment(async (url) => {
    if (url === "/api/session") {
      return okSession();
    }
    if (!url.includes("/timeline")) {
      return clientResponse();
    }
    if (mode === "populated") {
      return timelineResponse({
        entries: [
          sampleTimelineEntry({
            id: "entry-new",
            message: "Newer event",
            timestamp: "2026-08-15T11:00:00.000Z",
          }),
          sampleTimelineEntry({
            id: "entry-old",
            category: "Unexpected Event",
            message: null,
            timestamp: "2026-08-15T10:00:00.000Z",
          }),
        ],
        total: 22,
      });
    }
    return timelineResponse({ entries: [], total: 0 });
  });

  runController(env);
  await flush(10);

  assert.strictEqual(env.elements["client-timeline-empty"].classList.contains("hidden"), false);
  assert.strictEqual(env.elements["client-timeline-list"].children.length, 0);
  assert.strictEqual(JSON.stringify(env.elements).includes("Client created"), false);

  mode = "populated";
  env.elements["client-timeline-retry"].click();
  await flush(10);

  assert.strictEqual(env.elements["client-timeline-list"].classList.contains("hidden"), false);
  assert.strictEqual(env.elements["client-timeline-list"].children.length, 2);
  assert.strictEqual(
    env.elements["client-timeline-list"].children[0].getAttribute("role"),
    "listitem",
  );
  assert.ok(
    env.elements["client-timeline-list"].children[0]
      .getAttribute("aria-label")
      .includes("Lifecycle Event"),
  );
  assert.strictEqual(env.elements["client-timeline-next"].disabled, false);
});

test("timeline error, retry, 401, 403, 404, and malformed responses stay scoped to the timeline panel", async () => {
  let mode = "500";
  const env = createMockEnvironment(async (url) => {
    if (url === "/api/session") {
      return okSession();
    }
    if (!url.includes("/timeline")) {
      return clientResponse();
    }
    if (mode === "ok") {
      return timelineResponse({ entries: [sampleTimelineEntry()] });
    }
    if (mode === "401") {
      return { ok: false, status: 401, json: async () => ({}) };
    }
    if (mode === "403") {
      return { ok: false, status: 403, json: async () => ({}) };
    }
    if (mode === "404") {
      return { ok: false, status: 404, json: async () => ({}) };
    }
    if (mode === "malformed") {
      return {
        ok: true,
        status: 200,
        json: async () => ({ success: true, timeline: { entries: null } }),
      };
    }
    return { ok: false, status: 500, json: async () => ({}) };
  });

  runController(env);
  await flush(10);
  assert.strictEqual(env.elements["client-detail-panel"].classList.contains("hidden"), false);
  assert.strictEqual(env.elements["client-timeline-error"].classList.contains("hidden"), false);

  mode = "403";
  env.elements["client-timeline-retry"].click();
  await flush(10);
  assert.ok(env.elements["client-timeline-error-msg"].textContent.includes("access"));

  mode = "404";
  env.elements["client-timeline-retry"].click();
  await flush(10);
  assert.ok(env.elements["client-timeline-error-msg"].textContent.includes("Timeline"));

  mode = "malformed";
  env.elements["client-timeline-retry"].click();
  await flush(10);
  assert.ok(
    env.elements["client-timeline-error-msg"].textContent.includes("Malformed API response"),
  );

  mode = "ok";
  env.elements["client-timeline-retry"].click();
  await flush(10);
  assert.strictEqual(env.elements["client-timeline-list"].children.length, 1);

  mode = "401";
  env.elements["client-timeline-retry"].click();
  await flush(10);
  assert.strictEqual(env.window.location.href, "/login.html");
});

test("timeline request cancellation and duplicate prevention are independent", async () => {
  const calls = [];
  const signals = [];
  let firstTimelineResolve;
  const env = createMockEnvironment(async (url, options = {}) => {
    calls.push(url);
    if (url === "/api/session") {
      return okSession();
    }
    if (!url.includes("/timeline")) {
      return clientResponse();
    }
    signals.push(options.signal);
    await new Promise((resolve) => {
      firstTimelineResolve = resolve;
    });
    return timelineResponse({ entries: [sampleTimelineEntry({ message: "Only timeline" })] });
  });

  runController(env);
  await flush(5);
  env.elements["client-timeline-retry"].click();
  env.elements["client-timeline-retry"].click();
  await flush(10);
  firstTimelineResolve();
  await flush(10);

  assert.strictEqual(calls.filter((url) => url.includes("/timeline")).length, 1);
  assert.strictEqual(
    env.elements["client-timeline-list"].children[0].children[1].children[0].textContent,
    "Only timeline",
  );

  env.window.trigger("pagehide");
  assert.strictEqual(signals[0].aborted, true);
});

test("Client Detail HTML contains no fake data, unsupported jobs, editing, or sensitive-field output", () => {
  const html = fs.readFileSync(path.join(__dirname, "client-detail.html"), "utf8");
  const js = fs.readFileSync(path.join(__dirname, "client-detail.js"), "utf8");
  const combined = `${html}\n${js}`.toLowerCase();

  assert.strictEqual(combined.includes("demo client"), false);
  assert.strictEqual(combined.includes("mock client"), false);
  assert.strictEqual(combined.includes("delete client"), false);
  assert.strictEqual(combined.includes("edit client"), false);
  assert.strictEqual(combined.includes("ownerid"), false);
  assert.strictEqual(combined.includes("tenantid"), false);
  assert.strictEqual(combined.includes("password"), false);
  assert.strictEqual(combined.includes("token"), false);
  assert.strictEqual(combined.includes("stripe"), false);
});
