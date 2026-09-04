import { db } from "./packages/db/src/client.js";
import { users } from "./packages/db/src/index.js";
import { eq } from "drizzle-orm";

async function testUpdate() {
  const email = "update_test@freelanceos.dev";
  const normalizedEmail = "UPDATE_TEST@FREELANCEOS.DEV";

  try {
    // 1. Insert a user
    const res1 = await db.insert(users).values({
      email,
      normalizedEmail,
      status: "pending",
    }).returning();
    
    const user = res1[0];
    const initialUpdatedAt = user.updatedAt;
    console.log("Initial updatedAt:", initialUpdatedAt.toISOString());

    // Wait a brief moment to ensure time difference
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // 2. Update the user
    const res2 = await db.update(users)
      .set({ status: "active" })
      .where(eq(users.id, user.id))
      .returning();

    const finalUpdatedAt = res2[0].updatedAt;
    console.log("Final updatedAt:  ", finalUpdatedAt.toISOString());

    if (finalUpdatedAt.getTime() > initialUpdatedAt.getTime()) {
      console.log("SUCCESS: updatedAt changed!");
    } else {
      console.log("FAIL: updatedAt did not change.");
    }
  } catch (err) {
    console.error("FAILED with error:", err);
  } finally {
    process.exit(0);
  }
}

testUpdate();
