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
    };
}
export declare const HEALTH_POLICY: {
    readonly DEPENDENCY_TIMEOUT_MS: 3000;
    readonly VERSION: "v1";
};
/**
 * Performs a lightweight liveness check on the process state.
 */
export declare function checkLiveness(): {
    status: "healthy";
    uptimeSeconds: number;
    timestamp: string;
};
/**
 * Performs a thorough readiness health aggregation check across dependencies.
 * Execution runs concurrently to ensure slow handlers do not block other checkers.
 */
export declare function checkReadiness(): Promise<HealthReport>;
//# sourceMappingURL=health.d.ts.map