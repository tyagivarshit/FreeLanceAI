/* eslint-disable @typescript-eslint/no-explicit-any */
import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import { LinkedInAdapter } from "../src/platform/linkedin.js";
import { createPlatformContext } from "../src/platform/context.js";
import { PlatformAdapterRegistry } from "../src/platform/registry.js";
import { MessageDispatcher } from "../src/messaging/dispatcher.js";
import { ExtensionMessageClient } from "../src/messaging/client.js";

// Mock global document & window for Node.js tests
const originalDocument = (global as any).document;
const originalWindow = (global as any).window;
const originalChrome = (global as any).chrome;
const originalNode = (global as any).Node;

describe("Chapter 9E — LinkedIn Platform Adapter Tests", () => {
  const mockElements = new Map<string, any>();
  let mockLocationUrl = "https://www.linkedin.com/jobs/view/123456789";

  beforeEach(() => {
    mockElements.clear();
    mockLocationUrl = "https://www.linkedin.com/jobs/view/123456789";

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
    const adapter = new LinkedInAdapter();

    test("Accepts valid LinkedIn job detail URLs", () => {
      const urls = [
        "https://www.linkedin.com/jobs/view/123456789",
        "https://linkedin.com/jobs/view/some-title-slug-987654321",
        "https://www.linkedin.com/jobs/search/?currentJobId=123456789",
        "https://www.linkedin.com/jobs/collections/recommended/?currentJobId=987654321&currentJobId=112233",
      ];

      for (const url of urls) {
        const ctx = createPlatformContext(url, 1, 0);
        assert.ok(adapter.canHandle(ctx), `Should handle: ${url}`);
      }
    });

    test("Rejects lookalike and invalid domains", () => {
      const urls = [
        "https://evil-linkedin.com/jobs/view/123456789",
        "https://linkedin.com.evil.com/jobs/view/123456789",
        "https://google.com/jobs/view/123456789",
      ];

      for (const url of urls) {
        const ctx = createPlatformContext(url, 1, 0);
        assert.strictEqual(adapter.canHandle(ctx), false, `Should reject lookalike: ${url}`);
      }
    });

    test("Rejects non-job LinkedIn pages", () => {
      const urls = [
        "https://www.linkedin.com/",
        "https://www.linkedin.com/feed",
        "https://www.linkedin.com/in/some-user-profile",
        "https://www.linkedin.com/company/google",
        "https://www.linkedin.com/messaging/",
        "https://www.linkedin.com/notifications",
        "https://www.linkedin.com/settings/",
      ];

      for (const url of urls) {
        const ctx = createPlatformContext(url, 1, 0);
        assert.strictEqual(adapter.canHandle(ctx), false, `Should reject non-job page: ${url}`);
      }
    });

    test("Rejects non-HTTPS protocol", () => {
      const ctx = createPlatformContext("https://www.linkedin.com/jobs/view/123456789", 1, 0);
      const httpCtx = { ...ctx, url: "http://www.linkedin.com/jobs/view/123456789" };
      assert.strictEqual(adapter.canHandle(httpCtx), false);
    });
  });

  // 2. Job Identity Extraction
  describe("2. Job Identity Extraction", () => {
    const adapter = new LinkedInAdapter();

    test("Extracts job identity and formats stable canonical URL", async () => {
      const ctx = createPlatformContext(
        "https://www.linkedin.com/jobs/view/software-engineer-123456789?refId=123",
        1,
        0,
      );
      const identity = await adapter.identify(ctx);
      assert.strictEqual(identity.platform, "LINKEDIN");
      assert.strictEqual(identity.externalId, "123456789");
      assert.strictEqual(identity.canonicalUrl, "https://www.linkedin.com/jobs/view/123456789");
    });
  });

  // 3. DOM Scraping, Warnings & Data Integrity
  describe("3. DOM Scraping & Field Extraction", () => {
    const adapter = new LinkedInAdapter();
    adapter.domTimeoutMs = 20;

    test("Extracts complete job detail successfully (status: SUCCESS)", async () => {
      // Setup mock DOM elements
      setMockElement(".job-details-jobs-unified-top-card__job-title", "Senior React Developer");
      setMockElement("#job-details", {
        nodeType: 1,
        childNodes: [
          { nodeType: 3, textContent: "We need a Senior React developer." },
          { nodeType: 1, tagName: "BR", textContent: "" },
          { nodeType: 3, textContent: "Must have TypeScript experience." },
        ],
      });
      setMockElement(".job-details-jobs-unified-top-card__company-name a", "Google");
      setMockElement(".job-details-jobs-unified-top-card__bullet", "Mountain View, CA");
      setMockElement(".jobs-unified-top-card__workplace-type", "Hybrid");

      // Employment type & Seniority are often listed in insights
      setMockElement(".jobs-unified-top-card__job-insight", ["Full-time", "Mid-Senior level"]);

      // Skills
      setMockElement('.jobs-description__content a[href*="/skills/"]', [
        "React",
        "TypeScript",
        "Redux",
      ]);

      // Salary
      setMockElement(".jobs-unified-top-card__salary", "$160,000/yr - $190,000/yr");

      const ctx = createPlatformContext("https://www.linkedin.com/jobs/view/123456789", 1, 0);
      const result = await adapter.extract(ctx);

      assert.strictEqual(result.status, "SUCCESS");
      assert.strictEqual(result.jobId?.externalId, "123456789");
      assert.strictEqual(result.data?.title, "Senior React Developer");
      assert.strictEqual(
        result.data?.description,
        "We need a Senior React developer.\nMust have TypeScript experience.",
      );
      assert.strictEqual(result.data?.metadata?.company, "Google");
      assert.strictEqual(result.data?.metadata?.location, "Mountain View, CA");
      assert.strictEqual(result.data?.metadata?.workplaceType, "Hybrid");
      assert.strictEqual(result.data?.metadata?.employmentType, "Full-time");
      assert.strictEqual(result.data?.experience, "Mid-Senior level");
      assert.strictEqual(result.data?.metadata?.seniority, "Mid-Senior level");
      assert.deepStrictEqual(result.data?.skills, ["React", "TypeScript", "Redux"]);
      assert.strictEqual(result.data?.metadata?.salaryMin, "160000");
      assert.strictEqual(result.data?.metadata?.salaryMax, "190000");
      assert.strictEqual(result.data?.metadata?.salaryCurrency, "USD");
      assert.strictEqual(result.data?.metadata?.salaryPeriod, "yearly");
      assert.strictEqual(result.data?.budget, "$160,000/yr - $190,000/yr");
      assert.strictEqual(result.warnings, undefined);
    });

    test("Extracts partial job details (status: PARTIAL)", async () => {
      setMockElement(".job-details-jobs-unified-top-card__job-title", "Minimal Job Post");
      setMockElement("#job-details", "Description text only.");

      const ctx = createPlatformContext("https://www.linkedin.com/jobs/view/123456789", 1, 0);
      const result = await adapter.extract(ctx);

      assert.strictEqual(result.status, "PARTIAL");
      assert.ok(result.warnings && result.warnings.length > 0);

      // Verify warnings matrix
      const warningCodes = result.warnings?.map((w) => w.code) || [];
      assert.ok(warningCodes.includes("MISSING_COMPANY"));
      assert.ok(warningCodes.includes("MISSING_LOCATION"));
      assert.ok(warningCodes.includes("MISSING_WORKPLACE_TYPE"));
      assert.ok(warningCodes.includes("MISSING_EMPLOYMENT_TYPE"));
      assert.ok(warningCodes.includes("MISSING_SENIORITY"));
      assert.ok(warningCodes.includes("MISSING_SKILLS"));
      assert.ok(warningCodes.includes("MISSING_SALARY"));

      // Verify no-fabrication rule (missing data remains missing/undefined)
      assert.strictEqual(result.data?.metadata?.company, undefined);
      assert.strictEqual(result.data?.metadata?.location, undefined);
      assert.strictEqual(result.data?.metadata?.workplaceType, undefined);
      assert.strictEqual(result.data?.metadata?.salaryMin, undefined);
      assert.strictEqual(result.data?.skills, undefined);
    });

    test("Fails extraction if critical field title is missing", async () => {
      setMockElement("#job-details", "Description text only.");

      const ctx = createPlatformContext("https://www.linkedin.com/jobs/view/123456789", 1, 0);
      const result = await adapter.extract(ctx);

      assert.strictEqual(result.status, "FAILED");
      assert.strictEqual(result.error?.code, "MISSING_CRITICAL_FIELD");
    });

    test("Fails extraction if critical field description is missing", async () => {
      setMockElement(".job-details-jobs-unified-top-card__job-title", "React Lead");

      const ctx = createPlatformContext("https://www.linkedin.com/jobs/view/123456789", 1, 0);
      const result = await adapter.extract(ctx);

      assert.strictEqual(result.status, "FAILED");
      assert.strictEqual(result.error?.code, "MISSING_CRITICAL_FIELD");
    });
  });

  // 4. Dynamic DOM & Async Wait
  describe("4. Dynamic DOM Waiting & Cancellation", () => {
    const adapter = new LinkedInAdapter();
    adapter.domTimeoutMs = 20;

    test("Successfully waits for dynamic elements to load", async () => {
      setTimeout(() => {
        setMockElement(".job-details-jobs-unified-top-card__job-title", "Deferred Title");
        setMockElement("#job-details", "Deferred Description");
      }, 10);

      const ctx = createPlatformContext("https://www.linkedin.com/jobs/view/123456789", 1, 0);
      const result = await adapter.extract(ctx);

      assert.strictEqual(result.status, "PARTIAL");
      assert.strictEqual(result.data?.title, "Deferred Title");
    });

    test("Fails if dynamic elements do not load within timeout", async () => {
      const ctx = createPlatformContext("https://www.linkedin.com/jobs/view/123456789", 1, 0);
      const result = await adapter.extract(ctx);

      assert.strictEqual(result.status, "FAILED");
      assert.strictEqual(result.error?.code, "TIMEOUT");
    });

    test("Aborts extraction cleanly during wait", async () => {
      const ctx = createPlatformContext("https://www.linkedin.com/jobs/view/123456789", 1, 0);
      const controller = new AbortController();

      setTimeout(() => {
        controller.abort();
      }, 10);

      const result = await adapter.extract(ctx, controller.signal);
      assert.strictEqual(result.status, "FAILED");
      assert.strictEqual(result.error?.code, "EXTRACTION_CANCELLED");
    });
  });

  // 5. Stale Context & Tab Navigation Isolation
  describe("5. Stale Context Protections", () => {
    const adapter = new LinkedInAdapter();
    adapter.domTimeoutMs = 20;

    test("Fails if page URL navigates away during scraping", async () => {
      setMockElement(".job-details-jobs-unified-top-card__job-title", "Some Title");
      setMockElement("#job-details", "Some description");

      const ctx = createPlatformContext("https://www.linkedin.com/jobs/view/123456789", 1, 0);

      // Simulate tab navigating to another job page
      mockLocationUrl = "https://www.linkedin.com/jobs/view/987654321";

      const result = await adapter.extract(ctx);
      assert.strictEqual(result.status, "FAILED");
      assert.strictEqual(result.error?.code, "STALE_CONTEXT");
    });
  });

  // 6. E2E 9B Message Integration
  describe("6. E2E 9B Message Integration", () => {
    test("Verifies EXTRACT_JOB flow through dispatcher and client using tab delegation", async () => {
      const reg = new PlatformAdapterRegistry();
      const adapter = new LinkedInAdapter();
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
            (global as any).document = doc;

            assert.strictEqual(message.type, "LINKEDIN_EXTRACT_DOM");
            assert.strictEqual(tabId, 99);

            setMockElement(".job-details-jobs-unified-top-card__job-title", "Integrated Title");
            setMockElement("#job-details", "Integrated Description");

            adapter.extract(message.context).then((res) => {
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
        url: "https://www.linkedin.com/jobs/view/123456789",
        tabId: 99,
        frameId: 0,
      });

      (global as any).document = doc;

      assert.strictEqual(res.status, "PARTIAL");
      assert.strictEqual(res.jobId?.externalId, "123456789");
      assert.strictEqual(res.data?.title, "Integrated Title");
      assert.strictEqual(res.data?.description, "Integrated Description");
    });
  });
});
