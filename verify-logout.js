import { db } from "./packages/db/src/client.js";
import { users, sessions, userPasswordHashes } from "./packages/db/src/index.js";
import { hashPassword } from "./packages/auth/src/hash.js";
import { eq } from "drizzle-orm";
import { normalizeEmailAddress } from "./packages/core/src/index.js";
import { verifyAccessToken } from "./packages/auth/src/token.js";
async function run() {
    try {
        const email1 = "user1@example.com";
        const email2 = "user2@example.com";
        const pass = "Password123!";
        const { passwordHash, algorithm, hashVersion } = await hashPassword(pass);
        const norm1 = normalizeEmailAddress(email1, { stripSubaddress: true, stripDots: true });
        const norm2 = normalizeEmailAddress(email2, { stripSubaddress: true, stripDots: true });
        let user1 = (await db.insert(users).values({ email: email1, normalizedEmail: norm1, status: "active" }).onConflictDoUpdate({ target: users.normalizedEmail, set: { status: "active" } }).returning())[0];
        let user2 = (await db.insert(users).values({ email: email2, normalizedEmail: norm2, status: "active" }).onConflictDoUpdate({ target: users.normalizedEmail, set: { status: "active" } }).returning())[0];
        await db.insert(userPasswordHashes).values({ userId: user1.id, passwordHash, algorithm, hashVersion, passwordChangedAt: new Date() }).onConflictDoUpdate({ target: userPasswordHashes.userId, set: { passwordHash, credentialVersion: 1 } });
        await db.insert(userPasswordHashes).values({ userId: user2.id, passwordHash, algorithm, hashVersion, passwordChangedAt: new Date() }).onConflictDoUpdate({ target: userPasswordHashes.userId, set: { passwordHash, credentialVersion: 1 } });
        // Clean up old sessions
        await db.delete(sessions).where(eq(sessions.userId, user1.id));
        await db.delete(sessions).where(eq(sessions.userId, user2.id));
        // Helper to login and get token
        const login = async (email) => {
            const res = await fetch("http://localhost:4001/api/login", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password: pass })
            });
            const cookie = res.headers.get("set-cookie");
            const cookieParts = cookie.split(";")[0].split("=");
            const cookieName = cookieParts[0];
            const token = cookieParts[1];
            const decoded = verifyAccessToken(token);
            return { cookieName, token, sessionId: decoded.sessionId };
        };
        console.log("--- 1. Single-device logout scope ---");
        const s1_1 = await login(email1);
        const s1_2 = await login(email1);
        // Check DB before
        let dbSessions = await db.select().from(sessions).where(eq(sessions.userId, user1.id));
        console.log(`Active sessions before single logout: ${dbSessions.length}`);
        // Logout s1_1
        await fetch("http://localhost:4001/api/logout", {
            method: "POST", headers: { "Cookie": `${s1_1.cookieName}=${s1_1.token}` }
        });
        // Check DB after
        dbSessions = await db.select().from(sessions).where(eq(sessions.userId, user1.id));
        const revokedS1_1 = dbSessions.find(s => s.id === s1_1.sessionId)?.revokedAt != null;
        const revokedS1_2 = dbSessions.find(s => s.id === s1_2.sessionId)?.revokedAt != null;
        console.log(`Target session revoked: ${revokedS1_1}`);
        console.log(`Other session revoked: ${revokedS1_2}`);
        console.log("\n--- 2. Global logout ---");
        // Clean up user1 sessions
        await db.delete(sessions).where(eq(sessions.userId, user1.id));
        const g1 = await login(email1);
        const g2 = await login(email1);
        const g3 = await login(email1);
        const credBefore = (await db.select().from(userPasswordHashes).where(eq(userPasswordHashes.userId, user1.id)))[0].credentialVersion;
        console.log(`Credential Version Before: ${credBefore}`);
        await fetch("http://localhost:4001/api/logout", {
            method: "POST", headers: { "Content-Type": "application/json", "Cookie": `${g1.cookieName}=${g1.token}` },
            body: JSON.stringify({ global: true })
        });
        const dbSessionsGlobal = await db.select().from(sessions).where(eq(sessions.userId, user1.id));
        console.log(`Sessions after global logout: ${dbSessionsGlobal.length}`);
        console.log(`All 3 revoked: ${dbSessionsGlobal.every(s => s.revokedAt != null)}`);
        const credAfter = (await db.select().from(userPasswordHashes).where(eq(userPasswordHashes.userId, user1.id)))[0].credentialVersion;
        console.log(`Credential Version After: ${credAfter}`);
        console.log("\n--- 3. Cookie clearing ---");
        const s3 = await login(email1);
        const logoutRes3 = await fetch("http://localhost:4001/api/logout", {
            method: "POST", headers: { "Cookie": `${s3.cookieName}=${s3.token}` }
        });
        console.log("Raw Set-Cookie header:", logoutRes3.headers.get("set-cookie"));
        console.log("\n--- 4. Idempotency ---");
        const s4 = await login(email1);
        const logoutRes4_1 = await fetch("http://localhost:4001/api/logout", {
            method: "POST", headers: { "Cookie": `${s4.cookieName}=${s4.token}` }
        });
        console.log("First logout status:", logoutRes4_1.status);
        const logoutRes4_2 = await fetch("http://localhost:4001/api/logout", {
            method: "POST", headers: { "Cookie": `${s4.cookieName}=${s4.token}` }
        });
        console.log("Second logout status:", logoutRes4_2.status);
        console.log("\n--- 5. Authorization ---");
        const s5_victim = await login(email2);
        const s5_attacker = await login(email1);
        // Attacker tries to logout victim's session
        const logoutRes5 = await fetch("http://localhost:4001/api/logout", {
            method: "POST", headers: { "Content-Type": "application/json", "Cookie": `${s5_attacker.cookieName}=${s5_attacker.token}` },
            body: JSON.stringify({ sessionId: s5_victim.sessionId, userId: user2.id })
        });
        console.log("Attacker logout request status:", logoutRes5.status);
        // Check victim session
        const victimDbSession = (await db.select().from(sessions).where(eq(sessions.id, s5_victim.sessionId)))[0];
        console.log(`Victim session revoked: ${victimDbSession.revokedAt != null}`);
        // Check attacker session
        const attackerDbSession = (await db.select().from(sessions).where(eq(sessions.id, s5_attacker.sessionId)))[0];
        console.log(`Attacker session revoked: ${attackerDbSession.revokedAt != null}`);
    }
    catch (e) {
        console.error(e);
    }
    finally {
        process.exit(0);
    }
}
run();
