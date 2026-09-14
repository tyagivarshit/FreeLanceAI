import { pgTable, varchar, timestamp, jsonb, pgEnum } from "drizzle-orm/pg-core";
import { tenantIdColumn, primaryKeyColumn, auditTimestamps } from "./helpers.js";
// Outbox Event Status Enum
export const outboxEventStatusEnum = pgEnum("outbox_event_status", [
    "PENDING",
    "PROCESSED",
    "FAILED",
]);
/**
 * Outbox Events Table
 * Implements the Transactional Outbox Pattern to solve the Dual-Write problem.
 * Stores domain events atomically in the same transaction as the aggregate state changes.
 */
export const outboxEvents = pgTable("outbox_events", {
    ...primaryKeyColumn(),
    ...tenantIdColumn,
    eventType: varchar("event_type", { length: 255 }).notNull(),
    payload: jsonb("payload").notNull(),
    status: outboxEventStatusEnum("status").default("PENDING").notNull(),
    ...auditTimestamps,
    processedAt: timestamp("processed_at", { withTimezone: true }),
});
