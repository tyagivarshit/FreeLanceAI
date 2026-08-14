import {
  pgTable,
  varchar,
  pgEnum,
  uuid,
  uniqueIndex,
  index,
  jsonb,
  foreignKey,
} from "drizzle-orm/pg-core";
import { users } from "./auth.js";
import { jobImports } from "./jobs.js";
import { auditTimestamps } from "./helpers.js";

// 1. Job Match Lifecycle Enum
export const jobMatchLifecycleEnum = pgEnum("job_match_lifecycle", [
  "CREATED",
  "EVALUATED",
  "ARCHIVED",
]);

// 2. Job Matches Table (corresponds to JobMatch Aggregate Root)
export const jobMatches = pgTable(
  "job_matches",
  {
    id: uuid("id").primaryKey(),
    tenantId: uuid("tenant_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    ownerId: uuid("owner_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    freelancerId: uuid("freelancer_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    jobId: uuid("job_id").notNull(),
    jobNormalizationId: varchar("job_normalization_id", { length: 255 }).notNull(),
    normalizationVersion: varchar("normalization_version", { length: 50 }).notNull(),
    jobEmbeddingId: varchar("job_embedding_id", { length: 255 }),
    embeddingVersion: varchar("embedding_version", { length: 50 }),
    matchingVersion: varchar("matching_version", { length: 50 }).notNull(),
    matchSignals: jsonb("match_signals"),
    status: jobMatchLifecycleEnum("status").notNull(),
    snapshots: jsonb("snapshots").default([]).notNull(),
    ...auditTimestamps,
  },
  (table) => {
    return {
      // Enforce composite foreign key relation (jobId, tenantId) references job_imports(id, tenantId)
      // This mathematically guarantees database-level tenant isolation (a match cannot reference another tenant's job)
      tenantJobRelationFk: foreignKey({
        columns: [table.jobId, table.tenantId],
        foreignColumns: [jobImports.id, jobImports.tenantId],
      }).onDelete("cascade"),

      // Uniqueness rule: one match per tenant + freelancer + job + matchingVersion
      matchingIdentityIdx: uniqueIndex("job_matches_matching_identity_unique_idx").on(
        table.tenantId,
        table.freelancerId,
        table.jobId,
        table.matchingVersion,
      ),

      // Performance indexing for fast dashboard queries and stats
      tenantIdx: index("job_matches_tenant_idx").on(table.tenantId),
      freelancerIdx: index("job_matches_freelancer_idx").on(table.freelancerId),
      jobIdx: index("job_matches_job_idx").on(table.jobId),
      statusIdx: index("job_matches_status_idx").on(table.status),
    };
  },
);
