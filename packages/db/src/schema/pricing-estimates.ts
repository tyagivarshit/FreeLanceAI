import { pgTable, text, numeric, unique, jsonb } from "drizzle-orm/pg-core";
import { primaryKeyColumn, auditTimestamps } from "./helpers.js";

export const clientProjectPricingEstimates = pgTable(
  "client_project_pricing_estimates",
  {
    ...primaryKeyColumn(),
    tenantId: text("tenant_id").notNull(),
    clientId: text("client_id").notNull(),
    currencyCode: text("currency_code").notNull().default("USD"),
    
    // Strict precision mapping to hardware-level numeric blocks to prevent IEEE 754 precision loss
    estimatedBudget: numeric("estimated_budget", { precision: 12, scale: 2 }).notNull().default("0.00"),
    hourlyTargetRate: numeric("hourly_target_rate", { precision: 12, scale: 2 }).notNull().default("0.00"),
    platformMarkup: numeric("platform_markup", { precision: 12, scale: 2 }).notNull().default("0.00"),
    totalEstimatedValue: numeric("total_estimated_value", { precision: 12, scale: 2 }).notNull().default("0.00"),
    
    pricingMetadata: jsonb("pricing_metadata").notNull().default({}),
    ...auditTimestamps,
  },
  (table) => ({
    // Strict composite unique index permanently blocking cross-tenant margin bleed
    pricingEstimatesTenantClientUnique: unique("pricing_estimates_tenant_client_unique").on(
      table.tenantId,
      table.clientId
    ),
  })
);

export type ClientProjectPricingEstimateRow = typeof clientProjectPricingEstimates.$inferSelect;
export type ClientProjectPricingEstimateInsert = typeof clientProjectPricingEstimates.$inferInsert;
