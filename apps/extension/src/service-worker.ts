/* eslint-disable no-console */
import { PlatformAdapterRegistry } from "./platform/registry.js";
import { UpworkAdapter } from "./platform/upwork.js";
import { MessageDispatcher } from "./messaging/dispatcher.js";
import { validateContext } from "./platform/context.js";

const reg = new PlatformAdapterRegistry();
const upworkAdapter = new UpworkAdapter();
reg.register(upworkAdapter);

const dispatcher = new MessageDispatcher("SERVICE_WORKER");

// Register dispatcher handlers
dispatcher.registerHandler("EXTRACT_JOB", async (payload: unknown) => {
  const ctx = validateContext(payload);
  const adapter = reg.resolve(ctx);
  return reg.executeExtract(adapter, ctx);
});

dispatcher.registerHandler("JOB_DETECTED", async (payload: unknown) => {
  // Log detected jobs
  const data = payload as { jobId: string; title: string };
  console.log(`[Service Worker] Job detected: ${data.jobId} - ${data.title}`);
  return { status: "ACK" };
});

dispatcher.registerHandler("PING", async () => {
  return "PONG";
});

dispatcher.registerHandler("GET_SETTINGS", async () => {
  return { theme: "dark", autoMatch: true };
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
  return true; // Keep message port open for asynchronous responses
});
