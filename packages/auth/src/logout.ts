import { db, userPasswordHashes, sessions } from "@freelanceos/db";
import { eq } from "drizzle-orm";
import { sessionService } from "./session-service.js";
import { eventDispatcher } from "./dispatcher.js";
import { verifyAccessToken, hashRefreshToken } from "./token.js";
import { logger } from "@freelanceos/logger";

export interface LogoutInput {
  accessToken?: string;
  refreshToken?: string;
  sessionId?: string;
  userId?: string;
  global?: boolean;
  ipAddress?: string;
}

export interface LogoutResult {
  success: boolean;
  clearCredentialDirective: boolean;
}

/**
 * Executes the technology-neutral and transport-independent Logout Use Case.
 */
export async function logoutUser(input: LogoutInput): Promise<LogoutResult> {
  const {
    accessToken,
    refreshToken,
    sessionId: inputSessionId,
    userId: inputUserId,
    global = false,
    ipAddress = "unknown",
  } = input;

  logger.info({
    message: `[Logout Use Case] Initiating logout: global=${global}`,
  });

  let userId = inputUserId;
  let sessionId = inputSessionId;

  // 1. Try to extract identity statelessly from access token
  if (accessToken && (!userId || !sessionId)) {
    try {
      const decoded = verifyAccessToken(accessToken);
      userId = userId || decoded.userId;
      sessionId = sessionId || decoded.sessionId;
    } catch (err) {
      logger.info({
        message: "[Logout Use Case] Access token verification failed or expired, checking fallback",
        error: err instanceof Error ? err : new Error(String(err)),
      });
    }
  }

  // 2. If identity is not resolved yet, resolve from refresh token cookie
  if ((!userId || !sessionId) && refreshToken) {
    try {
      const hashed = hashRefreshToken(refreshToken);
      const sessionRecords = await db
        .select({
          id: sessions.id,
          userId: sessions.userId,
        })
        .from(sessions)
        .where(eq(sessions.refreshTokenHash, hashed))
        .limit(1);

      if (sessionRecords.length > 0 && sessionRecords[0]) {
        sessionId = sessionRecords[0].id;
        userId = sessionRecords[0].userId;
      }
    } catch (err) {
      logger.warn({
        message: "[Logout Use Case] Failed to resolve session from refresh token",
        error: err instanceof Error ? err : new Error(String(err)),
      });
    }
  }

  // 3. Handle Global Logout (Logout All Devices)
  if (global) {
    if (!userId) {
      logger.warn({
        message: "[Logout Use Case] Global logout requested but identity could not be resolved",
      });
      return { success: true, clearCredentialDirective: true };
    }

    // A. Revoke all sessions for this user in the Session Store
    const revokedCount = await sessionService.revokeAllSessions(userId);

    // B. Execute the Identity Versioning Strategy by incrementing the credentialVersion
    const credentials = await db
      .select({
        id: userPasswordHashes.id,
        credentialVersion: userPasswordHashes.credentialVersion,
      })
      .from(userPasswordHashes)
      .where(eq(userPasswordHashes.userId, userId))
      .limit(1);

    if (credentials.length > 0 && credentials[0]) {
      await db
        .update(userPasswordHashes)
        .set({
          credentialVersion: credentials[0].credentialVersion + 1,
          updatedAt: new Date(),
        })
        .where(eq(userPasswordHashes.id, credentials[0].id));
    }

    // C. Publish global logout event asynchronously
    await eventDispatcher.publish("GLOBAL_LOGOUT_COMPLETED", {
      userId,
      revokedSessionCount: revokedCount,
      revokedAt: new Date().toISOString(),
    });

    await eventDispatcher.publish("USER_LOGGED_OUT", {
      userId,
      ipAddress,
      reason: "user_triggered",
    });

    return { success: true, clearCredentialDirective: true };
  }

  // 4. Handle Single Session Logout
  if (!sessionId) {
    logger.warn({
      message:
        "[Logout Use Case] Single logout requested but session identity could not be resolved",
    });
    return { success: true, clearCredentialDirective: true };
  }

  // Revoke session in Session Store
  const revokeResult = await sessionService.revokeSession(sessionId);

  // If session not found or already revoked/expired, return success (idempotent no-op)
  if (!revokeResult) {
    logger.info({
      message: `[Logout Use Case] Session ${sessionId} not found or already inactive (idempotent success)`,
    });
    return { success: true, clearCredentialDirective: true };
  }

  const { userId: sessionUserId, alreadyRevoked } = revokeResult;

  if (!alreadyRevoked) {
    // Publish session revoked events asynchronously
    await eventDispatcher.publish("SESSION_REVOKED", {
      sessionId,
      userId: sessionUserId,
      revokedAt: new Date().toISOString(),
    });

    await eventDispatcher.publish("USER_LOGGED_OUT", {
      userId: sessionUserId,
      ipAddress,
      reason: "user_triggered",
    });
  }

  return { success: true, clearCredentialDirective: true };
}
