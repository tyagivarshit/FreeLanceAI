/*
 * =====================================================================
 * @freelanceos/logger Workspace Public API & Governance
 * =====================================================================
 *
 * [CURRENT IMPLEMENTATION STATE]
 * This package currently provides ONLY:
 *   - Structured JSON logging abstraction (hiding Pino)
 *   - Correlation metadata context propagation (AsyncLocalStorage)
 *   - PII masking and redaction governance
 *   - Standardized log level thresholds (trace/debug/info/warn/error/fatal)
 *
 * The following capabilities are NOT implemented:
 *   - Prometheus Metrics:  [Future Responsibility - Not Implemented]
 *   - OpenTelemetry Spans:  [Future Responsibility - Not Implemented]
 *   - Jaeger Trace Exports: [Future Responsibility - Not Implemented]
 *   - Grafana Loki Streams: [Future Responsibility - Not Implemented]
 *
 * 1. Logger Ownership Governance:
 *    - The exported singleton logger is the CURRENT MVP implementation.
 *    - It is NOT a permanent architectural constraint. Future runtime-specific
 *      logger instances (API, Worker, CLI, Scheduler) may exist without breaking
 *      the public contract.
 *
 * 2. Structured Log Contract Versioning:
 *    - Current Schema Version: v1
 *    - Backward Compatibility: The fields level, time, correlationId, and message are frozen.
 *      Modifications to these keys require an approved ADR and major version bumps.
 *    - Evolution Policy: Schema growth is additive-only. Deprecations require
 *      formal warnings and a transition phase before deletion.
 *
 * 3. PII Redaction Governance:
 *    - Redactions target top-level fields, nested object paths, and recursive payloads.
 *    - Nested payloads receive the same protection as root-level fields, guaranteed
 *      by the internal Pino serializer hooks.
 *
 * 4. Context & Correlation IDs Ownership:
 *    - Logger CONSUMES context only; it NEVER creates request or operation contexts.
 *    - Contexts are initialized exclusively by HTTP middleware, BullMQ workers,
 *      schedulers, or CLI run wrappers.
 *    - Context propagation uses the AsyncLocalStorage context store.
 *
 * 5. Tracing & Span Governance:
 *    - W3C Trace Context: Current implementation defines ONLY the propagation contract
 *      headers (traceparent, tracestate).
 *    - No tracing engine, spans, or exporters exist. Future engine integrations
 *      will satisfy this propagation boundary. [Future Responsibility - Not Implemented]
 *
 * 6. Sampling Governance:
 *    - Level Severity Rules:
 *      * Fatal / Error / Warn: Always logged.
 *      * Info: Environment controlled.
 *      * Debug: Development only.
 *      * Trace: Explicit opt-in.
 *    - Future runtime sampling filters belong to the Observability evolution phase.
 *
 * 7. Log Level Configuration Ownership:
 *    - The @freelanceos/config package is the source of truth for runtime log levels.
 *    - Logger consumes the configured level and does NOT own the environment policy.
 *
 * 8. Metrics Naming Governance [Architecture Only - Future Responsibility]:
 *    - Metrics must use prometheus-compliant formatting: snake_case ending with units
 *      (e.g., http_request_duration_seconds_bucket).
 *    - Multi-tenant metrics must keep label cardinality low. Banned labels: user_id, email.
 */

export { logger } from "./logger.js";
export { runWithContext, getContextStore } from "./context.js";
export type { LogPayload, LogLevel } from "./logger.js";
export type { LogContextStore } from "./context.js";
