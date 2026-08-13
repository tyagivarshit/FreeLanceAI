import { MessageEnvelope, MessageCategory } from "./types.js";

export const SUPPORTED_PROTOCOL_VERSION = "1.0";
export const MAX_PAYLOAD_SIZE_BYTES = 512 * 1024; // 512KB payload limit
export const MAX_STRING_LENGTH = 32768; // 32KB string limit
export const MAX_ARRAY_LENGTH = 1000;
export const MAX_OBJECT_DEPTH = 5;

// Simple structure/depth validator to prevent call stack overflows on nested structures
export function getObjectDepth(value: unknown): number {
  if (value === null || typeof value !== "object") {
    return 0;
  }
  let maxDepth = 0;
  for (const key of Object.keys(value as Record<string, unknown>)) {
    const item = (value as Record<string, unknown>)[key];
    maxDepth = Math.max(maxDepth, getObjectDepth(item));
  }
  return maxDepth + 1;
}

export function validateEnvelope(msg: unknown): MessageEnvelope {
  if (!msg || typeof msg !== "object") {
    throw new Error("Message must be an object.");
  }

  const envelope = msg as Partial<MessageEnvelope>;

  if (typeof envelope.protocolVersion !== "string" || envelope.protocolVersion.trim() === "") {
    throw new Error("Missing protocolVersion.");
  }

  if (envelope.protocolVersion !== SUPPORTED_PROTOCOL_VERSION) {
    throw new Error(`Unsupported protocol version: ${envelope.protocolVersion}`);
  }

  if (typeof envelope.messageId !== "string" || envelope.messageId.trim() === "") {
    throw new Error("Missing or invalid messageId.");
  }

  if (typeof envelope.type !== "string" || envelope.type.trim() === "") {
    throw new Error("Missing or invalid message type.");
  }

  if (
    typeof envelope.timestamp !== "number" ||
    Number.isNaN(envelope.timestamp) ||
    envelope.timestamp <= 0
  ) {
    throw new Error("Missing or invalid message timestamp.");
  }

  // Size limit validation
  const serialized = JSON.stringify(envelope.payload ?? {});
  if (serialized.length > MAX_PAYLOAD_SIZE_BYTES) {
    throw new Error(`Payload size exceeds limit of ${MAX_PAYLOAD_SIZE_BYTES} bytes.`);
  }

  // Deep structural validation
  if (getObjectDepth(envelope.payload) > MAX_OBJECT_DEPTH) {
    throw new Error(`Payload nested depth exceeds limit of ${MAX_OBJECT_DEPTH}.`);
  }

  // String and array length validation inside payload
  validatePayloadBounds(envelope.payload);

  return envelope as MessageEnvelope;
}

function validatePayloadBounds(val: unknown): void {
  if (val === null || val === undefined) {
    return;
  }

  if (typeof val === "string") {
    if (val.length > MAX_STRING_LENGTH) {
      throw new Error(`String length exceeds limit of ${MAX_STRING_LENGTH}.`);
    }
    return;
  }

  if (Array.isArray(val)) {
    if (val.length > MAX_ARRAY_LENGTH) {
      throw new Error(`Array length exceeds limit of ${MAX_ARRAY_LENGTH}.`);
    }
    for (const item of val) {
      validatePayloadBounds(item);
    }
    return;
  }

  if (typeof val === "object") {
    const obj = val as Record<string, unknown>;
    for (const key of Object.keys(obj)) {
      if (key.length > 512) {
        throw new Error("Object key length exceeds limit of 512.");
      }
      validatePayloadBounds(obj[key]);
    }
  }
}

// Payload schemas for specific message types
export function validatePayload(type: string, category: MessageCategory, payload: unknown): void {
  if (category === "RESPONSE") {
    // Responses are validated against envelopes, payload is type specific
    return;
  }

  switch (type) {
    case "PING":
    case "GET_SETTINGS":
    case "TIMEOUT_TEST":
      if (payload !== null && payload !== undefined && Object.keys(payload as object).length > 0) {
        throw new Error(`${type} expects an empty payload.`);
      }
      break;

    case "UPDATE_SETTINGS":
      if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
        throw new Error("UPDATE_SETTINGS payload must be an object.");
      }
      break;

    case "JOB_DETECTED": {
      if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
        throw new Error("JOB_DETECTED payload must be an object.");
      }
      const data = payload as Record<string, unknown>;
      if (typeof data.jobId !== "string" || data.jobId.trim() === "") {
        throw new Error("JOB_DETECTED requires a non-empty string jobId.");
      }
      if (typeof data.title !== "string" || data.title.trim() === "") {
        throw new Error("JOB_DETECTED requires a non-empty string title.");
      }
      if (typeof data.url !== "string" || data.url.trim() === "") {
        throw new Error("JOB_DETECTED requires a non-empty string url.");
      }
      break;
    }

    case "EXTRACT_JOB": {
      if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
        throw new Error("EXTRACT_JOB payload must be an object.");
      }
      const data = payload as Record<string, unknown>;
      if (typeof data.url !== "string" || data.url.trim() === "") {
        throw new Error("EXTRACT_JOB requires a non-empty string url.");
      }
      if (typeof data.tabId !== "number" || !Number.isInteger(data.tabId) || data.tabId < 0) {
        throw new Error("EXTRACT_JOB requires a valid tabId number.");
      }
      if (typeof data.frameId !== "number" || !Number.isInteger(data.frameId) || data.frameId < 0) {
        throw new Error("EXTRACT_JOB requires a valid frameId number.");
      }
      break;
    }

    case "MATCH_COMPLETED": {
      if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
        throw new Error("MATCH_COMPLETED payload must be an object.");
      }
      const data = payload as Record<string, unknown>;
      if (typeof data.matchId !== "string" || data.matchId.trim() === "") {
        throw new Error("MATCH_COMPLETED requires a non-empty string matchId.");
      }
      if (
        typeof data.score !== "number" ||
        Number.isNaN(data.score) ||
        !Number.isFinite(data.score)
      ) {
        throw new Error("MATCH_COMPLETED requires a finite score number.");
      }
      break;
    }

    case "GET_DASHBOARD_JOBS":
    case "REFRESH_JOBS":
      if (payload !== null && payload !== undefined && typeof payload !== "object") {
        throw new Error(`${type} payload must be an object.`);
      }
      break;

    case "GET_JOB_DETAILS":
    case "RETRY_MATCH": {
      if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
        throw new Error(`${type} payload must be an object.`);
      }
      const data = payload as Record<string, unknown>;
      if (typeof data.jobId !== "string" || data.jobId.trim() === "") {
        throw new Error(`${type} requires a non-empty string jobId.`);
      }
      break;
    }

    default:
      throw new Error(`No schema validator registered for message type: ${type}`);
  }
}
