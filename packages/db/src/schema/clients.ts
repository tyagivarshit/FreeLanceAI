import {
  pgTable,
  pgEnum,
  uuid,
  timestamp,
  jsonb,
  uniqueIndex,
  index,
  unique,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { users } from "./auth.js";
import { auditTimestamps } from "./helpers.js";

// Canonical Client lifecycle states from Phase 8 Client aggregate
export const clientStatusEnum = pgEnum("client_status", [
  "Lead",
  "Active",
  "Suspended",
  "Archived",
  "Closed",
]);

export const clients = pgTable(
  "clients",
  {
    id: uuid("id").primaryKey(),
    tenantId: uuid("tenant_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    ownerId: uuid("owner_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    status: clientStatusEnum("status").notNull(),
    profile: jsonb("profile").notNull(),
    billingDetails: jsonb("billing_details"),
    primaryContact: jsonb("primary_contact"),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    suspendedAt: timestamp("suspended_at", { withTimezone: true }),
    ...auditTimestamps,
  },
  (table) => {
    return {
      idTenantUnique: unique("clients_id_tenant_unique").on(table.id, table.tenantId),
      idOwnerUnique: unique("clients_id_owner_unique").on(table.id, table.ownerId),
      tenantIdx: index("clients_tenant_idx").on(table.tenantId),
      ownerIdx: index("clients_owner_idx").on(table.ownerId),
      tenantCreatedAtIdx: index("clients_tenant_created_at_idx").on(
        table.tenantId,
        table.createdAt,
      ),
      ownerCreatedAtIdx: index("clients_owner_created_at_idx").on(table.ownerId, table.createdAt),
      statusIdx: index("clients_status_idx").on(table.status),
      ownerEmailUniqueIdx: uniqueIndex("clients_owner_primary_email_unique_idx")
        .on(table.ownerId, sql`lower(trim(${table.primaryContact}->>'email'))`)
        .where(
          sql`${table.primaryContact} IS NOT NULL AND trim(${table.primaryContact}->>'email') <> ''`,
        ),
      ownerTaxIdUniqueIdx: uniqueIndex("clients_owner_tax_id_unique_idx")
        .on(table.ownerId, sql`${table.billingDetails}->>'taxRegistrationId'`)
        .where(
          sql`${table.billingDetails} IS NOT NULL AND trim(${table.billingDetails}->>'taxRegistrationId') <> ''`,
        ),
    };
  },
);

export type ClientRow = typeof clients.$inferSelect;
export type ClientInsert = typeof clients.$inferInsert;
