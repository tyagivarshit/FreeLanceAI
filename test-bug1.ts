import { db } from "./packages/db/src/client.js";
import { users } from "./packages/db/src/index.js";

async function testConflict() {
  const email = "conflict_test@freelanceos.dev";
  const normalizedEmail = "CONFLICT_TEST@FREELANCEOS.DEV";

  try {
    console.log("Running first insert...");
    const res1 = await db.insert(users).values({
      email,
      normalizedEmail,
      status: "pending",
    }).onConflictDoUpdate({
      target: users.normalizedEmail,
      set: { status: "active" }
    }).returning();
    console.log("First insert success:", res1[0]?.email);

    console.log("Running second insert (conflict)...");
    const res2 = await db.insert(users).values({
      email,
      normalizedEmail,
      status: "pending",
    }).onConflictDoUpdate({
      target: users.normalizedEmail,
      set: { status: "active" }
    }).returning();
    console.log("Second insert success (conflict resolved):", res2[0]?.status);
  } catch (err) {
    console.error("FAILED with error:", err);
  } finally {
    process.exit(0);
  }
}

testConflict();
