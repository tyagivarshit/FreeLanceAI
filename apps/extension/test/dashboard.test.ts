/* eslint-disable @typescript-eslint/no-explicit-any */
import { test, describe, beforeEach, before } from "node:test";
import assert from "node:assert";

// 1. MOCK ENVIRONMENT SETUP (Runs before importing options.js)
const mockElements = new Map<string, any>();
const globalListeners = new Map<string, any[]>();

class MockClassList {
  public classes = new Set<string>();
  add(c: string) {
    this.classes.add(c);
  }
  remove(c: string) {
    this.classes.delete(c);
  }
  contains(c: string) {
    return this.classes.has(c);
  }
}

class MockElement {
  public textContent = "";
  public className = "";
  public classList = new MockClassList();
  public attributes = new Map<string, string>();
  public listeners = new Map<string, any[]>();
  public children: MockElement[] = [];
  public value = "";

  constructor(public id: string = "") {}

  private _innerHTML = "";
  public get innerHTML(): string {
    return this._innerHTML;
  }
  public set innerHTML(val: string) {
    this._innerHTML = val;
    if (val === "") {
      this.children = [];
      this.textContent = "";
    }
  }

  setAttribute(name: string, val: string) {
    this.attributes.set(name, val);
  }
  getAttribute(name: string) {
    return this.attributes.get(name) || null;
  }
  removeAttribute(name: string) {
    this.attributes.delete(name);
  }
  addEventListener(event: string, cb: any) {
    let arr = this.listeners.get(event);
    if (!arr) {
      arr = [];
      this.listeners.set(event, arr);
    }
    arr.push(cb);
  }
  appendChild(child: any) {
    this.children.push(child);
  }
  querySelector(selector: string) {
    if (selector === ".status-dot") {
      return new MockElement("status-dot");
    }
    return new MockElement();
  }
}

// Reset DOM Elements Helper
function resetMockElements() {
  mockElements.clear();
  globalListeners.clear();
}

// Setup Global Browser Mocks
(global as any).document = {
  getElementById(id: string) {
    if (!mockElements.has(id)) {
      mockElements.set(id, new MockElement(id));
    }
    return mockElements.get(id);
  },
  createElement(tag: string) {
    return new MockElement(tag);
  },
  addEventListener(event: string, cb: any) {
    let arr = globalListeners.get(event);
    if (!arr) {
      arr = [];
      globalListeners.set(event, arr);
    }
    arr.push(cb);
  },
};

(global as any).window = {
  addEventListener(event: string, cb: any) {
    let arr = globalListeners.get(event);
    if (!arr) {
      arr = [];
      globalListeners.set(event, arr);
    }
    arr.push(cb);
  },
};

Object.defineProperty(global, "navigator", {
  value: {
    onLine: true,
  },
  configurable: true,
  writable: true,
});

// Mock Chrome runtime API
let chromeMessageMock: (message: any, callback: (response: any) => void) => void = () => {};
(global as any).chrome = {
  runtime: {
    sendMessage(message: any, callback: any) {
      chromeMessageMock(message, callback);
    },
  },
};

// Declare typed variable for DashboardUI
let DashboardUI: any;

describe("Chapter 9F — Chrome Extension Dashboard & Architectural Verification", () => {
  before(async () => {
    // Dynamic import to allow browser global mocks to be initialized first
    const module = await import("../src/options.js");
    DashboardUI = module.DashboardUI;
  });

  beforeEach(() => {
    resetMockElements();
    Object.defineProperty(global.navigator, "onLine", { value: true, configurable: true });
  });

  // Test 1: Loading & Empty States
  test("Dashboard transition state checks during loading", async () => {
    const ui = new DashboardUI();

    chromeMessageMock = (msg, callback) => {
      assert.strictEqual(msg.type, "GET_DASHBOARD_JOBS");
      setTimeout(() => {
        callback({
          protocolVersion: "1.0",
          messageId: "res-1",
          correlationId: msg.messageId,
          type: "GET_DASHBOARD_JOBS_RESPONSE",
          timestamp: Date.now(),
          payload: [],
        });
      }, 5);
    };

    const promise = ui.initialize();

    const listSkeleton = mockElements.get("list-skeleton");
    assert.ok(!listSkeleton.classList.contains("hidden"));

    await promise;

    const listEmpty = mockElements.get("list-empty-state");
    assert.ok(!listEmpty.classList.contains("hidden"));
  });

  // Test 2: Renders from Supplied DTO results only
  test("Dashboard consumes and renders supplied match score and explanation directly", async () => {
    const ui = new DashboardUI();
    const mockJobs = [
      {
        id: "job-1",
        platform: "upwork",
        title: "Staff Go Engineer",
        url: "https://upwork.com/jobs/1",
        company: "Google",
        location: "Mountain View",
        budget: "$120/hr",
        skills: ["go"],
        importedAt: Date.now(),
        matchResult: {
          score: 95,
          explanation: "Authoritative explanation text from Phase 8",
          skillCoverage: 0.9,
          experienceCompatibility: "COMPATIBLE",
          budgetCompatibility: "COMPATIBLE",
          locationCompatibility: "PARTIAL",
        },
      },
    ];

    chromeMessageMock = (msg, callback) => {
      if (msg.type === "GET_DASHBOARD_JOBS") {
        callback({
          protocolVersion: "1.0",
          messageId: "res-2",
          correlationId: msg.messageId,
          type: "GET_DASHBOARD_JOBS_RESPONSE",
          timestamp: Date.now(),
          payload: mockJobs,
        });
      } else if (msg.type === "GET_JOB_DETAILS") {
        callback({
          protocolVersion: "1.0",
          messageId: "res-3",
          correlationId: msg.messageId,
          type: "GET_JOB_DETAILS_RESPONSE",
          timestamp: Date.now(),
          payload: mockJobs[0],
        });
      }
    };

    await ui.initialize();

    // Verify match score displays exactly the supplied value
    const scoreBadge = mockElements.get("job-detail-score");
    assert.strictEqual(scoreBadge.textContent, "Match: 95%");

    // Verify explanation displays exactly the supplied text
    const explanationText = mockElements.get("job-match-explanation");
    assert.strictEqual(explanationText.textContent, "Authoritative explanation text from Phase 8");
  });

  // Test 3: Local Filtration & Search
  test("Filters and searches results client-side", async () => {
    const ui = new DashboardUI();
    const mockJobs = [
      {
        id: "job-upwork",
        platform: "upwork",
        title: "Upwork Job",
        url: "https://upwork.com/jobs/1",
        skills: ["go"],
      },
      {
        id: "job-linkedin",
        platform: "linkedin",
        title: "LinkedIn Job",
        url: "https://linkedin.com/jobs/2",
        skills: ["rust"],
      },
    ];

    chromeMessageMock = (msg, callback) => {
      if (msg.type === "GET_DASHBOARD_JOBS") {
        callback({
          protocolVersion: "1.0",
          messageId: "res-jobs",
          correlationId: msg.messageId,
          type: "GET_DASHBOARD_JOBS_RESPONSE",
          timestamp: Date.now(),
          payload: mockJobs,
        });
      } else if (msg.type === "GET_JOB_DETAILS") {
        const found = mockJobs.find((j) => j.id === msg.payload.jobId);
        callback({
          protocolVersion: "1.0",
          messageId: "res-details",
          correlationId: msg.messageId,
          type: "GET_JOB_DETAILS_RESPONSE",
          timestamp: Date.now(),
          payload: found,
        });
      }
    };

    await ui.initialize();

    const listItems = mockElements.get("job-list-items") as MockElement;
    assert.strictEqual(listItems.children.length, 2);

    // Apply filter
    const filterUpworkBtn = mockElements.get("filter-upwork");
    const clickHandler = filterUpworkBtn.listeners.get("click")?.[0];
    assert.ok(clickHandler);
    await clickHandler();
    assert.strictEqual(listItems.children.length, 1);
  });

  // Test 4: Strict Missing Value Semantics
  test("Undefined fields remain undefined in DTO and only default in presentation layer", async () => {
    const ui = new DashboardUI();
    const incompleteJob: any = {
      id: "incomplete-1",
      platform: "upwork",
      title: "Incomplete Job",
      url: "https://upwork.com/jobs/incomplete",
      company: undefined, // Remains undefined in DTO
      location: undefined, // Remains undefined in DTO
      budget: undefined, // Remains undefined in DTO
      matchResult: undefined, // Remains undefined in DTO
    };

    chromeMessageMock = (msg, callback) => {
      if (msg.type === "GET_DASHBOARD_JOBS") {
        callback({
          protocolVersion: "1.0",
          messageId: "res-inc-1",
          correlationId: msg.messageId,
          type: "GET_DASHBOARD_JOBS_RESPONSE",
          payload: [incompleteJob],
        });
      } else if (msg.type === "GET_JOB_DETAILS") {
        callback({
          protocolVersion: "1.0",
          messageId: "res-inc-2",
          correlationId: msg.messageId,
          type: "GET_JOB_DETAILS_RESPONSE",
          payload: incompleteJob,
        });
      }
    };

    await ui.initialize();

    // Verify DTO fields remained undefined (we did not mutate business data)
    assert.strictEqual(incompleteJob.company, undefined);
    assert.strictEqual(incompleteJob.location, undefined);
    assert.strictEqual(incompleteJob.budget, undefined);
    assert.strictEqual(incompleteJob.matchResult, undefined);

    // Verify presentation layers rendered "Not provided" or did not fabricate values
    const detailLocation = mockElements.get("job-detail-location");
    assert.strictEqual(detailLocation.textContent, "Not provided");

    const detailBudget = mockElements.get("job-detail-budget");
    assert.strictEqual(detailBudget.textContent, "Not provided");

    const scoreBadge = mockElements.get("job-detail-score");
    assert.ok(
      scoreBadge.classList.contains("hidden"),
      "Score should be hidden when matchResult is missing",
    );
  });

  // Test 5: Safe URL schemes
  test("Unsafe URL protocol verification works and rejects javascript redirect schemes", async () => {
    const ui = new DashboardUI();
    const badJob = {
      id: "job-bad",
      platform: "upwork",
      title: "Bad Job",
      url: "javascript:alert('Exploit')",
      importedAt: Date.now(),
    };

    chromeMessageMock = (msg, callback) => {
      if (msg.type === "GET_DASHBOARD_JOBS") {
        callback({
          protocolVersion: "1.0",
          payload: [badJob],
          correlationId: msg.messageId,
          messageId: "res-bad",
          type: "GET_DASHBOARD_JOBS_RESPONSE",
        });
      } else if (msg.type === "GET_JOB_DETAILS") {
        callback({
          protocolVersion: "1.0",
          payload: badJob,
          correlationId: msg.messageId,
          messageId: "res-bad-details",
          type: "GET_JOB_DETAILS_RESPONSE",
        });
      }
    };

    await ui.initialize();

    const link = mockElements.get("job-source-link");
    assert.ok(link.classList.contains("hidden"), "Unsafe link should be hidden");
    assert.strictEqual(link.getAttribute("href"), null);
  });

  // Test 6: Safe Text Content Rendering (XSS)
  test("Prevents HTML injection by executing safe textContent bindings on all metadata fields", async () => {
    const ui = new DashboardUI();
    const maliciousJob = {
      id: "job-xss",
      platform: "upwork",
      title: "<script>alert(1)</script>",
      url: "https://upwork.com/jobs/xss",
      description: "<img src=x onerror=alert(1)>",
      company: "<div class='injected'>Hack</div>",
      location: "<iframe src='javascript:alert(1)'></iframe>",
      budget: "<svg onload=alert(1)>",
    };

    chromeMessageMock = (msg, callback) => {
      if (msg.type === "GET_DASHBOARD_JOBS") {
        callback({
          protocolVersion: "1.0",
          payload: [maliciousJob],
          correlationId: msg.messageId,
          messageId: "res-xss-1",
          type: "GET_DASHBOARD_JOBS_RESPONSE",
        });
      } else if (msg.type === "GET_JOB_DETAILS") {
        callback({
          protocolVersion: "1.0",
          payload: maliciousJob,
          correlationId: msg.messageId,
          messageId: "res-xss-2",
          type: "GET_JOB_DETAILS_RESPONSE",
        });
      }
    };

    await ui.initialize();

    const detailTitle = mockElements.get("job-detail-title");
    assert.strictEqual(detailTitle.textContent, maliciousJob.title);

    const detailDesc = mockElements.get("job-detail-description");
    assert.strictEqual(detailDesc.textContent, maliciousJob.description);

    const detailLocation = mockElements.get("job-detail-location");
    assert.strictEqual(detailLocation.textContent, maliciousJob.location);

    const detailBudget = mockElements.get("job-detail-budget");
    assert.strictEqual(detailBudget.textContent, maliciousJob.budget);
  });

  // Test 7: Error handling with sanitization check
  test("Displays error messages while sanitizing paths and tokens", async () => {
    const ui = new DashboardUI();

    chromeMessageMock = (_msg, callback) => {
      callback({
        code: "HANDLER_ERROR",
        message: "Failed to read database [PATH_REDACTED] with token=[REDACTED]",
      } as any);
    };

    await ui.initialize();

    const listError = mockElements.get("list-error-state");
    assert.ok(!listError.classList.contains("hidden"));

    const listErrorMsg = mockElements.get("list-error-message");
    assert.ok(listErrorMsg.textContent.includes("[PATH_REDACTED]"));
    assert.ok(listErrorMsg.textContent.includes("[REDACTED]"));
    assert.ok(!listErrorMsg.textContent.includes("Secret123"));
  });
});
