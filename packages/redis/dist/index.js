/*
 * =====================================================================
 * @freelanceos/redis Workspace Public API & Governance
 * =====================================================================
 *
 * [CURRENT IMPLEMENTATION STATE]
 * This package currently provides ONLY:
 *   - Shared Redis runtime client lifecycle
 *   - Redis connection initialization
 *   - Startup connectivity verification (PING)
 *   - Reconnect configuration
 *   - Graceful shutdown
 *   - Runtime configuration validation
 *
 * The following capabilities are NOT implemented:
 *   - Caching:           [Future Responsibility - Not Implemented]
 *   - Pub/Sub:           [Future Responsibility - Not Implemented]
 *   - BullMQ:            [Future Responsibility - Not Implemented]
 *   - Distributed Locks: [Future Responsibility - Not Implemented]
 *   - Rate Limiting:     [Future Responsibility - Not Implemented]
 *   - Session Storage:   [Future Responsibility - Not Implemented]
 *
 * 1. Public API Governance & Encapsulation:
 *    - The raw ioredis connection client instance must NOT be exposed as part of
 *      the stable public exports.
 *    - Only approved internal adapters or factories within @freelanceos/redis may
 *      import the client directly, protecting implementation encapsulation.
 *    - Access is granted in future packages strictly through approved wrappers,
 *      rate limiters, lock managers, or queue worker constructors.
 *
 * 2. Offline Queue Governance:
 *    - The current configure of enableOfflineQueue: true is an MVP runtime default.
 *    - It is NOT a permanent policy for every future Redis client. Future clients
 *      (e.g., API clients, Worker clients, Pub/Sub clients, Queue clients) may
 *      adopt different offline queue strategies depending on their runtime role.
 *
 * 3. Runtime Role Separation:
 *    - The current implementation provides ONE shared runtime Redis client.
 *    - Future architecture may introduce dedicated clients for Pub/Sub, Distributed
 *      Locks, Scheduler, or High-volume background workers without breaking current systems.
 *
 * 4. Reconnect & Connection Lifecycle Ownership:
 *    - The reconnect lifecycle is owned entirely by the ioredis driver.
 *    - Application code must never manually reconnect sockets. Future wrappers must
 *      preserve this ownership boundary.
 *
 * 5. Logging Governance:
 *    - Direct console logging inside this workspace is an intentional temporary MVP implementation.
 *    - Future structured logging will migrate to the centralized Observability Foundation (U-0G-04).
 *
 * 6. Configuration Governance:
 *    - This package obtains connection parameters (e.g. REDIS_URL) exclusively from @freelanceos/config.
 *    - It owns no configuration schemas or environment parser defaults of its own.
 */
export { verifyRedisConnection, closeRedisConnection } from "./client.js";
export { RedisCacheStore } from "./cache-store.js";
//# sourceMappingURL=index.js.map