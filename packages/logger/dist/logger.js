import { pino } from "pino";
import { runtimeConfig } from "@freelanceos/config";
import { getContextStore } from "./context.js";
// Base Pino logger instance.
// Configure serializers for safety and sanitize parameters.
const basePinoLogger = pino({
    level: runtimeConfig.NODE_ENV === "production" ? "info" : "debug",
    formatters: {
        level: (label) => ({ level: label }),
    },
    timestamp: pino.stdTimeFunctions.isoTime,
    redact: {
        paths: [
            "password",
            "token",
            "secret",
            "apiKey",
            "creditCard",
            "authorization",
            "email", // PII Masking: Basic guidelines
            "phoneNumber",
        ],
        censor: "[REDACTED]",
    },
});
/**
 * Structured Logger abstraction.
 * Encapsulates the underlying logger engine, preventing library leakage.
 */
class EnterpriseLogger {
    pino;
    constructor(pinoInstance) {
        this.pino = pinoInstance;
    }
    log(level, payload) {
        const store = getContextStore();
        const context = store ? { ...store } : {};
        if (typeof payload === "string") {
            this.pino[level]({ ...context }, payload);
            return;
        }
        const { message, error, ...metadata } = payload;
        // Auto-serialize Errors safely with stacktraces
        const errMetadata = error
            ? {
                error: {
                    message: error.message,
                    stack: error.stack,
                    name: error.name,
                },
            }
            : {};
        this.pino[level]({ ...context, ...metadata, ...errMetadata }, message);
    }
    trace(payload) {
        this.log("trace", payload);
    }
    debug(payload) {
        this.log("debug", payload);
    }
    info(payload) {
        this.log("info", payload);
    }
    warn(payload) {
        this.log("warn", payload);
    }
    error(payload) {
        this.log("error", payload);
    }
    fatal(payload) {
        this.log("fatal", payload);
    }
}
export const logger = new EnterpriseLogger(basePinoLogger);
//# sourceMappingURL=logger.js.map