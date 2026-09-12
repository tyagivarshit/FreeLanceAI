DO $$ BEGIN
 CREATE TYPE "public"."brain_analysis_status" AS ENUM('REQUESTED', 'RUNNING', 'COMPLETED', 'FAILED', 'TIMEOUT', 'INSUFFICIENT_CONTEXT');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."client_status" AS ENUM('Lead', 'Active', 'Suspended', 'Archived', 'Closed');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "brain_analyses" (
	"id" uuid PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"owner_id" uuid NOT NULL,
	"actor_id" uuid NOT NULL,
	"analysis_type" varchar(64) NOT NULL,
	"status" "brain_analysis_status" NOT NULL,
	"idempotency_key" varchar(128),
	"correlation_id" varchar(128) NOT NULL,
	"summary" text,
	"insights" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"recommendations" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"confidence" jsonb,
	"evidence" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"failure" jsonb,
	"metadata" jsonb,
	"constraints" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 3 NOT NULL,
	"claimed_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"failed_at" timestamp with time zone,
	"stale_timeout_ms" integer DEFAULT 30000 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "brain_analyses_id_tenant_unique" UNIQUE("id","tenant_id"),
	CONSTRAINT "brain_analyses_id_owner_unique" UNIQUE("id","owner_id")
);
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
ALTER TABLE "users" ADD COLUMN "locked_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "job_imports" ADD COLUMN "client_id" uuid;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "brain_analyses" ADD CONSTRAINT "brain_analyses_tenant_id_users_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "brain_analyses" ADD CONSTRAINT "brain_analyses_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "brain_analyses" ADD CONSTRAINT "brain_analyses_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
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
CREATE INDEX IF NOT EXISTS "brain_analyses_tenant_idx" ON "brain_analyses" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "brain_analyses_owner_idx" ON "brain_analyses" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "brain_analyses_status_idx" ON "brain_analyses" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "brain_analyses_claimed_at_idx" ON "brain_analyses" USING btree ("claimed_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "brain_analyses_tenant_created_at_idx" ON "brain_analyses" USING btree ("tenant_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "brain_analyses_owner_idempotency_unique_idx" ON "brain_analyses" USING btree ("tenant_id","owner_id","analysis_type","idempotency_key") WHERE "brain_analyses"."idempotency_key" IS NOT NULL AND "brain_analyses"."status" IN ('REQUESTED', 'RUNNING', 'COMPLETED');--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "clients_tenant_idx" ON "clients" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "clients_owner_idx" ON "clients" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "clients_tenant_created_at_idx" ON "clients" USING btree ("tenant_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "clients_owner_created_at_idx" ON "clients" USING btree ("owner_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "clients_status_idx" ON "clients" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "clients_owner_primary_email_unique_idx" ON "clients" USING btree ("owner_id",lower(trim(("primary_contact"->>'email')))) WHERE "clients"."primary_contact" IS NOT NULL AND trim(("clients"."primary_contact"->>'email')) <> '';--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "clients_owner_tax_id_unique_idx" ON "clients" USING btree ("owner_id",("billing_details"->>'taxRegistrationId')) WHERE "clients"."billing_details" IS NOT NULL AND trim(("clients"."billing_details"->>'taxRegistrationId')) <> '';--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "job_imports" ADD CONSTRAINT "job_imports_client_id_tenant_id_clients_id_tenant_id_fk" FOREIGN KEY ("client_id","tenant_id") REFERENCES "public"."clients"("id","tenant_id") ON DELETE restrict ON UPDATE no action;
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
CREATE INDEX IF NOT EXISTS "job_imports_tenant_client_idx" ON "job_imports" USING btree ("tenant_id","client_id");