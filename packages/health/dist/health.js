import { verifyConnection } from "@freelanceos/db";
import { verifyRedisConnection } from "@freelanceos/redis";
// Runtime Health Checks operational policy rules
export const HEALTH_POLICY = {
    DEPENDENCY_TIMEOUT_MS: 3000, // 3-second budget per checker to prevent health check hangs
    VERSION: "v1",
};
/**
 * Utility wrapper that enforces an execution timeout budget.
 */
async function withTimeout(promise, timeoutMs, errorMessage) {
    let timeoutHandle;
    const timeoutPromise = new Promise((_, reject) => {
        timeoutHandle = setTimeout(() => {
            reject(new Error(errorMessage));
        }, timeoutMs);
    });
    return Promise.race([promise, timeoutPromise]).finally(() => {
        if (timeoutHandle) {
            clearTimeout(timeoutHandle);
        }
    });
}
/**
 * Measures the execution time of a promise action.
 */
async function measureExecutionTime(action) {
    const start = performance.now();
    const result = await action();
    const end = performance.now();
    return {
        result,
        durationMs: Math.round(end - start),
    };
}
/**
 * Performs a lightweight liveness check on the process state.
 */
export function checkLiveness() {
    return {
        status: "healthy",
        uptimeSeconds: Math.round(process.uptime()),
        timestamp: new Date().toISOString(),
    };
}
/**
 * Performs a thorough readiness health aggregation check across dependencies.
 * Execution runs concurrently to ensure slow handlers do not block other checkers.
 */
export async function checkReadiness() {
    const timestamp = new Date().toISOString();
    // Initialize checkers concurrently
    const dbPromise = measureExecutionTime(() => withTimeout(verifyConnection(), HEALTH_POLICY.DEPENDENCY_TIMEOUT_MS, "Database health check connection timeout"));
    const redisPromise = measureExecutionTime(() => withTimeout(verifyRedisConnection(), HEALTH_POLICY.DEPENDENCY_TIMEOUT_MS, "Redis health check connection timeout"));
    // Await concurrent outcomes
    const [dbResult, redisResult] = await Promise.allSettled([dbPromise, redisPromise]);
    // Evaluate Database status
    let dbStatus;
    if (dbResult.status === "fulfilled") {
        dbStatus = { status: "healthy", latencyMs: dbResult.value.durationMs, timestamp };
    }
    else {
        dbStatus = {
            status: "unhealthy",
            latencyMs: 0,
            error: dbResult.reason instanceof Error ? dbResult.reason.message : "Unknown database error",
            timestamp,
        };
    }
    // Evaluate Redis status
    let redisStatus;
    if (redisResult.status === "fulfilled") {
        redisStatus = { status: "healthy", latencyMs: redisResult.value.durationMs, timestamp };
    }
    else {
        redisStatus = {
            status: "unhealthy",
            latencyMs: 0,
            error: redisResult.reason instanceof Error ? redisResult.reason.message : "Unknown redis error",
            timestamp,
        };
    }
    // Aggregate status. If any dependency is down, the system is unhealthy
    const overallStatus = dbStatus.status === "healthy" && redisStatus.status === "healthy" ? "healthy" : "unhealthy";
    return {
        status: overallStatus,
        uptimeSeconds: Math.round(process.uptime()),
        timestamp,
        components: {
            database: dbStatus,
            redis: redisStatus,
        },
    };
}
//# sourceMappingURL=health.js.map