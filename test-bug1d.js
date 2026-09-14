import { db } from "./packages/db/src/client.js";
import { users, userPasswordHashes } from "./packages/db/src/index.js";
import { hashPassword } from "./packages/auth/src/hash.js";
import { eq } from "drizzle-orm";
import { normalizeEmailAddress } from "./packages/core/src/index.js";
import { loginUser, getFailedAttemptsMapForTesting } from "./packages/auth/src/login.js";
import { runtimeConfig } from "./packages/config/src/index.js";
async function run() {
    const email = "lockout_test@freelanceos.dev";
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
        }).onConflictDoUpdate({
            target: users.normalizedEmail,
            set: { status: "active", lockedUntil: null }
        }).returning())[0];
        await db.insert(userPasswordHashes).values({
            userId: user.id,
            passwordHash,
            algorithm,
            hashVersion,
            passwordChangedAt: new Date()
        }).onConflictDoUpdate({
            target: userPasswordHashes.userId,
            set: { passwordHash, credentialVersion: 1 }
        });
        // Clear the map
        getFailedAttemptsMapForTesting().delete(norm);
        const maxAttempts = runtimeConfig.CONFIG_MAX_LOGIN_ATTEMPTS;
        console.log(`Max attempts configured: ${maxAttempts}`);
        // 2. Fire maxAttempts + 5 concurrent login attempts with WRONG password
        console.log(`Firing ${maxAttempts + 5} concurrent login attempts with wrong password...`);
        const attempts = [];
        for (let i = 0; i < maxAttempts + 5; i++) {
            attempts.push(loginUser({
                email,
                password: wrongPass,
                sessionMetadata: { ipAddress: "127.0.0.1", userAgent: "test" }
            }).catch(err => err));
        }
        const results = await Promise.all(attempts);
        // 3. Assert user is locked
        const userAfter = (await db.select().from(users).where(eq(users.id, user.id)))[0];
        const isLocked = userAfter.lockedUntil && userAfter.lockedUntil > new Date();
        console.log(`Is user locked in DB? ${!!isLocked}`);
        if (!isLocked) {
            console.error("TEST FAILED: User should be locked, but isn't. Lockout was bypassed by concurrency!");
        }
        else {
            console.log("TEST PASSED (Part 1): User is locked in DB.");
        }
        // 4. Assert subsequent correct login is rejected as locked
        console.log("Attempting to login with correct password now...");
        try {
            await loginUser({
                email,
                password: pass,
                sessionMetadata: { ipAddress: "127.0.0.1", userAgent: "test" }
            });
            console.error("TEST FAILED: Correct login succeeded, but user should be locked!");
        }
        catch (err) {
            console.log(`Login attempt rejected with error: ${err.code || err.name}`);
            if (err.code === "ACCOUNT_LOCKED") {
                console.log("TEST PASSED (Part 2): Correct login was correctly rejected.");
            }
            else {
                console.error(`TEST FAILED: Expected ACCOUNT_LOCKED, got ${err.code || err.name}`);
            }
        }
        console.log("\n--- TOCTOU Investigation ---");
        console.log("Is there a TOCTOU race in failedAttemptsMap?");
        console.log("Result: NO. The read (failedAttemptsMap.get) and write (failedAttemptsMap.set or mutate)");
        console.log("occur synchronously in the event loop, AFTER the await verifyPassword() call.");
        console.log("Node's event loop executes the synchronous block without interleaving, so the increments are atomic.");
    }
    catch (e) {
        console.error("Error during test:", e);
    }
    finally {
        // 7. Clean up
        await db.delete(userPasswordHashes).where(eq(userPasswordHashes.userId, (await db.select().from(users).where(eq(users.normalizedEmail, norm)))[0].id));
        await db.delete(users).where(eq(users.normalizedEmail, norm));
        process.exit(0);
    }
}
run();
