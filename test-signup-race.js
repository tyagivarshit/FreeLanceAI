import { db } from "./packages/db/src/client.js";
import { signupUser } from "./packages/auth/src/signup.js";
import { users } from "./packages/db/src/index.js";
import { eq } from "drizzle-orm";
async function testRace() {
    try {
        const email = `race${Date.now()}@example.com`;
        const password = "ValidPassword123!";
        console.log(`Firing 2 concurrent signups for: ${email}`);
        const results = await Promise.allSettled([
            signupUser({ email, password, sessionMetadata: { ipAddress: "1", userAgent: "1" } }),
            signupUser({ email, password, sessionMetadata: { ipAddress: "1", userAgent: "1" } })
        ]);
        console.log("Signup A status:", results[0].status);
        if (results[0].status === "fulfilled") {
            console.log("Signup A result (user ID):", results[0].value.user.id);
        }
        else {
            console.log("Signup A error:", results[0].reason.name, results[0].reason.message);
        }
        console.log("Signup B status:", results[1].status);
        if (results[1].status === "fulfilled") {
            console.log("Signup B result (user ID):", results[1].value.user.id);
        }
        else {
            console.log("Signup B error:", results[1].reason.name, results[1].reason.message);
        }
        const insertedUsers = await db.select().from(users).where(eq(users.email, email));
        console.log(`Total DB rows created for ${email}: ${insertedUsers.length}`);
        if (results[0].status === "fulfilled" && results[1].status === "fulfilled" && insertedUsers.length === 1) {
            console.log("SUCCESS: Both returned success cleanly (anti-enumeration) but only 1 row exists!");
        }
        else {
            console.log("FAIL: Expected clean behavior not met.");
        }
    }
    catch (e) {
        console.error(e);
    }
    finally {
        process.exit(0);
    }
}
testRace();
