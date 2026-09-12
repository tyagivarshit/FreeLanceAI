import test from "node:test";
import assert from "node:assert";
import nock from "nock";
import { Redis } from "ioredis";
import { ReplyGenerationEngineService } from "./services/generation-engine.service.js";
import { ReplyRewriteEngineService } from "./services/rewrite-engine.service.js";
import { ReplyToneEngineService } from "./services/tone-engine.service.js";
import { ReplyGrammarEngineService } from "./services/grammar-engine.service.js";

// 1. DEPLOY GLOBAL NETWORK SHIELD
// Guaranteed absolute protection against live OpenAI/DeepSeek billing leaks.
nock.disableNetConnect();
nock.enableNetConnect((host) => {
  return host.includes("localhost") || host.includes("127.0.0.1");
});

test("Phase 7: Reply Studio Integration Suite", async (t) => {
  const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
  const redis = new Redis(redisUrl);
  
  const generationEngine = new ReplyGenerationEngineService(redisUrl);
  const rewriteEngine = new ReplyRewriteEngineService(redisUrl);
  const toneEngine = new ReplyToneEngineService(redisUrl);
  const grammarEngine = new ReplyGrammarEngineService(redisUrl);

  // 2. WIRE GRACEFUL WORKER TEARDOWN
  const abortController = new AbortController();

  // Start the infinite while(true) loops with the abort signal injected
  const workerPromises = [
    generationEngine.startWorker(abortController.signal),
    rewriteEngine.startWorker(abortController.signal),
    toneEngine.startWorker(abortController.signal),
    grammarEngine.startWorker(abortController.signal)
  ];

  t.after(async () => {
    // Graceful teardown prevents test runner hanging
    abortController.abort();
    // Wait for the final 1-second brpop timeouts to clear and exit
    await Promise.all(workerPromises);
    await redis.quit();
  });

  await t.test("1. Cross-tenant asset extraction attempts safely throw triple-lock security exceptions", async () => {
    // Inject mismatched client owner
    await redis.set("tenant:client:client_7a:owner", "tenant_A");
    
    await assert.rejects(
      generationEngine.enqueueProposalGeneration({
        tenantId: "tenant_B", // Mismatch
        clientId: "client_7a",
        userPrompt: "Generate a proposal"
      }),
      /Security Violation|Tenant Isolation Violation/,
      "Generation Engine must block cross-tenant client access"
    );

    // Inject matching client owner but mismatched document owner
    await redis.set("tenant:client:client_7b:owner", "tenant_B");
    await redis.set("tenant:document:doc_7b:owner", "tenant_A");

    await assert.rejects(
      rewriteEngine.enqueueTextRewrite({
        tenantId: "tenant_B",
        clientId: "client_7b",
        documentId: "doc_7b", // Mismatched doc
        originalText: "Hello",
        rewriteInstructions: "Fix it"
      }),
      /Tenant Isolation Violation/,
      "Rewrite Engine must block cross-tenant document access"
    );

    // Inject mismatched tone profile
    await redis.set("tenant:client:client_7c:owner", "tenant_C");
    await redis.set("tenant:profile:prof_7c:owner", "tenant_A");

    await assert.rejects(
      toneEngine.enqueueToneAdjustment({
        tenantId: "tenant_C",
        clientId: "client_7c",
        profileId: "prof_7c", // Mismatched profile
        originalText: "Hello",
        targetTone: "professional"
      }),
      /Tenant Isolation Violation/,
      "Tone Engine must block cross-tenant profile IP extraction"
    );
  });

  await t.test("2. Async pub/sub stream generation successfully mocks DeepSeek real-time stream blocks", async () => {
    // Setup matched owner
    await redis.set("tenant:client:client_mock:owner", "tenant_mock");

    // Intercept DeepSeek POST with strict stream simulation payload
    nock("https://api.deepseek.com")
      .post("/chat/completions")
      .reply(200, 'data: {"choices":[{"delta":{"content":"Success"}}]}\n\ndata: [DONE]\n', {
        'Content-Type': 'text/event-stream'
      });

    // Independent Redis connection to subscribe to tokens
    const subscriber = new Redis(redisUrl);
    
    const jobId = await grammarEngine.enqueueGrammarEnhancement({
      tenantId: "tenant_mock",
      clientId: "client_mock",
      originalText: "Helo world",
      enhancementLevel: "light"
    });

    const channel = `ai:stream:${jobId}`;
    await subscriber.subscribe(channel);

    // Synchronously wait for the asynchronous Pub/Sub stream worker completion
    const streamResult = await new Promise<string>((resolve, reject) => {
      let fullText = "";
      const timeout = setTimeout(() => reject(new Error("Stream timeout threshold exceeded")), 5000);

      subscriber.on("message", (subChannel, message) => {
        if (subChannel === channel) {
          const payload = JSON.parse(message);
          if (payload.type === "chunk") {
            fullText += payload.text;
          }
          if (payload.type === "done") {
            clearTimeout(timeout);
            resolve(fullText);
          }
          if (payload.type === "error") {
            clearTimeout(timeout);
            reject(new Error(payload.error));
          }
        }
      });
    });

    assert.strictEqual(streamResult, "Success", "Pub/Sub stream should perfectly relay intercepted chunks");
    
    await subscriber.unsubscribe(channel);
    await subscriber.quit();
  });
});
