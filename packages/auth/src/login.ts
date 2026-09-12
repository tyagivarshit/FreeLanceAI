import { db, users, userPasswordHashes, userMfaSettings } from "@freelanceos/db";
import { eq } from "drizzle-orm";
import crypto from "crypto";
import { runtimeConfig } from "@freelanceos/config";
import { normalizeEmailAddress } from "@freelanceos/core";
import { verifyPassword, runEquivalentComputationalWork } from "./hash.js";
import { SessionMetadata } from "./session.js";
import { eventDispatcher } from "./dispatcher.js";
import { deviceRecognitionService } from "./device-recognition-service.js";
import { sessionService } from "./session-service.js";
import { RedisCacheStore } from "@freelanceos/redis";

export interface LoginInput {
  email: string;
  password: string;
  sessionMetadata: SessionMetadata;
}

export interface LoginResult {
  user: {
    id: string;
    email: string;
    status: string;
    createdAt: Date;
  };
  tokens?: {
    signedAccessToken: string;
    refreshToken: string;
  };
  mfaToken?: string;
  requiresMfa?: boolean;
  verificationTriggered: boolean;
}

export class LoginError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = "LoginError";
  }
}

export class AccountLockedError extends LoginError {
  constructor(
    message = "Your account is temporarily locked due to multiple failed login attempts.",
  ) {
    super(message, "ACCOUNT_LOCKED");
    this.name = "AccountLockedError";
  }
}

export class AccountSuspendedError extends LoginError {
  constructor(message = "Your account has been suspended.") {
    super(message, "ACCOUNT_SUSPENDED");
    this.name = "AccountSuspendedError";
  }
}

export class AccountDisabledError extends LoginError {
  constructor(message = "Your account is disabled.") {
    super(message, "ACCOUNT_DISABLED");
    this.name = "AccountDisabledError";
  }
}

export class PendingVerificationError extends LoginError {
  constructor(message = "Please verify your email address to log in.") {
    super(message, "PENDING_VERIFICATION");
    this.name = "PendingVerificationError";
  }
}

export class AuthenticationFailureError extends LoginError {
  constructor(message = "Invalid email or password.") {
    super(message, "INVALID_CREDENTIALS");
    this.name = "AuthenticationFailureError";
  }
}

export class MaxSessionsExceededError extends LoginError {
  constructor(message = "Maximum concurrent session limit reached.") {
    super(message, "MAX_SESSIONS_EXCEEDED");
    this.name = "MaxSessionsExceededError";
  }
}

interface FailedAttemptTracker {
  count: number;
}

const failedAttemptsMap = new Map<string, FailedAttemptTracker>();

export function getFailedAttemptsMapForTesting(): Map<string, FailedAttemptTracker> {
  return failedAttemptsMap;
}

export async function loginUser(input: LoginInput): Promise<LoginResult> {
  const { email, password, sessionMetadata } = input;
  const ipAddress = sessionMetadata.ipAddress || "unknown";

  // 1. Normalize email address
  const normalized = normalizeEmailAddress(email, {
    stripSubaddress: runtimeConfig.CONFIG_EMAIL_STRIP_SUBADDRESS,
    stripDots: runtimeConfig.CONFIG_EMAIL_STRIP_DOTS,
  });

  const startTime = performance.now();
  const MIN_LOGIN_TIME_MS = 100;
  
  const enforceTiming = async () => {
    const elapsed = performance.now() - startTime;
    if (elapsed < MIN_LOGIN_TIME_MS) {
      await new Promise(r => setTimeout(r, MIN_LOGIN_TIME_MS - elapsed));
    }
  };

  try {
    // 2. User Identity Lookup
    const foundUsers = await db
      .select()
      .from(users)
      .where(eq(users.normalizedEmail, normalized))
      .limit(1);

    const user = foundUsers[0];

    if (!user) {
      await runEquivalentComputationalWork(password);
      await eventDispatcher.publish("LOGIN_FAILED", {
        email: normalized,
        reason: "USER_NOT_FOUND",
        ipAddress,
      });
      throw new AuthenticationFailureError();
    }

    // 3. Check Account Lockout State
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new AccountLockedError();
    }
    
    if (user.lockedUntil && user.lockedUntil <= new Date()) {
      await db.update(users).set({ lockedUntil: null }).where(eq(users.id, user.id));
      user.lockedUntil = null;
    }

    // 4. Query credential hashes
    const credentialRecords = await db
      .select()
      .from(userPasswordHashes)
      .where(eq(userPasswordHashes.userId, user.id))
      .limit(1);

    const credentials = credentialRecords[0];

    if (!credentials) {
      await runEquivalentComputationalWork(password);
      await eventDispatcher.publish("LOGIN_FAILED", {
        email: normalized,
        reason: "CREDENTIALS_NOT_FOUND",
        ipAddress,
      });
      throw new AuthenticationFailureError();
    }

    // 5. Verify credentials hash match in timing-safe way
    const passwordMatch = await verifyPassword(
      password,
      credentials.passwordHash,
      credentials.algorithm,
      credentials.hashVersion,
    );

    const cache = new RedisCacheStore();
    const attemptKey = `login:attempts:${normalized}`;

    if (!passwordMatch) {
      const count = await cache.increment(attemptKey, runtimeConfig.CONFIG_LOCKOUT_DURATION_SEC);

      const maxAttempts = runtimeConfig.CONFIG_MAX_LOGIN_ATTEMPTS;
      if (count >= maxAttempts) {
        const lockoutDurationMs = runtimeConfig.CONFIG_LOCKOUT_DURATION_SEC * 1000;
        const lockedUntil = new Date(Date.now() + lockoutDurationMs);

        // Mutate user state in DB to temporarily locked
        await db.update(users).set({ lockedUntil }).where(eq(users.id, user.id));
        await cache.delete(attemptKey);

        await eventDispatcher.publish("ACCOUNT_LOCKED", {
          userId: user.id,
          email: user.email,
        });
      }

      await eventDispatcher.publish("LOGIN_FAILED", {
        email: normalized,
        reason: "INVALID_CREDENTIALS",
        ipAddress,
      });

      throw new AuthenticationFailureError();
    }

    // 6. Clear failed trackers upon successful login
    await cache.delete(attemptKey);

    // 7. Account Status Policy evaluation
    if (user.status === "suspended") {
      await eventDispatcher.publish("LOGIN_FAILED", {
        email: normalized,
        reason: "ACCOUNT_SUSPENDED",
        ipAddress,
      });
      throw new AccountSuspendedError();
    }

    if (user.status === "disabled") {
      await eventDispatcher.publish("LOGIN_FAILED", {
        email: normalized,
        reason: "ACCOUNT_DISABLED",
        ipAddress,
      });
      throw new AccountDisabledError();
    }

    if (user.status === "locked") {
      await eventDispatcher.publish("LOGIN_FAILED", {
        email: normalized,
        reason: "ACCOUNT_LOCKED",
        ipAddress,
      });
      throw new AccountLockedError();
    }

    if (user.status === "pending" && runtimeConfig.CONFIG_REQUIRE_VERIFICATION_FOR_SESSION) {
      await eventDispatcher.publish("LOGIN_FAILED", {
        email: normalized,
        reason: "PENDING_VERIFICATION",
        ipAddress,
      });
      throw new PendingVerificationError();
    }

    // 8. Invoke Device Recognition Service to evaluate telemetry
    const deviceMetadata = await deviceRecognitionService.evaluateDevice(user.id, {
      userAgent: sessionMetadata.userAgent,
      ipAddress,
    });

    // 9. Check MFA settings
    const mfaSettings = await db
      .select({ enabled: userMfaSettings.enabled })
      .from(userMfaSettings)
      .where(eq(userMfaSettings.userId, user.id))
      .limit(1);

    const isMfaEnabled = mfaSettings[0]?.enabled ?? false;

    if (isMfaEnabled) {
      // Generate a short-lived MFA challenge token in Redis
      const mfaToken = crypto.randomUUID();
      const mfaKey = `mfa:pending:${mfaToken}`;
      await cache.set(mfaKey, user.id, 300); // 5 minutes to complete MFA

      await enforceTiming();
      return {
        user: {
          id: user.id,
          email: user.email,
          status: user.status,
          createdAt: user.createdAt,
        },
        mfaToken,
        requiresMfa: true,
        verificationTriggered: false,
      };
    }

    // 10. Invoke Session Service to manage concurrency limits and save active session
    const sessionResult = await sessionService.establishSession(user.id, deviceMetadata);

    // 11. Audit successful login
    await eventDispatcher.publish("LOGIN_SUCCEEDED", {
      userId: user.id,
      ipAddress,
      deviceName: deviceMetadata.deviceName || "unknown",
    });

    await enforceTiming();
    return {
      user: {
        id: user.id,
        email: user.email,
        status: user.status,
        createdAt: user.createdAt,
      },
      tokens: {
        signedAccessToken: sessionResult.signedAccessToken,
        refreshToken: sessionResult.rawRefreshToken,
      },
      verificationTriggered: false,
    };
  } catch (err) {
    await enforceTiming();
    throw err;
  }
}
