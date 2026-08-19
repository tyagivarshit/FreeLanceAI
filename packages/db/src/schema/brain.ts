import {
  pgTable,
  pgEnum,
  uuid,
  varchar,
  text,
  jsonb,
  integer,
  timestamp,
  uniqueIndex,
  index,
  unique,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { users } from "./auth.js";
import { auditTimestamps } from "./helpers.js";

// 1. Brain Analysis Status Enum
export const brainAnalysisStatusEnum = pgEnum("brain_analysis_status", [
  "REQUESTED",
  "RUNNING",
  "COMPLETED",
  "FAILED",
  "TIMEOUT",
  "INSUFFICIENT_CONTEXT",
]);

// 2. Brain Analyses Table
export const brainAnalyses = pgTable(
  "brain_analyses",
  {
    id: uuid("id").primaryKey(),
    tenantId: uuid("tenant_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    ownerId: uuid("owner_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    actorId: uuid("actor_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    analysisType: varchar("analysis_type", { length: 64 }).notNull(),
    status: brainAnalysisStatusEnum("status").notNull(),
    idempotencyKey: varchar("idempotency_key", { length: 128 }),
    correlationId: varchar("correlation_id", { length: 128 }).notNull(),
    summary: text("summary"),
    insights: jsonb("insights").default([]).notNull(),
    recommendations: jsonb("recommendations").default([]).notNull(),
    confidence: jsonb("confidence"),
    evidence: jsonb("evidence").default([]).notNull(),
    failure: jsonb("failure"),
    metadata: jsonb("metadata"),
    constraints: jsonb("constraints").default({}).notNull(),
    attemptCount: integer("attempt_count").default(0).notNull(),
    maxAttempts: integer("max_attempts").default(3).notNull(),
    claimedAt: timestamp("claimed_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    failedAt: timestamp("failed_at", { withTimezone: true }),
    staleTimeoutMs: integer("stale_timeout_ms").default(30000).notNull(),
    ...auditTimestamps,
  },
  (table) => {
    return {
      // Database-level tenant and owner isolation constraints
      idTenantUnique: unique("brain_analyses_id_tenant_unique").on(table.id, table.tenantId),
      idOwnerUnique: unique("brain_analyses_id_owner_unique").on(table.id, table.ownerId),

      // Performance indexing for tenant/owner scoped queries
      tenantIdx: index("brain_analyses_tenant_idx").on(table.tenantId),
      ownerIdx: index("brain_analyses_owner_idx").on(table.ownerId),
      statusIdx: index("brain_analyses_status_idx").on(table.status),
      claimedAtIdx: index("brain_analyses_claimed_at_idx").on(table.claimedAt),
      tenantCreatedAtIdx: index("brain_analyses_tenant_created_at_idx").on(
        table.tenantId,
        table.createdAt,
      ),

      // Atomic idempotency enforcement: prevents duplicate authoritative/in-flight executions
      ownerIdempotencyUniqueIdx: uniqueIndex("brain_analyses_owner_idempotency_unique_idx")
        .on(table.tenantId, table.ownerId, table.analysisType, table.idempotencyKey)
        .where(
          sql`${table.idempotencyKey} IS NOT NULL AND ${table.status} IN ('REQUESTED', 'RUNNING', 'COMPLETED')`,
        ),
    };
  },
);

export type BrainAnalysisRow = typeof brainAnalyses.$inferSelect;
export type BrainAnalysisInsert = typeof brainAnalyses.$inferInsert;
