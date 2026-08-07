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
   * Explicitly terminates a user session.
   */
  async revokeSessionById(sessionId: string): Promise<void> {
    await db.update(sessions).set({ revokedAt: new Date() }).where(eq(sessions.id, sessionId));
  }
}

export const sessionService = new SessionService();
