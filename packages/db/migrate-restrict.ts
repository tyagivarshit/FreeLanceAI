import { db } from "./src/client.js";
import { sql } from "drizzle-orm";

async function migrate() {
  console.log("Applying RESTRICT constraint to tenantId...");
  
  // Drop the old CASCADE constraint (if it exists under the name Drizzle might have generated)
  // Or the one we added previously
  await db.execute(sql`
    ALTER TABLE client_timelines DROP CONSTRAINT IF EXISTS client_timelines_tenant_id_users_id_fk;
  `);

  // Add the new RESTRICT constraint
  await db.execute(sql`
    ALTER TABLE client_timelines 
    ADD CONSTRAINT client_timelines_tenant_id_users_id_fk 
    FOREIGN KEY (tenant_id) REFERENCES users(id) ON DELETE RESTRICT;
  `);

  console.log("Migration complete!");
  process.exit(0);
}

migrate().catch(console.error);
