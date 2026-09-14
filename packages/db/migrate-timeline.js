import { db } from "./src/client.js";
import { sql } from "drizzle-orm";
async function migrate() {
    console.log("Migrating schema...");
    // Bug 1: Add tenantId, change ownerId to SET NULL
    await db.execute(sql `
    ALTER TABLE client_timelines ADD COLUMN IF NOT EXISTS tenant_id UUID;
  `);
    await db.execute(sql `
    ALTER TABLE client_timelines DROP CONSTRAINT IF EXISTS client_timelines_owner_id_users_id_fk;
  `);
    await db.execute(sql `
    ALTER TABLE client_timelines DROP CONSTRAINT IF EXISTS client_timelines_client_id_owner_id_clients_id_owner_id_fk;
  `);
    await db.execute(sql `
    ALTER TABLE client_timelines ALTER COLUMN owner_id DROP NOT NULL;
  `);
    await db.execute(sql `
    ALTER TABLE client_timelines 
    ADD CONSTRAINT client_timelines_owner_id_users_id_fk 
    FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE SET NULL;
  `);
    // Bug 2: Add sequence_number
    await db.execute(sql `
    ALTER TABLE timeline_entries ADD COLUMN IF NOT EXISTS sequence_number BIGSERIAL;
  `);
    console.log("Migration complete!");
    process.exit(0);
}
migrate().catch(console.error);
