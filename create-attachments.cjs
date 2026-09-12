const { Client } = require("pg");

const client = new Client({
  connectionString: "postgres://postgres:postgres@localhost:5432/freelanceos",
});

async function main() {
  await client.connect();
  
  await client.query(`
    CREATE TABLE IF NOT EXISTS "attachments" (
      "id" uuid PRIMARY KEY NOT NULL,
      "tenant_id" uuid NOT NULL,
      "parent_id" uuid NOT NULL,
      "owner_id" uuid NOT NULL,
      "attachment_reference" varchar(255) NOT NULL,
      "storage_key" varchar(255) NOT NULL,
      "original_filename" varchar(255),
      "mime_type" varchar(100) NOT NULL,
      "file_size_bytes" integer NOT NULL,
      "metadata" jsonb NOT NULL,
      "visibility" jsonb NOT NULL,
      "status" varchar(50) NOT NULL,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL,
      "updated_at" timestamp with time zone DEFAULT now() NOT NULL
    );

    CREATE UNIQUE INDEX IF NOT EXISTS "attachments_tenant_ref_unique_idx" ON "attachments" ("tenant_id", "attachment_reference");
    CREATE INDEX IF NOT EXISTS "attachments_tenant_idx" ON "attachments" ("tenant_id");
    CREATE INDEX IF NOT EXISTS "attachments_parent_idx" ON "attachments" ("parent_id");
    CREATE INDEX IF NOT EXISTS "attachments_status_idx" ON "attachments" ("status");
  `);
  
  console.log("Attachments table created successfully!");
  await client.end();
}

main().catch((err) => {
  console.error("Error creating tables", err);
  process.exit(1);
});
