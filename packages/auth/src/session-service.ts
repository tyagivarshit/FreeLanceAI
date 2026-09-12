import { db, sessions, users } from "@freelanceos/db";
import { eq, and, or, isNull, isNotNull, gt, lt } from "drizzle-orm";
import { runtimeConfig } from "@freelanceos/config";
import { createSession, SessionMetadata, SessionResult } from "./session.js";
import { MaxSessionsExceededError } from "./login.js";
import { RedisCacheStore } from "@freelanceos/redis";

/**
 * Service orchestrating user session lifecycles, capacity boundaries, and persistence.
 */
export class SessionService {
  /**
   * Establishes a stateful session while evaluating concurrent boundaries.
   */
  async establishSession(userId: string, metadata: SessionMetadata): Promise<SessionResult> {
    return await db.transaction(async (tx) => {
      // 1. Lock the user row to serialize session creation and prevent race conditions
      await tx.select({ id: users.id }).from(users).where(eq(users.id, userId)).for("update");

      // 2. Check current active sessions
      const activeSessions = await tx
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
              await tx
                .update(sessions)
                .set({ revokedAt: new Date() })
                .where(eq(sessions.id, oldestSession.id));
                
              try {
                const cache = new RedisCacheStore();
                await cache.delete(`session:valid:${oldestSession.id}`);
              } catch (e) {}
            }
          }
        } else if (strategy === "deny_access") {
          throw new MaxSessionsExceededError();
        }
      }

      // 3. Delegate to the core session builder
      return createSession(userId, metadata, tx);
    });
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

    try {
      const cache = new RedisCacheStore();
      await cache.delete(`session:valid:${sessionId}`);
    } catch (e) {}

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

      try {
        const cache = new RedisCacheStore();
        for (const s of activeSessions) {
          await cache.delete(`session:valid:${s.id}`);
        }
      } catch (e) {}
    }

    return activeSessions.length;
  }

  /**
   * Sweeps the database for dead or expired sessions to prevent infinite growth.
   * Can be invoked periodically via a cron job or background worker.
   */
  async cleanupExpiredSessions(): Promise<void> {
    await db.delete(sessions)
      .where(
        or(
          isNotNull(sessions.revokedAt),
          lt(sessions.expiresAt, new Date())
        )
      );
  }
}

export const sessionService = new SessionService();
