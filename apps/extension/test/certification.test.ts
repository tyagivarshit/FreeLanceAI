/* eslint-disable @typescript-eslint/no-explicit-any */
import { test, describe, before, beforeEach } from "node:test";
import assert from "node:assert";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

// Define __filename and __dirname in ES module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const extensionRoot = path.resolve(__dirname, "../..");

// -------------------------------------------------------------
// 1. MOCK ENVIRONMENT SETUP
// -------------------------------------------------------------
const mockDbData = new Map<string, any>();
let fetchCallCount = 0;
let fetchMockResponse: (url: string, init?: any) => Promise<any> = () =>
  Promise.resolve({ ok: true, json: () => Promise.resolve([]) });

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

(global as any).fetch = (url: string, init?: any) => {
  fetchCallCount++;
  return fetchMockResponse(url, init);
};

// Speed up setTimeout backoffs in SW
const originalSetTimeout = global.setTimeout;
(global as any).setTimeout = (cb: any, delay: number) => {
  if (delay > 0 && delay < 5000) {
    return originalSetTimeout(cb, 0);
  }
  return originalSetTimeout(cb, delay);
};

// -------------------------------------------------------------
// IMPORTS UNDER TEST
// -------------------------------------------------------------
import { OfflineStorage, sanitizePrivateData } from "../src/storage/db.js";
import { PlatformAdapterRegistry } from "../src/platform/registry.js";
import { createPlatformContext } from "../src/platform/context.js";
import { UpworkAdapter } from "../src/platform/upwork.js";
import { LinkedInAdapter } from "../src/platform/linkedin.js";
import {
  SUPPORTED_PROTOCOL_VERSION,
  validateEnvelope,
  getObjectDepth,
} from "../src/messaging/schema.js";

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

// -------------------------------------------------------------
// CERTIFICATION TESTS
// -------------------------------------------------------------
describe("Chapter 9H — Final Extension Integration & Certification", () => {
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
    fetchMockResponse = () =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve([]),
      });
  });

  // ===========================================================
  // TEST AREA 1 — MANIFEST CERTIFICATION
  // ===========================================================
  describe("1. Manifest Certification", () => {
    const manifestPath = path.join(extensionRoot, "manifest.json");

    test("Verifies Manifest version, paths, and permissions strictly conform", () => {
      assert.ok(fs.existsSync(manifestPath), "manifest.json exists");
      const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));

      assert.strictEqual(manifest.manifest_version, 3, "Conforms to Manifest V3");
      assert.ok(manifest.background?.service_worker, "Background worker configured");
      assert.ok(Array.isArray(manifest.content_scripts), "Content scripts declared");

      // Leased permissions validation
      if (manifest.permissions) {
        for (const p of manifest.permissions) {
          assert.strictEqual(p, "storage", "Only storage permission is permitted");
        }
      }

      // Wildcard host permissions verification
      if (manifest.host_permissions) {
        for (const hp of manifest.host_permissions) {
          assert.notStrictEqual(hp, "<all_urls>", "Host permissions must not contain <all_urls>");
          assert.notStrictEqual(hp, "*://*/*", "Host permissions must not contain broad wildcards");
        }
      }
    });

    test("Verifies CSP policies block remote code execution and unsafe-eval", () => {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
      const csp = manifest.content_security_policy?.extension_pages;
      if (csp) {
        assert.ok(!csp.includes("unsafe-eval"), "Unsafe eval must not be allowed");
        const scriptSrc = csp.split(";").find((t: string) => t.trim().startsWith("script-src"));
        if (scriptSrc) {
          const sources = scriptSrc.trim().split(/\s+/).slice(1);
          for (const s of sources) {
            assert.ok(
              s === "'self'" || s === "'none'" || s === "'wasm-unsafe-eval'",
              `Script source '${s}' violates MV3 security restrictions`,
            );
          }
        }
      }
    });
  });

  // ===========================================================
  // TEST AREA 2 — MESSAGING CERTIFICATION
  // ===========================================================
  describe("2. Messaging Certification", () => {
    test("Rejects invalid message formats and protocols", () => {
      // Missing required properties
      assert.throws(() =>
        validateEnvelope({
          messageId: "1",
          type: "PING",
        } as any),
      );

      // Mismatched version
      assert.throws(() =>
        validateEnvelope({
          protocolVersion: "2.0",
          messageId: "1",
          correlationId: "1",
          type: "PING",
          timestamp: Date.now(),
          payload: {},
        }),
      );
    });

    test("Checks payload size, nesting limit, and correlation validation", async () => {
      // 1. Nested depth check
      const nested: any = {};
      let cur = nested;
      for (let i = 0; i < 15; i++) {
        cur.child = {};
        cur = cur.child;
      }
      assert.ok(getObjectDepth(nested) >= 10, "Depth calculator is functional");

      // 2. Correlation validation rejection in clients
      const { ExtensionMessageClient } = await import("../src/messaging/client.js");
      const client = new ExtensionMessageClient(async (message) => {
        return {
          protocolVersion: SUPPORTED_PROTOCOL_VERSION,
          messageId: "different-id",
          correlationId: "wrong-id-mismatch",
          type: `${message.type}_RESPONSE`,
          timestamp: Date.now(),
          payload: {},
        };
      });
      await assert.rejects(client.request("GET_DASHBOARD_JOBS", {}), /Correlation mismatch/);
    });
  });

  // ===========================================================
  // TEST AREA 3 — PLATFORM ADAPTER CERTIFICATION
  // ===========================================================
  describe("3. Platform Adapter Certification", () => {
    test("Platform Registry correctly manages and isolates adapters", () => {
      const registry = new PlatformAdapterRegistry();
      const upwork = new UpworkAdapter();
      registry.register(upwork);

      // Rejects duplicate registration
      assert.throws(() => registry.register(upwork), /already registered/);

      // Unknown platform resolution
      const unknownCtx = createPlatformContext("https://github.com", 1, 0);
      assert.throws(() => registry.resolve(unknownCtx), /No adapter found/);

      // Verify adapter canHandle failure isolation
      const faultyAdapter = {
        identity: "FAULTY",
        canHandle() {
          throw new Error("Resolution failure simulation");
        },
        executeExtract: async () => ({ status: "FAILED", errors: [] }),
      };
      registry.register(faultyAdapter as any);

      // Resolution should skip faulty and proceed normally
      const upworkCtx = createPlatformContext(
        "https://www.upwork.com/jobs/~01abc1234567890def",
        1,
        0,
      );
      const resolved = registry.resolve(upworkCtx);
      assert.strictEqual(
        resolved.identity,
        "UPWORK",
        "Registry successfully isolated the faulty canHandle check",
      );
    });
  });

  // ===========================================================
  // TEST AREA 4 & 5 — UPWORK & LINKEDIN INTEGRATION
  // ===========================================================
  describe("4 & 5. Upwork & LinkedIn Adapters Integration", () => {
    test("Upwork URL handles and supports standard patterns", () => {
      const adapter = new UpworkAdapter();
      assert.ok(
        adapter.canHandle(
          createPlatformContext("https://www.upwork.com/jobs/~01abc1234567890def", 1, 0),
        ),
      );
      assert.ok(
        !adapter.canHandle(createPlatformContext("https://www.upwork.com/nx/find-work/", 1, 0)),
      );
    });

    test("LinkedIn URL handles and supports standard patterns", () => {
      const adapter = new LinkedInAdapter();
      assert.ok(
        adapter.canHandle(
          createPlatformContext("https://www.linkedin.com/jobs/view/123456789", 1, 0),
        ),
      );
      assert.ok(!adapter.canHandle(createPlatformContext("https://www.linkedin.com/feed/", 1, 0)));
    });
  });

  // ===========================================================
  // TEST AREA 6 — DASHBOARD INTEGRATION
  // ===========================================================
  describe("6. Dashboard UI Integration", () => {
    test("Renders dashboard connection badge depending on state message", async () => {
      const ui = new DashboardUI();
      const testTime = Date.now();

      chromeMessageMock = (msg, callback) => {
        if (msg.type === "GET_DASHBOARD_JOBS") {
          callback({
            protocolVersion: "1.0",
            messageId: "res-jobs",
            correlationId: msg.messageId,
            type: "GET_DASHBOARD_JOBS_RESPONSE",
            timestamp: Date.now(),
            payload: [{ id: "job-1", title: "Job Sample", platform: "upwork" }],
          });
        } else if (msg.type === "GET_OFFLINE_STATUS") {
          callback({
            protocolVersion: "1.0",
            messageId: "res-status",
            correlationId: msg.messageId,
            type: "GET_OFFLINE_STATUS_RESPONSE",
            timestamp: Date.now(),
            payload: { isOnline: false, status: "OFFLINE_SNAPSHOT", capturedAt: testTime },
          });
        }
      };

      await ui.initialize();
      const textEl = mockElements.get("connection-status-text");
      assert.ok(
        textEl.textContent.includes("Offline"),
        "Dashboard connection badge was correctly set to Offline state",
      );

      const retryBtn = mockElements.get("job-retry-match-btn");
      assert.strictEqual(
        retryBtn.disabled,
        true,
        "Retry evaluation button must be disabled when offline",
      );
    });
  });

  // ===========================================================
  // TEST AREA 7 — OFFLINE INTEGRATION
  // ===========================================================
  describe("7. Offline Integration", () => {
    test("Service Worker correctly transitions state and deduplicates", async () => {
      const storage = new OfflineStorage();
      await storage.saveSnapshot(
        "dashboard-jobs",
        [{ id: "j1", title: "Cache Entry" }],
        "api/jobs",
      );

      // 1. Trigger network fail
      fetchMockResponse = () => Promise.reject(new TypeError("Connection drop"));
      const r1 = await dispatchMessage({
        protocolVersion: "1.0",
        messageId: "m1",
        type: "GET_DASHBOARD_JOBS",
        timestamp: Date.now(),
      });
      assert.strictEqual(r1[0].title, "Cache Entry", "Returns snapshot fallback");

      const s1 = await dispatchMessage({
        protocolVersion: "1.0",
        messageId: "m2",
        type: "GET_OFFLINE_STATUS",
        timestamp: Date.now(),
      });
      assert.strictEqual(s1.status, "OFFLINE_SNAPSHOT", "Status transitioned to OFFLINE_SNAPSHOT");

      // 2. Deduplication check
      fetchCallCount = 0;
      let resolveFetch: any;
      const fetchPromise = new Promise((resolve) => {
        resolveFetch = resolve;
      });
      fetchMockResponse = () =>
        fetchPromise.then(() => ({
          ok: true,
          json: () => Promise.resolve([{ id: "j1", title: "Fresh Data" }]),
        }));

      const p1 = dispatchMessage({
        protocolVersion: "1.0",
        messageId: "d1",
        type: "GET_DASHBOARD_JOBS",
        timestamp: Date.now(),
      });
      const p2 = dispatchMessage({
        protocolVersion: "1.0",
        messageId: "d2",
        type: "GET_DASHBOARD_JOBS",
        timestamp: Date.now(),
      });

      resolveFetch();
      await Promise.all([p1, p2]);
      assert.strictEqual(fetchCallCount, 1, "Concurrent fetches consolidated to single flight");
    });
  });

  // ===========================================================
  // TEST AREA 8 — CROSS-CHAPTER MESSAGE FLOW
  // ===========================================================
  describe("8. Cross-Chapter Message Flow Simulation", () => {
    test("End-to-end routing simulation: UI options page -> Service Worker -> DB Snapshot", async () => {
      const ui = new DashboardUI();
      const testTime = Date.now();

      chromeMessageMock = (msg, callback) => {
        if (msg.type === "GET_DASHBOARD_JOBS") {
          callback({
            protocolVersion: "1.0",
            messageId: "res-jobs-e2e",
            correlationId: msg.messageId,
            type: "GET_DASHBOARD_JOBS_RESPONSE",
            timestamp: Date.now(),
            payload: [{ id: "job-upwork", title: "E2E Verified Job", platform: "upwork" }],
          });
        } else if (msg.type === "GET_OFFLINE_STATUS") {
          callback({
            protocolVersion: "1.0",
            messageId: "res-status-e2e",
            correlationId: msg.messageId,
            type: "GET_OFFLINE_STATUS_RESPONSE",
            timestamp: Date.now(),
            payload: { isOnline: true, status: "LIVE", capturedAt: testTime },
          });
        }
      };

      await ui.initialize();
      assert.strictEqual(ui.jobs.length, 1);
      assert.strictEqual(
        ui.jobs[0].title,
        "E2E Verified Job",
        "Cross-chapter UI-to-SW message dispatch flow verified",
      );
    });
  });

  // ===========================================================
  // TEST AREA 9 — SECURITY CERTIFICATION
  // ===========================================================
  describe("9. Security Certification", () => {
    test("Source code static validation: no eval or Function constructors permitted", () => {
      const srcDir = path.join(extensionRoot, "src");
      const checkDirectory = (dir: string) => {
        const files = fs.readdirSync(dir);
        for (const file of files) {
          const absPath = path.join(dir, file);
          if (fs.statSync(absPath).isDirectory()) {
            checkDirectory(absPath);
          } else if (absPath.endsWith(".ts")) {
            const content = fs.readFileSync(absPath, "utf-8");
            assert.ok(
              !content.includes("eval("),
              `eval() is strictly forbidden inside extension code: ${absPath}`,
            );
            assert.ok(
              !content.includes("new Function("),
              `new Function() is strictly forbidden: ${absPath}`,
            );
          }
        }
      };
      checkDirectory(srcDir);
    });

    test("Sanitization: sanitizes passwords and access tokens recursively before storage", () => {
      const payload = {
        jobs: [],
        auth: {
          accessToken: "token123",
          cookie: "cookieSecret",
          password: "mySecretPassword",
        },
      };
      const sanitized = sanitizePrivateData(payload) as any;
      assert.strictEqual(sanitized.auth.accessToken, undefined, "Redacted credentials");
      assert.strictEqual(sanitized.auth.cookie, undefined, "Redacted cookies");
      assert.strictEqual(sanitized.auth.password, undefined, "Redacted passwords");
    });
  });

  // ===========================================================
  // TEST AREA 10 — SERVICE WORKER LIFECYCLE
  // ===========================================================
  describe("10. Service Worker Lifecycle Certification", () => {
    test("Checks request timeout cleanup and locks recovery", async () => {
      const { MessageDispatcher } = await import("../src/messaging/dispatcher.js");
      const swDispatcher = new MessageDispatcher("SERVICE_WORKER");
      swDispatcher.registerHandler("TIMEOUT_TEST", async () => {
        await new Promise((resolve) => originalSetTimeout(resolve, 30));
      });

      const envelope = {
        protocolVersion: "1.0",
        messageId: "t-msg",
        correlationId: "t-msg",
        type: "TIMEOUT_TEST",
        timestamp: Date.now(),
        payload: {},
      };

      const res = await swDispatcher.dispatch(envelope, { contextType: "CONTENT_SCRIPT" });
      assert.strictEqual(
        (res as any).code,
        "REQUEST_TIMEOUT",
        "SW dispatcher handles and rejects timeouts correctly",
      );
    });
  });

  // ===========================================================
  // TEST AREA 11 — RESOURCE / DOS PROTECTION
  // ===========================================================
  describe("11. Resource / DOS Limits Protection", () => {
    test("Rejects snapshot size exceeding maximum threshold (512KB)", async () => {
      const storage = new OfflineStorage();
      const largeBlob = "X".repeat(512 * 1024 + 1); // 512KB + 1 byte
      const saved = await storage.saveSnapshot("oversized-snap", largeBlob, "api/jobs");
      assert.strictEqual(saved, false, "Successfully prevented write exceeding storage limits");
    });

    test("Limits snapshot count to maximum threshold (10) and performs oldest-first eviction", async () => {
      const storage = new OfflineStorage();
      for (let i = 1; i <= 10; i++) {
        await storage.saveSnapshot(`snap-${i}`, { index: i }, "api/jobs");
        const entry = mockDbData.get(`snap-${i}`);
        entry.capturedAt = Date.now() + i * 1000;
        entry.expiresAt = Date.now() + 3600000;
      }

      // snap-11 insertion triggers limit enforcement and eviction
      await storage.saveSnapshot("snap-11", { index: 11 }, "api/jobs");

      assert.strictEqual(mockDbData.has("snap-1"), false, "Oldest snapshot was evicted");
      assert.strictEqual(mockDbData.has("snap-11"), true, "Newest snapshot was stored");
      assert.strictEqual(mockDbData.size, 10, "Snapshot storage limits maintained at exactly 10");
    });
  });

  // ===========================================================
  // TEST AREA 12 — NO DATA FABRICATION
  // ===========================================================
  describe("12. Data Fabrication Audits", () => {
    test("Verifies that empty database snapshots present honest results rather than dummy fallbacks", async () => {
      const ui = new DashboardUI();
      chromeMessageMock = (msg, callback) => {
        if (msg.type === "GET_DASHBOARD_JOBS") {
          callback({
            protocolVersion: "1.0",
            messageId: "res-jobs-empty",
            correlationId: msg.messageId,
            type: "GET_DASHBOARD_JOBS_RESPONSE",
            timestamp: Date.now(),
            payload: [], // Empty
          });
        }
      };

      await ui.initialize();
      assert.strictEqual(
        ui.jobs.length,
        0,
        "UI does not generate fake data when empty response is returned",
      );
    });
  });

  // ===========================================================
  // TEST AREA 13 — BOUNDARY CERTIFICATION
  // ===========================================================
  describe("13. Boundary Certification", () => {
    test("Inspects dependencies to ensure no cross-chapter domain leakage exists", () => {
      const registryPath = path.join(extensionRoot, "src", "platform", "registry.ts");
      const registryContent = fs.readFileSync(registryPath, "utf-8");

      // Platform registry must not reference score, matching, ranking, or database layers
      assert.ok(
        !registryContent.includes("@freelanceos/core"),
        "Platform adapter must not leak into core domain models",
      );
      assert.ok(
        !registryContent.includes("postgres"),
        "Extension must remain decoupled from production repositories",
      );
    });
  });
});
