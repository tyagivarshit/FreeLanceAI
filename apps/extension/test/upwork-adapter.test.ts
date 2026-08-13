/* eslint-disable @typescript-eslint/no-explicit-any */
import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import { UpworkAdapter } from "../src/platform/upwork.js";
import { createPlatformContext } from "../src/platform/context.js";
import { PlatformAdapterRegistry } from "../src/platform/registry.js";
import { MessageDispatcher } from "../src/messaging/dispatcher.js";
import { ExtensionMessageClient } from "../src/messaging/client.js";

// Mock global document & window for Node.js tests
const originalDocument = (global as any).document;
const originalWindow = (global as any).window;
const originalChrome = (global as any).chrome;
const originalNode = (global as any).Node;

describe("Chapter 9D — Upwork Platform Adapter Tests", () => {
  const mockElements = new Map<string, any>();
  let mockLocationUrl = "https://www.upwork.com/jobs/~01abc1234567890def";

  beforeEach(() => {
    mockElements.clear();
    mockLocationUrl = "https://www.upwork.com/jobs/~01abc1234567890def";

    // Setup global window mock
    (global as any).window = {
      location: {
        get href() {
          return mockLocationUrl;
        },
      },
    };

    // Setup global document mock
    (global as any).document = {
      querySelector(selector: string) {
        const val = mockElements.get(selector);
        if (Array.isArray(val)) {
          return val[0] || null;
        }
        return val || null;
      },
      querySelectorAll(selector: string) {
        const val = mockElements.get(selector);
        if (Array.isArray(val)) {
          return val;
        }
        return val ? [val] : [];
      },
    };

    (global as any).Node = {
      TEXT_NODE: 3,
      ELEMENT_NODE: 1,
    };
  });

  afterEach(() => {
    (global as any).document = originalDocument;
    (global as any).window = originalWindow;
    (global as any).chrome = originalChrome;
    (global as any).Node = originalNode;
  });

  // Helper to mock DOM content
  function setMockElement(selector: string, content: string | any[] | any) {
    if (typeof content === "string") {
      mockElements.set(selector, {
        textContent: content,
        childNodes: [{ nodeType: 3, textContent: content }],
      });
    } else if (Array.isArray(content)) {
      mockElements.set(
        selector,
        content.map((c) => ({
          textContent: c,
          childNodes: [{ nodeType: 3, textContent: c }],
        })),
      );
    } else {
      mockElements.set(selector, content);
    }
  }

  // 1. URL Validation & Detection Tests
  describe("1. URL Validation & Page Detection", () => {
    const adapter = new UpworkAdapter();

    test("Accepts valid Upwork job detail URLs", () => {
      const urls = [
        "https://www.upwork.com/jobs/~01abc1234567890def",
        "https://upwork.com/jobs/Some-Job-Title_~01abc1234567890def",
        "https://www.upwork.com/ab/jobs/search/details/~01abc1234567890def",
        "https://www.upwork.com/freelance-jobs/apply/~01abc1234567890def",
        "https://www.upwork.com/nx/find-work/job-details/~01abc1234567890def",
      ];

      for (const url of urls) {
        const ctx = createPlatformContext(url, 1, 0);
        assert.ok(adapter.canHandle(ctx), `Should handle: ${url}`);
      }
    });

    test("Rejects lookalike and invalid domains", () => {
      const urls = [
        "https://evil-upwork.com/jobs/~01abc1234567890def",
        "https://upwork.com.evil.com/jobs/~01abc1234567890def",
        "https://google.com/jobs/~01abc1234567890def",
      ];

      for (const url of urls) {
        const ctx = createPlatformContext(url, 1, 0);
        assert.strictEqual(adapter.canHandle(ctx), false, `Should reject lookalike: ${url}`);
      }
    });

    test("Rejects non-job Upwork pages", () => {
      const urls = [
        "https://www.upwork.com/",
        "https://www.upwork.com/nx/find-work/",
        "https://www.upwork.com/ab/messages/",
        "https://www.upwork.com/freelancers/~01abc1234567890def", // Profile page
      ];

      for (const url of urls) {
        const ctx = createPlatformContext(url, 1, 0);
        assert.strictEqual(adapter.canHandle(ctx), false, `Should reject non-job page: ${url}`);
      }
    });

    test("Rejects non-HTTPS protocol", () => {
      const ctx = createPlatformContext("https://www.upwork.com/jobs/~01abc1234567890def", 1, 0);
      const httpCtx = { ...ctx, url: "http://www.upwork.com/jobs/~01abc1234567890def" };
      assert.strictEqual(adapter.canHandle(httpCtx), false);
    });
  });

  // 2. Job Identity Extraction
  describe("2. Job Identity Extraction", () => {
    const adapter = new UpworkAdapter();

    test("Extracts job identity and formats stable canonical URL", async () => {
      const ctx = createPlatformContext(
        "https://www.upwork.com/jobs/Some-Job-Title_~01abc1234567890def?query=1",
        1,
        0,
      );
      const identity = await adapter.identify(ctx);
      assert.strictEqual(identity.platform, "UPWORK");
      assert.strictEqual(identity.externalId, "~01abc1234567890def");
      assert.strictEqual(identity.canonicalUrl, "https://www.upwork.com/jobs/~01abc1234567890def");
    });
  });

  describe("3. DOM Scraping & Field Extraction", () => {
    const adapter = new UpworkAdapter();
    adapter.domTimeoutMs = 20;

    test("Extracts complete job detail successfully (status: SUCCESS)", async () => {
      // Setup mock DOM elements
      setMockElement('[data-testid="job-title"]', "Senior TypeScript Developer");
      setMockElement('[data-testid="job-description"]', {
        nodeType: 1,
        childNodes: [
          { nodeType: 3, textContent: "We need a Senior TypeScript developer." },
          { nodeType: 1, tagName: "BR", textContent: "" },
          { nodeType: 3, textContent: "Must have extension experience." },
        ],
      });
      setMockElement('[data-testid="budget"]', "Est. Budget: $1,200 (Fixed-price)");
      setMockElement('[data-testid="skills"] a', ["TypeScript", "Chrome Extension", "Node.js"]);
      setMockElement('[data-testid="client-location"]', "San Francisco, United States");
      setMockElement('[data-testid="experience-level"]', "Expert");
      setMockElement('[data-testid="expected-hours"]', "30+ hrs/week");
      setMockElement('[data-testid="project-length"]', "1 to 3 months");

      const ctx = createPlatformContext("https://www.upwork.com/jobs/~01abc1234567890def", 1, 0);
      const result = await adapter.extract(ctx);

      assert.strictEqual(result.status, "SUCCESS");
      assert.strictEqual(result.jobId?.externalId, "~01abc1234567890def");
      assert.strictEqual(result.data?.title, "Senior TypeScript Developer");
      assert.strictEqual(
        result.data?.description,
        "We need a Senior TypeScript developer.\nMust have extension experience.",
      );
      assert.strictEqual(result.data?.budget, "Est. Budget: $1,200 (Fixed-price)");
      assert.strictEqual(result.data?.metadata?.currency, "USD");
      assert.deepStrictEqual(result.data?.skills, ["TypeScript", "Chrome Extension", "Node.js"]);
      assert.strictEqual(result.data?.metadata?.location, "San Francisco, United States");
      assert.strictEqual(result.data?.experience, "Expert");
      assert.strictEqual(result.data?.metadata?.expectedHours, "30+ hrs/week");
      assert.strictEqual(result.data?.metadata?.projectLength, "1 to 3 months");
      assert.strictEqual(result.warnings, undefined);
    });

    test("Extracts partial job details (status: PARTIAL)", async () => {
      setMockElement('[data-testid="job-title"]', "Minimal Job Post");
      setMockElement('[data-testid="job-description"]', "Description text only.");

      const ctx = createPlatformContext("https://www.upwork.com/jobs/~01abc1234567890def", 1, 0);
      const result = await adapter.extract(ctx);

      assert.strictEqual(result.status, "PARTIAL");
      assert.ok(result.warnings && result.warnings.length > 0);

      // Verify no fabrication
      assert.strictEqual(result.data?.budget, undefined);
      assert.strictEqual(result.data?.skills, undefined);
      assert.strictEqual(result.data?.metadata?.location, undefined);
      assert.strictEqual(result.data?.metadata?.currency, undefined);

      const warningCodes = result.warnings?.map((w) => w.code);
      assert.ok(warningCodes?.includes("MISSING_BUDGET"));
      assert.ok(warningCodes?.includes("MISSING_SKILLS"));
      assert.ok(warningCodes?.includes("MISSING_LOCATION"));
    });

    test("Fails extraction if critical field title is missing", async () => {
      setMockElement('[data-testid="job-description"]', "Valid description");

      const ctx = createPlatformContext("https://www.upwork.com/jobs/~01abc1234567890def", 1, 0);
      const result = await adapter.extract(ctx);

      assert.strictEqual(result.status, "FAILED");
      assert.strictEqual(result.error?.code, "MISSING_CRITICAL_FIELD");
    });

    test("Fails extraction if critical field description is missing", async () => {
      setMockElement('[data-testid="job-title"]', "Valid Title");

      const ctx = createPlatformContext("https://www.upwork.com/jobs/~01abc1234567890def", 1, 0);
      const result = await adapter.extract(ctx);

      assert.strictEqual(result.status, "FAILED");
      assert.strictEqual(result.error?.code, "MISSING_CRITICAL_FIELD");
    });
  });

  describe("4. Dynamic DOM Waiting & Cancellation", () => {
    const adapter = new UpworkAdapter();
    adapter.domTimeoutMs = 20;

    test("Successfully waits for dynamic elements to load", async () => {
      // DOM elements initially missing, then loaded after a delay
      setTimeout(() => {
        setMockElement('[data-testid="job-title"]', "Deferred Title");
        setMockElement('[data-testid="job-description"]', "Deferred Description");
      }, 50);

      const ctx = createPlatformContext("https://www.upwork.com/jobs/~01abc1234567890def", 1, 0);
      const result = await adapter.extract(ctx);

      assert.strictEqual(result.status, "PARTIAL"); // missing optional fields but critical resolved
      assert.strictEqual(result.data?.title, "Deferred Title");
    });

    test("Fails if dynamic elements do not load within timeout", async () => {
      const ctx = createPlatformContext("https://www.upwork.com/jobs/~01abc1234567890def", 1, 0);
      const result = await adapter.extract(ctx);

      assert.strictEqual(result.status, "FAILED");
      assert.strictEqual(result.error?.code, "TIMEOUT");
    });

    test("Aborts extraction cleanly during wait", async () => {
      const ctx = createPlatformContext("https://www.upwork.com/jobs/~01abc1234567890def", 1, 0);
      const controller = new AbortController();

      setTimeout(() => {
        controller.abort();
      }, 30);

      const result = await adapter.extract(ctx, controller.signal);
      assert.strictEqual(result.status, "FAILED");
      assert.strictEqual(result.error?.code, "EXTRACTION_CANCELLED");
    });
  });

  describe("5. Stale Context Protections", () => {
    const adapter = new UpworkAdapter();
    adapter.domTimeoutMs = 20;

    test("Fails if page URL navigates away during scraping", async () => {
      setMockElement('[data-testid="job-title"]', "Some Title");
      setMockElement('[data-testid="job-description"]', "Some description");

      const ctx = createPlatformContext("https://www.upwork.com/jobs/~01abc1234567890def", 1, 0);

      // Simulate tab navigating to another job page
      mockLocationUrl = "https://www.upwork.com/jobs/~02xyz9876543210fed";

      const result = await adapter.extract(ctx);
      assert.strictEqual(result.status, "FAILED");
      assert.strictEqual(result.error?.code, "STALE_CONTEXT");
    });
  });

  // 6. E2E 9B Message Integration
  describe("6. E2E 9B Message Integration", () => {
    test("Verifies EXTRACT_JOB flow through dispatcher and client using tab delegation", async () => {
      const reg = new PlatformAdapterRegistry();
      const adapter = new UpworkAdapter();
      adapter.domTimeoutMs = 20;
      reg.register(adapter);

      const serviceWorkerDispatcher = new MessageDispatcher("SERVICE_WORKER");

      // Register handler in Service Worker
      serviceWorkerDispatcher.registerHandler("EXTRACT_JOB", async (payload: any) => {
        const ctx = createPlatformContext(payload.url, payload.tabId, payload.frameId);
        const resolvedAdapter = reg.resolve(ctx);
        return reg.executeExtract(resolvedAdapter, ctx);
      });

      const doc = (global as any).document;
      delete (global as any).document;

      // Mock chrome extension tab messaging: SW -> Content Script
      (global as any).chrome = {
        runtime: {
          lastError: null,
        },
        tabs: {
          sendMessage(tabId: number, message: any, callback: (response: any) => void) {
            // Restore document for content script context
            (global as any).document = doc;

            // Emulate content script listening to tab messages
            assert.strictEqual(message.type, "UPWORK_EXTRACT_DOM");
            assert.strictEqual(tabId, 42);

            // Scrape mock elements inside the content script
            setMockElement('[data-testid="job-title"]', "Integrated Title");
            setMockElement('[data-testid="job-description"]', "Integrated Description");

            // Execute local DOM scrape using adapter
            adapter.extract(message.context).then((res) => {
              // Remove it again to keep SW context clean
              delete (global as any).document;
              callback(res);
            });
          },
        },
      } as any;

      const client = new ExtensionMessageClient(async (envelope) => {
        return serviceWorkerDispatcher.dispatch(envelope, { contextType: "CONTENT_SCRIPT" });
      });

      const res = await client.request<any, any>("EXTRACT_JOB", {
        url: "https://www.upwork.com/jobs/~01abc1234567890def",
        tabId: 42,
        frameId: 0,
      });

      // Restore document after test is done
      (global as any).document = doc;

      assert.strictEqual(res.status, "PARTIAL");
      assert.strictEqual(res.jobId?.externalId, "~01abc1234567890def");
      assert.strictEqual(res.data?.title, "Integrated Title");
      assert.strictEqual(res.data?.description, "Integrated Description");
    });
  });
});
