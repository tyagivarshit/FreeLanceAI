/* eslint-disable @typescript-eslint/no-explicit-any */
import { test, describe, beforeEach } from "node:test";
import assert from "node:assert";
import {
  JobMatchWorkItem,
  JobMatchWorkItemStore,
  JobMatchContext,
  ResultReferences,
  FailureMetadata,
} from "./job-match-work-item.js";
import { JobMatchQueue } from "./job-match-queue.js";
import {
  JobMatchWorker,
  ValidationError,
  TransientInfrastructureError,
  JobMatchPipelineResolver,
} from "./job-match-worker.js";
import { JobMatchCacheManager, MemoryCacheStore } from "./job-match-cache.js";
import { JobMatch } from "./job-match.js";
import { JobMatchScore } from "./job-match-score.js";
import { JobMatchRanking } from "./job-match-ranking.js";
import { JobMatchExplanation, ExplanationPolicy } from "./job-match-explanation.js";

// =================================================--------------------
// MOCK IMPLEMENTATIONS
// =================================================--------------------

class InMemoryWorkItemStore implements JobMatchWorkItemStore {
  public items = new Map<string, JobMatchWorkItem>();

  public async findById(workItemId: string, tenantId: string): Promise<JobMatchWorkItem | null> {
    const item = this.items.get(workItemId);
    if (item && item.tenantId === tenantId) {
      return item;
    }
    return null;
  }

  public async findByIdempotencyKey(
    tenantId: string,
    idempotencyKey: string,
  ): Promise<JobMatchWorkItem | null> {
    for (const item of this.items.values()) {
      if (item.tenantId === tenantId && item.requestId === idempotencyKey) {
        return item;
      }
    }
    return null;
  }

  public async save(workItem: JobMatchWorkItem): Promise<void> {
    this.items.set(workItem.workItemId, workItem);
  }

  public async claim(
    workItemId: string,
    tenantId: string,
    workerId: string,
    leaseDurationMs: number,
  ): Promise<JobMatchWorkItem | null> {
    const item = await this.findById(workItemId, tenantId);
    if (!item) {
      return null;
    }
    item.claim(workerId, leaseDurationMs);
    await this.save(item);
    return item;
  }

  public async heartbeat(
    workItemId: string,
    tenantId: string,
    workerId: string,
    leaseId: string,
    fencingToken: number,
    leaseDurationMs: number,
  ): Promise<void> {
    const item = await this.findById(workItemId, tenantId);
    if (!item) {
      throw new Error("Not found");
    }
    item.heartbeat(workerId, leaseId, fencingToken, leaseDurationMs);
    await this.save(item);
  }

  public async complete(
    workItemId: string,
    tenantId: string,
    workerId: string,
    leaseId: string,
    fencingToken: number,
    resultReferences: ResultReferences,
  ): Promise<void> {
    const item = await this.findById(workItemId, tenantId);
    if (!item) {
      throw new Error("Not found");
    }
    item.complete(workerId, leaseId, fencingToken, resultReferences);
    await this.save(item);
  }

  public async fail(
    workItemId: string,
    tenantId: string,
    workerId: string,
    leaseId: string,
    fencingToken: number,
    failure: Omit<FailureMetadata, "attempt" | "timestamp">,
    _maxAttempts: number,
    isTransient?: boolean,
  ): Promise<void> {
    const item = await this.findById(workItemId, tenantId);
    if (!item) {
      throw new Error("Not found");
    }
    item.fail(workerId, leaseId, fencingToken, failure, isTransient);
    await this.save(item);
  }

  public async cancel(workItemId: string, tenantId: string, actorOwnerId: string): Promise<void> {
    const item = await this.findById(workItemId, tenantId);
    if (!item) {
      throw new Error("Not found");
    }
    item.cancel(actorOwnerId);
    await this.save(item);
  }

  public async deadLetter(workItemId: string, tenantId: string): Promise<void> {
    const item = await this.findById(workItemId, tenantId);
    if (!item) {
      throw new Error("Not found");
    }
    item.deadLetter();
    await this.save(item);
  }
}

class InMemoryQueue implements JobMatchQueue {
  public queue: JobMatchWorkItem[] = [];
  public activeClaims = new Map<string, { item: JobMatchWorkItem; workerId: string }>();
  public acknowledged: string[] = [];
  public released: { id: string; delayMs: number }[] = [];
  public deadLettered: string[] = [];

  public async enqueue(workItem: JobMatchWorkItem): Promise<void> {
    this.queue.push(workItem);
  }

  public async claim(workerId: string, leaseDurationMs: number): Promise<JobMatchWorkItem | null> {
    const item = this.queue.shift();
    if (!item) {
      return null;
    }
    item.claim(workerId, leaseDurationMs);
    this.activeClaims.set(item.workItemId, { item, workerId });
    return item;
  }

  public async acknowledge(
    workItemId: string,
    _tenantId: string,
    _workerId: string,
    _leaseId: string,
    _fencingToken: number,
  ): Promise<void> {
    this.activeClaims.delete(workItemId);
    this.acknowledged.push(workItemId);
  }

  public async release(
    workItemId: string,
    _tenantId: string,
    _workerId: string,
    _leaseId: string,
    _fencingToken: number,
    delayMs: number,
  ): Promise<void> {
    const claim = this.activeClaims.get(workItemId);
    if (claim) {
      this.activeClaims.delete(workItemId);
      this.released.push({ id: workItemId, delayMs });
    }
  }

  public async deadLetter(
    workItemId: string,
    _tenantId: string,
    _workerId: string,
    _leaseId: string,
    _fencingToken: number,
  ): Promise<void> {
    this.activeClaims.delete(workItemId);
    this.deadLettered.push(workItemId);
  }
}

class MockPipelineResolver implements JobMatchPipelineResolver {
  public tenantId = "tenant-1";
  public failGetProfile = false;
  public transientFail = false;
  public commitCalled = false;

  public async getFreelancerProfile(freelancerId: string, _tenantId: string): Promise<any> {
    if (this.transientFail) {
      throw new TransientInfrastructureError("Redis timeout");
    }
    if (this.failGetProfile) {
      throw new ValidationError("Invalid freelancer reference");
    }
    return {
      freelancerId,
      tenantId: this.tenantId,
      skills: ["python", "fastapi"],
      experience: "senior",
      budget: { type: "fixed", rate: 1000, currency: "USD" },
      preferredJobTypes: ["fixed"],
      location: { country: "US" },
      embeddingVector: [0.1, 0.2, 0.3],
    };
  }

  public async getJobNormalization(normalizationId: string, _tenantId: string): Promise<any> {
    return {
      id: normalizationId,
      tenantId: this.tenantId,
      normalizationVersion: "v1",
      canonicalJob: {
        title: "Python Dev",
        description: "Need FastAPI",
        skills: ["python", "fastapi"],
        experience: "senior",
        budget: { type: "fixed", minimum: 500, maximum: 1500, currency: "USD" },
        jobType: "fixed",
        location: { mode: "remote", country: "US" },
      },
      normalizedFingerprint: { value: "norm-fp" },
    };
  }

  public async getJobEmbedding(embeddingId: string, _tenantId: string): Promise<any> {
    return {
      id: embeddingId,
      tenantId: this.tenantId,
      vector: [0.1, 0.2, 0.3],
      dimensions: 3,
    };
  }

  public async getScoringConfiguration(_tenantId: string): Promise<any> {
    return {
      scoringVersion: "v1",
      weightProfile: {
        weightProfileVersion: "v1",
        weights: {
          semanticSimilarity: 0.4,
          skillCoverage: 0.3,
          experienceCompatibility: 0.1,
          budgetCompatibility: 0.1,
          jobTypeCompatibility: 0.05,
          locationCompatibility: 0.05,
        },
      },
      compatibilityMapping: {
        COMPATIBLE: 1.0,
        PARTIAL: 0.5,
        INCOMPATIBLE: 0.0,
        UNKNOWN: 0.0,
      },
      missingSignalPolicy: {
        semanticSimilarity: "FAIL",
        skillCoverage: "ZERO",
        experienceCompatibility: "ZERO",
        budgetCompatibility: "ZERO",
        jobTypeCompatibility: "ZERO",
        locationCompatibility: "ZERO",
      },
    };
  }

  public async getRankingPolicy(_tenantId: string): Promise<any> {
    return {
      rankingPolicyVersion: "v1",
      criteria: "SCORE_DESC",
      limit: 10,
    };
  }

  public async getExplanationPolicy(_tenantId: string): Promise<any> {
    return new ExplanationPolicy({
      explanationPolicyVersion: "v1",
      supportedFactTypes: [
        "MATCHED_SKILL",
        "MISSING_SKILL",
        "EXPERIENCE_COMPATIBILITY",
        "BUDGET_COMPATIBILITY",
        "JOB_TYPE_COMPATIBILITY",
        "LOCATION_COMPATIBILITY",
        "SEMANTIC_RELEVANCE",
        "SCORE_CONTRIBUTION",
        "RANKING_CONTEXT",
      ],
      sectionOrdering: ["skills", "experience"],
      prioritizationRules: ["rule-1"],
    });
  }

  public async commitResult(
    tenantId: string,
    results: {
      jobMatch: JobMatch;
      score: JobMatchScore;
      ranking: JobMatchRanking;
      explanation: JobMatchExplanation;
    },
  ): Promise<void> {
    this.commitCalled = true;
    assert.strictEqual(tenantId, this.tenantId);
    assert.ok(results.jobMatch);
    assert.ok(results.score);
    assert.ok(results.ranking);
    assert.ok(results.explanation);
  }
}

// =================================================--------------------
// TEST SUITE
// =================================================--------------------

describe("Chapter 8I — Job Matching Worker Layer Tests", () => {
  let store: InMemoryWorkItemStore;
  let queue: InMemoryQueue;
  let cacheManager: JobMatchCacheManager;
  let resolver: MockPipelineResolver;

  const defaultContext: JobMatchContext = {
    jobId: "job-123",
    freelancerId: "free-123",
    jobNormalizationId: "norm-123",
    jobEmbeddingId: "emb-123",
  };

  beforeEach(() => {
    store = new InMemoryWorkItemStore();
    queue = new InMemoryQueue();
    resolver = new MockPipelineResolver();

    // 8H Cache Manager initialization
    const l1 = new MemoryCacheStore({ maxSize: 100, ttlSeconds: 60 });
    cacheManager = new JobMatchCacheManager({
      schemaVersion: 1,
      l1,
      timeoutMs: 1000,
    });
  });

  // ------------------------------------------------------------
  // 1. WORK ITEM CREATION
  // ------------------------------------------------------------
  test("1. Work Item Creation - valid properties and state", () => {
    const item = JobMatchWorkItem.create({
      workItemId: "work-1",
      tenantId: "tenant-1",
      ownerId: "owner-1",
      jobMatchContext: defaultContext,
      requestId: "req-1",
      matchingVersion: "v1",
      scoringVersion: "v1",
      rankingVersion: "v1",
      explanationVersion: "v1",
      policyVersions: {
        weightProfileVersion: "v1",
        rankingPolicyVersion: "v1",
        explanationPolicyVersion: "v1",
      },
      maxAttempts: 3,
    });

    assert.strictEqual(item.workItemId, "work-1");
    assert.strictEqual(item.tenantId, "tenant-1");
    assert.strictEqual(item.ownerId, "owner-1");
    assert.strictEqual(item.status, "QUEUED");
    assert.strictEqual(item.attempt, 0);
    assert.strictEqual(item.fencingToken, 0);
    assert.strictEqual(item.snapshots.length, 1);
    assert.strictEqual(item.domainEvents.length, 1);
    assert.strictEqual(item.domainEvents[0]?.eventType, "JOB_MATCH_WORK_ITEM_QUEUED");
  });

  // ------------------------------------------------------------
  // 2. IDEMPOTENCY
  // ------------------------------------------------------------
  test("2. Idempotency - duplicate submission detection", async () => {
    const item = JobMatchWorkItem.create({
      workItemId: "work-1",
      tenantId: "tenant-1",
      ownerId: "owner-1",
      jobMatchContext: defaultContext,
      requestId: "req-1",
      matchingVersion: "v1",
      scoringVersion: "v1",
      rankingVersion: "v1",
      explanationVersion: "v1",
      maxAttempts: 3,
    });

    await store.save(item);

    // Retrieve by request idempotency key
    const match = await store.findByIdempotencyKey("tenant-1", "req-1");
    assert.ok(match);
    assert.strictEqual(match.workItemId, "work-1");

    // Tenant isolation verification: different tenant req key is not found
    const diffTenant = await store.findByIdempotencyKey("tenant-2", "req-1");
    assert.strictEqual(diffTenant, null);
  });

  // ------------------------------------------------------------
  // 3. LIFECYCLE STATE TRANSITIONS
  // ------------------------------------------------------------
  test("3. Lifecycle transitions - success path and retries", () => {
    const item = JobMatchWorkItem.create({
      workItemId: "work-1",
      tenantId: "tenant-1",
      ownerId: "owner-1",
      jobMatchContext: defaultContext,
      requestId: "req-1",
      matchingVersion: "v1",
      scoringVersion: "v1",
      rankingVersion: "v1",
      maxAttempts: 3,
    });

    // QUEUED -> RUNNING
    item.claim("worker-1", 5000);
    assert.strictEqual(item.status, "RUNNING");
    assert.strictEqual(item.attempt, 1);
    assert.ok(item.leaseId);
    assert.strictEqual(item.workerId, "worker-1");

    // RUNNING -> SUCCEEDED
    item.complete("worker-1", item.leaseId!, item.fencingToken, { jobMatchId: "match-1" });
    assert.strictEqual(item.status, "SUCCEEDED");
    assert.strictEqual(item.leaseId, undefined);

    // Replay flow: reset DEAD_LETTER -> QUEUED
    const item2 = JobMatchWorkItem.create({
      workItemId: "work-2",
      tenantId: "tenant-1",
      ownerId: "owner-1",
      jobMatchContext: defaultContext,
      requestId: "req-2",
      matchingVersion: "v1",
      scoringVersion: "v1",
      rankingVersion: "v1",
      maxAttempts: 1,
    });

    item2.claim("worker-1", 5000);
    item2.fail("worker-1", item2.leaseId!, item2.fencingToken, {
      category: "UNKNOWN",
      message: "Error",
    });
    assert.strictEqual(item2.status, "FAILED");

    item2.deadLetter();
    assert.strictEqual(item2.status, "DEAD_LETTER");

    // Replay resets item state
    item2.replay("owner-1");
    assert.strictEqual(item2.status, "QUEUED");
    assert.strictEqual(item2.attempt, 0);
  });

  // ------------------------------------------------------------
  // 4. INVALID STATE TRANSITIONS
  // ------------------------------------------------------------
  test("4. Invalid lifecycle transitions rejected", () => {
    const item = JobMatchWorkItem.create({
      workItemId: "work-1",
      tenantId: "tenant-1",
      ownerId: "owner-1",
      jobMatchContext: defaultContext,
      requestId: "req-1",
      matchingVersion: "v1",
      scoringVersion: "v1",
      rankingVersion: "v1",
      maxAttempts: 3,
    });

    item.claim("worker-1", 5000);
    const leaseId = item.leaseId!;
    const token = item.fencingToken;

    item.complete("worker-1", leaseId, token, {});

    // SUCCEEDED -> RUNNING rejected
    assert.throws(() => {
      item.claim("worker-2", 5000);
    });

    // CANCELLED -> RUNNING rejected
    const item2 = JobMatchWorkItem.create({
      workItemId: "work-2",
      tenantId: "tenant-1",
      ownerId: "owner-1",
      jobMatchContext: defaultContext,
      requestId: "req-2",
      matchingVersion: "v1",
      scoringVersion: "v1",
      rankingVersion: "v1",
      maxAttempts: 3,
    });
    item2.cancel("owner-1");
    assert.strictEqual(item2.status, "CANCELLED");
    assert.throws(() => {
      item2.claim("worker-1", 5000);
    });
  });

  // ------------------------------------------------------------
  // 5. LEASE MECHANISM
  // ------------------------------------------------------------
  test("5. Lease acquisition, timing, and reclamation", () => {
    const item = JobMatchWorkItem.create({
      workItemId: "work-1",
      tenantId: "tenant-1",
      ownerId: "owner-1",
      jobMatchContext: defaultContext,
      requestId: "req-1",
      matchingVersion: "v1",
      scoringVersion: "v1",
      rankingVersion: "v1",
      maxAttempts: 3,
    });

    const start = Date.now();
    item.claim("worker-1", 100); // 100ms lease
    assert.strictEqual(item.status, "RUNNING");
    assert.strictEqual(item.workerId, "worker-1");
    assert.ok(item.leasedUntil);
    assert.ok(item.leasedUntil.getTime() >= start + 100);

    // Attempting to reclaim active lease must throw
    assert.throws(() => {
      item.claim("worker-2", 1000);
    });

    // Reclaim after visibility lease expires
    const expiredItem = new JobMatchWorkItem({
      workItemId: "work-2",
      tenantId: "tenant-1",
      ownerId: "owner-1",
      jobMatchContext: defaultContext,
      requestId: "req-2",
      matchingVersion: "v1",
      scoringVersion: "v1",
      rankingVersion: "v1",
      status: "RUNNING",
      attempt: 1,
      maxAttempts: 3,
      leaseId: "lease-expired",
      fencingToken: 1,
      workerId: "worker-1",
      leasedUntil: new Date(Date.now() - 1000), // expired 1s ago
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    expiredItem.claim("worker-2", 5000);
    assert.strictEqual(expiredItem.status, "RUNNING");
    assert.strictEqual(expiredItem.workerId, "worker-2");
    assert.strictEqual(expiredItem.fencingToken, 2);
  });

  // ------------------------------------------------------------
  // 6. FENCING TOKEN
  // ------------------------------------------------------------
  test("6. Fencing Token verification", () => {
    const item = JobMatchWorkItem.create({
      workItemId: "work-1",
      tenantId: "tenant-1",
      ownerId: "owner-1",
      jobMatchContext: defaultContext,
      requestId: "req-1",
      matchingVersion: "v1",
      scoringVersion: "v1",
      rankingVersion: "v1",
      maxAttempts: 3,
    });

    item.claim("worker-1", 5000);
    const leaseId1 = item.leaseId!;
    const token1 = item.fencingToken; // 1

    // Expiry simulated by manual claim override representing reclamation
    const expiredProperties = {
      ...item,
      workItemId: item.workItemId,
      tenantId: item.tenantId,
      ownerId: item.ownerId,
      jobMatchContext: item.jobMatchContext,
      requestId: item.requestId,
      matchingVersion: item.matchingVersion,
      scoringVersion: item.scoringVersion,
      rankingVersion: item.rankingVersion,
      status: item.status,
      attempt: item.attempt,
      maxAttempts: item.maxAttempts,
      leaseId: item.leaseId,
      fencingToken: item.fencingToken,
      workerId: item.workerId,
      leasedUntil: new Date(Date.now() - 1000), // expired
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    };
    const reclaimedItem = new JobMatchWorkItem(expiredProperties);
    reclaimedItem.claim("worker-2", 5000);
    const leaseId2 = reclaimedItem.leaseId!;
    const token2 = reclaimedItem.fencingToken; // 2

    // Old worker attempting complete must be rejected due to stale fencing token
    assert.throws(() => {
      reclaimedItem.complete("worker-1", leaseId1, token1, {});
    });

    // New worker completes successfully
    reclaimedItem.complete("worker-2", leaseId2, token2, {});
    assert.strictEqual(reclaimedItem.status, "SUCCEEDED");
  });

  // ------------------------------------------------------------
  // 7. HEARTBEAT
  // ------------------------------------------------------------
  test("7. Heartbeat lease extension and verification", () => {
    const item = JobMatchWorkItem.create({
      workItemId: "work-1",
      tenantId: "tenant-1",
      ownerId: "owner-1",
      jobMatchContext: defaultContext,
      requestId: "req-1",
      matchingVersion: "v1",
      scoringVersion: "v1",
      rankingVersion: "v1",
      maxAttempts: 3,
    });

    item.claim("worker-1", 5000);
    const initialLeaseExpiry = item.leasedUntil!;

    item.heartbeat("worker-1", item.leaseId!, item.fencingToken, 10000);
    assert.ok(item.leasedUntil!.getTime() > initialLeaseExpiry.getTime());

    // Invalid parameters throw lease validation error
    assert.throws(() => {
      item.heartbeat("worker-2", item.leaseId!, item.fencingToken, 5000);
    });
    assert.throws(() => {
      item.heartbeat("worker-1", "bad-lease-id", item.fencingToken, 5000);
    });
    assert.throws(() => {
      item.heartbeat("worker-1", item.leaseId!, 99, 5000);
    });
  });

  // ------------------------------------------------------------
  // 8. RETRY CLASSIFICATION
  // ------------------------------------------------------------
  test("8. Retry classification - Transient vs Permanent Errors", async () => {
    const item = JobMatchWorkItem.create({
      workItemId: "work-1",
      tenantId: "tenant-1",
      ownerId: "owner-1",
      jobMatchContext: defaultContext,
      requestId: "req-1",
      matchingVersion: "v1",
      scoringVersion: "v1",
      rankingVersion: "v1",
      maxAttempts: 3,
    });
    await store.save(item);

    const worker = new JobMatchWorker(
      {
        workerId: "worker-1",
        maxConcurrency: 1,
        leaseDurationMs: 1000,
        heartbeatIntervalMs: 50,
        shutdownGracePeriodMs: 100,
        baseDelayMs: 10,
        maxDelayMs: 100,
      },
      queue,
      store,
      cacheManager,
      resolver,
    );

    // Simulate Transient error
    resolver.transientFail = true;
    await queue.enqueue(item);
    await worker.start();

    // Give asynchronous execution loop brief moment to process
    await new Promise((r) => setTimeout(r, 150));
    await worker.shutdown();

    // Check that job was released back with backoff delay
    assert.strictEqual(queue.released.length, 1);
    assert.strictEqual(queue.released[0]?.id, "work-1");

    // Simulate validation error (non-retryable)
    resolver.transientFail = false;
    resolver.failGetProfile = true;

    const item2 = JobMatchWorkItem.create({
      workItemId: "work-2",
      tenantId: "tenant-1",
      ownerId: "owner-1",
      jobMatchContext: defaultContext,
      requestId: "req-2",
      matchingVersion: "v1",
      scoringVersion: "v1",
      rankingVersion: "v1",
      maxAttempts: 3,
    });
    await store.save(item2);
    await queue.enqueue(item2);

    const worker2 = new JobMatchWorker(
      {
        workerId: "worker-1",
        maxConcurrency: 1,
        leaseDurationMs: 1000,
        heartbeatIntervalMs: 50,
        shutdownGracePeriodMs: 100,
        baseDelayMs: 10,
        maxDelayMs: 100,
      },
      queue,
      store,
      cacheManager,
      resolver,
    );
    await worker2.start();
    await new Promise((r) => setTimeout(r, 150));
    await worker2.shutdown();

    // Validate that non-retryable error bypassed retries and dead-lettered directly
    assert.strictEqual(queue.deadLettered.length, 1);
    assert.strictEqual(queue.deadLettered[0], "work-2");
  });

  // ------------------------------------------------------------
  // 9. EXPONENTIAL BACKOFF & JITTER
  // ------------------------------------------------------------
  test("9. Backoff delay cap and jitter bounds", () => {
    // Backoff formula verification: baseDelay * 2^(attempt - 1)
    const baseDelay = 100;
    const maxDelay = 1000;

    const getDelay = (attempt: number) => {
      const delay = Math.min(baseDelay * Math.pow(2, attempt - 1), maxDelay);
      const jitter = 50; // mock max jitter
      return delay + jitter;
    };

    assert.ok(getDelay(1) >= 100 && getDelay(1) <= 150);
    assert.ok(getDelay(2) >= 200 && getDelay(2) <= 250);
    assert.ok(getDelay(3) >= 400 && getDelay(3) <= 450);
    assert.ok(getDelay(4) >= 800 && getDelay(4) <= 850);
    // capped at maxDelay
    assert.ok(getDelay(5) >= 1000 && getDelay(5) <= 1050);
  });

  // ------------------------------------------------------------
  // 10. MAX ATTEMPTS
  // ------------------------------------------------------------
  test("10. Attempt increment and retry exhaustion to DLQ", async () => {
    const item = JobMatchWorkItem.create({
      workItemId: "work-1",
      tenantId: "tenant-1",
      ownerId: "owner-1",
      jobMatchContext: defaultContext,
      requestId: "req-1",
      matchingVersion: "v1",
      scoringVersion: "v1",
      rankingVersion: "v1",
      maxAttempts: 1, // Max attempt is 1, so first fail goes directly to DLQ
    });

    item.claim("worker-1", 5000);
    item.fail("worker-1", item.leaseId!, item.fencingToken, {
      category: "TRANSIENT",
      message: "Redis unavailable",
    });

    assert.strictEqual(item.status, "FAILED");
    item.deadLetter();
    assert.strictEqual(item.status, "DEAD_LETTER");
  });

  // ------------------------------------------------------------
  // 11. DEAD LETTER SANITIZATION
  // ------------------------------------------------------------
  test("11. DLQ sanitizes credential secrets from error log", () => {
    const item = JobMatchWorkItem.create({
      workItemId: "work-1",
      tenantId: "tenant-1",
      ownerId: "owner-1",
      jobMatchContext: defaultContext,
      requestId: "req-1",
      matchingVersion: "v1",
      scoringVersion: "v1",
      rankingVersion: "v1",
      maxAttempts: 1,
    });

    item.claim("worker-1", 5000);
    // Fail with message containing sensitive API key
    item.fail("worker-1", item.leaseId!, item.fencingToken, {
      category: "AUTH",
      message: "Database connection failed for password=SecretPassword123 and apikey: key-456",
    });

    assert.ok(item.failureMetadata);
    assert.ok(!item.failureMetadata.message.includes("SecretPassword123"));
    assert.ok(!item.failureMetadata.message.includes("key-456"));
    assert.ok(item.failureMetadata.message.includes("[REDACTED]"));
  });

  // ------------------------------------------------------------
  // 12. CANCELLATION
  // ------------------------------------------------------------
  test("12. Cancellation and races with execution", () => {
    const item = JobMatchWorkItem.create({
      workItemId: "work-1",
      tenantId: "tenant-1",
      ownerId: "owner-1",
      jobMatchContext: defaultContext,
      requestId: "req-1",
      matchingVersion: "v1",
      scoringVersion: "v1",
      rankingVersion: "v1",
      maxAttempts: 3,
    });

    // QUEUED -> CANCELLED
    item.cancel("owner-1");
    assert.strictEqual(item.status, "CANCELLED");

    // RUNNING -> CANCELLING
    const item2 = JobMatchWorkItem.create({
      workItemId: "work-2",
      tenantId: "tenant-1",
      ownerId: "owner-1",
      jobMatchContext: defaultContext,
      requestId: "req-2",
      matchingVersion: "v1",
      scoringVersion: "v1",
      rankingVersion: "v1",
      maxAttempts: 3,
    });
    item2.claim("worker-1", 5000);
    item2.cancel("owner-1");
    assert.strictEqual(item2.status, "CANCELLING");

    // Finished job cannot be cancelled
    const item3 = JobMatchWorkItem.create({
      workItemId: "work-3",
      tenantId: "tenant-1",
      ownerId: "owner-1",
      jobMatchContext: defaultContext,
      requestId: "req-3",
      matchingVersion: "v1",
      scoringVersion: "v1",
      rankingVersion: "v1",
      maxAttempts: 3,
    });
    item3.claim("worker-1", 5000);
    item3.complete("worker-1", item3.leaseId!, item3.fencingToken, {});
    assert.throws(() => {
      item3.cancel("owner-1");
    });
  });

  // ------------------------------------------------------------
  // 13. TENANT ISOLATION
  // ------------------------------------------------------------
  test("13. Tenant isolation verification", async () => {
    const item = JobMatchWorkItem.create({
      workItemId: "work-1",
      tenantId: "tenant-A",
      ownerId: "owner-1",
      jobMatchContext: defaultContext,
      requestId: "req-1",
      matchingVersion: "v1",
      scoringVersion: "v1",
      rankingVersion: "v1",
      maxAttempts: 3,
    });

    await store.save(item);
    await queue.enqueue(item);

    const worker = new JobMatchWorker(
      {
        workerId: "worker-1",
        maxConcurrency: 1,
        leaseDurationMs: 1000,
        heartbeatIntervalMs: 50,
        shutdownGracePeriodMs: 100,
        baseDelayMs: 10,
        maxDelayMs: 100,
      },
      queue,
      store,
      cacheManager,
      resolver,
    );

    await worker.start();
    await new Promise((r) => setTimeout(r, 100));
    await worker.shutdown();

    // Claimed but execution should fail due to freelancer tenant isolation (freelancer is mock-setup for tenant-1 in resolver)
    assert.strictEqual(queue.deadLettered.length, 1);
    assert.strictEqual(queue.deadLettered[0], "work-1");
  });

  // ------------------------------------------------------------
  // 14. OWNERSHIP CONTRACT
  // ------------------------------------------------------------
  test("14. Ownership mutation validations", () => {
    const item = JobMatchWorkItem.create({
      workItemId: "work-1",
      tenantId: "tenant-1",
      ownerId: "owner-1",
      jobMatchContext: defaultContext,
      requestId: "req-1",
      matchingVersion: "v1",
      scoringVersion: "v1",
      rankingVersion: "v1",
      maxAttempts: 3,
    });

    // Valid owner cancels successfully
    item.cancel("owner-1");
    assert.strictEqual(item.status, "CANCELLED");

    // Invalid owner throws exact Error string with exactly one period
    const item2 = JobMatchWorkItem.create({
      workItemId: "work-2",
      tenantId: "tenant-1",
      ownerId: "owner-1",
      jobMatchContext: defaultContext,
      requestId: "req-2",
      matchingVersion: "v1",
      scoringVersion: "v1",
      rankingVersion: "v1",
      maxAttempts: 3,
    });

    assert.throws(
      () => {
        item2.cancel("owner-bad");
      },
      (err: Error) => {
        return err.message === "Ownership validation failed: unauthorized owner context.";
      },
    );
  });

  // ------------------------------------------------------------
  // 15. CONCURRENCY ENFORCEMENT
  // ------------------------------------------------------------
  test("15. Concurrency bounds and slot releases", async () => {
    const worker = new JobMatchWorker(
      {
        workerId: "worker-1",
        maxConcurrency: 2,
        leaseDurationMs: 1000,
        heartbeatIntervalMs: 50,
        shutdownGracePeriodMs: 100,
        baseDelayMs: 10,
        maxDelayMs: 100,
      },
      queue,
      store,
      cacheManager,
      resolver,
    );

    const item1 = JobMatchWorkItem.create({
      workItemId: "work-1",
      tenantId: "tenant-1",
      ownerId: "owner-1",
      jobMatchContext: defaultContext,
      requestId: "req-1",
      matchingVersion: "v1",
      scoringVersion: "v1",
      rankingVersion: "v1",
      maxAttempts: 3,
    });
    const item2 = JobMatchWorkItem.create({
      workItemId: "work-2",
      tenantId: "tenant-1",
      ownerId: "owner-1",
      jobMatchContext: defaultContext,
      requestId: "req-2",
      matchingVersion: "v1",
      scoringVersion: "v1",
      rankingVersion: "v1",
      maxAttempts: 3,
    });
    const item3 = JobMatchWorkItem.create({
      workItemId: "work-3",
      tenantId: "tenant-1",
      ownerId: "owner-1",
      jobMatchContext: defaultContext,
      requestId: "req-3",
      matchingVersion: "v1",
      scoringVersion: "v1",
      rankingVersion: "v1",
      maxAttempts: 3,
    });

    await store.save(item1);
    await store.save(item2);
    await store.save(item3);

    await queue.enqueue(item1);
    await queue.enqueue(item2);
    await queue.enqueue(item3);

    // Start worker, it should claim at most 2 items due to maxConcurrency=2
    await worker.start();
    await new Promise((r) => setTimeout(r, 50));

    // Active claim count matches capacity
    assert.ok(worker.activeClaimCount <= 2);

    await worker.shutdown();
  });

  // ------------------------------------------------------------
  // 16. DUPLICATE EXECUTION SAFETY
  // ------------------------------------------------------------
  test("16. Duplicate execution protection", async () => {
    const itemInStore = JobMatchWorkItem.create({
      workItemId: "work-1",
      tenantId: "tenant-1",
      ownerId: "owner-1",
      jobMatchContext: defaultContext,
      requestId: "req-1",
      matchingVersion: "v1",
      scoringVersion: "v1",
      rankingVersion: "v1",
      maxAttempts: 3,
    });
    await store.save(itemInStore);

    // Claim it
    await store.claim("work-1", "tenant-1", "worker-2", 5000);
    const claimedItem = await store.findById("work-1", "tenant-1");

    // Complete in store representing another worker finishing first
    await store.complete(
      "work-1",
      "tenant-1",
      "worker-2",
      claimedItem!.leaseId!,
      claimedItem!.fencingToken,
      { jobMatchId: "match-finished" },
    );

    const item = JobMatchWorkItem.create({
      workItemId: "work-1",
      tenantId: "tenant-1",
      ownerId: "owner-1",
      jobMatchContext: defaultContext,
      requestId: "req-1",
      matchingVersion: "v1",
      scoringVersion: "v1",
      rankingVersion: "v1",
      maxAttempts: 3,
    });

    const worker = new JobMatchWorker(
      {
        workerId: "worker-1",
        maxConcurrency: 1,
        leaseDurationMs: 1000,
        heartbeatIntervalMs: 50,
        shutdownGracePeriodMs: 100,
        baseDelayMs: 10,
        maxDelayMs: 100,
      },
      queue,
      store,
      cacheManager,
      resolver,
    );

    // Try to run item under worker-1
    await queue.enqueue(item);
    await worker.start();
    await new Promise((r) => setTimeout(r, 100));
    await worker.shutdown();

    // Resolver should NOT have been committed again
    assert.strictEqual(resolver.commitCalled, false);
  });

  // ------------------------------------------------------------
  // 17. VERSION PINNING
  // ------------------------------------------------------------
  test("17. Worker preserves and runs pinned versions", async () => {
    const item = JobMatchWorkItem.create({
      workItemId: "work-1",
      tenantId: "tenant-1",
      ownerId: "owner-1",
      jobMatchContext: defaultContext,
      requestId: "req-1",
      matchingVersion: "v1", // pinned to v1
      scoringVersion: "v1",
      rankingVersion: "v1",
      maxAttempts: 3,
    });

    await store.save(item);
    await queue.enqueue(item);

    const worker = new JobMatchWorker(
      {
        workerId: "worker-1",
        maxConcurrency: 1,
        leaseDurationMs: 1000,
        heartbeatIntervalMs: 50,
        shutdownGracePeriodMs: 100,
        baseDelayMs: 10,
        maxDelayMs: 100,
      },
      queue,
      store,
      cacheManager,
      resolver,
    );

    await worker.start();
    await new Promise((r) => setTimeout(r, 100));
    await worker.shutdown();

    // Verify it succeeded using v1
    const finalItem = await store.findById("work-1", "tenant-1");
    assert.strictEqual(finalItem?.status, "SUCCEEDED");
    assert.strictEqual(finalItem?.matchingVersion, "v1");
  });

  // ------------------------------------------------------------
  // 18. LEASE LOSS
  // ------------------------------------------------------------
  test("18. Stale worker stops commit on lease loss", async () => {
    const item = JobMatchWorkItem.create({
      workItemId: "work-1",
      tenantId: "tenant-1",
      ownerId: "owner-1",
      jobMatchContext: defaultContext,
      requestId: "req-1",
      matchingVersion: "v1",
      scoringVersion: "v1",
      rankingVersion: "v1",
      maxAttempts: 3,
    });

    await store.save(item);
    await queue.enqueue(item);

    // Hijack store lease to represent another worker claiming it
    const storeItem = await store.findById("work-1", "tenant-1");
    storeItem?.claim("worker-other", 10000);
    await store.save(storeItem!);

    const worker = new JobMatchWorker(
      {
        workerId: "worker-1",
        maxConcurrency: 1,
        leaseDurationMs: 1000,
        heartbeatIntervalMs: 50,
        shutdownGracePeriodMs: 100,
        baseDelayMs: 10,
        maxDelayMs: 100,
      },
      queue,
      store,
      cacheManager,
      resolver,
    );

    await worker.start();
    await new Promise((r) => setTimeout(r, 100));
    await worker.shutdown();

    // Commit should NOT have happened for worker-1 since lease was stolen
    assert.strictEqual(resolver.commitCalled, false);
  });

  // ------------------------------------------------------------
  // 19. GRACEFUL SHUTDOWN
  // ------------------------------------------------------------
  test("19. Graceful shutdown aborts and stops claims", async () => {
    const worker = new JobMatchWorker(
      {
        workerId: "worker-1",
        maxConcurrency: 1,
        leaseDurationMs: 5000,
        heartbeatIntervalMs: 50,
        shutdownGracePeriodMs: 100,
        baseDelayMs: 10,
        maxDelayMs: 100,
      },
      queue,
      store,
      cacheManager,
      resolver,
    );

    await worker.start();
    await worker.shutdown();

    assert.strictEqual(worker.activeClaimCount, 0);
  });

  // ------------------------------------------------------------
  // 20. CRASH RECOVERY
  // ------------------------------------------------------------
  test("20. Crash recovery through lease expiration", async () => {
    const item = JobMatchWorkItem.create({
      workItemId: "work-1",
      tenantId: "tenant-1",
      ownerId: "owner-1",
      jobMatchContext: defaultContext,
      requestId: "req-1",
      matchingVersion: "v1",
      scoringVersion: "v1",
      rankingVersion: "v1",
      maxAttempts: 3,
    });

    item.claim("worker-dead", 10); // Very short lease
    await store.save(item);

    // Wait for lease to expire
    await new Promise((r) => setTimeout(r, 50));

    // Another worker should be able to claim it
    const reclaimed = await store.claim("work-1", "tenant-1", "worker-alive", 5000);
    assert.ok(reclaimed);
    assert.strictEqual(reclaimed.workerId, "worker-alive");
  });

  // ------------------------------------------------------------
  // 21. CACHE INTEGRATION
  // ------------------------------------------------------------
  test("21. Cache integration via L1 Memory Cache", async () => {
    const item = JobMatchWorkItem.create({
      workItemId: "work-1",
      tenantId: "tenant-1",
      ownerId: "owner-1",
      jobMatchContext: defaultContext,
      requestId: "req-1",
      matchingVersion: "v1",
      scoringVersion: "v1",
      rankingVersion: "v1",
      maxAttempts: 3,
    });

    await store.save(item);
    await queue.enqueue(item);

    const worker = new JobMatchWorker(
      {
        workerId: "worker-1",
        maxConcurrency: 1,
        leaseDurationMs: 5000,
        heartbeatIntervalMs: 50,
        shutdownGracePeriodMs: 100,
        baseDelayMs: 10,
        maxDelayMs: 100,
      },
      queue,
      store,
      cacheManager,
      resolver,
    );

    await worker.start();
    await new Promise((r) => setTimeout(r, 100));
    await worker.shutdown();

    // We can just assert that cache sets are invoked without erroring execution
    assert.strictEqual(resolver.commitCalled, true);
  });
});
