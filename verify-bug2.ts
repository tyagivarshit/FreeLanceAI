import { db } from "./packages/db/src/client.js";
import { users, userPasswordHashes } from "./packages/db/src/index.js";
import { hashPassword } from "./packages/auth/src/hash.js";
import { loginUser } from "./packages/auth/src/login.js";
import { normalizeEmailAddress } from "./packages/core/src/index.js";
import { runtimeConfig } from "./packages/config/src/config.js";
import { eq } from "drizzle-orm";

async function run() {
  const emailLocked = "test_locked2@example.com";
  const pass = "CorrectPassword123!";

  try {
    const norm = normalizeEmailAddress(emailLocked, { stripSubaddress: true, stripDots: true });

    const { passwordHash, algorithm, hashVersion } = await hashPassword(pass);
    
    let user = (await db.insert(users).values({
      email: emailLocked,
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
    const maxAttempts = runtimeConfig.CONFIG_MAX_LOGIN_ATTEMPTS;

    console.log(`\n--- Triggering ${maxAttempts} failed logins... ---`);
    for (let i = 0; i < maxAttempts; i++) {
      try {
        await loginUser({ email: emailLocked, password: "wrong", sessionMetadata: mockSession });
      } catch (e: any) {
         console.log(`Attempt ${i + 1} failed as expected with: ${e.code}, message: ${e.message}`);
      }
    }

    console.log("\n--- Checking Account Lockout ---");
    let caughtLockout = false;
    try {
      await loginUser({ email: emailLocked, password: pass, sessionMetadata: mockSession });
      console.log("FAILED: Expected to be locked out but login succeeded!");
    } catch (e: any) {
      console.log("Error Name:", e.name);
      console.log("Error Code:", e.code);
      if (e.code === "ACCOUNT_LOCKED") {
        caughtLockout = true;
      }
    }

    const lockedUserArr = await db.select().from(users).where(eq(users.id, user.id));
    const lockedUser = lockedUserArr[0];
    console.log("DB Status:", lockedUser?.status);
    console.log("DB Locked Until set:", !!lockedUser?.lockedUntil);

    console.log("\n--- Simulating Expiry ---");
    await db.update(users).set({ lockedUntil: new Date(Date.now() - 1000) }).where(eq(users.id, user.id));
    
    try {
      const res = await loginUser({ email: emailLocked, password: pass, sessionMetadata: mockSession });
      console.log("Login Success after expiry:", res.user.email);
    } catch (e: any) {
      console.log("Error Name:", e.name, "Error Code:", e.code);
    }

  } catch (err) {
    console.error("Setup failed:", err);
  } finally {
    process.exit(0);
  }
}

run();
