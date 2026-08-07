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
export interface EventDispatcher {
    publish(eventName: "IDENTITY_REGISTERED", payload: IdentityRegisteredPayload): Promise<void>;
    publish(eventName: "REGISTRATION_ATTEMPT_ON_EXISTING_EMAIL", payload: RegistrationAttemptExistingEmailPayload): Promise<void>;
    publish(eventName: "LOGIN_SUCCEEDED", payload: LoginSucceededPayload): Promise<void>;
    publish(eventName: "LOGIN_FAILED", payload: LoginFailedPayload): Promise<void>;
    publish(eventName: "ACCOUNT_LOCKED", payload: AccountLockedPayload): Promise<void>;
    publish(eventName: "NEW_DEVICE_DETECTED", payload: NewDeviceDetectedPayload): Promise<void>;
}
export interface BackgroundTaskDispatcher {
    dispatch(taskName: "SEND_VERIFICATION_EMAIL", data: SendVerificationEmailPayload): Promise<void>;
}
/**
 * Concrete implementation of the Event Dispatcher.
 * Publishes events asynchronously and records structured audits.
 */
export declare class QueueEventDispatcher implements EventDispatcher {
    publish(eventName: string, payload: unknown): Promise<void>;
}
/**
 * Concrete implementation of the Background Task Dispatcher.
 * Offloads execution out of the main request-response thread.
 */
export declare class QueueBackgroundTaskDispatcher implements BackgroundTaskDispatcher {
    dispatch(taskName: string, data: unknown): Promise<void>;
}
export declare const eventDispatcher: EventDispatcher;
export declare const backgroundTaskDispatcher: BackgroundTaskDispatcher;
//# sourceMappingURL=dispatcher.d.ts.map