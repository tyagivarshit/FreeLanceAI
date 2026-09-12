import { pgTable, text, timestamp, jsonb } from "drizzle-orm/pg-core";

export const promptCompositions = pgTable("prompt_compositions", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull(),
  ownerId: text("owner_id").notNull(),
  reference: text("reference").notNull(),
  pipelineLayout: jsonb("pipeline_layout").default({}).notNull(),
  status: text("status").notNull().default("Draft"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
