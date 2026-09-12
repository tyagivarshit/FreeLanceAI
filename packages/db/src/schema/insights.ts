import { pgTable, varchar, text, uniqueIndex, integer } from "drizzle-orm/pg-core";
import { tenantIdColumn, primaryKeyColumn, auditTimestamps } from "./helpers.js";
import { clients } from "./clients.js";

export const clientInsights = pgTable(
  "client_insights",
  {
    ...primaryKeyColumn(),
    ...tenantIdColumn,
    clientId: varchar("client_id", { length: 255 })
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    
    // Deterministic key to prevent duplicate insights (e.g. 'CHURN_RISK', 'UPSELL_OPPORTUNITY')
    insightKey: varchar("insight_key", { length: 100 }).notNull(),
    
    title: text("title").notNull(),
    description: text("description").notNull(),
    
    // Confidence score 0-100
    confidenceScore: integer("confidence_score").notNull().default(0),
    
    // Status (e.g. ACTIVE, RESOLVED, DISMISSED)
    status: varchar("status", { length: 50 }).notNull().default("ACTIVE"),
    
    ...auditTimestamps,
  },
  (table) => ({
    // Strict Structural Guarantee against Cross-Tenant leakage and Duplicate Insight Types per client
    tenantClientInsightIdx: uniqueIndex("idx_tenant_client_insight").on(
      table.tenantId,
      table.clientId,
      table.insightKey
    ),
  })
);

export type ClientInsightRow = typeof clientInsights.$inferSelect;
export type ClientInsightInsert = typeof clientInsights.$inferInsert;
