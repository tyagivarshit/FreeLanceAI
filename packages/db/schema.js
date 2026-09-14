import { pgTable, text, timestamp, jsonb, integer, index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
export const promptCompositions = pgTable("prompt_compositions", {
    id: text("id").primaryKey().default(sql `gen_random_uuid()`),
    tenantId: text("tenant_id").notNull(),
    blueprintKey: text("blueprint_key").notNull(),
    version: integer("version").notNull().default(1),
    isActive: integer("is_active").notNull().default(1),
    pipelineLayout: jsonb("pipeline_layout").default({}).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => {
    return {
        tenantBlueprintIdx: index("prompt_compositions_tenant_blueprint_idx").on(table.tenantId, table.blueprintKey),
        activeVersionIdx: index("prompt_compositions_active_idx").on(table.tenantId, table.blueprintKey, table.isActive)
    };
});
