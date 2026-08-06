import pg from "pg";
export declare const pool: pg.Pool;
export declare const db: import("drizzle-orm/node-postgres").NodePgDatabase<Record<string, never>>;
/**
 * Validates database connectivity on process startup.
 * Runs a simple 'SELECT 1;' query to verify network connectivity and credentials.
 * It intentionally bypasses schema validations which are handled during migrations.
 * Throws a startup error if PostgreSQL is unreachable.
 */
export declare function verifyConnection(): Promise<void>;
/**
 * Closes the database pool and releases all socket connections.
 * Triggered on SIGTERM / SIGINT graceful shutdowns.
 */
export declare function closeDatabaseConnection(): Promise<void>;
//# sourceMappingURL=client.d.ts.map