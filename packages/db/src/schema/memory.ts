import { pgTable, pgEnum, uuid, varchar, jsonb, uniqueIndex, index } from "drizzle-orm/pg-core";
import { users } from "./auth.js";
import { auditTimestamps } from "./helpers.js";

export const memoryStatusEnum = pgEnum("memory_status", ["Draft", "Validated", "Published", "Archived"]);

export const memory = pgTable("memory", {
  id: uuid("id").primaryKey(),
  tenantId: uuid("tenant_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  ownerId: uuid("owner_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  reference: varchar("reference", { length: 255 }).notNull(),
  metadata: jsonb("metadata").notNull(),
  retentionRules: jsonb("retention_rules").notNull().default('[]'),
  snapshots: jsonb("snapshots").notNull().default('[]'),
  status: memoryStatusEnum("status").notNull(),
  ...auditTimestamps,
}, (table) => ({
  tenantIdx: index("memory_tenant_idx").on(table.tenantId),
  referenceUniqueIdx: uniqueIndex("memory_tenant_reference_unique_idx").on(table.tenantId, table.reference),
}));
