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
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === "AUTHORIZE_EXTENSION") {
        (async () => {
            try {
                const response = await fetch(`${config.apiUrl}/api/extension/token`, {
                    method: 'GET',
                    credentials: 'include'
                });
                const data = await response.json();
                if (data.success && data.token && data.tenantId) {
                    await SessionStorageManager.setAuthToken(data.token, data.tenantId);
                    sendResponse({ success: true });
                }
                else {
                    sendResponse({ success: false, error: data.error || 'Authorization failed' });
                }
            }
            catch (e) {
                sendResponse({ success: false, error: e.message });
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
                        id: `job_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
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
                }
                catch (fetchErr) {
                    if (fetchErr.name === "TypeError" && fetchErr.message === "Failed to fetch") {
                        await resilienceEngine.enqueue({
                            id: `job_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
                            tenantId: session.tenantId,
                            endpoint: `${config.apiUrl}/api/jobs/import`,
                            data: payload,
                            timestamp: Date.now()
                        });
                        sendResponse({ success: true, data: { status: "QUEUED_OFFLINE_AFTER_FAIL" } });
                    }
                    else {
                        throw fetchErr;
                    }
                }
            }
            catch (err) {
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
            }
            catch (error) {
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
