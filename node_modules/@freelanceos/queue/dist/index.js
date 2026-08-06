/*
 * =====================================================================
 * @freelanceos/queue Workspace Public API & Governance
 * =====================================================================
 *
 * [CURRENT IMPLEMENTATION STATE]
 * This package currently provides ONLY:
 *   - Queue and worker registration hooks
 *   - Connection isolation management for BullMQ sockets
 *   - Graceful shutdown lifecycle handlers
 *
 * The following capabilities are NOT implemented:
 *   - AI processing queues:    [Future Responsibility - Not Implemented]
 *   - Email/Notification jobs: [Future Responsibility - Not Implemented]
 *   - Scheduling logic:        [Future Responsibility - Not Implemented]
 *   - Outbox processing:       [Future Responsibility - Not Implemented]
 *
 * 1. Public API Governance & Encapsulation:
 *    - Raw BullMQ Queue, Worker, or QueueEvents instances must NOT be exposed
 *      as part of the stable public exports.
 *    - Outer packages interface exclusively with framework-independent abstractions:
 *      * registerQueue()
 *      * registerWorker()
 *      * WorkerProcessor and WorkerJob typings
 *
 * 2. Queue Naming Governance:
 *    - Naming Style: Must use kebab-case (e.g. "email-dispatch").
 *    - Allowed Characters: Lowercase letters, numbers, and hyphens [a-z0-9-].
 *    - Reserved Prefixes: "system-" and "internal-" are reserved for system tasks.
 *    - Environment Isolation: Queue names are dynamically prefixed or partitioned
 *      to isolate development, testing, and production runtime scopes.
 *    - Tenant Partitioning: Future tenant-level multi-tenant tasks are partitioned
 *      via job data payload properties rather than dynamic queue creation.
 *
 * 3. Runtime Role Separation:
 *    - Each runtime component (Queue, Worker, and future QueueEvents or QueueScheduler)
 *      is allocated an independent Redis socket client. This prevents blocking calls (like pop)
 *      from stalling concurrent cached requests or scheduler tickers.
 *
 * 4. Future Runtime Lifecycle & Shutdown:
 *    - The graceful shutdown loop must coordinate close sequences in this order:
 *      1. Stop Worker loops (block new job pulls).
 *      2. Stop QueueScheduler loops [Future Responsibility - Not Implemented].
 *      3. Close QueueEvents observers [Future Responsibility - Not Implemented].
 *      4. Close Queue producers.
 *      5. Quit associated Redis connection pools.
 *
 * 5. QueueEvents Governance:
 *    - QueueEvents are intentionally NOT implemented in U-0G-02.
 *    - Reason: Current scope is limited to background execution foundation. Active
 *      event streaming and telemetry metrics belong to the Observability phase.
 *
 * 6. Logging Governance:
 *    - Direct console logging inside this workspace is an intentional temporary MVP implementation.
 *    - Future structured logging will migrate to the centralized Observability Foundation (U-0G-04).
 */
export { registerQueue, registerWorker, closeQueueSystem } from "./queue.js";
//# sourceMappingURL=index.js.map