DO $$ BEGIN
 CREATE TYPE "public"."job_import_status" AS ENUM('RECEIVED', 'IMPORTED', 'ARCHIVED');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."job_match_lifecycle" AS ENUM('CREATED', 'EVALUATED', 'ARCHIVED');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."timeline_event_category" AS ENUM('Lifecycle Event', 'Communication Event', 'Annotation Event', 'Status Event', 'Audit Event');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."timeline_status" AS ENUM('Initialized', 'Active', 'ReadOnly');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."visibility_classification" AS ENUM('Internal', 'Public');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "job_imports" (
	"id" uuid PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"owner_id" uuid NOT NULL,
	"source" varchar(50) NOT NULL,
	"external_job_id" varchar(255) NOT NULL,
	"source_url" text,
	"imported_at" timestamp with time zone NOT NULL,
	"raw_payload" jsonb NOT NULL,
	"fingerprint" varchar(255) NOT NULL,
	"status" "job_import_status" NOT NULL,
	"snapshots" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "job_imports_id_tenant_unique" UNIQUE("id","tenant_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "job_matches" (
	"id" uuid PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"owner_id" uuid NOT NULL,
	"freelancer_id" uuid NOT NULL,
	"job_id" uuid NOT NULL,
	"job_normalization_id" varchar(255) NOT NULL,
	"normalization_version" varchar(50) NOT NULL,
	"job_embedding_id" varchar(255),
	"embedding_version" varchar(50),
	"matching_version" varchar(50) NOT NULL,
	"match_signals" jsonb,
	"status" "job_match_lifecycle" NOT NULL,
	"snapshots" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "client_timelines" (
	"id" uuid PRIMARY KEY NOT NULL,
	"client_id" uuid NOT NULL,
	"owner_id" uuid NOT NULL,
	"status" "timeline_status" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "timeline_entries" (
	"id" uuid PRIMARY KEY NOT NULL,
	"timeline_id" uuid NOT NULL,
	"event_ref" varchar(255),
	"category" "timeline_event_category" NOT NULL,
	"timestamp" timestamp with time zone NOT NULL,
	"metadata" jsonb NOT NULL,
	"actor_ref" varchar(255) NOT NULL,
	"visibility" "visibility_classification" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "job_imports" ADD CONSTRAINT "job_imports_tenant_id_users_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "job_imports" ADD CONSTRAINT "job_imports_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "job_matches" ADD CONSTRAINT "job_matches_tenant_id_users_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "job_matches" ADD CONSTRAINT "job_matches_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "job_matches" ADD CONSTRAINT "job_matches_freelancer_id_users_id_fk" FOREIGN KEY ("freelancer_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "job_matches" ADD CONSTRAINT "job_matches_job_id_tenant_id_job_imports_id_tenant_id_fk" FOREIGN KEY ("job_id","tenant_id") REFERENCES "public"."job_imports"("id","tenant_id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "client_timelines" ADD CONSTRAINT "client_timelines_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "timeline_entries" ADD CONSTRAINT "timeline_entries_timeline_id_client_timelines_id_fk" FOREIGN KEY ("timeline_id") REFERENCES "public"."client_timelines"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "job_imports_tenant_source_external_unique_idx" ON "job_imports" USING btree ("tenant_id","source","external_job_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "job_imports_tenant_idx" ON "job_imports" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "job_imports_tenant_created_at_idx" ON "job_imports" USING btree ("tenant_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "job_imports_source_idx" ON "job_imports" USING btree ("source");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "job_imports_external_job_id_idx" ON "job_imports" USING btree ("external_job_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "job_imports_status_idx" ON "job_imports" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "job_matches_matching_identity_unique_idx" ON "job_matches" USING btree ("tenant_id","freelancer_id","job_id","matching_version");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "job_matches_tenant_idx" ON "job_matches" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "job_matches_freelancer_idx" ON "job_matches" USING btree ("freelancer_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "job_matches_job_idx" ON "job_matches" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "job_matches_status_idx" ON "job_matches" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "client_timelines_owner_idx" ON "client_timelines" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "client_timelines_client_owner_idx" ON "client_timelines" USING btree ("client_id","owner_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "timeline_entries_timeline_idx" ON "timeline_entries" USING btree ("timeline_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "timeline_entries_timeline_timestamp_idx" ON "timeline_entries" USING btree ("timeline_id","timestamp");