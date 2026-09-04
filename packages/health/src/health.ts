import { verifyConnection } from "@freelanceos/db";
import { verifyRedisConnection } from "@freelanceos/redis";
import { runtimeConfig } from "@freelanceos/config";

export type HealthStatus = "healthy" | "degraded" | "unhealthy";

export interface ComponentHealth {
  status: HealthStatus;
  latencyMs: number;
  error?: string;
  timestamp: string;
}

export interface HealthReport {
  status: HealthStatus;
  uptimeSeconds: number;
  timestamp: string;
  components: {
    database: ComponentHealth;
    redis: ComponentHealth;
    ai_gateway: ComponentHealth;
  };
}

// Runtime Health Checks operational policy rules
export const HEALTH_POLICY = {
  DEPENDENCY_TIMEOUT_MS: 3000, // 3-second budget per checker to prevent health check hangs
  VERSION: "v1",
} as const;

/**
 * Utility wrapper that enforces an execution timeout budget.
 */
async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  errorMessage: string,
): Promise<T> {
  let timeoutHandle: NodeJS.Timeout | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
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
async function measureExecutionTime<T>(
  action: () => Promise<T>,
): Promise<{ result: T; durationMs: number }> {
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
export function checkLiveness(): { status: "healthy"; uptimeSeconds: number; timestamp: string } {
  return {
    status: "healthy",
    uptimeSeconds: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  };
}

/**
 * Pings the AI Gateway to ensure it is reachable.
 */
async function verifyAIGateway(): Promise<void> {
  // Use a lightweight endpoint to check if the gateway is up (e.g. models list or health)
  const url = `${runtimeConfig.AI_GATEWAY_URL}/health`;
  const response = await fetch(url, { method: "GET" });
  if (!response.ok) {
    throw new Error(`AI Gateway responded with status: ${response.status}`);
  }
}

/**
 * Performs a thorough readiness health aggregation check across dependencies.
 * Execution runs concurrently to ensure slow handlers do not block other checkers.
 */
export async function checkReadiness(): Promise<HealthReport> {
  const timestamp = new Date().toISOString();

  // Initialize checkers concurrently
  const dbPromise = measureExecutionTime(() =>
    withTimeout(
      verifyConnection(),
      HEALTH_POLICY.DEPENDENCY_TIMEOUT_MS,
      "Database health check connection timeout",
    ),
  );

  const redisPromise = measureExecutionTime(() =>
    withTimeout(
      verifyRedisConnection(),
      HEALTH_POLICY.DEPENDENCY_TIMEOUT_MS,
      "Redis health check connection timeout",
    ),
  );

  const aiPromise = measureExecutionTime(() =>
    withTimeout(
      verifyAIGateway(),
      HEALTH_POLICY.DEPENDENCY_TIMEOUT_MS,
      "AI Gateway health check connection timeout",
    ),
  );

  // Await concurrent outcomes
  const [dbResult, redisResult, aiResult] = await Promise.allSettled([dbPromise, redisPromise, aiPromise]);

  // Evaluate Database status
  let dbStatus: ComponentHealth;
  if (dbResult.status === "fulfilled") {
    dbStatus = { status: "healthy", latencyMs: dbResult.value.durationMs, timestamp };
  } else {
    dbStatus = {
      status: "unhealthy",
      latencyMs: 0,
      error: dbResult.reason instanceof Error ? dbResult.reason.message : "Unknown database error",
      timestamp,
    };
  }

  // Evaluate Redis status
  let redisStatus: ComponentHealth;
  if (redisResult.status === "fulfilled") {
    redisStatus = { status: "healthy", latencyMs: redisResult.value.durationMs, timestamp };
  } else {
    redisStatus = {
      status: "unhealthy",
      latencyMs: 0,
      error:
        redisResult.reason instanceof Error ? redisResult.reason.message : "Unknown redis error",
      timestamp,
    };
  }

  // Evaluate AI Gateway status
  let aiStatus: ComponentHealth;
  if (aiResult.status === "fulfilled") {
    aiStatus = { status: "healthy", latencyMs: aiResult.value.durationMs, timestamp };
  } else {
    aiStatus = {
      status: "degraded",
      latencyMs: 0,
      error: aiResult.reason instanceof Error ? aiResult.reason.message : "Unknown AI Gateway error",
      timestamp,
    };
  }

  // Aggregate status.
  // Database and Redis are hard dependencies -> unhealthy.
  // AI Gateway is a soft dependency -> degraded.
  let overallStatus: HealthStatus = "healthy";
  if (dbStatus.status === "unhealthy" || redisStatus.status === "unhealthy") {
    overallStatus = "unhealthy";
  } else if (aiStatus.status === "degraded" || aiStatus.status === "unhealthy") {
    overallStatus = "degraded";
  }

  return {
    status: overallStatus,
    uptimeSeconds: Math.round(process.uptime()),
    timestamp,
    components: {
      database: dbStatus,
      redis: redisStatus,
      ai_gateway: aiStatus,
    },
  };
}
