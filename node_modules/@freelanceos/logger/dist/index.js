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
 * 1. Logging Governance & PII Masking:
 *    - Structured logs are output as single-line JSON streams to stdout.
 *    - PII (passwords, auth headers, email addresses) are automatically redacted
 *      using the internal pino.redact engine.
 *    - Errors are serialized with message, stack, and name keys.
 *
 * 2. Context & Correlation IDs Propagation:
 *    - Correlation ID, Request ID, and Tenant ID are stored in type-safe storage
 *      context wrappers via AsyncLocalStorage.
 *    - Child operations automatically pick up this context without parameter passing.
 *
 * 3. Metrics Naming Governance [Architecture Only - Future Responsibility]:
 *    - Metrics must use prometheus-compliant formatting: snake_case ending with units
 *      (e.g., http_request_duration_seconds_bucket).
 *    - Multi-tenant metrics must keep label cardinality low. Banned labels: user_id, email.
 *
 * 4. Tracing & Span Governance [Architecture Only - Future Responsibility]:
 *    - Context propagation across HTTP boundaries uses the W3C Trace Context standard headers
 *      (traceparent, tracestate).
 *    - Queue jobs propagate traces via job metadata headers.
 */
export { logger } from "./logger.js";
export { runWithContext, getContextStore } from "./context.js";
//# sourceMappingURL=index.js.map