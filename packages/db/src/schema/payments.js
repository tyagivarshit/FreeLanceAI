import { pgTable, varchar, integer, uuid, uniqueIndex, index } from "drizzle-orm/pg-core";
import { users } from "./auth.js";
import { clients } from "./clients.js";
import { auditTimestamps } from "./helpers.js";
export const payments = pgTable("payments", {
    id: uuid("id").primaryKey(),
    tenantId: uuid("tenant_id")
        .references(() => users.id, { onDelete: "restrict" })
        .notNull(),
    ownerId: uuid("owner_id")
        .references(() => users.id, { onDelete: "set null" }),
    clientId: uuid("client_id")
        .references(() => clients.id, { onDelete: "cascade" })
        .notNull(),
    amount: integer("amount").notNull(),
    currency: varchar("currency", { length: 3 }).notNull(),
    status: varchar("status", { length: 50 }).notNull(),
    paymentReference: varchar("payment_reference", { length: 255 }).notNull(),
    ...auditTimestamps,
}, (table) => {
    return {
        tenantReferenceUnique: uniqueIndex("payments_tenant_ref_unique").on(table.tenantId, table.paymentReference),
        clientIdx: index("payments_client_idx").on(table.clientId),
        tenantIdx: index("payments_tenant_idx").on(table.tenantId),
    };
});
