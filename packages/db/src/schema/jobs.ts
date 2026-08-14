import {
  pgTable,
  varchar,
  timestamp,
  text,
  pgEnum,
  uuid,
  uniqueIndex,
  index,
  jsonb,
  unique,
} from "drizzle-orm/pg-core";
import { users } from "./auth.js";
import { auditTimestamps } from "./helpers.js";

// 1. Job Import Status Lifecycle Enum
export const jobImportStatusEnum = pgEnum("job_import_status", [
  "RECEIVED",
  "IMPORTED",
  "ARCHIVED",
]);

// 2. Job Imports Table (corresponds to JobImport Aggregate Root)
export const jobImports = pgTable(
  "job_imports",
  {
    id: uuid("id").primaryKey(),
    tenantId: uuid("tenant_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    ownerId: uuid("owner_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    source: varchar("source", { length: 50 }).notNull(),
    externalJobId: varchar("external_job_id", { length: 255 }).notNull(),
    sourceUrl: text("source_url"),
    importedAt: timestamp("imported_at", { withTimezone: true }).notNull(),
    rawPayload: jsonb("raw_payload").notNull(),
    fingerprint: varchar("fingerprint", { length: 255 }).notNull(),
    status: jobImportStatusEnum("status").notNull(),
    snapshots: jsonb("snapshots").default([]).notNull(),
    ...auditTimestamps,
  },
  (table) => {
    return {
      // Uniqueness rule: source + externalJobId per tenant to prevent duplication
      tenantSourceExternalIdx: uniqueIndex("job_imports_tenant_source_external_unique_idx").on(
        table.tenantId,
        table.source,
        table.externalJobId,
      ),
      // Composite unique constraint to support composite foreign key checks from dependent entities
      idTenantUnique: unique("job_imports_id_tenant_unique").on(table.id, table.tenantId),
      // Bounded indexes for fast dashboard lookups and filters
      tenantIdx: index("job_imports_tenant_idx").on(table.tenantId),
      tenantCreatedAtIdx: index("job_imports_tenant_created_at_idx").on(
        table.tenantId,
        table.createdAt,
      ),
      sourceIdx: index("job_imports_source_idx").on(table.source),
      externalJobIdIdx: index("job_imports_external_job_id_idx").on(table.externalJobId),
      statusIdx: index("job_imports_status_idx").on(table.status),
    };
  },
);
