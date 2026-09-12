import { pgTable, pgEnum, uuid, varchar, jsonb, index } from "drizzle-orm/pg-core";
import { users } from "./auth.js";
import { auditTimestamps } from "./helpers.js";

export const aiRequestStatusEnum = pgEnum("ai_request_status", ["Received", "Accepted", "Orchestrating", "Completed", "Failed"]);

export const aiGatewayLogs = pgTable("ai_gateway_logs", {
  id: uuid("id").primaryKey(),
  tenantId: uuid("tenant_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  ownerId: uuid("owner_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  requestContextReference: varchar("request_context_reference", { length: 255 }).notNull(),
  metadata: jsonb("metadata").notNull(),
  status: aiRequestStatusEnum("status").notNull(),
  ...auditTimestamps,
}, (table) => ({
  tenantIdx: index("ai_gateway_tenant_idx").on(table.tenantId),
  referenceIdx: index("ai_gateway_ref_idx").on(table.tenantId, table.requestContextReference),
}));
