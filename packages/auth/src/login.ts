import { db, users, userPasswordHashes } from "@freelanceos/db";
import { eq } from "drizzle-orm";
import { runtimeConfig } from "@freelanceos/config";
import { normalizeEmailAddress } from "@freelanceos/core";
import { verifyPassword } from "./hash.js";
import { SessionMetadata } from "./session.js";
import { eventDispatcher } from "./dispatcher.js";
import { deviceRecognitionService } from "./device-recognition-service.js";
import { sessionService } from "./session-service.js";

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
  tokens: {
    signedAccessToken: string;
    refreshToken: string;
  };
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
  lockedUntil?: Date;
}

const failedAttemptsMap = new Map<string, FailedAttemptTracker>();

export function getFailedAttemptsMapForTesting(): Map<string, FailedAttemptTracker> {
  return failedAttemptsMap;
}

async function runEquivalentComputationalWork(password: string): Promise<void> {
  const dummyHash = "3230303030303030303030303030303030303030303030303030303030303030";
  const dummySalt = "salt123456789012";
  const dummyVersion = JSON.stringify({ N: 16384, r: 8, p: 1 });
  await verifyPassword(password, `${dummySalt}:${dummyHash}`, "scrypt", dummyVersion);
}

/**
 * Orchestrates user authentication according to the frozen Login blueprint.
 */
export async function loginUser(input: LoginInput): Promise<LoginResult> {
  const { email, password, sessionMetadata } = input;
  const ipAddress = sessionMetadata.ipAddress || "unknown";

  // 1. Normalize email address
  const normalized = normalizeEmailAddress(email, {
    stripSubaddress: runtimeConfig.CONFIG_EMAIL_STRIP_SUBADDRESS,
    stripDots: runtimeConfig.CONFIG_EMAIL_STRIP_DOTS,
  });

  // 2. Check transient account lockout state
  const tracker = failedAttemptsMap.get(normalized);
  if (tracker && tracker.lockedUntil && tracker.lockedUntil > new Date()) {
    await runEquivalentComputationalWork(password);
    throw new AccountLockedError();
  }

  // 3. User Identity Lookup
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

  // 4. Account Status Policy evaluation
  if (user.status === "suspended") {
    await runEquivalentComputationalWork(password);
    await eventDispatcher.publish("LOGIN_FAILED", {
      email: normalized,
      reason: "ACCOUNT_SUSPENDED",
      ipAddress,
    });
    throw new AccountSuspendedError();
  }

  if (user.status === "disabled") {
    await runEquivalentComputationalWork(password);
    await eventDispatcher.publish("LOGIN_FAILED", {
      email: normalized,
      reason: "ACCOUNT_DISABLED",
      ipAddress,
    });
    throw new AccountDisabledError();
  }

  if (user.status === "locked") {
    await runEquivalentComputationalWork(password);
    await eventDispatcher.publish("LOGIN_FAILED", {
      email: normalized,
      reason: "ACCOUNT_LOCKED",
      ipAddress,
    });
    throw new AccountLockedError();
  }

  if (user.status === "pending" && runtimeConfig.CONFIG_REQUIRE_VERIFICATION_FOR_SESSION) {
    await runEquivalentComputationalWork(password);
    await eventDispatcher.publish("LOGIN_FAILED", {
      email: normalized,
      reason: "PENDING_VERIFICATION",
      ipAddress,
    });
    throw new PendingVerificationError();
  }

  // 5. Query credential hashes
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

  // 6. Verify credentials hash match in timing-safe way
  const passwordMatch = await verifyPassword(
    password,
    credentials.passwordHash,
    credentials.algorithm,
    credentials.hashVersion,
  );

  if (!passwordMatch) {
    const currentTracker = failedAttemptsMap.get(normalized) || { count: 0 };
    currentTracker.count += 1;

    const maxAttempts = runtimeConfig.CONFIG_MAX_LOGIN_ATTEMPTS;
    if (currentTracker.count >= maxAttempts) {
      const lockoutDurationMs = runtimeConfig.CONFIG_LOCKOUT_DURATION_SEC * 1000;
      currentTracker.lockedUntil = new Date(Date.now() + lockoutDurationMs);

      // Mutate user state in DB to locked
      await db.update(users).set({ status: "locked" }).where(eq(users.id, user.id));

      await eventDispatcher.publish("ACCOUNT_LOCKED", {
        userId: user.id,
        email: user.email,
      });
    }

    failedAttemptsMap.set(normalized, currentTracker);

    await eventDispatcher.publish("LOGIN_FAILED", {
      email: normalized,
      reason: "INVALID_CREDENTIALS",
      ipAddress,
    });

    throw new AuthenticationFailureError();
  }

  // 7. Clear failed trackers upon successful login
  failedAttemptsMap.delete(normalized);

  // 8. Invoke Device Recognition Service to evaluate telemetry
  const deviceMetadata = await deviceRecognitionService.evaluateDevice(user.id, {
    userAgent: sessionMetadata.userAgent,
    ipAddress,
  });

  // 9. Invoke Session Service to manage concurrency limits and save active session
  const sessionResult = await sessionService.establishSession(user.id, deviceMetadata);

  // 10. Audit successful login
  await eventDispatcher.publish("LOGIN_SUCCEEDED", {
    userId: user.id,
    ipAddress,
    deviceName: deviceMetadata.deviceName || "unknown",
  });

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
}
