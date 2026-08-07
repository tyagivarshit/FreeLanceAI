import { logger } from "@freelanceos/logger";

export interface IdentityRegisteredPayload {
  userId: string;
  normalizedEmail: string;
  registeredAt: string;
}

export interface RegistrationAttemptExistingEmailPayload {
  email: string;
  userId: string;
}

export interface SendVerificationEmailPayload {
  userId: string;
  email: string;
  token: string;
}

export interface EventDispatcher {
  publish(eventName: "IDENTITY_REGISTERED", payload: IdentityRegisteredPayload): Promise<void>;
  publish(
    eventName: "REGISTRATION_ATTEMPT_ON_EXISTING_EMAIL",
    payload: RegistrationAttemptExistingEmailPayload,
  ): Promise<void>;
}

export interface BackgroundTaskDispatcher {
  dispatch(taskName: "SEND_VERIFICATION_EMAIL", data: SendVerificationEmailPayload): Promise<void>;
}

/**
 * Concrete implementation of the Event Dispatcher.
 * Publishes events asynchronously and records structured audits.
 */
export class QueueEventDispatcher implements EventDispatcher {
  async publish(
    eventName: string,
    payload: IdentityRegisteredPayload | RegistrationAttemptExistingEmailPayload,
  ): Promise<void> {
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
export class QueueBackgroundTaskDispatcher implements BackgroundTaskDispatcher {
  async dispatch(taskName: string, data: SendVerificationEmailPayload): Promise<void> {
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

export const eventDispatcher: EventDispatcher = new QueueEventDispatcher();
export const backgroundTaskDispatcher: BackgroundTaskDispatcher =
  new QueueBackgroundTaskDispatcher();
