/* eslint-disable no-console, @typescript-eslint/no-explicit-any */
import {
  MessageEnvelope,
  MessageDefinition,
  ExtensionContextType,
  ObservabilityLog,
  MessageError,
} from "./types.js";
import { validateEnvelope, validatePayload } from "./schema.js";

// Approved Message Registry
const MESSAGE_REGISTRY: Record<string, MessageDefinition> = {
  PING: {
    type: "PING",
    category: "REQUEST",
    allowedSenders: ["CONTENT_SCRIPT", "EXTENSION_UI"],
    allowedReceivers: ["SERVICE_WORKER"],
    timeoutMs: 5000,
  },
  GET_SETTINGS: {
    type: "GET_SETTINGS",
    category: "REQUEST",
    allowedSenders: ["CONTENT_SCRIPT", "EXTENSION_UI"],
    allowedReceivers: ["SERVICE_WORKER"],
    timeoutMs: 5000,
  },
  UPDATE_SETTINGS: {
    type: "UPDATE_SETTINGS",
    category: "REQUEST",
    allowedSenders: ["EXTENSION_UI"],
    allowedReceivers: ["SERVICE_WORKER"],
    timeoutMs: 5000,
  },
  JOB_DETECTED: {
    type: "JOB_DETECTED",
    category: "EVENT",
    allowedSenders: ["CONTENT_SCRIPT"],
    allowedReceivers: ["SERVICE_WORKER"],
  },
  MATCH_COMPLETED: {
    type: "MATCH_COMPLETED",
    category: "EVENT",
    allowedSenders: ["SERVICE_WORKER"],
    allowedReceivers: ["EXTENSION_UI"],
  },
  TIMEOUT_TEST: {
    type: "TIMEOUT_TEST",
    category: "REQUEST",
    allowedSenders: ["CONTENT_SCRIPT"],
    allowedReceivers: ["SERVICE_WORKER"],
    timeoutMs: 10,
  },
};

export class MessageDispatcher {
  private handlers = new Map<string, (payload: any, sender: any) => Promise<any>>();
  private processedMessageIds = new Set<string>();
  private activePendingRequestsCount = 0;
  private readonly maxPendingRequests = 100;
  private readonly maxLoggedMessageIds = 5000;

  constructor(private readonly receiverType: ExtensionContextType) {}

  public registerHandler(type: string, handler: (payload: any, sender: any) => Promise<any>): void {
    if (!MESSAGE_REGISTRY[type]) {
      throw new Error(`Cannot register handler for unregistered message type: ${type}`);
    }
    this.handlers.set(type, handler);
  }

  public async dispatch(msg: unknown, chromeSender: any): Promise<MessageEnvelope | MessageError> {
    const startTime = Date.now();
    let envelope: MessageEnvelope | null = null;
    let messageType = "UNKNOWN";
    let messageId = "UNKNOWN";
    let correlationId: string | undefined;

    try {
      // 1. Envelope validation
      envelope = validateEnvelope(msg);
      messageType = envelope.type;
      messageId = envelope.messageId;
      correlationId = envelope.correlationId;

      // 2. Registry checks
      const definition = MESSAGE_REGISTRY[messageType];
      if (!definition) {
        throw new Error(`Message type '${messageType}' is not registered.`);
      }

      // Category check
      if (definition.category === "REQUEST" && !correlationId) {
        throw new Error(`Message type '${messageType}' expects correlationId.`);
      }

      // 3. Sender / Receiver constraints checks
      const senderContext = this.determineSenderContext(chromeSender);
      if (!definition.allowedSenders.includes(senderContext)) {
        throw new Error(
          `Security violation: unauthorized sender context '${senderContext}' for message type '${messageType}'.`,
        );
      }
      if (!definition.allowedReceivers.includes(this.receiverType)) {
        throw new Error(
          `Security violation: unauthorized receiver context '${this.receiverType}' for message type '${messageType}'.`,
        );
      }

      // 4. Duplicate request check (for requests to service-worker only)
      if (definition.category === "REQUEST" && this.receiverType === "SERVICE_WORKER") {
        if (this.processedMessageIds.has(messageId)) {
          this.logObservability({
            eventName: "duplicate_request",
            messageType,
            messageId,
            correlationId,
            senderCategory: senderContext,
            outcome: "REJECTED",
            errorCode: "DUPLICATE_MESSAGE",
          });
          throw new Error("Duplicate request message rejected.");
        }
        this.processedMessageIds.add(messageId);
        if (this.processedMessageIds.size > this.maxLoggedMessageIds) {
          // Prevent memory leakage
          const first = this.processedMessageIds.values().next().value;
          if (first) {
            this.processedMessageIds.delete(first);
          }
        }
      }

      // 5. Concurrency bounds check
      if (
        definition.category === "REQUEST" &&
        this.activePendingRequestsCount >= this.maxPendingRequests
      ) {
        throw new Error("Service worker is busy. Concurrency limit reached.");
      }

      // 6. Payload validation
      validatePayload(messageType, definition.category, envelope.payload);

      // 7. Dispatch to handler
      const handler = this.handlers.get(messageType);
      if (!handler) {
        throw new Error(`No handler registered for message type: ${messageType}`);
      }

      this.logObservability({
        eventName: "message_received",
        messageType,
        messageId,
        correlationId,
        senderCategory: senderContext,
        outcome: "SUCCESS",
      });

      this.activePendingRequestsCount++;
      let responsePayload: any;

      // Timeout execution wrappers
      if (definition.category === "REQUEST") {
        const timeoutMs = definition.timeoutMs || 5000;
        responsePayload = await this.executeWithTimeout(
          handler(envelope.payload, chromeSender),
          timeoutMs,
          messageId,
        );
      } else {
        // Event category
        await handler(envelope.payload, chromeSender);
        responsePayload = null;
      }
      this.activePendingRequestsCount--;

      const durationMs = Date.now() - startTime;
      this.logObservability({
        eventName: "handler_completed",
        messageType,
        messageId,
        correlationId,
        senderCategory: senderContext,
        durationMs,
        outcome: "SUCCESS",
      });

      if (definition.category === "REQUEST") {
        const responseEnvelope: MessageEnvelope = {
          protocolVersion: envelope.protocolVersion,
          messageId: this.generateUuid(),
          correlationId: messageId,
          type: `${messageType}_RESPONSE`,
          timestamp: Date.now(),
          payload: responsePayload,
        };
        return responseEnvelope;
      } else {
        // Events return mock completion indicator
        return {
          protocolVersion: envelope.protocolVersion,
          messageId: this.generateUuid(),
          correlationId: messageId,
          type: "EVENT_ACK",
          timestamp: Date.now(),
          payload: { status: "ACK" },
        };
      }
    } catch (err: any) {
      this.activePendingRequestsCount = Math.max(0, this.activePendingRequestsCount - 1);
      const durationMs = Date.now() - startTime;
      const cleanMessage = this.sanitizeError(err.message || String(err));

      this.logObservability({
        eventName: "handler_failed",
        messageType,
        messageId,
        correlationId,
        durationMs,
        outcome: "FAILED",
        errorCode: err.message === "TIMEOUT" ? "REQUEST_TIMEOUT" : "HANDLER_ERROR",
      });

      const responseError: MessageError = {
        code: err.message === "TIMEOUT" ? "REQUEST_TIMEOUT" : "HANDLER_ERROR",
        message: cleanMessage,
        correlationId: messageId !== "UNKNOWN" ? messageId : undefined,
        retryable: err.message === "TIMEOUT",
      };
      return responseError;
    }
  }

  private determineSenderContext(chromeSender: any): ExtensionContextType {
    if (!chromeSender) {
      // Stub/Test fallback
      return "CONTENT_SCRIPT";
    }

    // Chrome Extension Sender Rules
    if (chromeSender.id && chromeSender.url) {
      // Content scripts have chromeSender.tab URL
      if (chromeSender.tab) {
        // Check url against approved platform matches
        const url: string = chromeSender.url || chromeSender.tab.url || "";
        if (url.includes("upwork.com") || url.includes("linkedin.com")) {
          return "CONTENT_SCRIPT";
        }
        throw new Error(`Forbid connection from unauthorized URL/origin: ${url}`);
      }
      // UI / Popup / Options pages share extension runtime ID but lack tab context
      if (chromeSender.url.startsWith("chrome-extension://")) {
        return "EXTENSION_UI";
      }
    }

    // Default to content script context if testing or custom mocked contexts
    if (chromeSender.contextType === "EXTENSION_UI") {
      return "EXTENSION_UI";
    }
    if (chromeSender.contextType === "SERVICE_WORKER") {
      return "SERVICE_WORKER";
    }
    return "CONTENT_SCRIPT";
  }

  private async executeWithTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    msgId: string,
  ): Promise<T> {
    let timer: NodeJS.Timeout | undefined;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        this.logObservability({
          eventName: "request_timeout",
          messageType: "TIMEOUT",
          messageId: msgId,
          outcome: "FAILED",
          errorCode: "REQUEST_TIMEOUT",
        });
        reject(new Error("TIMEOUT"));
      }, timeoutMs);
    });

    try {
      return await Promise.race([promise, timeoutPromise]);
    } finally {
      if (timer) {
        clearTimeout(timer);
      }
    }
  }

  private sanitizeError(raw: string): string {
    let clean = raw;
    // Redact suspected key-value secret shapes
    clean = clean.replace(
      /(?:password|token|key|secret|pass|cred)(?:\s*[:=]\s*["']?)([A-Za-z0-9_-]{4,})/gi,
      "[REDACTED]",
    );
    // Redact file paths
    clean = clean.replace(/[A-Z]:\\[^\s]+/gi, "[PATH_REDACTED]");
    clean = clean.replace(/\/[^\s]+\/[^\s]+/g, "[PATH_REDACTED]");
    // Strip trace lines
    clean = clean.split("\n")[0] || "";
    return clean;
  }

  private logObservability(log: ObservabilityLog): void {
    // Redact sensitive details, output structured observability log
    console.log(
      `[Observability] Event: ${log.eventName} | Type: ${log.messageType} | ID: ${log.messageId} | Outcome: ${log.outcome} | Code: ${log.errorCode || "NONE"}`,
    );
  }

  private generateUuid(): string {
    return (
      Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
    );
  }
}
