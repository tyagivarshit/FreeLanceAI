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
}
