import { redis } from "./client.js";
export class RedisMemoryCacheService {
    /**
     * Appends a message to the session's Redis List and enforces the sliding window limit.
     * Gives ~1ms latency for live operations.
     */
    async addMessage(sessionId, messagePayload, maxMessages) {
        const key = `memory:session:${sessionId}`;
        const multi = redis.multi();
        // RPUSH adds to the right (end) of the list
        multi.rpush(key, messagePayload);
        // LTRIM slices the list to keep only the latest `maxMessages`
        multi.ltrim(key, -maxMessages, -1);
        // Extend expiry to 24 hours of inactivity
        multi.expire(key, 86400);
        await multi.exec();
    }
    /**
     * Retrieves the current sliding window of messages from Redis cache.
     */
    async getMessages(sessionId) {
        const key = `memory:session:${sessionId}`;
        // LRANGE key 0 -1 returns all elements in the list
        return await redis.lrange(key, 0, -1);
    }
}
