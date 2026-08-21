import test from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const matchingHtmlContent = fs.readFileSync(path.join(__dirname, "matching.html"), "utf8");
const matchingJsContent = fs.readFileSync(path.join(__dirname, "matching.js"), "utf8");

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
      if (name === "id") {
        this.id = String(value);
      }
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
      this.trigger("click", { preventDefault: () => {}, stopPropagation: () => {} });
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
    remove() {
      // noop
    },
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
    "matching-refresh-btn",
    "matching-status-filter",
    "matching-score-filter",
    "matching-platform-filter",
    "matching-count",
    "matching-skeleton",
    "matching-list",
    "matching-empty",
    "matching-empty-msg",
    "matching-error",
    "matching-error-msg",
    "matching-error-retry",
    "matching-pagination",
    "matching-prev-page",
    "matching-next-page",
    "matching-page-summary",
    "matching-detail-modal",
    "matching-detail-backdrop",
    "matching-detail-close-btn",
    "detail-close-bottom-btn",
    "detail-platform-tag",
    "detail-status-badge",
    "detail-cache-badge",
    "detail-title",
    "detail-score-val",
    "breakdown-skills-val",
    "breakdown-skills-bar",
    "breakdown-semantic-val",
    "breakdown-semantic-bar",
    "breakdown-exp-tag",
    "breakdown-budget-tag",
    "breakdown-jobtype-tag",
    "breakdown-location-tag",
    "detail-explanation-text",
    "detail-strengths-list",
    "detail-gaps-list",
    "detail-risks-text",
    "detail-recommendations-text",
    "detail-job-budget",
    "detail-job-description",
    "detail-platform-link",
    "detail-archive-btn",
  ];

  const elements = {};
  ids.forEach((id) => {
    const classes = [];
    let tag = "div";

    if (id.endsWith("-filter")) {
      tag = "select";
    } else if (id.endsWith("-btn") || id.endsWith("-page") || id === "matching-error-retry") {
      tag = "button";
    }

    if (
      [
        "matching-skeleton",
        "matching-list",
        "matching-empty",
        "matching-error",
        "matching-pagination",
        "matching-detail-modal",
      ].includes(id)
    ) {
      classes.push("hidden");
    }

    elements[id] = createMockElement(id, tag, classes);
  });

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
    querySelectorAll() {
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
      pathname: "/matching.html",
      search,
      href: `/matching.html${search}`,
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
        matchingJsContent,
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

const sampleMatch = {
  id: "match-101",
  jobId: "job-202",
  jobTitle: "Senior TypeScript Fullstack Engineer",
  jobDescription:
    "Looking for an expert TypeScript & Node.js engineer for scalable backend systems.",
  platform: "Upwork",
  canonicalUrl: "https://upwork.com/jobs/101",
  budget: "$80 - $120 / hr",
  score: 92,
  scoreBreakdown: {
    skills: 0.95,
    semantic: 0.9,
    experience: "COMPATIBLE",
    budget: "COMPATIBLE",
    jobType: "COMPATIBLE",
    location: "COMPATIBLE",
  },
  matchSignals: {
    matchedSkills: ["TypeScript", "Node.js", "PostgreSQL"],
    missingSkills: ["Docker"],
    skillCoverage: 0.95,
  },
  explanation: "Strong fit with matched skills: TypeScript, Node.js, PostgreSQL.",
  strengths: ["TypeScript", "Node.js", "PostgreSQL"],
  gaps: ["Docker"],
  risks: "No significant compatibility risks identified.",
  recommendations: "High priority match: highlight core skill strengths in proposal.",
  status: "EVALUATED",
  cacheState: "CACHED",
  createdAt: "2026-08-20T10:00:00.000Z",
  updatedAt: "2026-08-20T10:00:00.000Z",
};

// ----------------------------------------------------------------------------
// Test Cases 1 - 26
// ----------------------------------------------------------------------------

test("Matching UI 1. matching page markup", () => {
  assert.ok(matchingHtmlContent.includes('id="matching-status-filter"'));
  assert.ok(matchingHtmlContent.includes('id="matching-score-filter"'));
  assert.ok(matchingHtmlContent.includes('id="matching-platform-filter"'));
  assert.ok(matchingHtmlContent.includes('id="matching-skeleton"'));
  assert.ok(matchingHtmlContent.includes('id="matching-list"'));
  assert.ok(matchingHtmlContent.includes('id="matching-empty"'));
  assert.ok(matchingHtmlContent.includes('id="matching-error"'));
  assert.ok(matchingHtmlContent.includes('id="matching-pagination"'));
  assert.ok(matchingHtmlContent.includes('id="matching-detail-modal"'));
});

test("Matching UI 2. authentication guard", async () => {
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

test("Matching UI 3. initial loading", async () => {
  const env = createMockEnvironment(async (url) => {
    if (url.includes("/api/session")) {
      return {
        ok: true,
        json: async () => ({ success: true, user: { email: "dev@example.com" } }),
      };
    }
    return {
      ok: true,
      json: async () => ({
        success: true,
        matches: [sampleMatch],
        total: 1,
        page: 1,
        pageSize: 20,
      }),
    };
  });

  env.runController();
  await new Promise((resolve) => setTimeout(resolve, 50));

  assert.strictEqual(env.elements["matching-skeleton"].classList.contains("hidden"), true);
  assert.strictEqual(env.elements["matching-list"].classList.contains("hidden"), false);
});

test("Matching UI 4. successful match list", async () => {
  const env = createMockEnvironment(async (url) => {
    if (url.includes("/api/session")) {
      return {
        ok: true,
        json: async () => ({ success: true, user: { email: "dev@example.com" } }),
      };
    }
    return {
      ok: true,
      json: async () => ({
        success: true,
        matches: [sampleMatch],
        total: 1,
        page: 1,
        pageSize: 20,
      }),
    };
  });

  env.runController();
  await new Promise((resolve) => setTimeout(resolve, 50));

  const list = env.elements["matching-list"];
  assert.strictEqual(list.children.length, 1);
  assert.strictEqual(list.children[0].id, "match-card-match-101");
});

test("Matching UI 5. score rendering", async () => {
  const env = createMockEnvironment(async (url) => {
    if (url.includes("/api/session")) {
      return {
        ok: true,
        json: async () => ({ success: true, user: { email: "dev@example.com" } }),
      };
    }
    return {
      ok: true,
      json: async () => ({ success: true, matches: [sampleMatch], total: 1 }),
    };
  });

  env.runController();
  await new Promise((resolve) => setTimeout(resolve, 50));

  const card = env.elements["matching-list"].children[0];
  const scoreBadge = card.querySelector(".matching-card-score");
  assert.strictEqual(scoreBadge.textContent, "92% Match");
});

test("Matching UI 6. score breakdown rendering", async () => {
  const env = createMockEnvironment(async (url) => {
    if (url.includes("/api/session")) {
      return {
        ok: true,
        json: async () => ({ success: true, user: { email: "dev@example.com" } }),
      };
    }
    return {
      ok: true,
      json: async () => ({ success: true, matches: [sampleMatch], total: 1 }),
    };
  });

  env.runController();
  await new Promise((resolve) => setTimeout(resolve, 50));

  // Open modal for sample match
  const card = env.elements["matching-list"].children[0];
  card.click();

  assert.strictEqual(env.elements["breakdown-skills-val"].textContent, "95%");
  assert.strictEqual(env.elements["breakdown-exp-tag"].textContent, "COMPATIBLE");
  assert.strictEqual(env.elements["breakdown-budget-tag"].textContent, "COMPATIBLE");
});

test("Matching UI 7. explanation rendering", async () => {
  const env = createMockEnvironment(async (url) => {
    if (url.includes("/api/session")) {
      return {
        ok: true,
        json: async () => ({ success: true, user: { email: "dev@example.com" } }),
      };
    }
    return {
      ok: true,
      json: async () => ({ success: true, matches: [sampleMatch], total: 1 }),
    };
  });

  env.runController();
  await new Promise((resolve) => setTimeout(resolve, 50));

  const card = env.elements["matching-list"].children[0];
  const explanation = card.querySelector(".matching-card-explanation");
  assert.ok(explanation.textContent.includes("Strong fit with matched skills"));
});

test("Matching UI 8. strengths rendering", async () => {
  const env = createMockEnvironment(async (url) => {
    if (url.includes("/api/session")) {
      return {
        ok: true,
        json: async () => ({ success: true, user: { email: "dev@example.com" } }),
      };
    }
    return {
      ok: true,
      json: async () => ({ success: true, matches: [sampleMatch], total: 1 }),
    };
  });

  env.runController();
  await new Promise((resolve) => setTimeout(resolve, 50));

  const card = env.elements["matching-list"].children[0];
  const strengths = card.querySelectorAll(".factor-chip-strength");
  assert.strictEqual(strengths.length, 3);
  assert.strictEqual(strengths[0].textContent, "TypeScript");
});

test("Matching UI 9. gaps rendering", async () => {
  const env = createMockEnvironment(async (url) => {
    if (url.includes("/api/session")) {
      return {
        ok: true,
        json: async () => ({ success: true, user: { email: "dev@example.com" } }),
      };
    }
    return {
      ok: true,
      json: async () => ({ success: true, matches: [sampleMatch], total: 1 }),
    };
  });

  env.runController();
  await new Promise((resolve) => setTimeout(resolve, 50));

  const card = env.elements["matching-list"].children[0];
  const gaps = card.querySelectorAll(".factor-chip-gap");
  assert.strictEqual(gaps.length, 1);
  assert.strictEqual(gaps[0].textContent, "Docker");
});

test("Matching UI 10. risks rendering", async () => {
  const env = createMockEnvironment(async (url) => {
    if (url.includes("/api/session")) {
      return {
        ok: true,
        json: async () => ({ success: true, user: { email: "dev@example.com" } }),
      };
    }
    return {
      ok: true,
      json: async () => ({ success: true, matches: [sampleMatch], total: 1 }),
    };
  });

  env.runController();
  await new Promise((resolve) => setTimeout(resolve, 50));

  const card = env.elements["matching-list"].children[0];
  card.click();

  assert.strictEqual(env.elements["detail-risks-text"].textContent, sampleMatch.risks);
});

test("Matching UI 11. recommendations rendering", async () => {
  const env = createMockEnvironment(async (url) => {
    if (url.includes("/api/session")) {
      return {
        ok: true,
        json: async () => ({ success: true, user: { email: "dev@example.com" } }),
      };
    }
    return {
      ok: true,
      json: async () => ({ success: true, matches: [sampleMatch], total: 1 }),
    };
  });

  env.runController();
  await new Promise((resolve) => setTimeout(resolve, 50));

  const card = env.elements["matching-list"].children[0];
  card.click();

  assert.strictEqual(
    env.elements["detail-recommendations-text"].textContent,
    sampleMatch.recommendations,
  );
});

test("Matching UI 12. status filtering", async () => {
  const fetchCalls = [];
  const env = createMockEnvironment(async (url) => {
    fetchCalls.push(url);
    if (url.includes("/api/session")) {
      return {
        ok: true,
        json: async () => ({ success: true, user: { email: "dev@example.com" } }),
      };
    }
    return { ok: true, json: async () => ({ success: true, matches: [], total: 0 }) };
  });

  env.runController();
  await new Promise((resolve) => setTimeout(resolve, 50));

  env.elements["matching-status-filter"].value = "EVALUATED";
  env.elements["matching-status-filter"].trigger("change", { target: { value: "EVALUATED" } });
  await new Promise((resolve) => setTimeout(resolve, 50));

  assert.ok(fetchCalls.some((url) => url.includes("status=EVALUATED")));
});

test("Matching UI 13. score filtering", async () => {
  const fetchCalls = [];
  const env = createMockEnvironment(async (url) => {
    fetchCalls.push(url);
    if (url.includes("/api/session")) {
      return {
        ok: true,
        json: async () => ({ success: true, user: { email: "dev@example.com" } }),
      };
    }
    return { ok: true, json: async () => ({ success: true, matches: [], total: 0 }) };
  });

  env.runController();
  await new Promise((resolve) => setTimeout(resolve, 50));

  env.elements["matching-score-filter"].value = "90";
  env.elements["matching-score-filter"].trigger("change", { target: { value: "90" } });
  await new Promise((resolve) => setTimeout(resolve, 50));

  assert.ok(fetchCalls.some((url) => url.includes("minScore=90")));
});

test("Matching UI 14. platform filtering", async () => {
  const fetchCalls = [];
  const env = createMockEnvironment(async (url) => {
    fetchCalls.push(url);
    if (url.includes("/api/session")) {
      return {
        ok: true,
        json: async () => ({ success: true, user: { email: "dev@example.com" } }),
      };
    }
    return { ok: true, json: async () => ({ success: true, matches: [], total: 0 }) };
  });

  env.runController();
  await new Promise((resolve) => setTimeout(resolve, 50));

  env.elements["matching-platform-filter"].value = "upwork";
  env.elements["matching-platform-filter"].trigger("change", { target: { value: "upwork" } });
  await new Promise((resolve) => setTimeout(resolve, 50));

  assert.ok(fetchCalls.some((url) => url.includes("platform=upwork")));
});

test("Matching UI 15. pagination", async () => {
  const fetchCalls = [];
  const env = createMockEnvironment(async (url) => {
    fetchCalls.push(url);
    if (url.includes("/api/session")) {
      return {
        ok: true,
        json: async () => ({ success: true, user: { email: "dev@example.com" } }),
      };
    }
    return {
      ok: true,
      json: async () => ({
        success: true,
        matches: [sampleMatch],
        total: 45,
        page: 1,
        pageSize: 20,
        totalPages: 3,
      }),
    };
  });

  env.runController();
  await new Promise((resolve) => setTimeout(resolve, 50));

  assert.strictEqual(env.elements["matching-pagination"].classList.contains("hidden"), false);
  env.elements["matching-next-page"].click();
  await new Promise((resolve) => setTimeout(resolve, 50));

  assert.ok(fetchCalls.some((url) => url.includes("page=2")));
});

test("Matching UI 16. URL state synchronization", async () => {
  const env = createMockEnvironment(
    async (url) => {
      if (url.includes("/api/session")) {
        return {
          ok: true,
          json: async () => ({ success: true, user: { email: "dev@example.com" } }),
        };
      }
      return { ok: true, json: async () => ({ success: true, matches: [], total: 0 }) };
    },
    { search: "?status=EVALUATED&minScore=75&platform=linkedin&page=2" },
  );

  env.runController();
  await new Promise((resolve) => setTimeout(resolve, 50));

  assert.strictEqual(env.elements["matching-status-filter"].value, "EVALUATED");
  assert.strictEqual(env.elements["matching-score-filter"].value, "75");
  assert.strictEqual(env.elements["matching-platform-filter"].value, "linkedin");
});

test("Matching UI 17. match detail opening", async () => {
  const env = createMockEnvironment(async (url) => {
    if (url.includes("/api/session")) {
      return {
        ok: true,
        json: async () => ({ success: true, user: { email: "dev@example.com" } }),
      };
    }
    return {
      ok: true,
      json: async () => ({ success: true, matches: [sampleMatch], total: 1 }),
    };
  });

  env.runController();
  await new Promise((resolve) => setTimeout(resolve, 50));

  const card = env.elements["matching-list"].children[0];
  card.click();

  assert.strictEqual(env.elements["matching-detail-modal"].classList.contains("hidden"), false);
  assert.strictEqual(env.elements["detail-title"].textContent, sampleMatch.jobTitle);
});

test("Matching UI 18. match detail closing", async () => {
  const env = createMockEnvironment(async (url) => {
    if (url.includes("/api/session")) {
      return {
        ok: true,
        json: async () => ({ success: true, user: { email: "dev@example.com" } }),
      };
    }
    return {
      ok: true,
      json: async () => ({ success: true, matches: [sampleMatch], total: 1 }),
    };
  });

  env.runController();
  await new Promise((resolve) => setTimeout(resolve, 50));

  const card = env.elements["matching-list"].children[0];
  card.click();
  assert.strictEqual(env.elements["matching-detail-modal"].classList.contains("hidden"), false);

  env.elements["matching-detail-close-btn"].click();
  assert.strictEqual(env.elements["matching-detail-modal"].classList.contains("hidden"), true);
});

test("Matching UI 19. archive action", async () => {
  let patchCalled = false;
  const env = createMockEnvironment(async (url, options) => {
    if (url.includes("/api/session")) {
      return {
        ok: true,
        json: async () => ({ success: true, user: { email: "dev@example.com" } }),
      };
    }
    if (options?.method === "PATCH") {
      patchCalled = true;
      return {
        ok: true,
        json: async () => ({
          success: true,
          match: { ...sampleMatch, status: "ARCHIVED" },
        }),
      };
    }
    return {
      ok: true,
      json: async () => ({ success: true, matches: [sampleMatch], total: 1 }),
    };
  });

  env.runController();
  await new Promise((resolve) => setTimeout(resolve, 50));

  const card = env.elements["matching-list"].children[0];
  const archiveBtn = card.querySelector(".btn-archive");
  archiveBtn.click();
  await new Promise((resolve) => setTimeout(resolve, 50));

  assert.strictEqual(patchCalled, true);
});

test("Matching UI 20. safe platform URL handling", async () => {
  const matchWithBadUrl = {
    ...sampleMatch,
    canonicalUrl: "javascript:alert('xss')",
  };

  const env = createMockEnvironment(async (url) => {
    if (url.includes("/api/session")) {
      return {
        ok: true,
        json: async () => ({ success: true, user: { email: "dev@example.com" } }),
      };
    }
    return {
      ok: true,
      json: async () => ({ success: true, matches: [matchWithBadUrl], total: 1 }),
    };
  });

  env.runController();
  await new Promise((resolve) => setTimeout(resolve, 50));

  const card = env.elements["matching-list"].children[0];
  const platformLink = card.querySelector("a[target='_blank']");
  // Bad protocol link is rejected and omitted from card actions
  assert.strictEqual(platformLink, null);
});

test("Matching UI 21. AbortController cancellation", async () => {
  let aborted = false;
  const env = createMockEnvironment(async (url, options) => {
    if (url.includes("/api/session")) {
      return {
        ok: true,
        json: async () => ({ success: true, user: { email: "dev@example.com" } }),
      };
    }
    if (options?.signal) {
      options.signal.addEventListener("abort", () => {
        aborted = true;
      });
    }
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({ ok: true, json: async () => ({ success: true, matches: [], total: 0 }) });
      }, 200);
    });
  });

  env.runController();
  await new Promise((resolve) => setTimeout(resolve, 50));

  // Change filter while request in flight
  env.elements["matching-status-filter"].trigger("change", { target: { value: "ARCHIVED" } });
  await new Promise((resolve) => setTimeout(resolve, 50));

  assert.strictEqual(aborted, true);
});

test("Matching UI 22. stale response protection", async () => {
  let delayedResponse = null;
  const env = createMockEnvironment(async (url) => {
    if (url.includes("/api/session")) {
      return {
        ok: true,
        json: async () => ({ success: true, user: { email: "dev@example.com" } }),
      };
    }
    if (url.includes("status=CREATED")) {
      return new Promise((resolve) => {
        delayedResponse = () =>
          resolve({
            ok: true,
            json: async () => ({
              success: true,
              matches: [{ ...sampleMatch, jobTitle: "Slow Match" }],
              total: 1,
            }),
          });
      });
    }
    return {
      ok: true,
      json: async () => ({
        success: true,
        matches: [{ ...sampleMatch, jobTitle: "Fast Match" }],
        total: 1,
      }),
    };
  });

  env.runController();
  await new Promise((resolve) => setTimeout(resolve, 50));

  // 1. Slow request
  env.elements["matching-status-filter"].trigger("change", { target: { value: "CREATED" } });
  await new Promise((resolve) => setTimeout(resolve, 20));

  // 2. Fast request
  env.elements["matching-status-filter"].trigger("change", { target: { value: "EVALUATED" } });
  await new Promise((resolve) => setTimeout(resolve, 50));

  // Resolve slow response
  if (delayedResponse) {
    delayedResponse();
  }
  await new Promise((resolve) => setTimeout(resolve, 50));

  // Card should show "Fast Match"
  const card = env.elements["matching-list"].children[0];
  const title = card.querySelector(".matching-card-title");
  assert.strictEqual(title.textContent, "Fast Match");
});

test("Matching UI 23. empty state", async () => {
  const env = createMockEnvironment(async (url) => {
    if (url.includes("/api/session")) {
      return {
        ok: true,
        json: async () => ({ success: true, user: { email: "dev@example.com" } }),
      };
    }
    return {
      ok: true,
      json: async () => ({ success: true, matches: [], total: 0 }),
    };
  });

  env.runController();
  await new Promise((resolve) => setTimeout(resolve, 50));

  assert.strictEqual(env.elements["matching-empty"].classList.contains("hidden"), false);
  assert.strictEqual(env.elements["matching-list"].classList.contains("hidden"), true);
});

test("Matching UI 24. error state", async () => {
  const env = createMockEnvironment(async (url) => {
    if (url.includes("/api/session")) {
      return {
        ok: true,
        json: async () => ({ success: true, user: { email: "dev@example.com" } }),
      };
    }
    return {
      ok: false,
      status: 500,
      json: async () => ({ success: false, error: "Matching service unavailable" }),
    };
  });

  env.runController();
  await new Promise((resolve) => setTimeout(resolve, 50));

  assert.strictEqual(env.elements["matching-error"].classList.contains("hidden"), false);
  assert.strictEqual(
    env.elements["matching-error-msg"].textContent,
    "Matching service unavailable",
  );
});

test("Matching UI 25. XSS-safe rendering", async () => {
  const dangerousMatch = {
    ...sampleMatch,
    jobTitle: "<img src=x onerror=alert(1)>Exploit Title",
    explanation: "<script>alert('pwned')</script>Safe text",
  };

  const env = createMockEnvironment(async (url) => {
    if (url.includes("/api/session")) {
      return {
        ok: true,
        json: async () => ({ success: true, user: { email: "dev@example.com" } }),
      };
    }
    return {
      ok: true,
      json: async () => ({ success: true, matches: [dangerousMatch], total: 1 }),
    };
  });

  env.runController();
  await new Promise((resolve) => setTimeout(resolve, 50));

  const card = env.elements["matching-list"].children[0];
  const title = card.querySelector(".matching-card-title");
  const explanation = card.querySelector(".matching-card-explanation");

  assert.strictEqual(title.textContent, dangerousMatch.jobTitle);
  assert.strictEqual(explanation.textContent, dangerousMatch.explanation);
});

test("Matching UI 26. keyboard accessibility", async () => {
  const env = createMockEnvironment(async (url) => {
    if (url.includes("/api/session")) {
      return {
        ok: true,
        json: async () => ({ success: true, user: { email: "dev@example.com" } }),
      };
    }
    return {
      ok: true,
      json: async () => ({ success: true, matches: [sampleMatch], total: 1 }),
    };
  });

  env.runController();
  await new Promise((resolve) => setTimeout(resolve, 50));

  const card = env.elements["matching-list"].children[0];
  env.document.activeElement = card;
  card.trigger("keydown", { key: "Enter" });

  assert.strictEqual(env.elements["matching-detail-modal"].classList.contains("hidden"), false);

  env.document.trigger("keydown", { key: "Escape" });
  assert.strictEqual(env.elements["matching-detail-modal"].classList.contains("hidden"), true);
});
