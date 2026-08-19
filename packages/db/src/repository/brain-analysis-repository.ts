import { eq, and, desc, sql, lte, inArray } from "drizzle-orm";
import { db } from "../client.js";
import { brainAnalyses, type BrainAnalysisRow } from "../schema/brain.js";
import {
  BrainAnalysisAggregate,
  BrainAnalysisRepository,
  BrainAnalysisAggregateStore,
  BrainPersistenceContract,
  BrainScope,
  BrainResult,
  BrainFailure,
  BrainConfidence,
  BrainEvidence,
  BrainAnalysisType,
  BrainAnalysisStatus,
  BrainAnalysisListFilters,
  BrainDomainError,
  type BrainConfidenceProperties,
  type BrainFailureProperties,
  type BrainEvidenceProperties,
  type BrainAnalysisConstraints,
  type BrainInsightProperties,
  type BrainRecommendationProperties,
  type BrainJsonValue,
} from "@freelanceos/core";

export class PostgresBrainAnalysisRepository
  implements BrainAnalysisRepository, BrainAnalysisAggregateStore, BrainPersistenceContract
{
  public async create(aggregate: BrainAnalysisAggregate): Promise<void> {
    const dto = aggregate.toJSON();
    const values = {
      id: dto.id,
      tenantId: dto.scope.tenantId,
      ownerId: dto.scope.ownerId,
      actorId: dto.scope.actorId,
      analysisType: dto.analysisType,
      status: dto.status,
      correlationId: dto.correlationId,
      idempotencyKey: dto.idempotencyKey ?? null,
      summary: dto.summary ?? null,
      insights: dto.insights ? [...dto.insights] : [],
      recommendations: dto.recommendations ? [...dto.recommendations] : [],
      confidence: dto.confidence ? dto.confidence.toJSON() : null,
      evidence: dto.evidence
        ? dto.evidence.map((e) => (e instanceof BrainEvidence ? e.toJSON() : e))
        : [],
      failure: dto.failure ? dto.failure.toJSON() : null,
      metadata: dto.metadata ?? null,
      constraints: dto.constraints ?? {},
      attemptCount: dto.attemptCount ?? 0,
      maxAttempts: dto.maxAttempts ?? 3,
      claimedAt: dto.claimedAt ?? null,
      completedAt: dto.completedAt ?? null,
      failedAt: dto.failedAt ?? null,
      staleTimeoutMs: dto.staleTimeoutMs ?? 30000,
      createdAt: dto.createdAt ?? new Date(),
      updatedAt: dto.updatedAt ?? new Date(),
    };

    try {
      await db.insert(brainAnalyses).values(values);
    } catch (error: unknown) {
      if (error && typeof error === "object" && "code" in error && error.code === "23505") {
        throw new BrainDomainError(
          "INVALID_REQUEST",
          "Concurrent duplicate analysis request detected.",
        );
      }
      throw error;
    }
  }

  public async claimExecution(
    id: string,
    scope: BrainScope,
    claimedAt: Date = new Date(),
  ): Promise<BrainAnalysisAggregate | null> {
    const updated = await db
      .update(brainAnalyses)
      .set({
        status: "RUNNING",
        claimedAt,
        attemptCount: sql`${brainAnalyses.attemptCount} + 1`,
        updatedAt: claimedAt,
      })
      .where(
        and(
          eq(brainAnalyses.id, id),
          eq(brainAnalyses.tenantId, scope.tenantId),
          eq(brainAnalyses.ownerId, scope.ownerId),
          eq(brainAnalyses.status, "REQUESTED"),
        ),
      )
      .returning();

    if (!updated || updated.length === 0) {
      return null;
    }

    return this.mapRowToAggregate(updated[0]!);
  }

  public async saveCompleted(
    id: string,
    scope: BrainScope,
    result: BrainResult,
    completedAt: Date = new Date(),
  ): Promise<BrainAnalysisAggregate> {
    const resDto = result.toJSON();
    const updated = await db
      .update(brainAnalyses)
      .set({
        status: "COMPLETED",
        summary: resDto.summary,
        insights: [...resDto.insights],
        recommendations: [...resDto.recommendations],
        confidence: resDto.confidence ? resDto.confidence.toJSON() : null,
        evidence: resDto.evidence.map((e) => (e instanceof BrainEvidence ? e.toJSON() : e)),
        metadata: resDto.metadata ?? null,
        completedAt,
        updatedAt: completedAt,
      })
      .where(
        and(
          eq(brainAnalyses.id, id),
          eq(brainAnalyses.tenantId, scope.tenantId),
          eq(brainAnalyses.ownerId, scope.ownerId),
          eq(brainAnalyses.status, "RUNNING"),
        ),
      )
      .returning();

    if (!updated || updated.length === 0) {
      const existing = await this.findById(id, scope);
      if (!existing) {
        throw new BrainDomainError("INVALID_REQUEST", "Brain analysis execution not found.");
      }
      return existing;
    }

    return this.mapRowToAggregate(updated[0]!);
  }

  public async saveFailed(
    id: string,
    scope: BrainScope,
    failure: BrainFailure,
    status: "FAILED" | "TIMEOUT" | "INSUFFICIENT_CONTEXT" = "FAILED",
    failedAt: Date = new Date(),
  ): Promise<BrainAnalysisAggregate> {
    const updated = await db
      .update(brainAnalyses)
      .set({
        status,
        summary: failure.message,
        failure: failure.toJSON(),
        failedAt,
        updatedAt: failedAt,
      })
      .where(
        and(
          eq(brainAnalyses.id, id),
          eq(brainAnalyses.tenantId, scope.tenantId),
          eq(brainAnalyses.ownerId, scope.ownerId),
        ),
      )
      .returning();

    if (!updated || updated.length === 0) {
      const existing = await this.findById(id, scope);
      if (!existing) {
        throw new BrainDomainError("INVALID_REQUEST", "Brain analysis execution not found.");
      }
      return existing;
    }

    return this.mapRowToAggregate(updated[0]!);
  }

  public async findById(id: string, scope: BrainScope): Promise<BrainAnalysisAggregate | null> {
    const rows = await db
      .select()
      .from(brainAnalyses)
      .where(
        and(
          eq(brainAnalyses.id, id),
          eq(brainAnalyses.tenantId, scope.tenantId),
          eq(brainAnalyses.ownerId, scope.ownerId),
        ),
      )
      .limit(1);

    if (rows.length === 0) {
      return null;
    }

    return this.mapRowToAggregate(rows[0]!);
  }

  public async findByIdempotencyKey(
    scope: BrainScope,
    analysisType: BrainAnalysisType,
    idempotencyKey: string,
  ): Promise<BrainAnalysisAggregate | null> {
    const rows = await db
      .select()
      .from(brainAnalyses)
      .where(
        and(
          eq(brainAnalyses.tenantId, scope.tenantId),
          eq(brainAnalyses.ownerId, scope.ownerId),
          eq(brainAnalyses.analysisType, analysisType),
          eq(brainAnalyses.idempotencyKey, idempotencyKey),
        ),
      )
      .orderBy(desc(brainAnalyses.createdAt))
      .limit(1);

    if (rows.length === 0) {
      return null;
    }

    return this.mapRowToAggregate(rows[0]!);
  }

  public async listByScope(
    scope: BrainScope,
    filters?: BrainAnalysisListFilters,
  ): Promise<{ readonly items: readonly BrainAnalysisAggregate[]; readonly total: number }> {
    const conditions = [
      eq(brainAnalyses.tenantId, scope.tenantId),
      eq(brainAnalyses.ownerId, scope.ownerId),
    ];

    if (filters?.analysisType) {
      conditions.push(eq(brainAnalyses.analysisType, filters.analysisType));
    }
    if (filters?.status) {
      conditions.push(eq(brainAnalyses.status, filters.status));
    }

    const whereClause = and(...conditions);
    const limit = filters?.limit ?? 20;
    const offset = filters?.offset ?? 0;

    const [rows, countResult] = await Promise.all([
      db
        .select()
        .from(brainAnalyses)
        .where(whereClause)
        .orderBy(desc(brainAnalyses.createdAt), desc(brainAnalyses.id))
        .limit(limit)
        .offset(offset),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(brainAnalyses)
        .where(whereClause),
    ]);

    const items = rows.map((r) => this.mapRowToAggregate(r));
    const total = countResult[0]?.count ?? items.length;

    return { items, total };
  }

  public async recoverStaleRunning(
    staleBeforeDate: Date,
    limit = 50,
  ): Promise<readonly BrainAnalysisAggregate[]> {
    const staleRows = await db
      .select({ id: brainAnalyses.id })
      .from(brainAnalyses)
      .where(
        and(eq(brainAnalyses.status, "RUNNING"), lte(brainAnalyses.claimedAt, staleBeforeDate)),
      )
      .limit(limit);

    if (staleRows.length === 0) {
      return [];
    }

    const ids = staleRows.map((r) => r.id);
    const failurePayload = {
      code: "PROVIDER_TIMEOUT",
      message: "Orphaned execution recovered after timeout.",
      retryable: true,
    };

    const now = new Date();
    const updated = await db
      .update(brainAnalyses)
      .set({
        status: "TIMEOUT",
        summary: failurePayload.message,
        failure: failurePayload,
        failedAt: now,
        updatedAt: now,
      })
      .where(and(inArray(brainAnalyses.id, ids), eq(brainAnalyses.status, "RUNNING")))
      .returning();

    return updated.map((r) => this.mapRowToAggregate(r));
  }

  // Domain AggregateStore Interface Implementation
  public async save(scope: BrainScope, result: BrainResult): Promise<void> {
    const resDto = result.toJSON();
    const existing = await this.findById(resDto.analysisId, scope);
    if (!existing) {
      const aggregate = new BrainAnalysisAggregate({
        id: resDto.analysisId,
        scope,
        analysisType: resDto.analysisType,
        status: resDto.status === "COMPLETED" ? "COMPLETED" : "FAILED",
        correlationId: resDto.analysisId,
        constraints: {},
        summary: resDto.summary,
        insights: resDto.insights,
        recommendations: resDto.recommendations,
        confidence: resDto.confidence,
        evidence: resDto.evidence,
        failure: resDto.failure,
        metadata: resDto.metadata,
        createdAt: resDto.generatedAt,
        updatedAt: resDto.generatedAt,
        completedAt: resDto.status === "COMPLETED" ? resDto.generatedAt : undefined,
        failedAt: resDto.status !== "COMPLETED" ? resDto.generatedAt : undefined,
      });
      await this.create(aggregate);
    } else {
      if (resDto.status === "COMPLETED") {
        await this.saveCompleted(resDto.analysisId, scope, result, resDto.generatedAt);
      } else {
        const failure =
          resDto.failure ??
          new BrainFailure({
            code: "INTERNAL_FAILURE",
            message: resDto.summary,
            retryable: false,
          });
        await this.saveFailed(resDto.analysisId, scope, failure, "FAILED", resDto.generatedAt);
      }
    }
  }

  // Persistence Contract Uniqueness Check
  public async checkUniqueAnalysisId(
    tenantId: string,
    ownerId: string,
    analysisId: string,
  ): Promise<boolean> {
    const rows = await db
      .select({ id: brainAnalyses.id })
      .from(brainAnalyses)
      .where(
        and(
          eq(brainAnalyses.id, analysisId),
          eq(brainAnalyses.tenantId, tenantId),
          eq(brainAnalyses.ownerId, ownerId),
        ),
      )
      .limit(1);

    return rows.length === 0;
  }

  private mapRowToAggregate(row: BrainAnalysisRow): BrainAnalysisAggregate {
    const scope = new BrainScope({
      tenantId: row.tenantId,
      ownerId: row.ownerId,
      actorId: row.actorId,
    });

    const confidence = row.confidence
      ? new BrainConfidence(row.confidence as BrainConfidenceProperties)
      : undefined;

    const failure = row.failure
      ? new BrainFailure(row.failure as BrainFailureProperties)
      : undefined;

    const evidence = ((row.evidence as BrainEvidenceProperties[]) ?? []).map(
      (e) => new BrainEvidence(e),
    );

    return new BrainAnalysisAggregate({
      id: row.id,
      scope,
      analysisType: row.analysisType as BrainAnalysisType,
      status: row.status as BrainAnalysisStatus,
      correlationId: row.correlationId,
      idempotencyKey: row.idempotencyKey ?? undefined,
      constraints: (row.constraints as BrainAnalysisConstraints) ?? {},
      summary: row.summary ?? undefined,
      insights: (row.insights as BrainInsightProperties[]) ?? [],
      recommendations: (row.recommendations as BrainRecommendationProperties[]) ?? [],
      confidence,
      evidence,
      failure,
      metadata: (row.metadata as Record<string, BrainJsonValue>) ?? undefined,
      attemptCount: row.attemptCount,
      maxAttempts: row.maxAttempts,
      claimedAt: row.claimedAt ?? undefined,
      completedAt: row.completedAt ?? undefined,
      failedAt: row.failedAt ?? undefined,
      staleTimeoutMs: row.staleTimeoutMs,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }
}
