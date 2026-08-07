export { signAccessToken, verifyAccessToken, AuthError, InvalidTokenError, SessionNotFoundError, CredentialNotFoundError, ReplayAttackDetectedError, SessionExpiredError, SessionRevokedError, } from "./token.js";
export type { AccessTokenPayload } from "./token.js";
export { getSessionCookieConfig, serializeCookie, getSessionCookieClearConfig, issueSessionCookie, issueClearSessionCookie, } from "./cookie.js";
export type { CookieOptions } from "./cookie.js";
export { createSession, validateSession, rotateSession, revokeSession, revokeAllSessions, findActiveSession, } from "./session.js";
export type { Session, SessionMetadata, SessionResult } from "./session.js";
export { signupUser, SignupError, DuplicateEmailError, ValidationError, UserCreationError, CredentialCreationError, VerificationCreationError, SignupTransactionError, } from "./signup.js";
export type { SignupInput, RegistrationResult } from "./signup.js";
export { loginUser, LoginError, AccountLockedError, AccountSuspendedError, AccountDisabledError, PendingVerificationError, AuthenticationFailureError, MaxSessionsExceededError, } from "./login.js";
export type { LoginInput, LoginResult } from "./login.js";
export { hashPassword, verifyPassword, UnsupportedAlgorithmError } from "./hash.js";
export { eventDispatcher, backgroundTaskDispatcher } from "./dispatcher.js";
export type { EventDispatcher, BackgroundTaskDispatcher } from "./dispatcher.js";
export { mapAuthError } from "./errors.js";
export type { AbstractHttpResponse } from "./errors.js";
export { deviceRecognitionService, parseUserAgent } from "./device-recognition-service.js";
export type { DeviceTelemetryInput, ParsedDeviceMetadata } from "./device-recognition-service.js";
export { sessionService, SessionService } from "./session-service.js";
//# sourceMappingURL=index.d.ts.map