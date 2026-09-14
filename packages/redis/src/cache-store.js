import { redis } from "./client.js";
export class RedisCacheStore {
    async get(key) {
        return await redis.get(key);
    }
    async set(key, value, ttlSeconds) {
        if (ttlSeconds !== undefined && ttlSeconds > 0) {
            await redis.set(key, value, "EX", ttlSeconds);
        }
        else {
            await redis.set(key, value);
        }
    }
    async delete(key) {
        await redis.del(key);
    }
    async increment(key, ttlSeconds) {
        const multi = redis.multi();
        multi.incr(key);
        if (ttlSeconds !== undefined && ttlSeconds > 0) {
            multi.expire(key, ttlSeconds);
        }
        const results = await multi.exec();
        if (!results) {
            throw new Error("Redis multi exec failed");
        }
        return results[0][1];
    }
}
