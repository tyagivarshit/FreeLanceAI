import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { pool } from "../client.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const migrationsDir = join(__dirname, "../../migrations");

let migrationsApplied = false;

/**
 * Applies SQL migrations idempotently for PostgreSQL integration verification.
 * Reuses the 11A-B1-V pattern: real PostgreSQL, not in-memory substitutes.
 */
export async function ensureMigrationsApplied(): Promise<void> {
  if (migrationsApplied) {
    return;
  }

  const journalPath = join(migrationsDir, "meta/_journal.json");
  const journal = JSON.parse(readFileSync(journalPath, "utf8")) as {
    entries: Array<{ tag: string }>;
  };

  for (const entry of journal.entries) {
    const sqlPath = join(migrationsDir, `${entry.tag}.sql`);
    const sqlContent = readFileSync(sqlPath, "utf8");
    const statements = sqlContent.split("--> statement-breakpoint");

    for (const statement of statements) {
      const trimmed = statement.trim();
      if (trimmed.length > 0) {
        try {
          await pool.query(trimmed);
        } catch (error: unknown) {
          // Idempotent ignore: relation/index/type/constraint already exists
          const errorCode =
            error && typeof error === "object" && "code" in error
              ? String((error as { code: unknown }).code)
              : undefined;
          if (errorCode && ["42P07", "42710", "42701", "42P06", "42723"].includes(errorCode)) {
            continue;
          }
          throw error;
        }
      }
    }
  }

  migrationsApplied = true;
}

export async function isPostgresAvailable(): Promise<boolean> {
  try {
    const client = await pool.connect();
    try {
      await client.query("SELECT 1");
      return true;
    } finally {
      client.release();
    }
  } catch {
    return false;
  }
}

export async function truncateClientDomainTables(): Promise<void> {
  await pool.query(`
    TRUNCATE TABLE
      brain_analyses,
      timeline_entries,
      client_timelines,
      job_matches,
      job_imports,
      clients
    RESTART IDENTITY CASCADE
  `);
}

export async function deleteTestUsers(userIds: string[]): Promise<void> {
  if (userIds.length === 0) {
    return;
  }
  await pool.query(`DELETE FROM users WHERE id = ANY($1::uuid[])`, [userIds]);
}

export function listMigrationFiles(): string[] {
  return readdirSync(migrationsDir).filter((f) => f.endsWith(".sql"));
}
