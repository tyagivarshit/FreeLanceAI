/*
 * =====================================================================
 * @freelanceos/health Workspace Public API & Governance
 * =====================================================================
 *
 * [CURRENT IMPLEMENTATION STATE]
 * This package currently provides ONLY:
 *   - Liveness check endpoint schema
 *   - Readiness check endpoint schema
 *   - Dependency aggregation with timeout budgets
 *   - Component health diagnostic logs
 *
 * The following capabilities are NOT implemented:
 *   - Prometheus metrics exports: [Future Responsibility - Not Implemented]
 *   - OpenTelemetry tracing:      [Future Responsibility - Not Implemented]
 *   - Alerting notifications:     [Future Responsibility - Not Implemented]
 *
 * 1. Public API Governance & Contract Versioning:
 *    - API Version: v1 (managed via HEALTH_POLICY.VERSION).
 *    - Backward Compatibility: The fields status, uptimeSeconds, and components are frozen.
 *      Orchestrators (Kubernetes) depend on these fields. Breaking alterations (deleting
 *      or renaming fields) require an approved ADR and major version bumps.
 *    - Extensibility: New dependencies can be added as key-value entries in the components
 *      dictionary without breaking existing checks.
 *
 * 2. Dependency Timeout Governance:
 *    - Health checks must run within a strict 3-second budget (HEALTH_POLICY.DEPENDENCY_TIMEOUT_MS)
 *      to prevent hanging event loops.
 *    - Telemetry & Tuning: Production latency data will guide future timeout tuning.
 *
 * 3. Liveness Philosophy:
 *    - Liveness probes (/live) intentionally ignore external dependencies (Database, Redis).
 *    - Purpose: Avoid cascading restart storms and thundering herd cycles during backend outages.
 *
 * 4. Dependency Checks Ownership:
 *    - @freelanceos/health ONLY orchestrates the execution and aggregates responses.
 *    - Each downstream package (@freelanceos/db, @freelanceos/redis) owns its own connection
 *      validation routines, timeout semantics, and error formats.
 *
 * 5. Degraded Mode Philosophy:
 *    - In the current implementation, overall status is binary ("healthy" or "unhealthy").
 *    - The "degraded" HealthStatus value is reserved for future non-critical integrations
 *      (e.g., AI APIs, secondary object storage) that are allowed to fail without taking
 *      the main application offline. [Future Responsibility - Not Implemented]
 */
export { checkLiveness, checkReadiness, HEALTH_POLICY } from "./health.js";
//# sourceMappingURL=index.js.map