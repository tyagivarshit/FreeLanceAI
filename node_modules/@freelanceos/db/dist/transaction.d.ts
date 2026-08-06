import { db } from "./client.js";
export type TransactionContext = {
    readonly __brand: unique symbol;
};
export type DrizzleTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
export type IsolationLevel = "read uncommitted" | "read committed" | "repeatable read" | "serializable";
export interface TransactionOptions {
    isolationLevel?: IsolationLevel;
}
/**
 * Executes a callback within a database transaction boundary.
 * Wraps Drizzle ORM transactions. Nested calls automatically translate
 * to PostgreSQL SAVEPOINT commands.
 */
export declare function runInTransaction<T>(callback: (tx: TransactionContext) => Promise<T>, options?: TransactionOptions): Promise<T>;
//# sourceMappingURL=transaction.d.ts.map