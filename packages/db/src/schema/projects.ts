import {
  pgTable,
  pgEnum,
  uuid,
  varchar,
  jsonb,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { users } from "./auth.js";
import { clients } from "./clients.js";
import { auditTimestamps } from "./helpers.js";

// Canonical Project lifecycle states from Phase 9 Project aggregate
export const projectStatusEnum = pgEnum("project_status", [
  "Draft",
  "Planned",
  "Active",
  "Paused",
  "Completed",
  "Cancelled",
  "Archived",
]);

export const projects = pgTable(
  "projects",
  {
    id: uuid("id").primaryKey(),
    tenantId: uuid("tenant_id")
      .references(() => users.id, { onDelete: "restrict" })
      .notNull(),
    clientId: uuid("client_id")
      .references(() => clients.id, { onDelete: "cascade" })
      .notNull(),
    ownerId: uuid("owner_id")
      .references(() => users.id, { onDelete: "restrict" })
      .notNull(),
    projectReference: varchar("project_reference", { length: 255 }).notNull(),
    metadata: jsonb("metadata").notNull(),
    visibility: jsonb("visibility").notNull(),
    status: projectStatusEnum("status").notNull(),
    ...auditTimestamps,
  },
  (table) => {
    return {
      tenantReferenceUniqueIdx: uniqueIndex("projects_tenant_reference_unique_idx").on(
        table.tenantId,
        table.projectReference,
      ),
      tenantIdx: index("projects_tenant_idx").on(table.tenantId),
      clientIdx: index("projects_client_idx").on(table.clientId),
      ownerIdx: index("projects_owner_idx").on(table.ownerId),
      statusIdx: index("projects_status_idx").on(table.status),
    };
  },
);

export type ProjectRow = typeof projects.$inferSelect;
export type ProjectInsert = typeof projects.$inferInsert;
