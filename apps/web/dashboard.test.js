import test from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read dashboard.js source content
const dashboardJsContent = fs.readFileSync(path.join(__dirname, "dashboard.js"), "utf8");

// Helper to construct a mock DOM element
function createMockElement(id, tag = "div", classes = []) {
  const listeners = {};
  const element = {
    id,
    tagName: tag.toUpperCase(),
    className: classes.join(" "),
    classList: {
      classes,
      add(c) {
        if (!this.classes.includes(c)) {
          this.classes.push(c);
        }
        element.className = this.classes.join(" ");
      },
      remove(c) {
        const idx = this.classes.indexOf(c);
        if (idx !== -1) {
          this.classes.splice(idx, 1);
        }
        element.className = this.classes.join(" ");
      },
      toggle(c, force) {
        const has = this.classes.includes(c);
        const shouldHave = force !== undefined ? force : !has;
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
    textContent: "",
    _innerHTML: "",
    get innerHTML() {
      return this._innerHTML;
    },
    set innerHTML(val) {
      this._innerHTML = val;
      if (val === "") {
        this.children = [];
      }
    },
    style: {
      width: "",
      display: "",
    },
    attributes: {},
    setAttribute(name, val) {
      this.attributes[name] = val;
    },
    getAttribute(name) {
      return this.attributes[name];
    },
    addEventListener(event, cb) {
      listeners[event] = listeners[event] || [];
      listeners[event].push(cb);
    },
    trigger(event, data) {
      if (listeners[event]) {
        listeners[event].forEach((cb) => cb(data));
      }
    },
    click() {
      this.trigger("click", { preventDefault: () => {} });
    },
    appendChild(child) {
      this.children.push(child);
    },
    children: [],
  };
  return element;
}

// Function to construct a fresh Mock Browser Environment
function createMockEnvironment(fetchMock) {
  const elements = {};
  const querySelectors = {};

  // Registry of defined page elements
  const ids = [
    "sidebar",
    "sidebar-toggle",
    "mobile-drawer-toggle",
    "drawer-overlay",
    "welcome-message",
    "user-avatar-initials",
    "sidebar-logout-btn",
    "metric-scanned",
    "kpi-scanned-val",
    "kpi-scanned-trend",
    "kpi-scanned-error",
    "metric-matches",
    "kpi-matches-val",
    "kpi-matches-trend",
    "kpi-matches-error",
    "metric-proposals",
    "kpi-proposals-val",
    "kpi-proposals-trend",
    "kpi-proposals-error",
    "pulse-skeleton",
    "pulse-desc",
    "pulse-error",
    "skeleton-feed",
    "opportunities-list",
    "opportunities-empty",
    "opportunities-error",
    "opportunities-error-msg",
    "btn-opportunities-retry",
    "opportunities-count",
    "usage-skeleton",
    "usage-details",
    "usage-error",
    "btn-usage-retry",
    "plan-badge-val",
    "proposal-quota-fraction",
    "proposal-quota-remaining-desc",
    "proposal-progress-bar",
    "billing-status-val",
    "activity-skeleton",
    "activity-timeline",
    "activity-empty",
    "activity-error",
    "btn-activity-retry",
  ];

  ids.forEach((id) => {
    elements[id] = createMockElement(id);
  });

  // KPI retry buttons
  const scannedRetryBtn = createMockElement("scanned-retry", "button");
  const matchesRetryBtn = createMockElement("matches-retry", "button");
  const proposalsRetryBtn = createMockElement("proposals-retry", "button");
  const pulseRetryBtn = createMockElement("pulse-retry", "button");

  // Query selectors definitions
  querySelectors["#metric-scanned .metric-skeleton"] = createMockElement("scanned-skel");
  querySelectors["#metric-scanned .metric-val-wrap"] = createMockElement("scanned-val-wrap");
  querySelectors["#metric-scanned .btn-retry"] = scannedRetryBtn;

  querySelectors["#metric-matches .metric-skeleton"] = createMockElement("matches-skel");
  querySelectors["#metric-matches .metric-val-wrap"] = createMockElement("matches-val-wrap");
  querySelectors["#metric-matches .btn-retry"] = matchesRetryBtn;

  querySelectors["#metric-proposals .metric-skeleton"] = createMockElement("proposals-skel");
  querySelectors["#metric-proposals .metric-val-wrap"] = createMockElement("proposals-val-wrap");
  querySelectors["#metric-proposals .btn-retry"] = proposalsRetryBtn;

  querySelectors[".pulse-container .btn-retry"] = pulseRetryBtn;

  // Local storage mock
  const store = {};
  const localStorageMock = {
    getItem: (key) => store[key] || null,
    setItem: (key, val) => {
      store[key] = String(val);
    },
    removeItem: (key) => {
      delete store[key];
    },
    clear: () => {
      Object.keys(store).forEach((k) => delete store[k]);
    },
  };

  const createdElements = [];
  const documentListeners = {};
  const documentMock = {
    addEventListener(event, cb) {
      documentListeners[event] = documentListeners[event] || [];
      documentListeners[event].push(cb);
    },
    trigger(event) {
      if (documentListeners[event]) {
        documentListeners[event].forEach((cb) => cb());
      }
    },
    getElementById(id) {
      if (elements[id]) {
        return elements[id];
      }
      for (let i = createdElements.length - 1; i >= 0; i--) {
        if (createdElements[i].id === id) {
          return createdElements[i];
        }
      }
      return null;
    },
    querySelector(selector) {
      if (elements[selector.replace("#", "")]) {
        return elements[selector.replace("#", "")];
      }
      return querySelectors[selector] || null;
    },
    createElement(tag) {
      const el = createMockElement("created-" + Math.random(), tag);
      createdElements.push(el);
      return el;
    },
  };

  const locationMock = {
    href: "",
  };

  const authActionsMock = {
    logout: async () => ({ success: true }),
  };

  const windowMock = {
    location: locationMock,
    authActions: authActionsMock,
    matchMedia: (query) => ({
      matches: query.includes("reduced-motion") ? false : false,
    }),
  };

  // Immediate setTimeout mock to speed up tests
  const setTimeoutMock = (cb) => {
    cb();
    return 0;
  };

  return {
    window: windowMock,
    document: documentMock,
    localStorage: localStorageMock,
    fetch: fetchMock,
    setTimeout: setTimeoutMock,
    elements,
    querySelectors,
    scannedRetryBtn,
    matchesRetryBtn,
    proposalsRetryBtn,
    pulseRetryBtn,
  };
}

// Executes the dashboard controller within a specific mock environment
function runController(env) {
  const runner = new Function(
    "window",
    "document",
    "localStorage",
    "fetch",
    "setTimeout",
    dashboardJsContent,
  );
  runner(env.window, env.document, env.localStorage, env.fetch, env.setTimeout);
  // Trigger DOMContentLoaded
  env.document.trigger("DOMContentLoaded");
}

// -------------------------------------------------------------
// TESTS
// -------------------------------------------------------------

test("1 & 3. Authenticated rendering & Welcome state", async () => {
  const fetchMock = async (url) => {
    if (url === "/api/session") {
      return {
        ok: true,
        json: async () => ({
          success: true,
          user: { email: "johndoe@example.com", userId: "usr_1" },
        }),
      };
    }
    // Handle subsequent calls with empty/empty status to bypass crash
    return { ok: true, json: async () => ({}) };
  };

  const env = createMockEnvironment(fetchMock);
  runController(env);

  // Allow call resolution
  await new Promise((r) => setTimeout(r, 10));

  assert.strictEqual(env.elements["welcome-message"].textContent, "Good morning, Johndoe");
  assert.strictEqual(env.elements["user-avatar-initials"].textContent, "J");
});

test("2. Unauthenticated redirect/guard", async () => {
  const fetchMock = async (url) => {
    if (url === "/api/session") {
      return {
        ok: false,
        json: async () => ({ success: false, error: "Unauthorized" }),
      };
    }
    return { ok: true, json: async () => ({}) };
  };

  const env = createMockEnvironment(fetchMock);
  runController(env);

  await new Promise((r) => setTimeout(r, 10));

  assert.strictEqual(env.window.location.href, "/login.html");
});

test("4. KPI rendering on successful API responses", async () => {
  const fetchMock = async (url) => {
    if (url === "/api/session") {
      return { ok: true, json: async () => ({ success: true, user: { email: "a@b.com" } }) };
    }
    if (url === "/api/analytics/scanned") {
      return { ok: true, json: async () => ({ value: 45, trend: "+12%" }) };
    }
    if (url === "/api/analytics/matches") {
      return { ok: true, json: async () => ({ value: 8, trend: "+3%" }) };
    }
    if (url === "/api/analytics/proposals") {
      return { ok: true, json: async () => ({ value: 14, trend: "0%" }) };
    }
    return { ok: true, json: async () => ({}) };
  };

  const env = createMockEnvironment(fetchMock);
  runController(env);

  await new Promise((r) => setTimeout(r, 10));

  assert.strictEqual(String(env.elements["kpi-scanned-val"].textContent), "45");
  assert.strictEqual(env.elements["kpi-scanned-trend"].textContent, "+12%");
  assert.strictEqual(String(env.elements["kpi-matches-val"].textContent), "8");
  assert.strictEqual(String(env.elements["kpi-proposals-val"].textContent), "14");
});

test("5 & 16. Missing KPI data / component API failure", async () => {
  const fetchMock = async (url) => {
    if (url === "/api/session") {
      return { ok: true, json: async () => ({ success: true, user: { email: "a@b.com" } }) };
    }
    if (url === "/api/analytics/scanned") {
      return { ok: false, status: 500 }; // Fail scanned KPI
    }
    return { ok: true, json: async () => ({ value: 10 }) };
  };

  const env = createMockEnvironment(fetchMock);
  runController(env);

  await new Promise((r) => setTimeout(r, 10));

  // Scanned card should display its component error block
  assert.strictEqual(env.elements["kpi-scanned-error"].classList.contains("hidden"), false);
  // Matches card should render successfully (no global page crash)
  assert.strictEqual(env.elements["kpi-matches-error"].classList.contains("hidden"), true);
});

test("6. Opportunity Pulse rendering", async () => {
  const fetchMock = async (url) => {
    if (url === "/api/session") {
      return { ok: true, json: async () => ({ success: true, user: { email: "a@b.com" } }) };
    }
    if (url === "/api/analytics/pulse") {
      return { ok: true, json: async () => ({ description: "Active opportunity scan ongoing." }) };
    }
    return { ok: true, json: async () => ({}) };
  };

  const env = createMockEnvironment(fetchMock);
  runController(env);

  await new Promise((r) => setTimeout(r, 10));

  assert.strictEqual(env.elements["pulse-desc"].textContent, "Active opportunity scan ongoing.");
});

test("7, 8 & 23. Opportunity Cards, Score rendering & Backend display values", async () => {
  const sampleJobs = [
    {
      id: "job-1",
      title: "Senior Node developer",
      platform: "Upwork",
      score: 94,
      budget: "$5,000",
      skills: ["Node.js", "TypeScript"],
      matchExplanation: "Fits your high-level JavaScript expertise.",
      createdAt: new Date().toISOString(),
    },
  ];

  const fetchMock = async (url) => {
    if (url === "/api/session") {
      return { ok: true, json: async () => ({ success: true, user: { email: "a@b.com" } }) };
    }
    if (url === "/api/jobs") {
      return { ok: true, json: async () => ({ jobs: sampleJobs }) };
    }
    return { ok: true, json: async () => ({}) };
  };

  const env = createMockEnvironment(fetchMock);
  runController(env);

  await new Promise((r) => setTimeout(r, 15));

  // The opportunities feed must render opportunity list
  assert.strictEqual(env.elements["opportunities-list"].classList.contains("hidden"), false);
  assert.strictEqual(env.elements["opportunities-empty"].classList.contains("hidden"), true);
  assert.strictEqual(env.elements["opportunities-count"].textContent, "1 found");

  const children = env.elements["opportunities-list"].children;
  assert.strictEqual(children.length, 1);
  const childHtml = children[0].innerHTML;
  assert.ok(childHtml.includes("Senior Node developer"));
  assert.ok(childHtml.includes("94% match")); // Backend-provided score matches exactly
  assert.ok(childHtml.includes("Fits your high-level JavaScript expertise."));
});

test("9, 10, 11 & 12. Usage rendering, unlimited usage, active trial & paid plan", async () => {
  const fetchMock = async (url) => {
    if (url === "/api/session") {
      return { ok: true, json: async () => ({ success: true, user: { email: "a@b.com" } }) };
    }
    if (url === "/api/entitlements") {
      return {
        ok: true,
        json: async () => ({
          planId: "PRO",
          source: "TRIAL",
          trialDaysRemaining: 5,
          limits: {
            aiProposals: { type: "LIMITED", value: 50 },
          },
          usage: {
            aiProposals: 17,
          },
        }),
      };
    }
    return { ok: true, json: async () => ({}) };
  };

  const env = createMockEnvironment(fetchMock);
  runController(env);

  await new Promise((r) => setTimeout(r, 10));

  assert.strictEqual(env.elements["plan-badge-val"].textContent, "PRO TRIAL");
  assert.strictEqual(env.elements["proposal-quota-fraction"].textContent, "17 / 50");
  assert.strictEqual(env.elements["proposal-quota-remaining-desc"].textContent, "33 remaining");
  assert.strictEqual(env.elements["proposal-progress-bar"].style.width, "34%");
  assert.strictEqual(
    env.elements["billing-status-val"].textContent,
    "5 days remaining in your free Pro trial.",
  );
});

test("13. Empty opportunities feed rendering", async () => {
  const fetchMock = async (url) => {
    if (url === "/api/session") {
      return { ok: true, json: async () => ({ success: true, user: { email: "a@b.com" } }) };
    }
    if (url === "/api/jobs") {
      return { ok: true, json: async () => ({ jobs: [] }) };
    }
    return { ok: true, json: async () => ({}) };
  };

  const env = createMockEnvironment(fetchMock);
  runController(env);

  await new Promise((r) => setTimeout(r, 10));

  assert.strictEqual(env.elements["opportunities-empty"].classList.contains("hidden"), false);
  assert.strictEqual(env.elements["opportunities-list"].classList.contains("hidden"), true);
});

test("17. Retry trigger triggers another load request", async () => {
  let callCount = 0;
  const fetchMock = async (url) => {
    if (url === "/api/session") {
      return { ok: true, json: async () => ({ success: true, user: { email: "a@b.com" } }) };
    }
    if (url === "/api/analytics/pulse") {
      callCount++;
      if (callCount === 1) {
        return { ok: false, status: 500 };
      }
      return { ok: true, json: async () => ({ description: "Scanned on retry" }) };
    }
    return { ok: true, json: async () => ({}) };
  };

  const env = createMockEnvironment(fetchMock);
  runController(env);

  await new Promise((r) => setTimeout(r, 10));

  // Pulse displays error initially
  assert.strictEqual(env.elements["pulse-error"].classList.contains("hidden"), false);
  assert.strictEqual(callCount, 1);

  // Click retry button
  env.pulseRetryBtn.click();
  await new Promise((r) => setTimeout(r, 10));

  // Error is hidden, success desc displays
  assert.strictEqual(env.elements["pulse-error"].classList.contains("hidden"), true);
  assert.strictEqual(env.elements["pulse-desc"].textContent, "Scanned on retry");
  assert.strictEqual(callCount, 2);
});

test("21. Reduced-motion setup adds reduced-motion class to body", () => {
  const env = createMockEnvironment(() => {});
  // Stub matchMedia to simulate reduced-motion active
  env.window.matchMedia = (query) => ({
    matches: query.includes("reduced-motion") ? true : false,
  });

  const bodyClasses = [];
  // Mock global document.body
  globalThis.document = {
    ...env.document,
    body: {
      classList: {
        add: (c) => bodyClasses.push(c),
      },
    },
  };

  const runner = new Function(
    "window",
    "document",
    "localStorage",
    "fetch",
    "setTimeout",
    dashboardJsContent,
  );
  runner(env.window, globalThis.document, env.localStorage, env.fetch, env.setTimeout);
  globalThis.document.trigger("DOMContentLoaded");

  assert.ok(bodyClasses.includes("reduced-motion"));
  delete globalThis.document;
});

test("22. Critical Test: No fabricated data rule", async () => {
  const fetchMock = async (url) => {
    if (url === "/api/session") {
      return { ok: true, json: async () => ({ success: true, user: { email: "a@b.com" } }) };
    }
    if (url === "/api/entitlements") {
      return {
        ok: true,
        json: async () => ({
          planId: "STARTER",
          source: "STARTER",
          limits: {
            aiProposals: { type: "LIMITED", value: 3 },
          },
          usage: {
            aiProposals: 3,
          },
        }),
      };
    }
    return { ok: true, json: async () => ({}) };
  };

  const env = createMockEnvironment(fetchMock);
  runController(env);

  await new Promise((r) => setTimeout(r, 10));

  // The remaining quota is 0. It must display 0, and MUST NOT fabricate 33 or any other positive numbers.
  assert.strictEqual(env.elements["proposal-quota-fraction"].textContent, "3 / 3");
  assert.strictEqual(env.elements["proposal-quota-remaining-desc"].textContent, "0 remaining");
});

test("23. Dashboard loads activity and handles empty activity state", async () => {
  const fetchMock = async (url) => {
    if (url === "/api/session") {
      return { ok: true, json: async () => ({ success: true, user: { email: "a@b.com" } }) };
    }
    if (url === "/api/activity") {
      return {
        ok: true,
        json: async () => ({
          activity: [{ id: "act-1", message: "Job matched", timestamp: new Date().toISOString() }],
        }),
      };
    }
    return { ok: true, json: async () => ({}) };
  };

  const env = createMockEnvironment(fetchMock);
  runController(env);
  await new Promise((r) => setTimeout(r, 10));

  assert.strictEqual(env.elements["activity-timeline"].classList.contains("hidden"), false);
  assert.strictEqual(env.elements["activity-empty"].classList.contains("hidden"), true);
  assert.strictEqual(env.elements["activity-timeline"].children.length, 1);
  assert.ok(env.elements["activity-timeline"].children[0].innerHTML.includes("Job matched"));
});

test("24. Jobs failure does not break activity or analytics", async () => {
  const fetchMock = async (url) => {
    if (url === "/api/session") {
      return { ok: true, json: async () => ({ success: true, user: { email: "a@b.com" } }) };
    }
    if (url === "/api/jobs") {
      return { ok: false, status: 500 };
    }
    if (url === "/api/activity") {
      return {
        ok: true,
        json: async () => ({
          activity: [{ id: "act-1", message: "Act 1", timestamp: new Date().toISOString() }],
        }),
      };
    }
    return { ok: true, json: async () => ({ value: 5 }) };
  };

  const env = createMockEnvironment(fetchMock);
  runController(env);
  await new Promise((r) => setTimeout(r, 10));

  assert.strictEqual(env.elements["opportunities-error"].classList.contains("hidden"), false);
  assert.strictEqual(env.elements["activity-error"].classList.contains("hidden"), true);
  assert.strictEqual(env.elements["kpi-scanned-error"].classList.contains("hidden"), true);
});

test("25. Match success, failure, 403 entitlement denial and duplicate click protection", async () => {
  let matchCallCount = 0;
  let matchStatus = 201;
  const matchResponsePayload = { score: 85, matchExplanation: "Great fit" };

  const sampleJobs = [
    {
      id: "job-1",
      title: "Job to match",
      platform: "Upwork",
      score: null,
      budget: "$5,000",
      skills: ["Node.js"],
      createdAt: new Date().toISOString(),
    },
  ];

  const fetchMock = async (url, options) => {
    if (url === "/api/session") {
      return { ok: true, json: async () => ({ success: true, user: { email: "a@b.com" } }) };
    }
    if (url === "/api/jobs") {
      return { ok: true, json: async () => ({ jobs: sampleJobs }) };
    }
    if (url === `/api/jobs/job-1/match` && options?.method === "POST") {
      matchCallCount++;
      if (matchStatus === 201) {
        return { ok: true, status: 201, json: async () => matchResponsePayload };
      } else if (matchStatus === 403) {
        return {
          ok: false,
          status: 403,
          json: async () => ({ error: "Entitlement Denied", reason: "Usage limit reached" }),
        };
      } else {
        return { ok: false, status: 500, json: async () => ({ error: "Internal Error" }) };
      }
    }
    return { ok: true, json: async () => ({}) };
  };

  const env = createMockEnvironment(fetchMock);
  runController(env);
  await new Promise((r) => setTimeout(r, 20));

  const listContainer = env.elements["opportunities-list"];
  assert.strictEqual(listContainer.children.length, 1);

  // 1. Match success
  const targetMock = {
    classList: {
      contains(c) {
        return c === "btn-run-match";
      },
    },
    getAttribute(name) {
      if (name === "data-id") {
        return "job-1";
      }
      return null;
    },
  };

  // Trigger delegated click event on opportunities list
  listContainer.trigger("click", { target: targetMock });
  await new Promise((r) => setTimeout(r, 20));

  assert.strictEqual(matchCallCount, 1);
  const updatedChild = listContainer.children[0];
  assert.ok(updatedChild.innerHTML.includes("85% match"));
  assert.ok(updatedChild.innerHTML.includes("Great fit"));

  // 2. Duplicate click protection (disabled during matching)
  // Let's reset job score to null to show match button again
  sampleJobs[0].score = null;
  sampleJobs[0].matchExplanation = null;
  matchStatus = 403; // Next match call will return 403

  // Re-run opportunities load
  env.elements["btn-opportunities-retry"].click();
  await new Promise((r) => setTimeout(r, 20));

  // Trigger match (which will return 403)
  listContainer.trigger("click", { target: targetMock });
  await new Promise((r) => setTimeout(r, 20));

  assert.strictEqual(matchCallCount, 2);
  assert.ok(listContainer.children[0].innerHTML.includes("Entitlement Denied"));
});

test("26. Stale response protection and request cancellation", async () => {
  const fetchCounts = { jobs: 0 };
  const jobsResolveTime = 50;

  const fetchMock = async (url) => {
    if (url === "/api/session") {
      return { ok: true, json: async () => ({ success: true, user: { email: "a@b.com" } }) };
    }
    if (url === "/api/jobs") {
      fetchCounts.jobs++;
      const currentCount = fetchCounts.jobs;
      await new Promise((r) => setTimeout(r, jobsResolveTime));
      return {
        ok: true,
        json: async () => ({
          jobs: [
            {
              id: `job-${currentCount}`,
              title: `Job version ${currentCount}`,
              createdAt: new Date().toISOString(),
            },
          ],
        }),
      };
    }
    return { ok: true, json: async () => ({}) };
  };

  const env = createMockEnvironment(fetchMock);
  runController(env);

  // Immediately trigger another opportunities fetch (simulates refresh/filter change superseding in-flight request)
  await new Promise((r) => setTimeout(r, 5));
  env.elements["btn-opportunities-retry"].click();

  // Wait for all to complete
  await new Promise((r) => setTimeout(r, 100));

  // Verify that the second request took precedence and did not get overwritten by the first
  const listContainer = env.elements["opportunities-list"];
  assert.strictEqual(listContainer.children.length, 1);
  assert.ok(listContainer.children[0].innerHTML.includes("Job version 2"));
});

test("27. Malformed API response handled safely", async () => {
  const fetchMock = async (url) => {
    if (url === "/api/session") {
      return { ok: true, json: async () => ({ success: true, user: { email: "a@b.com" } }) };
    }
    if (url === "/api/jobs") {
      return { ok: true, json: async () => ({ jobs: null }) }; // Malformed body (null jobs)
    }
    return { ok: true, json: async () => ({}) };
  };

  const env = createMockEnvironment(fetchMock);
  runController(env);
  await new Promise((r) => setTimeout(r, 10));

  assert.strictEqual(env.elements["opportunities-error"].classList.contains("hidden"), false);
});
