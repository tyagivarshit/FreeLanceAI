import { db, sessions } from "@freelanceos/db";
import { eq, and, isNull, gt } from "drizzle-orm";
import { runtimeConfig } from "@freelanceos/config";
import { createSession, SessionMetadata, SessionResult } from "./session.js";
import { MaxSessionsExceededError } from "./login.js";

/**
 * Service orchestrating user session lifecycles, capacity boundaries, and persistence.
 */
export class SessionService {
  /**
   * Establishes a stateful session while evaluating concurrent boundaries.
   */
  async establishSession(userId: string, metadata: SessionMetadata): Promise<SessionResult> {
    // 1. Check current active sessions
    const activeSessions = await db
      .select({
        id: sessions.id,
        lastActivityAt: sessions.lastActivityAt,
      })
      .from(sessions)
      .where(
        and(
          eq(sessions.userId, userId),
          isNull(sessions.revokedAt),
          gt(sessions.expiresAt, new Date()),
        ),
      );

    const maxConcurrent = runtimeConfig.CONFIG_MAX_CONCURRENT_SESSIONS;
    if (activeSessions.length >= maxConcurrent) {
      const strategy = runtimeConfig.CONFIG_CONCURRENT_SESSION_STRATEGY;
      if (strategy === "revoke_oldest") {
        activeSessions.sort((a, b) => a.lastActivityAt.getTime() - b.lastActivityAt.getTime());
        const numToRevoke = activeSessions.length - maxConcurrent + 1;
        for (let i = 0; i < numToRevoke; i++) {
          const oldestSession = activeSessions[i];
          if (oldestSession) {
            await db
              .update(sessions)
              .set({ revokedAt: new Date() })
              .where(eq(sessions.id, oldestSession.id));
          }
        }
      } else if (strategy === "deny_access") {
        throw new MaxSessionsExceededError();
      }
    }

    // 2. Delegate to the core session builder
    return createSession(userId, metadata);
  }

  /**
   * Explicitly terminates an individual session.
   * If already revoked or expired, returns active info indicating alreadyRevoked.
   */
  async revokeSession(
    sessionId: string,
  ): Promise<{ userId: string; sessionId: string; alreadyRevoked: boolean } | null> {
    const sessionRecords = await db
      .select({
        id: sessions.id,
        userId: sessions.userId,
        revokedAt: sessions.revokedAt,
        expiresAt: sessions.expiresAt,
      })
      .from(sessions)
      .where(eq(sessions.id, sessionId));

    if (sessionRecords.length === 0) {
      return null;
    }

    const session = sessionRecords[0];
    if (!session) {
      return null;
    }

    const isExpired = session.expiresAt.getTime() <= Date.now();
    const isAlreadyRevoked = session.revokedAt !== null;

    if (isAlreadyRevoked || isExpired) {
      return {
        userId: session.userId,
        sessionId: session.id,
        alreadyRevoked: true,
      };
    }

    const now = new Date();
    await db
      .update(sessions)
      .set({
        revokedAt: now,
        lastActivityAt: now,
      })
      .where(eq(sessions.id, sessionId));

    return {
      userId: session.userId,
      sessionId: session.id,
      alreadyRevoked: false,
    };
  }

  /**
   * Explicitly terminates all active sessions for a user.
   * Returns the count of active sessions that were revoked.
   */
  async revokeAllSessions(userId: string): Promise<number> {
    const activeSessions = await db
      .select({ id: sessions.id })
      .from(sessions)
      .where(and(eq(sessions.userId, userId), isNull(sessions.revokedAt)));

    if (activeSessions.length > 0) {
      const now = new Date();
      await db
        .update(sessions)
        .set({
          revokedAt: now,
          lastActivityAt: now,
        })
        .where(and(eq(sessions.userId, userId), isNull(sessions.revokedAt)));
    }

    return activeSessions.length;
  }
}

export const sessionService = new SessionService();
