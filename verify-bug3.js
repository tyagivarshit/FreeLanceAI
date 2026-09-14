import { db } from "./packages/db/src/client.js";
import { users, userPasswordHashes } from "./packages/db/src/index.js";
import { hashPassword } from "./packages/auth/src/hash.js";
import { loginUser } from "./packages/auth/src/login.js";
import { normalizeEmailAddress } from "./packages/core/src/index.js";
async function measure(name, fn) {
    // warm up
    for (let i = 0; i < 3; i++) {
        try {
            await fn();
        }
        catch (e) { }
    }
    let times = [];
    for (let i = 0; i < 10; i++) {
        const start = performance.now();
        try {
            await fn();
        }
        catch (e) { }
        times.push(performance.now() - start);
    }
    const avg = times.reduce((a, b) => a + b) / times.length;
    const min = Math.min(...times);
    const max = Math.max(...times);
    console.log(`${name}:`);
    console.log(`  Avg: ${avg.toFixed(2)}ms`);
    console.log(`  Range: [${min.toFixed(2)}ms - ${max.toFixed(2)}ms]\n`);
}
async function run() {
    const emailValid = "test_timing@example.com";
    const emailInvalid = "test_invalid@example.com";
    const pass = "CorrectPassword123!";
    try {
        const norm = normalizeEmailAddress(emailValid, { stripSubaddress: true, stripDots: true });
        const { passwordHash, algorithm, hashVersion } = await hashPassword(pass);
        let user = (await db.insert(users).values({
            email: emailValid,
            normalizedEmail: norm,
            status: "active",
            lockedUntil: null,
        }).onConflictDoUpdate({
            target: users.normalizedEmail,
            set: { status: "active", lockedUntil: null }
        }).returning())[0];
        await db.insert(userPasswordHashes).values({
            userId: user.id,
            passwordHash,
            algorithm,
            hashVersion,
            passwordChangedAt: new Date(),
        }).onConflictDoUpdate({
            target: userPasswordHashes.userId,
            set: { passwordHash, algorithm, hashVersion }
        });
        const mockSession = { ipAddress: "127.0.0.1", userAgent: "test" };
        console.log("--- Running Bug #3 Timing Proof (10 iterations each) ---\n");
        await measure("1. Existing Valid Email + Wrong Password", async () => {
            await loginUser({ email: emailValid, password: "WrongPassword!", sessionMetadata: mockSession });
        });
        await measure("2. Non-Existent Email", async () => {
            await loginUser({ email: emailInvalid, password: "WrongPassword!", sessionMetadata: mockSession });
        });
        // Clear failed attempts so we don't hit max
        const { getFailedAttemptsMapForTesting } = await import("./packages/auth/src/login.js");
        getFailedAttemptsMapForTesting().delete(norm);
        await measure("3. Correct Login", async () => {
            await loginUser({ email: emailValid, password: pass, sessionMetadata: mockSession });
        });
    }
    catch (err) {
        console.error(err);
    }
    finally {
        process.exit(0);
    }
}
run();
