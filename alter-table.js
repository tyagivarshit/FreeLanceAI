import { db } from "./packages/db/src/client.js";
import { sql } from "drizzle-orm";
async function main() {
    await db.execute(sql `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "locked_until" timestamp with time zone;`);
    console.log("Migration applied via code");
    process.exit(0);
}
main();
