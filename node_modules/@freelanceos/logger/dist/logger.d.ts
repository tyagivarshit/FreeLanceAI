import { Logger as PinoLogger } from "pino";
export type LogLevel = "trace" | "debug" | "info" | "warn" | "error" | "fatal";
export interface LogPayload {
    message: string;
    error?: Error;
    [key: string]: unknown;
}
/**
 * Structured Logger abstraction.
 * Encapsulates the underlying logger engine, preventing library leakage.
 */
declare class EnterpriseLogger {
    private pino;
    constructor(pinoInstance: PinoLogger);
    private log;
    trace(payload: LogPayload | string): void;
    debug(payload: LogPayload | string): void;
    info(payload: LogPayload | string): void;
    warn(payload: LogPayload | string): void;
    error(payload: LogPayload | string): void;
    fatal(payload: LogPayload | string): void;
}
export declare const logger: EnterpriseLogger;
export {};
//# sourceMappingURL=logger.d.ts.map