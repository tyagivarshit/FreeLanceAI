import { timestamp, uuid } from "drizzle-orm/pg-core";
/**
 * Tenant ID helper column for Row-Level Security (RLS) and data isolation.
 * Every multi-tenant user-facing table must include this column.
 */
export const tenantIdColumn = {
    tenantId: uuid("tenant_id").notNull(),
};
/**
 * Primary key definition utilizing standard PostgreSQL UUID structure.
 * Every table must use a standard UUID structure as its primary key.
 */
export const primaryKeyColumn = (name = "id") => ({
    [name]: uuid(name).defaultRandom().primaryKey(),
});
/**
 * Audit timestamp columns recorded automatically on insert and updates.
 */
export const auditTimestamps = {
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
};
//# sourceMappingURL=helpers.js.map