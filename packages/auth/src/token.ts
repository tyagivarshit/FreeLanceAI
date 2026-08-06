import crypto from "crypto";
import jwt from "jsonwebtoken";
import { runtimeConfig } from "@freelanceos/config";

export interface AccessTokenPayload {
  sessionId: string;
  userId: string;
  credentialVersion: number;
}

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthError";
  }
}

export class InvalidTokenError extends AuthError {
  constructor(
    message: string,
    public readonly code: "EXPIRED" | "INVALID",
  ) {
    super(message);
    this.name = "InvalidTokenError";
  }
}

export class SessionNotFoundError extends AuthError {
  constructor(public readonly sessionId: string) {
    super(`Session not found: ${sessionId}`);
    this.name = "SessionNotFoundError";
  }
}

export class SessionExpiredError extends AuthError {
  constructor(public readonly sessionId: string) {
    super(`Session has expired: ${sessionId}`);
    this.name = "SessionExpiredError";
  }
}

export class SessionRevokedError extends AuthError {
  constructor(public readonly sessionId: string) {
    super(`Session has been revoked: ${sessionId}`);
    this.name = "SessionRevokedError";
  }
}

export class CredentialNotFoundError extends AuthError {
  constructor(public readonly userId: string) {
    super(`Credentials not found for user: ${userId}`);
    this.name = "CredentialNotFoundError";
  }
}

export class ReplayAttackDetectedError extends AuthError {
  constructor(
    public readonly sessionId: string,
    public readonly userId: string,
  ) {
    super(`Refresh token replay attack detected on session ${sessionId} for user ${userId}.`);
    this.name = "ReplayAttackDetectedError";
  }
}

/**
 * Signs a short-lived Signed Access Token.
 * Hides JWT details internally using HS256 signature algorithm.
 */
export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, runtimeConfig.JWT_SECRET, {
    algorithm: "HS256",
    expiresIn: runtimeConfig.ACCESS_TOKEN_LIFETIME_SEC,
  });
}

/**
 * Verifies a Signed Access Token.
 * Translates jsonwebtoken errors into generic InvalidTokenError.
 */
export function verifyAccessToken(token: string): AccessTokenPayload {
  try {
    const decoded = jwt.verify(token, runtimeConfig.JWT_SECRET, {
      algorithms: ["HS256"],
    }) as jwt.JwtPayload;

    if (!decoded.sessionId || !decoded.userId || decoded.credentialVersion === undefined) {
      throw new InvalidTokenError("Token payload is incomplete", "INVALID");
    }

    return {
      sessionId: decoded.sessionId,
      userId: decoded.userId,
      credentialVersion: decoded.credentialVersion,
    };
  } catch (error) {
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
export function generateRefreshToken(): string {
  // 32 bytes of entropy encoded as base64url standard representation
  return crypto.randomBytes(32).toString("base64url");
}

/**
 * Hashes a refresh token using SHA-256.
 */
export function hashRefreshToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/**
 * Performs a constant-time comparison of two token hashes to prevent timing attacks.
 */
export function compareRefreshTokenHashes(hashA: string, hashB: string): boolean {
  const bufferA = Buffer.from(hashA, "utf8");
  const bufferB = Buffer.from(hashB, "utf8");

  if (bufferA.length !== bufferB.length) {
    return false;
  }

  return crypto.timingSafeEqual(bufferA, bufferB);
}
