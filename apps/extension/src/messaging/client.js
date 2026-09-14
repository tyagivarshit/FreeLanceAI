import { SUPPORTED_PROTOCOL_VERSION } from "./schema.js";
export class ExtensionMessageClient {
    senderFn;
    constructor(customSenderFn) {
        if (customSenderFn) {
            this.senderFn = customSenderFn;
        }
        else {
            // Default to Chrome extension runtime message delivery if available
            this.senderFn = async (message) => {
                if (typeof chrome !== "undefined" && chrome.runtime?.sendMessage) {
                    return new Promise((resolve, reject) => {
                        chrome.runtime.sendMessage(message, (response) => {
                            const err = chrome.runtime.lastError;
                            if (err) {
                                reject(new Error(err.message || "Chrome runtime error"));
                            }
                            else {
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
    async request(type, payload, _options = {}) {
        const messageId = this.generateUuid();
        const envelope = {
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
        if (response.code !== undefined) {
            const err = response;
            throw new Error(`[${err.code}] ${err.message}`);
        }
        const resEnvelope = response;
        // Correlation validations
        if (resEnvelope.correlationId !== messageId) {
            throw new Error("Correlation mismatch: response correlationId does not match request messageId.");
        }
        if (resEnvelope.type !== `${type}_RESPONSE`) {
            throw new Error(`Response type mismatch. Expected ${type}_RESPONSE, got ${resEnvelope.type}`);
        }
        return resEnvelope.payload;
    }
    /**
     * Post a one-way notification event.
     */
    async post(type, payload) {
        const messageId = this.generateUuid();
        const envelope = {
            protocolVersion: SUPPORTED_PROTOCOL_VERSION,
            messageId,
            type,
            timestamp: Date.now(),
            payload,
        };
        await this.senderFn(envelope);
    }
    generateUuid() {
        return (Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15));
    }
}
