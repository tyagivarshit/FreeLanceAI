import { pgTable, text, boolean, unique, jsonb } from "drizzle-orm/pg-core";
import { primaryKeyColumn, auditTimestamps } from "./helpers.js";
export const scopeComplianceRules = pgTable("scope_compliance_rules", {
    ...primaryKeyColumn(),
    tenantId: text("tenant_id").notNull(),
    ruleKey: text("rule_key").notNull(),
    description: text("description").notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    ...auditTimestamps,
}, (table) => ({
    // Strict composite unique index permanently blocking cross-tenant rule bleed
    scopeComplianceTenantRuleUnique: unique("scope_compliance_tenant_rule_unique").on(table.tenantId, table.ruleKey),
}));
export const scopeRuleViolationsLog = pgTable("scope_rule_violations_log", {
    ...primaryKeyColumn(),
    tenantId: text("tenant_id").notNull(),
    clientId: text("client_id").notNull(),
    ruleKey: text("rule_key").notNull(),
    violationContext: jsonb("violation_context").notNull().default({}),
    ...auditTimestamps,
});
