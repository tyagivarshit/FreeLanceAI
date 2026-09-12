import { pgTable, varchar, timestamp, jsonb, integer, uniqueIndex, index } from "drizzle-orm/pg-core";
import { uuid } from "drizzle-orm/pg-core";
import { users } from "./auth.js";

export const attachments = pgTable(
  "attachments",
  {
    id: uuid("id").primaryKey().notNull(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    parentId: uuid("parent_id").notNull(),
    parentType: varchar("parent_type", { length: 50 }).notNull(),
    ownerId: uuid("owner_id").notNull(),
    attachmentReference: varchar("attachment_reference", { length: 255 }).notNull(),
    storageKey: varchar("storage_key", { length: 255 }).notNull(),
    originalFilename: varchar("original_filename", { length: 255 }),
    mimeType: varchar("mime_type", { length: 100 }).notNull(),
    fileSizeBytes: integer("file_size_bytes").notNull(),
    metadata: jsonb("metadata").notNull(),
    visibility: jsonb("visibility").notNull(),
    status: varchar("status", { length: 50 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
  },
  (table) => ({
    tenantRefUniqueIdx: uniqueIndex("attachments_tenant_ref_unique_idx").on(
      table.tenantId,
      table.attachmentReference
    ),
    tenantIdx: index("attachments_tenant_idx").on(table.tenantId),
    parentIdx: index("attachments_parent_idx").on(table.parentId),
    statusIdx: index("attachments_status_idx").on(table.status),
  })
);

export type AttachmentRow = typeof attachments.$inferSelect;
export type AttachmentInsert = typeof attachments.$inferInsert;
