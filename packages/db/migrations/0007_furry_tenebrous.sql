ALTER TABLE "job_imports" DROP CONSTRAINT "job_imports_client_id_tenant_id_clients_id_tenant_id_fk";
--> statement-breakpoint
ALTER TABLE "client_timelines" DROP CONSTRAINT "client_timelines_client_id_owner_id_clients_id_owner_id_fk";
--> statement-breakpoint
DROP INDEX IF EXISTS "clients_owner_primary_email_unique_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "clients_owner_tax_id_unique_idx";--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "job_imports" ADD CONSTRAINT "job_imports_client_id_tenant_id_clients_id_tenant_id_fk" FOREIGN KEY ("client_id","tenant_id") REFERENCES "public"."clients"("id","tenant_id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "client_timelines" ADD CONSTRAINT "client_timelines_client_id_owner_id_clients_id_owner_id_fk" FOREIGN KEY ("client_id","owner_id") REFERENCES "public"."clients"("id","owner_id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "clients_tenant_primary_email_unique_idx" ON "clients" USING btree ("tenant_id",lower(trim("primary_contact"->>'email'))) WHERE "clients"."primary_contact" IS NOT NULL AND trim("clients"."primary_contact"->>'email') <> '';--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "clients_tenant_tax_id_unique_idx" ON "clients" USING btree ("tenant_id","billing_details"->>'taxRegistrationId') WHERE "clients"."billing_details" IS NOT NULL AND trim("clients"."billing_details"->>'taxRegistrationId') <> '';