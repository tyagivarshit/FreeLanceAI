import { describe, test } from "node:test";
import assert from "node:assert";
import {
  BrainAnalysisRequest,
  BrainConfidence,
  BrainContext,
  BrainDomainError,
  BrainEvidence,
  BrainExecutionService,
  BrainFailure,
  BrainRequestMetadata,
  BrainResult,
  BrainScope,
  BrainAnalysisAggregate,
  InMemoryBrainAnalysisRepository,
  SUPPORTED_BRAIN_ANALYSIS_TYPES,
  mapBrainError,
  parseBrainAnalysisType,
  OpportunityReviewEngine,
  FollowUpPrioritizationEngine,
  HeuristicBrainEngine,
  BrainContextOrchestrator,
  BrainDecisionDeriver,
  type BrainAnalysisRequest as BrainAnalysisRequestType,
  type BrainEngine,
  type BrainEntitlementGateway,
  type BrainResult as BrainResultType,
  type BrainPersistenceContract,
} from "./brain.js";

const scope = () =>
  new BrainScope({ tenantId: "tenant-1", ownerId: "owner-1", actorId: "actor-1" });

function context(overrides: Partial<ConstructorParameters<typeof BrainContext>[0]> = {}) {
  const brainScope = overrides.scope ?? scope();
  return new BrainContext({
    scope: brainScope,
    clients: [
      {
        signalId: "client-signal-1",
        tenantId: brainScope.tenantId,
        ownerId: brainScope.ownerId,
        clientId: "client-1",
        name: "Acme Corp",
        status: "Lead",
      },
    ],
    jobs: [
      {
        signalId: "job-signal-1",
        tenantId: brainScope.tenantId,
        ownerId: brainScope.ownerId,
        jobId: "job-1",
        title: "Build workflow automation",
        requiredSkills: ["typescript"],
      },
    ],
    matches: [
      {
        signalId: "match-signal-1",
        tenantId: brainScope.tenantId,
        ownerId: brainScope.ownerId,
        matchId: "match-1",
        jobId: "job-1",
        score: 0.81,
        strengths: ["typescript"],
        risks: ["timeline"],
      },
    ],
    timelines: [
      {
        signalId: "timeline-signal-1",
        tenantId: brainScope.tenantId,
        ownerId: brainScope.ownerId,
        timelineId: "timeline-1",
        clientId: "client-1",
        eventCount: 3,
        latestEventAt: new Date("2026-08-17T10:00:00.000Z"),
      },
    ],
    businessSignals: [
      {
        signalId: "metric-signal-1",
        tenantId: brainScope.tenantId,
        ownerId: brainScope.ownerId,
        metric: "open-opportunities",
        value: 2,
      },
    ],
    ...overrides,
  });
}

function metadata() {
  return new BrainRequestMetadata({
    requestId: "brain-request-1",
    correlationId: "corr-1",
    requestedAt: new Date("2026-08-17T10:00:00.000Z"),
    idempotencyKey: "idem-1",
  });
}

function request(overrides: Partial<ConstructorParameters<typeof BrainAnalysisRequest>[0]> = {}) {
  return new BrainAnalysisRequest({
    analysisType: "CLIENT_HEALTH",
    context: context(),
    metadata: metadata(),
    constraints: { maxInsights: 3, maxRecommendations: 3 },
    ...overrides,
  });
}

function evidence() {
  return new BrainEvidence({
    sourceType: "CLIENT_SIGNAL",
    sourceId: "client-signal-1",
    label: "Client status",
    excerpt: "Lead client with recent timeline activity",
  });
}

function result(overrides: Partial<ConstructorParameters<typeof BrainResult>[0]> = {}) {
  const ev = evidence();
  const confidence = new BrainConfidence({
    score: 0.74,
    level: "MEDIUM",
    supportingSignalCount: 2,
  });
  return new BrainResult({
    analysisId: "analysis-1",
    analysisType: "CLIENT_HEALTH",
    status: "COMPLETED",
    summary: "Client is warm but needs follow-up.",
    insights: [
      {
        insightId: "insight-1",
        title: "Follow-up needed",
        body: "Recent activity suggests a timely follow-up.",
        confidence,
        evidence: [ev],
      },
    ],
    recommendations: [
      {
        recommendationId: "recommendation-1",
        action: "Send a scoped follow-up",
        rationale: "Timeline activity is recent.",
        priority: "MEDIUM",
        evidence: [ev],
      },
    ],
    confidence,
    evidence: [ev],
    generatedAt: new Date("2026-08-17T10:01:00.000Z"),
    metadata: { safe: true },
    ...overrides,
  });
}

class StaticEngine implements BrainEngine {
  public constructor(private readonly output: BrainResultType = result()) {}

  public async analyze(): Promise<BrainResultType> {
    return this.output;
  }
}

class FailingEngine implements BrainEngine {
  public constructor(private readonly failure: unknown) {}

  public async analyze(): Promise<BrainResultType> {
    throw this.failure;
  }
}

class HangingEngine implements BrainEngine {
  public async analyze(): Promise<BrainResultType> {
    return await new Promise(() => undefined);
  }
}

function entitlement(allowed = true, unavailable = false): BrainEntitlementGateway {
  return {
    canUseBrain: async () => ({
      allowed,
      feature: "AI_PROPOSAL",
      reason: unavailable ? "UNAVAILABLE" : allowed ? "ALLOWED" : "DENIED",
    }),
  };
}

describe("Brain domain foundation", () => {
  test("1. valid Brain context", () => {
    const ctx = context();
    assert.strictEqual(ctx.scope.tenantId, "tenant-1");
    assert.strictEqual(ctx.signalCount, 5);
  });

  test("2. invalid context", () => {
    assert.throws(
      () => new BrainScope({ tenantId: "", ownerId: "owner-1", actorId: "actor-1" }),
      /Tenant ID is required/,
    );
  });

  test("3. missing required context", () => {
    assert.throws(
      () =>
        new BrainAnalysisRequest({
          analysisType: "CLIENT_HEALTH",
          context: new BrainContext({ scope: scope() }),
          metadata: metadata(),
        }),
      /requires authorized product context/,
    );
  });

  test("4. cross-owner context rejection", () => {
    assert.throws(
      () =>
        context({
          clients: [
            {
              signalId: "client-signal-2",
              tenantId: "tenant-1",
              ownerId: "owner-2",
              clientId: "client-2",
            },
          ],
        }),
      /cross-owner or cross-tenant/,
    );
  });

  test("5. cross-tenant context rejection", () => {
    assert.throws(
      () =>
        context({
          jobs: [
            {
              signalId: "job-signal-2",
              tenantId: "tenant-2",
              ownerId: "owner-1",
              jobId: "job-2",
            },
          ],
        }),
      /cross-owner or cross-tenant/,
    );
  });

  test("6. supported analysis types", () => {
    assert.deepStrictEqual(SUPPORTED_BRAIN_ANALYSIS_TYPES, [
      "CLIENT_HEALTH",
      "OPPORTUNITY_REVIEW",
      "FOLLOW_UP_PRIORITIZATION",
    ]);
    assert.strictEqual(parseBrainAnalysisType("client-health"), "CLIENT_HEALTH");
  });

  test("7. unsupported analysis type", () => {
    assert.throws(() => parseBrainAnalysisType("sql-agent"), /Unsupported Brain analysis type/);
  });

  test("8. valid analysis request", () => {
    const req = request();
    assert.strictEqual(req.analysisType, "CLIENT_HEALTH");
    assert.strictEqual(req.constraints.responseFormat, "structured");
  });

  test("9. invalid request", () => {
    assert.throws(
      () => request({ constraints: { maxRecommendations: 99 } }),
      /Maximum recommendations/,
    );
  });

  test("10. valid result", () => {
    assert.strictEqual(result().status, "COMPLETED");
  });

  test("11. invalid confidence", () => {
    assert.throws(
      () => new BrainConfidence({ score: Number.NaN, level: "LOW", supportingSignalCount: 0 }),
      /between 0 and 1/,
    );
    assert.throws(
      () => new BrainConfidence({ score: Infinity, level: "LOW", supportingSignalCount: 0 }),
      /between 0 and 1/,
    );
    assert.throws(
      () => new BrainConfidence({ score: -0.1, level: "LOW", supportingSignalCount: 0 }),
      /between 0 and 1/,
    );
    assert.throws(
      () => new BrainConfidence({ score: 1.1, level: "HIGH", supportingSignalCount: 0 }),
      /between 0 and 1/,
    );
  });

  test("12. invalid evidence", () => {
    assert.throws(
      () => new BrainEvidence({ sourceType: "CLIENT_SIGNAL", sourceId: "../secret", label: "Bad" }),
      /invalid reference format/,
    );
  });

  test("13. malformed result", () => {
    assert.throws(
      () => result({ insights: [], recommendations: [] }),
      /require insight or recommendation/,
    );
  });

  test("14. insufficient context", () => {
    assert.throws(
      () => request({ analysisType: "OPPORTUNITY_REVIEW", context: context({ jobs: [] }) }),
      /requires job signals/,
    );
  });

  test("15. typed failure mapping", () => {
    const failure = mapBrainError(new BrainDomainError("PROVIDER_TIMEOUT", "Timed out"));
    assert.strictEqual(failure.code, "PROVIDER_TIMEOUT");
    assert.strictEqual(failure.retryable, true);
  });
});

describe("Brain provider boundary", () => {
  test("16. provider abstraction contract", async () => {
    const service = new BrainExecutionService({
      engine: new StaticEngine(),
      entitlementGateway: entitlement(),
    });
    const output = await service.analyze(request());
    assert.strictEqual(output.status, "COMPLETED");
  });

  test("17. provider timeout", async () => {
    const service = new BrainExecutionService({
      engine: new HangingEngine(),
      entitlementGateway: entitlement(),
      defaultTimeoutMs: 5,
    });
    const output = await service.analyze(request());
    assert.strictEqual(output.failure?.code, "PROVIDER_TIMEOUT");
  });

  test("18. provider unavailable", async () => {
    const service = new BrainExecutionService({
      engine: new FailingEngine(new Error("sdk key missing at /tmp/path")),
      entitlementGateway: entitlement(),
    });
    const output = await service.analyze(request());
    assert.strictEqual(output.failure?.code, "PROVIDER_UNAVAILABLE");
    assert.doesNotMatch(output.toJSON().summary, /sdk key|\/tmp/);
  });

  test("19. malformed provider result", async () => {
    const malformed = {
      toJSON: () => ({
        ...result().toJSON(),
        confidence: new BrainConfidence({ score: 2, level: "HIGH", supportingSignalCount: 1 }),
      }),
    };
    const service = new BrainExecutionService({
      engine: new StaticEngine(malformed as unknown as BrainResultType),
      entitlementGateway: entitlement(),
    });
    const output = await service.analyze(request());
    assert.strictEqual(output.failure?.code, "MALFORMED_PROVIDER_OUTPUT");
  });

  test("20. provider-independent domain behavior", async () => {
    const req = request();
    const engine: BrainEngine = {
      analyze: async (received: BrainAnalysisRequestType) => {
        assert.strictEqual(received.context.scope.ownerId, "owner-1");
        return result();
      },
    };
    const output = await new BrainExecutionService({
      engine,
      entitlementGateway: entitlement(),
    }).analyze(req);
    assert.strictEqual(output.status, "COMPLETED");
  });
});

describe("Brain entitlement boundary", () => {
  test("21. entitlement allowed", async () => {
    const output = await new BrainExecutionService({
      engine: new StaticEngine(),
      entitlementGateway: entitlement(true),
    }).analyze(request());
    assert.strictEqual(output.status, "COMPLETED");
  });

  test("22. entitlement denied", async () => {
    const output = await new BrainExecutionService({
      engine: new StaticEngine(),
      entitlementGateway: entitlement(false),
    }).analyze(request());
    assert.strictEqual(output.failure?.code, "UNAUTHORIZED_CONTEXT");
  });

  test("23. entitlement unavailable", async () => {
    const output = await new BrainExecutionService({
      engine: new StaticEngine(),
      entitlementGateway: {
        canUseBrain: async () => {
          throw new Error("billing db down");
        },
      },
    }).analyze(request());
    assert.strictEqual(output.failure?.code, "ENTITLEMENT_UNAVAILABLE");
  });

  test("24. Brain does not duplicate billing logic", async () => {
    let observedFeature = "";
    const gateway: BrainEntitlementGateway = {
      canUseBrain: async (_scope, _analysisType) => {
        observedFeature = "AI_PROPOSAL";
        return { allowed: true, feature: "AI_PROPOSAL", reason: "ALLOWED" };
      },
    };
    await new BrainExecutionService({
      engine: new StaticEngine(),
      entitlementGateway: gateway,
    }).analyze(request());
    assert.strictEqual(observedFeature, "AI_PROPOSAL");
  });
});

describe("Brain security and serialization", () => {
  test("25. no owner spoofing", () => {
    assert.throws(
      () =>
        context({
          businessSignals: [
            {
              signalId: "m1",
              tenantId: "tenant-1",
              ownerId: "spoofed-owner",
              metric: "mrr",
              value: 1,
            },
          ],
        }),
      /cross-owner or cross-tenant/,
    );
  });

  test("26. no tenant spoofing", () => {
    assert.throws(
      () =>
        context({
          businessSignals: [
            {
              signalId: "m1",
              tenantId: "spoofed-tenant",
              ownerId: "owner-1",
              metric: "mrr",
              value: 1,
            },
          ],
        }),
      /cross-owner or cross-tenant/,
    );
  });

  test("27. no secret serialization", () => {
    assert.throws(() => result({ metadata: { providerToken: "secret" } }), /secret fields/);
  });

  test("28. no provider credential leakage", async () => {
    const output = await new BrainExecutionService({
      engine: new FailingEngine(new Error("OPENAI_API_KEY=secret")),
      entitlementGateway: entitlement(),
    }).analyze(request());
    assert.doesNotMatch(JSON.stringify(output), /OPENAI|secret/);
  });

  test("29. result serialization", () => {
    const serialized = JSON.stringify(result());
    assert.match(serialized, /Client is warm/);
    assert.doesNotThrow(() => JSON.parse(serialized));
  });

  test("30. circular reference protection", () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    assert.throws(() => result({ metadata: circular as never }), /circular references/);
  });

  test("31. unknown fields behavior", () => {
    const output = result({ metadata: { allowedFlag: true } }).toJSON();
    assert.deepStrictEqual(output.metadata, { allowedFlag: true });
    assert.strictEqual(
      (output as unknown as { providerConfig?: unknown }).providerConfig,
      undefined,
    );
  });

  test("32. analysis result attaches authenticated scope context", async () => {
    const service = new BrainExecutionService({
      engine: new StaticEngine(),
      entitlementGateway: entitlement(),
    });
    const res = await service.analyze(request());
    assert.strictEqual(res.scope?.tenantId, "tenant-1");
    assert.strictEqual(res.scope?.ownerId, "owner-1");
    assert.strictEqual(res.scope?.actorId, "actor-1");
  });

  test("33. persisted analysis is strictly scoped to authenticated ownership", async () => {
    const repository = new InMemoryBrainAnalysisRepository();
    const ownerScope = new BrainScope({
      tenantId: "tenant-A",
      ownerId: "owner-A",
      actorId: "user-A",
    });
    const crossOwnerScope = new BrainScope({
      tenantId: "tenant-A",
      ownerId: "owner-B",
      actorId: "user-B",
    });
    const crossTenantScope = new BrainScope({
      tenantId: "tenant-B",
      ownerId: "owner-A",
      actorId: "user-A",
    });

    const req = new BrainAnalysisRequest({
      analysisType: "CLIENT_HEALTH",
      context: context({ scope: ownerScope }),
      metadata: new BrainRequestMetadata({
        requestId: "analysis-A",
        correlationId: "corr-A",
        requestedAt: new Date("2026-08-17T10:00:00.000Z"),
      }),
    });

    const aggregate = BrainAnalysisAggregate.create(req);
    await repository.create(aggregate);

    // Fetch with matching authenticated scope
    const fetched = await repository.findById("analysis-A", ownerScope);
    assert.strictEqual(fetched?.id, "analysis-A");
    assert.strictEqual(fetched?.scope.ownerId, "owner-A");

    // Cross-owner fetch returns null (isolated)
    const crossOwnerFetched = await repository.findById("analysis-A", crossOwnerScope);
    assert.strictEqual(crossOwnerFetched, null);

    // Cross-tenant fetch returns null (isolated)
    const crossTenantFetched = await repository.findById("analysis-A", crossTenantScope);
    assert.strictEqual(crossTenantFetched, null);

    // Cross-owner claim is rejected
    await assert.rejects(
      async () => repository.claimExecution("analysis-A", crossOwnerScope),
      /Cannot claim analysis across tenant\/owner boundary/,
    );
  });

  test("34. persistence contract verifies scoped uniqueness", async () => {
    const uniqueIds = new Set(["tenant-1:owner-1:analysis-1"]);
    const contract: BrainPersistenceContract = {
      checkUniqueAnalysisId: async (tenantId, ownerId, analysisId) => {
        return !uniqueIds.has(`${tenantId}:${ownerId}:${analysisId}`);
      },
    };
    const isUnique = await contract.checkUniqueAnalysisId("tenant-1", "owner-1", "analysis-1");
    assert.strictEqual(isUnique, false);
    const isUniqueOther = await contract.checkUniqueAnalysisId("tenant-1", "owner-2", "analysis-1");
    assert.strictEqual(isUniqueOther, true);
  });

  test("35. typed failure result requires sanitized public message", () => {
    const failure = new BrainFailure({ code: "INTERNAL_FAILURE", message: "Internal failure" });
    assert.deepStrictEqual(failure.toJSON(), {
      code: "INTERNAL_FAILURE",
      message: "Internal failure",
      retryable: false,
    });
  });
});

describe("Brain Analysis Lifecycle & State Machine", () => {
  test("36. valid state transition sequence: REQUESTED -> RUNNING -> COMPLETED", () => {
    const req = request();
    const agg = BrainAnalysisAggregate.create(req);
    assert.strictEqual(agg.status, "REQUESTED");
    assert.strictEqual(agg.attemptCount, 0);

    agg.claim("actor-1");
    assert.strictEqual(agg.status, "RUNNING");
    assert.strictEqual(agg.attemptCount, 1);
    assert.ok(agg.claimedAt);

    agg.complete(result());
    assert.strictEqual(agg.status, "COMPLETED");
    assert.ok(agg.completedAt);
    assert.strictEqual(agg.summary, "Client is warm but needs follow-up.");
  });

  test("37. valid failure state transitions: RUNNING -> FAILED / TIMEOUT / INSUFFICIENT_CONTEXT", () => {
    const agg1 = BrainAnalysisAggregate.create(request());
    agg1.claim("actor-1");
    agg1.fail(
      new BrainFailure({ code: "PROVIDER_UNAVAILABLE", message: "Provider is down" }),
      "FAILED",
    );
    assert.strictEqual(agg1.status, "FAILED");

    const agg2 = BrainAnalysisAggregate.create(request());
    agg2.claim("actor-1");
    agg2.fail(
      new BrainFailure({ code: "PROVIDER_TIMEOUT", message: "Provider timed out" }),
      "TIMEOUT",
    );
    assert.strictEqual(agg2.status, "TIMEOUT");

    const agg3 = BrainAnalysisAggregate.create(request());
    agg3.claim("actor-1");
    agg3.fail(
      new BrainFailure({ code: "INSUFFICIENT_CONTEXT", message: "Context missing" }),
      "INSUFFICIENT_CONTEXT",
    );
    assert.strictEqual(agg3.status, "INSUFFICIENT_CONTEXT");
  });

  test("38. invalid lifecycle transitions throw explicit domain errors", () => {
    const agg = BrainAnalysisAggregate.create(request());
    // Direct complete from REQUESTED
    assert.throws(
      () => agg.complete(result()),
      /Invalid lifecycle transition from REQUESTED to COMPLETED/,
    );

    agg.claim("actor-1");
    agg.complete(result());
    // Transitioning from COMPLETED
    assert.throws(
      () => agg.claim("actor-1"),
      /Invalid lifecycle transition from COMPLETED to RUNNING/,
    );
    assert.throws(
      () => agg.complete(result()),
      /Invalid lifecycle transition from COMPLETED to COMPLETED/,
    );
  });

  test("39. bounded retry attempts enforcement", () => {
    const agg = BrainAnalysisAggregate.create(request(), { maxAttempts: 1 });
    agg.claim("actor-1");
    assert.strictEqual(agg.attemptCount, 1);
    agg.fail(new BrainFailure({ code: "PROVIDER_TIMEOUT", message: "Timeout" }));
    // Next attempt exceeds max
    assert.throws(() => agg.claim("actor-1"), /Invalid lifecycle transition/);
  });
});

describe("Brain Execution Service with Persistence & Idempotency", () => {
  test("40. canonical execution service persists completed analysis", async () => {
    const repository = new InMemoryBrainAnalysisRepository();
    const service = new BrainExecutionService({
      engine: new StaticEngine(),
      entitlementGateway: entitlement(),
      repository,
    });

    const res = await service.analyze(request());
    assert.strictEqual(res.status, "COMPLETED");

    const stored = await repository.findById(request().metadata.requestId, request().context.scope);
    assert.strictEqual(stored?.status, "COMPLETED");
    assert.strictEqual(stored?.summary, "Client is warm but needs follow-up.");
  });

  test("41. idempotency key returns authoritative cached completed result without re-execution", async () => {
    let executionCalls = 0;
    const engine: BrainEngine = {
      analyze: async () => {
        executionCalls++;
        return result();
      },
    };

    const repository = new InMemoryBrainAnalysisRepository();
    const service = new BrainExecutionService({
      engine,
      entitlementGateway: entitlement(),
      repository,
    });

    const req1 = request();
    const req2 = request();

    const res1 = await service.analyze(req1);
    const res2 = await service.analyze(req2);

    assert.strictEqual(res1.status, "COMPLETED");
    assert.strictEqual(res2.status, "COMPLETED");
    assert.strictEqual(
      executionCalls,
      1,
      "Engine must only be called once for same idempotency key",
    );
  });

  test("42. concurrent duplicate requests with same idempotency key handled safely", async () => {
    let executionCount = 0;
    const engine: BrainEngine = {
      analyze: async () => {
        executionCount++;
        await new Promise((r) => setTimeout(r, 10));
        return result();
      },
    };

    const repository = new InMemoryBrainAnalysisRepository();
    const service = new BrainExecutionService({
      engine,
      entitlementGateway: entitlement(),
      repository,
    });

    const [resA, resB] = await Promise.all([
      service.analyze(request()),
      service.analyze(request()),
    ]);

    assert.strictEqual(resA.status, "COMPLETED");
    assert.strictEqual(resB.status, "COMPLETED");
    assert.strictEqual(executionCount, 1);
  });
});

describe("Orphaned RUNNING Recovery & Timeout", () => {
  test("43. orphaned stale running analysis is identified and recovered", async () => {
    const repository = new InMemoryBrainAnalysisRepository();
    const staleClaimDate = new Date(Date.now() - 60000); // 60s ago

    const agg = BrainAnalysisAggregate.create(request(), { staleTimeoutMs: 30000 });
    await repository.create(agg);
    await repository.claimExecution(agg.id, agg.scope, staleClaimDate);

    // Stale threshold is 30s ago
    const threshold = new Date(Date.now() - 30000);
    const recovered = await repository.recoverStaleRunning(threshold);

    assert.strictEqual(recovered.length, 1);
    assert.strictEqual(recovered[0]?.status, "TIMEOUT");
    assert.strictEqual(recovered[0]?.failure?.code, "PROVIDER_TIMEOUT");
    assert.strictEqual(recovered[0]?.failure?.retryable, true);

    const stored = await repository.findById(agg.id, agg.scope);
    assert.strictEqual(stored?.status, "TIMEOUT");
  });

  test("44. non-stale running analysis is not prematurely recovered", async () => {
    const repository = new InMemoryBrainAnalysisRepository();
    const recentClaimDate = new Date(Date.now() - 5000); // 5s ago

    const agg = BrainAnalysisAggregate.create(request(), { staleTimeoutMs: 30000 });
    await repository.create(agg);
    await repository.claimExecution(agg.id, agg.scope, recentClaimDate);

    const threshold = new Date(Date.now() - 30000);
    const recovered = await repository.recoverStaleRunning(threshold);

    assert.strictEqual(recovered.length, 0);

    const stored = await repository.findById(agg.id, agg.scope);
    assert.strictEqual(stored?.status, "RUNNING");
  });
});

describe("Opportunity Review & Heuristic Brain Engines", () => {
  test("45. OpportunityReviewEngine generates skill alignment insights, gap assessments, and recommendations", async () => {
    const engine = new OpportunityReviewEngine();
    const sc = scope();
    const ctx = new BrainContext({
      scope: sc,
      jobs: [
        {
          signalId: "job-sig-1",
          tenantId: sc.tenantId,
          ownerId: sc.ownerId,
          jobId: "job-101",
          title: "Senior Fullstack TypeScript Engineer",
          source: "UPWORK",
          requiredSkills: ["TypeScript", "Node.js", "PostgreSQL", "GraphQL"],
        },
      ],
      matches: [
        {
          signalId: "match-sig-1",
          tenantId: sc.tenantId,
          ownerId: sc.ownerId,
          matchId: "match-101",
          jobId: "job-101",
          score: 0.85,
          strengths: ["TypeScript", "Node.js", "PostgreSQL"],
          risks: ["GraphQL proficiency not verified in recent milestones"],
        },
      ],
    });

    const req = new BrainAnalysisRequest({
      analysisType: "OPPORTUNITY_REVIEW",
      context: ctx,
      metadata: new BrainRequestMetadata({
        requestId: "req-opp-1",
        correlationId: "corr-opp-1",
        requestedAt: new Date(),
      }),
    });

    const res = await engine.analyze(req);
    assert.strictEqual(res.status, "COMPLETED");
    assert.strictEqual(res.analysisType, "OPPORTUNITY_REVIEW");
    assert.ok(res.summary.includes("Senior Fullstack TypeScript Engineer"));
    assert.ok(res.insights.length >= 2);
    assert.ok(res.recommendations.length >= 2);
    assert.strictEqual(res.confidence.level, "HIGH");
    assert.ok(res.confidence.score >= 0.8);
    assert.ok(res.evidence.length >= 2);

    const alignmentInsight = res.insights.find((i) => i.title.includes("Skill Alignment"));
    assert.ok(alignmentInsight);
    assert.ok(alignmentInsight?.body.includes("TypeScript, Node.js, PostgreSQL"));

    const gapInsight = res.insights.find((i) => i.title.includes("Skill Gaps"));
    assert.ok(gapInsight);
    assert.ok(gapInsight?.body.includes("GraphQL"));

    const highRec = res.recommendations.find((r) => r.priority === "HIGH");
    assert.ok(highRec);
    assert.ok(highRec?.action.length > 0);
  });

  test("46. OpportunityReviewEngine handles jobs without matches gracefully", async () => {
    const engine = new OpportunityReviewEngine();
    const sc = scope();
    const ctx = new BrainContext({
      scope: sc,
      jobs: [
        {
          signalId: "job-sig-2",
          tenantId: sc.tenantId,
          ownerId: sc.ownerId,
          jobId: "job-102",
          title: "Solana Smart Contract Auditor",
          source: "DIRECT_IMPORT",
          requiredSkills: ["Rust", "Solana", "Anchor"],
        },
      ],
    });

    const req = new BrainAnalysisRequest({
      analysisType: "OPPORTUNITY_REVIEW",
      context: ctx,
      metadata: new BrainRequestMetadata({
        requestId: "req-opp-2",
        correlationId: "corr-opp-2",
        requestedAt: new Date(),
      }),
    });

    const res = await engine.analyze(req);
    assert.strictEqual(res.status, "COMPLETED");
    assert.ok(res.insights.length >= 1);
    assert.ok(res.recommendations.length >= 2);
  });

  test("47. OpportunityReviewEngine incorporates client context when client signals exist", async () => {
    const engine = new OpportunityReviewEngine();
    const sc = scope();
    const ctx = new BrainContext({
      scope: sc,
      jobs: [
        {
          signalId: "job-sig-3",
          tenantId: sc.tenantId,
          ownerId: sc.ownerId,
          jobId: "job-103",
          title: "AI Pipeline Architect",
          source: "LINKEDIN",
          requiredSkills: ["Python", "FastAPI"],
        },
      ],
      clients: [
        {
          signalId: "client-sig-3",
          tenantId: sc.tenantId,
          ownerId: sc.ownerId,
          clientId: "client-vip-1",
          name: "Stripe Enterprise",
          status: "ACTIVE",
        },
      ],
    });

    const req = new BrainAnalysisRequest({
      analysisType: "OPPORTUNITY_REVIEW",
      context: ctx,
      metadata: new BrainRequestMetadata({
        requestId: "req-opp-3",
        correlationId: "corr-opp-3",
        requestedAt: new Date(),
      }),
    });

    const res = await engine.analyze(req);
    assert.strictEqual(res.status, "COMPLETED");
    const clientInsight = res.insights.find((i) => i.title.includes("Existing Client Context"));
    assert.ok(clientInsight);
    assert.ok(clientInsight?.body.includes("Stripe Enterprise"));
  });

  test("48. OpportunityReviewEngine enforces maxInsights and maxRecommendations constraints", async () => {
    const engine = new OpportunityReviewEngine();
    const sc = scope();
    const ctx = new BrainContext({
      scope: sc,
      jobs: [
        {
          signalId: "job-sig-4",
          tenantId: sc.tenantId,
          ownerId: sc.ownerId,
          jobId: "job-104",
          title: "DevOps Engineer",
          source: "UPWORK",
          requiredSkills: ["Docker", "Kubernetes", "Terraform"],
        },
      ],
      clients: [
        {
          signalId: "client-sig-4",
          tenantId: sc.tenantId,
          ownerId: sc.ownerId,
          clientId: "client-4",
          name: "CloudTech",
          status: "ACTIVE",
        },
      ],
    });

    const req = new BrainAnalysisRequest({
      analysisType: "OPPORTUNITY_REVIEW",
      context: ctx,
      metadata: new BrainRequestMetadata({
        requestId: "req-opp-4",
        correlationId: "corr-opp-4",
        requestedAt: new Date(),
      }),
      constraints: {
        maxInsights: 1,
        maxRecommendations: 1,
      },
    });

    const res = await engine.analyze(req);
    assert.strictEqual(res.insights.length, 1);
    assert.strictEqual(res.recommendations.length, 1);
  });

  test("49. OpportunityReviewEngine rejects unsupported analysis types", async () => {
    const engine = new OpportunityReviewEngine();
    const sc = scope();
    const ctx = new BrainContext({
      scope: sc,
      clients: [
        {
          signalId: "client-sig-5",
          tenantId: sc.tenantId,
          ownerId: sc.ownerId,
          clientId: "client-5",
          name: "Acme",
        },
      ],
    });

    const req = new BrainAnalysisRequest({
      analysisType: "CLIENT_HEALTH",
      context: ctx,
      metadata: new BrainRequestMetadata({
        requestId: "req-opp-5",
        correlationId: "corr-opp-5",
        requestedAt: new Date(),
      }),
    });

    await assert.rejects(
      async () => engine.analyze(req),
      /OpportunityReviewEngine does not support CLIENT_HEALTH/,
    );
  });

  test("50. HeuristicBrainEngine dispatches OPPORTUNITY_REVIEW, CLIENT_HEALTH, and FOLLOW_UP_PRIORITIZATION", async () => {
    const engine = new HeuristicBrainEngine();
    const sc = scope();

    // 1. Opportunity Review
    const oppCtx = new BrainContext({
      scope: sc,
      jobs: [
        {
          signalId: "job-sig-6",
          tenantId: sc.tenantId,
          ownerId: sc.ownerId,
          jobId: "job-106",
          title: "Backend Engineer",
          source: "UPWORK",
        },
      ],
    });
    const oppRes = await engine.analyze(
      new BrainAnalysisRequest({
        analysisType: "OPPORTUNITY_REVIEW",
        context: oppCtx,
        metadata: new BrainRequestMetadata({
          requestId: "req-h-1",
          correlationId: "corr-h-1",
          requestedAt: new Date(),
        }),
      }),
      { timeoutMs: 5000 },
    );
    assert.strictEqual(oppRes.status, "COMPLETED");
    assert.strictEqual(oppRes.analysisType, "OPPORTUNITY_REVIEW");

    // 2. Client Health
    const clientCtx = new BrainContext({
      scope: sc,
      clients: [
        {
          signalId: "client-sig-6",
          tenantId: sc.tenantId,
          ownerId: sc.ownerId,
          clientId: "client-6",
          name: "Beta Corp",
          status: "ACTIVE",
        },
      ],
    });
    const clientRes = await engine.analyze(
      new BrainAnalysisRequest({
        analysisType: "CLIENT_HEALTH",
        context: clientCtx,
        metadata: new BrainRequestMetadata({
          requestId: "req-h-2",
          correlationId: "corr-h-2",
          requestedAt: new Date(),
        }),
      }),
      { timeoutMs: 5000 },
    );
    assert.strictEqual(clientRes.status, "COMPLETED");
    assert.strictEqual(clientRes.analysisType, "CLIENT_HEALTH");

    // 3. Follow-up Prioritization
    const timelineCtx = new BrainContext({
      scope: sc,
      timelines: [
        {
          signalId: "tl-sig-6",
          tenantId: sc.tenantId,
          ownerId: sc.ownerId,
          timelineId: "tl-6",
          clientId: "client-6",
          eventCount: 3,
          latestEventAt: new Date(Date.now() - 86400000),
        },
      ],
    });
    const timelineRes = await engine.analyze(
      new BrainAnalysisRequest({
        analysisType: "FOLLOW_UP_PRIORITIZATION",
        context: timelineCtx,
        metadata: new BrainRequestMetadata({
          requestId: "req-h-3",
          correlationId: "corr-h-3",
          requestedAt: new Date(),
        }),
      }),
      { timeoutMs: 5000 },
    );
    assert.strictEqual(timelineRes.status, "COMPLETED");
    assert.strictEqual(timelineRes.analysisType, "FOLLOW_UP_PRIORITIZATION");
  });

  test("51. FollowUpPrioritizationEngine prioritizes inactive timelines with evidence provenance", async () => {
    const engine = new FollowUpPrioritizationEngine();
    const sc = scope();
    const olderDate = new Date(Date.now() - 14 * 86400000); // 14 days ago
    const ctx = new BrainContext({
      scope: sc,
      timelines: [
        {
          signalId: "tl-sig-active",
          tenantId: sc.tenantId,
          ownerId: sc.ownerId,
          timelineId: "tl-active",
          clientId: "client-active",
          eventCount: 15,
          latestEventAt: new Date(),
        },
        {
          signalId: "tl-sig-inactive",
          tenantId: sc.tenantId,
          ownerId: sc.ownerId,
          timelineId: "tl-inactive",
          clientId: "client-inactive",
          eventCount: 2,
          latestEventAt: olderDate,
        },
      ],
      clients: [
        {
          signalId: "client-sig-inactive",
          tenantId: sc.tenantId,
          ownerId: sc.ownerId,
          clientId: "client-inactive",
          name: "Acme Enterprises",
          status: "INACTIVE",
        },
      ],
    });

    const res = await engine.analyze(
      new BrainAnalysisRequest({
        analysisType: "FOLLOW_UP_PRIORITIZATION",
        context: ctx,
        metadata: new BrainRequestMetadata({
          requestId: "req-fup-1",
          correlationId: "corr-fup-1",
          requestedAt: new Date(),
        }),
      }),
    );

    assert.strictEqual(res.status, "COMPLETED");
    assert.strictEqual(res.analysisType, "FOLLOW_UP_PRIORITIZATION");
    assert.ok(res.summary.includes("tl-inactive"));
    assert.ok(res.insights.some((i) => i.title.includes("Recency & Inactivity")));
    assert.ok(res.insights.some((i) => i.body.includes("Acme Enterprises")));
    assert.ok(res.recommendations.some((r) => r.priority === "HIGH"));
    assert.ok(res.evidence.length >= 2);
  });

  test("52. FollowUpPrioritizationEngine rejects non-FOLLOW_UP_PRIORITIZATION requests", async () => {
    const engine = new FollowUpPrioritizationEngine();
    const sc = scope();
    const ctx = new BrainContext({
      scope: sc,
      jobs: [
        {
          signalId: "job-1",
          tenantId: sc.tenantId,
          ownerId: sc.ownerId,
          jobId: "j1",
        },
      ],
    });

    const req = new BrainAnalysisRequest({
      analysisType: "OPPORTUNITY_REVIEW",
      context: ctx,
      metadata: new BrainRequestMetadata({
        requestId: "req-fup-2",
        correlationId: "corr-fup-2",
        requestedAt: new Date(),
      }),
    });

    await assert.rejects(
      async () => engine.analyze(req),
      /FollowUpPrioritizationEngine does not support OPPORTUNITY_REVIEW/,
    );
  });

  test("53. BrainContextOrchestrator resolves bounded signals across repositories without N+1 or full scans", async () => {
    const sc = scope();
    const mockClientRepo = {
      findById: async (id: string, ownerId: string) => {
        if (id === "c1" && ownerId === sc.ownerId) {
          return { id: "c1", profile: { name: "Client One" }, status: "ACTIVE" };
        }
        return null;
      },
    };
    const mockJobsRepo = {
      findById: async (id: string, tenantId: string) => {
        if (id === "j1" && tenantId === sc.ownerId) {
          return {
            id: "j1",
            rawPayload: { data: { title: "Lead AI Engineer", skills: ["Python", "Rust"] } },
            externalIdentity: { source: { value: "UPWORK" } },
          };
        }
        return null;
      },
    };
    const mockMatchRepo = {
      findById: async (id: string, tenantId: string) => {
        if (id === "m1" && tenantId === sc.ownerId) {
          return {
            id: "m1",
            jobId: "j1",
            matchSignals: { semanticSimilarity: 0.9, matchedSkills: ["Python"] },
          };
        }
        return null;
      },
    };
    const mockTimelineRepo = {
      findById: async (id: string, ownerId: string) => {
        if (id === "t1" && ownerId === sc.ownerId) {
          return {
            timelineId: "t1",
            clientId: "c1",
            entries: [{ timestamp: new Date() }],
          };
        }
        return null;
      },
    };

    const orchestrator = new BrainContextOrchestrator({
      clientRepo: mockClientRepo,
      jobsRepo: mockJobsRepo,
      matchRepo: mockMatchRepo,
      timelineRepo: mockTimelineRepo,
    });

    const ctx = await orchestrator.buildContext({
      analysisType: "OPPORTUNITY_REVIEW",
      scope: sc,
      clientIds: ["c1"],
      jobIds: ["j1"],
      matchIds: ["m1"],
      timelineIds: ["t1"],
      businessSignals: [{ metric: "win_rate", value: 0.75, unit: "percent" }],
    });

    assert.strictEqual(ctx.clients.length, 1);
    assert.strictEqual(ctx.jobs.length, 1);
    assert.strictEqual(ctx.matches.length, 1);
    assert.strictEqual(ctx.timelines.length, 1);
    assert.strictEqual(ctx.businessSignals.length, 1);
    assert.strictEqual(ctx.scope.ownerId, sc.ownerId);
  });

  test("54. BrainContextOrchestrator rejects missing or unauthorized foreign resources", async () => {
    const sc = scope();
    const orchestrator = new BrainContextOrchestrator({
      clientRepo: {
        findById: async () => null,
      },
    });

    await assert.rejects(
      async () =>
        orchestrator.buildContext({
          analysisType: "CLIENT_HEALTH",
          scope: sc,
          clientIds: ["foreign-client"],
        }),
      /Referenced client not found/,
    );
  });

  test("55. BrainDecisionDeriver derives deterministic ClientHealthDecision from completed BrainResult", () => {
    const deriver = new BrainDecisionDeriver();
    const sc = scope();
    const evidence = [
      new BrainEvidence({
        sourceType: "CLIENT_SIGNAL",
        sourceId: "cs-1",
        label: "Client: Acme",
      }),
    ];
    const confidence = new BrainConfidence({
      score: 0.85,
      level: "HIGH",
      supportingSignalCount: 1,
    });

    const healthyResult = new BrainResult({
      analysisId: "analysis-ch-1",
      analysisType: "CLIENT_HEALTH",
      status: "COMPLETED",
      summary: "Client health evaluation for Acme: Stable and active.",
      insights: [
        {
          insightId: "ins-1",
          title: "Engagement Health",
          body: "Client Acme is in ACTIVE status with positive historical cadence.",
          confidence,
          evidence,
        },
      ],
      recommendations: [
        {
          recommendationId: "rec-1",
          action: "Schedule periodic touchpoint",
          rationale: "Maintains high satisfaction",
          priority: "LOW",
          evidence,
        },
      ],
      confidence,
      evidence,
      generatedAt: new Date(),
      scope: sc,
    });

    const decision = deriver.deriveClientHealthDecision(healthyResult);
    assert.strictEqual(decision.analysisId, "analysis-ch-1");
    assert.strictEqual(decision.decisionType, "CLIENT_HEALTH");
    assert.strictEqual(decision.status, "HEALTHY");
    assert.strictEqual(decision.priority, "LOW");
    assert.strictEqual(decision.freshness, "FRESH");
    assert.strictEqual(decision.confidence.score, 0.85);
    assert.strictEqual(decision.evidence.length, 1);
  });

  test("56. BrainDecisionDeriver derives OpportunityDecision with STRONG, REVIEW_REQUIRED, and WEAK states", () => {
    const deriver = new BrainDecisionDeriver();
    const sc = scope();
    const evidence = [
      new BrainEvidence({
        sourceType: "JOB_SIGNAL",
        sourceId: "js-1",
        label: "Job: Lead Engineer",
      }),
    ];

    const strongConfidence = new BrainConfidence({
      score: 0.9,
      level: "HIGH",
      supportingSignalCount: 2,
    });
    const strongResult = new BrainResult({
      analysisId: "analysis-opp-strong",
      analysisType: "OPPORTUNITY_REVIEW",
      status: "COMPLETED",
      summary: "Strong opportunity review",
      insights: [
        {
          insightId: "ins-1",
          title: "Strong Match",
          body: "High skill overlap",
          confidence: strongConfidence,
          evidence,
        },
      ],
      recommendations: [
        {
          recommendationId: "rec-1",
          action: "Lead proposal with verified portfolio",
          rationale: "Aligns strengths",
          priority: "HIGH",
          evidence,
        },
      ],
      confidence: strongConfidence,
      evidence,
      generatedAt: new Date(),
      scope: sc,
    });

    const strongDecision = deriver.deriveOpportunityDecision(strongResult);
    assert.strictEqual(strongDecision.status, "STRONG_OPPORTUNITY");
    assert.strictEqual(strongDecision.priority, "HIGH");

    const weakConfidence = new BrainConfidence({
      score: 0.3,
      level: "LOW",
      supportingSignalCount: 1,
    });
    const weakResult = new BrainResult({
      analysisId: "analysis-opp-weak",
      analysisType: "OPPORTUNITY_REVIEW",
      status: "COMPLETED",
      summary: "Weak opportunity review",
      insights: [
        {
          insightId: "ins-2",
          title: "Low Match",
          body: "Significant skill gaps",
          confidence: weakConfidence,
          evidence,
        },
      ],
      recommendations: [],
      confidence: weakConfidence,
      evidence,
      generatedAt: new Date(),
      scope: sc,
    });

    const weakDecision = deriver.deriveOpportunityDecision(weakResult);
    assert.strictEqual(weakDecision.status, "WEAK_OPPORTUNITY");
    assert.strictEqual(weakDecision.priority, "LOW");
  });

  test("57. BrainDecisionDeriver derives FollowUpDecision preserving highest recommendation priority", () => {
    const deriver = new BrainDecisionDeriver();
    const sc = scope();
    const evidence = [
      new BrainEvidence({
        sourceType: "TIMELINE_SIGNAL",
        sourceId: "tls-1",
        label: "Timeline: tl-1",
      }),
    ];
    const confidence = new BrainConfidence({ score: 0.8, level: "HIGH", supportingSignalCount: 1 });

    const fupResult = new BrainResult({
      analysisId: "analysis-fup-1",
      analysisType: "FOLLOW_UP_PRIORITIZATION",
      status: "COMPLETED",
      summary: "Follow-up prioritization completed",
      insights: [
        {
          insightId: "ins-1",
          title: "Inactivity Alert",
          body: "14 days since last event",
          confidence,
          evidence,
        },
      ],
      recommendations: [
        {
          recommendationId: "rec-1",
          action: "Send proactive status check-in",
          rationale: "Prevents stagnation",
          priority: "HIGH",
          evidence,
        },
      ],
      confidence,
      evidence,
      generatedAt: new Date(),
      scope: sc,
    });

    const decision = deriver.deriveFollowUpDecision(fupResult);
    assert.strictEqual(decision.analysisId, "analysis-fup-1");
    assert.strictEqual(decision.decisionType, "FOLLOW_UP_PRIORITIZATION");
    assert.strictEqual(decision.priority, "HIGH");
    assert.strictEqual(decision.freshness, "FRESH");
  });

  test("58. BrainDecisionDeriver distinguishes FRESH vs STALE decisions via timestamp threshold", () => {
    const deriver = new BrainDecisionDeriver();
    const sc = scope();
    const evidence = [
      new BrainEvidence({
        sourceType: "CLIENT_SIGNAL",
        sourceId: "cs-1",
        label: "Client: Acme",
      }),
    ];
    const confidence = new BrainConfidence({ score: 0.8, level: "HIGH", supportingSignalCount: 1 });
    const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);

    const staleResult = new BrainResult({
      analysisId: "analysis-stale-1",
      analysisType: "CLIENT_HEALTH",
      status: "COMPLETED",
      summary: "Stale client health evaluation",
      insights: [
        {
          insightId: "ins-1",
          title: "Health",
          body: "Active",
          confidence,
          evidence,
        },
      ],
      recommendations: [],
      confidence,
      evidence,
      generatedAt: twoDaysAgo,
      scope: sc,
    });

    const decision = deriver.deriveClientHealthDecision(staleResult, {
      maxAgeMs: 24 * 60 * 60 * 1000,
    });
    assert.strictEqual(decision.freshness, "STALE");
  });

  test("59. BrainDecisionDeriver rejects non-COMPLETED analyses and analysis type mismatches", () => {
    const deriver = new BrainDecisionDeriver();
    const sc = scope();

    const failedResult = new BrainResult({
      analysisId: "analysis-failed-1",
      analysisType: "CLIENT_HEALTH",
      status: "FAILED",
      summary: "Analysis failed",
      insights: [],
      recommendations: [],
      confidence: new BrainConfidence({ score: 0, level: "LOW", supportingSignalCount: 0 }),
      evidence: [],
      generatedAt: new Date(),
      scope: sc,
      failure: new BrainFailure({
        code: "PROVIDER_UNAVAILABLE",
        message: "Provider offline",
        retryable: true,
      }),
    });

    assert.throws(
      () => deriver.deriveClientHealthDecision(failedResult),
      /Cannot derive decision from analysis with status FAILED/,
    );
  });

  test("60. BrainDecisionDeriver generic derive() routes to correct decision parser", () => {
    const deriver = new BrainDecisionDeriver();
    const sc = scope();
    const confidence = new BrainConfidence({ score: 0.8, level: "HIGH", supportingSignalCount: 1 });
    const evidence = [
      new BrainEvidence({ sourceType: "TIMELINE_SIGNAL", sourceId: "t-1", label: "Timeline" }),
    ];

    const result = new BrainResult({
      analysisId: "analysis-generic-1",
      analysisType: "FOLLOW_UP_PRIORITIZATION",
      status: "COMPLETED",
      summary: "Follow up derived",
      insights: [{ insightId: "i-1", title: "T", body: "B", confidence, evidence }],
      recommendations: [
        { recommendationId: "r-1", action: "A", rationale: "R", priority: "MEDIUM", evidence },
      ],
      confidence,
      evidence,
      generatedAt: new Date(),
      scope: sc,
    });

    const decision = deriver.derive(result);
    assert.strictEqual(decision.decisionType, "FOLLOW_UP_PRIORITIZATION");
    assert.strictEqual(decision.priority, "MEDIUM");
  });
});
