import { eq, and } from "drizzle-orm";
import { db } from "../client.js";
import { projects } from "../schema/projects.js";
import { Project, ProjectMetadata, ProjectVisibility } from "@freelanceos/core";
export class PostgresProjectRepository {
    async save(project) {
        try {
            // Try updating first (for lifecycle transitions)
            const updated = await db
                .update(projects)
                .set({
                metadata: {
                    title: project.metadata.title,
                    description: project.metadata.description,
                    startDate: project.metadata.startDate?.toISOString(),
                    endDate: project.metadata.endDate?.toISOString(),
                },
                visibility: {
                    classification: project.visibility.classification,
                },
                status: project.status,
                updatedAt: project.updatedAt,
            })
                .where(eq(projects.id, project.projectId))
                .returning({ id: projects.id });
            // If no existing row was updated, it's a new project. 
            // We do a plain insert with NO onConflictDoUpdate.
            // This ensures concurrent duplicate creations strictly trigger a 23505 violation.
            if (updated.length === 0) {
                await db
                    .insert(projects)
                    .values({
                    id: project.projectId,
                    tenantId: project.tenantId,
                    clientId: project.clientId,
                    ownerId: project.ownerId,
                    projectReference: project.projectReference,
                    metadata: {
                        title: project.metadata.title,
                        description: project.metadata.description,
                        startDate: project.metadata.startDate?.toISOString(),
                        endDate: project.metadata.endDate?.toISOString(),
                    },
                    visibility: {
                        classification: project.visibility.classification,
                    },
                    status: project.status,
                    createdAt: project.createdAt,
                    updatedAt: project.updatedAt,
                });
            }
        }
        catch (err) {
            if (err.code === "23505") {
                throw new Error("Duplicate project reference: aggregate already exists for this reference.");
            }
            throw err;
        }
    }
    async findById(projectId, tenantId) {
        const rows = await db
            .select()
            .from(projects)
            .where(and(eq(projects.id, projectId), eq(projects.tenantId, tenantId)))
            .limit(1);
        if (rows.length === 0)
            return null;
        return this.mapToDomain(rows[0]);
    }
    async findByReference(projectReference, tenantId) {
        const rows = await db
            .select()
            .from(projects)
            .where(and(eq(projects.projectReference, projectReference), eq(projects.tenantId, tenantId)))
            .limit(1);
        if (rows.length === 0)
            return null;
        return this.mapToDomain(rows[0]);
    }
    async checkUniqueReference(tenantId, projectReference, projectId) {
        // We rely on DB constraint during save(), this just satisfies the interface if needed elsewhere
        return true;
    }
    mapToDomain(row) {
        const startDate = row.metadata.startDate ? new Date(row.metadata.startDate) : undefined;
        const endDate = row.metadata.endDate ? new Date(row.metadata.endDate) : undefined;
        return new Project({
            projectId: row.id,
            tenantId: row.tenantId,
            clientId: row.clientId,
            ownerId: row.ownerId,
            projectReference: row.projectReference,
            metadata: new ProjectMetadata({
                title: row.metadata.title,
                description: row.metadata.description,
                startDate: startDate,
                endDate: endDate,
            }),
            visibility: new ProjectVisibility(row.visibility.classification),
            status: row.status,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
        });
    }
}
