-- Migration for Bug 1, 2, and 3
-- Update unique constraints to be scoped by tenantId instead of ownerId
DROP INDEX IF EXISTS "clients_owner_primary_email_unique_idx";
DROP INDEX IF EXISTS "clients_owner_tax_id_unique_idx";

CREATE UNIQUE INDEX IF NOT EXISTS "clients_tenant_primary_email_unique_idx" ON "clients" USING btree ("tenant_id", lower(trim(("primary_contact"->>'email')))) WHERE "primary_contact" IS NOT NULL AND trim(("primary_contact"->>'email')) <> '';
CREATE UNIQUE INDEX IF NOT EXISTS "clients_tenant_tax_id_unique_idx" ON "clients" USING btree ("tenant_id", ("billing_details"->>'taxRegistrationId')) WHERE "billing_details" IS NOT NULL AND trim(("billing_details"->>'taxRegistrationId')) <> '';

-- Change onDelete behavior on client_timelines to cascade
ALTER TABLE "client_timelines" DROP CONSTRAINT IF EXISTS "client_timelines_client_id_owner_id_clients_id_owner_id_fk";
ALTER TABLE "client_timelines" ADD CONSTRAINT "client_timelines_client_id_owner_id_clients_id_owner_id_fk" FOREIGN KEY ("client_id", "owner_id") REFERENCES "public"."clients"("id","owner_id") ON DELETE cascade ON UPDATE no action;

-- Change onDelete behavior on job_imports to cascade
ALTER TABLE "job_imports" DROP CONSTRAINT IF EXISTS "job_imports_client_id_tenant_id_clients_id_tenant_id_fk";
ALTER TABLE "job_imports" ADD CONSTRAINT "job_imports_client_id_tenant_id_clients_id_tenant_id_fk" FOREIGN KEY ("client_id", "tenant_id") REFERENCES "public"."clients"("id","tenant_id") ON DELETE cascade ON UPDATE no action;

