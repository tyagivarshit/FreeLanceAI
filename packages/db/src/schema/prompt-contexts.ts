import {
  pgTable,
  pgEnum,
  uuid,
  varchar,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { users } from "./auth.js";
import { auditTimestamps } from "./helpers.js";

// 1. Context Status Enum
export const contextStatusEnum = pgEnum("context_status", [
  "Draft",
  "Validated",
  "Published",
  "Archived",
]);

// 2. Prompt Contexts Table
export const promptContexts = pgTable(
  "prompt_contexts",
  {
    id: uuid("id").primaryKey(),
    tenantId: uuid("tenant_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    ownerId: uuid("owner_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    reference: varchar("reference", { length: 255 }).notNull(),
    blueprint: jsonb("blueprint").notNull(),
    metadata: jsonb("metadata").notNull(),
    assemblyRules: jsonb("assembly_rules").default([]).notNull(),
    sourceReferences: jsonb("source_references").default([]).notNull(),
    status: contextStatusEnum("status").default("Draft").notNull(),
    ...auditTimestamps,
  },
  (table) => {
    return {
      // Composite Unique Index for fast lookup by tenant
      tenantReferenceUniqueIdx: uniqueIndex("prompt_contexts_tenant_ref_idx").on(
        table.tenantId,
        table.reference,
      ),
      // Strict GIN Index on JSONB for dynamic search without sequential scans
      sourceReferencesGinIdx: index("prompt_contexts_source_ref_gin_idx").using(
        "gin",
        table.sourceReferences,
      ),
    };
  },
);

export type PromptContextRow = typeof promptContexts.$inferSelect;
export type PromptContextInsert = typeof promptContexts.$inferInsert;
