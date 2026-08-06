export { signAccessToken, verifyAccessToken, AuthError, InvalidTokenError, SessionNotFoundError, CredentialNotFoundError, ReplayAttackDetectedError, SessionExpiredError, SessionRevokedError, } from "./token.js";
export type { AccessTokenPayload } from "./token.js";
export { getSessionCookieConfig, serializeCookie, getSessionCookieClearConfig } from "./cookie.js";
export type { CookieOptions } from "./cookie.js";
export { createSession, validateSession, rotateSession, revokeSession, revokeAllSessions, findActiveSession, } from "./session.js";
export type { Session, SessionMetadata, SessionResult } from "./session.js";
//# sourceMappingURL=index.d.ts.map