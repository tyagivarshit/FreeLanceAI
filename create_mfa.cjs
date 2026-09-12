const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgres://postgres:postgres_password_local@localhost:5433/freelanceos_dev' });
const sql = `
CREATE TABLE IF NOT EXISTS "user_mfa_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"totp_secret" varchar(255),
	"backup_codes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_mfa_settings_user_id_unique" UNIQUE("user_id")
);
DO $$ BEGIN
 ALTER TABLE "user_mfa_settings" ADD CONSTRAINT "user_mfa_settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
`;
pool.query(sql).then(() => console.log('MFA TABLE CREATED')).catch(console.error).finally(() => pool.end());
