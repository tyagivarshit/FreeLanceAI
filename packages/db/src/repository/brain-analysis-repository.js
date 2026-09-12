import { eq, and, desc, sql, lte, inArray } from "drizzle-orm";
import { db } from "../client.js";
import { brainAnalyses } from "../schema/brain.js";
import { BrainAnalysisAggregate, BrainScope, BrainFailure, BrainConfidence, BrainEvidence, BrainDomainError, } from "@freelanceos/core";
export class PostgresBrainAnalysisRepository {
    async create(aggregate) {
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
        }
        catch (error) {
            if (error && typeof error === "object" && "code" in error && error.code === "23505") {
                throw new BrainDomainError("INVALID_REQUEST", "Concurrent duplicate analysis request detected.");
            }
            throw error;
        }
    }
    async claimExecution(id, scope, claimedAt = new Date()) {
        const updated = await db
            .update(brainAnalyses)
            .set({
            status: "RUNNING",
            claimedAt,
            attemptCount: sql `${brainAnalyses.attemptCount} + 1`,
            updatedAt: claimedAt,
        })
            .where(and(eq(brainAnalyses.id, id), eq(brainAnalyses.tenantId, scope.tenantId), eq(brainAnalyses.ownerId, scope.ownerId), eq(brainAnalyses.status, "REQUESTED")))
            .returning();
        if (!updated || updated.length === 0) {
            return null;
        }
        return this.mapRowToAggregate(updated[0]);
    }
    async saveCompleted(id, scope, result, completedAt = new Date()) {
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
            .where(and(eq(brainAnalyses.id, id), eq(brainAnalyses.tenantId, scope.tenantId), eq(brainAnalyses.ownerId, scope.ownerId), eq(brainAnalyses.status, "RUNNING")))
            .returning();
        if (!updated || updated.length === 0) {
            const existing = await this.findById(id, scope);
            if (!existing) {
                throw new BrainDomainError("INVALID_REQUEST", "Brain analysis execution not found.");
            }
            return existing;
        }
        return this.mapRowToAggregate(updated[0]);
    }
    async saveFailed(id, scope, failure, status = "FAILED", failedAt = new Date()) {
        const updated = await db
            .update(brainAnalyses)
            .set({
            status,
            summary: failure.message,
            failure: failure.toJSON(),
            failedAt,
            updatedAt: failedAt,
        })
            .where(and(eq(brainAnalyses.id, id), eq(brainAnalyses.tenantId, scope.tenantId), eq(brainAnalyses.ownerId, scope.ownerId)))
            .returning();
        if (!updated || updated.length === 0) {
            const existing = await this.findById(id, scope);
            if (!existing) {
                throw new BrainDomainError("INVALID_REQUEST", "Brain analysis execution not found.");
            }
            return existing;
        }
        return this.mapRowToAggregate(updated[0]);
    }
    async findById(id, scope) {
        const rows = await db
            .select()
            .from(brainAnalyses)
            .where(and(eq(brainAnalyses.id, id), eq(brainAnalyses.tenantId, scope.tenantId), eq(brainAnalyses.ownerId, scope.ownerId)))
            .limit(1);
        if (rows.length === 0) {
            return null;
        }
        return this.mapRowToAggregate(rows[0]);
    }
    async findByIdempotencyKey(scope, analysisType, idempotencyKey) {
        const rows = await db
            .select()
            .from(brainAnalyses)
            .where(and(eq(brainAnalyses.tenantId, scope.tenantId), eq(brainAnalyses.ownerId, scope.ownerId), eq(brainAnalyses.analysisType, analysisType), eq(brainAnalyses.idempotencyKey, idempotencyKey)))
            .orderBy(desc(brainAnalyses.createdAt))
            .limit(1);
        if (rows.length === 0) {
            return null;
        }
        return this.mapRowToAggregate(rows[0]);
    }
    async listByScope(scope, filters) {
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
                .select({ count: sql `count(*)::int` })
                .from(brainAnalyses)
                .where(whereClause),
        ]);
        const items = rows.map((r) => this.mapRowToAggregate(r));
        const total = countResult[0]?.count ?? items.length;
        return { items, total };
    }
    async recoverStaleRunning(staleBeforeDate, limit = 50) {
        const staleRows = await db
            .select({ id: brainAnalyses.id })
            .from(brainAnalyses)
            .where(and(eq(brainAnalyses.status, "RUNNING"), lte(brainAnalyses.claimedAt, staleBeforeDate)))
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
    async save(scope, result) {
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
        }
        else {
            if (resDto.status === "COMPLETED") {
                await this.saveCompleted(resDto.analysisId, scope, result, resDto.generatedAt);
            }
            else {
                const failure = resDto.failure ??
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
    async checkUniqueAnalysisId(tenantId, ownerId, analysisId) {
        const rows = await db
            .select({ id: brainAnalyses.id })
            .from(brainAnalyses)
            .where(and(eq(brainAnalyses.id, analysisId), eq(brainAnalyses.tenantId, tenantId), eq(brainAnalyses.ownerId, ownerId)))
            .limit(1);
        return rows.length === 0;
    }
    mapRowToAggregate(row) {
        const scope = new BrainScope({
            tenantId: row.tenantId,
            ownerId: row.ownerId,
            actorId: row.actorId,
        });
        const confidence = row.confidence
            ? new BrainConfidence(row.confidence)
            : undefined;
        const failure = row.failure
            ? new BrainFailure(row.failure)
            : undefined;
        const evidence = (row.evidence ?? []).map((e) => new BrainEvidence(e));
        return new BrainAnalysisAggregate({
            id: row.id,
            scope,
            analysisType: row.analysisType,
            status: row.status,
            correlationId: row.correlationId,
            idempotencyKey: row.idempotencyKey ?? undefined,
            constraints: row.constraints ?? {},
            summary: row.summary ?? undefined,
            insights: row.insights ?? [],
            recommendations: row.recommendations ?? [],
            confidence,
            evidence,
            failure,
            metadata: row.metadata ?? undefined,
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
