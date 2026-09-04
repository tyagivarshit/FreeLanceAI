import { db } from "./packages/db/src/client.js";
import { createSession, rotateSession } from "./packages/auth/src/session.js";
import { users, userPasswordHashes } from "./packages/db/src/index.js";
import crypto from "crypto";

async function testNoRedis() {
  try {
    const userId = crypto.randomUUID();
    await db.insert(users).values({
      id: userId,
      email: `noredis${Date.now()}@example.com`,
      normalizedEmail: `NOREDIS${Date.now()}@EXAMPLE.COM`,
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

    console.log("Redis is down. Attempting normal token rotation...");
    const res = await rotateSession(oldToken, { userAgent: "Test A", ipAddress: "127.0.0.1" });
    
    if (res.newRawRefreshToken && res.newSignedAccessToken) {
      console.log("SUCCESS: Rotated token despite Redis being offline.");
    } else {
      console.log("FAIL: No tokens returned.");
    }
  } catch (e: any) {
    console.error("CRASHED:", e.name, e.message);
  } finally {
    process.exit(0);
  }
}
testNoRedis();
