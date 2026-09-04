import { db } from "./packages/db/src/client.js";
import { createSession, rotateSession } from "./packages/auth/src/session.js";
import { users, userPasswordHashes } from "./packages/db/src/index.js";
import crypto from "crypto";

async function testRace() {
  try {
    const userId = crypto.randomUUID();
    await db.insert(users).values({
      id: userId,
      email: `race${Date.now()}@example.com`,
      normalizedEmail: `RACE${Date.now()}@EXAMPLE.COM`,
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

    const session = await createSession(userId, {
      userAgent: "Test",
      ipAddress: "127.0.0.1"
    });

    const oldToken = session.rawRefreshToken;

    console.log("Firing concurrent rotations for:", oldToken);
    
    const [resA, resB] = await Promise.all([
      rotateSession(oldToken, { userAgent: "Test A", ipAddress: "127.0.0.1" }),
      rotateSession(oldToken, { userAgent: "Test B", ipAddress: "127.0.0.1" })
    ]);

    console.log("Req A token:", resA.newRawRefreshToken);
    console.log("Req B token:", resB.newRawRefreshToken);

    if (resA.newRawRefreshToken === resB.newRawRefreshToken) {
      console.log("SUCCESS: Both requests received IDENTICAL tokens idempotently!");
    } else {
      console.log("FAIL: Tokens differed!");
    }

    // Try a third rotation using the OLD token immediately (within grace)
    console.log("Firing 3rd rotation inside grace window...");
    const resC = await rotateSession(oldToken, { userAgent: "Test C", ipAddress: "127.0.0.1" });
    console.log("Req C token:", resC.newRawRefreshToken);

    console.log("Waiting 11 seconds to test replay after grace period...");
    await new Promise(r => setTimeout(r, 11000));

    try {
      await rotateSession(oldToken, { userAgent: "Test D", ipAddress: "127.0.0.1" });
      console.log("FAIL: 4th rotation should have failed!");
    } catch (e: any) {
      console.log("Req D correctly failed with:", e.name, e.message);
    }
  } catch (e) {
    console.error("Test Setup Failed:", e);
  } finally {
    process.exit(0);
  }
}
testRace();
