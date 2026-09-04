import { db } from "./packages/db/src/client.js";
import { signupUser } from "./packages/auth/src/signup.js";
import { users, userPasswordHashes } from "./packages/db/src/index.js";
import crypto from "crypto";

async function testTiming() {
  try {
    const existingEmail = `timing_existing${Date.now()}@example.com`;
    const newEmailBase = `timing_new${Date.now()}`;
    const password = "ValidPassword123!";
    const sessionMetadata = { ipAddress: "1", userAgent: "1" };

    // Create existing user manually
    const userId = crypto.randomUUID();
    await db.insert(users).values({
      id: userId,
      email: existingEmail,
      normalizedEmail: existingEmail.toUpperCase(),
      status: "active"
    });

    console.log("Warming up...");
    for (let i = 0; i < 2; i++) {
      try { await signupUser({ email: "warmup@test.com", password, sessionMetadata }); } catch (e) {}
    }

    const newTimes: number[] = [];
    const existingTimes: number[] = [];

    const ITERATIONS = 10;
    
    console.log(`Running ${ITERATIONS} iterations for new emails...`);
    for (let i = 0; i < ITERATIONS; i++) {
      const start = performance.now();
      try {
        await signupUser({ email: `${newEmailBase}_${i}@example.com`, password, sessionMetadata });
      } catch (e) {}
      const end = performance.now();
      newTimes.push(end - start);
    }

    console.log(`Running ${ITERATIONS} iterations for existing email...`);
    for (let i = 0; i < ITERATIONS; i++) {
      const start = performance.now();
      try {
        await signupUser({ email: existingEmail, password, sessionMetadata });
      } catch (e) {}
      const end = performance.now();
      existingTimes.push(end - start);
    }

    const avgNew = newTimes.reduce((a, b) => a + b, 0) / newTimes.length;
    const avgExisting = existingTimes.reduce((a, b) => a + b, 0) / existingTimes.length;

    console.log(`Avg time for NEW email:      ${avgNew.toFixed(2)} ms`);
    console.log(`Avg time for EXISTING email: ${avgExisting.toFixed(2)} ms`);

    const diff = Math.abs(avgNew - avgExisting);
    console.log(`Difference: ${diff.toFixed(2)} ms`);

    if (diff < 30) {
      console.log("SUCCESS: Timing attack mitigated! Response times are equivalent.");
    } else {
      console.log("FAIL: Significant timing difference detected.");
    }

  } catch (e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}
testTiming();
