import { db } from "./packages/db/src/client.js";
import { users, userPasswordHashes } from "./packages/db/src/index.js";
import { hashPassword } from "./packages/auth/src/hash.js";
import { loginUser } from "./packages/auth/src/login.js";
import { normalizeEmailAddress } from "./packages/core/src/index.js";
async function run() {
    const emailSuspended = "test_suspended@example.com";
    const emailNormal = "test_normal@example.com";
    const pass = "CorrectPassword123!";
    try {
        const sNorm = normalizeEmailAddress(emailSuspended, { stripSubaddress: true, stripDots: true });
        const nNorm = normalizeEmailAddress(emailNormal, { stripSubaddress: true, stripDots: true });
        // Setup Data
        const { passwordHash, algorithm, hashVersion } = await hashPassword(pass);
        // Create Suspended User
        let sUser = (await db.insert(users).values({
            email: emailSuspended,
            normalizedEmail: sNorm,
            status: "suspended",
        }).onConflictDoUpdate({
            target: users.normalizedEmail,
            set: { status: "suspended" }
        }).returning())[0];
        await db.insert(userPasswordHashes).values({
            userId: sUser.id,
            passwordHash,
            algorithm,
            hashVersion,
            passwordChangedAt: new Date(),
        }).onConflictDoUpdate({
            target: userPasswordHashes.userId,
            set: { passwordHash, algorithm, hashVersion }
        });
        // Create Normal User
        let nUser = (await db.insert(users).values({
            email: emailNormal,
            normalizedEmail: nNorm,
            status: "active",
        }).onConflictDoUpdate({
            target: users.normalizedEmail,
            set: { status: "active" }
        }).returning())[0];
        await db.insert(userPasswordHashes).values({
            userId: nUser.id,
            passwordHash,
            algorithm,
            hashVersion,
            passwordChangedAt: new Date(),
        }).onConflictDoUpdate({
            target: userPasswordHashes.userId,
            set: { passwordHash, algorithm, hashVersion }
        });
        const mockSession = { ipAddress: "127.0.0.1", userAgent: "test" };
        // Test (a) wrong password + suspended account
        try {
            console.log("\n--- (a) Wrong Password + Suspended Account ---");
            await loginUser({ email: emailSuspended, password: "wrong", sessionMetadata: mockSession });
        }
        catch (e) {
            console.log("Error Name:", e.name);
            console.log("Error Code:", e.code);
        }
        // Test (b) wrong password + normal account
        try {
            console.log("\n--- (b) Wrong Password + Normal Account ---");
            await loginUser({ email: emailNormal, password: "wrong", sessionMetadata: mockSession });
        }
        catch (e) {
            console.log("Error Name:", e.name);
            console.log("Error Code:", e.code);
        }
        // Test (c) correct password + suspended account
        try {
            console.log("\n--- (c) Correct Password + Suspended Account ---");
            await loginUser({ email: emailSuspended, password: pass, sessionMetadata: mockSession });
        }
        catch (e) {
            console.log("Error Name:", e.name);
            console.log("Error Code:", e.code);
        }
    }
    catch (err) {
        console.error("Setup failed:", err);
    }
    finally {
        process.exit(0);
    }
}
run();
