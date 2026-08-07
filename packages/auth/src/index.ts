/*
 * =====================================================================
 * @freelanceos/auth Workspace Public API & Governance
 * =====================================================================
 *
 * [CURRENT IMPLEMENTATION STATE]
 * This package provides ONLY the Session Runtime foundation:
 *   - Stateless Signed Access Token generation and verification (hiding JWT)
 *   - Stateful Refresh Token validation, rotation, and lifecycle controls
 *   - Replay attack mitigation and token theft security lockouts
 *   - Concurrency grace windows for mobile client retries
 *   - Browser-independent cookie abstractions (Set-Cookie headers)
 *
 * The following capabilities are NOT implemented:
 *   - Signup logic:        [Future Responsibility - Not Implemented]
 *   - Login endpoints:     [Future Responsibility - Not Implemented]
 *   - Logout HTTP handler: [Future Responsibility - Not Implemented]
 *   - Auth middleware:     [Future Responsibility - Not Implemented]
 *   - OAuth integration:   [Future Responsibility - Not Implemented]
 *   - MFA setup:           [Future Responsibility - Not Implemented]
 *
 * 1. Signed Access Token Abstraction:
 *    - JSON Web Tokens (JWT) are hidden behind verify/sign abstractions.
 *    - Domain code depends exclusively on generic verification methods.
 *    - Mismatches in `credential_version` automatically flag token expiration/revocation.
 *
 * 2. Token Rotation & Grace Windows:
 *    - Tokens are single-use, rotating automatically on refresh.
 *    - A short, configurable grace period allows duplicate network packets to resolve
 *      without lockout triggers.
 *    - Expired grace intervals on consumed hashes trigger immediate lockout.
 *
 * 3. Configuration Ownership:
 *    - Numeric properties (access token lifetime, refresh token lifetime, grace seconds,
 *      cookie name, SameSite flag) are resolved dynamically from `@freelanceos/config`.
 */

export {
  signAccessToken,
  verifyAccessToken,
  AuthError,
  InvalidTokenError,
  SessionNotFoundError,
  CredentialNotFoundError,
  ReplayAttackDetectedError,
  SessionExpiredError,
  SessionRevokedError,
} from "./token.js";
export type { AccessTokenPayload } from "./token.js";

export {
  getSessionCookieConfig,
  serializeCookie,
  getSessionCookieClearConfig,
  issueSessionCookie,
  issueClearSessionCookie,
} from "./cookie.js";
export type { CookieOptions } from "./cookie.js";

export {
  createSession,
  validateSession,
  rotateSession,
  revokeSession,
  revokeAllSessions,
  findActiveSession,
} from "./session.js";
export type { Session, SessionMetadata, SessionResult } from "./session.js";

export {
  signupUser,
  SignupError,
  DuplicateEmailError,
  ValidationError,
  UserCreationError,
  CredentialCreationError,
  VerificationCreationError,
  SignupTransactionError,
} from "./signup.js";
export type { SignupInput, RegistrationResult } from "./signup.js";

export {
  loginUser,
  LoginError,
  AccountLockedError,
  AccountSuspendedError,
  AccountDisabledError,
  PendingVerificationError,
  AuthenticationFailureError,
  MaxSessionsExceededError,
} from "./login.js";
export type { LoginInput, LoginResult } from "./login.js";

export { hashPassword, verifyPassword, UnsupportedAlgorithmError } from "./hash.js";

export { eventDispatcher, backgroundTaskDispatcher } from "./dispatcher.js";
export type { EventDispatcher, BackgroundTaskDispatcher } from "./dispatcher.js";

export { mapAuthError } from "./errors.js";
export type { AbstractHttpResponse } from "./errors.js";

export { deviceRecognitionService, parseUserAgent } from "./device-recognition-service.js";
export type { DeviceTelemetryInput, ParsedDeviceMetadata } from "./device-recognition-service.js";

export { sessionService, SessionService } from "./session-service.js";

export { logoutUser } from "./logout.js";
export type { LogoutInput, LogoutResult } from "./logout.js";

export { authenticateRequest } from "./middleware.js";
export type { AuthenticateRequestInput, AuthenticationResult } from "./middleware.js";

export { identityStore, DbIdentityStore } from "./identity-store.js";
export type { IdentityStore, UserIdentity } from "./identity-store.js";
