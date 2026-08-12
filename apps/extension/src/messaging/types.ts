export type MessageCategory = "REQUEST" | "RESPONSE" | "EVENT";

export interface MessageEnvelope {
  protocolVersion: string;
  messageId: string;
  correlationId?: string | undefined;
  type: string;
  timestamp: number;
  payload: unknown;
}

export interface MessageError {
  code: string;
  message: string;
  correlationId?: string | undefined;
  retryable?: boolean | undefined;
}

export type ExtensionContextType = "CONTENT_SCRIPT" | "SERVICE_WORKER" | "EXTENSION_UI";

export interface MessageDefinition {
  type: string;
  category: MessageCategory;
  allowedSenders: ExtensionContextType[];
  allowedReceivers: ExtensionContextType[];
  timeoutMs?: number | undefined;
}

export interface ObservabilityLog {
  eventName:
    | "message_received"
    | "message_rejected"
    | "validation_failed"
    | "unauthorized_message"
    | "handler_started"
    | "handler_completed"
    | "handler_failed"
    | "request_timeout"
    | "duplicate_request"
    | "stale_message";
  messageType: string;
  messageId: string;
  correlationId?: string | undefined;
  senderCategory?: string | undefined;
  durationMs?: number | undefined;
  outcome: "SUCCESS" | "FAILED" | "REJECTED";
  errorCode?: string | undefined;
}
