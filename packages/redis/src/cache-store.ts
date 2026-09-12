import { CacheStore } from "@freelanceos/core";
import { redis } from "./client.js";

export class RedisCacheStore implements CacheStore {
  public async get(key: string): Promise<string | null> {
    return await redis.get(key);
  }

  public async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (ttlSeconds !== undefined && ttlSeconds > 0) {
      await redis.set(key, value, "EX", ttlSeconds);
    } else {
      await redis.set(key, value);
    }
  }

  public async delete(key: string): Promise<void> {
    await redis.del(key);
  }

  public async increment(key: string, ttlSeconds?: number): Promise<number> {
    const multi = redis.multi();
    multi.incr(key);
    if (ttlSeconds !== undefined && ttlSeconds > 0) {
      multi.expire(key, ttlSeconds);
    }
    const results = await multi.exec();
    if (!results) {
      throw new Error("Redis multi exec failed");
    }
    return results[0]![1] as number;
  }
}
