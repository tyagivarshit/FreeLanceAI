import { AsyncLocalStorage } from "async_hooks";

export interface LogContextStore {
  correlationId: string;
  tenantId?: string;
  requestId?: string;
  userId?: string;
  jobId?: string;
}

export const loggerContextStore = new AsyncLocalStorage<LogContextStore>();

/**
 * Executes a callback within a type-safe async storage context mapping.
 */
export function runWithContext<T>(store: LogContextStore, callback: () => T): T {
  return loggerContextStore.run(store, callback);
}

/**
 * Retrieves the current correlation metadata store.
 */
export function getContextStore(): LogContextStore | undefined {
  return loggerContextStore.getStore();
}
