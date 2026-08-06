import { db } from "./client.js";
/**
 * Executes a callback within a database transaction boundary.
 * Wraps Drizzle ORM transactions. Nested calls automatically translate
 * to PostgreSQL SAVEPOINT commands.
 */
export async function runInTransaction(callback, options) {
    return await db.transaction(async (drizzleTx) => {
        // Cast the internal ORM transaction handle to our opaque context type
        return await callback(drizzleTx);
    }, options);
}
//# sourceMappingURL=transaction.js.map