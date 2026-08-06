import { Redis } from "ioredis";
export declare const redis: Redis;
/**
 * Verifies Redis connectivity on process startup.
 * Sends a 'PING' command. Throws a startup error if unreachable.
 */
export declare function verifyRedisConnection(): Promise<void>;
/**
 * Closes the Redis client connection gracefully.
 * Triggered on SIGTERM / SIGINT graceful shutdowns.
 */
export declare function closeRedisConnection(): Promise<void>;
//# sourceMappingURL=client.d.ts.map