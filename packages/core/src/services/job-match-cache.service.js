import { Redis } from "ioredis";
/**
 * Chapter 8H: Caching Layer for Match Analytics
 * Safely bounds multi-tenant Redis caching rules and event-driven invalidation.
 */
export class JobMatchCacheService {
    redis;
    // Safe 5-minute hard TTL fallback to prevent permanent stale data traps
    TTL_SECONDS = 300;
    constructor(redisUrl = process.env.REDIS_URL || "redis://localhost:6379") {
        this.redis = new Redis(redisUrl);
    }
    /**
     * STRICT COMPOSITE CACHE KEYS
     * Binds the specific tenant and job into the physical memory key structure
     * to guarantee memory isolation and block cache poisoning bypassing database scopes.
     */
    buildLeaderboardKey(tenantId, jobId) {
        if (!tenantId || !jobId) {
            throw new Error("Invalid cache boundaries: tenantId and jobId are strictly required.");
        }
        return `cache:tenant:${tenantId}:job:${jobId}`;
    }
    async getLeaderboard(tenantId, jobId) {
        const key = this.buildLeaderboardKey(tenantId, jobId);
        return this.get(key);
    }
    async setLeaderboard(tenantId, jobId, data) {
        const key = this.buildLeaderboardKey(tenantId, jobId);
        await this.set(key, data, this.TTL_SECONDS);
    }
    /**
     * EVENT-DRIVEN INVALIDATION ENGINE
     * Intended to be invoked by background scoring workers post-commit to instantly
     * drop stale Redis cache indices rather than waiting for 5-minute TTL expirations.
     */
    async invalidateJobCache(tenantId, jobId) {
        const key = this.buildLeaderboardKey(tenantId, jobId);
        await this.delete(key);
    }
    // -------------------------------------------------------------------------
    // Generic CacheStore Implementation (Satisfies dangling entitlement/webhook deps)
    // -------------------------------------------------------------------------
    async get(key) {
        return this.redis.get(key);
    }
    async set(key, value, ttl = this.TTL_SECONDS) {
        await this.redis.setex(key, ttl, value);
    }
    async delete(key) {
        await this.redis.del(key);
    }
}
