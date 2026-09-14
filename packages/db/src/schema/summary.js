import { pgTable, varchar, timestamp, text, uniqueIndex, integer } from "drizzle-orm/pg-core";
import { tenantIdColumn, primaryKeyColumn, auditTimestamps } from "./helpers.js";
import { clients } from "./clients.js";
export const clientSummaries = pgTable("client_summaries", {
    ...primaryKeyColumn(),
    ...tenantIdColumn,
    clientId: varchar("client_id", { length: 255 })
        .notNull()
        .references(() => clients.id, { onDelete: "cascade" }),
    // Core textual summary fields
    businessSummary: text("business_summary").notNull(),
    relationshipSummary: text("relationship_summary").notNull(),
    currentSituation: text("current_situation").notNull(),
    // Arrays stored as comma-separated or simple text to strictly avoid JSONB blobs
    knownGoals: text("known_goals"),
    knownConstraints: text("known_constraints"),
    openTopics: text("open_topics"),
    currentVersion: integer("current_version").notNull().default(1),
    ...auditTimestamps,
}, (table) => ({
    // Strict composite index to prevent cross-tenant data leakage
    tenantClientIdx: uniqueIndex("idx_tenant_client_summary").on(table.tenantId, table.clientId),
}));
export const clientSummarySnapshots = pgTable("client_summary_snapshots", {
    ...primaryKeyColumn(),
    ...tenantIdColumn,
    summaryId: varchar("summary_id", { length: 255 })
        .notNull()
        .references(() => clientSummaries.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    // Historical state
    businessSummary: text("business_summary").notNull(),
    relationshipSummary: text("relationship_summary").notNull(),
    currentSituation: text("current_situation").notNull(),
    knownGoals: text("known_goals"),
    knownConstraints: text("known_constraints"),
    openTopics: text("open_topics"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
    // Ensure no duplicate versions for the same summary
    summaryVersionIdx: uniqueIndex("idx_summary_version").on(table.summaryId, table.version),
}));
