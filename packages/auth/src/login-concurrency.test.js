import { test, describe } from "node:test";
import assert from "node:assert";
import { db, users, userPasswordHashes } from "@freelanceos/db";
import { runtimeConfig } from "@freelanceos/config";
import { loginUser, AccountLockedError } from "./index.js";
import { getFailedAttemptsMapForTesting } from "./login.js";
describe("Login Use Case Integration & Race Condition Tests", () => {
    test("should enforce lockout threshold strictly even under concurrent brute-force (Bug 1D)", async () => {
        const { eq } = await import("drizzle-orm");
        const { hashPassword } = await import("./hash.js");
        const { normalizeEmailAddress } = await import("@freelanceos/core");
        const email = "lockout_test_" + Date.now() + "@freelanceos.dev";
        const pass = "CorrectHorseBatteryStaple123!";
        const wrongPass = "WrongPassword!";
        const norm = normalizeEmailAddress(email, { stripSubaddress: true, stripDots: true });
        try {
            // 1. Create real test user
            const { passwordHash, algorithm, hashVersion } = await hashPassword(pass);
            let user = (await db.insert(users).values({
                email,
                normalizedEmail: norm,
                status: "active",
                lockedUntil: null
            }).returning())[0];
            await db.insert(userPasswordHashes).values({
                userId: user.id,
                passwordHash,
                algorithm,
                hashVersion,
                passwordChangedAt: new Date(),
                credentialVersion: 1
            });
            // Clear the map just in case
            getFailedAttemptsMapForTesting().delete(norm);
            // Force runtime config just in case it's overridden
            // @ts-expect-error read-only
            runtimeConfig.CONFIG_MAX_LOGIN_ATTEMPTS = 5;
            const maxAttempts = runtimeConfig.CONFIG_MAX_LOGIN_ATTEMPTS;
            // 2. Fire maxAttempts + 5 concurrent login attempts with WRONG password
            const attempts = [];
            for (let i = 0; i < maxAttempts + 5; i++) {
                attempts.push(loginUser({
                    email,
                    password: wrongPass,
                    sessionMetadata: { ipAddress: "127.0.0.1", userAgent: "test" }
                }).catch(err => err));
            }
            await Promise.all(attempts);
            // 3. Assert user is locked
            const userAfter = (await db.select().from(users).where(eq(users.id, user.id)))[0];
            const isLocked = !!(userAfter.lockedUntil && userAfter.lockedUntil > new Date());
            assert.strictEqual(isLocked, true, "User should be locked, but isn't. Lockout was bypassed by concurrency!");
            // 4. Assert subsequent correct login is rejected as locked
            await assert.rejects(loginUser({
                email,
                password: pass,
                sessionMetadata: { ipAddress: "127.0.0.1", userAgent: "test" }
            }), (err) => {
                assert.ok(err instanceof AccountLockedError, `Expected AccountLockedError, got: ${err instanceof Error ? err.name : String(err)}`);
                return true;
            }, "Correct login succeeded, but user should be locked!");
        }
        finally {
            // 7. Clean up
            const userRec = (await db.select().from(users).where(eq(users.normalizedEmail, norm)))[0];
            if (userRec) {
                await db.delete(userPasswordHashes).where(eq(userPasswordHashes.userId, userRec.id));
                await db.delete(users).where(eq(users.id, userRec.id));
            }
        }
    });
});
