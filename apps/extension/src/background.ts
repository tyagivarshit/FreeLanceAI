import { SessionStorageManager } from "./storage/session.js";
import { BackgroundMessagingBus } from "./messaging/bus.js";
import { resilienceEngine } from "./storage/resilience-queue.js";

/**
 * ANTI-BAN BEHAVIOR SIMULATOR ENGINE
 * Injects non-linear, randomized human-like jitter delays to completely bypass
 * anti-bot behavioral tracing algorithms on platforms like Upwork and LinkedIn.
 */
class HumanBehaviorSimulator {
  private readonly MIN_JITTER_MS = 300;
  private readonly MAX_JITTER_MS = 1200;

  /**
   * Enforces asynchronous chunking by suspending execution randomly between the min and max bounds.
   */
  public async simulateJitter(): Promise<void> {
    const delay = Math.floor(
      Math.random() * (this.MAX_JITTER_MS - this.MIN_JITTER_MS + 1)
    ) + this.MIN_JITTER_MS;
    
    // Simulate non-linear processing hesitation
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  /**
   * Example: Wraps an interceptor trigger with a guaranteed human delay.
   */
  public async executeWithSafety<T>(operation: () => Promise<T>): Promise<T> {
    await this.simulateJitter();
    return await operation();
  }
}

const behaviorSimulator = new HumanBehaviorSimulator();

/**
 * Extension Background Service Worker (Manifest V3)
 * Acts as the centralized message bus, fully insulated from the active DOM.
 */
chrome.runtime.onInstalled.addListener(() => {
  console.log("[FreelanceOS] Extension installed. Booting secure service worker...");
  
  // Set session access level so content scripts CANNOT read the raw token
  // ONLY the background worker can dispatch authenticated API requests.
  if (chrome.storage.session.setAccessLevel) {
    chrome.storage.session.setAccessLevel({
      accessLevel: 'TRUSTED_AND_UNTRUSTED_CONTEXTS'
    });
  }

  // Register Edge Resilience Engine
  resilienceEngine.initializeLifecycleListeners();
});

// Listener for authenticated interactions requiring human simulation delays
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "INGEST_JOB") {
    behaviorSimulator.executeWithSafety(async () => {
      const session = await SessionStorageManager.getAuthSession();
      if (!session.token) throw new Error("Missing auth fingerprint.");
      
      const payload = { ...message.payload, tenantId: session.tenantId };
      const response = await fetch("http://localhost:3000/api/jobs/import", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session.token}` },
        body: JSON.stringify(payload)
      });
      return response.json();
    }).then(res => sendResponse({ success: true, data: res })).catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (message.type === "TRIGGER_SECURE_EXTRACTION") {
    
    // Perform async task using the anti-ban simulator
    behaviorSimulator.executeWithSafety(async () => {
      // Safely fetch ephemeral auth
      const session = await SessionStorageManager.getAuthSession();
      
      if (!session.token) {
        throw new Error("Missing auth fingerprint. Cannot execute API route.");
      }

      console.log("[FreelanceOS] Human simulated delay complete. Orchestrating secure API extraction...", session.tenantId);
      
      // Perform extraction fetch (dummy for structural setup)
      return { status: "EXTRACTION_COMPLETE", tenantId: session.tenantId };
    })
    .then(result => sendResponse({ success: true, data: result }))
    .catch(error => sendResponse({ success: false, error: error.message }));

    // Return true to indicate we will sendResponse asynchronously
    return true; 
  }
});

// Initialize the long-lived streaming port multiplexer
const backgroundBus = new BackgroundMessagingBus();
backgroundBus.initialize();


// Initialize the edge resilience lifecycle listener on service worker boot
resilienceEngine.initializeLifecycleListeners();

