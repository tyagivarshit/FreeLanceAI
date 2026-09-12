import os

# 1. Update bus.ts for real fetch streams
bus_path = 'apps/extension/src/messaging/bus.ts'
with open(bus_path, 'r', encoding='utf8') as f:
    bus_c = f.read()

bus_c = bus_c.replace(
    'import {',
    'import { SessionStorageManager } from "../storage/session.js";\nimport {'
)

old_sim = '''  private async simulateBackendStream(port: chrome.runtime.Port, matchId: string): Promise<void> {
    const dummyTokens = ["This ", "candidate ", "is ", "a ", "perfect ", "match ", "because ", "their ", "skills ", "align."];
    for (const chunk of dummyTokens) {
      // Stream directly over the dedicated channel pipe. 0 one-off IPC overhead.
      const payload: StreamTokenPayload = { chunk };
      port.postMessage({ type: "STREAM_TOKEN_CHUNK", payload } as StrictMessage<StreamTokenPayload>);
      await new Promise(r => setTimeout(r, 50)); 
    }
    port.postMessage({ type: "STREAM_COMPLETE" } as StrictMessage);
  }'''

new_sim = '''  private async simulateBackendStream(port: chrome.runtime.Port, matchId: string): Promise<void> {
    const session = await SessionStorageManager.getAuthSession();
    if (!session || !session.token) {
        port.postMessage({ type: "STREAM_ERROR", payload: { message: "Missing Auth Context" } } as StrictMessage<StreamErrorPayload>);
        return;
    }
    
    try {
        const response = await fetch("http://localhost:3000/api/jobs/explain", {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session.token}` },
            body: JSON.stringify({ matchId, tenantId: session.tenantId })
        });
        
        if (!response.body) throw new Error("No response body");
        
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            const chunk = decoder.decode(value, { stream: true });
            const payload: StreamTokenPayload = { chunk };
            port.postMessage({ type: "STREAM_TOKEN_CHUNK", payload } as StrictMessage<StreamTokenPayload>);
        }
        port.postMessage({ type: "STREAM_COMPLETE" } as StrictMessage);
    } catch (e) {
        port.postMessage({ type: "STREAM_ERROR", payload: { message: (e as Error).message } } as StrictMessage<StreamErrorPayload>);
    }
  }'''
bus_c = bus_c.replace(old_sim, new_sim)

with open(bus_path, 'w', encoding='utf8') as f:
    f.write(bus_c)


# 2. Update content-script.ts to use SPANavigationObserver and Factory
cs_path = 'apps/extension/src/content-script.ts'
with open(cs_path, 'r', encoding='utf8') as f:
    cs_c = f.read()

cs_c = cs_c.replace(
    'import { ClientMessagingBus } from "./messaging/bus.js";',
    'import { ClientMessagingBus } from "./messaging/bus.js";\nimport { SPANavigationObserver, PlatformAdapterFactory } from "./platform/core/index.js";'
)

old_init = '''const engine = new WidgetInjectionEngine();
// Delay injection slightly to avoid SPA initial render collision
setTimeout(() => engine.initialize(), 500);'''

new_init = '''const engine = new WidgetInjectionEngine();
const observer = new SPANavigationObserver();

// Actively intercept host page loads and resolve atomic adapter context
observer.observe(async () => {
  try {
    const adapter = await PlatformAdapterFactory.createAdapter();
    const jobData = await adapter.extractJobData();
    console.log("[FreelanceOS] Active Platform Payload:", jobData);
    
    // Send ingestion payload to background worker
    chrome.runtime.sendMessage({ type: "INGEST_JOB", payload: jobData });
    
    // Mount and paint DashboardOverlayWidget
    engine.initialize();
  } catch (error) {
    // Not a supported B2B page layout or platform exception
  }
});

// Listen for edge resilience sync completions to repaint UI
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "EDGE_SYNC_COMPLETE") {
    console.log("[FreelanceOS] Drip-feed sync complete. Repainting UI dashboard.");
    // Force a mock repaint state cycle
    engine['overlayState'].dispatch({ explanationText: "System synchronized..." });
  }
});'''
cs_c = cs_c.replace(old_init, new_init)

with open(cs_path, 'w', encoding='utf8') as f:
    f.write(cs_c)


# 3. Update background.ts for INGEST_JOB network routing
bg_path = 'apps/extension/src/background.ts'
with open(bg_path, 'r', encoding='utf8') as f:
    bg_c = f.read()

bg_c = bg_c.replace(
    'chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {',
    '''chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
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
'''
)
with open(bg_path, 'w', encoding='utf8') as f:
    f.write(bg_c)

# 4. Update resilience-queue.ts to trigger EDGE_SYNC_COMPLETE
rq_path = 'apps/extension/src/storage/resilience-queue.ts'
with open(rq_path, 'r', encoding='utf8') as f:
    rq_c = f.read()

old_trigger = '''    try {
      await this.processDripFeedQueue();
    } finally {
      this.isProcessing = false;
    }
  }'''

new_trigger = '''    try {
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
  }'''
rq_c = rq_c.replace(old_trigger, new_trigger)

with open(rq_path, 'w', encoding='utf8') as f:
    f.write(rq_c)

print('Updated all components')
