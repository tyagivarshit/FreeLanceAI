import { redis } from "./client.js";
export class RedisUsageRepository {
    async consume(key, limit, amount, ttlSeconds = 86400) {
        const script = `
      local key = KEYS[1]
      local limit = tonumber(ARGV[1])
      local amount = tonumber(ARGV[2])
      local ttl = tonumber(ARGV[3])
      local current = tonumber(redis.call('GET', key) or "0")
      if current + amount <= limit then
        local next_val = redis.call('INCRBY', key, amount)
        if current == 0 and ttl > 0 then
          redis.call('EXPIRE', key, ttl)
        end
        return {1, next_val}
      else
        return {0, current}
      end
    `;
        const result = (await redis.eval(script, 1, key, limit, amount, ttlSeconds));
        return {
            success: result[0] === 1,
            current: result[1],
        };
    }
    async refund(key, amount) {
        const script = `
      local current = tonumber(redis.call('GET', KEYS[1]))
      if current then
        local amt = tonumber(ARGV[1])
        local next_val = current - amt
        if next_val < 0 then next_val = 0 end
        redis.call('SET', KEYS[1], next_val, 'KEEPTTL')
      end
    `;
        await redis.eval(script, 1, key, amount);
    }
    async getUsage(key) {
        const value = await redis.get(key);
        return value ? parseInt(value, 10) : 0;
    }
    async reset() {
        const keys = await redis.keys("usage:*");
        if (keys.length > 0) {
            await redis.del(...keys);
        }
    }
}
