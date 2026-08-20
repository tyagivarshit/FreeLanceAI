import test from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const searchHtmlContent = fs.readFileSync(path.join(__dirname, "search.html"), "utf8");
const searchJsContent = fs.readFileSync(path.join(__dirname, "search.js"), "utf8");

function createMockElement(id, tag = "div", classes = [], attributes = {}) {
  const listeners = {};
  const element = {
    id,
    tagName: tag.toUpperCase(),
    _className: classes.join(" "),
    get className() {
      return this._className;
    },
    set className(val) {
      this._className = val || "";
      this.classList.classes = (val || "").split(" ").filter(Boolean);
    },
    disabled: false,
    value: "",
    _href: "",
    get href() {
      return this._href;
    },
    set href(val) {
      this._href = val || "";
      this.attributes["href"] = this._href;
    },
    textContent: "",
    children: [],
    style: {},
    attributes: { ...attributes },
    classList: {
      classes: [...classes],
      add(c) {
        if (!this.classes.includes(c)) {
          this.classes.push(c);
        }
        element._className = this.classes.join(" ");
      },
      remove(c) {
        this.classes = this.classes.filter((item) => item !== c);
        element._className = this.classes.join(" ");
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
      if (name === "href") {
        this._href = String(value);
      }
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
    focus() {
      this.trigger("focus", {});
    },
    select() {
      this.trigger("select", {});
    },
    blur() {
      this.trigger("blur", {});
    },
    scrollIntoView() {},
    appendChild(child) {
      if (child && Array.isArray(child.children) && !child.tagName) {
        child.children.forEach((fragmentChild) => this.children.push(fragmentChild));
        return child;
      }
      this.children.push(child);
      return child;
    },
    querySelector(selector) {
      return this.querySelectorAll(selector)[0] || null;
    },
    querySelectorAll(selector) {
      const results = [];
      const match = (el) => {
        if (!el || typeof el !== "object") {
          return;
        }
        if (selector.startsWith(".") && el.classList?.contains(selector.slice(1))) {
          results.push(el);
        } else if (selector.startsWith("#") && el.id === selector.slice(1)) {
          results.push(el);
        } else if (selector.toLowerCase() === el.tagName?.toLowerCase()) {
          results.push(el);
        }
        (el.children || []).forEach(match);
      };
      (this.children || []).forEach(match);
      return results;
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
    "search-input",
    "search-clear-btn",
    "search-count",
    "search-idle",
    "search-skeleton",
    "search-results-list",
    "search-empty",
    "search-empty-msg",
    "search-error",
    "search-error-msg",
    "search-error-retry",
    "search-pagination",
    "search-prev-page",
    "search-next-page",
    "search-page-summary",
    "filter-tab-all",
    "filter-tab-client",
    "filter-tab-job",
    "filter-tab-match",
    "filter-tab-timeline",
  ];

  const elements = {};
  ids.forEach((id) => {
    let classes = [];
    let tag = "div";
    const attributes = {};

    if (id.startsWith("filter-tab-")) {
      tag = "button";
      classes = ["search-filter-chip"];
      const type = id.replace("filter-tab-", "").toUpperCase();
      attributes["data-type"] = type === "ALL" ? "" : type;
      if (type === "ALL") {
        classes.push("active");
      }
    } else if (id === "search-input") {
      tag = "input";
    } else if (id.endsWith("-btn") || id.endsWith("-page") || id === "search-error-retry") {
      tag = "button";
    }

    if (
      [
        "search-clear-btn",
        "search-skeleton",
        "search-results-list",
        "search-empty",
        "search-error",
        "search-pagination",
      ].includes(id)
    ) {
      classes.push("hidden");
    }

    elements[id] = createMockElement(id, tag, classes, attributes);
  });

  const filterChips = [
    elements["filter-tab-all"],
    elements["filter-tab-client"],
    elements["filter-tab-job"],
    elements["filter-tab-match"],
    elements["filter-tab-timeline"],
  ];

  const docListeners = {};
  const mockDocument = {
    addEventListener(event, callback) {
      docListeners[event] = docListeners[event] || [];
      docListeners[event].push(callback);
    },
    trigger(event, data = {}) {
      (docListeners[event] || []).forEach((callback) => callback(data));
    },
    getElementById(id) {
      return elements[id] || null;
    },
    querySelectorAll(selector) {
      if (selector === ".search-filter-chip") {
        return filterChips;
      }
      return [];
    },
    createElement(tag) {
      return createMockElement(undefined, tag, []);
    },
    createDocumentFragment() {
      return {
        children: [],
        appendChild(child) {
          this.children.push(child);
        },
      };
    },
    activeElement: null,
    body: {
      classList: {
        classes: [],
        add(c) {
          this.classes.push(c);
        },
        remove(c) {
          this.classes = this.classes.filter((item) => item !== c);
        },
      },
    },
  };

  const mockWindow = {
    location: {
      pathname: "/search.html",
      search,
      href: `/search.html${search}`,
    },
    history: {
      replaceState: (state, title, url) => {
        mockWindow.location.href = url;
        const qIndex = url.indexOf("?");
        mockWindow.location.search = qIndex >= 0 ? url.slice(qIndex) : "";
      },
    },
    matchMedia: () => ({ matches: false }),
    authActions: {
      logout: async () => ({ success: true }),
    },
    addEventListener() {},
  };

  const mockLocalStorage = {
    store: {},
    getItem(key) {
      return this.store[key] || null;
    },
    setItem(key, value) {
      this.store[key] = String(value);
    },
  };

  return {
    elements,
    filterChips,
    document: mockDocument,
    window: mockWindow,
    localStorage: mockLocalStorage,
    fetch: fetchMock,
    runController() {
      const runner = new Function(
        "document",
        "window",
        "localStorage",
        "fetch",
        "URLSearchParams",
        "AbortController",
        "setTimeout",
        "clearTimeout",
        searchJsContent,
      );
      runner(
        mockDocument,
        mockWindow,
        mockLocalStorage,
        fetchMock,
        URLSearchParams,
        AbortController,
        setTimeout,
        clearTimeout,
      );
      mockDocument.trigger("DOMContentLoaded");
    },
  };
}

// ----------------------------------------------------------------------------
// Test Cases 1 - 21
// ----------------------------------------------------------------------------

test("Search UI 1. required search markup", () => {
  assert.ok(searchHtmlContent.includes('id="search-input"'));
  assert.ok(searchHtmlContent.includes('id="search-clear-btn"'));
  assert.ok(searchHtmlContent.includes('id="search-idle"'));
  assert.ok(searchHtmlContent.includes('id="search-skeleton"'));
  assert.ok(searchHtmlContent.includes('id="search-results-list"'));
  assert.ok(searchHtmlContent.includes('id="search-empty"'));
  assert.ok(searchHtmlContent.includes('id="search-error"'));
  assert.ok(searchHtmlContent.includes('id="search-pagination"'));
  assert.ok(searchHtmlContent.includes('data-type="CLIENT"'));
  assert.ok(searchHtmlContent.includes('data-type="JOB"'));
  assert.ok(searchHtmlContent.includes('data-type="MATCH"'));
  assert.ok(searchHtmlContent.includes('data-type="TIMELINE"'));
  assert.ok(!searchHtmlContent.includes('data-type="OPPORTUNITY"'));
});

test("Search UI 2. initial idle state", async () => {
  const fetchCalls = [];
  const env = createMockEnvironment(async (url) => {
    fetchCalls.push(url);
    if (url.includes("/api/session")) {
      return {
        ok: true,
        json: async () => ({ success: true, user: { email: "user@example.com" } }),
      };
    }
    return { ok: true, json: async () => ({ success: true, results: [], total: 0 }) };
  });

  env.runController();
  await new Promise((resolve) => setTimeout(resolve, 50));

  assert.strictEqual(fetchCalls.length, 1);
  assert.ok(fetchCalls[0].includes("/api/session"));
  assert.strictEqual(env.elements["search-idle"].classList.contains("hidden"), false);
  assert.strictEqual(env.elements["search-results-list"].classList.contains("hidden"), true);
});

test("Search UI 3. debounced request", async () => {
  const fetchCalls = [];
  const env = createMockEnvironment(async (url) => {
    fetchCalls.push(url);
    if (url.includes("/api/session")) {
      return {
        ok: true,
        json: async () => ({ success: true, user: { email: "user@example.com" } }),
      };
    }
    return {
      ok: true,
      json: async () => ({
        success: true,
        results: [{ resultType: "CLIENT", entityId: "client-1", display: { title: "Acme" } }],
        total: 1,
        page: 1,
        pageSize: 20,
        totalPages: 1,
        count: 1,
        isEmpty: false,
      }),
    };
  });

  env.runController();
  await new Promise((resolve) => setTimeout(resolve, 50));

  env.elements["search-input"].value = "Acme";
  env.elements["search-input"].trigger("input", { target: { value: "Acme" } });

  // Right after typing, debounce timer has not fired yet
  assert.strictEqual(fetchCalls.length, 1);

  // Wait for 350ms debounce
  await new Promise((resolve) => setTimeout(resolve, 350));

  assert.strictEqual(fetchCalls.length, 2);
  assert.ok(fetchCalls[1].includes("/api/search?q=Acme"));
});

test("Search UI 4. CLIENT filter", async () => {
  const fetchCalls = [];
  const env = createMockEnvironment(
    async (url) => {
      fetchCalls.push(url);
      if (url.includes("/api/session")) {
        return {
          ok: true,
          json: async () => ({ success: true, user: { email: "user@example.com" } }),
        };
      }
      return {
        ok: true,
        json: async () => ({
          success: true,
          results: [],
          total: 0,
          page: 1,
          pageSize: 20,
          totalPages: 0,
        }),
      };
    },
    { search: "?q=test" },
  );

  env.runController();
  await new Promise((resolve) => setTimeout(resolve, 50));

  env.elements["filter-tab-client"].click();
  await new Promise((resolve) => setTimeout(resolve, 50));

  assert.ok(fetchCalls.some((url) => url.includes("resultTypes=CLIENT")));
});

test("Search UI 5. JOB filter", async () => {
  const fetchCalls = [];
  const env = createMockEnvironment(
    async (url) => {
      fetchCalls.push(url);
      if (url.includes("/api/session")) {
        return {
          ok: true,
          json: async () => ({ success: true, user: { email: "user@example.com" } }),
        };
      }
      return {
        ok: true,
        json: async () => ({
          success: true,
          results: [],
          total: 0,
          page: 1,
          pageSize: 20,
          totalPages: 0,
        }),
      };
    },
    { search: "?q=test" },
  );

  env.runController();
  await new Promise((resolve) => setTimeout(resolve, 50));

  env.elements["filter-tab-job"].click();
  await new Promise((resolve) => setTimeout(resolve, 50));

  assert.ok(fetchCalls.some((url) => url.includes("resultTypes=JOB")));
});

test("Search UI 6. MATCH filter", async () => {
  const fetchCalls = [];
  const env = createMockEnvironment(
    async (url) => {
      fetchCalls.push(url);
      if (url.includes("/api/session")) {
        return {
          ok: true,
          json: async () => ({ success: true, user: { email: "user@example.com" } }),
        };
      }
      return {
        ok: true,
        json: async () => ({
          success: true,
          results: [],
          total: 0,
          page: 1,
          pageSize: 20,
          totalPages: 0,
        }),
      };
    },
    { search: "?q=test" },
  );

  env.runController();
  await new Promise((resolve) => setTimeout(resolve, 50));

  env.elements["filter-tab-match"].click();
  await new Promise((resolve) => setTimeout(resolve, 50));

  assert.ok(fetchCalls.some((url) => url.includes("resultTypes=MATCH")));
});

test("Search UI 7. TIMELINE filter", async () => {
  const fetchCalls = [];
  const env = createMockEnvironment(
    async (url) => {
      fetchCalls.push(url);
      if (url.includes("/api/session")) {
        return {
          ok: true,
          json: async () => ({ success: true, user: { email: "user@example.com" } }),
        };
      }
      return {
        ok: true,
        json: async () => ({
          success: true,
          results: [],
          total: 0,
          page: 1,
          pageSize: 20,
          totalPages: 0,
        }),
      };
    },
    { search: "?q=test" },
  );

  env.runController();
  await new Promise((resolve) => setTimeout(resolve, 50));

  env.elements["filter-tab-timeline"].click();
  await new Promise((resolve) => setTimeout(resolve, 50));

  assert.ok(fetchCalls.some((url) => url.includes("resultTypes=TIMELINE")));
});

test("Search UI 8. successful result rendering", async () => {
  const env = createMockEnvironment(
    async (url) => {
      if (url.includes("/api/session")) {
        return {
          ok: true,
          json: async () => ({ success: true, user: { email: "user@example.com" } }),
        };
      }
      return {
        ok: true,
        json: async () => ({
          success: true,
          results: [
            {
              resultType: "CLIENT",
              entityId: "client-123",
              display: {
                title: "Acme Corp",
                subtitle: "Active",
                snippet: "Contact: acme@example.com",
              },
              relevance: { score: 0.95, matchedFields: ["name", "email"] },
            },
          ],
          total: 1,
          page: 1,
          pageSize: 20,
          totalPages: 1,
          count: 1,
          isEmpty: false,
        }),
      };
    },
    { search: "?q=Acme" },
  );

  env.runController();
  await new Promise((resolve) => setTimeout(resolve, 50));

  const list = env.elements["search-results-list"];
  assert.strictEqual(list.classList.contains("hidden"), false);
  assert.strictEqual(list.children.length, 1);
  assert.strictEqual(list.children[0].children[0].href, "/clients/client-123");
});

test("Search UI 9. empty results", async () => {
  const env = createMockEnvironment(
    async (url) => {
      if (url.includes("/api/session")) {
        return {
          ok: true,
          json: async () => ({ success: true, user: { email: "user@example.com" } }),
        };
      }
      return {
        ok: true,
        json: async () => ({
          success: true,
          results: [],
          total: 0,
          page: 1,
          pageSize: 20,
          totalPages: 0,
          count: 0,
          isEmpty: true,
        }),
      };
    },
    { search: "?q=Nonexistent" },
  );

  env.runController();
  await new Promise((resolve) => setTimeout(resolve, 50));

  assert.strictEqual(env.elements["search-empty"].classList.contains("hidden"), false);
  assert.strictEqual(env.elements["search-results-list"].classList.contains("hidden"), true);
});

test("Search UI 10. API error", async () => {
  const env = createMockEnvironment(
    async (url) => {
      if (url.includes("/api/session")) {
        return {
          ok: true,
          json: async () => ({ success: true, user: { email: "user@example.com" } }),
        };
      }
      return {
        ok: false,
        status: 500,
        json: async () => ({ success: false, error: "Search service unavailable" }),
      };
    },
    { search: "?q=error-query" },
  );

  env.runController();
  await new Promise((resolve) => setTimeout(resolve, 50));

  assert.strictEqual(env.elements["search-error"].classList.contains("hidden"), false);
  assert.strictEqual(env.elements["search-error-msg"].textContent, "Search service unavailable");
});

test("Search UI 11. 401 redirect", async () => {
  const env = createMockEnvironment(async (url) => {
    if (url.includes("/api/session")) {
      return { ok: false, status: 401, json: async () => ({ success: false }) };
    }
    return { ok: false, status: 401 };
  });

  env.runController();
  await new Promise((resolve) => setTimeout(resolve, 50));

  assert.strictEqual(env.window.location.href, "/login.html");
});

test("Search UI 12. pagination", async () => {
  const fetchCalls = [];
  const env = createMockEnvironment(
    async (url) => {
      fetchCalls.push(url);
      if (url.includes("/api/session")) {
        return {
          ok: true,
          json: async () => ({ success: true, user: { email: "user@example.com" } }),
        };
      }
      return {
        ok: true,
        json: async () => ({
          success: true,
          results: [{ resultType: "CLIENT", entityId: "c-1", display: { title: "Item" } }],
          total: 45,
          page: 1,
          pageSize: 20,
          totalPages: 3,
          count: 1,
          isEmpty: false,
        }),
      };
    },
    { search: "?q=test" },
  );

  env.runController();
  await new Promise((resolve) => setTimeout(resolve, 50));

  assert.strictEqual(env.elements["search-pagination"].classList.contains("hidden"), false);
  env.elements["search-next-page"].click();
  await new Promise((resolve) => setTimeout(resolve, 50));

  assert.ok(fetchCalls.some((url) => url.includes("page=2")));
});

test("Search UI 13. AbortController cancellation", async () => {
  let abortedCount = 0;
  const env = createMockEnvironment(
    async (url, options) => {
      if (url.includes("/api/session")) {
        return {
          ok: true,
          json: async () => ({ success: true, user: { email: "user@example.com" } }),
        };
      }
      if (options?.signal) {
        options.signal.addEventListener("abort", () => {
          abortedCount++;
        });
      }
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve({
            ok: true,
            json: async () => ({
              success: true,
              results: [],
              total: 0,
              page: 1,
              pageSize: 20,
              totalPages: 0,
            }),
          });
        }, 200);
      });
    },
    { search: "?q=first" },
  );

  env.runController();
  await new Promise((resolve) => setTimeout(resolve, 50));

  // Trigger new search query while first is in flight
  env.elements["search-input"].value = "second";
  env.elements["search-input"].trigger("input", { target: { value: "second" } });
  await new Promise((resolve) => setTimeout(resolve, 350));

  assert.ok(abortedCount >= 1);
});

test("Search UI 14. stale response protection", async () => {
  let delayedFirstResponse = null;
  const env = createMockEnvironment(async (url) => {
    if (url.includes("/api/session")) {
      return {
        ok: true,
        json: async () => ({ success: true, user: { email: "user@example.com" } }),
      };
    }
    if (url.includes("q=slow")) {
      return new Promise((resolve) => {
        delayedFirstResponse = () =>
          resolve({
            ok: true,
            json: async () => ({
              success: true,
              results: [
                { resultType: "CLIENT", entityId: "slow-client", display: { title: "Slow Title" } },
              ],
              total: 1,
              page: 1,
              pageSize: 20,
              totalPages: 1,
            }),
          });
      });
    }
    return {
      ok: true,
      json: async () => ({
        success: true,
        results: [
          { resultType: "CLIENT", entityId: "fast-client", display: { title: "Fast Title" } },
        ],
        total: 1,
        page: 1,
        pageSize: 20,
        totalPages: 1,
      }),
    };
  });

  env.runController();
  await new Promise((resolve) => setTimeout(resolve, 50));

  // 1. Slow search
  env.elements["search-input"].value = "slow";
  env.elements["search-input"].trigger("input", { target: { value: "slow" } });
  await new Promise((resolve) => setTimeout(resolve, 350));

  // 2. Fast search
  env.elements["search-input"].value = "fast";
  env.elements["search-input"].trigger("input", { target: { value: "fast" } });
  await new Promise((resolve) => setTimeout(resolve, 350));

  // Now resolve the delayed first response
  if (delayedFirstResponse) {
    delayedFirstResponse();
  }
  await new Promise((resolve) => setTimeout(resolve, 50));

  // Result list should still show "fast-client"
  const list = env.elements["search-results-list"];
  assert.strictEqual(list.children[0].children[0].href, "/clients/fast-client");
});

test("Search UI 15. Ctrl+K", async () => {
  const env = createMockEnvironment(async () => ({
    ok: true,
    json: async () => ({ success: true, user: { email: "u@e.com" } }),
  }));
  env.runController();
  await new Promise((resolve) => setTimeout(resolve, 50));

  let focused = false;
  env.elements["search-input"].addEventListener("focus", () => {
    focused = true;
  });

  env.document.trigger("keydown", { ctrlKey: true, key: "k", preventDefault: () => {} });
  assert.strictEqual(focused, true);
});

test("Search UI 16. Cmd+K", async () => {
  const env = createMockEnvironment(async () => ({
    ok: true,
    json: async () => ({ success: true, user: { email: "u@e.com" } }),
  }));
  env.runController();
  await new Promise((resolve) => setTimeout(resolve, 50));

  let focused = false;
  env.elements["search-input"].addEventListener("focus", () => {
    focused = true;
  });

  env.document.trigger("keydown", { metaKey: true, key: "k", preventDefault: () => {} });
  assert.strictEqual(focused, true);
});

test("Search UI 17. '/' shortcut", async () => {
  const env = createMockEnvironment(async () => ({
    ok: true,
    json: async () => ({ success: true, user: { email: "u@e.com" } }),
  }));
  env.runController();
  await new Promise((resolve) => setTimeout(resolve, 50));

  let focused = false;
  env.elements["search-input"].addEventListener("focus", () => {
    focused = true;
  });

  env.document.trigger("keydown", { key: "/", preventDefault: () => {} });
  assert.strictEqual(focused, true);
});

test("Search UI 18. Arrow navigation", async () => {
  const env = createMockEnvironment(
    async (url) => {
      if (url.includes("/api/session")) {
        return {
          ok: true,
          json: async () => ({ success: true, user: { email: "user@example.com" } }),
        };
      }
      return {
        ok: true,
        json: async () => ({
          success: true,
          results: [
            { resultType: "CLIENT", entityId: "c-1", display: { title: "First" } },
            { resultType: "JOB", entityId: "j-1", display: { title: "Second" } },
          ],
          total: 2,
          page: 1,
          pageSize: 20,
          totalPages: 1,
          count: 2,
        }),
      };
    },
    { search: "?q=test" },
  );

  env.runController();
  await new Promise((resolve) => setTimeout(resolve, 50));

  const list = env.elements["search-results-list"];
  assert.strictEqual(list.children.length, 2);

  // Arrow down selects first
  env.elements["search-input"].trigger("keydown", { key: "ArrowDown", preventDefault: () => {} });
  assert.strictEqual(list.children[0].classList.contains("selected"), true);

  // Arrow down selects second
  env.elements["search-input"].trigger("keydown", { key: "ArrowDown", preventDefault: () => {} });
  assert.strictEqual(list.children[1].classList.contains("selected"), true);
});

test("Search UI 19. Enter selection", async () => {
  let clickedHref = null;
  const env = createMockEnvironment(
    async (url) => {
      if (url.includes("/api/session")) {
        return {
          ok: true,
          json: async () => ({ success: true, user: { email: "user@example.com" } }),
        };
      }
      return {
        ok: true,
        json: async () => ({
          success: true,
          results: [
            { resultType: "CLIENT", entityId: "c-target", display: { title: "Target Client" } },
          ],
          total: 1,
          page: 1,
          pageSize: 20,
          totalPages: 1,
        }),
      };
    },
    { search: "?q=target" },
  );

  env.runController();
  await new Promise((resolve) => setTimeout(resolve, 50));

  const link = env.elements["search-results-list"].children[0].children[0];
  link.addEventListener("click", () => {
    clickedHref = link.href;
  });

  // Select item then press Enter
  env.elements["search-input"].trigger("keydown", { key: "ArrowDown", preventDefault: () => {} });
  env.elements["search-input"].trigger("keydown", { key: "Enter", preventDefault: () => {} });

  assert.strictEqual(clickedHref, "/clients/c-target");
});

test("Search UI 20. Escape behavior", async () => {
  const env = createMockEnvironment(
    async (url) => {
      if (url.includes("/api/session")) {
        return {
          ok: true,
          json: async () => ({ success: true, user: { email: "user@example.com" } }),
        };
      }
      return {
        ok: true,
        json: async () => ({
          success: true,
          results: [],
          total: 0,
          page: 1,
          pageSize: 20,
          totalPages: 0,
        }),
      };
    },
    { search: "?q=cleartest" },
  );

  env.runController();
  await new Promise((resolve) => setTimeout(resolve, 50));

  assert.strictEqual(env.elements["search-input"].value, "cleartest");

  env.document.activeElement = env.elements["search-input"];
  env.document.trigger("keydown", { key: "Escape" });

  assert.strictEqual(env.elements["search-input"].value, "");
  assert.strictEqual(env.elements["search-idle"].classList.contains("hidden"), false);
});

test("Search UI 21. XSS-safe rendering", async () => {
  const dangerousTitle = "<img src=x onerror=alert(1)>Malicious";
  const dangerousSnippet = "<script>alert('pwned')</script>";

  const env = createMockEnvironment(
    async (url) => {
      if (url.includes("/api/session")) {
        return {
          ok: true,
          json: async () => ({ success: true, user: { email: "user@example.com" } }),
        };
      }
      return {
        ok: true,
        json: async () => ({
          success: true,
          results: [
            {
              resultType: "CLIENT",
              entityId: "client-xss",
              display: { title: dangerousTitle, snippet: dangerousSnippet },
            },
          ],
          total: 1,
          page: 1,
          pageSize: 20,
          totalPages: 1,
        }),
      };
    },
    { search: "?q=xss" },
  );

  env.runController();
  await new Promise((resolve) => setTimeout(resolve, 50));

  const list = env.elements["search-results-list"];
  const titleEl = list.children[0].children[0].children[1];
  const snippetEl = list.children[0].children[0].children[2];

  // Plain textContent assignment ensures no HTML tag injection
  assert.strictEqual(titleEl.textContent, dangerousTitle);
  assert.strictEqual(snippetEl.textContent, dangerousSnippet);
});
