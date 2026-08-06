import { db } from "./client.js";

// Opaque context type representing the transaction boundary.
// Hidden from outer packages to maintain implementation independence.
export type TransactionContext = {
  readonly __brand: unique symbol;
};

// Internal representation mapping Drizzle transaction instance
export type DrizzleTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export type IsolationLevel =
  | "read uncommitted"
  | "read committed"
  | "repeatable read"
  | "serializable";

export interface TransactionOptions {
  isolationLevel?: IsolationLevel;
}

/**
 * Executes a callback within a database transaction boundary.
 * Wraps Drizzle ORM transactions. Nested calls automatically translate
 * to PostgreSQL SAVEPOINT commands.
 */
export async function runInTransaction<T>(
  callback: (tx: TransactionContext) => Promise<T>,
  options?: TransactionOptions,
): Promise<T> {
  return await db.transaction(async (drizzleTx) => {
    // Cast the internal ORM transaction handle to our opaque context type
    return await callback(drizzleTx as unknown as TransactionContext);
  }, options);
}
