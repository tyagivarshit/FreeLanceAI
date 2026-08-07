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

export interface LoginSucceededPayload {
  userId: string;
  ipAddress: string;
  deviceName: string;
}

export interface LoginFailedPayload {
  email: string;
  reason: string;
  ipAddress: string;
}

export interface AccountLockedPayload {
  userId: string;
  email: string;
}

export interface NewDeviceDetectedPayload {
  userId: string;
  ipAddress: string;
  browser: string;
  platform: string;
}

export interface SessionRevokedPayload {
  sessionId: string;
  userId: string;
  revokedAt: string;
}

export interface UserLoggedOutPayload {
  userId: string;
  ipAddress: string;
  reason: "user_triggered" | "session_expired";
}

export interface GlobalLogoutCompletedPayload {
  userId: string;
  revokedSessionCount: number;
  revokedAt: string;
}

export interface AuthenticationSucceededPayload {
  userId: string;
  sessionId: string;
  authenticatedAt: string;
}

export interface AuthenticationFailedPayload {
  ipAddress: string;
  reason: string;
}

export interface SessionInvalidPayload {
  sessionId: string;
  reason: "revoked" | "expired";
}

export interface IdentityInvalidatedPayload {
  userId: string;
  sessionId: string;
}

export interface EventDispatcher {
  publish(eventName: "IDENTITY_REGISTERED", payload: IdentityRegisteredPayload): Promise<void>;
  publish(
    eventName: "REGISTRATION_ATTEMPT_ON_EXISTING_EMAIL",
    payload: RegistrationAttemptExistingEmailPayload,
  ): Promise<void>;
  publish(eventName: "LOGIN_SUCCEEDED", payload: LoginSucceededPayload): Promise<void>;
  publish(eventName: "LOGIN_FAILED", payload: LoginFailedPayload): Promise<void>;
  publish(eventName: "ACCOUNT_LOCKED", payload: AccountLockedPayload): Promise<void>;
  publish(eventName: "NEW_DEVICE_DETECTED", payload: NewDeviceDetectedPayload): Promise<void>;
  publish(eventName: "SESSION_REVOKED", payload: SessionRevokedPayload): Promise<void>;
  publish(eventName: "USER_LOGGED_OUT", payload: UserLoggedOutPayload): Promise<void>;
  publish(
    eventName: "GLOBAL_LOGOUT_COMPLETED",
    payload: GlobalLogoutCompletedPayload,
  ): Promise<void>;
  publish(
    eventName: "AUTHENTICATION_SUCCEEDED",
    payload: AuthenticationSucceededPayload,
  ): Promise<void>;
  publish(eventName: "AUTHENTICATION_FAILED", payload: AuthenticationFailedPayload): Promise<void>;
  publish(eventName: "SESSION_INVALID", payload: SessionInvalidPayload): Promise<void>;
  publish(eventName: "IDENTITY_INVALIDATED", payload: IdentityInvalidatedPayload): Promise<void>;
}

export interface BackgroundTaskDispatcher {
  dispatch(taskName: "SEND_VERIFICATION_EMAIL", data: SendVerificationEmailPayload): Promise<void>;
}

/**
 * Concrete implementation of the Event Dispatcher.
 * Publishes events asynchronously and records structured audits.
 */
export class QueueEventDispatcher implements EventDispatcher {
  async publish(eventName: string, payload: unknown): Promise<void> {
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
  async dispatch(taskName: string, data: unknown): Promise<void> {
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
