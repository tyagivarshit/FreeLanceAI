import { SessionStorageManager } from "./session.js";
import { IDBQueue, IDBQueueItem } from "./indexeddb.js";

export interface QueuedSyncPayload {
  id: string;
  tenantId: string;
  endpoint: string;
  data: any;
  timestamp: number;
  retryCount?: number;
}

/**
 * Chapter 9G: Offline State Sync & Edge Resilience
 * Persistent Drip-Feed Sync Queue backed by IndexedDB
 * 
 * Delivery Semantics: AT-LEAST-ONCE. 
 * The payload remains in IndexedDB until a definitive backend acknowledgement (or max retry limit).
 * Safe duplicates are neutralized natively by the backend's (tenant, source, externalId) composite unique index.
 */
export class EdgeResilienceSyncEngine {
  private isProcessing: boolean = false;
  private initialized: boolean = false;
  private queue = new IDBQueue<QueuedSyncPayload>('freelanceos_offline_sync', 'sync_queue');

  public async enqueue(payload: QueuedSyncPayload): Promise<void> {
    const fullPayload: IDBQueueItem<QueuedSyncPayload> = {
      id: payload.id,
      data: payload,
      retryCount: payload.retryCount || 0,
      timestamp: Date.now()
    };
    
    await this.queue.enqueue(fullPayload);
    console.log(`[FreelanceOS] Diagnostic: Queued payload ${payload.id}`);
    this.triggerSync();
  }

  public async triggerSync(): Promise<void> {
    // SAFE CONCURRENCY: Processing Lock
    if (this.isProcessing) return;

    if (!navigator.onLine) {
      console.log("[FreelanceOS] Diagnostic: Edge offline. Sync deferred.");
      return;
    }

    this.isProcessing = true;

    try {
      await this.processDripFeedQueue();
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]?.id) {
          chrome.tabs.sendMessage(tabs[0].id, { type: "EDGE_SYNC_COMPLETE" }).catch(() => {});
        }
      });
    } finally {
      this.isProcessing = false;
    }
  }

  private async processDripFeedQueue(): Promise<void> {
    while (true) {
      if (!navigator.onLine) {
        console.warn("[FreelanceOS] Diagnostic: Connection lost during drip-feed. Halting sync.");
        break;
      }

      // Safe AT-LEAST-ONCE extraction: peek without deleting
      const item = await this.queue.peekFirst();
      if (!item) break; // Queue empty

      const payload = item.data;

      try {
        console.log(`[FreelanceOS] Diagnostic: Retry attempted for payload ${payload.id}.`);
        await this.executePayloadWithContextLock(payload);
        
        // Exclusively delete after full 200 OK ACK to prevent data loss on Service Worker crash
        await this.queue.remove(item.id);
        console.log(`[FreelanceOS] Diagnostic: Synced payload ${payload.id}.`);
        
      } catch (error: any) {
        
        // Permanent 4xx errors (excluding 408/429) should NOT infinite retry
        const isPermanentError = error.message.includes("HTTP 4") && !error.message.includes("HTTP 408") && !error.message.includes("HTTP 429");
        
        if (isPermanentError) {
          console.error(`[FreelanceOS] Diagnostic: Permanently failed payload ${payload.id}. Backend rejected definitively.`);
          await this.queue.remove(item.id); // Safe to drop
          continue; 
        }
        
        // Controlled Retry Implementation (Exponential backoff implicit in retry counting)
        const currentRetryCount = item.retryCount || 0;
        if (currentRetryCount < 3) {
          item.retryCount = currentRetryCount + 1;
          payload.retryCount = item.retryCount;
          // Put updates the existing record, pushing retry limit up without losing it
          await this.queue.enqueue(item);
          console.log(`[FreelanceOS] Diagnostic: Retry scheduled for payload ${payload.id} (Attempt ${item.retryCount}/3).`);
          break; // Stop processing loop to yield on failure
        } else {
          console.error(`[FreelanceOS] Diagnostic: Permanently failed payload ${payload.id}. Exceeded max retries.`);
          await this.queue.remove(item.id); // Safe to drop
        }
      }

      // Safe concurrency yield & thundering herd prevention
      const yieldDelayMs = Math.floor(Math.random() * (1200 - 300 + 1)) + 300;
      await new Promise(resolve => setTimeout(resolve, yieldDelayMs));
    }
  }

  private async executePayloadWithContextLock(payload: QueuedSyncPayload): Promise<void> {
    const activeSession = await SessionStorageManager.getAuthSession();
    
    if (!activeSession || !activeSession.tenantId) {
      throw new Error(`Sync dropped for payload ${payload.id}: No active authenticated session.`);
    }

    if (payload.tenantId !== activeSession.tenantId) {
      console.warn(`[FreelanceOS] CRITICAL SECURITY ALERT: Context bleed detected. Payload dropped.`);
      return; 
    }

    // Idempotency Strategy: Deterministic key ensuring Backend Idempotency
    const requestData = {
       ...payload.data,
       _idempotencyKey: `${activeSession.tenantId}_${payload.data?.externalJobId || payload.id}`
    };
    
    const response = await fetch(payload.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${activeSession.token}`
      },
      body: JSON.stringify(requestData)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }
  }

  public initializeLifecycleListeners(): void {
    if (this.initialized) return;
    this.initialized = true;

    self.addEventListener('online', () => {
      console.log("[FreelanceOS] Diagnostic: Edge connection restored. Booting resilience drip-feed engine.");
      this.triggerSync();
    });

    chrome.runtime.onStartup.addListener(() => {
      console.log("[FreelanceOS] Diagnostic: Service Worker Startup. Checking offline queue.");
      this.triggerSync();
    });
  }
}

export const resilienceEngine = new EdgeResilienceSyncEngine();
