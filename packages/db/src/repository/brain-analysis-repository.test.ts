import { describe, test, before, after, beforeEach } from "node:test";
import assert from "node:assert";
import { randomUUID } from "node:crypto";
import { pool } from "../client.js";
import { PostgresBrainAnalysisRepository } from "./brain-analysis-repository.js";
import {
  isPostgresAvailable,
  ensureMigrationsApplied,
  truncateClientDomainTables,
  deleteTestUsers,
} from "./postgres-integration-helper.js";
import {
  BrainScope,
  BrainAnalysisAggregate,
  BrainAnalysisRequest,
  BrainContext,
  BrainRequestMetadata,
  BrainResult,
  BrainConfidence,
  BrainEvidence,
  BrainFailure,
} from "@freelanceos/core";

describe("PostgresBrainAnalysisRepository Integration Tests", () => {
  let postgresAvailable = false;
  let repo: PostgresBrainAnalysisRepository;
  const testUserIds: string[] = [];

  const tenantAId = randomUUID();
  const ownerAId = tenantAId;
  const actorAId = tenantAId;

  const tenantBId = randomUUID();
  const ownerBId = tenantBId;
  const actorBId = tenantBId;

  before(async () => {
    postgresAvailable = await isPostgresAvailable();
    if (!postgresAvailable) {
      return;
    }

    await ensureMigrationsApplied();
    repo = new PostgresBrainAnalysisRepository();

    // Create test tenant users in users table
    await pool.query(
      `INSERT INTO users (id, email, normalized_email, status, created_at, updated_at)
       VALUES 
         ($1, 'brain_tenant_a@test.com', 'brain_tenant_a@test.com', 'active', now(), now()),
         ($2, 'brain_tenant_b@test.com', 'brain_tenant_b@test.com', 'active', now(), now())
       ON CONFLICT (id) DO NOTHING`,
      [tenantAId, tenantBId],
    );
    testUserIds.push(tenantAId, tenantBId);
  });

  after(async () => {
    if (!postgresAvailable) {
      return;
    }
    await truncateClientDomainTables();
    await deleteTestUsers(testUserIds);
  });

  beforeEach(async () => {
    if (!postgresAvailable) {
      return;
    }
    await truncateClientDomainTables();
  });

  function createTestRequest(options: {
    analysisId?: string;
    scope: BrainScope;
    idempotencyKey?: string;
    analysisType?: "CLIENT_HEALTH" | "OPPORTUNITY_REVIEW" | "FOLLOW_UP_PRIORITIZATION";
  }): BrainAnalysisRequest {
    const analysisId = options.analysisId ?? randomUUID();
    const reqScope = options.scope;
    return new BrainAnalysisRequest({
      analysisType: options.analysisType ?? "CLIENT_HEALTH",
      context: new BrainContext({
        scope: reqScope,
        clients: [
          {
            signalId: randomUUID(),
            tenantId: reqScope.tenantId,
            ownerId: reqScope.ownerId,
            clientId: randomUUID(),
            name: "Test Client",
            status: "Active",
          },
        ],
      }),
      metadata: new BrainRequestMetadata({
        requestId: analysisId,
        correlationId: `corr-${analysisId}`,
        idempotencyKey: options.idempotencyKey,
        requestedAt: new Date(),
      }),
    });
  }

  function createSampleResult(analysisId: string, scope: BrainScope): BrainResult {
    return new BrainResult({
      analysisId,
      analysisType: "CLIENT_HEALTH",
      status: "COMPLETED",
      summary: "Client is in healthy standing.",
      insights: [
        {
          insightId: "ins-1",
          title: "Strong Engagement",
          body: "Client shows consistent feedback and activity.",
          confidence: new BrainConfidence({ score: 0.95, level: "HIGH", supportingSignalCount: 2 }),
          evidence: [
            new BrainEvidence({
              sourceType: "CLIENT_SIGNAL",
              sourceId: "client-1",
              label: "Recent invoice paid on time",
              excerpt: "Recent invoice paid on time",
            }),
          ],
        },
      ],
      recommendations: [
        {
          recommendationId: "rec-1",
          action: "Schedule quarterly review",
          rationale: "Engagement momentum is positive.",
          priority: "MEDIUM",
          evidence: [],
        },
      ],
      confidence: new BrainConfidence({ score: 0.95, level: "HIGH", supportingSignalCount: 2 }),
      evidence: [],
      generatedAt: new Date(),
      scope,
    });
  }

  test("1. create and retrieve analysis execution in REQUESTED state", async (t) => {
    if (!postgresAvailable) {
      t.skip("PostgreSQL not available");
      return;
    }

    const scopeA = new BrainScope({ tenantId: tenantAId, ownerId: ownerAId, actorId: actorAId });
    const req = createTestRequest({ scope: scopeA });
    const aggregate = BrainAnalysisAggregate.create(req);

    await repo.create(aggregate);

    const fetched = await repo.findById(req.metadata.requestId, scopeA);
    assert.ok(fetched, "Analysis aggregate should be found in DB");
    assert.strictEqual(fetched.id, req.metadata.requestId);
    assert.strictEqual(fetched.status, "REQUESTED");
    assert.strictEqual(fetched.attemptCount, 0);
    assert.strictEqual(fetched.scope.tenantId, tenantAId);
    assert.strictEqual(fetched.scope.ownerId, ownerAId);
  });

  test("2. atomic execution claim: transitions REQUESTED -> RUNNING and prevents double claims", async (t) => {
    if (!postgresAvailable) {
      t.skip("PostgreSQL not available");
      return;
    }

    const scopeA = new BrainScope({ tenantId: tenantAId, ownerId: ownerAId, actorId: actorAId });
    const req = createTestRequest({ scope: scopeA });
    const aggregate = BrainAnalysisAggregate.create(req);
    await repo.create(aggregate);

    // First claim succeeds
    const claim1 = await repo.claimExecution(req.metadata.requestId, scopeA);
    assert.ok(claim1, "First claim should succeed");
    assert.strictEqual(claim1.status, "RUNNING");
    assert.strictEqual(claim1.attemptCount, 1);
    assert.ok(claim1.claimedAt);

    // Second simultaneous claim returns null (already RUNNING)
    const claim2 = await repo.claimExecution(req.metadata.requestId, scopeA);
    assert.strictEqual(claim2, null, "Second claim attempt on RUNNING execution must return null");
  });

  test("3. saveCompleted: transitions RUNNING -> COMPLETED with structured insights and recommendations", async (t) => {
    if (!postgresAvailable) {
      t.skip("PostgreSQL not available");
      return;
    }

    const scopeA = new BrainScope({ tenantId: tenantAId, ownerId: ownerAId, actorId: actorAId });
    const req = createTestRequest({ scope: scopeA });
    const aggregate = BrainAnalysisAggregate.create(req);
    await repo.create(aggregate);
    await repo.claimExecution(req.metadata.requestId, scopeA);

    const completedResult = createSampleResult(req.metadata.requestId, scopeA);
    const saved = await repo.saveCompleted(req.metadata.requestId, scopeA, completedResult);

    assert.strictEqual(saved.status, "COMPLETED");
    assert.strictEqual(saved.summary, "Client is in healthy standing.");
    assert.strictEqual(saved.insights.length, 1);
    assert.strictEqual(saved.insights[0]?.title, "Strong Engagement");
    assert.strictEqual(saved.recommendations.length, 1);
    assert.strictEqual(saved.confidence?.level, "HIGH");
    assert.ok(saved.completedAt);

    const fromDb = await repo.findById(req.metadata.requestId, scopeA);
    assert.strictEqual(fromDb?.status, "COMPLETED");
  });

  test("4. saveFailed: transitions RUNNING -> FAILED with typed failure metadata", async (t) => {
    if (!postgresAvailable) {
      t.skip("PostgreSQL not available");
      return;
    }

    const scopeA = new BrainScope({ tenantId: tenantAId, ownerId: ownerAId, actorId: actorAId });
    const req = createTestRequest({ scope: scopeA });
    const aggregate = BrainAnalysisAggregate.create(req);
    await repo.create(aggregate);
    await repo.claimExecution(req.metadata.requestId, scopeA);

    const failure = new BrainFailure({
      code: "PROVIDER_TIMEOUT",
      message: "LLM provider exceeded execution deadline.",
      retryable: true,
    });

    const failed = await repo.saveFailed(req.metadata.requestId, scopeA, failure, "TIMEOUT");
    assert.strictEqual(failed.status, "TIMEOUT");
    assert.strictEqual(failed.failure?.code, "PROVIDER_TIMEOUT");
    assert.strictEqual(failed.failure?.retryable, true);
    assert.ok(failed.failedAt);
  });

  test("5. strict cross-tenant & cross-owner isolation", async (t) => {
    if (!postgresAvailable) {
      t.skip("PostgreSQL not available");
      return;
    }

    const scopeA = new BrainScope({ tenantId: tenantAId, ownerId: ownerAId, actorId: actorAId });
    const scopeB = new BrainScope({ tenantId: tenantBId, ownerId: ownerBId, actorId: actorBId });

    const reqA = createTestRequest({ scope: scopeA });
    await repo.create(BrainAnalysisAggregate.create(reqA));

    // Tenant B cannot retrieve Tenant A's analysis
    const crossTenantFetch = await repo.findById(reqA.metadata.requestId, scopeB);
    assert.strictEqual(crossTenantFetch, null, "Tenant B must not see Tenant A analysis");

    // Tenant B cannot claim Tenant A's analysis
    const crossTenantClaim = await repo.claimExecution(reqA.metadata.requestId, scopeB);
    assert.strictEqual(
      crossTenantClaim,
      null,
      "Tenant B must not be able to claim Tenant A analysis",
    );

    // Tenant B cannot list Tenant A's analysis
    const tenantBList = await repo.listByScope(scopeB);
    assert.strictEqual(tenantBList.total, 0);

    const tenantAList = await repo.listByScope(scopeA);
    assert.strictEqual(tenantAList.total, 1);
  });

  test("6. idempotency unique index enforces single active record per idempotency key", async (t) => {
    if (!postgresAvailable) {
      t.skip("PostgreSQL not available");
      return;
    }

    const scopeA = new BrainScope({ tenantId: tenantAId, ownerId: ownerAId, actorId: actorAId });
    const idempotencyKey = `idem-${randomUUID()}`;

    const req1 = createTestRequest({ scope: scopeA, idempotencyKey });
    const req2 = createTestRequest({ scope: scopeA, idempotencyKey });

    await repo.create(BrainAnalysisAggregate.create(req1));

    // Attempting to insert duplicate active execution with same idempotency key throws domain duplicate error
    await assert.rejects(
      async () => repo.create(BrainAnalysisAggregate.create(req2)),
      /Concurrent duplicate analysis request detected/,
    );
  });

  test("7. stale orphan recovery transitions expired RUNNING records to TIMEOUT", async (t) => {
    if (!postgresAvailable) {
      t.skip("PostgreSQL not available");
      return;
    }

    const scopeA = new BrainScope({ tenantId: tenantAId, ownerId: ownerAId, actorId: actorAId });
    const req = createTestRequest({ scope: scopeA });
    const aggregate = BrainAnalysisAggregate.create(req, { staleTimeoutMs: 10000 });
    await repo.create(aggregate);

    // Manually set claimedAt to 2 minutes ago
    const twoMinutesAgo = new Date(Date.now() - 120000);
    await pool.query(
      `UPDATE brain_analyses SET status = 'RUNNING', claimed_at = $1 WHERE id = $2`,
      [twoMinutesAgo, req.metadata.requestId],
    );

    const threshold = new Date(Date.now() - 30000);
    const recovered = await repo.recoverStaleRunning(threshold);

    assert.strictEqual(recovered.length, 1);
    assert.strictEqual(recovered[0]?.id, req.metadata.requestId);
    assert.strictEqual(recovered[0]?.status, "TIMEOUT");
    assert.strictEqual(recovered[0]?.failure?.code, "PROVIDER_TIMEOUT");
    assert.strictEqual(recovered[0]?.failure?.retryable, true);

    const fromDb = await repo.findById(req.metadata.requestId, scopeA);
    assert.strictEqual(fromDb?.status, "TIMEOUT");
  });

  test("8. concurrent claim safety under parallel execution", async (t) => {
    if (!postgresAvailable) {
      t.skip("PostgreSQL not available");
      return;
    }

    const scopeA = new BrainScope({ tenantId: tenantAId, ownerId: ownerAId, actorId: actorAId });
    const req = createTestRequest({ scope: scopeA });
    await repo.create(BrainAnalysisAggregate.create(req));

    // 5 concurrent workers attempting to claim the same analysis simultaneously
    const claimPromises = Array.from({ length: 5 }, () =>
      repo.claimExecution(req.metadata.requestId, scopeA),
    );

    const claimResults = await Promise.all(claimPromises);
    const successfulClaims = claimResults.filter((c) => c !== null);

    assert.strictEqual(
      successfulClaims.length,
      1,
      "Exactly one worker must win the execution claim",
    );
  });
});
