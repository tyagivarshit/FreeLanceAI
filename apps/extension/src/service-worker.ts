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
      await fetch(`${config.apiUrl}/api/jobs/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(result),
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
    await fetch(`${config.apiUrl}/api/jobs/detect`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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
