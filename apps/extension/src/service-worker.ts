/* eslint-disable no-console */
import { PlatformAdapterRegistry } from "./platform/registry.js";
import { UpworkAdapter } from "./platform/upwork.js";
import { LinkedInAdapter } from "./platform/linkedin.js";
import { MessageDispatcher } from "./messaging/dispatcher.js";
import { validateContext } from "./platform/context.js";
import { config } from "./config.js";

const reg = new PlatformAdapterRegistry();
const upworkAdapter = new UpworkAdapter();
const linkedinAdapter = new LinkedInAdapter();
reg.register(upworkAdapter);
reg.register(linkedinAdapter);

const dispatcher = new MessageDispatcher("SERVICE_WORKER");

// Register dispatcher handlers
dispatcher.registerHandler("EXTRACT_JOB", async (payload: unknown) => {
  const ctx = validateContext(payload);
  const adapter = reg.resolve(ctx);
  const result = await reg.executeExtract(adapter, ctx);

  // If extraction succeeded, forward the extracted job data to the backend import contract
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
  const data = payload as { jobId: string; title: string; url: string };
  console.log(`[Service Worker] Job detected: ${data.jobId} - ${data.title}`);

  // Forward detection event to backend
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

dispatcher.registerHandler("GET_DASHBOARD_JOBS", async () => {
  const res = await fetch(`${config.apiUrl}/api/jobs`);
  if (!res.ok) {
    throw new Error(`Backend contract failed: HTTP ${res.status}`);
  }
  return res.json();
});

dispatcher.registerHandler("GET_JOB_DETAILS", async (payload: unknown) => {
  const data = payload as { jobId: string };
  const res = await fetch(`${config.apiUrl}/api/jobs/${data.jobId}`);
  if (!res.ok) {
    throw new Error(
      `Backend contract failed to retrieve details for job ${data.jobId}: HTTP ${res.status}`,
    );
  }
  return res.json();
});

dispatcher.registerHandler("RETRY_MATCH", async (payload: unknown) => {
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
  const res = await fetch(`${config.apiUrl}/api/jobs`);
  if (!res.ok) {
    throw new Error(`Backend contract failed to refresh: HTTP ${res.status}`);
  }
  return res.json();
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
