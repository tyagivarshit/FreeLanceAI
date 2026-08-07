import { db, sessions, userPasswordHashes } from "@freelanceos/db";
import { eq, and, gt, isNull } from "drizzle-orm";
import { runtimeConfig } from "@freelanceos/config";
import { logger } from "@freelanceos/logger";
import { generateRefreshToken, hashRefreshToken, compareRefreshTokenHashes, signAccessToken, verifyAccessToken, InvalidTokenError, SessionNotFoundError, CredentialNotFoundError, ReplayAttackDetectedError, SessionExpiredError, SessionRevokedError, } from "./token.js";
/**
 * Creates a stateful session and issues access/refresh tokens.
 */
export async function createSession(userId, metadata) {
    // 1. Resolve credential version for token binding
    const credentials = await db
        .select({ credentialVersion: userPasswordHashes.credentialVersion })
        .from(userPasswordHashes)
        .where(eq(userPasswordHashes.userId, userId))
        .limit(1);
    const firstCredential = credentials[0];
    if (!firstCredential) {
        throw new CredentialNotFoundError(userId);
    }
    const credentialVersion = firstCredential.credentialVersion;
    // 2. Generate random Refresh Token
    const rawToken = generateRefreshToken();
    const tokenHash = hashRefreshToken(rawToken);
    // 3. Compute absolute session expiration
    const lifespanMs = runtimeConfig.REFRESH_TOKEN_LIFETIME_SEC * 1000;
    const expiresAt = new Date(Date.now() + lifespanMs);
    // 4. Save session to database
    const insertedRecords = await db
        .insert(sessions)
        .values({
        userId,
        refreshTokenHash: tokenHash,
        expiresAt,
        lastActivityAt: new Date(),
        revokedAt: null,
        deviceName: metadata.deviceName ?? null,
        platform: metadata.platform ?? null,
        browser: metadata.browser ?? null,
        userAgent: metadata.userAgent,
        ipAddress: metadata.ipAddress,
        rotationCounter: 0,
    })
        .returning({ id: sessions.id });
    const sessionRecord = insertedRecords[0];
    if (!sessionRecord) {
        throw new Error("[Session Error] Failed to insert session record");
    }
    // 5. Construct composite refresh token (sessionId.rawTokenString)
    const compositeRefreshToken = `${sessionRecord.id}.${rawToken}`;
    // 6. Sign access token
    const signedAccessToken = signAccessToken({
        sessionId: sessionRecord.id,
        userId,
        credentialVersion,
    });
    return {
        sessionId: sessionRecord.id,
        userId,
        rawRefreshToken: compositeRefreshToken,
        signedAccessToken,
        expiresAt,
    };
}
/**
 * Validates a Signed Access Token statelessly and maps it back to active database session invariants.
 */
export async function validateSession(accessToken) {
    // 1. Statelessly decode and verify access token signatures and expiry
    const payload = verifyAccessToken(accessToken);
    // 2. Verify credential version state in database to support instant global logouts
    const credentials = await db
        .select({ credentialVersion: userPasswordHashes.credentialVersion })
        .from(userPasswordHashes)
        .where(eq(userPasswordHashes.userId, payload.userId))
        .limit(1);
    const firstCredential = credentials[0];
    if (!firstCredential || firstCredential.credentialVersion !== payload.credentialVersion) {
        throw new InvalidTokenError("User credentials have changed. Session invalidated.", "INVALID", payload.userId, payload.sessionId);
    }
    // 3. Assert active session database state
    const sessionList = await db
        .select()
        .from(sessions)
        .where(eq(sessions.id, payload.sessionId))
        .limit(1);
    const session = sessionList[0];
    if (!session) {
        throw new SessionNotFoundError(payload.sessionId);
    }
    if (session.revokedAt) {
        throw new SessionRevokedError(payload.sessionId);
    }
    if (session.expiresAt.getTime() < Date.now()) {
        throw new SessionExpiredError(payload.sessionId);
    }
    return {
        sessionId: payload.sessionId,
        userId: payload.userId,
    };
}
/**
 * Rotates a refresh token, checking for replay theft attacks and applying concurrency grace periods.
 */
export async function rotateSession(rawRefreshToken, metadata) {
    const parts = rawRefreshToken.split(".");
    if (parts.length !== 2) {
        throw new InvalidTokenError("Malformed refresh token structure", "INVALID");
    }
    const sessionId = parts[0];
    const rawToken = parts[1];
    if (!sessionId || !rawToken) {
        throw new InvalidTokenError("Malformed refresh token structure", "INVALID");
    }
    const submittedHash = hashRefreshToken(rawToken);
    return await db.transaction(async (tx) => {
        // Retrieve target session record with pessimistic locking (SELECT FOR UPDATE)
        const sessionList = await tx
            .select()
            .from(sessions)
            .where(eq(sessions.id, sessionId))
            .for("update")
            .limit(1);
        const session = sessionList[0];
        if (!session) {
            throw new SessionNotFoundError(sessionId);
        }
        // Invariant Guard: Expired sessions cannot be rotated
        if (session.expiresAt.getTime() < Date.now()) {
            throw new SessionExpiredError(sessionId);
        }
        // Invariant Guard: Explicitly revoked sessions cannot be rotated
        if (session.revokedAt) {
            throw new SessionRevokedError(sessionId);
        }
        // Verify token hash matches current database token hash
        const isCurrentToken = compareRefreshTokenHashes(submittedHash, session.refreshTokenHash);
        if (!isCurrentToken) {
            // Audit check: Compare timestamp delta to support concurrent grace windows
            const timeSinceLastUpdateMs = Date.now() - session.updatedAt.getTime();
            const isWithinGracePeriod = timeSinceLastUpdateMs <= runtimeConfig.ROTATION_GRACE_PERIOD_SEC * 1000;
            if (isWithinGracePeriod) {
                logger.warn({
                    message: "Session token reuse within concurrency grace window.",
                    sessionId,
                    timeSinceLastUpdateMs,
                });
                // Fallback: Generate a new valid token pair for the client without revoking session
                const newRawToken = generateRefreshToken();
                const newHash = hashRefreshToken(newRawToken);
                await tx
                    .update(sessions)
                    .set({
                    refreshTokenHash: newHash,
                    lastActivityAt: new Date(),
                    deviceName: metadata.deviceName ?? session.deviceName,
                    platform: metadata.platform ?? session.platform,
                    browser: metadata.browser ?? session.browser,
                    userAgent: metadata.userAgent,
                    ipAddress: metadata.ipAddress,
                })
                    .where(eq(sessions.id, sessionId));
                const credentials = await tx
                    .select({ credentialVersion: userPasswordHashes.credentialVersion })
                    .from(userPasswordHashes)
                    .where(eq(userPasswordHashes.userId, session.userId))
                    .limit(1);
                const firstCredential = credentials[0];
                const credentialVersion = firstCredential ? firstCredential.credentialVersion : 0;
                const newSignedAccessToken = signAccessToken({
                    sessionId: session.id,
                    userId: session.userId,
                    credentialVersion,
                });
                return {
                    newRawRefreshToken: `${session.id}.${newRawToken}`,
                    newSignedAccessToken,
                };
            }
            // Replay attack invariant triggered! Invalidate all user sessions immediately.
            logger.error({
                message: "Refresh token replay attack detected! Revoking all sessions for the target user.",
                sessionId,
                userId: session.userId,
            });
            await tx
                .update(sessions)
                .set({ revokedAt: new Date() })
                .where(eq(sessions.userId, session.userId));
            throw new ReplayAttackDetectedError(sessionId, session.userId);
        }
        // Retrieve user credentials version
        const credentials = await tx
            .select({ credentialVersion: userPasswordHashes.credentialVersion })
            .from(userPasswordHashes)
            .where(eq(userPasswordHashes.userId, session.userId))
            .limit(1);
        const firstCredential = credentials[0];
        if (!firstCredential) {
            throw new CredentialNotFoundError(session.userId);
        }
        const credentialVersion = firstCredential.credentialVersion;
        // Generate new token pair
        const newRawToken = generateRefreshToken();
        const newHash = hashRefreshToken(newRawToken);
        const lifespanMs = runtimeConfig.REFRESH_TOKEN_LIFETIME_SEC * 1000;
        const newExpiresAt = new Date(Date.now() + lifespanMs);
        // Update session record
        await tx
            .update(sessions)
            .set({
            refreshTokenHash: newHash,
            expiresAt: newExpiresAt,
            lastActivityAt: new Date(),
            rotationCounter: session.rotationCounter + 1,
            deviceName: metadata.deviceName ?? session.deviceName,
            platform: metadata.platform ?? session.platform,
            browser: metadata.browser ?? session.browser,
            userAgent: metadata.userAgent,
            ipAddress: metadata.ipAddress,
        })
            .where(eq(sessions.id, sessionId));
        const newSignedAccessToken = signAccessToken({
            sessionId: session.id,
            userId: session.userId,
            credentialVersion,
        });
        return {
            newRawRefreshToken: `${session.id}.${newRawToken}`,
            newSignedAccessToken,
        };
    });
}
/**
 * Revokes a specific session.
 */
export async function revokeSession(sessionId) {
    await db.update(sessions).set({ revokedAt: new Date() }).where(eq(sessions.id, sessionId));
}
/**
 * Revokes all sessions belonging to a user.
 */
export async function revokeAllSessions(userId) {
    await db.update(sessions).set({ revokedAt: new Date() }).where(eq(sessions.userId, userId));
}
/**
 * Locates an active, unexpired, and unrevoked session by its identifier.
 */
export async function findActiveSession(sessionId) {
    const result = await db
        .select()
        .from(sessions)
        .where(and(eq(sessions.id, sessionId), isNull(sessions.revokedAt), gt(sessions.expiresAt, new Date())))
        .limit(1);
    const session = result[0];
    if (!session) {
        return null;
    }
    return {
        id: session.id,
        userId: session.userId,
        refreshTokenHash: session.refreshTokenHash,
        expiresAt: session.expiresAt,
        lastActivityAt: session.lastActivityAt,
        revokedAt: session.revokedAt,
        deviceName: session.deviceName,
        platform: session.platform,
        browser: session.browser,
        userAgent: session.userAgent,
        ipAddress: session.ipAddress,
        rotationCounter: session.rotationCounter,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
    };
}
//# sourceMappingURL=session.js.map