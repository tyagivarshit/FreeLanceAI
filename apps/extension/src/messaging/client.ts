/* eslint-disable @typescript-eslint/no-explicit-any */
import { MessageEnvelope, MessageError } from "./types.js";
import { SUPPORTED_PROTOCOL_VERSION } from "./schema.js";

export interface RequestOptions {
  timeoutMs?: number;
}

export type MessageSenderFunction = (message: any) => Promise<any>;

export class ExtensionMessageClient {
  private senderFn: MessageSenderFunction;

  constructor(customSenderFn?: MessageSenderFunction) {
    if (customSenderFn) {
      this.senderFn = customSenderFn;
    } else {
      // Default to Chrome extension runtime message delivery if available
      this.senderFn = async (message: any) => {
        if (typeof chrome !== "undefined" && chrome.runtime?.sendMessage) {
          return new Promise((resolve, reject) => {
            chrome.runtime.sendMessage(message, (response) => {
              const err = chrome.runtime.lastError;
              if (err) {
                reject(new Error(err.message || "Chrome runtime error"));
              } else {
                resolve(response);
              }
            });
          });
        }
        throw new Error("Chrome extension runtime is not available.");
      };
    }
  }

  /**
   * Send a request expecting a response payload.
   * Leverages correlationId and timeout safety.
   */
  public async request<TRequest, TResponse>(
    type: string,
    payload: TRequest,
    _options: RequestOptions = {},
  ): Promise<TResponse> {
    const messageId = this.generateUuid();
    const envelope: MessageEnvelope = {
      protocolVersion: SUPPORTED_PROTOCOL_VERSION,
      messageId,
      correlationId: messageId,
      type,
      timestamp: Date.now(),
      payload,
    };

    const response = await this.senderFn(envelope);

    if (!response) {
      throw new Error("No response received from message receiver.");
    }

    // Process error envelopes
    if ((response as Partial<MessageError>).code !== undefined) {
      const err = response as MessageError;
      throw new Error(`[${err.code}] ${err.message}`);
    }

    const resEnvelope = response as MessageEnvelope;

    // Correlation validations
    if (resEnvelope.correlationId !== messageId) {
      throw new Error(
        "Correlation mismatch: response correlationId does not match request messageId.",
      );
    }

    if (resEnvelope.type !== `${type}_RESPONSE`) {
      throw new Error(`Response type mismatch. Expected ${type}_RESPONSE, got ${resEnvelope.type}`);
    }

    return resEnvelope.payload as TResponse;
  }

  /**
   * Post a one-way notification event.
   */
  public async post<TEvent>(type: string, payload: TEvent): Promise<void> {
    const messageId = this.generateUuid();
    const envelope: MessageEnvelope = {
      protocolVersion: SUPPORTED_PROTOCOL_VERSION,
      messageId,
      type,
      timestamp: Date.now(),
      payload,
    };

    await this.senderFn(envelope);
  }

  private generateUuid(): string {
    return (
      Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
    );
  }
}
