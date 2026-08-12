export type CacheOutcome = "L1_HIT" | "L2_HIT" | "MISS" | "BYPASS" | "INVALID" | "ERROR";

// ==========================================
// 1. DATA CONTRACTS
// ==========================================

export interface CachedJobMatchResult {
  readonly schemaVersion: number;
  readonly tenantId: string;
  readonly jobMatchId: string;
  readonly scoreId: string;
  readonly rankingId?: string | undefined;
  readonly explanationId?: string | undefined;
  readonly matchingVersion: string;
  readonly scoringVersion: string;
  readonly rankingVersion: string;
  readonly explanationVersion?: string | undefined;
  readonly weightProfileVersion?: string | undefined;
  readonly rankingPolicyVersion?: string | undefined;
  readonly explanationPolicyVersion?: string | undefined;
  readonly jobMatchFingerprint: string;
  readonly scoreFingerprint: string;
  readonly rankingFingerprint?: string | undefined;
  readonly explanationFingerprint?: string | undefined;
  readonly payload: unknown;
}

// ==========================================
// 2. CACHE STORE INTERFACES
// ==========================================

export interface CacheStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds?: number): Promise<void>;
  delete(key: string): Promise<void>;
}

// ==========================================
// 3. L1 MEMORY CACHE STORE
// ==========================================

export interface MemoryCacheOptions {
  maxSize: number;
  ttlSeconds: number;
}

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export class MemoryCacheStore implements CacheStore {
  private readonly _maxSize: number;
  private readonly _ttlSeconds: number;
  private readonly _store = new Map<string, CacheEntry<string>>();

  constructor(options: MemoryCacheOptions) {
    if (options.maxSize <= 0) {
      throw new Error("Memory cache maxSize must be greater than zero.");
    }
    if (options.ttlSeconds <= 0) {
      throw new Error("Memory cache ttlSeconds must be greater than zero.");
    }
    this._maxSize = options.maxSize;
    this._ttlSeconds = options.ttlSeconds;
  }

  public async get(key: string): Promise<string | null> {
    const entry = this._store.get(key);
    if (!entry) {
      return null;
    }
    if (Date.now() > entry.expiresAt) {
      this._store.delete(key);
      return null;
    }
    // Refresh access (move entry to the end to maintain LRU behavior)
    this._store.delete(key);
    this._store.set(key, entry);
    return entry.value;
  }

  public async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    const finalTtl = ttlSeconds ?? this._ttlSeconds;
    const expiresAt = Date.now() + finalTtl * 1000;

    if (this._store.size >= this._maxSize && !this._store.has(key)) {
      // Evict Least Recently Used entry (first key in iteration order)
      const oldestKey = this._store.keys().next().value;
      if (oldestKey !== undefined) {
        this._store.delete(oldestKey);
      }
    }

    this._store.delete(key);
    this._store.set(key, { value, expiresAt });
  }

  public async delete(key: string): Promise<void> {
    this._store.delete(key);
  }

  public clear(): void {
    this._store.clear();
  }

  get size(): number {
    return this._store.size;
  }
}

// ==========================================
// 4. KEY BUILDER
// ==========================================

export class CacheKeyBuilder {
  public static buildKey(params: {
    tenantId: string;
    jobMatchId: string;
    matchingVersion: string;
    scoringVersion: string;
    rankingVersion: string;
    explanationVersion?: string | undefined;
    weightProfileVersion?: string | undefined;
    rankingPolicyVersion?: string | undefined;
    explanationPolicyVersion?: string | undefined;
  }): string {
    if (!params.tenantId || params.tenantId.trim() === "") {
      throw new Error("tenantId is required for cache key.");
    }
    if (!params.jobMatchId || params.jobMatchId.trim() === "") {
      throw new Error("jobMatchId is required for cache key.");
    }
    if (!params.matchingVersion || params.matchingVersion.trim() === "") {
      throw new Error("matchingVersion is required for cache key.");
    }
    if (!params.scoringVersion || params.scoringVersion.trim() === "") {
      throw new Error("scoringVersion is required for cache key.");
    }
    if (!params.rankingVersion || params.rankingVersion.trim() === "") {
      throw new Error("rankingVersion is required for cache key.");
    }

    const tenant = params.tenantId.trim();
    const jobMatch = params.jobMatchId.trim();
    const matchV = params.matchingVersion.trim();
    const scoreV = params.scoringVersion.trim();
    const rankV = params.rankingVersion.trim();

    const parts = ["job-match", "v1", tenant, jobMatch, matchV, scoreV, rankV];

    if (params.explanationVersion && params.explanationVersion.trim() !== "") {
      parts.push(`exp:${params.explanationVersion.trim()}`);
    }
    if (params.weightProfileVersion && params.weightProfileVersion.trim() !== "") {
      parts.push(`wp:${params.weightProfileVersion.trim()}`);
    }
    if (params.rankingPolicyVersion && params.rankingPolicyVersion.trim() !== "") {
      parts.push(`rp:${params.rankingPolicyVersion.trim()}`);
    }
    if (params.explanationPolicyVersion && params.explanationPolicyVersion.trim() !== "") {
      parts.push(`ep:${params.explanationPolicyVersion.trim()}`);
    }

    return parts.join(":");
  }
}

// ==========================================
// 5. CACHE POLICY & CONFIGURATION
// ==========================================

export interface JobMatchCachePolicy {
  ttlSeconds: number;
  bypassCache?: boolean | undefined;
}

export interface JobMatchCacheContext {
  readonly tenantId: string;
  readonly jobMatchId: string;
  readonly scoreId?: string | undefined;
  readonly rankingId?: string | undefined;
  readonly explanationId?: string | undefined;
  readonly matchingVersion: string;
  readonly scoringVersion: string;
  readonly rankingVersion: string;
  readonly explanationVersion?: string | undefined;
  readonly weightProfileVersion?: string | undefined;
  readonly rankingPolicyVersion?: string | undefined;
  readonly explanationPolicyVersion?: string | undefined;
  readonly jobMatchFingerprint: string;
  readonly scoreFingerprint: string;
  readonly rankingFingerprint?: string | undefined;
  readonly explanationFingerprint?: string | undefined;
}

export interface CacheObservabilityHooks {
  onHit?: (outcome: "L1_HIT" | "L2_HIT", key: string) => void;
  onMiss?: (key: string) => void;
  onBypass?: (key: string, reason: string) => void;
  onInvalidPayload?: (key: string, reason: string) => void;
  onError?: (operation: "get" | "set" | "delete", key: string, error: Error) => void;
  onTimeout?: (operation: "get" | "set" | "delete", key: string) => void;
  onSingleFlightCoalesce?: (key: string) => void;
}

export interface JobMatchCacheConfig {
  schemaVersion: number;
  l1: MemoryCacheStore;
  l2?: CacheStore | undefined;
  timeoutMs: number;
  observability?: CacheObservabilityHooks | undefined;
}

// ==========================================
// 6. CACHE MANAGER WITH STAMPEDE PROTECTION
// ==========================================

export class JobMatchCacheManager {
  private readonly _config: JobMatchCacheConfig;
  private readonly _activeComputations = new Map<string, Promise<CachedJobMatchResult>>();

  constructor(config: JobMatchCacheConfig) {
    if (config.schemaVersion <= 0) {
      throw new Error("Schema version must be positive.");
    }
    if (!config.l1) {
      throw new Error("L1 Memory Cache Store is required.");
    }
    this._config = config;
  }

  private async withTimeout<T>(
    promise: Promise<T>,
    operation: "get" | "set" | "delete",
    key: string,
  ): Promise<T> {
    let timer: NodeJS.Timeout | undefined;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        if (this._config.observability?.onTimeout) {
          this._config.observability.onTimeout(operation, key);
        }
        reject(new Error(`Cache store operation '${operation}' timed out.`));
      }, this._config.timeoutMs);
    });

    try {
      return await Promise.race([promise, timeoutPromise]);
    } finally {
      if (timer) {
        clearTimeout(timer);
      }
    }
  }

  /**
   * Scans an object recursively for sensitive keys.
   */
  private hasSensitiveData(value: unknown): boolean {
    if (value === null || value === undefined) {
      return false;
    }
    if (Array.isArray(value)) {
      return value.some((v) => this.hasSensitiveData(v));
    }
    if (typeof value === "object") {
      const obj = value as Record<string, unknown>;
      for (const key of Object.keys(obj)) {
        const lowerKey = key.toLowerCase();
        if (
          lowerKey.includes("apikey") ||
          lowerKey.includes("api_key") ||
          lowerKey.includes("password") ||
          lowerKey.includes("token") ||
          lowerKey.includes("secret") ||
          lowerKey.includes("credential")
        ) {
          return true;
        }
        if (this.hasSensitiveData(obj[key])) {
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Safe deserialization and validation of payload to prevent cache poisoning.
   */
  private validateAndDeserialize(
    rawString: string,
    key: string,
    expectedContext: JobMatchCacheContext,
  ): CachedJobMatchResult | null {
    try {
      const parsed = JSON.parse(rawString);
      if (!parsed || typeof parsed !== "object") {
        this.logInvalid(key, "Payload is not an object.");
        return null;
      }

      const dto = parsed as CachedJobMatchResult;

      // 0. Base validation of required fields in CachedJobMatchResult shape
      if (
        typeof dto.schemaVersion !== "number" ||
        typeof dto.tenantId !== "string" ||
        typeof dto.jobMatchId !== "string" ||
        typeof dto.scoreId !== "string" ||
        typeof dto.matchingVersion !== "string" ||
        typeof dto.scoringVersion !== "string" ||
        typeof dto.rankingVersion !== "string" ||
        typeof dto.jobMatchFingerprint !== "string" ||
        typeof dto.scoreFingerprint !== "string" ||
        dto.payload === undefined
      ) {
        this.logInvalid(key, "Missing required fields in payload.");
        return null;
      }

      // 1. Schema version
      if (dto.schemaVersion !== this._config.schemaVersion) {
        this.logInvalid(
          key,
          `Schema version mismatch. Expected ${this._config.schemaVersion}, got ${dto.schemaVersion}.`,
        );
        return null;
      }

      // 2. Tenant isolation check
      if (dto.tenantId !== expectedContext.tenantId) {
        this.logInvalid(
          key,
          `Tenant isolation mismatch. Expected ${expectedContext.tenantId}, got ${dto.tenantId}.`,
        );
        return null;
      }

      // 3. Job match identity check
      if (dto.jobMatchId !== expectedContext.jobMatchId) {
        this.logInvalid(
          key,
          `Job match identity mismatch. Expected ${expectedContext.jobMatchId}, got ${dto.jobMatchId}.`,
        );
        return null;
      }

      // 4. Algorithm versions check
      if (
        dto.matchingVersion !== expectedContext.matchingVersion ||
        dto.scoringVersion !== expectedContext.scoringVersion ||
        dto.rankingVersion !== expectedContext.rankingVersion
      ) {
        this.logInvalid(key, "Algorithm version mismatch.");
        return null;
      }
      if (
        expectedContext.explanationVersion !== undefined &&
        dto.explanationVersion !== expectedContext.explanationVersion
      ) {
        this.logInvalid(key, "Explanation version mismatch.");
        return null;
      }
      if (
        expectedContext.weightProfileVersion !== undefined &&
        dto.weightProfileVersion !== expectedContext.weightProfileVersion
      ) {
        this.logInvalid(key, "Weight profile version mismatch.");
        return null;
      }
      if (
        expectedContext.rankingPolicyVersion !== undefined &&
        dto.rankingPolicyVersion !== expectedContext.rankingPolicyVersion
      ) {
        this.logInvalid(key, "Ranking policy version mismatch.");
        return null;
      }
      if (
        expectedContext.explanationPolicyVersion !== undefined &&
        dto.explanationPolicyVersion !== expectedContext.explanationPolicyVersion
      ) {
        this.logInvalid(key, "Explanation policy version mismatch.");
        return null;
      }

      // 5. Fingerprints validations
      if (dto.jobMatchFingerprint !== expectedContext.jobMatchFingerprint) {
        this.logInvalid(key, "jobMatchFingerprint mismatch.");
        return null;
      }
      if (dto.scoreFingerprint !== expectedContext.scoreFingerprint) {
        this.logInvalid(key, "scoreFingerprint mismatch.");
        return null;
      }
      if (
        expectedContext.rankingFingerprint !== undefined &&
        dto.rankingFingerprint !== expectedContext.rankingFingerprint
      ) {
        this.logInvalid(key, "rankingFingerprint mismatch.");
        return null;
      }
      if (
        expectedContext.explanationFingerprint !== undefined &&
        dto.explanationFingerprint !== expectedContext.explanationFingerprint
      ) {
        this.logInvalid(key, "explanationFingerprint mismatch.");
        return null;
      }

      // 6. Security verification: Verify payload does not contain keys or passwords
      if (this.hasSensitiveData(dto.payload)) {
        this.logInvalid(key, "Security policy violation: payload contains sensitive data.");
        return null;
      }

      // Deeply freeze DTO to prevent caller mutation from altering cache store state
      const frozenDto = this.deepFreeze(dto);
      return frozenDto;
    } catch {
      this.logInvalid(key, "JSON parsing exception.");
      return null;
    }
  }

  private logInvalid(key: string, reason: string): void {
    if (this._config.observability?.onInvalidPayload) {
      this._config.observability.onInvalidPayload(key, reason);
    }
  }

  private deepFreeze<T>(obj: T): T {
    if (obj === null || typeof obj !== "object") {
      return obj;
    }
    Object.freeze(obj);
    for (const key of Object.getOwnPropertyNames(obj)) {
      const prop = (obj as Record<string, unknown>)[key];
      if (prop !== null && (typeof prop === "object" || typeof prop === "function")) {
        this.deepFreeze(prop);
      }
    }
    return obj;
  }

  public async get(
    expectedContext: JobMatchCacheContext,
    policy: JobMatchCachePolicy,
  ): Promise<{ outcome: CacheOutcome; result: CachedJobMatchResult | null }> {
    const key = CacheKeyBuilder.buildKey(expectedContext);

    // Bypass option
    if (policy.bypassCache) {
      if (this._config.observability?.onBypass) {
        this._config.observability.onBypass(key, "Bypassed by client policy");
      }
      return { outcome: "BYPASS", result: null };
    }

    let isPayloadInvalid = false;
    let hasError = false;

    // 1. Try L1 Memory cache
    try {
      const l1Val = await this._config.l1.get(key);
      if (l1Val !== null) {
        const dto = this.validateAndDeserialize(l1Val, key, expectedContext);
        if (dto !== null) {
          if (this._config.observability?.onHit) {
            this._config.observability.onHit("L1_HIT", key);
          }
          return { outcome: "L1_HIT", result: dto };
        } else {
          isPayloadInvalid = true;
          // Invalidate corrupted entry in L1
          await this._config.l1.delete(key).catch(() => {});
        }
      }
    } catch (err) {
      hasError = true;
      if (this._config.observability?.onError) {
        this._config.observability.onError("get", key, err as Error);
      }
    }

    // 2. Try L2 Redis cache
    if (this._config.l2) {
      try {
        const l2Val = await this.withTimeout(this._config.l2.get(key), "get", key);
        if (l2Val !== null) {
          const dto = this.validateAndDeserialize(l2Val, key, expectedContext);
          if (dto !== null) {
            // Populate L1 cache for subsequent access
            await this._config.l1.set(key, l2Val, policy.ttlSeconds).catch(() => {});
            if (this._config.observability?.onHit) {
              this._config.observability.onHit("L2_HIT", key);
            }
            return { outcome: "L2_HIT", result: dto };
          } else {
            isPayloadInvalid = true;
            // Invalidate corrupted entry on L2 and L1
            await this._config.l2.delete(key).catch(() => {});
            await this._config.l1.delete(key).catch(() => {});
          }
        }
      } catch (err) {
        hasError = true;
        if (this._config.observability?.onError) {
          this._config.observability.onError("get", key, err as Error);
        }
      }
    }

    if (hasError) {
      return { outcome: "ERROR", result: null };
    }
    if (isPayloadInvalid) {
      return { outcome: "INVALID", result: null };
    }

    if (this._config.observability?.onMiss) {
      this._config.observability.onMiss(key);
    }
    return { outcome: "MISS", result: null };
  }

  /**
   * Set cache entry for both L1 and L2 levels. Degrading gracefully on infrastructure failure.
   */
  public async set(
    expectedContext: JobMatchCacheContext,
    payload: unknown,
    policy: JobMatchCachePolicy,
  ): Promise<void> {
    const key = CacheKeyBuilder.buildKey(expectedContext);

    // Extract output IDs if not provided in expectedContext
    let scoreId = expectedContext.scoreId;
    let rankingId = expectedContext.rankingId;
    let explanationId = expectedContext.explanationId;

    if (!scoreId && payload && typeof payload === "object") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const p = payload as any;
      scoreId = p.scoreId || (p.score && p.score.id) || p.id;
      rankingId = rankingId || p.rankingId || (p.ranking && p.ranking.id);
      explanationId = explanationId || p.explanationId || (p.explanation && p.explanation.id);
    }

    if (!scoreId) {
      throw new Error("scoreId is required to write to cache.");
    }

    const dto: CachedJobMatchResult = {
      schemaVersion: this._config.schemaVersion,
      tenantId: expectedContext.tenantId,
      jobMatchId: expectedContext.jobMatchId,
      scoreId,
      rankingId,
      explanationId,
      matchingVersion: expectedContext.matchingVersion,
      scoringVersion: expectedContext.scoringVersion,
      rankingVersion: expectedContext.rankingVersion,
      explanationVersion: expectedContext.explanationVersion,
      weightProfileVersion: expectedContext.weightProfileVersion,
      rankingPolicyVersion: expectedContext.rankingPolicyVersion,
      explanationPolicyVersion: expectedContext.explanationPolicyVersion,
      jobMatchFingerprint: expectedContext.jobMatchFingerprint,
      scoreFingerprint: expectedContext.scoreFingerprint,
      rankingFingerprint: expectedContext.rankingFingerprint,
      explanationFingerprint: expectedContext.explanationFingerprint,
      payload,
    };

    // Before serializing, make sure there are no secrets in payload
    if (this.hasSensitiveData(payload)) {
      if (this._config.observability?.onInvalidPayload) {
        this._config.observability.onInvalidPayload(
          key,
          "Security policy violation: payload contains sensitive data.",
        );
      }
      return;
    }

    const serializedStr = JSON.stringify(dto);

    // 1. Populate L1 memory
    try {
      await this._config.l1.set(key, serializedStr, policy.ttlSeconds);
    } catch (err) {
      if (this._config.observability?.onError) {
        this._config.observability.onError("set", key, err as Error);
      }
    }

    // 2. Populate L2 redis (with timeout protection)
    if (this._config.l2) {
      try {
        await this.withTimeout(
          this._config.l2.set(key, serializedStr, policy.ttlSeconds),
          "set",
          key,
        );
      } catch (err) {
        if (this._config.observability?.onError) {
          this._config.observability.onError("set", key, err as Error);
        }
        // Do NOT crash application because L2 write fails
      }
    }
  }

  /**
   * Delete cache entry from both L1 and L2 levels.
   */
  public async delete(params: {
    tenantId: string;
    jobMatchId: string;
    matchingVersion: string;
    scoringVersion: string;
    rankingVersion: string;
    explanationVersion?: string | undefined;
    weightProfileVersion?: string | undefined;
    rankingPolicyVersion?: string | undefined;
    explanationPolicyVersion?: string | undefined;
  }): Promise<void> {
    const key = CacheKeyBuilder.buildKey(params);

    try {
      await this._config.l1.delete(key);
    } catch (err) {
      if (this._config.observability?.onError) {
        this._config.observability.onError("delete", key, err as Error);
      }
    }

    if (this._config.l2) {
      try {
        await this.withTimeout(this._config.l2.delete(key), "delete", key);
      } catch (err) {
        if (this._config.observability?.onError) {
          this._config.observability.onError("delete", key, err as Error);
        }
      }
    }
  }

  /**
   * Safe single-flight coalescing runner that protects against cache stampede.
   */
  public async executeCoalesced(
    expectedContext: JobMatchCacheContext,
    policy: JobMatchCachePolicy,
    compute: () => Promise<unknown>,
  ): Promise<CachedJobMatchResult> {
    const key = CacheKeyBuilder.buildKey(expectedContext);

    // 1. Try cache hit first
    const cacheResult = await this.get(expectedContext, policy);
    if (cacheResult.result !== null) {
      return cacheResult.result;
    }

    // 2. Check active computations
    const active = this._activeComputations.get(key);
    if (active) {
      if (this._config.observability?.onSingleFlightCoalesce) {
        this._config.observability.onSingleFlightCoalesce(key);
      }
      return active;
    }

    // 3. Setup new computation promise
    const promise = (async () => {
      try {
        const payloadData = await compute();
        await this.set(expectedContext, payloadData, policy);
        const refetch = await this.get(expectedContext, policy);
        if (refetch.result === null) {
          throw new Error("Cache population failure during coalescing flow.");
        }
        return refetch.result;
      } finally {
        this._activeComputations.delete(key);
      }
    })();

    this._activeComputations.set(key, promise);
    return promise;
  }
}
