import { RedisCacheStore } from "@freelanceos/redis";
import { logger } from "@freelanceos/logger";
import { eventDispatcher } from "./dispatcher.js";
import { revokeSession } from "./session.js";

// ==========================================
// 1. Context-Aware Session Hijack Defense
// ==========================================

export class SessionHijackDetectedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SessionHijackDetectedError";
  }
}

/**
 * Validates strictly that the incoming request's IP and UserAgent
 * matches the original token metadata. If a mismatch is detected,
 * the session is instantly destroyed to prevent hijacking.
 */
export async function verifySessionContextFingerprint(
  sessionId: string,
  userId: string,
  expectedIp: string | null,
  expectedUserAgent: string | null,
  currentIp: string,
  currentUserAgent: string
): Promise<void> {
  // If the DB doesn't have the original metadata, we can't strictly compare.
  // But if it does, we enforce a strict match.
  if (expectedIp && expectedIp !== currentIp) {
    await triggerHijackProtocol(sessionId, userId, "IP_MISMATCH", { expectedIp, currentIp });
    throw new SessionHijackDetectedError("Session hijacked: IP Address mismatch");
  }

  if (expectedUserAgent && expectedUserAgent !== currentUserAgent) {
    await triggerHijackProtocol(sessionId, userId, "USER_AGENT_MISMATCH", { expectedUserAgent, currentUserAgent });
    throw new SessionHijackDetectedError("Session hijacked: User-Agent mismatch");
  }
}

async function triggerHijackProtocol(
  sessionId: string, 
  userId: string, 
  reason: string, 
  context: Record<string, string>
) {
  logger.warn({
    message: "Session Hijack Attempt Detected. Destroying session.",
    sessionId,
    userId,
    reason,
    context
  });

  // Instantly revoke the session in Postgres and Redis
  await revokeSession(sessionId);

  // Dispatch security event
  await eventDispatcher.publish("SESSION_HIJACK_PREVENTED", {
    sessionId,
    userId,
    reason,
    ...context
  });
}

// ==========================================
// 2. Strict Sliding Window Rate Limiter (MFA)
// ==========================================

export class RateLimitExceededError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RateLimitExceededError";
  }
}

const MAX_MFA_ATTEMPTS = 5;
const BLOCK_DURATION_SEC = 900; // 15 minutes

/**
 * Checks if the user is currently blocked from MFA attempts.
 */
export async function enforceMfaRateLimit(userId: string): Promise<void> {
  const cache = new RedisCacheStore();
  const blockKey = `mfa:block:${userId}`;
  
  const isBlocked = await cache.get(blockKey);
  if (isBlocked) {
    throw new RateLimitExceededError("Account temporarily locked due to too many failed MFA attempts. Please try again in 15 minutes.");
  }
}

/**
 * Records a failed MFA attempt and manages the sliding window.
 * If failures >= 5, applies a 15-minute block.
 */
export async function recordFailedMfaAttempt(userId: string): Promise<void> {
  const cache = new RedisCacheStore();
  const attemptsKey = `mfa:attempts:${userId}`;
  const blockKey = `mfa:block:${userId}`;

  const attempts = await cache.increment(attemptsKey, BLOCK_DURATION_SEC);

  if (attempts >= MAX_MFA_ATTEMPTS) {
    // Apply strict 15-minute block
    await cache.set(blockKey, "LOCKED", BLOCK_DURATION_SEC);
    
    // Dispatch security event for SOC monitoring
    await eventDispatcher.publish("MFA_BRUTE_FORCE_BLOCKED", {
      userId,
      durationSec: BLOCK_DURATION_SEC
    });
    
    throw new RateLimitExceededError("Account temporarily locked due to too many failed MFA attempts. Please try again in 15 minutes.");
  }
}

/**
 * Clears the MFA tracking counters upon successful verification.
 */
export async function clearMfaAttempts(userId: string): Promise<void> {
  const cache = new RedisCacheStore();
  await cache.delete(`mfa:attempts:${userId}`);
  await cache.delete(`mfa:block:${userId}`);
}
