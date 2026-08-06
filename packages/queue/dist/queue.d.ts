import { QueueOptions, WorkerOptions } from "bullmq";
export interface WorkerJob<T = any> {
    id: string;
    name: string;
    data: T;
}
export type WorkerProcessor<T = any, R = any> = (job: WorkerJob<T>) => Promise<R>;
/**
 * Creates and registers a BullMQ Queue instance.
 * Exposes a minimal, type-safe API wrapper, hiding direct ORM/library client instances.
 */
export declare function registerQueue(name: string, options?: Omit<QueueOptions, "connection">): void;
/**
 * Registers a background job Worker instance.
 */
export declare function registerWorker<T = any, R = any>(name: string, processor: WorkerProcessor<T, R>, options?: Omit<WorkerOptions, "connection">): void;
/**
 * Gracefully shuts down all active queues and workers.
 * Reclaims all connection sockets. Called during container/process termination.
 */
export declare function closeQueueSystem(): Promise<void>;
//# sourceMappingURL=queue.d.ts.map