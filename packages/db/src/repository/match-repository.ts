/* eslint-disable @typescript-eslint/no-explicit-any */
import { eq, and } from "drizzle-orm";
import { db } from "../client.js";
import { jobMatches } from "../schema/matches.js";
import {
  JobMatch,
  JobMatchAggregateStore,
  JobMatchPersistenceContract,
  JobMatchSnapshot,
  JobMatchLifecycle,
  MatchSignals,
} from "@freelanceos/core";

export class PostgresJobMatchRepository
  implements JobMatchAggregateStore, JobMatchPersistenceContract
{
  public async save(match: JobMatch): Promise<void> {
    const values = {
      id: match.id,
      tenantId: match.tenantId,
      ownerId: match.ownerId,
      freelancerId: match.freelancerId,
      jobId: match.jobId,
      jobNormalizationId: match.jobNormalizationId,
      normalizationVersion: match.normalizationVersion,
      jobEmbeddingId: match.jobEmbeddingId || null,
      embeddingVersion: match.embeddingVersion || null,
      matchingVersion: match.matchingVersion,
      matchSignals: match.matchSignals || null,
      status: match.status,
      snapshots: match.snapshots.map((s) => ({
        version: s.version,
        createdAt: s.createdAt.toISOString(),
        status: s.status,
        freelancerId: s.freelancerId,
        jobId: s.jobId,
        jobNormalizationId: s.jobNormalizationId,
        normalizationVersion: s.normalizationVersion,
        jobEmbeddingId: s.jobEmbeddingId || null,
        embeddingVersion: s.embeddingVersion || null,
        matchingVersion: s.matchingVersion,
        matchSignals: s.matchSignals || null,
      })),
      updatedAt: new Date(),
    };

    await db
      .insert(jobMatches)
      .values(values)
      .onConflictDoUpdate({
        target: [jobMatches.id],
        set: {
          status: values.status,
          matchSignals: values.matchSignals,
          snapshots: values.snapshots,
          updatedAt: values.updatedAt,
        },
      });
  }

  public async findById(id: string, tenantId: string): Promise<JobMatch | null> {
    const rows = await db
      .select()
      .from(jobMatches)
      .where(and(eq(jobMatches.id, id), eq(jobMatches.tenantId, tenantId)))
      .limit(1);

    if (rows.length === 0) {
      return null;
    }
    return this.mapToAggregate(rows[0]!);
  }

  public async findByMatchingIdentity(
    tenantId: string,
    freelancerId: string,
    jobId: string,
    matchingVersion: string,
  ): Promise<JobMatch | null> {
    const rows = await db
      .select()
      .from(jobMatches)
      .where(
        and(
          eq(jobMatches.tenantId, tenantId),
          eq(jobMatches.freelancerId, freelancerId),
          eq(jobMatches.jobId, jobId),
          eq(jobMatches.matchingVersion, matchingVersion),
        ),
      )
      .limit(1);

    if (rows.length === 0) {
      return null;
    }
    return this.mapToAggregate(rows[0]!);
  }

  private mapToAggregate(row: typeof jobMatches.$inferSelect): JobMatch {
    const signals = row.matchSignals ? (row.matchSignals as unknown as MatchSignals) : undefined;

    const snapshots = ((row.snapshots as any[]) || []).map((s) => {
      return new JobMatchSnapshot({
        version: s.version,
        createdAt: new Date(s.createdAt),
        status: s.status as JobMatchLifecycle,
        freelancerId: s.freelancerId,
        jobId: s.jobId,
        jobNormalizationId: s.jobNormalizationId,
        normalizationVersion: s.normalizationVersion,
        jobEmbeddingId: s.jobEmbeddingId || undefined,
        embeddingVersion: s.embeddingVersion || undefined,
        matchingVersion: s.matchingVersion,
        matchSignals: s.matchSignals ? (s.matchSignals as unknown as MatchSignals) : undefined,
      });
    });

    return new JobMatch({
      id: row.id,
      tenantId: row.tenantId,
      ownerId: row.ownerId,
      freelancerId: row.freelancerId,
      jobId: row.jobId,
      jobNormalizationId: row.jobNormalizationId,
      normalizationVersion: row.normalizationVersion,
      jobEmbeddingId: row.jobEmbeddingId || undefined,
      embeddingVersion: row.embeddingVersion || undefined,
      matchingVersion: row.matchingVersion,
      matchSignals: signals,
      status: row.status,
      snapshots,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }
}
