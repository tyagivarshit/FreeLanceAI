import { UpworkAdapter } from "./platform/upwork.js";
import { LinkedInAdapter } from "./platform/linkedin.js";
import { ExtensionMessageClient } from "./messaging/client.js";
import { createPlatformContext } from "./platform/context.js";

const upworkAdapter = new UpworkAdapter();
const linkedinAdapter = new LinkedInAdapter();
const client = new ExtensionMessageClient();

// Handle messages from the Service Worker
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message && message.type === "UPWORK_EXTRACT_DOM") {
    // Run the extraction locally in the content script (which has the DOM)
    upworkAdapter
      .extract(message.context)
      .then((result) => sendResponse(result))
      .catch((err) => {
        sendResponse({
          status: "FAILED",
          extractedAt: Date.now(),
          error: {
            code: "EXTRACTION_FAILED",
            message: err.message || "Extraction failed in content script.",
          },
        });
      });
    return true; // Keep channel open for async response
  }

  if (message && message.type === "LINKEDIN_EXTRACT_DOM") {
    // Run the extraction locally in the content script (which has the DOM)
    linkedinAdapter
      .extract(message.context)
      .then((result) => sendResponse(result))
      .catch((err) => {
        sendResponse({
          status: "FAILED",
          extractedAt: Date.now(),
          error: {
            code: "EXTRACTION_FAILED",
            message: err.message || "Extraction failed in content script.",
          },
        });
      });
    return true; // Keep channel open for async response
  }

  return false;
});

// Auto-detect job page on load
async function autoDetect() {
  const url = window.location.href;
  try {
    const tempCtx = createPlatformContext(url, 0, 0);
    let matchedAdapter = null;

    if (upworkAdapter.canHandle(tempCtx)) {
      matchedAdapter = upworkAdapter;
    } else if (linkedinAdapter.canHandle(tempCtx)) {
      matchedAdapter = linkedinAdapter;
    }

    if (matchedAdapter) {
      const isJob = await matchedAdapter.detect(tempCtx);
      if (isJob) {
        const identity = await matchedAdapter.identify(tempCtx);
        const result = await matchedAdapter.extract(tempCtx);
        if (result.status === "SUCCESS" || result.status === "PARTIAL") {
          const title = result.data?.title || "Untitled Job";
          await client.post("JOB_DETECTED", {
            jobId: identity.externalId,
            title: title,
            url: identity.canonicalUrl,
          });
        }
      }
    }
  } catch (err) {
    // Silent fail for background detection
    console.error("[Content Script] Error during auto-detection:", err);
  }
}

autoDetect();
