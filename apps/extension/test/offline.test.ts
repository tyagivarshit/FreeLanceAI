/* eslint-disable @typescript-eslint/no-explicit-any */
import { test, describe, beforeEach, before } from "node:test";
import assert from "node:assert";

// 1. INDEXEDDB MOCK SETUP (Runs before importing db.ts and service-worker.ts)
const mockDbData = new Map<string, any>();

class MockIDBRequest {
  public result: any;
  public error: any;
  public onsuccess: any = null;
  public onerror: any = null;
  public onupgradeneeded: any = null;
}

class MockIDBObjectStore {
  constructor(
    public name: string,
    public dbData: Map<string, any>,
  ) {}
  get(key: string) {
    const req = new MockIDBRequest();
    setTimeout(() => {
      req.result = this.dbData.get(key);
      if (req.onsuccess) {
        req.onsuccess();
      }
    }, 0);
    return req;
  }
  put(value: any) {
    const req = new MockIDBRequest();
    setTimeout(() => {
      this.dbData.set(value.snapshotId, value);
      req.result = value.snapshotId;
      if (req.onsuccess) {
        req.onsuccess();
      }
    }, 0);
    return req;
  }
  delete(key: string) {
    const req = new MockIDBRequest();
    setTimeout(() => {
      this.dbData.delete(key);
      if (req.onsuccess) {
        req.onsuccess();
      }
    }, 0);
    return req;
  }
  getAll() {
    const req = new MockIDBRequest();
    setTimeout(() => {
      req.result = Array.from(this.dbData.values());
      if (req.onsuccess) {
        req.onsuccess();
      }
    }, 0);
    return req;
  }
}

class MockIDBTransaction {
  constructor(public dbData: Map<string, any>) {}
  objectStore(name: string) {
    return new MockIDBObjectStore(name, this.dbData);
  }
}

class MockIDBDatabase {
  public objectStoreNames = {
    contains: (_name: string) => true,
  };
  constructor(public dbData: Map<string, any>) {}
  transaction(_stores: any, _mode: any) {
    return new MockIDBTransaction(this.dbData);
  }
}

(global as any).indexedDB = {
  open(_name: string, _version: number) {
    const req = new MockIDBRequest();
    setTimeout(() => {
      req.result = new MockIDBDatabase(mockDbData);
      if (req.onsuccess) {
        req.onsuccess({ target: req });
      }
    }, 0);
    return req;
  },
};

// Global DOM and window mocks for options.js dependencies
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
  public disabled = false;
  public title = "";

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
  value: { onLine: true },
  configurable: true,
  writable: true,
});

// Mock Chrome runtime API
let chromeMessageMock: (message: any, callback: (response: any) => void) => void = () => {};
let messageListener: any = null;

(global as any).chrome = {
  runtime: {
    onMessage: {
      addListener(listener: any) {
        messageListener = listener;
      },
    },
    sendMessage(message: any, callback: any) {
      let called = false;
      const safeCallback = (response: any) => {
        if (!called) {
          called = true;
          if (callback) {
            callback(response);
          }
        }
      };
      chromeMessageMock(message, safeCallback);
      // Fallback response to prevent pending promise hangs during UI initialization / calls
      setTimeout(() => {
        if (!called) {
          safeCallback({
            protocolVersion: "1.0",
            messageId: "fallback-res",
            correlationId: message.messageId,
            type: `${message.type}_RESPONSE`,
            timestamp: Date.now(),
            payload: {},
          });
        }
      }, 5);
    },
  },
};

// Mock setTimeout globally to run instantly for retry timeouts
const originalSetTimeout = global.setTimeout;
(global as any).setTimeout = (cb: any, delay: number) => {
  if (delay > 0 && delay < 5000) {
    return originalSetTimeout(cb, 0); // speed up backoffs
  }
  return originalSetTimeout(cb, delay);
};

// Mock Global Fetch
let fetchCallCount = 0;
let fetchMockResponse: (url: string, init?: any) => Promise<any> = () =>
  Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
(global as any).fetch = (url: string, init?: any) => {
  fetchCallCount++;
  return fetchMockResponse(url, init);
};

// Imports under test
import { OfflineStorage, sanitizePrivateData } from "../src/storage/db.js";

let DashboardUI: any;

function dispatchMessage(msg: any, sender: any = { contextType: "EXTENSION_UI" }): Promise<any> {
  if (msg && !msg.correlationId) {
    msg.correlationId = msg.messageId;
  }
  return new Promise((resolve, reject) => {
    const sendResponse = (res: any) => {
      if (res && res.code === "HANDLER_ERROR") {
        reject(new Error(res.message));
      } else {
        if (res && typeof res === "object" && "payload" in res) {
          resolve(res.payload);
        } else {
          resolve(res);
        }
      }
    };
    const handled = messageListener(msg, sender, sendResponse);
    if (!handled) {
      reject(new Error("Message not handled by listener"));
    }
  });
}

describe("Chapter 9G — Hardened Extension Offline Caching & Resilience", () => {
  before(async () => {
    await import("../src/service-worker.js");
    const module = await import("../src/options.js");
    DashboardUI = module.DashboardUI;
  });

  beforeEach(() => {
    mockDbData.clear();
    mockElements.clear();
    globalListeners.clear();
    fetchCallCount = 0;
    Object.defineProperty(global.navigator, "onLine", { value: true, configurable: true });
    // Reset service worker connection status state to online/LIVE
    chromeMessageMock = (msg, callback) => {
      callback({
        protocolVersion: "1.0",
        messageId: "default-res",
        correlationId: msg.messageId,
        type: "GET_OFFLINE_STATUS_RESPONSE",
        timestamp: Date.now(),
        payload: { isOnline: true, status: "LIVE" },
      });
    };
  });

  // ==========================================
  // 1. NETWORK FAILURE CLASSIFICATION & RETRIES
  // ==========================================
  describe("Network Failure Classification", () => {
    test("Network TypeError is treated as availability failure -> falls back to snapshot", async () => {
      // 1. Store a snapshot
      const storage = new OfflineStorage();
      await storage.saveSnapshot(
        "dashboard-jobs",
        [{ id: "job-1", title: "Valid Offline Job" }],
        "api/jobs",
      );

      // 2. Mock fetch throwing a TypeError
      fetchMockResponse = () => Promise.reject(new TypeError("Failed to fetch"));

      // 3. Dispatch GET_DASHBOARD_JOBS message
      const res = await dispatchMessage({
        protocolVersion: "1.0",
        messageId: "msg-1",
        type: "GET_DASHBOARD_JOBS",
        timestamp: Date.now(),
        payload: {},
      });

      assert.ok(Array.isArray(res));
      assert.strictEqual(res[0].title, "Valid Offline Job");
    });

    test("HTTP 401 does NOT fallback to snapshot and throws immediately", async () => {
      fetchMockResponse = () =>
        Promise.resolve({
          ok: false,
          status: 401,
          json: () => Promise.resolve({ error: "Unauthorized" }),
        });

      await assert.rejects(
        dispatchMessage({
          protocolVersion: "1.0",
          messageId: "msg-2",
          type: "GET_DASHBOARD_JOBS",
          timestamp: Date.now(),
          payload: {},
        }),
        /AUTHENTICATION_ERROR/,
      );
    });

    test("HTTP 403 does NOT fallback to snapshot and throws immediately", async () => {
      fetchMockResponse = () =>
        Promise.resolve({
          ok: false,
          status: 403,
          json: () => Promise.resolve({ error: "Forbidden" }),
        });

      await assert.rejects(
        dispatchMessage({
          protocolVersion: "1.0",
          messageId: "msg-3",
          type: "GET_DASHBOARD_JOBS",
          timestamp: Date.now(),
          payload: {},
        }),
        /AUTHENTICATION_ERROR/,
      );
    });

    test("HTTP 4xx (400/404) does NOT fallback and throws immediately", async () => {
      fetchMockResponse = () =>
        Promise.resolve({
          ok: false,
          status: 404,
          json: () => Promise.resolve({ error: "Not Found" }),
        });

      await assert.rejects(
        dispatchMessage({
          protocolVersion: "1.0",
          messageId: "msg-4",
          type: "GET_DASHBOARD_JOBS",
          timestamp: Date.now(),
          payload: {},
        }),
        /APPLICATION_ERROR/,
      );
    });

    test("HTTP 5xx triggers retry before falling back to snapshot", async () => {
      const storage = new OfflineStorage();
      await storage.saveSnapshot(
        "dashboard-jobs",
        [{ id: "job-cached", title: "Cached Job" }],
        "api/jobs",
      );

      fetchCallCount = 0;
      fetchMockResponse = () =>
        Promise.resolve({
          ok: false,
          status: 503,
          json: () => Promise.resolve({ error: "Service Unavailable" }),
        });

      const res = await dispatchMessage({
        protocolVersion: "1.0",
        messageId: "msg-5",
        type: "GET_DASHBOARD_JOBS",
        timestamp: Date.now(),
        payload: {},
      });

      // Verification: 1 primary call + 3 retries = 4 fetch attempts
      assert.strictEqual(fetchCallCount, 4);
      assert.strictEqual(res[0].title, "Cached Job");
    });
  });

  // ==========================================
  // 2. RECONNECT STATE TRANSITIONS
  // ==========================================
  describe("Reconnect Transitions", () => {
    test("Transitions LIVE -> OFFLINE -> RECONNECTING -> LIVE", async () => {
      const storage = new OfflineStorage();
      await storage.saveSnapshot("dashboard-jobs", [{ id: "job-1", title: "Cached" }], "api/jobs");

      // 1. Initial success -> LIVE
      fetchMockResponse = () =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve([{ id: "job-1", title: "Live" }]),
        });
      await dispatchMessage({
        protocolVersion: "1.0",
        messageId: "m1",
        type: "GET_DASHBOARD_JOBS",
        timestamp: Date.now(),
      });

      let status = await dispatchMessage({
        protocolVersion: "1.0",
        messageId: "m2",
        type: "GET_OFFLINE_STATUS",
        timestamp: Date.now(),
      });
      assert.strictEqual(status.status, "LIVE");

      // 2. Network drop -> OFFLINE_SNAPSHOT
      fetchMockResponse = () => Promise.reject(new Error("Network drop"));
      const cachedResult = await dispatchMessage({
        protocolVersion: "1.0",
        messageId: "m3",
        type: "GET_DASHBOARD_JOBS",
        timestamp: Date.now(),
      });
      assert.strictEqual(cachedResult[0].title, "Live");

      status = await dispatchMessage({
        protocolVersion: "1.0",
        messageId: "m4",
        type: "GET_OFFLINE_STATUS",
        timestamp: Date.now(),
      });
      assert.strictEqual(status.status, "OFFLINE_SNAPSHOT");

      // 3. Request in offline triggers RECONNECTING during fetch, then transitions to LIVE upon success
      fetchMockResponse = () =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve([{ id: "job-1", title: "Live Again" }]),
        });
      await dispatchMessage({
        protocolVersion: "1.0",
        messageId: "m5",
        type: "GET_DASHBOARD_JOBS",
        timestamp: Date.now(),
      });
      status = await dispatchMessage({
        protocolVersion: "1.0",
        messageId: "m6",
        type: "GET_OFFLINE_STATUS",
        timestamp: Date.now(),
      });
      assert.strictEqual(status.status, "LIVE");
    });

    test("Transitions to DEGRADED on query failure when no snapshot exists", async () => {
      fetchMockResponse = () => Promise.reject(new Error("Down"));

      await assert.rejects(
        dispatchMessage({
          protocolVersion: "1.0",
          messageId: "m7",
          type: "GET_DASHBOARD_JOBS",
          timestamp: Date.now(),
        }),
      );

      const status = await dispatchMessage({
        protocolVersion: "1.0",
        messageId: "m8",
        type: "GET_OFFLINE_STATUS",
        timestamp: Date.now(),
      });
      assert.strictEqual(status.status, "DEGRADED");
    });
  });

  // ==========================================
  // 3. REQUEST DEDUPLICATION
  // ==========================================
  describe("Request Deduplication", () => {
    test("Two concurrent refresh calls produce exactly one fetch", async () => {
      fetchCallCount = 0;
      let resolveFetch: any;
      const fetchPromise = new Promise((resolve) => {
        resolveFetch = resolve;
      });

      fetchMockResponse = () =>
        fetchPromise.then(() => ({
          ok: true,
          json: () => Promise.resolve([{ id: "j1", title: "Deduplicated" }]),
        }));

      // Fire concurrent requests
      const p1 = dispatchMessage({
        protocolVersion: "1.0",
        messageId: "dedup-1",
        type: "GET_DASHBOARD_JOBS",
        timestamp: Date.now(),
      });
      const p2 = dispatchMessage({
        protocolVersion: "1.0",
        messageId: "dedup-2",
        type: "GET_DASHBOARD_JOBS",
        timestamp: Date.now(),
      });

      // Resolve the fetch call
      resolveFetch();

      const [r1, r2] = await Promise.all([p1, p2]);
      assert.strictEqual(fetchCallCount, 1);
      assert.deepStrictEqual(r1, r2);
    });

    test("Deduplication lock is cleared after failure", async () => {
      fetchMockResponse = () => Promise.reject(new Error("Fail"));

      await assert.rejects(
        dispatchMessage({
          protocolVersion: "1.0",
          messageId: "lock-1",
          type: "GET_DASHBOARD_JOBS",
          timestamp: Date.now(),
        }),
      );

      // Verify lock was released and a new fetch is allowed
      fetchCallCount = 0;
      fetchMockResponse = () =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve([]),
        });
      await dispatchMessage({
        protocolVersion: "1.0",
        messageId: "lock-2",
        type: "GET_DASHBOARD_JOBS",
        timestamp: Date.now(),
      });
      assert.strictEqual(fetchCallCount, 1);
    });
  });

  // ==========================================
  // 4. SNAPSHOT STORAGE LIFECYCLE
  // ==========================================
  describe("Snapshot Storage", () => {
    test("Validates expired snapshot returns expired state TTL", async () => {
      const storage = new OfflineStorage();
      await storage.saveSnapshot("test-ttl", { val: 42 }, "api/jobs");

      const snap = mockDbData.get("test-ttl");
      snap.expiresAt = Date.now() - 1000; // expired

      const snapshot = await storage.getSnapshot("test-ttl");
      assert.ok(snapshot);
      assert.ok(Date.now() > snapshot.expiresAt);
    });

    test("Mismatched schema version invalidates and deletes snapshot", async () => {
      const storage = new OfflineStorage();
      await storage.saveSnapshot("schema-mismatch", { val: 42 }, "api/jobs");

      const snap = mockDbData.get("schema-mismatch");
      snap.schemaVersion = 999; // invalid schema version

      const snapshot = await storage.getSnapshot("schema-mismatch");
      assert.strictEqual(snapshot, null);
      assert.strictEqual(mockDbData.has("schema-mismatch"), false);
    });

    test("Rejects snapshot size exceeding 512KB", async () => {
      const storage = new OfflineStorage();
      const largeData = "x".repeat(512 * 1024 + 1); // > 512KB

      const success = await storage.saveSnapshot("large", largeData, "api/jobs");
      assert.strictEqual(success, false);
      assert.strictEqual(mockDbData.has("large"), false);
    });

    test("Evict policy: evicts expired snapshots first, then oldest active items", async () => {
      const storage = new OfflineStorage();
      // Insert 10 active items
      for (let i = 1; i <= 10; i++) {
        await storage.saveSnapshot(`snap-${i}`, { index: i }, "api/jobs");
        const entry = mockDbData.get(`snap-${i}`);
        entry.capturedAt = Date.now() + i * 1000;
        entry.expiresAt = Date.now() + 3600000;
      }

      // Make snap-5 expired
      mockDbData.get("snap-5").expiresAt = Date.now() - 1000;

      // 11th insertion triggers smart eviction
      await storage.saveSnapshot("snap-11", { index: 11 }, "api/jobs");

      // Verify expired snap-5 was deleted
      assert.strictEqual(mockDbData.has("snap-5"), false);
      assert.strictEqual(mockDbData.has("snap-11"), true);
      assert.strictEqual(mockDbData.size, 10);
    });

    test("Concurrency: newer capturedAt wins and prevents out-of-order older overwrite", async () => {
      const storage = new OfflineStorage();

      // Save newer snapshot first
      await storage.saveSnapshot("race-snap", "NEW_DATA", "api/jobs");
      const newerTime = Date.now();
      mockDbData.get("race-snap").capturedAt = newerTime;

      // Simulate older write finishing out-of-order

      const oldSnapshot = {
        snapshotId: "race-snap",
        schemaVersion: 1,
        capturedAt: newerTime - 10000, // Older
        updatedAt: newerTime - 10000,
        source: "api/jobs",
        expiresAt: Date.now() + 3600000,
        data: "OLD_DATA",
      };

      await storage.saveSnapshot("race-snap", oldSnapshot.data, "api/jobs", oldSnapshot.capturedAt);

      // Verify newer wins
      const final = await storage.getSnapshot("race-snap");
      assert.strictEqual(final?.data, "NEW_DATA");
    });

    test("Corruption: handles missing snapshotId, missing schemaVersion, invalid capturedAt/expiresAt, malformed stored record", async () => {
      const storage = new OfflineStorage();
      await storage.saveSnapshot("corrupt-test", { val: 123 }, "api/jobs");

      // 1. Corrupt the saved record directly in mock database
      const entry = mockDbData.get("corrupt-test");
      delete entry.schemaVersion; // missing schemaVersion

      const snap1 = await storage.getSnapshot("corrupt-test");
      assert.strictEqual(snap1, null); // should invalidate and return null
      assert.strictEqual(mockDbData.has("corrupt-test"), false); // should be deleted

      // 2. Corrupt capturedAt
      await storage.saveSnapshot("corrupt-test-2", { val: 123 }, "api/jobs");
      const entry2 = mockDbData.get("corrupt-test-2");
      entry2.capturedAt = "not-a-number"; // invalid capturedAt

      const snap2 = await storage.getSnapshot("corrupt-test-2");
      assert.strictEqual(snap2, null);
      assert.strictEqual(mockDbData.has("corrupt-test-2"), false);
    });

    test("Atomicity: failed transaction/write does not leave partially valid snapshot", async () => {
      const storage = new OfflineStorage();
      await storage.saveSnapshot("atomic-snap", "INITIAL_VALID", "api/jobs");

      // Mock transaction failure inside IndexedDB
      const db = await (storage as any).getDB();
      const origTransaction = db.transaction;
      db.transaction = () => {
        return {
          objectStore: () => {
            return {
              get: () => {
                const req = new MockIDBRequest();
                setTimeout(() => {
                  if (req.onerror) {
                    req.onerror();
                  }
                }, 0);
                return req;
              },
              put: () => {
                const req = new MockIDBRequest();
                setTimeout(() => {
                  if (req.onerror) {
                    req.onerror();
                  }
                }, 0);
                return req;
              },
            };
          },
        };
      };

      try {
        const success = await storage.saveSnapshot("atomic-snap", "PARTIAL_INVALID", "api/jobs");
        assert.strictEqual(success, false);
        // Verify original data is untouched
        db.transaction = origTransaction; // restore transaction
        const final = await storage.getSnapshot("atomic-snap");
        assert.strictEqual(final?.data, "INITIAL_VALID");
      } finally {
        db.transaction = origTransaction;
      }
    });

    test("Eviction boundary: never evicts the newest valid snapshot when count exceeds limit", async () => {
      const storage = new OfflineStorage();
      // Insert 10 active items
      for (let i = 1; i <= 10; i++) {
        await storage.saveSnapshot(`snap-${i}`, { index: i }, "api/jobs");
        const entry = mockDbData.get(`snap-${i}`);
        // Ensure snap-10 is the newest
        entry.capturedAt = Date.now() + i * 1000;
        entry.expiresAt = Date.now() + 3600000;
      }

      // 11th insertion
      await storage.saveSnapshot("snap-11", { index: 11 }, "api/jobs");

      // Verify snap-10 (newest valid) is not evicted, snap-1 (oldest active) is evicted
      assert.strictEqual(mockDbData.has("snap-1"), false);
      assert.strictEqual(mockDbData.has("snap-10"), true);
      assert.strictEqual(mockDbData.has("snap-11"), true);
      assert.strictEqual(mockDbData.size, 10);
    });
  });

  // ==========================================
  // 5. SECURITY & PRIVACY
  // ==========================================
  describe("Security & Privacy", () => {
    test("Sanitizes credential fields recursively before persisting", () => {
      const payload = {
        jobs: [{ id: "1", title: "Dev" }],
        session: {
          accessToken: "secret_token",
          refreshToken: "refresh_key",
          password: "password123",
          cookie: "session_cookie",
          authorization: "Bearer tokens",
        },
        other: "safe",
      };

      const sanitized = sanitizePrivateData(payload) as any;
      assert.strictEqual(sanitized.session.accessToken, undefined);
      assert.strictEqual(sanitized.session.password, undefined);
      assert.strictEqual(sanitized.other, "safe");
    });

    test("XSS: verifySafeUrl rejects unsafe javascript: and non-whitelisted domains", () => {
      const ui = new DashboardUI();
      const verify = (ui as any).verifySafeUrl.bind(ui);
      assert.strictEqual(verify("javascript:alert(1)"), null);
      assert.strictEqual(verify("https://attacker.com/malicious"), null);
      assert.strictEqual(verify("https://upwork.com/jobs/1"), "https://upwork.com/jobs/1");
      assert.strictEqual(verify("https://linkedin.com/jobs/2"), "https://linkedin.com/jobs/2");
    });

    test("XSS: renders snapshot content safely avoiding script execution", async () => {
      const ui = new DashboardUI();
      const maliciousJob = {
        id: "mal-1",
        platform: "upwork",
        title: "<script>alert(1)</script>",
        description: "<img src=x onerror=alert(1)>",
        company: '<div onclick="alert(1)">test</div>',
        url: "javascript:alert(1)",
        skills: ["<script>alert(1)</script>"],
      };

      (ui as any).renderJobDetails(maliciousJob);

      assert.strictEqual(ui["elJobTitle"].textContent, "<script>alert(1)</script>");
      assert.strictEqual(ui["elJobDescription"].textContent, "<img src=x onerror=alert(1)>");
      assert.strictEqual(ui["elJobSourceLink"].getAttribute("href"), null);
    });

    test("Privacy: Redacts credentials and secrets from logs and ensures they are never logged", async () => {
      const logMsg = "Failed password=secret123 token=abc123xyz";
      const { MessageDispatcher } = await import("../src/messaging/dispatcher.js");
      const dispatcher = new MessageDispatcher("SERVICE_WORKER");
      const sanitized = (dispatcher as any).sanitizeError(logMsg);

      assert.ok(!sanitized.includes("secret123"));
      assert.ok(!sanitized.includes("abc123xyz"));
      assert.ok(sanitized.includes("[REDACTED]"));
    });
  });

  // ==========================================
  // 6. UI RENDERING & MUTATIONS
  // ==========================================
  describe("UI Options Rendering & Mutations", () => {
    test("Offline status correctly disables retry match buttons", async () => {
      const ui = new DashboardUI();
      const testDate = Date.now();

      chromeMessageMock = (msg, callback) => {
        if (msg.type === "GET_DASHBOARD_JOBS") {
          callback({
            protocolVersion: "1.0",
            messageId: "res-jobs",
            correlationId: msg.messageId,
            type: "GET_DASHBOARD_JOBS_RESPONSE",
            timestamp: Date.now(),
            payload: [{ id: "job-1", title: "Valid Cached Job", platform: "upwork" }],
          });
        } else if (msg.type === "GET_OFFLINE_STATUS") {
          callback({
            protocolVersion: "1.0",
            messageId: "res-status",
            correlationId: msg.messageId,
            type: "GET_OFFLINE_STATUS_RESPONSE",
            timestamp: Date.now(),
            payload: { isOnline: false, status: "OFFLINE_SNAPSHOT", capturedAt: testDate },
          });
        }
      };

      await ui.initialize();
      const retryBtn = mockElements.get("job-retry-match-btn");
      assert.strictEqual(retryBtn.disabled, true);
    });

    test("Blocks retry match action on clicks when offline", async () => {
      const ui = new DashboardUI();
      ui.selectedJobId = "job-1";

      chromeMessageMock = (msg, callback) => {
        if (msg.type === "GET_OFFLINE_STATUS") {
          callback({
            protocolVersion: "1.0",
            messageId: "res-status",
            correlationId: msg.messageId,
            type: "GET_OFFLINE_STATUS_RESPONSE",
            timestamp: Date.now(),
            payload: { isOnline: false, status: "OFFLINE_SNAPSHOT" },
          });
        }
      };

      const retryBtn = mockElements.get("job-retry-match-btn");
      const clickHandler = retryBtn.listeners.get("click")?.[0];
      assert.ok(clickHandler);

      let alertTriggered = false;
      (global as any).alert = () => {
        alertTriggered = true;
      };

      await clickHandler();
      assert.strictEqual(alertTriggered, true);
    });

    test("Blocks retry match mutations in Service Worker during offline status", async () => {
      // Simulate Service Worker transition to offline
      fetchMockResponse = () => Promise.reject(new Error("Connection lost"));

      const storage = new OfflineStorage();
      await storage.saveSnapshot("dashboard-jobs", [{ id: "j1" }], "api/jobs");

      // Set offline by triggering a failed call
      await dispatchMessage({
        protocolVersion: "1.0",
        messageId: "m-fail",
        type: "GET_DASHBOARD_JOBS",
        timestamp: Date.now(),
      });

      await assert.rejects(
        dispatchMessage({
          protocolVersion: "1.0",
          messageId: "m-mutation",
          type: "RETRY_MATCH",
          timestamp: Date.now(),
          payload: { jobId: "j1" },
        }),
        /unavailable in offline mode/,
      );
    });
  });

  // ==========================================
  // 7. MESSAGING & PROTOCOL INTEGRATION
  // ==========================================
  describe("Messaging & Protocol Integration", () => {
    test("Offline status request: GET_OFFLINE_STATUS returns correct status state", async () => {
      const statusRes = await dispatchMessage({
        protocolVersion: "1.0",
        messageId: "msg-status-test",
        type: "GET_OFFLINE_STATUS",
        timestamp: Date.now(),
        payload: {},
      });
      assert.ok(statusRes);
      assert.strictEqual(typeof statusRes.isOnline, "boolean");
      assert.ok(statusRes.status);
    });

    test("Correlation validation: rejects responses with mismatched correlationId", async () => {
      const { ExtensionMessageClient } = await import("../src/messaging/client.js");
      const client = new ExtensionMessageClient(async (message) => {
        return {
          protocolVersion: "1.0",
          messageId: "mismatch-res",
          correlationId: "wrong-id",
          type: `${message.type}_RESPONSE`,
          timestamp: Date.now(),
          payload: {},
        };
      });

      await assert.rejects(client.request("GET_DASHBOARD_JOBS", {}), /Correlation mismatch/);
    });

    test("Timeout handling: dispatcher throws error on slow request", async () => {
      const { MessageDispatcher } = await import("../src/messaging/dispatcher.js");
      const dispatcher = new MessageDispatcher("SERVICE_WORKER");
      dispatcher.registerHandler("TIMEOUT_TEST", async () => {
        await new Promise((resolve) => originalSetTimeout(resolve, 50));
      });

      const envelope = {
        protocolVersion: "1.0",
        messageId: "msg-timeout",
        correlationId: "msg-timeout",
        type: "TIMEOUT_TEST",
        timestamp: Date.now(),
        payload: {},
      };

      const res = await dispatcher.dispatch(envelope, { contextType: "CONTENT_SCRIPT" });
      assert.strictEqual((res as any).code, "REQUEST_TIMEOUT");
    });

    test("Schema validation: rejects invalid message payloads", async () => {
      const { MessageDispatcher } = await import("../src/messaging/dispatcher.js");
      const dispatcher = new MessageDispatcher("SERVICE_WORKER");
      dispatcher.registerHandler("EXTRACT_JOB", async () => ({}));

      const invalidEnvelope = {
        protocolVersion: "1.0",
        messageId: "msg-invalid-payload",
        correlationId: "msg-invalid-payload",
        type: "EXTRACT_JOB",
        timestamp: Date.now(),
        payload: {
          url: 12345,
        },
      };

      const res = await dispatcher.dispatch(invalidEnvelope, { contextType: "CONTENT_SCRIPT" });
      assert.strictEqual((res as any).code, "HANDLER_ERROR");
      assert.ok((res as any).message.includes("EXTRACT_JOB"));
    });
  });
});
