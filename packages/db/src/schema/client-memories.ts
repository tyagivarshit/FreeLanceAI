import { pgTable, varchar, text, uniqueIndex, integer } from "drizzle-orm/pg-core";
import { tenantIdColumn, primaryKeyColumn, auditTimestamps } from "./helpers.js";
import { clients } from "./clients.js";

export const clientMemories = pgTable(
  "client_memories",
  {
    ...primaryKeyColumn(),
    ...tenantIdColumn,
    clientId: varchar("client_id", { length: 255 })
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    
    // Deterministic category for the memory (e.g. 'CORE_PROFILE', 'USER_PREFERENCES', 'STRATEGY')
    memoryKey: varchar("memory_key", { length: 100 }).notNull(),
    
    // The rolling buffer containing string-based historical facts/context
    contentBuffer: text("content_buffer").notNull(),
    
    // Optimistic Locking mechanism (Strict Concurrency Control)
    version: integer("version").notNull().default(1),
    
    ...auditTimestamps,
  },
  (table) => ({
    // Strict Structural Guarantee against Cross-Tenant leakage and duplicate memory streams
    tenantClientMemoryIdx: uniqueIndex("idx_tenant_client_memory").on(
      table.tenantId,
      table.clientId,
      table.memoryKey
    ),
  })
);

export type ClientMemoryRow = typeof clientMemories.$inferSelect;
export type ClientMemoryInsert = typeof clientMemories.$inferInsert;
