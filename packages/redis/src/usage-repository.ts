import { UsageRepository } from "@freelanceos/core";
import { redis } from "./client.js";

export class RedisUsageRepository implements UsageRepository {
  public async consume(
    key: string,
    limit: number,
    amount: number,
  ): Promise<{ success: boolean; current: number }> {
    // Lua script checks if current usage + amount <= limit, increments and returns 1 + new usage if true.
    // Otherwise returns 0 + current usage.
    const script = `
      local key = KEYS[1]
      local limit = tonumber(ARGV[1])
      local amount = tonumber(ARGV[2])
      local current = tonumber(redis.call('GET', key) or "0")
      if current + amount <= limit then
        local next_val = redis.call('INCRBY', key, amount)
        return {1, next_val}
      else
        return {0, current}
      end
    `;

    // Execute script atomically in Redis
    const result = (await redis.eval(script, 1, key, limit, amount)) as [number, number];

    return {
      success: result[0] === 1,
      current: result[1],
    };
  }

  public async getUsage(key: string): Promise<number> {
    const value = await redis.get(key);
    return value ? parseInt(value, 10) : 0;
  }

  public async reset(): Promise<void> {
    const keys = await redis.keys("usage:*");
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  }
}
