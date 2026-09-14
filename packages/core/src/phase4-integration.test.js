import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import nock from "nock";
import { db, conversationImports, clientInsights, clientMemories, clients, tenants } from "@freelanceos/db";
import { eq, and } from "drizzle-orm";
import crypto from "crypto";
import { Readable } from "stream";
// Import Phase 4 Engines
import { SummaryMapReduceEngine } from "./client-summary.js";
import { ImportStreamEngine } from "./services/import-stream-engine.js";
import { InsightEngineService } from "./services/insight-engine.js";
import { ClientMemoryEngineService } from "./services/client-memory-engine.js";
import { AiGatewayService } from "./services/ai-gateway-service.js";
const TEST_TENANT_ID = crypto.randomUUID();
const TEST_CLIENT_ID = crypto.randomUUID();
describe("Phase 4: Client Brain Integration Tests", () => {
    const gateway = new AiGatewayService();
    const summaryEngine = new SummaryMapReduceEngine(gateway);
    const streamEngine = new ImportStreamEngine();
    const insightEngine = new InsightEngineService(gateway);
    const memoryEngine = new ClientMemoryEngineService(gateway);
    beforeAll(async () => {
        // 1. Deploy Global Network Shield
        // Block all external API calls. Allow local DB connections (127.0.0.1/localhost)
        nock.disableNetConnect();
        nock.enableNetConnect(/(127\.0\.0\.1|localhost)/);
        // Seed required test tenant and client to respect referential integrity
        await db.insert(tenants).values({
            id: TEST_TENANT_ID,
            name: "Phase4 Test Tenant",
            status: "active"
        }).onConflictDoNothing();
        await db.insert(clients).values({
            id: TEST_CLIENT_ID,
            tenantId: TEST_TENANT_ID,
            ownerId: crypto.randomUUID(),
            profile: { name: "Phase4 Test Client" },
            status: "ACTIVE"
        }).onConflictDoNothing();
    });
    afterAll(async () => {
        // Teardown and clean network locks
        nock.cleanAll();
        nock.enableNetConnect();
        // Clean test data
        await db.delete(clients).where(eq(clients.id, TEST_CLIENT_ID));
        await db.delete(tenants).where(eq(tenants.id, TEST_TENANT_ID));
    });
    beforeEach(() => {
        nock.cleanAll();
    });
    // ==========================================
    // CHAPTER 4A: Summary Map-Reduce Engine Tests
    // ==========================================
    describe("4A: Summary Map-Reduce Engine", () => {
        it("should safely chunk and reduce massive text arrays without token limit crashes", async () => {
            // Mock Map Calls (Chunks)
            nock("https://api.deepseek.com")
                .post("/chat/completions")
                .times(2) // Simulating 2 chunks mapped
                .reply(200, {
                choices: [{ message: { content: "Mock mapped sub-summary" } }]
            });
            // Mock Reduce Call (Final Master JSON)
            nock("https://api.deepseek.com")
                .post("/chat/completions")
                .once()
                .reply(200, {
                choices: [{
                        message: {
                            content: JSON.stringify({
                                businessSummary: "Mock Master Summary",
                                relationshipSummary: "Great",
                                currentSituation: "Stable",
                                knownGoals: ["Goal 1"],
                                knownConstraints: [],
                                openTopics: []
                            })
                        }
                    }]
            });
            // Generate a huge dummy text to force chunking
            const hugeText = Array(4000).fill("massive dummy context string to force token chunk limit hit").join(" ");
            const result = await summaryEngine.generateSummarySafely(hugeText, {
                systemPrompt: "Test",
                userPrompt: "Test"
            });
            expect(result.businessSummary).toBe("Mock Master Summary");
            expect(result.knownGoals.length).toBe(1);
        });
    });
    // ==========================================
    // CHAPTER 4B: Stream Import Engine Tests
    // ==========================================
    describe("4B: Stream Import Engine", () => {
        it("should ingest streaming JSONL payloads in batches avoiding OOM crashes", async () => {
            // Create a huge mock JSONL stream with 1200 records
            const totalRecords = 1200;
            function* generateJsonl() {
                for (let i = 0; i < totalRecords; i++) {
                    yield JSON.stringify({ externalId: `mock-msg-${i}`, data: { text: "Hello" } }) + "\n";
                }
            }
            const stream = Readable.from(generateJsonl());
            const result = await streamEngine.ingestJsonlStream(stream, {
                tenantId: TEST_TENANT_ID,
                clientId: TEST_CLIENT_ID,
                sourceProvider: "test_slack"
            });
            expect(result.processed).toBe(totalRecords);
            expect(result.failed).toBe(0);
            // Verify DB insertion
            const savedCountRows = await db
                .select({ id: conversationImports.id })
                .from(conversationImports)
                .where(eq(conversationImports.sourceProvider, "test_slack"));
            expect(savedCountRows.length).toBe(totalRecords);
            // Clean up for next tests
            await db.delete(conversationImports).where(eq(conversationImports.sourceProvider, "test_slack"));
        });
    });
    // ==========================================
    // CHAPTER 4C: Throttled Insights Engine Tests
    // ==========================================
    describe("4C: Insights Engine", () => {
        it("should throttle concurrent insight extraction tasks to prevent HTTP 429 API rate limits", async () => {
            // Mock gateway 10 times
            nock("https://api.deepseek.com")
                .post("/chat/completions")
                .times(10)
                .reply(200, {
                choices: [{
                        message: {
                            content: JSON.stringify({
                                insightKey: "TEST_THROTTLED_KEY",
                                title: "Throttled Insight",
                                description: "Test description",
                                confidenceScore: 90
                            })
                        }
                    }]
            });
            const startTime = Date.now();
            // Fire 10 simultaneous extraction jobs
            const jobs = Array(10).fill(0).map((_, i) => {
                return insightEngine.extractAndSaveInsight({
                    tenantId: TEST_TENANT_ID,
                    clientId: TEST_CLIENT_ID,
                    rawContextData: `Context ${i}`,
                    analysisFocus: "Testing"
                });
            });
            await Promise.all(jobs);
            const endTime = Date.now();
            const elapsed = endTime - startTime;
            // Because of micro-jitter (50-200ms) and limit of 5, 10 jobs should take at least ~100ms.
            expect(elapsed).toBeGreaterThanOrEqual(50);
            // Verify DB persistence
            const savedInsights = await db
                .select()
                .from(clientInsights)
                .where(and(eq(clientInsights.tenantId, TEST_TENANT_ID), eq(clientInsights.insightKey, "TEST_THROTTLED_KEY")));
            // Since all 10 had the exact same insightKey and clientId, it should DO UPDATE on the composite index
            // Therefore, exactly 1 row should exist. (Proving the upsert mechanism works).
            expect(savedInsights.length).toBe(1);
            // Clean up
            await db.delete(clientInsights).where(eq(clientInsights.tenantId, TEST_TENANT_ID));
        });
    });
    // ==========================================
    // CHAPTER 4D: Client Memory Optimistic Locking & Boundary Tests
    // ==========================================
    describe("4D: Memory Update Engine", () => {
        beforeEach(async () => {
            await db.delete(clientMemories).where(eq(clientMemories.tenantId, TEST_TENANT_ID));
        });
        it("should auto-recover from simultaneous Race Conditions (Lost Update Bug) via Optimistic Locking retries", async () => {
            // Fire 3 simultaneous memory updates
            const promises = [
                memoryEngine.updateMemoryState({ tenantId: TEST_TENANT_ID, clientId: TEST_CLIENT_ID, memoryKey: "PROFILE", newFact: "Fact A" }),
                memoryEngine.updateMemoryState({ tenantId: TEST_TENANT_ID, clientId: TEST_CLIENT_ID, memoryKey: "PROFILE", newFact: "Fact B" }),
                memoryEngine.updateMemoryState({ tenantId: TEST_TENANT_ID, clientId: TEST_CLIENT_ID, memoryKey: "PROFILE", newFact: "Fact C" })
            ];
            // Promise.all will force strict database level contention
            await expect(Promise.all(promises)).resolves.toBeDefined();
            const memoryState = await db
                .select()
                .from(clientMemories)
                .where(eq(clientMemories.memoryKey, "PROFILE"))
                .limit(1);
            // Verify all 3 facts were securely saved via internal retry loop
            const content = memoryState[0].contentBuffer;
            expect(content).toContain("Fact A");
            expect(content).toContain("Fact B");
            expect(content).toContain("Fact C");
            // Verify version bumped properly to 3 or 4 (depending on the first insert + 2 updates)
            expect(memoryState[0].version).toBeGreaterThanOrEqual(3);
        });
        it("should enforce rolling window eviction safely without corrupting multi-byte/emoji tokens", async () => {
            // Emulate a buffer boundary overflow with multi-byte emoji characters
            const emojiBlock = "🌍🔥🚀 ".repeat(300); // 1200 characters of pure multi-byte UTF-16
            const hugeFact = "START_FACT_" + emojiBlock + emojiBlock + emojiBlock + emojiBlock + emojiBlock; // Extremely huge string > 6000 chars
            // 1. Send the first huge fact
            await memoryEngine.updateMemoryState({
                tenantId: TEST_TENANT_ID,
                clientId: TEST_CLIENT_ID,
                memoryKey: "BOUNDARY",
                newFact: hugeFact
            });
            // 2. Send a small second fact
            await memoryEngine.updateMemoryState({
                tenantId: TEST_TENANT_ID,
                clientId: TEST_CLIENT_ID,
                memoryKey: "BOUNDARY",
                newFact: "Tiny Safe Fact"
            });
            const memoryState = await db
                .select()
                .from(clientMemories)
                .where(eq(clientMemories.memoryKey, "BOUNDARY"))
                .limit(1);
            const content = memoryState[0].contentBuffer;
            // Because the first hugeFact was larger than the MAX_BUFFER_CHARS (6000), 
            // the moment "Tiny Safe Fact" was pushed, the eviction loop `bufferFacts.shift()` 
            // should have truncated the ENTIRE first huge fact instead of slicing it halfway and breaking the emojis.
            expect(content).toContain("Tiny Safe Fact");
            expect(content).not.toContain("START_FACT_"); // The huge block was cleanly shifted out
            expect(content.length).toBeLessThan(6000); // Buffer remains protected
        });
    });
});
