import test, { describe } from "node:test";
import assert from "node:assert";
import { indexedDB, IDBKeyRange } from "fake-indexeddb";
// Mock globals for testing
global.indexedDB = indexedDB;
global.IDBKeyRange = IDBKeyRange;
// Mock navigator
Object.defineProperty(global, 'navigator', {
    value: { onLine: true },
    writable: true,
    configurable: true
});
global.chrome = {
    storage: { session: { get: async () => ({ FREELANCEOS_AUTH_TOKEN: "valid-token", FREELANCEOS_TENANT_ID: "tenant-1" }) } },
    tabs: { query: () => { } },
    runtime: { onStartup: { addListener: () => { } } }
};
global.self = { addEventListener: () => { } };
import { IDBQueue } from "../src/storage/indexeddb.js";
import { EdgeResilienceSyncEngine } from "../src/storage/resilience-queue.js";
describe("9G Offline Queue & Edge Resilience", () => {
    test("A. Persistence: enqueue survives multiple items and reads correctly", async () => {
        const queue = new IDBQueue("test-db", "test-store");
        await queue.enqueue({ id: "1", data: { val: 1 }, retryCount: 0, timestamp: Date.now() });
        await queue.enqueue({ id: "2", data: { val: 2 }, retryCount: 0, timestamp: Date.now() });
        const item1 = await queue.peekFirst();
        if (item1)
            await queue.remove(item1.id);
        const item2 = await queue.peekFirst();
        if (item2)
            await queue.remove(item2.id);
        const item3 = await queue.peekFirst();
        assert.strictEqual(item1?.id, "1");
        assert.strictEqual(item2?.id, "2");
        assert.strictEqual(item3, null);
    });
    test("B. Retry: Exponential backoff/controlled retry avoids infinite loops", async () => {
        const engine = new EdgeResilienceSyncEngine();
        // Force offline to queue
        global.navigator.onLine = false;
        await engine.enqueue({ id: "test-retry", endpoint: "http://mock", tenantId: "tenant-1", data: {}, timestamp: Date.now() });
        // Check queue
        const item = await engine.queue.peekFirst();
        assert.ok(item);
        assert.strictEqual(item.id, "test-retry");
        // Simulate re-queueing via retry block
        item.retryCount = 3; // Max retries
        await engine.queue.enqueue(item);
        global.navigator.onLine = true;
        // Mock fetch to throw transient error
        global.fetch = async () => { throw new Error("Transient 500"); };
        await engine.triggerSync();
        // Queue should be empty now (permanently dropped)
        const emptyItem = await engine.queue.peekFirst();
        assert.strictEqual(emptyItem, null);
    });
    test("C. Safe Concurrency: Processing lock prevents duplicate consumption", async () => {
        const engine = new EdgeResilienceSyncEngine();
        assert.strictEqual(engine.isProcessing, false);
        // Mock long running process
        let triggerCount = 0;
        engine.processDripFeedQueue = async () => {
            triggerCount++;
            await new Promise(r => setTimeout(r, 100));
        };
        // Fire 3 simultaneous events
        Promise.all([
            engine.triggerSync(),
            engine.triggerSync(),
            engine.triggerSync()
        ]);
        assert.strictEqual(engine.isProcessing, true);
        await new Promise(r => setTimeout(r, 150));
        assert.strictEqual(triggerCount, 1, "Only one processing loop should be active at a time");
    });
    test("D. Authentication & E. Tenant Isolation: sync rejected on revoked/mismatched tenant", async () => {
        const engine = new EdgeResilienceSyncEngine();
        const payload = { id: "test-tenant", endpoint: "http://mock", tenantId: "tenant-WRONG", data: {}, timestamp: Date.now() };
        let fetchCalled = false;
        global.fetch = async () => { fetchCalled = true; return { ok: true }; };
        await engine.enqueue(payload);
        await engine.triggerSync();
        // Fetch should NOT be called due to tenant mismatch
        assert.strictEqual(fetchCalled, false);
    });
});
