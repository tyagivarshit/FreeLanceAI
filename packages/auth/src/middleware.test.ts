import { test, describe, beforeEach } from "node:test";
import assert from "node:assert";
import crypto from "crypto";
import { db, sessions, userPasswordHashes } from "@freelanceos/db";
import { authenticateRequest } from "./middleware.js";
import { signAccessToken } from "./token.js";
import { eventDispatcher } from "./dispatcher.js";

describe("Authentication Middleware Logic Validation Tests", () => {
  let selectResultMap: Map<unknown, Record<string, unknown>[]>;
  let eventLog: { name: string; payload: unknown }[] = [];
  let mockUserResult: { id: string; email: string } | null = null;

  beforeEach(() => {
    selectResultMap = new Map();
    eventLog = [];
    mockUserResult = null;

    // Mock Event Dispatcher publish method
    eventDispatcher.publish = function (name: string, payload: unknown): Promise<void> {
      eventLog.push({ name, payload });
      return Promise.resolve();
    } as unknown as typeof eventDispatcher.publish;



    // Mock db.select
    // @ts-expect-error db.select is read-only
    db.select = function () {
      return {
        from: function (_table: unknown) {
          const builder = {
            innerJoin: function () { return builder; },
            where: function () { return builder; },
            limit: function () { return builder; },
            execute: function () {
              return new Promise((resolve) => builder.then(resolve));
            },
            then: function (resolve: (val: unknown) => void) {
              const sessionsData = selectResultMap.get(sessions) || [];
              const session = sessionsData[0];
              
              if (!session) {
                resolve([]);
                return;
              }

              const pwdData = selectResultMap.get(userPasswordHashes) || [];
              const pwd = pwdData[0] as { credentialVersion?: number } | undefined;
              const cv = pwd?.credentialVersion ?? 1;

              resolve([{
                credentialVersion: cv,
                session: session,
                userEmail: mockUserResult ? mockUserResult.email : "test@freelanceos.com"
              }]);
            },
          };
          return builder;
        },
      };
    };

    // Mock db.update
    // @ts-expect-error db.update is read-only
    db.update = function () {
      return {
        set: function () {
          return {
            where: function () {
              return Promise.resolve({ rowCount: 1 });
            },
          };
        },
      };
    };
  });

  test("should authenticate valid request with active session, return opaque sessionRef, and publish success event", async () => {
    // 1. Arrange: Setup token and DB query mocks
    const validToken = signAccessToken({
      sessionId: "mock-session-uuid",
      userId: "mock-user-uuid",
      credentialVersion: 1,
    });

    selectResultMap.set(userPasswordHashes, [{ id: "pwd-hash-uuid", credentialVersion: 1 }]);

    selectResultMap.set(sessions, [
      {
        id: "mock-session-uuid",
        userId: "mock-user-uuid",
        revokedAt: null,
        expiresAt: new Date(Date.now() + 60000),
      },
    ]);

    mockUserResult = { id: "mock-user-uuid", email: "authuser@freelanceos.com" };

    const expectedSessionRef = crypto
      .createHash("sha256")
      .update("mock-session-uuid")
      .digest("hex");

    // 2. Act
    const result = await authenticateRequest({
      credentialToken: validToken,
      routePolicy: "Protected",
    });

    // 3. Assert
    assert.strictEqual(result.status, "Authenticated");
    assert.ok(result.context);
    assert.strictEqual(result.context.identity.userId, "mock-user-uuid");
    assert.strictEqual(result.context.identity.email, "authuser@freelanceos.com");
    assert.strictEqual(result.context.sessionRef, expectedSessionRef);
    assert.strictEqual((result.context as unknown as Record<string, unknown>).sessionId, undefined);

    // Success event published
    const successEvent = eventLog.find((e) => e.name === "AUTHENTICATION_SUCCEEDED");
    assert.ok(successEvent);
    assert.strictEqual((successEvent.payload as Record<string, unknown>).userId, "mock-user-uuid");
  });

  test("should return Anonymous status on anonymous routes without context", async () => {
    // 2. Act
    const result = await authenticateRequest({
      routePolicy: "Anonymous",
    });

    // 3. Assert
    assert.strictEqual(result.status, "Anonymous");
    assert.strictEqual(result.context, undefined);
    assert.strictEqual(eventLog.length, 0);
  });

  test("should allow access with Anonymous status for optional route policies when credentials are omitted", async () => {
    // 2. Act
    const result = await authenticateRequest({
      routePolicy: "Optional",
    });

    // 3. Assert
    assert.strictEqual(result.status, "Anonymous");
    assert.strictEqual(result.context, undefined);
    assert.strictEqual(eventLog.length, 0);
  });

  test("should block optional routes and return unauthenticated state when malformed credentials are provided", async () => {
    // 2. Act
    const result = await authenticateRequest({
      credentialToken: "malformed.token.value",
      routePolicy: "Optional",
    });

    // 3. Assert
    assert.strictEqual(result.status, "Unauthenticated");
    assert.strictEqual(result.context, undefined);

    const failEvent = eventLog.find((e) => e.name === "AUTHENTICATION_FAILED");
    assert.ok(failEvent);
  });

  test("should block requests and return expired state when credentials have expired", async () => {
    // 1. Arrange: Create token with negative expiry
    const expiredToken = signAccessToken({
      sessionId: "mock-session-uuid",
      userId: "mock-user-uuid",
      credentialVersion: 1,
    });

    const jwt = await import("jsonwebtoken");
    const originalVerify = jwt.default.verify;
    jwt.default.verify = function () {
      throw new jwt.default.TokenExpiredError("jwt expired", new Date());
    } as unknown as typeof jwt.default.verify;

    try {
      // 2. Act
      const result = await authenticateRequest({
        credentialToken: expiredToken,
        routePolicy: "Protected",
      });

      // 3. Assert
      assert.strictEqual(result.status, "Expired Credentials");
      const failEvent = eventLog.find((e) => e.name === "AUTHENTICATION_FAILED");
      assert.ok(failEvent);
    } finally {
      jwt.default.verify = originalVerify;
    }
  });

  test("should reject request and return invalid session state when session has been revoked in database", async () => {
    // 1. Arrange: Token is valid but DB session has revokedAt set
    const validToken = signAccessToken({
      sessionId: "mock-session-uuid",
      userId: "mock-user-uuid",
      credentialVersion: 1,
    });

    selectResultMap.set(userPasswordHashes, [{ id: "pwd-hash-uuid", credentialVersion: 1 }]);

    selectResultMap.set(sessions, [
      {
        id: "mock-session-uuid",
        userId: "mock-user-uuid",
        revokedAt: new Date(),
        expiresAt: new Date(Date.now() + 60000),
      },
    ]);

    // 2. Act
    const result = await authenticateRequest({
      credentialToken: validToken,
    });

    // 3. Assert
    assert.strictEqual(result.status, "Invalid Session");
    const sessionInvalidEvent = eventLog.find((e) => e.name === "SESSION_INVALID");
    assert.ok(sessionInvalidEvent);
    assert.strictEqual((sessionInvalidEvent.payload as Record<string, unknown>).reason, "revoked");
  });

  test("should reject request and return identity invalidated when user credential version changes", async () => {
    // 1. Arrange: Token has version 1, user active version is 2
    const validToken = signAccessToken({
      sessionId: "mock-session-uuid",
      userId: "mock-user-uuid",
      credentialVersion: 1,
    });

    selectResultMap.set(userPasswordHashes, [
      { id: "pwd-hash-uuid", credentialVersion: 2 }, // Credential version mismatch
    ]);

    // 2. Act
    const result = await authenticateRequest({
      credentialToken: validToken,
    });

    // 3. Assert
    assert.strictEqual(result.status, "Identity Invalidated");
    const identityInvalidEvent = eventLog.find((e) => e.name === "IDENTITY_INVALIDATED");
    assert.ok(identityInvalidEvent);
    assert.strictEqual(
      (identityInvalidEvent.payload as Record<string, unknown>).userId,
      "mock-user-uuid",
    );
  });

  test("should handle database pipeline failures safely and return infrastructure failure status", async () => {
    // 1. Arrange: Valid token format, but DB query throws error
    const validToken = signAccessToken({
      sessionId: "mock-session-uuid",
      userId: "mock-user-uuid",
      credentialVersion: 1,
    });

    // Make select throw
    db.select = function () {
      throw new Error("Database network failure");
    };

    // 2. Act
    const result = await authenticateRequest({
      credentialToken: validToken,
    });

    // 3. Assert
    assert.strictEqual(result.status, "Infrastructure Failure");
  });
});
