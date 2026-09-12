import { Redis } from "ioredis";

export interface CacheStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
}

/**
 * Chapter 8H: Caching Layer for Match Analytics
 * Safely bounds multi-tenant Redis caching rules and event-driven invalidation.
 */
export class JobMatchCacheService implements CacheStore {
  private redis: Redis;
  
  // Safe 5-minute hard TTL fallback to prevent permanent stale data traps
  private readonly TTL_SECONDS = 300; 

  constructor(redisUrl: string = process.env.REDIS_URL || "redis://localhost:6379") {
    this.redis = new Redis(redisUrl);
  }

  /**
   * STRICT COMPOSITE CACHE KEYS
   * Binds the specific tenant and job into the physical memory key structure 
   * to guarantee memory isolation and block cache poisoning bypassing database scopes.
   */
  private buildLeaderboardKey(tenantId: string, jobId: string): string {
    if (!tenantId || !jobId) {
      throw new Error("Invalid cache boundaries: tenantId and jobId are strictly required.");
    }
    return `cache:tenant:${tenantId}:job:${jobId}`;
  }

  public async getLeaderboard(tenantId: string, jobId: string): Promise<string | null> {
    const key = this.buildLeaderboardKey(tenantId, jobId);
    return this.get(key);
  }

  public async setLeaderboard(tenantId: string, jobId: string, data: string): Promise<void> {
    const key = this.buildLeaderboardKey(tenantId, jobId);
    await this.set(key, data, this.TTL_SECONDS);
  }

  /**
   * EVENT-DRIVEN INVALIDATION ENGINE
   * Intended to be invoked by background scoring workers post-commit to instantly
   * drop stale Redis cache indices rather than waiting for 5-minute TTL expirations.
   */
  public async invalidateJobCache(tenantId: string, jobId: string): Promise<void> {
    const key = this.buildLeaderboardKey(tenantId, jobId);
    await this.delete(key);
  }

  // -------------------------------------------------------------------------
  // Generic CacheStore Implementation (Satisfies dangling entitlement/webhook deps)
  // -------------------------------------------------------------------------
  
  public async get(key: string): Promise<string | null> {
    return this.redis.get(key);
  }

  public async set(key: string, value: string, ttl: number = this.TTL_SECONDS): Promise<void> {
    await this.redis.setex(key, ttl, value);
  }

  public async delete(key: string): Promise<void> {
    await this.redis.del(key);
  }
}
