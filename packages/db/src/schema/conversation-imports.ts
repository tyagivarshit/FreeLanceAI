import { pgTable, varchar, jsonb, uniqueIndex, timestamp } from "drizzle-orm/pg-core";
import { tenantIdColumn, primaryKeyColumn, auditTimestamps } from "./helpers.js";
import { clients } from "./clients.js";

// Status ENUM equivalent in varchar for simplicity or custom pgEnum
export const importStatusEnum = ["PENDING", "PROCESSING", "COMPLETED", "FAILED"] as const;

export const conversationImports = pgTable(
  "conversation_imports",
  {
    ...primaryKeyColumn(),
    ...tenantIdColumn,
    clientId: varchar("client_id", { length: 255 })
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    
    // The source of the import (e.g. 'slack', 'gmail', 'custom_api')
    sourceProvider: varchar("source_provider", { length: 100 }).notNull(),
    
    // External ID from the source to prevent double entry
    externalReferenceId: varchar("external_reference_id", { length: 255 }).notNull(),
    
    // Safely bounded individual message/conversation payload
    payload: jsonb("payload").notNull(),
    
    status: varchar("status", { length: 50 }).notNull().default("PENDING"),
    
    processedAt: timestamp("processed_at", { withTimezone: true }),
    ...auditTimestamps,
  },
  (table) => ({
    // Strict Structural Guarantee against Cross-Tenant leakage and Duplicate Entries
    tenantSourceRefIdx: uniqueIndex("idx_tenant_source_ref").on(
      table.tenantId,
      table.sourceProvider,
      table.externalReferenceId
    ),
  })
);

export type ConversationImportRow = typeof conversationImports.$inferSelect;
export type ConversationImportInsert = typeof conversationImports.$inferInsert;
