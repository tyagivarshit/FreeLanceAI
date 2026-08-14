import { pgTable, varchar, timestamp, pgEnum, uuid, index, jsonb } from "drizzle-orm/pg-core";
import { users } from "./auth.js";
import { auditTimestamps } from "./helpers.js";

// 1. Timeline Status Enum
export const timelineStatusEnum = pgEnum("timeline_status", ["Initialized", "Active", "ReadOnly"]);

// 2. Timeline Event Category Enum
export const timelineEventCategoryEnum = pgEnum("timeline_event_category", [
  "Lifecycle Event",
  "Communication Event",
  "Annotation Event",
  "Status Event",
  "Audit Event",
]);

// 3. Visibility Classification Enum
export const visibilityClassificationEnum = pgEnum("visibility_classification", [
  "Internal",
  "Public",
]);

// 4. Client Timelines Table (corresponds to ClientTimeline Aggregate Root)
export const clientTimelines = pgTable(
  "client_timelines",
  {
    id: uuid("id").primaryKey(),
    clientId: uuid("client_id").notNull(),
    ownerId: uuid("owner_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    status: timelineStatusEnum("status").notNull(),
    ...auditTimestamps,
  },
  (table) => {
    return {
      ownerIdx: index("client_timelines_owner_idx").on(table.ownerId),
      clientOwnerIdx: index("client_timelines_client_owner_idx").on(table.clientId, table.ownerId),
    };
  },
);

// 5. Timeline Entries Table (corresponds to TimelineEntry entities)
export const timelineEntries = pgTable(
  "timeline_entries",
  {
    id: uuid("id").primaryKey(),
    timelineId: uuid("timeline_id")
      .references(() => clientTimelines.id, { onDelete: "cascade" })
      .notNull(),
    eventRef: varchar("event_ref", { length: 255 }),
    category: timelineEventCategoryEnum("category").notNull(),
    timestamp: timestamp("timestamp", { withTimezone: true }).notNull(),
    metadata: jsonb("metadata").notNull(),
    actorRef: varchar("actor_ref", { length: 255 }).notNull(),
    visibility: visibilityClassificationEnum("visibility").notNull(),
    ...auditTimestamps,
  },
  (table) => {
    return {
      timelineIdx: index("timeline_entries_timeline_idx").on(table.timelineId),
      timelineTimestampIdx: index("timeline_entries_timeline_timestamp_idx").on(
        table.timelineId,
        table.timestamp,
      ),
    };
  },
);
