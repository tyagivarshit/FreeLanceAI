import { redis } from "@freelanceos/redis";
import { db, sessions } from "@freelanceos/db";
import { sql } from "drizzle-orm";
const ACTIVITY_CACHE_KEY = "session:activities:buffer";
/**
 * 0ms Memory Update: Buffers the session's last activity timestamp in a Redis Hash.
 * This completely avoids Postgres DB contention on every HTTP request.
 */
export async function bufferSessionActivity(sessionId) {
    // Use HSET to store activity against sessionId in O(1) time.
    // Fire-and-forget ensures 0ms latency for the HTTP request cycle.
    redis.hset(ACTIVITY_CACHE_KEY, sessionId, Date.now()).catch(() => { });
}
/**
 * Background Job Function: Flushes all buffered activities from Redis
 * to Postgres using a highly optimized single multi-row batch update.
 * Can be scheduled every 5-10 minutes.
 */
export async function flushSessionActivities() {
    // 1. Fetch all buffered activities atomically and clear the hash buffer
    const multi = redis.multi();
    multi.hgetall(ACTIVITY_CACHE_KEY);
    multi.del(ACTIVITY_CACHE_KEY);
    const results = await multi.exec();
    if (!results || !results[0] || !results[0][1]) {
        return 0;
    }
    const activities = results[0][1];
    const sessionIds = Object.keys(activities);
    if (sessionIds.length === 0) {
        return 0;
    }
    // 2. Multi-row batch flush to Postgres using VALUES mapping.
    // This executes thousands of session updates in ONE single database query!
    const valuesSql = sessionIds.map(id => {
        const timestampMs = parseInt(activities[id], 10);
        const isoDate = new Date(timestampMs).toISOString();
        return sql `(${id}::uuid, ${isoDate}::timestamp)`;
    });
    await db.execute(sql `
    UPDATE ${sessions} AS s
    SET last_activity_at = v.last_activity_at,
        updated_at = NOW()
    FROM (VALUES ${sql.join(valuesSql, sql `, `)}) AS v(id, last_activity_at)
    WHERE s.id = v.id
  `);
    return sessionIds.length;
}
