import { AsyncLocalStorage } from "async_hooks";
export const loggerContextStore = new AsyncLocalStorage();
/**
 * Executes a callback within a type-safe async storage context mapping.
 */
export function runWithContext(store, callback) {
    return loggerContextStore.run(store, callback);
}
/**
 * Retrieves the current correlation metadata store.
 */
export function getContextStore() {
    return loggerContextStore.getStore();
}
//# sourceMappingURL=context.js.map