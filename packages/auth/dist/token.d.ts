export interface AccessTokenPayload {
    sessionId: string;
    userId: string;
    credentialVersion: number;
}
export declare class AuthError extends Error {
    constructor(message: string);
}
export declare class InvalidTokenError extends AuthError {
    readonly code: "EXPIRED" | "INVALID";
    readonly userId?: string | undefined;
    readonly sessionId?: string | undefined;
    constructor(message: string, code: "EXPIRED" | "INVALID", userId?: string | undefined, sessionId?: string | undefined);
}
export declare class SessionNotFoundError extends AuthError {
    readonly sessionId: string;
    constructor(sessionId: string);
}
export declare class SessionExpiredError extends AuthError {
    readonly sessionId: string;
    constructor(sessionId: string);
}
export declare class SessionRevokedError extends AuthError {
    readonly sessionId: string;
    constructor(sessionId: string);
}
export declare class CredentialNotFoundError extends AuthError {
    readonly userId: string;
    constructor(userId: string);
}
export declare class ReplayAttackDetectedError extends AuthError {
    readonly sessionId: string;
    readonly userId: string;
    constructor(sessionId: string, userId: string);
}
/**
 * Signs a short-lived Signed Access Token.
 * Hides JWT details internally using HS256 signature algorithm.
 */
export declare function signAccessToken(payload: AccessTokenPayload): string;
/**
 * Verifies a Signed Access Token.
 * Translates jsonwebtoken errors into generic InvalidTokenError.
 */
export declare function verifyAccessToken(token: string): AccessTokenPayload;
/**
 * Generates a secure, cryptographically random refresh token.
 */
export declare function generateRefreshToken(): string;
/**
 * Hashes a refresh token using SHA-256.
 */
export declare function hashRefreshToken(token: string): string;
/**
 * Performs a constant-time comparison of two token hashes to prevent timing attacks.
 */
export declare function compareRefreshTokenHashes(hashA: string, hashB: string): boolean;
//# sourceMappingURL=token.d.ts.map