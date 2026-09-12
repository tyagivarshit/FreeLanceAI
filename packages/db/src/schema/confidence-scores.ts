import { pgTable, text, integer, numeric, unique, jsonb } from "drizzle-orm/pg-core";
import { primaryKeyColumn, auditTimestamps } from "./helpers.js";

export const clientScopeConfidenceScores = pgTable(
  "client_scope_confidence_scores",
  {
    ...primaryKeyColumn(),
    tenantId: text("tenant_id").notNull(),
    clientId: text("client_id").notNull(),
    baseScore: integer("base_score").notNull().default(0), // Raw tracking integer score 0-100
    confidenceWeight: numeric("confidence_weight", { precision: 5, scale: 4 }).notNull().default("1.0000"), // Floating point weight e.g. 0.9500
    adjustedScore: numeric("adjusted_score", { precision: 8, scale: 4 }).notNull().default("0.0000"), // final calculated floating point score
    validationMetadata: jsonb("validation_metadata").notNull().default({}),
    ...auditTimestamps,
  },
  (table) => ({
    // Strict composite unique index permanently blocking cross-tenant algorithmic weight bleed
    confidenceScoresTenantClientUnique: unique("confidence_scores_tenant_client_unique").on(
      table.tenantId,
      table.clientId
    ),
  })
);

export type ClientScopeConfidenceScoreRow = typeof clientScopeConfidenceScores.$inferSelect;
export type ClientScopeConfidenceScoreInsert = typeof clientScopeConfidenceScores.$inferInsert;
