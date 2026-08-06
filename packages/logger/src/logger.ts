import { pino, Logger as PinoLogger } from "pino";
import { runtimeConfig } from "@freelanceos/config";
import { getContextStore } from "./context.js";

// Custom type representing supported log levels
export type LogLevel = "trace" | "debug" | "info" | "warn" | "error" | "fatal";

// Structured log payload schema details
export interface LogPayload {
  message: string;
  error?: Error;
  [key: string]: unknown;
}

// Base Pino logger instance.
// Configure serializers for safety and sanitize parameters.
const basePinoLogger: PinoLogger = pino({
  level: runtimeConfig.NODE_ENV === "production" ? "info" : "debug",
  formatters: {
    level: (label: string) => ({ level: label }),
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
  private pino: PinoLogger;

  constructor(pinoInstance: PinoLogger) {
    this.pino = pinoInstance;
  }

  private log(level: LogLevel, payload: LogPayload | string): void {
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

  public trace(payload: LogPayload | string): void {
    this.log("trace", payload);
  }

  public debug(payload: LogPayload | string): void {
    this.log("debug", payload);
  }

  public info(payload: LogPayload | string): void {
    this.log("info", payload);
  }

  public warn(payload: LogPayload | string): void {
    this.log("warn", payload);
  }

  public error(payload: LogPayload | string): void {
    this.log("error", payload);
  }

  public fatal(payload: LogPayload | string): void {
    this.log("fatal", payload);
  }
}

export const logger = new EnterpriseLogger(basePinoLogger);
