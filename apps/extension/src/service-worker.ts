/* eslint-disable no-console */
import { PlatformAdapterRegistry } from "./platform/registry.js";
import { UpworkAdapter } from "./platform/upwork.js";
import { LinkedInAdapter } from "./platform/linkedin.js";
import { MessageDispatcher } from "./messaging/dispatcher.js";
import { validateContext } from "./platform/context.js";
import { config } from "./config.js";
import { OfflineStorage } from "./storage/db.js";

const reg = new PlatformAdapterRegistry();
const upworkAdapter = new UpworkAdapter();
const linkedinAdapter = new LinkedInAdapter();
reg.register(upworkAdapter);
reg.register(linkedinAdapter);

const store = new OfflineStorage();
const dispatcher = new MessageDispatcher("SERVICE_WORKER");

// Offline State Machine track
let currentOfflineStatus = {
  isOnline: true,
  status: "LIVE", // "LIVE" | "OFFLINE_SNAPSHOT" | "RECONNECTING" | "DEGRADED"
  capturedAt: undefined as number | undefined,
};

// In-flight refresh request deduplication promise
let activeRefreshPromise: Promise<unknown> | null = null;

/**
 * Bounded retry fetch helper with exponential backoff.
 */
async function fetchWithRetry(
  url: string,
  init?: RequestInit,
  retries = 3,
  delay = 500,
): Promise<Response> {
  try {
    const res = await fetch(url, init);
    // Don't retry authorization or request parameters errors
    if (res.status === 401 || res.status === 403 || (res.status >= 400 && res.status < 500)) {
      return res;
    }
    // Bounded retry on transient server errors (5xx)
    if (res.status >= 500 && retries > 0) {
      console.warn(`[Service Worker] Transient HTTP ${res.status}. Retrying in ${delay}ms...`);
      await new Promise((r) => setTimeout(r, delay));
      return fetchWithRetry(url, init, retries - 1, delay * 2);
    }
    return res;
  } catch (err) {
    // Retry on network disconnect / timeouts
    if (retries > 0) {
      console.warn(`[Service Worker] Fetch exception. Retrying in ${delay}ms...`, err);
      await new Promise((r) => setTimeout(r, delay));
      return fetchWithRetry(url, init, retries - 1, delay * 2);
    }
    throw err;
  }
}

/**
 * Orchestrates API call with fallback to local snapshots when offline/degraded.
 */
async function executeApiRequest<T>(
  apiPath: string,
  init?: RequestInit,
  snapshotId = "dashboard-jobs",
): Promise<T> {
  const requestTime = Date.now();
  const url = `${config.apiUrl}${apiPath}`;

  if (!currentOfflineStatus.isOnline) {
    currentOfflineStatus.status = "RECONNECTING";
  }

  try {
    const res = await fetchWithRetry(url, init);

    // 1. Authentication failure
    if (res.status === 401 || res.status === 403) {
      throw new Error(`AUTHENTICATION_ERROR: Unauthorized access (HTTP ${res.status})`);
    }

    // 2. Application/request failures (Do not classify as offline/availability issues)
    if (res.status >= 400 && res.status < 500) {
      throw new Error(`APPLICATION_ERROR: Backend request failed (HTTP ${res.status})`);
    }

    if (!res.ok) {
      throw new Error(`SERVER_ERROR: Server returned HTTP ${res.status}`);
    }

    const data = await res.json();

    // Safe writing to IndexedDB on success
    await store.saveSnapshot(snapshotId, data, apiPath, requestTime);
    currentOfflineStatus = {
      isOnline: true,
      status: "LIVE",
      capturedAt: undefined,
    };

    return data;
  } catch (err) {
    const msg = (err as Error).message || "";
    // If it's a known non-offline error (auth/application), bubble it immediately
    if (msg.includes("AUTHENTICATION_ERROR") || msg.includes("APPLICATION_ERROR")) {
      throw err;
    }

    // Otherwise, classify as offline/availability issue and attempt snapshot recovery
    console.info(`[Service Worker] Request to ${apiPath} failed. Resolving from local snapshot.`);

    const snapshot = await store.getSnapshot(snapshotId);
    if (snapshot) {
      currentOfflineStatus = {
        isOnline: false,
        status: "OFFLINE_SNAPSHOT",
        capturedAt: snapshot.capturedAt,
      };

      if (apiPath.startsWith("/api/jobs/")) {
        const jobId = apiPath.split("/").pop();
        const jobs = (snapshot.data || []) as Array<{ id: string }>;
        const found = jobs.find((j) => j.id === jobId);
        if (found) {
          return found as T;
        }
        throw new Error(`Job details not found in offline snapshot.`);
      }

      return snapshot.data as T;
    }

    // No snapshot available -> transition to DEGRADED
    currentOfflineStatus = {
      isOnline: false,
      status: "DEGRADED",
      capturedAt: undefined,
    };

    throw new Error(`Network connection unavailable and no local offline snapshot is available.`);
  }
}


import { SessionStorageManager } from "./storage/session.js";

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

dispatcher.registerHandler("AUTHORIZE_EXTENSION", async () => {
  console.log("[AUTH_TRACE] service worker handler entered");
  
  const verifier = generateCodeVerifier();
  const challenge = await generateCodeChallenge(verifier);
  console.log("[AUTH_TRACE] PKCE generated");
  
  const authUrl = `${config.apiUrl}/api/extension/authorize?challenge=${challenge}`;
  console.log("[AUTH_TRACE] authorization URL origin/path", new URL(authUrl).origin, new URL(authUrl).pathname);
  
  console.log("[AUTH_TRACE] tabs.create started");
  
  // Create tab but DO NOT await the entire flow
  chrome.tabs.create({ url: authUrl }, (tab) => {
    if (chrome.runtime.lastError || !tab || !tab.id) {
      console.log("[AUTH_TRACE] tabs.create rejected");
      return;
    }
    
    console.log("[AUTH_TRACE] tabs.create succeeded, tab id =", tab.id);
    const tabId = tab.id as number;
    let finished = false;
    
    const cleanup = () => {
      if (finished) return false;
        finished = true;
      chrome.tabs.onUpdated.removeListener(updateListener);
      chrome.tabs.onRemoved.removeListener(removeListener);
        return true;
      };

    const removeListener = (removedTabId: number) => {
      if (removedTabId === tabId && !finished) {
        cleanup();
        console.log("[AUTH_TRACE] Tab closed by user");
      }
    };

    const updateListener = async (updatedTabId: number, _info: chrome.tabs.TabChangeInfo) => {
      if (updatedTabId !== tabId) return;

      let currentTab;
      try {
        currentTab = await chrome.tabs.get(tabId);
      } catch (e) {
        return; // Tab no longer exists or inaccessible
      }

      if (!currentTab.url) return;

      let url;
      try { 
        url = new URL(currentTab.url); 
      } catch(e) { 
        return; 
      }

      if (url.origin === new URL(config.apiUrl).origin && url.pathname === '/api/extension/callback') {
        const hashParams = new URLSearchParams(url.hash.substring(1));
        const authCode = hashParams.get("code");
        const authError = hashParams.get("error");

        if (!authCode && !authError) {
          console.log("[AUTH_TRACE] Callback base URL detected, waiting for fragment");
          return;
        }

        // Terminal state reached, only cleanup now
        if (!cleanup()) return;

        console.log("[AUTH_TRACE] callback terminal state detected");
        chrome.tabs.remove(tabId).catch(() => {});

        if (authError) {
          console.log("[AUTH_TRACE] Callback error=" + authError);
          return;
        }

        console.log("[AUTH_TRACE] exchange started");
        try {
          const res = await fetch(`${config.apiUrl}/api/extension/exchange`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code: authCode, verifier })
          });
          
          console.log("[AUTH_TRACE] exchange response status", res.status);
          
          if (!res.ok) {
            console.log("[AUTH_TRACE] Exchange failed");
            return;
          }
          
          const data = await res.json();
          if (data.success && data.token && data.tenantId) {
            await SessionStorageManager.setAuthToken(data.token, data.tenantId);
            console.log("[AUTH_TRACE] token stored successfully");
          }
        } catch (e: any) {
          console.log("[AUTH_TRACE] Backend unavailable", e.message);
        }
      }
    };
      
      chrome.tabs.onUpdated.addListener(updateListener);
    chrome.tabs.onRemoved.addListener(removeListener);
    console.log("[AUTH_TRACE] onUpdated listener registered");
  });

  // Resolve immediately so the popup receives success for the "request" part
  console.log("[AUTH_TRACE] handler resolved immediately");
  return { success: true, status: "STARTED" };
});

// Register dispatcher handlers
dispatcher.registerHandler("EXTRACT_JOB", async (payload: unknown) => {
    // Reject mutations immediately if offline
    if (!currentOfflineStatus.isOnline) {
      throw new Error("Job extraction is unavailable in offline mode.");
    }
  
    const ctx = validateContext(payload);
    const adapter = reg.resolve(ctx);
    const result = await reg.executeExtract(adapter, ctx);
  
    if (result.status === "SUCCESS" && result.jobId) {
      try {
        const session = await SessionStorageManager.getAuthSession();
        if (!session.token || !session.tenantId) {
           throw new Error("Missing auth fingerprint.");
        }
        await fetch(`${config.apiUrl}/api/jobs/import`, {
          method: "POST",
          headers: { 
            "Content-Type": "application/json",
            "Authorization": `Bearer ${session.token}`
          },
          body: JSON.stringify({ ...result, tenantId: session.tenantId }),
        });
      } catch (err) {
        console.error("[Service Worker] Failed to forward extraction to backend contract:", err);
      }
    }
    return result;
  });

dispatcher.registerHandler("JOB_DETECTED", async (payload: unknown) => {
    if (!currentOfflineStatus.isOnline) {
      throw new Error("Job detection is disabled in offline mode.");
    }
  
    const data = payload as { jobId: string; title: string; url: string };
    console.log(`[Service Worker] Job detected: ${data.jobId} - ${data.title}`);
  
    try {
      const session = await SessionStorageManager.getAuthSession();
      if (!session.token || !session.tenantId) {
         throw new Error("Missing auth fingerprint.");
      }
      await fetch(`${config.apiUrl}/api/jobs/detect`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.token}`
        },
        body: JSON.stringify(data),
      });
    } catch (err) {
      console.error("[Service Worker] Failed to forward job detection to backend:", err);
    }
  
    return { status: "ACK" };
  });

dispatcher.registerHandler("PING", async () => {
  return "PONG";
});

dispatcher.registerHandler("GET_SETTINGS", async () => {
  return { theme: "dark", autoMatch: true };
});

dispatcher.registerHandler("GET_OFFLINE_STATUS", async () => {
  return currentOfflineStatus;
});

dispatcher.registerHandler("GET_DASHBOARD_JOBS", async () => {
  if (activeRefreshPromise) {
    return activeRefreshPromise;
  }
  activeRefreshPromise = executeApiRequest("/api/jobs");
  try {
    return await activeRefreshPromise;
  } finally {
    activeRefreshPromise = null;
  }
});

dispatcher.registerHandler("GET_JOB_DETAILS", async (payload: unknown) => {
  const data = payload as { jobId: string };
  return executeApiRequest(`/api/jobs/${data.jobId}`);
});

dispatcher.registerHandler("RETRY_MATCH", async (payload: unknown) => {
  // Safe read-only offline rejection
  if (!currentOfflineStatus.isOnline) {
    throw new Error("Match re-evaluation is unavailable in offline mode.");
  }

  const data = payload as { jobId: string };
  const res = await fetch(`${config.apiUrl}/api/jobs/${data.jobId}/match`, {
    method: "POST",
  });
  if (!res.ok) {
    throw new Error(`Backend contract failed to re-evaluate match: HTTP ${res.status}`);
  }
  return res.json();
});

dispatcher.registerHandler("REFRESH_JOBS", async () => {
  if (activeRefreshPromise) {
    return activeRefreshPromise;
  }
  activeRefreshPromise = executeApiRequest("/api/jobs");
  try {
    return await activeRefreshPromise;
  } finally {
    activeRefreshPromise = null;
  }
});

// Setup runtime message listener using the dispatcher
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  dispatcher
    .dispatch(message, sender)
    .then((response) => {
      sendResponse(response);
    })
    .catch((err) => {
      sendResponse({
        code: "HANDLER_ERROR",
        message: err.message || "Background execution failure.",
      });
    });
  return true;
});
