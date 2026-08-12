/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  JobMatchWorkItem,
  JobMatchWorkItemStore,
  FailureMetadata,
  ResultReferences,
} from "./job-match-work-item.js";
import { JobMatchQueue } from "./job-match-queue.js";
import { JobMatchCacheManager } from "./job-match-cache.js";
import { JobMatch, MatchSignals } from "./job-match.js";
import { JobMatchScore } from "./job-match-score.js";
import { JobMatchRanking } from "./job-match-ranking.js";
import { JobMatchExplanation } from "./job-match-explanation.js";

// Custom Error Classification
export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

export class TenantError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TenantError";
  }
}

export class VersionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VersionError";
  }
}

export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DomainError";
  }
}

export class CancellationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CancellationError";
  }
}

export class TransientInfrastructureError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TransientInfrastructureError";
  }
}

export class PermanentInfrastructureError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PermanentInfrastructureError";
  }
}

export interface WorkerConfig {
  readonly workerId: string;
  readonly maxConcurrency: number;
  readonly leaseDurationMs: number;
  readonly heartbeatIntervalMs: number;
  readonly shutdownGracePeriodMs: number;
  readonly baseDelayMs: number;
  readonly maxDelayMs: number;
}

export interface JobMatchPipelineResolver {
  getFreelancerProfile(freelancerId: string, tenantId: string): Promise<any>;
  getJobNormalization(normalizationId: string, tenantId: string): Promise<any>;
  getJobEmbedding(embeddingId: string, tenantId: string): Promise<any>;
  getScoringConfiguration(tenantId: string): Promise<any>;
  getRankingPolicy(tenantId: string): Promise<any>;
  getExplanationPolicy(tenantId: string): Promise<any>;
  commitResult(
    tenantId: string,
    results: {
      jobMatch: JobMatch;
      score: JobMatchScore;
      ranking: JobMatchRanking;
      explanation: JobMatchExplanation;
    },
  ): Promise<void>;
}

export interface WorkerObservabilityHooks {
  onEvent?: (event: string, workItemId: string, payload?: Record<string, any> | undefined) => void;
}

export class JobMatchWorker {
  private readonly _config: WorkerConfig;
  private readonly _queue: JobMatchQueue;
  private readonly _store: JobMatchWorkItemStore;
  private readonly _cacheManager: JobMatchCacheManager;
  private readonly _resolver: JobMatchPipelineResolver;
  private readonly _observability: WorkerObservabilityHooks | undefined;

  private readonly _activeJobs = new Map<
    string,
    {
      workItem: JobMatchWorkItem;
      heartbeatTimer: NodeJS.Timeout | undefined;
      cancelController: AbortController;
    }
  >();

  private _isShuttingDown = false;
  private _activeClaimCount = 0;
  private _loopTimeout: NodeJS.Timeout | undefined;

  constructor(
    config: WorkerConfig,
    queue: JobMatchQueue,
    store: JobMatchWorkItemStore,
    cacheManager: JobMatchCacheManager,
    resolver: JobMatchPipelineResolver,
    observability?: WorkerObservabilityHooks | undefined,
  ) {
    this._config = config;
    this._queue = queue;
    this._store = store;
    this._cacheManager = cacheManager;
    this._resolver = resolver;
    this._observability = observability;
  }

  get activeClaimCount(): number {
    return this._activeClaimCount;
  }

  public async start(): Promise<void> {
    this._isShuttingDown = false;
    this.emitObservability("worker_started", "system", {
      concurrencyLimit: this._config.maxConcurrency,
    });
    setImmediate(() => this.poll());
  }

  public async shutdown(): Promise<void> {
    this.emitObservability("worker_shutdown_initiated", "system");
    this._isShuttingDown = true;
    if (this._loopTimeout) {
      clearTimeout(this._loopTimeout);
      this._loopTimeout = undefined;
    }

    // Stop accepting new claims and abort active runners
    for (const active of this._activeJobs.values()) {
      active.cancelController.abort();
      if (active.heartbeatTimer) {
        clearInterval(active.heartbeatTimer);
        active.heartbeatTimer = undefined;
      }
    }

    const start = Date.now();
    while (this._activeClaimCount > 0 && Date.now() - start < this._config.shutdownGracePeriodMs) {
      await new Promise((r) => setTimeout(r, 50));
    }

    this._activeJobs.clear();
    this.emitObservability("worker_shutdown_completed", "system");
  }

  private async poll(): Promise<void> {
    if (this._isShuttingDown) {
      return;
    }

    if (this._activeClaimCount >= this._config.maxConcurrency) {
      this._loopTimeout = setTimeout(() => this.poll(), 50);
      return;
    }

    try {
      const claimed = await this._queue.claim(this._config.workerId, this._config.leaseDurationMs);
      if (claimed) {
        this._activeClaimCount++;
        this.emitObservability("job_claimed", claimed.workItemId, {
          workerId: this._config.workerId,
        });
        this.executeJob(claimed)
          .catch((err) => {
            console.error(
              `[JobMatchWorker] Unexpected runner failure on workItemId: ${claimed.workItemId}`,
              err,
            );
          })
          .finally(() => {
            this._activeClaimCount--;
            setImmediate(() => this.poll());
          });
      } else {
        this._loopTimeout = setTimeout(() => this.poll(), 500);
      }
    } catch (err) {
      console.error("[JobMatchWorker] Polling assertion check failed:", err);
      this._loopTimeout = setTimeout(() => this.poll(), 2000);
    }
  }

  private async executeJob(workItem: JobMatchWorkItem): Promise<void> {
    const workItemId = workItem.workItemId;
    const tenantId = workItem.tenantId;
    const cancelController = new AbortController();

    this._activeJobs.set(workItemId, {
      workItem,
      heartbeatTimer: undefined,
      cancelController,
    });

    this.emitObservability("job_started", workItemId);

    // Start heartbeat
    this.startHeartbeat(workItem);

    try {
      // 1. Tenant validation
      if (!tenantId || tenantId.trim() === "") {
        throw new TenantError("Invalid tenant configuration.");
      }

      // Check context cancellation
      this.checkCancellation(cancelController.signal);

      // 2. Fetch dependencies via resolver (ensuring pinned version compatibility)
      const freelancer = await this._resolver.getFreelancerProfile(
        workItem.jobMatchContext.freelancerId,
        tenantId,
      );
      if (!freelancer || freelancer.tenantId !== tenantId) {
        throw new TenantError("Freelancer tenant isolation check failed.");
      }

      const jobNorm = await this._resolver.getJobNormalization(
        workItem.jobMatchContext.jobNormalizationId,
        tenantId,
      );
      if (!jobNorm || jobNorm.tenantId !== tenantId) {
        throw new TenantError("Job normalization tenant isolation check failed.");
      }
      if (jobNorm.normalizationVersion !== workItem.matchingVersion) {
        throw new VersionError("Job normalization version mismatch.");
      }

      const jobEmb = await this._resolver.getJobEmbedding(
        workItem.jobMatchContext.jobEmbeddingId,
        tenantId,
      );
      if (!jobEmb || jobEmb.tenantId !== tenantId) {
        throw new TenantError("Job embedding tenant isolation check failed.");
      }

      this.checkCancellation(cancelController.signal);

      const scoringConfig = await this._resolver.getScoringConfiguration(tenantId);
      if (scoringConfig.scoringVersion !== workItem.scoringVersion) {
        throw new VersionError("Scoring version mismatch.");
      }

      const rankingPolicy = await this._resolver.getRankingPolicy(tenantId);
      if (rankingPolicy.rankingPolicyVersion !== workItem.rankingVersion) {
        throw new VersionError("Ranking policy version mismatch.");
      }

      const explanationPolicy = await this._resolver.getExplanationPolicy(tenantId);
      if (
        workItem.explanationVersion &&
        explanationPolicy.explanationPolicyVersion !== workItem.explanationVersion
      ) {
        throw new VersionError("Explanation policy version mismatch.");
      }

      // 3. Pipeline execution (8D -> 8E -> 8F -> 8G)
      const matchId = `match-${this.generateRandomId()}`;
      const scoreId = `score-${this.generateRandomId()}`;
      const rankingId = `rank-${this.generateRandomId()}`;
      const explanationId = `expl-${this.generateRandomId()}`;

      // 8D Matching Engine
      const jobMatch = JobMatch.create(
        matchId,
        tenantId,
        workItem.ownerId,
        freelancer.freelancerId,
        jobNorm.id,
        jobNorm.id,
        jobNorm.normalizationVersion,
        workItem.matchingVersion,
        jobEmb.id,
        jobEmb.vector && jobEmb.vector.length > 0 ? "v1" : undefined,
      );
      jobMatch.evaluate(workItem.ownerId, {
        freelancerProfile: freelancer,
        jobNormalization: jobNorm,
        jobEmbedding: jobEmb,
      });

      this.checkCancellation(cancelController.signal);

      // 8E Scoring
      const matchScore = JobMatchScore.create(
        scoreId,
        tenantId,
        workItem.ownerId,
        matchId,
        workItem.matchingVersion,
        workItem.scoringVersion,
        scoringConfig.weightProfile.weightProfileVersion,
      );
      matchScore.calculate(workItem.ownerId, jobMatch.matchSignals!, scoringConfig);

      this.checkCancellation(cancelController.signal);

      // 8F Ranking
      const matchRanking = JobMatchRanking.create(
        rankingId,
        tenantId,
        workItem.ownerId,
        matchId,
        workItem.matchingVersion,
        workItem.scoringVersion,
        workItem.rankingVersion,
        rankingPolicy.rankingPolicyVersion,
        [matchId],
      );

      const scoredMatch = {
        matchId,
        scoreId,
        tenantId,
        finalScore: matchScore.finalScore || 0,
        tieBreakerKey: matchId,
        matchingVersion: workItem.matchingVersion,
        scoringVersion: workItem.scoringVersion,
        weightProfileVersion: scoringConfig.weightProfile.weightProfileVersion,
      };

      matchRanking.rank(workItem.ownerId, [scoredMatch], rankingPolicy);

      this.checkCancellation(cancelController.signal);

      // 8G Explanation
      const matchExplanation = JobMatchExplanation.create(
        explanationId,
        tenantId,
        workItem.ownerId,
        matchId,
        scoreId,
        rankingId,
        workItem.matchingVersion,
        workItem.scoringVersion,
        workItem.rankingVersion,
        workItem.explanationVersion || "v1",
        explanationPolicy.explanationPolicyVersion,
      );

      const evidence = {
        tenantId,
        matchSignals: jobMatch.matchSignals!,
        finalScore: matchScore.finalScore || 0,
        contributions: matchScore.breakdown!.contributions.map((c) => ({
          signalName: c.signalName,
          rawValue: c.rawValue,
          normalizedValue: c.normalizedValue,
          weight: c.weight,
          contribution: c.contribution,
          available: c.available,
        })),
        rank: 1,
        candidateCount: 1,
      };

      matchExplanation.generate(workItem.ownerId, evidence, explanationPolicy);

      this.checkCancellation(cancelController.signal);

      // 4. Cache Integration (8H)
      const cacheContext = {
        tenantId,
        jobMatchId: matchId,
        scoreId,
        rankingId,
        explanationId,
        matchingVersion: workItem.matchingVersion,
        scoringVersion: workItem.scoringVersion,
        rankingVersion: workItem.rankingVersion,
        explanationVersion: workItem.explanationVersion,
        weightProfileVersion: scoringConfig.weightProfile.weightProfileVersion,
        rankingPolicyVersion: rankingPolicy.rankingPolicyVersion,
        explanationPolicyVersion: explanationPolicy.explanationPolicyVersion,
        jobMatchFingerprint: this.buildMatchSignalsFingerprint(jobMatch.matchSignals!),
        scoreFingerprint: matchScore.fingerprint?.value || "",
        rankingFingerprint: matchRanking.rankingFingerprint?.value || "",
        explanationFingerprint: matchExplanation.explanationFingerprint?.value || "",
      };

      const payload = {
        jobMatchId: matchId,
        scoreId,
        rankingId,
        explanationId,
        matchSignals: jobMatch.matchSignals,
        scoreBreakdown: matchScore.breakdown,
        rankedMatches:
          matchRanking.snapshots.length > 0
            ? matchRanking.snapshots[matchRanking.snapshots.length - 1]?.rankedEntries || []
            : [],
        explanationFacts:
          matchExplanation.snapshots.length > 0
            ? matchExplanation.snapshots[matchExplanation.snapshots.length - 1]?.facts || []
            : [],
      };

      try {
        await this._cacheManager.set(cacheContext, payload, { ttlSeconds: 3600 });
      } catch (cacheErr) {
        console.warn(
          `[JobMatchWorker] Non-blocking L2 cache population failed for ${workItemId}:`,
          cacheErr,
        );
      }

      // 5. Result Verification & Commit
      const freshItem = await this._store.findById(workItemId, tenantId);
      if (!freshItem) {
        throw new PermanentInfrastructureError("Work item has been deleted during processing.");
      }

      if (freshItem.status === "SUCCEEDED") {
        this.emitObservability("job_duplicate", workItemId, {
          detail: "Idempotently satisfied by other runner",
        });
        this.cleanupActiveJob(workItemId);
        return;
      }

      if (
        freshItem.workerId !== this._config.workerId ||
        freshItem.leaseId !== workItem.leaseId ||
        freshItem.fencingToken !== workItem.fencingToken
      ) {
        this.emitObservability("job_lease_lost", workItemId);
        throw new PermanentInfrastructureError(
          "Lease ownership was lost. Aborting transaction commit.",
        );
      }

      if (freshItem.status !== "RUNNING" && freshItem.status !== "CANCELLING") {
        throw new PermanentInfrastructureError(
          `Invalid state sequence detected on commit: ${freshItem.status}`,
        );
      }

      // Commit downstream results
      await this._resolver.commitResult(tenantId, {
        jobMatch,
        score: matchScore,
        ranking: matchRanking,
        explanation: matchExplanation,
      });

      // Complete work item in DB and Queue
      const resultReferences: ResultReferences = {
        jobMatchId: matchId,
        scoreId,
        rankingId,
        explanationId,
      };

      await this._store.complete(
        workItemId,
        tenantId,
        this._config.workerId,
        workItem.leaseId!,
        workItem.fencingToken,
        resultReferences,
      );

      await this._queue.acknowledge(
        workItemId,
        tenantId,
        this._config.workerId,
        workItem.leaseId!,
        workItem.fencingToken,
      );

      this.emitObservability("job_succeeded", workItemId, { resultReferences });
    } catch (err) {
      const error = err as Error;
      this.handleExecutionFailure(workItem, error);
    } finally {
      this.cleanupActiveJob(workItemId);
    }
  }

  private handleExecutionFailure(workItem: JobMatchWorkItem, error: Error): void {
    const workItemId = workItem.workItemId;
    const tenantId = workItem.tenantId;
    const leaseId = workItem.leaseId!;
    const fencingToken = workItem.fencingToken;

    // Retry Classification
    const isRetryable = error instanceof TransientInfrastructureError;
    const category = error.name || "UNKNOWN";

    const failure: Omit<FailureMetadata, "attempt" | "timestamp"> = {
      category,
      message: error.message || "Unknown error occurred.",
    };

    // Stop result commit
    this.emitObservability("job_failed", workItemId, { failure, isRetryable });

    // Use asynchronous wrapper to safely notify DB / Queue
    (async () => {
      try {
        const freshItem = await this._store.findById(workItemId, tenantId);
        if (
          !freshItem ||
          freshItem.workerId !== this._config.workerId ||
          freshItem.leaseId !== leaseId ||
          freshItem.fencingToken !== fencingToken
        ) {
          return; // Lease lost, don't mutate state
        }

        if (isRetryable && freshItem.attempt < workItem.maxAttempts) {
          // Retry
          await this._store.fail(
            workItemId,
            tenantId,
            this._config.workerId,
            leaseId,
            fencingToken,
            failure,
            workItem.maxAttempts,
            true, // isTransient
          );

          // Exponential backoff + bounded jitter calculation
          const attempt = freshItem.attempt + 1;
          const delay = Math.min(
            this._config.baseDelayMs * Math.pow(2, attempt - 1),
            this._config.maxDelayMs,
          );
          const jitter = Math.random() * 100; // Cap jitter at +100ms
          const totalDelay = Math.max(0, delay + jitter);

          await this._queue.release(
            workItemId,
            tenantId,
            this._config.workerId,
            leaseId,
            fencingToken,
            totalDelay,
          );

          this.emitObservability("job_retry_scheduled", workItemId, {
            delayMs: totalDelay,
            attempt,
          });
        } else {
          // Permanent failure or retry exhaustion -> DLQ
          await this._store.fail(
            workItemId,
            tenantId,
            this._config.workerId,
            leaseId,
            fencingToken,
            failure,
            workItem.maxAttempts,
            false, // isTransient
          );
          await this._store.deadLetter(workItemId, tenantId);
          await this._queue.deadLetter(
            workItemId,
            tenantId,
            this._config.workerId,
            leaseId,
            fencingToken,
          );
          this.emitObservability("job_dead_lettered", workItemId, { reason: failure.message });
        }
      } catch (err) {
        console.error("[JobMatchWorker] Failed to write exception recovery payload:", err);
      }
    })();
  }

  private startHeartbeat(workItem: JobMatchWorkItem): void {
    const active = this._activeJobs.get(workItem.workItemId);
    if (!active) {
      return;
    }

    active.heartbeatTimer = setInterval(async () => {
      try {
        const fresh = await this._store.findById(workItem.workItemId, workItem.tenantId);
        if (!fresh) {
          this.stopHeartbeatAndAbort(workItem.workItemId);
          return;
        }

        // Cancellation checks
        if (fresh.status === "CANCELLING" || fresh.status === "CANCELLED") {
          active.cancelController.abort();
          if (fresh.status === "CANCELLING") {
            fresh.confirmCancellationByWorker(
              this._config.workerId,
              workItem.leaseId!,
              workItem.fencingToken,
            );
            await this._store.save(fresh);
            this.emitObservability("job_cancelled", workItem.workItemId);
          }
          this.stopHeartbeatAndAbort(workItem.workItemId);
          return;
        }

        // Terminal state check
        if (
          fresh.status === "SUCCEEDED" ||
          fresh.status === "FAILED" ||
          fresh.status === "DEAD_LETTER"
        ) {
          this.stopHeartbeatAndAbort(workItem.workItemId);
          return;
        }

        // Fencing check
        if (
          fresh.workerId !== this._config.workerId ||
          fresh.leaseId !== workItem.leaseId ||
          fresh.fencingToken !== workItem.fencingToken
        ) {
          this.emitObservability("job_lease_lost", workItem.workItemId);
          this.stopHeartbeatAndAbort(workItem.workItemId);
          return;
        }

        // Extend lease in store
        await this._store.heartbeat(
          workItem.workItemId,
          workItem.tenantId,
          this._config.workerId,
          workItem.leaseId!,
          workItem.fencingToken,
          this._config.leaseDurationMs,
        );

        this.emitObservability("job_heartbeat", workItem.workItemId);
      } catch (err) {
        console.error(`[JobMatchWorker] Heartbeat renewal failure on ${workItem.workItemId}:`, err);
      }
    }, this._config.heartbeatIntervalMs);
  }

  private stopHeartbeatAndAbort(workItemId: string): void {
    const active = this._activeJobs.get(workItemId);
    if (active) {
      if (active.heartbeatTimer) {
        clearInterval(active.heartbeatTimer);
        active.heartbeatTimer = undefined;
      }
      active.cancelController.abort();
    }
  }

  private cleanupActiveJob(workItemId: string): void {
    const active = this._activeJobs.get(workItemId);
    if (active) {
      if (active.heartbeatTimer) {
        clearInterval(active.heartbeatTimer);
      }
      this._activeJobs.delete(workItemId);
    }
  }

  private checkCancellation(signal: AbortSignal): void {
    if (signal.aborted) {
      throw new CancellationError("Job execution has been aborted/cancelled.");
    }
  }

  private emitObservability(
    event: string,
    workItemId: string,
    payload?: Record<string, any> | undefined,
  ): void {
    if (this._observability?.onEvent) {
      try {
        this._observability.onEvent(event, workItemId, payload);
      } catch {
        // Observability must not alter business behavior
      }
    }
  }

  private generateRandomId(): string {
    return Math.random().toString(36).substring(2, 10);
  }

  private buildMatchSignalsFingerprint(signals: MatchSignals): string {
    return `skills:${signals.skillCoverage},exp:${signals.experienceCompatibility},budget:${signals.budgetCompatibility}`;
  }
}
