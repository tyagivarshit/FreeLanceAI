import { eq, and } from "drizzle-orm";
import { attachments } from "../schema/attachments.js";
import { Attachment, AttachmentMetadata, AttachmentVisibility } from "@freelanceos/core";
import { db } from "../client.js";
export class PostgresAttachmentRepository {
    async save(attachment) {
        const row = {
            id: attachment.attachmentId,
            tenantId: attachment.tenantId,
            parentId: attachment.parentId,
            parentType: attachment.parentType,
            ownerId: attachment.ownerId,
            attachmentReference: attachment.attachmentReference,
            storageKey: attachment.attachmentId,
            originalFilename: attachment.metadata.displayName,
            mimeType: attachment.metadata.logicalMediaType,
            fileSizeBytes: attachment.metadata.fileSizeBytes,
            metadata: attachment.metadata,
            visibility: attachment.visibility,
            status: attachment.status,
            updatedAt: attachment.updatedAt,
            createdAt: attachment.createdAt,
        };
        // UPDATE-first idempotency pattern
        const result = await db
            .update(attachments)
            .set(row)
            .where(and(eq(attachments.id, attachment.attachmentId), eq(attachments.tenantId, attachment.tenantId)))
            .returning({ id: attachments.id });
        if (result.length === 0) {
            try {
                await db.insert(attachments).values(row);
            }
            catch (err) {
                if (err.code === "23505") {
                    // Idempotency constraint triggered
                    return;
                }
                throw err;
            }
        }
    }
    async findById(attachmentId, tenantId) {
        const rows = await db
            .select()
            .from(attachments)
            .where(and(eq(attachments.id, attachmentId), eq(attachments.tenantId, tenantId)))
            .limit(1);
        if (rows.length === 0)
            return null;
        const row = rows[0];
        return this.mapToDomain(row);
    }
    async findByReference(attachmentReference, tenantId) {
        const rows = await db
            .select()
            .from(attachments)
            .where(and(eq(attachments.attachmentReference, attachmentReference), eq(attachments.tenantId, tenantId)))
            .limit(1);
        if (rows.length === 0)
            return null;
        const row = rows[0];
        return this.mapToDomain(row);
    }
    async checkUniqueReference(tenantId, attachmentReference, attachmentId) {
        const rows = await db
            .select({ id: attachments.id })
            .from(attachments)
            .where(and(eq(attachments.attachmentReference, attachmentReference), eq(attachments.tenantId, tenantId)))
            .limit(1);
        if (rows.length === 0)
            return true;
        if (attachmentId && rows[0].id === attachmentId)
            return true;
        return false;
    }
    mapToDomain(row) {
        // Reconstruct without invoking the factory create (since we're hydrating from DB)
        const attachment = new Attachment({
            attachmentId: row.id,
            tenantId: row.tenantId,
            parentId: row.parentId,
            parentType: row.parentType,
            ownerId: row.ownerId,
            attachmentReference: row.attachmentReference,
            metadata: new AttachmentMetadata({
                displayName: row.metadata._displayName || row.metadata.displayName || "Unknown",
                logicalMediaType: row.metadata._logicalMediaType || row.metadata.logicalMediaType || "application/octet-stream",
                characteristics: row.metadata._characteristics || row.metadata.characteristics || "",
                description: row.metadata._description || row.metadata.description || "",
                fileSizeBytes: row.metadata._fileSizeBytes || row.metadata.fileSizeBytes || 0,
            }),
            visibility: new AttachmentVisibility(row.visibility.classification || "StandardClassification"),
            status: row.status,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
        });
        return attachment;
    }
}
