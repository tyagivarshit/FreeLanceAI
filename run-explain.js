import { db } from "./packages/db/src/client.js";
import { sql } from "drizzle-orm";
async function run() {
    try {
        const mockUser = "00000000-0000-0000-0000-000000000000";
        await db.execute(sql `SET enable_seqscan = OFF`);
        const res1 = await db.execute(sql `EXPLAIN ANALYZE SELECT credential_version FROM user_password_hashes WHERE user_id = ${mockUser} LIMIT 1`);
        console.log("=== EXPLAIN user_password_hashes ===");
        res1.rows.forEach(r => console.log(r['QUERY PLAN']));
        const res2 = await db.execute(sql `EXPLAIN ANALYZE SELECT id FROM sessions WHERE id = ${mockUser}`);
        console.log("\n=== EXPLAIN sessions ===");
        res2.rows.forEach(r => console.log(r['QUERY PLAN']));
    }
    catch (e) {
        console.error(e);
    }
    finally {
        process.exit(0);
    }
}
run();
