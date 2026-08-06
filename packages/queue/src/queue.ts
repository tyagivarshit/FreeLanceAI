import { Queue, Worker, Processor as BullMQProcessor, QueueOptions, WorkerOptions } from "bullmq";
import { Redis } from "ioredis";
import { runtimeConfig } from "@freelanceos/config";

// Interface representing a generic background job, decoupling application logic from library types
export interface WorkerJob<T = any> {
  id: string;
  name: string;
  data: T;
}

export type WorkerProcessor<T = any, R = any> = (job: WorkerJob<T>) => Promise<R>;

// Runtime defaults and policies
const CONNECT_TIMEOUT_MS = 10000;
const DEFAULT_RETRY_ATTEMPTS = 3;
const DEFAULT_BACKOFF_DELAY_MS = 1000;
const DEFAULT_CONCURRENCY = 5;
const COMPLETED_JOB_RETENTION_AGE = 24 * 3600; // 24 hours
const COMPLETED_JOB_RETENTION_COUNT = 1000;
const FAILED_JOB_RETENTION_AGE = 7 * 24 * 3600; // 7 days
const FAILED_JOB_RETENTION_COUNT = 5000;

// Type-safe WeakMaps to track active Redis connection allocations without mutating library objects
const queueConnections = new WeakMap<Queue, Redis>();
const workerConnections = new WeakMap<Worker, Redis>();

// Global registries to track active queue and worker resources for cleanup
const activeQueues: Map<string, Queue> = new Map();
const activeWorkers: Map<string, Worker> = new Map();

// Helper to instantiate isolated connection clients for BullMQ sockets.
// Direct console logging is an intentional temporary MVP implementation.
// Future structured logging will migrate to the centralized Observability Foundation (U-0G-04).
function createRedisConnection(): Redis {
  const connection = new Redis(runtimeConfig.REDIS_URL, {
    maxRetriesPerRequest: null, // Required by BullMQ
    connectTimeout: CONNECT_TIMEOUT_MS,
  });

  connection.on("error", (err: unknown) => {
    console.error(
      "[Queue Redis Error] Unexpected socket error:",
      err instanceof Error ? err.message : err,
    );
  });

  return connection;
}

/**
 * Creates and registers a BullMQ Queue instance.
 * Exposes a minimal, type-safe API wrapper, hiding direct ORM/library client instances.
 */
export function registerQueue(name: string, options?: Omit<QueueOptions, "connection">): void {
  if (activeQueues.has(name)) {
    throw new Error(`[Queue Register Error] Queue with name '${name}' is already registered.`);
  }

  const connection = createRedisConnection();
  const queue = new Queue(name, {
    ...options,
    connection,
    defaultJobOptions: {
      attempts: DEFAULT_RETRY_ATTEMPTS,
      backoff: {
        type: "exponential",
        delay: DEFAULT_BACKOFF_DELAY_MS,
      },
      removeOnComplete: { age: COMPLETED_JOB_RETENTION_AGE, count: COMPLETED_JOB_RETENTION_COUNT },
      removeOnFail: { age: FAILED_JOB_RETENTION_AGE, count: FAILED_JOB_RETENTION_COUNT },
      ...options?.defaultJobOptions,
    },
  });

  // Track the connection type-safely via WeakMap
  queueConnections.set(queue, connection);
  activeQueues.set(name, queue);
  console.log(`[Queue] Registered queue instance: ${name}`);
}

/**
 * Registers a background job Worker instance.
 */
export function registerWorker<T = any, R = any>(
  name: string,
  processor: WorkerProcessor<T, R>,
  options?: Omit<WorkerOptions, "connection">,
): void {
  if (activeWorkers.has(name)) {
    throw new Error(`[Worker Register Error] Worker for queue '${name}' is already registered.`);
  }

  const connection = createRedisConnection();

  // Adapt the framework-independent processor to BullMQ's execution signature
  const bullmqProcessor: BullMQProcessor = async (job) => {
    return await processor({
      id: job.id ?? "",
      name: job.name,
      data: job.data as T,
    });
  };

  const worker = new Worker(name, bullmqProcessor, {
    ...options,
    connection,
    concurrency: options?.concurrency ?? DEFAULT_CONCURRENCY,
  });

  // Track the connection type-safely via WeakMap
  workerConnections.set(worker, connection);
  activeWorkers.set(name, worker);
  console.log(`[Worker] Registered worker instance for queue: ${name}`);
}

/**
 * Gracefully shuts down all active queues and workers.
 * Reclaims all connection sockets. Called during container/process termination.
 */
export async function closeQueueSystem(): Promise<void> {
  console.log("[Queue] Initiating graceful queue system shutdown...");

  // Close all workers first to stop picking up new jobs
  for (const [name, worker] of activeWorkers.entries()) {
    console.log(`[Queue] Stopping worker: ${name}`);
    try {
      await worker.close();
      const conn = workerConnections.get(worker);
      if (conn) {
        await conn.quit();
      }
      console.log(`[Queue] Worker closed: ${name}`);
    } catch (err) {
      console.error(`[Queue Error] Failed to close worker '${name}':`, err);
    }
  }
  activeWorkers.clear();

  // Close all queues
  for (const [name, queue] of activeQueues.entries()) {
    console.log(`[Queue] Closing queue connection: ${name}`);
    try {
      await queue.close();
      const conn = queueConnections.get(queue);
      if (conn) {
        await conn.quit();
      }
      console.log(`[Queue] Queue closed: ${name}`);
    } catch (err) {
      console.error(`[Queue Error] Failed to close queue '${name}':`, err);
    }
  }
  activeQueues.clear();

  console.log("[Queue] Queue system shutdown completed.");
}
