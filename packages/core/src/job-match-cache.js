export class MemoryCacheStore {
    _maxSize;
    _ttlSeconds;
    _store = new Map();
    constructor(options) {
        if (options.maxSize <= 0) {
            throw new Error("Memory cache maxSize must be greater than zero.");
        }
        if (options.ttlSeconds <= 0) {
            throw new Error("Memory cache ttlSeconds must be greater than zero.");
        }
        this._maxSize = options.maxSize;
        this._ttlSeconds = options.ttlSeconds;
    }
    async get(key) {
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
    async set(key, value, ttlSeconds) {
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
    async delete(key) {
        this._store.delete(key);
    }
    clear() {
        this._store.clear();
    }
    get size() {
        return this._store.size;
    }
}
// ==========================================
// 4. KEY BUILDER
// ==========================================
export class CacheKeyBuilder {
    static buildKey(params) {
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
// 6. CACHE MANAGER WITH STAMPEDE PROTECTION
// ==========================================
export class JobMatchCacheManager {
    _config;
    _activeComputations = new Map();
    constructor(config) {
        if (config.schemaVersion <= 0) {
            throw new Error("Schema version must be positive.");
        }
        if (!config.l1) {
            throw new Error("L1 Memory Cache Store is required.");
        }
        this._config = config;
    }
    async withTimeout(promise, operation, key) {
        let timer;
        const timeoutPromise = new Promise((_, reject) => {
            timer = setTimeout(() => {
                if (this._config.observability?.onTimeout) {
                    this._config.observability.onTimeout(operation, key);
                }
                reject(new Error(`Cache store operation '${operation}' timed out.`));
            }, this._config.timeoutMs);
        });
        try {
            return await Promise.race([promise, timeoutPromise]);
        }
        finally {
            if (timer) {
                clearTimeout(timer);
            }
        }
    }
    /**
     * Scans an object recursively for sensitive keys.
     */
    hasSensitiveData(value) {
        if (value === null || value === undefined) {
            return false;
        }
        if (Array.isArray(value)) {
            return value.some((v) => this.hasSensitiveData(v));
        }
        if (typeof value === "object") {
            const obj = value;
            for (const key of Object.keys(obj)) {
                const lowerKey = key.toLowerCase();
                if (lowerKey.includes("apikey") ||
                    lowerKey.includes("api_key") ||
                    lowerKey.includes("password") ||
                    lowerKey.includes("token") ||
                    lowerKey.includes("secret") ||
                    lowerKey.includes("credential")) {
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
    validateAndDeserialize(rawString, key, expectedContext) {
        try {
            const parsed = JSON.parse(rawString);
            if (!parsed || typeof parsed !== "object") {
                this.logInvalid(key, "Payload is not an object.");
                return null;
            }
            const dto = parsed;
            // 0. Base validation of required fields in CachedJobMatchResult shape
            if (typeof dto.schemaVersion !== "number" ||
                typeof dto.tenantId !== "string" ||
                typeof dto.jobMatchId !== "string" ||
                typeof dto.scoreId !== "string" ||
                typeof dto.matchingVersion !== "string" ||
                typeof dto.scoringVersion !== "string" ||
                typeof dto.rankingVersion !== "string" ||
                typeof dto.jobMatchFingerprint !== "string" ||
                typeof dto.scoreFingerprint !== "string" ||
                dto.payload === undefined) {
                this.logInvalid(key, "Missing required fields in payload.");
                return null;
            }
            // 1. Schema version
            if (dto.schemaVersion !== this._config.schemaVersion) {
                this.logInvalid(key, `Schema version mismatch. Expected ${this._config.schemaVersion}, got ${dto.schemaVersion}.`);
                return null;
            }
            // 2. Tenant isolation check
            if (dto.tenantId !== expectedContext.tenantId) {
                this.logInvalid(key, `Tenant isolation mismatch. Expected ${expectedContext.tenantId}, got ${dto.tenantId}.`);
                return null;
            }
            // 3. Job match identity check
            if (dto.jobMatchId !== expectedContext.jobMatchId) {
                this.logInvalid(key, `Job match identity mismatch. Expected ${expectedContext.jobMatchId}, got ${dto.jobMatchId}.`);
                return null;
            }
            // 4. Algorithm versions check
            if (dto.matchingVersion !== expectedContext.matchingVersion ||
                dto.scoringVersion !== expectedContext.scoringVersion ||
                dto.rankingVersion !== expectedContext.rankingVersion) {
                this.logInvalid(key, "Algorithm version mismatch.");
                return null;
            }
            if (expectedContext.explanationVersion !== undefined &&
                dto.explanationVersion !== expectedContext.explanationVersion) {
                this.logInvalid(key, "Explanation version mismatch.");
                return null;
            }
            if (expectedContext.weightProfileVersion !== undefined &&
                dto.weightProfileVersion !== expectedContext.weightProfileVersion) {
                this.logInvalid(key, "Weight profile version mismatch.");
                return null;
            }
            if (expectedContext.rankingPolicyVersion !== undefined &&
                dto.rankingPolicyVersion !== expectedContext.rankingPolicyVersion) {
                this.logInvalid(key, "Ranking policy version mismatch.");
                return null;
            }
            if (expectedContext.explanationPolicyVersion !== undefined &&
                dto.explanationPolicyVersion !== expectedContext.explanationPolicyVersion) {
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
            if (expectedContext.rankingFingerprint !== undefined &&
                dto.rankingFingerprint !== expectedContext.rankingFingerprint) {
                this.logInvalid(key, "rankingFingerprint mismatch.");
                return null;
            }
            if (expectedContext.explanationFingerprint !== undefined &&
                dto.explanationFingerprint !== expectedContext.explanationFingerprint) {
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
        }
        catch {
            this.logInvalid(key, "JSON parsing exception.");
            return null;
        }
    }
    logInvalid(key, reason) {
        if (this._config.observability?.onInvalidPayload) {
            this._config.observability.onInvalidPayload(key, reason);
        }
    }
    deepFreeze(obj) {
        if (obj === null || typeof obj !== "object") {
            return obj;
        }
        Object.freeze(obj);
        for (const key of Object.getOwnPropertyNames(obj)) {
            const prop = obj[key];
            if (prop !== null && (typeof prop === "object" || typeof prop === "function")) {
                this.deepFreeze(prop);
            }
        }
        return obj;
    }
    async get(expectedContext, policy) {
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
                }
                else {
                    isPayloadInvalid = true;
                    // Invalidate corrupted entry in L1
                    await this._config.l1.delete(key).catch(() => { });
                }
            }
        }
        catch (err) {
            hasError = true;
            if (this._config.observability?.onError) {
                this._config.observability.onError("get", key, err);
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
                        await this._config.l1.set(key, l2Val, policy.ttlSeconds).catch(() => { });
                        if (this._config.observability?.onHit) {
                            this._config.observability.onHit("L2_HIT", key);
                        }
                        return { outcome: "L2_HIT", result: dto };
                    }
                    else {
                        isPayloadInvalid = true;
                        // Invalidate corrupted entry on L2 and L1
                        await this._config.l2.delete(key).catch(() => { });
                        await this._config.l1.delete(key).catch(() => { });
                    }
                }
            }
            catch (err) {
                hasError = true;
                if (this._config.observability?.onError) {
                    this._config.observability.onError("get", key, err);
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
    async set(expectedContext, payload, policy) {
        const key = CacheKeyBuilder.buildKey(expectedContext);
        // Extract output IDs if not provided in expectedContext
        let scoreId = expectedContext.scoreId;
        let rankingId = expectedContext.rankingId;
        let explanationId = expectedContext.explanationId;
        if (!scoreId && payload && typeof payload === "object") {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const p = payload;
            scoreId = p.scoreId || (p.score && p.score.id) || p.id;
            rankingId = rankingId || p.rankingId || (p.ranking && p.ranking.id);
            explanationId = explanationId || p.explanationId || (p.explanation && p.explanation.id);
        }
        if (!scoreId) {
            throw new Error("scoreId is required to write to cache.");
        }
        const dto = {
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
                this._config.observability.onInvalidPayload(key, "Security policy violation: payload contains sensitive data.");
            }
            return;
        }
        const serializedStr = JSON.stringify(dto);
        // 1. Populate L1 memory
        try {
            await this._config.l1.set(key, serializedStr, policy.ttlSeconds);
        }
        catch (err) {
            if (this._config.observability?.onError) {
                this._config.observability.onError("set", key, err);
            }
        }
        // 2. Populate L2 redis (with timeout protection)
        if (this._config.l2) {
            try {
                await this.withTimeout(this._config.l2.set(key, serializedStr, policy.ttlSeconds), "set", key);
            }
            catch (err) {
                if (this._config.observability?.onError) {
                    this._config.observability.onError("set", key, err);
                }
                // Do NOT crash application because L2 write fails
            }
        }
    }
    /**
     * Delete cache entry from both L1 and L2 levels.
     */
    async delete(params) {
        const key = CacheKeyBuilder.buildKey(params);
        try {
            await this._config.l1.delete(key);
        }
        catch (err) {
            if (this._config.observability?.onError) {
                this._config.observability.onError("delete", key, err);
            }
        }
        if (this._config.l2) {
            try {
                await this.withTimeout(this._config.l2.delete(key), "delete", key);
            }
            catch (err) {
                if (this._config.observability?.onError) {
                    this._config.observability.onError("delete", key, err);
                }
            }
        }
    }
    /**
     * Safe single-flight coalescing runner that protects against cache stampede.
     */
    async executeCoalesced(expectedContext, policy, compute) {
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
            }
            finally {
                this._activeComputations.delete(key);
            }
        })();
        this._activeComputations.set(key, promise);
        return promise;
    }
}
