/* eslint-disable @typescript-eslint/no-explicit-any */
import { eq, and, desc, sql } from "drizzle-orm";
import { db } from "../client.js";
import { jobImports } from "../schema/jobs.js";
import {
  JobImport,
  JobImportAggregateStore,
  JobImportPersistenceContract,
  JobSource,
  JobExternalIdentity,
  JobImportProvenance,
  JobRawPayload,
  JobImportFingerprint,
  JobImportSnapshot,
  JobImportLifecycle,
} from "@freelanceos/core";

export class PostgresJobsRepository
  implements JobImportAggregateStore, JobImportPersistenceContract
{
  public async save(jobImport: JobImport): Promise<void> {
    const values = {
      id: jobImport.id,
      tenantId: jobImport.tenantId,
      ownerId: jobImport.ownerId,
      source: jobImport.externalIdentity.source.value,
      externalJobId: jobImport.externalIdentity.externalJobId,
      sourceUrl: jobImport.provenance.sourceUrl || null,
      importedAt: jobImport.provenance.importedAt,
      rawPayload: jobImport.rawPayload.data,
      fingerprint: jobImport.fingerprint.value,
      status: jobImport.status,
      snapshots: jobImport.snapshots.map((s) => ({
        version: s.version,
        createdAt: s.createdAt.toISOString(),
        status: s.status,
        externalIdentity: {
          source: s.externalIdentity.source.value,
          externalJobId: s.externalIdentity.externalJobId,
        },
        provenance: {
          source: s.provenance.source.value,
          externalJobId: s.provenance.externalJobId,
          sourceUrl: s.provenance.sourceUrl,
          importedAt: s.provenance.importedAt.toISOString(),
        },
        rawPayload: s.rawPayload.data,
        fingerprint: { value: s.fingerprint.value },
      })),
      updatedAt: new Date(),
    };

    await db
      .insert(jobImports)
      .values(values)
      .onConflictDoUpdate({
        target: [jobImports.id],
        set: {
          status: values.status,
          rawPayload: values.rawPayload,
          fingerprint: values.fingerprint,
          snapshots: values.snapshots,
          updatedAt: values.updatedAt,
        },
      });
  }

  public async findById(id: string, tenantId: string): Promise<JobImport | null> {
    const rows = await db
      .select()
      .from(jobImports)
      .where(and(eq(jobImports.id, id), eq(jobImports.tenantId, tenantId)))
      .limit(1);

    if (rows.length === 0) {
      return null;
    }
    return this.mapToAggregate(rows[0]!);
  }

  public async findByExternalIdentity(
    tenantId: string,
    source: string,
    externalJobId: string,
  ): Promise<JobImport | null> {
    const rows = await db
      .select()
      .from(jobImports)
      .where(
        and(
          eq(jobImports.tenantId, tenantId),
          eq(jobImports.source, source),
          eq(jobImports.externalJobId, externalJobId),
        ),
      )
      .limit(1);

    if (rows.length === 0) {
      return null;
    }
    return this.mapToAggregate(rows[0]!);
  }

  public async findByTenant(
    tenantId: string,
    options: {
      page: number;
      pageSize: number;
      platform?: string;
      status?: string;
    },
  ): Promise<{ items: JobImport[]; total: number }> {
    const offset = (options.page - 1) * options.pageSize;
    const conditions = [eq(jobImports.tenantId, tenantId)];

    if (options.platform) {
      conditions.push(eq(jobImports.source, options.platform));
    }
    if (options.status) {
      conditions.push(eq(jobImports.status, options.status as JobImportLifecycle));
    }

    const whereClause = and(...conditions);

    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(jobImports)
      .where(whereClause);

    const total = countResult[0]?.count || 0;

    const rows = await db
      .select()
      .from(jobImports)
      .where(whereClause)
      .orderBy(desc(jobImports.createdAt), desc(jobImports.id))
      .limit(options.pageSize)
      .offset(offset);

    const items = rows.map((row) => this.mapToAggregate(row));
    return { items, total };
  }

  private mapToAggregate(row: typeof jobImports.$inferSelect): JobImport {
    const source = new JobSource(row.source);
    const externalIdentity = new JobExternalIdentity(source, row.externalJobId);

    const provenanceProps: any = {
      source,
      externalJobId: row.externalJobId,
      importedAt: row.importedAt,
    };
    if (row.sourceUrl) {
      provenanceProps.sourceUrl = row.sourceUrl;
    }
    const provenance = new JobImportProvenance(provenanceProps);

    const rawPayload = new JobRawPayload(row.rawPayload as Record<string, unknown>);
    const fingerprint = new JobImportFingerprint(row.fingerprint);

    const snapshots = ((row.snapshots as any[]) || []).map((s) => {
      const snapSource = new JobSource(s.externalIdentity.source);

      const snapProvenanceProps: any = {
        source: new JobSource(s.provenance.source),
        externalJobId: s.provenance.externalJobId,
        importedAt: new Date(s.provenance.importedAt),
      };
      if (s.provenance.sourceUrl) {
        snapProvenanceProps.sourceUrl = s.provenance.sourceUrl;
      }

      return new JobImportSnapshot({
        version: s.version,
        createdAt: new Date(s.createdAt),
        status: s.status as JobImportLifecycle,
        externalIdentity: new JobExternalIdentity(snapSource, s.externalIdentity.externalJobId),
        provenance: new JobImportProvenance(snapProvenanceProps),
        rawPayload: new JobRawPayload(s.rawPayload),
        fingerprint: new JobImportFingerprint(s.fingerprint.value),
      });
    });

    return new JobImport({
      id: row.id,
      tenantId: row.tenantId,
      ownerId: row.ownerId,
      externalIdentity,
      provenance,
      rawPayload,
      fingerprint,
      status: row.status,
      snapshots,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }
}
