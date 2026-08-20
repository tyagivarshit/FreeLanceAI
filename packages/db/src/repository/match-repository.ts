/* eslint-disable @typescript-eslint/no-explicit-any */
import { eq, and, or, desc, sql } from "drizzle-orm";
import { db } from "../client.js";
import { jobMatches } from "../schema/matches.js";
import {
  JobMatch,
  JobMatchAggregateStore,
  JobMatchPersistenceContract,
  JobMatchSnapshot,
  JobMatchLifecycle,
  MatchSignals,
  AuthorizedSearchScope,
  SearchQuery,
  SearchResultSet,
  MatchSearchEngine,
  DEFAULT_SEARCH_PAGE,
  DEFAULT_SEARCH_PAGE_SIZE,
  MAX_SEARCH_PAGE_SIZE,
  type MatchSearchRepository,
  type MatchSearchResultItem,
  type MatchSearchResultList,
  type SearchProvider,
} from "@freelanceos/core";

export class PostgresJobMatchRepository
  implements
    JobMatchAggregateStore,
    JobMatchPersistenceContract,
    MatchSearchRepository,
    SearchProvider
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

  public async searchMatches(
    queryText: string,
    scope: AuthorizedSearchScope,
    page = DEFAULT_SEARCH_PAGE,
    pageSize = DEFAULT_SEARCH_PAGE_SIZE,
  ): Promise<MatchSearchResultList> {
    const boundedPage = Math.max(1, page);
    const boundedPageSize = Math.min(MAX_SEARCH_PAGE_SIZE, Math.max(1, pageSize));
    const offset = (boundedPage - 1) * boundedPageSize;

    const normalizedQuery = queryText.trim().toLowerCase();
    const searchPattern = `%${normalizedQuery}%`;

    const scopeCondition = and(
      eq(jobMatches.ownerId, scope.ownerId),
      eq(jobMatches.tenantId, scope.tenantId),
    );

    const searchCondition = or(
      sql`lower(${jobMatches.status}) LIKE ${searchPattern}`,
      sql`lower(${jobMatches.matchingVersion}) LIKE ${searchPattern}`,
      sql`lower(${jobMatches.normalizationVersion}) LIKE ${searchPattern}`,
      sql`cast(${jobMatches.jobId} as text) LIKE ${searchPattern}`,
      sql`cast(${jobMatches.freelancerId} as text) LIKE ${searchPattern}`,
      sql`lower(${jobMatches.jobNormalizationId}) LIKE ${searchPattern}`,
      sql`lower(cast(${jobMatches.matchSignals}->'matchedSkills' as text)) LIKE ${searchPattern}`,
      sql`lower(cast(${jobMatches.matchSignals}->'missingSkills' as text)) LIKE ${searchPattern}`,
      sql`lower(${jobMatches.matchSignals}->>'experienceCompatibility') LIKE ${searchPattern}`,
      sql`lower(${jobMatches.matchSignals}->>'budgetCompatibility') LIKE ${searchPattern}`,
      sql`lower(${jobMatches.matchSignals}->>'jobTypeCompatibility') LIKE ${searchPattern}`,
      sql`lower(${jobMatches.matchSignals}->>'locationCompatibility') LIKE ${searchPattern}`,
    );

    const whereClause = and(scopeCondition, searchCondition);

    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(jobMatches)
      .where(whereClause);

    const total = Number(countResult[0]?.count || 0);

    const rows = await db
      .select()
      .from(jobMatches)
      .where(whereClause)
      .orderBy(desc(jobMatches.createdAt), desc(jobMatches.id))
      .limit(boundedPageSize)
      .offset(offset);

    const items: MatchSearchResultItem[] = rows.map((row) => {
      const signals = (row.matchSignals as any) || undefined;
      return {
        id: row.id,
        jobId: row.jobId,
        freelancerId: row.freelancerId,
        status: row.status,
        matchingVersion: row.matchingVersion,
        normalizationVersion: row.normalizationVersion,
        jobNormalizationId: row.jobNormalizationId,
        matchedSkills: Array.isArray(signals?.matchedSkills) ? signals.matchedSkills : undefined,
        missingSkills: Array.isArray(signals?.missingSkills) ? signals.missingSkills : undefined,
        skillCoverage:
          typeof signals?.skillCoverage === "number" ? signals.skillCoverage : undefined,
        semanticSimilarity:
          typeof signals?.semanticSimilarity === "number" ? signals.semanticSimilarity : undefined,
        experienceCompatibility:
          typeof signals?.experienceCompatibility === "string"
            ? signals.experienceCompatibility
            : undefined,
        budgetCompatibility:
          typeof signals?.budgetCompatibility === "string"
            ? signals.budgetCompatibility
            : undefined,
        jobTypeCompatibility:
          typeof signals?.jobTypeCompatibility === "string"
            ? signals.jobTypeCompatibility
            : undefined,
        locationCompatibility:
          typeof signals?.locationCompatibility === "string"
            ? signals.locationCompatibility
            : undefined,
        createdAt: row.createdAt,
      };
    });

    return {
      items,
      total,
      page: boundedPage,
      pageSize: boundedPageSize,
    };
  }

  public async search(query: SearchQuery, scope: AuthorizedSearchScope): Promise<SearchResultSet> {
    const engine = new MatchSearchEngine(this);
    return engine.search(query, scope);
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
