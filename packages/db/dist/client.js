import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { runtimeConfig } from "@freelanceos/config";
const { Pool } = pg;
// Runtime retry parameters for database connectivity verification
const RETRY_ATTEMPTS = 3;
const RETRY_DELAY_MS = 2000;
// Establish pool configuration parameters. These are MVP default values.
// Future production tuning will be driven by active container quotas and telemetry metrics.
const poolConfig = {
    connectionString: runtimeConfig.DATABASE_URL,
    max: 10, // Max concurrent connections allowed per instance
    idleTimeoutMillis: 30000, // Close idle connections after 30 seconds
    connectionTimeoutMillis: 5000, // Timeout connection attempts after 5 seconds
    maxUses: 7500, // Recycle connection socket after 7,500 operations to prevent memory leaks
};
export const pool = new Pool(poolConfig);
// Initialize the Drizzle compiler client wrapper. Kept internal to prevent public API leakage.
export const db = drizzle(pool);
// Listen to pool errors to prevent process crashes. direct console logging is a temporary MVP choice.
pool.on("error", (err) => {
    console.error("[Database Pool Error] Unexpected error on idle client:", err);
});
/**
 * Validates database connectivity on process startup.
 * Runs a simple 'SELECT 1;' query to verify network connectivity and credentials.
 * It intentionally bypasses schema validations which are handled during migrations.
 * Throws a startup error if PostgreSQL is unreachable.
 */
export async function verifyConnection() {
    let attempts = RETRY_ATTEMPTS;
    while (attempts > 0) {
        try {
            const client = await pool.connect();
            try {
                await client.query("SELECT 1;");
                console.log("[Database] Startup connection validation successful.");
                return;
            }
            finally {
                client.release();
            }
        }
        catch (error) {
            attempts--;
            console.warn(`[Database] Connection attempt failed. Remaining attempts: ${attempts}. Error:`, error instanceof Error ? error.message : error);
            if (attempts === 0) {
                throw new Error(`[Database Init Error] Database connection could not be established: ${error instanceof Error ? error.message : "Unknown error"}`);
            }
            await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
        }
    }
}
/**
 * Closes the database pool and releases all socket connections.
 * Triggered on SIGTERM / SIGINT graceful shutdowns.
 */
export async function closeDatabaseConnection() {
    console.log("[Database] Initiating database connection pool shutdown...");
    try {
        await pool.end();
        console.log("[Database] Database connection pool closed successfully.");
    }
    catch (error) {
        console.error("[Database Error] Error occurred during database pool closure:", error instanceof Error ? error.message : error);
        throw error;
    }
}
//# sourceMappingURL=client.js.map