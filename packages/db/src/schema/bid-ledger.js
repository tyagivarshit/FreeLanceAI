import { pgTable, text, numeric, uniqueIndex } from "drizzle-orm/pg-core";
import { primaryKeyColumn, auditTimestamps } from "./helpers.js";
export const bidLedgerEntries = pgTable("bid_ledger_entries", {
    ...primaryKeyColumn(),
    tenantId: text("tenant_id").notNull(),
    bidId: text("bid_id").notNull(),
    transactionVersion: text("transaction_version").notNull(),
    // Strict Drizzle native numeric mapping to bypass IEEE 754 precision drift
    bidAmount: numeric("bid_amount", { precision: 12, scale: 4 }).notNull(),
    conversionMultiplier: numeric("conversion_multiplier", { precision: 12, scale: 4 }).notNull(),
    finalPlatformCost: numeric("final_platform_cost", { precision: 12, scale: 4 }).notNull(),
    baseCurrency: text("base_currency").notNull(),
    targetCurrency: text("target_currency").notNull(),
    ...auditTimestamps,
}, (table) => ({
    // Hard composite unique index at the hardware layer blocking concurrent double-entry row injection
    bidLedgerConcurrencyGuard: uniqueIndex("bid_ledger_concurrency_guard_idx").on(table.tenantId, table.bidId, table.transactionVersion),
}));
