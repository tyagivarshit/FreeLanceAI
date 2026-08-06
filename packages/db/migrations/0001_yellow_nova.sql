ALTER TABLE "email_verifications" ALTER COLUMN "attempt_count" SET DEFAULT 0;--> statement-breakpoint
ALTER TABLE "password_resets" ALTER COLUMN "attempt_count" SET DEFAULT 0;--> statement-breakpoint
ALTER TABLE "sessions" ALTER COLUMN "rotation_counter" SET DEFAULT 0;--> statement-breakpoint
ALTER TABLE "user_password_hashes" ALTER COLUMN "credential_version" SET DEFAULT 1;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "status" SET DEFAULT 'pending';--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sessions_user_id_revoked_at_expires_at_idx" ON "sessions" USING btree ("user_id","revoked_at","expires_at");--> statement-breakpoint
ALTER TABLE "user_password_hashes" ADD CONSTRAINT "user_password_hashes_user_id_unique" UNIQUE("user_id");