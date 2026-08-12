/* eslint-disable @typescript-eslint/no-explicit-any */
import { test, describe } from "node:test";
import assert from "node:assert";
import { PlatformAdapterRegistry, MAX_EXTRACTED_DATA_BYTES } from "../src/platform/registry.js";
import {
  PlatformAdapter,
  PlatformContext,
  ExtractionResult,
  PlatformJobIdentity,
} from "../src/platform/types.js";
import { createPlatformContext, validateContext } from "../src/platform/context.js";
import { MessageDispatcher } from "../src/messaging/dispatcher.js";
import { ExtensionMessageClient } from "../src/messaging/client.js";

describe("Chapter 9C — Platform Adapter Layer & Core Architecture", () => {
  // Mock Adapter A
  class MockUpworkAdapter implements PlatformAdapter {
    readonly identity = "UPWORK";
    canHandle(context: PlatformContext): boolean {
      return context.url.includes("upwork.com");
    }
    async detect(context: PlatformContext): Promise<boolean> {
      return this.canHandle(context);
    }
    async identify(context: PlatformContext): Promise<PlatformJobIdentity> {
      return {
        platform: this.identity,
        externalId: "upwork-job-123",
        canonicalUrl: context.url,
      };
    }
    async extract(context: PlatformContext, signal?: AbortSignal): Promise<ExtractionResult> {
      if (signal?.aborted) {
        throw new Error("AbortError");
      }
      return {
        status: "SUCCESS",
        jobId: await this.identify(context),
        extractedAt: Date.now(),
        data: {
          title: "Senior Node.js Developer ",
          description: "  We need a backend developer with TypeScript expertise. ",
          budget: "$50/hr",
          skills: ["node.js ", " typescript"],
        },
      };
    }
  }

  // Mock Adapter B
  class MockLinkedInAdapter implements PlatformAdapter {
    readonly identity = "LINKEDIN";
    canHandle(context: PlatformContext): boolean {
      if (context.url.includes("fail-during-handle")) {
        throw new Error("Simulation failure in canHandle");
      }
      return context.url.includes("linkedin.com");
    }
    async detect(context: PlatformContext): Promise<boolean> {
      return this.canHandle(context);
    }
    async identify(context: PlatformContext): Promise<PlatformJobIdentity> {
      return {
        platform: this.identity,
        externalId: "linkedin-job-456",
        canonicalUrl: context.url,
      };
    }
    async extract(context: PlatformContext, signal?: AbortSignal): Promise<ExtractionResult> {
      if (signal?.aborted) {
        throw new Error("AbortError");
      }
      return {
        status: "SUCCESS",
        jobId: await this.identify(context),
        extractedAt: Date.now(),
        data: {
          title: "Fullstack Engineer",
          description: "Build frontend popups and options screens.",
          budget: "Negotiable",
          skills: ["react", "chrome-extension"],
        },
      };
    }
  }

  // 1. Contract Tests
  describe("1. Platform Adapter Contracts & Identity", () => {
    test("Verify mock adapter instantiations conform to PlatformAdapter contract", () => {
      const upwork = new MockUpworkAdapter();
      assert.strictEqual(upwork.identity, "UPWORK");
      const ctx = createPlatformContext("https://upwork.com/jobs/123", 1, 0);
      assert.ok(upwork.canHandle(ctx));
    });

    test("Context creation throws error for malformed context inputs", () => {
      assert.throws(() => {
        createPlatformContext("not-a-valid-url", 1, 0);
      });
      assert.throws(() => {
        createPlatformContext("https://upwork.com", -1, 0);
      });
      assert.throws(() => {
        createPlatformContext("https://upwork.com", 1, 1.5);
      });
    });

    test("validateContext checks object parameter structures and returns clean context", () => {
      const validObj = { url: "https://upwork.com/job-123", tabId: 2, frameId: 0 };
      const ctx = validateContext(validObj);
      assert.strictEqual(ctx.url, validObj.url);
      assert.strictEqual(ctx.tabId, validObj.tabId);
    });
  });

  // 2. Registry Tests
  describe("2. Platform Adapter Registry & Resolution", () => {
    test("Can register and list multiple adapters in deterministic order", () => {
      const reg = new PlatformAdapterRegistry();
      const upwork = new MockUpworkAdapter();
      const linkedin = new MockLinkedInAdapter();

      reg.register(upwork);
      reg.register(linkedin);

      const list = reg.list();
      assert.strictEqual(list.length, 2);
      // Resolves deterministically by sorted identity: LINKEDIN before UPWORK
      assert.strictEqual(list[0]?.identity, "LINKEDIN");
      assert.strictEqual(list[1]?.identity, "UPWORK");
    });

    test("Duplicate registration throws stable error", () => {
      const reg = new PlatformAdapterRegistry();
      reg.register(new MockUpworkAdapter());
      assert.throws(() => {
        reg.register(new MockUpworkAdapter());
      }, /Duplicate registration blocked/);
    });

    test("Unregister removes adapter successfully", () => {
      const reg = new PlatformAdapterRegistry();
      reg.register(new MockUpworkAdapter());
      assert.ok(reg.get("UPWORK"));

      reg.unregister("UPWORK");
      assert.strictEqual(reg.get("UPWORK"), undefined);
    });

    test("Registry resolution returns correct adapter or throws on unknown platform", () => {
      const reg = new PlatformAdapterRegistry();
      reg.register(new MockUpworkAdapter());

      const upworkCtx = createPlatformContext("https://upwork.com/job", 1, 0);
      const adapter = reg.resolve(upworkCtx);
      assert.strictEqual(adapter.identity, "UPWORK");

      const unknownCtx = createPlatformContext("https://twitter.com", 1, 0);
      assert.throws(() => {
        reg.resolve(unknownCtx);
      }, /UNKNOWN_PLATFORM/);
    });
  });

  // 3. Security, Output Limits, & Sanitation
  describe("3. Security Boundaries & Output limits", () => {
    test("Extraction output exceeds size threshold fails", async () => {
      const reg = new PlatformAdapterRegistry();
      class OversizedAdapter extends MockUpworkAdapter {
        override async extract(_context: PlatformContext): Promise<ExtractionResult> {
          return {
            status: "SUCCESS",
            extractedAt: Date.now(),
            data: {
              title: "Huge Job",
              description: "a".repeat(MAX_EXTRACTED_DATA_BYTES + 100),
            },
          };
        }
      }
      reg.register(new OversizedAdapter());
      const ctx = createPlatformContext("https://upwork.com/job", 1, 0);
      const res = await reg.executeExtract(reg.get("UPWORK")!, ctx);
      assert.strictEqual(res.status, "FAILED");
      assert.strictEqual(res.error?.code, "OUTPUT_LIMIT_EXCEEDED");
    });

    test("Verify extraction trims and sanitizes string parameters", async () => {
      const reg = new PlatformAdapterRegistry();
      reg.register(new MockUpworkAdapter());
      const ctx = createPlatformContext("https://upwork.com/job", 1, 0);
      const res = await reg.executeExtract(reg.get("UPWORK")!, ctx);
      assert.strictEqual(res.status, "SUCCESS");
      assert.strictEqual(res.data?.title, "Senior Node.js Developer", "Spaces should be trimmed");
      assert.strictEqual(
        res.data?.description,
        "We need a backend developer with TypeScript expertise.",
        "Spaces should be trimmed",
      );
      assert.strictEqual(res.data?.skills?.[0], "node.js", "Skills elements should be trimmed");
    });
  });

  // 4. Timeouts & Cancellation tests
  describe("4. Timeouts & Cancellation", () => {
    test("Active extraction aborts cleanly via AbortSignal", async () => {
      const reg = new PlatformAdapterRegistry();
      reg.register(new MockUpworkAdapter());
      const ctx = createPlatformContext("https://upwork.com/job", 1, 0);
      const controller = new AbortController();
      controller.abort(); // Cancel immediately

      const res = await reg.executeExtract(reg.get("UPWORK")!, ctx, controller.signal);
      assert.strictEqual(res.status, "FAILED");
      assert.strictEqual(res.error?.code, "EXTRACTION_CANCELLED");
    });

    test("Simulate timeout and late response rejection", async () => {
      const reg = new PlatformAdapterRegistry();
      class HangingAdapter extends MockUpworkAdapter {
        override async extract(
          _context: PlatformContext,
          signal?: AbortSignal,
        ): Promise<ExtractionResult> {
          return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
              resolve({
                status: "SUCCESS",
                extractedAt: Date.now(),
                data: { title: "Delayed Job" },
              });
            }, 100);

            signal?.addEventListener("abort", () => {
              clearTimeout(timer);
              reject(new Error("AbortError"));
            });
          });
        }
      }
      reg.register(new HangingAdapter());
      const ctx = createPlatformContext("https://upwork.com/job", 1, 0);

      // Simulate timeout by racing extraction with a quick rejection
      const controller = new AbortController();
      const delay = new Promise<never>((_, reject) => {
        setTimeout(() => {
          controller.abort();
          reject(new Error("TIMEOUT"));
        }, 10);
      });

      await assert.rejects(async () => {
        await Promise.race([reg.executeExtract(reg.get("UPWORK")!, ctx, controller.signal), delay]);
      }, /TIMEOUT/);
    });
  });

  // 5. Adapter Failure Isolation & No state leakage
  describe("5. Error Isolation & State Isolation", () => {
    test("Resolution continues deterministically even if one adapter canHandle throws", () => {
      const reg = new PlatformAdapterRegistry();
      reg.register(new MockLinkedInAdapter()); // canHandle throws if url includes 'fail-during-handle'
      reg.register(new MockUpworkAdapter()); // canHandle returns true for upwork

      const ctx = createPlatformContext("https://upwork.com/jobs/fail-during-handle", 1, 0);
      const resolved = reg.resolve(ctx);
      assert.strictEqual(resolved.identity, "UPWORK");
    });

    test("Stateful adapter cleanup isolates separate tab instances", async () => {
      class StatefulAdapter extends MockUpworkAdapter {
        public lastTabIdProcessed = -1;
        override async extract(context: PlatformContext): Promise<ExtractionResult> {
          this.lastTabIdProcessed = context.tabId;
          return { status: "SUCCESS", extractedAt: Date.now() };
        }
      }
      const adapter = new StatefulAdapter();
      const ctxA = createPlatformContext("https://upwork.com/job", 101, 0);
      await adapter.extract(ctxA);
      assert.strictEqual(adapter.lastTabIdProcessed, 101);

      // New tab instance
      const ctxB = createPlatformContext("https://upwork.com/job", 102, 0);
      await adapter.extract(ctxB);
      assert.strictEqual(
        adapter.lastTabIdProcessed,
        102,
        "State should be overwritten by current tab context",
      );
    });
  });

  // 6. E2E 9B Message Integration
  describe("6. 9B Messaging Protocol Integration", () => {
    test("Simulate typed 9B message routing to 9C platform extraction", async () => {
      const reg = new PlatformAdapterRegistry();
      reg.register(new MockUpworkAdapter());

      const dispatcher = new MessageDispatcher("SERVICE_WORKER");
      dispatcher.registerHandler("EXTRACT_JOB", async (payload: any) => {
        const ctx = validateContext(payload);
        const adapter = reg.resolve(ctx);
        return reg.executeExtract(adapter, ctx);
      });

      const client = new ExtensionMessageClient(async (envelope) => {
        return dispatcher.dispatch(envelope, { contextType: "CONTENT_SCRIPT" });
      });

      const requestPayload = {
        url: "https://upwork.com/jobs/123",
        tabId: 5,
        frameId: 0,
      };

      const res = await client.request<any, ExtractionResult>("EXTRACT_JOB", requestPayload);
      assert.strictEqual(res.status, "SUCCESS");
      assert.strictEqual(res.data?.title, "Senior Node.js Developer");
    });
  });

  // 7. Future Extensibility Test
  describe("7. Extensibility Verification", () => {
    test("Third mock adapter can be registered and resolved without changing core logic", () => {
      const reg = new PlatformAdapterRegistry();
      reg.register(new MockUpworkAdapter());
      reg.register(new MockLinkedInAdapter());

      class MockGithubJobsAdapter implements PlatformAdapter {
        readonly identity = "GITHUB";
        canHandle(context: PlatformContext): boolean {
          return context.url.includes("github.com/jobs");
        }
        async detect(context: PlatformContext): Promise<boolean> {
          return this.canHandle(context);
        }
        async identify(context: PlatformContext): Promise<PlatformJobIdentity> {
          return { platform: this.identity, externalId: "gh-1", canonicalUrl: context.url };
        }
        async extract(_context: PlatformContext): Promise<ExtractionResult> {
          return { status: "SUCCESS", extractedAt: Date.now() };
        }
      }

      reg.register(new MockGithubJobsAdapter());
      const ctx = createPlatformContext("https://github.com/jobs/dev-1", 1, 0);
      const resolved = reg.resolve(ctx);
      assert.strictEqual(resolved.identity, "GITHUB");
    });
  });
});
