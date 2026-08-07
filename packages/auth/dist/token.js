import crypto from "crypto";
import jwt from "jsonwebtoken";
import { runtimeConfig } from "@freelanceos/config";
export class AuthError extends Error {
    constructor(message) {
        super(message);
        this.name = "AuthError";
    }
}
export class InvalidTokenError extends AuthError {
    code;
    userId;
    sessionId;
    constructor(message, code, userId, sessionId) {
        super(message);
        this.code = code;
        this.userId = userId;
        this.sessionId = sessionId;
        this.name = "InvalidTokenError";
    }
}
export class SessionNotFoundError extends AuthError {
    sessionId;
    constructor(sessionId) {
        super(`Session not found: ${sessionId}`);
        this.sessionId = sessionId;
        this.name = "SessionNotFoundError";
    }
}
export class SessionExpiredError extends AuthError {
    sessionId;
    constructor(sessionId) {
        super(`Session has expired: ${sessionId}`);
        this.sessionId = sessionId;
        this.name = "SessionExpiredError";
    }
}
export class SessionRevokedError extends AuthError {
    sessionId;
    constructor(sessionId) {
        super(`Session has been revoked: ${sessionId}`);
        this.sessionId = sessionId;
        this.name = "SessionRevokedError";
    }
}
export class CredentialNotFoundError extends AuthError {
    userId;
    constructor(userId) {
        super(`Credentials not found for user: ${userId}`);
        this.userId = userId;
        this.name = "CredentialNotFoundError";
    }
}
export class ReplayAttackDetectedError extends AuthError {
    sessionId;
    userId;
    constructor(sessionId, userId) {
        super(`Refresh token replay attack detected on session ${sessionId} for user ${userId}.`);
        this.sessionId = sessionId;
        this.userId = userId;
        this.name = "ReplayAttackDetectedError";
    }
}
/**
 * Signs a short-lived Signed Access Token.
 * Hides JWT details internally using HS256 signature algorithm.
 */
export function signAccessToken(payload) {
    return jwt.sign(payload, runtimeConfig.JWT_SECRET, {
        algorithm: "HS256",
        expiresIn: runtimeConfig.ACCESS_TOKEN_LIFETIME_SEC,
    });
}
/**
 * Verifies a Signed Access Token.
 * Translates jsonwebtoken errors into generic InvalidTokenError.
 */
export function verifyAccessToken(token) {
    try {
        const decoded = jwt.verify(token, runtimeConfig.JWT_SECRET, {
            algorithms: ["HS256"],
        });
        if (!decoded.sessionId || !decoded.userId || decoded.credentialVersion === undefined) {
            throw new InvalidTokenError("Token payload is incomplete", "INVALID");
        }
        return {
            sessionId: decoded.sessionId,
            userId: decoded.userId,
            credentialVersion: decoded.credentialVersion,
        };
    }
    catch (error) {
        if (error instanceof jwt.TokenExpiredError) {
            throw new InvalidTokenError("Access token has expired", "EXPIRED");
        }
        if (error instanceof InvalidTokenError) {
            throw error;
        }
        throw new InvalidTokenError("Access token signature is invalid", "INVALID");
    }
}
/**
 * Generates a secure, cryptographically random refresh token.
 */
export function generateRefreshToken() {
    // 32 bytes of entropy encoded as base64url standard representation
    return crypto.randomBytes(32).toString("base64url");
}
/**
 * Hashes a refresh token using SHA-256.
 */
export function hashRefreshToken(token) {
    return crypto.createHash("sha256").update(token).digest("hex");
}
/**
 * Performs a constant-time comparison of two token hashes to prevent timing attacks.
 */
export function compareRefreshTokenHashes(hashA, hashB) {
    const bufferA = Buffer.from(hashA, "utf8");
    const bufferB = Buffer.from(hashB, "utf8");
    if (bufferA.length !== bufferB.length) {
        return false;
    }
    return crypto.timingSafeEqual(bufferA, bufferB);
}
//# sourceMappingURL=token.js.map