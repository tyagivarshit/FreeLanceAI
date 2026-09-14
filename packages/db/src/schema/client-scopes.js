import { pgTable, text, unique, jsonb } from "drizzle-orm/pg-core";
import { primaryKeyColumn, auditTimestamps } from "./helpers.js";
export const clientScopes = pgTable("client_scopes", {
    ...primaryKeyColumn(),
    tenantId: text("tenant_id").notNull(),
    clientId: text("client_id").notNull(),
    projectSpecs: jsonb("project_specs").notNull().default({}),
    rawTextData: text("raw_text_data"),
    ...auditTimestamps,
}, (table) => ({
    // Strict composite unique index to block cross-tenant contamination
    clientScopesTenantClientUnique: unique("client_scopes_tenant_client_unique").on(table.tenantId, table.clientId),
}));
