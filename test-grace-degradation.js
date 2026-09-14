import { db } from "./packages/db/src/client.js";
import { createSession, rotateSession } from "./packages/auth/src/session.js";
import { users, userPasswordHashes } from "./packages/db/src/index.js";
import crypto from "crypto";
import { RedisCacheStore } from "./packages/redis/src/index.js";
async function testGracefulDegradation() {
    const userId = crypto.randomUUID();
    const email = `grace-${Date.now()}@example.com`;
    try {
        await db.insert(users).values({
            id: userId,
            email: email,
            normalizedEmail: email.toUpperCase(),
            status: "active"
        });
        await db.insert(userPasswordHashes).values({
            userId,
            passwordHash: "dummy",
            algorithm: "dummy",
            hashVersion: "dummy",
            passwordChangedAt: new Date(),
            credentialVersion: 1
        });
        const session = await createSession(userId, { userAgent: "Test", ipAddress: "127.0.0.1" });
        const oldToken = session.rawRefreshToken;
        // Simulate Redis being down by overwriting the prototype
        const origGet = RedisCacheStore.prototype.get;
        const origSet = RedisCacheStore.prototype.set;
        RedisCacheStore.prototype.get = async function () {
            // Simulate a hung connection that never resolves
            return new Promise(() => { });
        };
        RedisCacheStore.prototype.set = async function () {
            // Simulate a hung connection that never resolves
            return new Promise(() => { });
        };
        console.log("Simulating Redis hang (promises never resolve)... Attempting normal token rotation...");
        const startTime1 = Date.now();
        const res1 = await rotateSession(oldToken, { userAgent: "Req 1", ipAddress: "127.0.0.1" });
        console.log(`First rotation (SET) finished in ${Date.now() - startTime1}ms. Tokens returned: ${!!res1.newRawRefreshToken}`);
        const startTime2 = Date.now();
        // Use the old token again to trigger the concurrency grace window (GET)
        const res2 = await rotateSession(oldToken, { userAgent: "Req 2", ipAddress: "127.0.0.1" });
        console.log(`Second concurrent rotation (GET) finished in ${Date.now() - startTime2}ms. Tokens returned: ${!!res2.newRawRefreshToken}`);
        console.log("SUCCESS: Rotated token gracefully despite Redis hang.");
    }
    catch (e) {
        console.error("FAIL: Exception thrown during rotation:", e);
    }
    finally {
        process.exit(0);
    }
}
testGracefulDegradation();
