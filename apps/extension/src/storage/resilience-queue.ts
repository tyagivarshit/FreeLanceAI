import { SessionStorageManager } from "./session.js";

export interface QueuedSyncPayload {
  id: string;
  tenantId: string;
  endpoint: string;
  data: any;
  timestamp: number;
}

/**
 * Chapter 9G: Offline State Sync & Edge Resilience
 * Ephemeral Drip-Feed Sync Queue completely devoid of persistent disk write layers.
 */
export class EdgeResilienceSyncEngine {
  // Ephemeral memory-buffered stack structure. Auto-wipes upon browser close.
  private memoryQueue: QueuedSyncPayload[] = [];
  private isProcessing: boolean = false;

  public enqueue(payload: QueuedSyncPayload): void {
    this.memoryQueue.push(payload);
    console.log(`[FreelanceOS] Payload ${payload.id} queued for edge resilience.`);
    this.triggerSync();
  }

  public async triggerSync(): Promise<void> {
    if (this.isProcessing) return;

    // Check if network is online (in MV3 service worker context, navigator.onLine is available)
    if (!navigator.onLine) {
      console.log("[FreelanceOS] Edge offline. Sync deferred.");
      return;
    }

    this.isProcessing = true;

    try {
      await this.processDripFeedQueue();
      // Broadcast post-commit callback to dynamically push immediate dashboard UI view repaint
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]?.id) {
          chrome.tabs.sendMessage(tabs[0].id, { type: "EDGE_SYNC_COMPLETE" });
        }
      });
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Destroys the Thundering Herd Pollution Risk upon internet reconnection by injecting
   * non-linear, controlled interval delays between each re-transmission.
   */
  private async processDripFeedQueue(): Promise<void> {
    while (this.memoryQueue.length > 0) {
      if (!navigator.onLine) {
        console.warn("[FreelanceOS] Connection lost during drip-feed. Halting sync.");
        break;
      }

      // Dequeue first item
      const payload = this.memoryQueue.shift();
      if (!payload) continue;

      try {
        await this.executePayloadWithContextLock(payload);
      } catch (error) {
        console.error(`[FreelanceOS] Failed to sync payload ${payload.id}. Dropping to avoid infinite loops.`, error);
      }

      // Inject non-linear V8 event-loop yield to prevent IPC buffer overflow crashes
      const yieldDelayMs = Math.floor(Math.random() * (1200 - 300 + 1)) + 300;
      await new Promise(resolve => setTimeout(resolve, yieldDelayMs));
    }
  }

  /**
   * Ironclad Payload Tenant Envelope Validation
   */
  private async executePayloadWithContextLock(payload: QueuedSyncPayload): Promise<void> {
    const activeSession = await SessionStorageManager.getAuthSession();
    
    if (!activeSession || !activeSession.tenantId) {
      console.warn(`[FreelanceOS] Sync dropped for payload ${payload.id}: No active authenticated session.`);
      return;
    }

    if (payload.tenantId !== activeSession.tenantId) {
      console.warn(`[FreelanceOS] CRITICAL SECURITY ALERT: Context bleed detected. Payload tenant (${payload.tenantId}) does not match active session tenant (${activeSession.tenantId}). Payload dropped.`);
      return;
    }

    // Mock firing the pipeline transaction to the Phase 8 backend REST gateway
    console.log(`[FreelanceOS] Drip-feed syncing payload ${payload.id} to ${payload.endpoint}...`);
    // Example: await fetch(payload.endpoint, { method: "POST", body: JSON.stringify(payload.data) });
  }

  public initializeLifecycleListeners(): void {
    // MV3 Service Worker network state listener
    self.addEventListener('online', () => {
      console.log("[FreelanceOS] Edge connection restored. Booting resilience drip-feed engine.");
      this.triggerSync();
    });
  }
}

export const resilienceEngine = new EdgeResilienceSyncEngine();
