import { test, describe } from "node:test";
import assert from "node:assert";
import crypto from "crypto";
import { db, users, userPasswordHashes, sessions } from "@freelanceos/db";
import { runtimeConfig } from "@freelanceos/config";
import { createSession, rotateSession } from "./session.js";
import { ReplayAttackDetectedError } from "./token.js";

describe("Session Use Case Integration Tests", () => {
  test("should handle refresh token rotation race condition idempotently", async () => {
    const origGrace = runtimeConfig.ROTATION_GRACE_PERIOD_SEC;
    // @ts-expect-error
    runtimeConfig.ROTATION_GRACE_PERIOD_SEC = 1;

    const userId = crypto.randomUUID();
    const email = `race-${Date.now()}@example.com`;

    try {
      await db.insert(users).values({
        id: userId,
        email: email,
        normalizedEmail: email.toUpperCase(),
        status: "active",
      });

      await db.insert(userPasswordHashes).values({
        userId,
        passwordHash: "dummy",
        algorithm: "dummy",
        hashVersion: "dummy",
        passwordChangedAt: new Date(),
        credentialVersion: 1,
      });

      const session = await createSession(userId, {
        userAgent: "Test Setup",
        ipAddress: "127.0.0.1",
      });
      const oldToken = session.rawRefreshToken;

      const p1 = rotateSession(oldToken, { userAgent: "Req A", ipAddress: "127.0.0.1" });
      const p2 = rotateSession(oldToken, { userAgent: "Req B", ipAddress: "127.0.0.1" });
      const [resA, resB] = await Promise.all([p1, p2]);

      assert.strictEqual(
        resA.newRawRefreshToken,
        resB.newRawRefreshToken,
        "Idempotency failed: Concurrent requests received different refresh tokens!"
      );

      await new Promise(r => setTimeout(r, 1200));

      await assert.rejects(
        rotateSession(oldToken, { userAgent: "Req C", ipAddress: "127.0.0.1" }),
        (err) => {
          assert.ok(err instanceof ReplayAttackDetectedError, "Expected ReplayAttackDetectedError");
          return true;
        }
      );

    } finally {
      // @ts-expect-error
      runtimeConfig.ROTATION_GRACE_PERIOD_SEC = origGrace;
      
      const { eq } = await import("drizzle-orm");
      await db.delete(sessions).where(eq(sessions.userId, userId));
      await db.delete(userPasswordHashes).where(eq(userPasswordHashes.userId, userId));
      await db.delete(users).where(eq(users.id, userId));
    }
  });
});
