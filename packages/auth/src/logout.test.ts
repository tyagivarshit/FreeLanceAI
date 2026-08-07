import { test, describe, beforeEach } from "node:test";
import assert from "node:assert";
import { db, sessions, userPasswordHashes } from "@freelanceos/db";
import { logoutUser } from "./logout.js";

describe("Logout Use Case Verification Tests", () => {
  let selectResult: Record<string, unknown>[] = [];
  let updateCalled = false;
  let updateParams: { table: unknown; params: Record<string, unknown> }[] = [];

  beforeEach(() => {
    selectResult = [];
    updateCalled = false;
    updateParams = [];

    // Mock db.select
    // @ts-expect-error db.select is read-only
    db.select = function () {
      return {
        from: function () {
          return {
            where: function () {
              return {
                limit: function () {
                  return Promise.resolve(selectResult);
                },
                then: function (resolve: (val: unknown) => void) {
                  resolve(selectResult);
                },
              };
            },
            then: function (resolve: (val: unknown) => void) {
              resolve(selectResult);
            },
          };
        },
      };
    };

    // Mock db.update
    // @ts-expect-error db.update is read-only
    db.update = function (table: unknown) {
      return {
        set: function (params: Record<string, unknown>) {
          updateCalled = true;
          updateParams.push({ table, params });
          return {
            where: function () {
              return Promise.resolve({ rowCount: 1 });
            },
          };
        },
      };
    };
  });

  test("should complete single logout successfully when session is active", async () => {
    // 1. Arrange: Session exists and is active (not revoked, not expired)
    selectResult = [
      {
        id: "active-session-uuid",
        userId: "user-uuid",
        revokedAt: null,
        expiresAt: new Date(Date.now() + 60000), // Active in the future
      },
    ];

    // 2. Act
    const result = await logoutUser({
      sessionId: "active-session-uuid",
      ipAddress: "192.168.1.100",
    });

    // 3. Assert
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.clearCredentialDirective, true);
    assert.strictEqual(updateCalled, true);

    // Verify session store update
    const sessionUpdate = updateParams.find((u) => u.table === sessions);
    assert.ok(sessionUpdate);
    assert.ok(sessionUpdate.params.revokedAt instanceof Date);
    assert.ok(sessionUpdate.params.lastActivityAt instanceof Date);
  });

  test("should handle already revoked sessions idempotently without store modifications", async () => {
    // 1. Arrange: Session exists but is already revoked
    selectResult = [
      {
        id: "revoked-session-uuid",
        userId: "user-uuid",
        revokedAt: new Date(),
        expiresAt: new Date(Date.now() + 60000),
      },
    ];

    // 2. Act
    const result = await logoutUser({
      sessionId: "revoked-session-uuid",
    });

    // 3. Assert
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.clearCredentialDirective, true);
    // Should not write to store since it is already revoked
    assert.strictEqual(updateCalled, false);
  });

  test("should handle expired sessions idempotently without store modifications", async () => {
    // 1. Arrange: Session exists but is expired
    selectResult = [
      {
        id: "expired-session-uuid",
        userId: "user-uuid",
        revokedAt: null,
        expiresAt: new Date(Date.now() - 10000), // Expired in the past
      },
    ];

    // 2. Act
    const result = await logoutUser({
      sessionId: "expired-session-uuid",
    });

    // 3. Assert
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.clearCredentialDirective, true);
    assert.strictEqual(updateCalled, false);
  });

  test("should execute global logout by invalidating all active sessions and incrementing credentials version", async () => {
    // 1. Arrange: Identity exists (mock userPasswordHashes lookup)
    selectResult = [
      {
        id: "password-hash-uuid",
        credentialVersion: 5,
      },
    ];

    // 2. Act
    const result = await logoutUser({
      userId: "user-uuid",
      global: true,
    });

    // 3. Assert
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.clearCredentialDirective, true);
    assert.strictEqual(updateCalled, true);

    // Verify Identity Versioning Strategy update (credentialVersion increment)
    const identityUpdate = updateParams.find((u) => u.table === userPasswordHashes);
    assert.ok(identityUpdate);
    assert.strictEqual(identityUpdate.params.credentialVersion, 6);
  });
});
