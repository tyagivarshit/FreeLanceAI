import { db } from "./src/client.js";
import { sql } from "drizzle-orm";

async function migrate() {
  console.log("Migrating Payments Schema...");
  
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS payments (
      id UUID PRIMARY KEY,
      tenant_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      owner_id UUID REFERENCES users(id) ON DELETE SET NULL,
      client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      amount INTEGER NOT NULL,
      currency VARCHAR(3) NOT NULL,
      status VARCHAR(50) NOT NULL,
      payment_reference VARCHAR(255) NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS payments_tenant_ref_unique ON payments(tenant_id, payment_reference);
    CREATE INDEX IF NOT EXISTS payments_client_idx ON payments(client_id);
    CREATE INDEX IF NOT EXISTS payments_tenant_idx ON payments(tenant_id);
  `);

  console.log("Payments Migration complete!");
  process.exit(0);
}

migrate().catch(console.error);
