import { db } from "./packages/db/src/client.js";
import { createSession } from "./packages/auth/src/session.js";
import { users, userPasswordHashes, sessions } from "./packages/db/src/index.js";
import { eq } from "drizzle-orm";
import crypto from "crypto";
async function testCap() {
    try {
        const userId = crypto.randomUUID();
        await db.insert(users).values({
            id: userId,
            email: `cap${Date.now()}@example.com`,
            normalizedEmail: `CAP${Date.now()}@EXAMPLE.COM`,
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
        console.log("Creating 6 sessions (cap is 5)...");
        for (let i = 1; i <= 6; i++) {
            await createSession(userId, { userAgent: `Device ${i}`, ipAddress: "127.0.0.1" });
            console.log(`Created Session ${i}`);
            // Sleep a tiny bit to ensure order
            await new Promise(r => setTimeout(r, 100));
        }
        const activeSessions = await db.select().from(sessions).where(eq(sessions.userId, userId));
        const active = activeSessions.filter(s => !s.revokedAt);
        const revoked = activeSessions.filter(s => s.revokedAt);
        console.log(`Total sessions in DB: ${activeSessions.length}`);
        console.log(`Active sessions: ${active.length}`);
        console.log(`Revoked sessions: ${revoked.length}`);
        if (active.length === 5 && revoked.length === 1) {
            console.log("SUCCESS: Session cap enforced correctly. Oldest was revoked.");
        }
        else {
            console.log("FAIL: Cap not enforced properly.");
        }
    }
    catch (e) {
        console.error(e);
    }
    finally {
        process.exit(0);
    }
}
testCap();
