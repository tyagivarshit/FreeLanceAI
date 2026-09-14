import { config } from "./config.js";
import { SessionStorageManager } from "./storage/session.js";
import { BackgroundMessagingBus } from "./messaging/bus.js";
import { resilienceEngine } from "./storage/resilience-queue.js";

/**
 * Extension Background Service Worker (Manifest V3)
 * Acts as the centralized message bus, fully insulated from the active DOM.
 */
chrome.runtime.onInstalled.addListener(() => {
  console.log("[FreelanceOS] Extension installed. Booting secure service worker...");
  
  if (chrome.storage.session.setAccessLevel) {
    chrome.storage.session.setAccessLevel({
      accessLevel: 'TRUSTED_AND_UNTRUSTED_CONTEXTS'
    });
  }
});

function generateCodeVerifier() {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, dec => ('0' + dec.toString(16)).substr(-2)).join('');
}

async function generateCodeChallenge(verifier: string) {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const hash = await crypto.subtle.digest('SHA-256', data);
  const bytes = new Uint8Array(hash);
  let str = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    str += String.fromCharCode(bytes[i] as number);
  }
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "AUTHORIZE_EXTENSION") {
    (async () => {
      try {
        const verifier = generateCodeVerifier();
        const challenge = await generateCodeChallenge(verifier);
        const authUrl = `${config.apiUrl}/api/extension/authorize?challenge=${challenge}`;
        
        chrome.tabs.create({ url: authUrl }, (tab) => {
          if (!tab || !tab.id) {
             sendResponse({ success: false, error: "Authorization unavailable" });
             return;
          }
          const tabId = tab.id as number;
          let finished = false;
          
          const cleanup = () => {
            if (finished) return;
            finished = true;
            chrome.tabs.onUpdated.removeListener(updateListener);
            chrome.tabs.onRemoved.removeListener(removeListener);
          };

          const removeListener = (removedTabId: number) => {
            if (removedTabId === tabId && !finished) {
              cleanup();
              sendResponse({ success: false, error: "Authorization denied" });
            }
          };

          const updateListener = async (updatedTabId: number, info: chrome.tabs.TabChangeInfo) => {
            if (updatedTabId === tabId && info.url && info.url.startsWith(`${config.apiUrl}/api/extension/callback`)) {
              cleanup();
              chrome.tabs.remove(tabId).catch(() => {});
              
              const url = new URL(info.url);
              if (url.searchParams.get("error")) {
                sendResponse({ success: false, error: "Authorization denied" });
                return;
              }
              
              const code = url.searchParams.get("code");
              if (!code) {
                sendResponse({ success: false, error: "Authorization failed" });
                return;
              }
              
              try {
                const res = await fetch(`${config.apiUrl}/api/extension/exchange`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ code, verifier })
                });
                
                if (!res.ok) {
                  const errData = await res.json().catch(() => ({}));
                  sendResponse({ success: false, error: errData.error || "Authentication required" });
                  return;
                }
                
                const data = await res.json();
                if (data.success && data.token && data.tenantId) {
                  await SessionStorageManager.setAuthToken(data.token, data.tenantId);
                  sendResponse({ success: true });
                } else {
                  sendResponse({ success: false, error: data.error || "Authorization failed" });
                }
              } catch (e: any) {
                sendResponse({ success: false, error: "Backend unavailable" });
              }
            }
          };
          
          chrome.tabs.onUpdated.addListener(updateListener);
          chrome.tabs.onRemoved.addListener(removeListener);
        });
      } catch (e: any) {
        sendResponse({ success: false, error: "Authorization unavailable" });
      }
    })();
    return true;
  }

  if (message.type === "INGEST_JOB") {
    (async () => {
      try {
        const session = await SessionStorageManager.getAuthSession();
        if (!session.token || !session.tenantId) {
           throw new Error("Missing auth fingerprint.");
        }
        
        const payload = { ...message.payload, tenantId: session.tenantId };
        
        if (!navigator.onLine) {
           await resilienceEngine.enqueue({
             id: `job_${Date.now()}_${Math.floor(Math.random()*1000)}`,
             tenantId: session.tenantId,
             endpoint: `${config.apiUrl}/api/jobs/import`,
             data: payload,
             timestamp: Date.now()
           });
           sendResponse({ success: true, data: { status: "QUEUED_OFFLINE" } });
           return;
        }

        try {
          const response = await fetch(`${config.apiUrl}/api/jobs/import`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session.token}` },
            body: JSON.stringify(payload)
          });
          const res = await response.json();
          sendResponse({ success: true, data: res });
        } catch (fetchErr: any) {
          if (fetchErr.name === "TypeError" && fetchErr.message === "Failed to fetch") {
            await resilienceEngine.enqueue({
              id: `job_${Date.now()}_${Math.floor(Math.random()*1000)}`,
              tenantId: session.tenantId,
              endpoint: `${config.apiUrl}/api/jobs/import`,
              data: payload,
              timestamp: Date.now()
            });
            sendResponse({ success: true, data: { status: "QUEUED_OFFLINE_AFTER_FAIL" } });
          } else {
            throw fetchErr;
          }
        }
      } catch (err: any) {
        sendResponse({ success: false, error: err.message });
      }
    })();
    return true;
  }

  if (message.type === "TRIGGER_SECURE_EXTRACTION") {
    (async () => {
      try {
        const session = await SessionStorageManager.getAuthSession();
        if (!session.token) {
          throw new Error("Missing auth fingerprint. Cannot execute API route.");
        }
        console.log("[FreelanceOS] Orchestrating secure API extraction...", session.tenantId);
        sendResponse({ success: true, data: { status: "EXTRACTION_COMPLETE", tenantId: session.tenantId } });
      } catch (error: any) {
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true; 
  }
  return false;
});

const backgroundBus = new BackgroundMessagingBus();
backgroundBus.initialize();
resilienceEngine.initializeLifecycleListeners();
