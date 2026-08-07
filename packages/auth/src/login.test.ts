import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import { db, users, userPasswordHashes, sessions } from "@freelanceos/db";
import { runtimeConfig } from "@freelanceos/config";
import {
  loginUser,
  AccountLockedError,
  AccountSuspendedError,
  AccountDisabledError,
  PendingVerificationError,
  AuthenticationFailureError,
} from "./index.js";
import { getFailedAttemptsMapForTesting } from "./login.js";

const originalSelect = db.select;
const originalInsert = db.insert;
const originalUpdate = db.update;

describe("Login Use Case & Flow Security Tests", () => {
  let selectMockResult: Record<string, unknown>[] = [];
  let sessionsMockResult: Record<string, unknown>[] = [];
  let updateCalled = false;
  let updateParams: { table: unknown; params: Record<string, unknown> } | null = null;
  let insertCalled = false;
  let insertedSessionParams: Record<string, unknown> | null = null;

  let realPasswordHash = "";
  let realAlgorithm = "";
  let realHashVersion = "";

  beforeEach(async () => {
    selectMockResult = [];
    sessionsMockResult = [];
    updateCalled = false;
    updateParams = null;
    insertCalled = false;
    insertedSessionParams = null;

    getFailedAttemptsMapForTesting().clear();

    const { hashPassword } = await import("./hash.js");
    const pwdResult = await hashPassword("ComplexPass123!");
    realPasswordHash = pwdResult.passwordHash;
    realAlgorithm = pwdResult.algorithm;
    realHashVersion = pwdResult.hashVersion;

    // Mock select globally to isolate logins
    // @ts-expect-error db.select is read-only
    db.select = function () {
      return {
        from: (table: unknown) => ({
          where: () => {
            const queryPromise = Promise.resolve(
              table === users
                ? selectMockResult
                : table === userPasswordHashes
                  ? [
                      {
                        userId: "mock-user-uuid",
                        passwordHash: realPasswordHash,
                        algorithm: realAlgorithm,
                        hashVersion: realHashVersion,
                        credentialVersion: 1,
                      },
                    ]
                  : table === sessions
                    ? sessionsMockResult
                    : [],
            );
            // @ts-expect-error chaining helper
            queryPromise.limit = () => queryPromise;
            return queryPromise;
          },
        }),
      };
    };

    // Mock insert globally
    // @ts-expect-error db.insert is read-only
    db.insert = function (table: unknown) {
      return {
        values: (values: Record<string, unknown>) => {
          insertCalled = true;
          if (table === sessions) {
            insertedSessionParams = values;
          }
          return {
            returning: () => Promise.resolve([{ id: "mock-session-uuid" }]),
          };
        },
      };
    };

    // Mock update globally
    // @ts-expect-error db.update is read-only
    db.update = function (table: unknown) {
      return {
        set: (params: Record<string, unknown>) => {
          updateCalled = true;
          updateParams = { table, params };
          return {
            where: () => Promise.resolve(),
          };
        },
      };
    };

    // Force default configuration values
    // @ts-expect-error runtimeConfig properties are read-only
    runtimeConfig.CONFIG_MAX_LOGIN_ATTEMPTS = 3;
    // @ts-expect-error runtimeConfig properties are read-only
    runtimeConfig.CONFIG_LOCKOUT_DURATION_SEC = 900;
    // @ts-expect-error runtimeConfig properties are read-only
    runtimeConfig.CONFIG_REQUIRE_VERIFICATION_FOR_SESSION = false;
    // @ts-expect-error runtimeConfig properties are read-only
    runtimeConfig.CONFIG_MAX_CONCURRENT_SESSIONS = 2;
    // @ts-expect-error runtimeConfig properties are read-only
    runtimeConfig.CONFIG_CONCURRENT_SESSION_STRATEGY = "revoke_oldest";
  });

  afterEach(() => {
    db.select = originalSelect;
    db.insert = originalInsert;
    db.update = originalUpdate;
  });

  test("should authenticate successfully with correct credentials and active status", async () => {
    selectMockResult = [
      {
        id: "mock-user-uuid",
        email: "test@gmail.com",
        normalizedEmail: "test@gmail.com",
        status: "active",
        createdAt: new Date(),
      },
    ];

    const result = await loginUser({
      email: "test@gmail.com",
      password: "ComplexPass123!",
      sessionMetadata: {
        userAgent: "mocha",
        ipAddress: "127.0.0.1",
        platform: "Mac",
        browser: "Chrome",
      },
    });

    assert.strictEqual(result.user.id, "mock-user-uuid");
    assert.strictEqual(result.user.status, "active");
    assert.ok(result.tokens.signedAccessToken);
    assert.ok(result.tokens.refreshToken);
    assert.strictEqual(insertCalled, true);
    assert.strictEqual(insertedSessionParams?.userId, "mock-user-uuid");
  });

  test("should fail with AuthenticationFailureError for unregistered emails (Timing Protection Path)", async () => {
    selectMockResult = [];

    await assert.rejects(
      loginUser({
        email: "unknown@gmail.com",
        password: "WrongPassword!",
        sessionMetadata: {
          userAgent: "mocha",
          ipAddress: "127.0.0.1",
        },
      }),
      (err: unknown) => {
        assert.ok(err instanceof AuthenticationFailureError);
        return true;
      },
    );
  });

  test("should fail with AccountSuspendedError if user status is suspended", async () => {
    selectMockResult = [
      {
        id: "mock-user-uuid",
        email: "suspended@gmail.com",
        normalizedEmail: "suspended@gmail.com",
        status: "suspended",
        createdAt: new Date(),
      },
    ];

    await assert.rejects(
      loginUser({
        email: "suspended@gmail.com",
        password: "ComplexPass123!",
        sessionMetadata: {
          userAgent: "mocha",
          ipAddress: "127.0.0.1",
        },
      }),
      (err: unknown) => {
        assert.ok(err instanceof AccountSuspendedError);
        return true;
      },
    );
  });

  test("should fail with AccountDisabledError if user status is disabled", async () => {
    selectMockResult = [
      {
        id: "mock-user-uuid",
        email: "disabled@gmail.com",
        normalizedEmail: "disabled@gmail.com",
        status: "disabled",
        createdAt: new Date(),
      },
    ];

    await assert.rejects(
      loginUser({
        email: "disabled@gmail.com",
        password: "ComplexPass123!",
        sessionMetadata: {
          userAgent: "mocha",
          ipAddress: "127.0.0.1",
        },
      }),
      (err: unknown) => {
        assert.ok(err instanceof AccountDisabledError);
        return true;
      },
    );
  });

  test("should fail with PendingVerificationError if user status is pending and verification is required", async () => {
    // @ts-expect-error runtimeConfig properties are read-only
    runtimeConfig.CONFIG_REQUIRE_VERIFICATION_FOR_SESSION = true;

    selectMockResult = [
      {
        id: "mock-user-uuid",
        email: "pending@gmail.com",
        normalizedEmail: "pending@gmail.com",
        status: "pending",
        createdAt: new Date(),
      },
    ];

    await assert.rejects(
      loginUser({
        email: "pending@gmail.com",
        password: "ComplexPass123!",
        sessionMetadata: {
          userAgent: "mocha",
          ipAddress: "127.0.0.1",
        },
      }),
      (err: unknown) => {
        assert.ok(err instanceof PendingVerificationError);
        return true;
      },
    );
  });

  test("should track failed attempts and lock account upon hitting attempts threshold", async () => {
    selectMockResult = [
      {
        id: "mock-user-uuid",
        email: "bruteforce@gmail.com",
        normalizedEmail: "bruteforce@gmail.com",
        status: "active",
        createdAt: new Date(),
      },
    ];

    const email = "bruteforce@gmail.com";

    // First failure
    await assert.rejects(
      loginUser({
        email,
        password: "wrong-password-1",
        sessionMetadata: { userAgent: "mocha", ipAddress: "127.0.0.1" },
      }),
      AuthenticationFailureError,
    );
    assert.strictEqual(getFailedAttemptsMapForTesting().get(email)?.count, 1);
    assert.strictEqual(updateCalled, false);

    // Second failure
    await assert.rejects(
      loginUser({
        email,
        password: "wrong-password-2",
        sessionMetadata: { userAgent: "mocha", ipAddress: "127.0.0.1" },
      }),
      AuthenticationFailureError,
    );
    assert.strictEqual(getFailedAttemptsMapForTesting().get(email)?.count, 2);
    assert.strictEqual(updateCalled, false);

    // Third failure - locks account
    await assert.rejects(
      loginUser({
        email,
        password: "wrong-password-3",
        sessionMetadata: { userAgent: "mocha", ipAddress: "127.0.0.1" },
      }),
      AuthenticationFailureError,
    );

    const tracker = getFailedAttemptsMapForTesting().get(email);
    assert.strictEqual(tracker?.count, 3);
    assert.ok(tracker?.lockedUntil);

    // Verify DB update status set to locked
    assert.strictEqual(updateCalled, true);
    assert.strictEqual(updateParams?.table, users);
    assert.strictEqual(updateParams?.params.status, "locked");

    // Fourth attempt immediately throws AccountLockedError
    await assert.rejects(
      loginUser({
        email,
        password: "any-password",
        sessionMetadata: { userAgent: "mocha", ipAddress: "127.0.0.1" },
      }),
      AccountLockedError,
    );
  });

  test("should revoke oldest active sessions if max sessions limit is exceeded", async () => {
    selectMockResult = [
      {
        id: "mock-user-uuid",
        email: "concurrency@gmail.com",
        normalizedEmail: "concurrency@gmail.com",
        status: "active",
        createdAt: new Date(),
      },
    ];

    sessionsMockResult = [
      { id: "sess-1", lastActivityAt: new Date(Date.now() - 50000) },
      { id: "sess-2", lastActivityAt: new Date() },
    ];

    let updateCount = 0;
    const updatedSessionIds: string[] = [];

    // Mock update globally
    // @ts-expect-error db.update is read-only
    db.update = function () {
      return {
        set: () => {
          return {
            where: () => {
              updateCount++;
              updatedSessionIds.push("sess-1");
              return Promise.resolve();
            },
          };
        },
      };
    };

    await loginUser({
      email: "concurrency@gmail.com",
      password: "ComplexPass123!",
      sessionMetadata: {
        userAgent: "mocha",
        ipAddress: "127.0.0.1",
      },
    });

    assert.strictEqual(updateCount, 1);
    assert.ok(updatedSessionIds.includes("sess-1"));
  });
});
