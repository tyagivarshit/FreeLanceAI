DO $$ BEGIN
 CREATE TYPE "public"."brain_analysis_status" AS ENUM('REQUESTED', 'RUNNING', 'COMPLETED', 'FAILED', 'TIMEOUT', 'INSUFFICIENT_CONTEXT');
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
CREATE INDEX IF NOT EXISTS "brain_analyses_tenant_idx" ON "brain_analyses" USING btree ("tenant_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "brain_analyses_owner_idx" ON "brain_analyses" USING btree ("owner_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "brain_analyses_status_idx" ON "brain_analyses" USING btree ("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "brain_analyses_claimed_at_idx" ON "brain_analyses" USING btree ("claimed_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "brain_analyses_tenant_created_at_idx" ON "brain_analyses" USING btree ("tenant_id","created_at");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "brain_analyses_owner_idempotency_unique_idx" ON "brain_analyses" USING btree ("tenant_id","owner_id","analysis_type","idempotency_key") WHERE "idempotency_key" IS NOT NULL AND "status" IN ('REQUESTED', 'RUNNING', 'COMPLETED');
