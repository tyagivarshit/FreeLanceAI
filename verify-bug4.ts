import { db } from "./packages/db/src/client.js";
import { users, userPasswordHashes } from "./packages/db/src/index.js";
import { hashPassword } from "./packages/auth/src/hash.js";
import { loginUser } from "./packages/auth/src/login.js";
import { eq } from "drizzle-orm";
import { normalizeEmailAddress } from "./packages/core/src/index.js";

async function run() {
  const emailLocked = "test_locked@example.com";
  const emailNormal = "test_normal_2@example.com";
  const pass = "CorrectPassword123!";

  try {
    const lNorm = normalizeEmailAddress(emailLocked, { stripSubaddress: true, stripDots: true });
    const nNorm = normalizeEmailAddress(emailNormal, { stripSubaddress: true, stripDots: true });

    // Setup Data
    const { passwordHash, algorithm, hashVersion } = await hashPassword(pass);
    
    // Create Locked User
    const futureDate = new Date();
    futureDate.setHours(futureDate.getHours() + 1);
    
    let lUser = (await db.insert(users).values({
      email: emailLocked,
      normalizedEmail: lNorm,
      status: "active",
      lockedUntil: futureDate,
    }).onConflictDoUpdate({
      target: users.normalizedEmail,
      set: { status: "active", lockedUntil: futureDate }
    }).returning())[0];
    
    await db.insert(userPasswordHashes).values({
      userId: lUser.id,
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
      lockedUntil: null,
    }).onConflictDoUpdate({
      target: users.normalizedEmail,
      set: { status: "active", lockedUntil: null }
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

    // Test (a) wrong password + locked account
    try {
      console.log("\n--- (a) Wrong Password + Locked Account ---");
      await loginUser({ email: emailLocked, password: "wrong", sessionMetadata: mockSession });
    } catch (e: any) {
      console.log("Error Name:", e.name);
      console.log("Error Code:", e.code);
    }

    // Test (b) wrong password + normal account
    try {
      console.log("\n--- (b) Wrong Password + Normal Account ---");
      await loginUser({ email: emailNormal, password: "wrong", sessionMetadata: mockSession });
    } catch (e: any) {
      console.log("Error Name:", e.name);
      console.log("Error Code:", e.code);
    }

    // Test (c) correct password + locked account
    try {
      console.log("\n--- (c) Correct Password + Locked Account ---");
      await loginUser({ email: emailLocked, password: pass, sessionMetadata: mockSession });
    } catch (e: any) {
      console.log("Error Name:", e.name);
      console.log("Error Code:", e.code);
    }
  } catch (err) {
    console.error("Setup failed:", err);
  } finally {
    process.exit(0);
  }
}

run();
