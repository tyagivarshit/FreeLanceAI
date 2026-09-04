import { logger } from "@freelanceos/logger";
import { runtimeConfig } from "@freelanceos/config";
import { getEmailService, createVerificationEmail } from "./email-service.js";
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
 * Offloads execution out of the main request-response thread and dispatches transactional emails.
 */
export class QueueBackgroundTaskDispatcher {
    emailService;
    constructor(emailService) {
        this.emailService = emailService;
    }
    setEmailService(service) {
        this.emailService = service;
    }
    async dispatch(taskName, data) {
        logger.info({
            message: `[Background Task Dispatcher] Dispatching task: ${taskName}`,
            data: { userId: data.userId, email: data.email },
        });
        // Run out of band to prevent blocking the transaction or request thread
        setImmediate(async () => {
            try {
                if (taskName === "SEND_VERIFICATION_EMAIL") {
                    const service = this.emailService ?? getEmailService();
                    const appUrl = runtimeConfig.APP_URL || "http://localhost:4000";
                    const emailContent = createVerificationEmail({
                        email: data.email,
                        token: data.token,
                        appUrl,
                    });
                    await service.sendEmail({
                        to: data.email,
                        subject: emailContent.subject,
                        text: emailContent.text,
                        html: emailContent.html,
                    });
                    logger.info({
                        message: `[Background Task Execution] Executed task: ${taskName}`,
                        userId: data.userId,
                        email: data.email,
                    });
                }
            }
            catch (err) {
                logger.error({
                    message: `[Background Task Execution Error] Failed to execute task ${taskName}`,
                    error: err instanceof Error ? err : new Error(String(err)),
                    userId: data.userId,
                    email: data.email,
                });
            }
        });
    }
}
export const eventDispatcher = new QueueEventDispatcher();
export const backgroundTaskDispatcher = new QueueBackgroundTaskDispatcher();
//# sourceMappingURL=dispatcher.js.map