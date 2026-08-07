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
export { signAccessToken, verifyAccessToken, AuthError, InvalidTokenError, SessionNotFoundError, CredentialNotFoundError, ReplayAttackDetectedError, SessionExpiredError, SessionRevokedError, } from "./token.js";
export { getSessionCookieConfig, serializeCookie, getSessionCookieClearConfig } from "./cookie.js";
export { createSession, validateSession, rotateSession, revokeSession, revokeAllSessions, findActiveSession, } from "./session.js";
export { signupUser, SignupError, DuplicateEmailError, ValidationError, UserCreationError, CredentialCreationError, VerificationCreationError, SignupTransactionError, } from "./signup.js";
export { hashPassword, verifyPassword, UnsupportedAlgorithmError } from "./hash.js";
export { eventDispatcher, backgroundTaskDispatcher } from "./dispatcher.js";
//# sourceMappingURL=index.js.map