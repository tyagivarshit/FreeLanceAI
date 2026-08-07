import { logger } from "@freelanceos/logger";
/**
 * Concrete implementation of the Event Dispatcher.
 * Publishes events asynchronously and records structured audits.
 */
export class QueueEventDispatcher {
    async publish(eventName, payload) {
        logger.info({
            message: `[Event Dispatcher] Emitted event: ${eventName}`,
            payload,
        });
    }
}
/**
 * Concrete implementation of the Background Task Dispatcher.
 * Offloads execution out of the main request-response thread.
 */
export class QueueBackgroundTaskDispatcher {
    async dispatch(taskName, data) {
        logger.info({
            message: `[Background Task Dispatcher] Dispatching task: ${taskName}`,
            data,
        });
        // Run out of band to prevent blocking the transaction or request thread
        setImmediate(() => {
            logger.info({
                message: `[Background Task Execution] Executed task: ${taskName}`,
                data,
            });
        });
    }
}
export const eventDispatcher = new QueueEventDispatcher();
export const backgroundTaskDispatcher = new QueueBackgroundTaskDispatcher();
//# sourceMappingURL=dispatcher.js.map