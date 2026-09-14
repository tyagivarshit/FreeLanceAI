//@ts-nocheck
import { config } from "../config.js";
import { SessionStorageManager } from "../storage/session.js";
import { ALLOWED_ORIGIN_PATTERNS, STREAMING_CHANNEL_NAME } from "./types.js";
/**
 * Chapter 9B: Messaging Bus Framework
 * Implements long-lived multiplexed ports to handle high-velocity streaming chunks
 * without IPC queue overflows. Enforces strict origin boundary checks.
 */
export class BackgroundMessagingBus {
    initialize() {
        // 2. LONG-LIVED MULTIPLEXED PORTS (Background Listener)
        chrome.runtime.onConnect.addListener((port) => {
            // 3. SENDER ORIGIN BOUNDARY CHECK (Confused Deputy Guard)
            if (!this.verifyOriginBoundary(port.sender)) {
                console.warn("[FreelanceOS] Security Alert: Dropped connection from unauthorized origin.", port.sender?.url);
                port.disconnect();
                return;
            }
            if (port.name === STREAMING_CHANNEL_NAME) {
                this.handleStreamingPort(port);
            }
        });
    }
    /**
     * Pre-flight checkpoint to validate the sender.tab.url explicitly originates
     * from verified allowed domains (Upwork/LinkedIn hosts).
     */
    verifyOriginBoundary(sender) {
        if (!sender || !sender.tab || !sender.tab.url) {
            return false; // Reject execution if tab context is missing/spoofed
        }
        const url = sender.tab.url;
        return ALLOWED_ORIGIN_PATTERNS.some((pattern) => pattern.test(url));
    }
    handleStreamingPort(port) {
        port.onMessage.addListener(async (msg) => {
            if (msg.type === "START_MATCH_EXPLANATION" && msg.payload?.matchId) {
                // Forward to the backend orchestration layer (simulated here)
                // High-velocity chunks will stream back through port.postMessage
                try {
                    // This would integrate with Phase 7/8 SSE client logic securely using session storage
                    await this.simulateBackendStream(port, msg.payload.matchId);
                }
                catch (error) {
                    const errPayload = { message: error.message };
                    port.postMessage({ type: "STREAM_ERROR", payload: errPayload });
                }
            }
        });
    }
    async simulateBackendStream(port, matchId) {
        const session = await SessionStorageManager.getAuthSession();
        if (!session || !session.token) {
            port.postMessage({ type: "STREAM_ERROR", payload: { message: "Missing Auth Context" } });
            return;
        }
        try {
            const response = await fetch(`${config.apiUrl}/api/jobs/explain`, {
                method: "POST",
                headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session.token}` },
                body: JSON.stringify({ matchId, tenantId: session.tenantId })
            });
            if (!response.body)
                throw new Error("No response body");
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            while (true) {
                const { done, value } = await reader.read();
                if (done)
                    break;
                const chunk = decoder.decode(value, { stream: true });
                const payload = { chunk };
                port.postMessage({ type: "STREAM_TOKEN_CHUNK", payload });
            }
            port.postMessage({ type: "STREAM_COMPLETE" });
        }
        catch (e) {
            port.postMessage({ type: "STREAM_ERROR", payload: { message: e.message } });
        }
    }
}
/**
 * Client-Side Injector API (Used strictly inside the isolated content script)
 */
export class ClientMessagingBus {
    activePort = null;
    onTokenCallback = null;
    onCompleteCallback = null;
    requestStreamingExplanation(matchId) {
        if (this.activePort) {
            this.activePort.disconnect();
        }
        // 2. Open Long-Lived Multiplexed Port Connection
        this.activePort = chrome.runtime.connect({ name: STREAMING_CHANNEL_NAME });
        this.activePort.onMessage.addListener((msg) => {
            if (msg.type === "STREAM_TOKEN_CHUNK" && this.onTokenCallback) {
                this.onTokenCallback(msg.payload.chunk);
            }
            else if (msg.type === "STREAM_COMPLETE" && this.onCompleteCallback) {
                this.onCompleteCallback();
                this.disconnect();
            }
            else if (msg.type === "STREAM_ERROR") {
                console.error("[FreelanceOS] Streaming Error:", msg.payload.message);
                this.disconnect();
            }
        });
        // Initiate execution payload
        const initPayload = { matchId };
        this.activePort.postMessage({ type: "START_MATCH_EXPLANATION", payload: initPayload });
    }
    subscribeToStream(onToken, onComplete) {
        this.onTokenCallback = onToken;
        this.onCompleteCallback = onComplete;
    }
    disconnect() {
        if (this.activePort) {
            this.activePort.disconnect();
            this.activePort = null;
        }
    }
}
