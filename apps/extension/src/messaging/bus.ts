import { SessionStorageManager } from "../storage/session.js";
import { 
  ALLOWED_ORIGIN_PATTERNS, 
  STREAMING_CHANNEL_NAME, 
  StrictMessage, 
  ActionType,
  StreamInitPayload,
  StreamTokenPayload,
  StreamErrorPayload
} from "./types.js";

/**
 * Chapter 9B: Messaging Bus Framework
 * Implements long-lived multiplexed ports to handle high-velocity streaming chunks
 * without IPC queue overflows. Enforces strict origin boundary checks.
 */
export class BackgroundMessagingBus {
  public initialize(): void {
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
  private verifyOriginBoundary(sender: chrome.runtime.MessageSender | undefined): boolean {
    if (!sender || !sender.tab || !sender.tab.url) {
      return false; // Reject execution if tab context is missing/spoofed
    }

    const url = sender.tab.url;
    return ALLOWED_ORIGIN_PATTERNS.some((pattern) => pattern.test(url));
  }

  private handleStreamingPort(port: chrome.runtime.Port): void {
    port.onMessage.addListener(async (msg: StrictMessage<StreamInitPayload>) => {
      if (msg.type === "START_MATCH_EXPLANATION" && msg.payload?.matchId) {
        // Forward to the backend orchestration layer (simulated here)
        // High-velocity chunks will stream back through port.postMessage
        try {
          // This would integrate with Phase 7/8 SSE client logic securely using session storage
          await this.simulateBackendStream(port, msg.payload.matchId);
        } catch (error) {
          const errPayload: StreamErrorPayload = { message: (error as Error).message };
          port.postMessage({ type: "STREAM_ERROR", payload: errPayload } as StrictMessage<StreamErrorPayload>);
        }
      }
    });
  }

  private async simulateBackendStream(port: chrome.runtime.Port, matchId: string): Promise<void> {
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
  }
}

/**
 * Client-Side Injector API (Used strictly inside the isolated content script)
 */
export class ClientMessagingBus {
  private activePort: chrome.runtime.Port | null = null;
  private onTokenCallback: ((token: string) => void) | null = null;
  private onCompleteCallback: (() => void) | null = null;

  public requestStreamingExplanation(matchId: string): void {
    if (this.activePort) {
      this.activePort.disconnect();
    }

    // 2. Open Long-Lived Multiplexed Port Connection
    this.activePort = chrome.runtime.connect({ name: STREAMING_CHANNEL_NAME });

    this.activePort.onMessage.addListener((msg: StrictMessage) => {
      if (msg.type === "STREAM_TOKEN_CHUNK" && this.onTokenCallback) {
        this.onTokenCallback((msg.payload as StreamTokenPayload).chunk);
      } else if (msg.type === "STREAM_COMPLETE" && this.onCompleteCallback) {
        this.onCompleteCallback();
        this.disconnect();
      } else if (msg.type === "STREAM_ERROR") {
        console.error("[FreelanceOS] Streaming Error:", (msg.payload as StreamErrorPayload).message);
        this.disconnect();
      }
    });

    // Initiate execution payload
    const initPayload: StreamInitPayload = { matchId };
    this.activePort.postMessage({ type: "START_MATCH_EXPLANATION", payload: initPayload } as StrictMessage<StreamInitPayload>);
  }

  public subscribeToStream(
    onToken: (token: string) => void,
    onComplete: () => void
  ): void {
    this.onTokenCallback = onToken;
    this.onCompleteCallback = onComplete;
  }

  public disconnect(): void {
    if (this.activePort) {
      this.activePort.disconnect();
      this.activePort = null;
    }
  }
}
