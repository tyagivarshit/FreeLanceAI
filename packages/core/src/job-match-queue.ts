import { JobMatchWorkItem } from "./job-match-work-item.js";

/**
 * Technology-neutral Queue contract for Job Matching.
 * Hides all broker-specific types (BullMQ, Redis, SQS, RabbitMQ, etc.).
 */
export interface JobMatchQueue {
  /**
   * Enqueues a JobMatchWorkItem for execution.
   */
  enqueue(workItem: JobMatchWorkItem): Promise<void>;

  /**
   * Claims the next available work item from the queue.
   * Uses a visibility timeout / lease mechanism.
   * Returns null if no work items are currently available.
   */
  claim(workerId: string, leaseDurationMs: number): Promise<JobMatchWorkItem | null>;

  /**
   * Acknowledges successful completion of a work item.
   * Removes it from the active processing queue.
   */
  acknowledge(
    workItemId: string,
    tenantId: string,
    workerId: string,
    leaseId: string,
    fencingToken: number,
  ): Promise<void>;

  /**
   * Releases a work item back to the queue (due to retryable/transient failures).
   * Scheduled with a specific delay (exponential backoff backoff).
   */
  release(
    workItemId: string,
    tenantId: string,
    workerId: string,
    leaseId: string,
    fencingToken: number,
    delayMs: number,
  ): Promise<void>;

  /**
   * Moves a work item to the Dead Letter Queue (DLQ) after retry exhaustion or permanent failure.
   */
  deadLetter(
    workItemId: string,
    tenantId: string,
    workerId: string,
    leaseId: string,
    fencingToken: number,
  ): Promise<void>;
}
