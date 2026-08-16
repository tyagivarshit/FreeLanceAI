DO $$ BEGIN
 CREATE TYPE "public"."client_status" AS ENUM('Lead', 'Active', 'Suspended', 'Archived', 'Closed');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "clients" (
	"id" uuid PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"owner_id" uuid NOT NULL,
	"status" "client_status" NOT NULL,
	"profile" jsonb NOT NULL,
	"billing_details" jsonb,
	"primary_contact" jsonb,
	"archived_at" timestamp with time zone,
	"closed_at" timestamp with time zone,
	"suspended_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "clients_id_tenant_unique" UNIQUE("id","tenant_id"),
	CONSTRAINT "clients_id_owner_unique" UNIQUE("id","owner_id")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "clients" ADD CONSTRAINT "clients_tenant_id_users_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "clients" ADD CONSTRAINT "clients_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "client_timelines" ADD CONSTRAINT "client_timelines_client_id_owner_id_clients_id_owner_id_fk" FOREIGN KEY ("client_id","owner_id") REFERENCES "public"."clients"("id","owner_id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "job_imports" ADD COLUMN IF NOT EXISTS "client_id" uuid;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "job_imports" ADD CONSTRAINT "job_imports_client_id_tenant_id_clients_id_tenant_id_fk" FOREIGN KEY ("client_id","tenant_id") REFERENCES "public"."clients"("id","tenant_id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "clients_tenant_idx" ON "clients" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "clients_owner_idx" ON "clients" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "clients_tenant_created_at_idx" ON "clients" USING btree ("tenant_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "clients_owner_created_at_idx" ON "clients" USING btree ("owner_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "clients_status_idx" ON "clients" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "job_imports_tenant_client_idx" ON "job_imports" USING btree ("tenant_id","client_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "clients_owner_primary_email_unique_idx" ON "clients" USING btree ("owner_id",lower(trim(("primary_contact"->>'email')))) WHERE ("primary_contact" IS NOT NULL AND trim(("primary_contact"->>'email')) <> '');--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "clients_owner_tax_id_unique_idx" ON "clients" USING btree ("owner_id",("billing_details"->>'taxRegistrationId')) WHERE ("billing_details" IS NOT NULL AND trim(("billing_details"->>'taxRegistrationId')) <> '');
