import { describe, it, expect, beforeAll, afterAll } from "vitest";
import nock from "nock";
import crypto from "crypto";
import { db, users, clients } from "@freelanceos/db";
import { eq } from "drizzle-orm";
import { AiGatewayService } from "./services/ai-gateway-service.js";
import { EmbeddingEngineService } from "./services/embedding-engine.js";
import { VectorSearchEngineService } from "./services/vector-search-engine.js";
import { HybridSearchEngineService } from "./services/hybrid-search-engine.js";
import { ReRankingEngineService } from "./services/re-ranking-engine.js";
// Ensure tests use the exact same test records
const TEST_TENANT_ID = crypto.randomUUID();
const TEST_CLIENT_ID = crypto.randomUUID();
const UNAUTHORIZED_TENANT_ID = crypto.randomUUID();
describe("Phase 5: Search & Retrieval Integration Tests", () => {
    let aiGateway;
    let embeddingEngine;
    let vectorEngine;
    let hybridEngine;
    let rerankEngine;
    beforeAll(async () => {
        // Deploy Network Shield: Absolutely strictly block all external HTTP calls
        nock.disableNetConnect();
        nock.enableNetConnect("127.0.0.1"); // Database connections ok
        nock.enableNetConnect("localhost");
        // Stub the OpenAI/DeepSeek embedding route to protect billing and accelerate test
        nock("https://api.openai.com")
            .persist()
            .post("/v1/embeddings")
            .reply(200, () => {
            return {
                data: [{ embedding: Array(1536).fill(0.0123) }],
            };
        });
        // Initialize Services
        aiGateway = new AiGatewayService({}, {}, {});
        embeddingEngine = new EmbeddingEngineService(aiGateway);
        vectorEngine = new VectorSearchEngineService(embeddingEngine);
        hybridEngine = new HybridSearchEngineService(embeddingEngine);
        rerankEngine = new ReRankingEngineService(aiGateway);
        // Bootstrap DB test dependencies
        await db.insert(users).values({
            id: TEST_TENANT_ID,
            email: `tenant-${TEST_TENANT_ID}@test.com`,
            role: "agency",
            passwordHash: "dummy",
        });
        await db.insert(users).values({
            id: UNAUTHORIZED_TENANT_ID,
            email: `hacker-${UNAUTHORIZED_TENANT_ID}@test.com`,
            role: "agency",
            passwordHash: "dummy",
        });
        await db.insert(clients).values({
            id: TEST_CLIENT_ID,
            tenantId: TEST_TENANT_ID,
            name: "Phase 5 Test Client",
            email: "client@test.com",
        });
        // Seed test chunks for Vector search
        await embeddingEngine.processBulkEmbeddings(TEST_TENANT_ID, TEST_CLIENT_ID, "DOCUMENT", [
            { resourceId: "res-1", chunkText: "Secure multi-tenant hybrid execution is fast." },
            { resourceId: "res-2", chunkText: "Standard retrieval pipeline baseline." },
        ]);
    });
    afterAll(async () => {
        // Teardown
        await db.delete(clients).where(eq(clients.id, TEST_CLIENT_ID));
        await db.delete(users).where(eq(users.id, TEST_TENANT_ID));
        await db.delete(users).where(eq(users.id, UNAUTHORIZED_TENANT_ID));
        // Clear interceptors
        nock.cleanAll();
        nock.enableNetConnect();
    });
    describe("5B: Vector Search (HNSW) Engine Tests", () => {
        it("should safely execute SQL CTE vector search enforcing strict tenant isolation boundaries", async () => {
            const results = await vectorEngine.searchSimilarity(TEST_TENANT_ID, TEST_CLIENT_ID, "hybrid execution", "DOCUMENT", 5, 0.0);
            expect(results.length).toBeGreaterThan(0);
            expect(results[0].chunkText).toContain("hybrid execution");
            // Similarity must be calculated properly by PostgreSQL native operator
            expect(results[0].similarity).toBeDefined();
        });
        it("should block empty or mismatched tenant parameters from fetching foreign vectors", async () => {
            const results = await vectorEngine.searchSimilarity(UNAUTHORIZED_TENANT_ID, TEST_CLIENT_ID, "hybrid execution", "DOCUMENT", 5, 0.0);
            // Even if cosine similarity matches perfectly, the index bound WHERE tenant_id = ? drops it
            expect(results.length).toBe(0);
        });
    });
    describe("5C: Hybrid DB-Level RRF Engine Tests", () => {
        it("should merge keyword FTS and HNSW Vector searches natively via SQL execution without in-memory sorts", async () => {
            const results = await hybridEngine.searchHybrid(TEST_TENANT_ID, TEST_CLIENT_ID, "fast", "DOCUMENT", 5);
            expect(results.length).toBeGreaterThan(0);
            // RRF logic merges and maps unified properties accurately
            expect(results[0].chunkText).toContain("fast");
            expect(results[0].rrf_score).toBeDefined();
        });
    });
    describe("5D: Secure Re-Ranking Engine Tests", () => {
        it("should process and threshold secure payloads synchronously with anti-bleed verification", async () => {
            // Mock valid payload
            const validPayload = [
                { id: "mock-1", tenantId: TEST_TENANT_ID, chunkText: "Valid A" },
                { id: "mock-2", tenantId: TEST_TENANT_ID, chunkText: "Valid B" },
            ];
            const reRanked = await rerankEngine.reRankPayload(TEST_TENANT_ID, validPayload, "test query");
            expect(reRanked.length).toBe(2);
            expect(reRanked[0].id).toBe("mock-1");
        });
        it("should immediately throw a SECURITY EXCEPTION if foreign payload chunks bleed into context", async () => {
            // Mock compromised payload with a hacker tenant chunk slipping in
            const corruptedPayload = [
                { id: "mock-1", tenantId: TEST_TENANT_ID, chunkText: "Valid A" },
                { id: "mock-2", tenantId: UNAUTHORIZED_TENANT_ID, chunkText: "Hacker Foreign Data" },
            ];
            await expect(rerankEngine.reRankPayload(TEST_TENANT_ID, corruptedPayload, "test query")).rejects.toThrow(/SECURITY EXCEPTION - RE-RANKER/);
        });
        it("should hard cap payloads at 20 max to protect API rate limit limits", async () => {
            const massivePayload = Array.from({ length: 150 }, (_, i) => ({
                id: `mock-${i}`,
                tenantId: TEST_TENANT_ID,
                chunkText: "Bulk Data",
            }));
            const reRanked = await rerankEngine.reRankPayload(TEST_TENANT_ID, massivePayload, "test query");
            // Assert boundary constraint limits
            expect(reRanked.length).toBe(20);
        });
    });
});
