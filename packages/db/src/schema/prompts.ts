import { pgTable, pgEnum, uuid, varchar, jsonb, uniqueIndex, index } from "drizzle-orm/pg-core";
import { users } from "./auth.js";
import { auditTimestamps } from "./helpers.js";

export const promptStatusEnum = pgEnum("prompt_status", ["Draft", "Validated", "Published", "Archived", "Deprecated"]);

export const prompts = pgTable("prompts", {
  id: uuid("id").primaryKey(),
  tenantId: uuid("tenant_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  ownerId: uuid("owner_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  reference: varchar("reference", { length: 255 }).notNull(),
  definition: jsonb("definition").notNull(),
  metadata: jsonb("metadata").notNull(),
  visibility: jsonb("visibility").notNull(),
  status: promptStatusEnum("status").notNull(),
  versions: jsonb("versions").notNull().default('[]'),
  ...auditTimestamps,
}, (table) => ({
  tenantIdx: index("prompts_tenant_idx").on(table.tenantId),
  referenceUniqueIdx: uniqueIndex("prompts_tenant_reference_unique_idx").on(table.tenantId, table.reference),
}));
