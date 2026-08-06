import { AsyncLocalStorage } from "async_hooks";
export interface LogContextStore {
    correlationId: string;
    tenantId?: string;
    requestId?: string;
    userId?: string;
    jobId?: string;
}
export declare const loggerContextStore: AsyncLocalStorage<LogContextStore>;
/**
 * Executes a callback within a type-safe async storage context mapping.
 */
export declare function runWithContext<T>(store: LogContextStore, callback: () => T): T;
/**
 * Retrieves the current correlation metadata store.
 */
export declare function getContextStore(): LogContextStore | undefined;
//# sourceMappingURL=context.d.ts.map