import { Redis } from "ioredis";
import { runtimeConfig } from "@freelanceos/config";

// Configuration constants for connection lifecycle
const CONNECT_TIMEOUT_MS = 10000; // Timeout connection attempts after 10 seconds
const BACKOFF_INITIAL_DELAY_MS = 500;
const BACKOFF_MAX_DELAY_MS = 10000;

/**
 * Calculates exponential backoff retry delays with jitter.
 */
function calculateReconnectDelay(times: number): number {
  const delay = Math.min(BACKOFF_INITIAL_DELAY_MS * Math.pow(2, times - 1), BACKOFF_MAX_DELAY_MS);
  // Introduce random jitter to prevent reconnect storms
  const jitter = Math.random() * 200;
  return delay + jitter;
}

// Initialize the ioredis instance
export const redis = new Redis(runtimeConfig.REDIS_URL, {
  maxRetriesPerRequest: null, // Required by BullMQ to handle connection drops manually
  enableOfflineQueue: true,
  connectTimeout: CONNECT_TIMEOUT_MS,
  retryStrategy: (times: number) => {
    console.warn(`[Redis] Connection lost. Attempting reconnect #${times}...`);
    return calculateReconnectDelay(times);
  },
});

// Configure event listeners. Direct console logging is an intentional temporary MVP implementation.
// Future structured logging will migrate to the centralized Observability Foundation (U-0G-04).
redis.on("connect", () => {
  console.log("[Redis] Connection established successfully.");
});

redis.on("ready", () => {
  console.log("[Redis] Client is ready to receive commands.");
});

redis.on("error", (error: unknown) => {
  console.error(
    "[Redis Error] Socket client error encountered:",
    error instanceof Error ? error.message : error,
  );
});

redis.on("close", () => {
  console.warn("[Redis] Connection closed.");
});

/**
 * Verifies Redis connectivity on process startup.
 * Sends a 'PING' command. Throws a startup error if unreachable.
 */
export async function verifyRedisConnection(): Promise<void> {
  try {
    const response = await redis.ping();
    if (response !== "PONG") {
      throw new Error(`Invalid ping response: ${response}`);
    }
    console.log("[Redis] Startup connectivity verification successful.");
  } catch (error) {
    throw new Error(
      `[Redis Init Error] Redis connection could not be established: ${
        error instanceof Error ? error.message : "Unknown error"
      }`,
    );
  }
}

/**
 * Closes the Redis client connection gracefully.
 * Triggered on SIGTERM / SIGINT graceful shutdowns.
 */
export async function closeRedisConnection(): Promise<void> {
  console.log("[Redis] Initiating Redis socket connection closure...");
  try {
    await redis.quit();
    console.log("[Redis] Redis client closed successfully.");
  } catch (error) {
    console.error(
      "[Redis Error] Error occurred during client closure:",
      error instanceof Error ? error.message : error,
    );
    // Force disconnect if graceful quit hangs
    redis.disconnect();
    throw error;
  }
}
