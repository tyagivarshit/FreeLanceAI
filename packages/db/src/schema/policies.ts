import { pgTable, pgEnum, uuid, varchar, jsonb, uniqueIndex, index } from "drizzle-orm/pg-core";
import { users } from "./auth.js";
import { auditTimestamps } from "./helpers.js";

export const policyStatusEnum = pgEnum("policy_status", ["Draft", "Validated", "Published", "Archived"]);

export const policies = pgTable("policies", {
  id: uuid("id").primaryKey(),
  tenantId: uuid("tenant_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  ownerId: uuid("owner_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  reference: varchar("reference", { length: 255 }).notNull(),
  definition: jsonb("definition").notNull(),
  metadata: jsonb("metadata").notNull(),
  ruleSet: jsonb("rule_set").notNull(),
  evaluationResult: jsonb("evaluation_result"),
  decisionFingerprint: jsonb("decision_fingerprint"),
  snapshots: jsonb("snapshots").notNull().default('[]'),
  status: policyStatusEnum("status").notNull(),
  ...auditTimestamps,
}, (table) => ({
  tenantIdx: index("policies_tenant_idx").on(table.tenantId),
  referenceUniqueIdx: uniqueIndex("policies_tenant_reference_unique_idx").on(table.tenantId, table.reference),
}));
