# Operational Monitoring & Incident Response Runbook

**Document Version**: 1.0.0  
**Target Audience**: Operations, Site Reliability Engineering (SRE), and On-Call Engineers  
**Classification**: Operational Engineering Runbook

---

## 1. System Monitoring Overview

FreelanceOS employs an asynchronous, non-blocking monitoring architecture designed for high throughput and zero sensitive data leakage:

- **Structured Request Logging**: Powered by `@freelanceos/logger` (Pino) with automated credential redaction and request duration tracking.
- **Health Probes**: Implemented in `@freelanceos/health` providing lightweight process liveness (`/healthz`, `/livez`) and dependency readiness checks (`/readyz`, `/api/health`).
- **Multi-Tenant Scoping**: Structured log entries propagate `tenantId`, `userId`, and `requestId` via Node.js `AsyncLocalStorage` without leaking cross-tenant data.

---

## 2. Health Endpoints & Specifications

The HTTP server exposes public unauthenticated health endpoints for load balancers and container orchestrators (Kubernetes / Docker):

| Endpoint          | Purpose                    | Upstream Check        | Success Code | Failure Code  |
| :---------------- | :------------------------- | :-------------------- | :----------: | :-----------: |
| `GET /healthz`    | Process Liveness probe     | Process runtime state |  `HTTP 200`  | Process Crash |
| `GET /livez`      | Liveness probe alias       | Process runtime state |  `HTTP 200`  | Process Crash |
| `GET /readyz`     | Dependency Readiness probe | PostgreSQL & Redis    |  `HTTP 200`  |  `HTTP 503`   |
| `GET /api/health` | Health status API          | PostgreSQL & Redis    |  `HTTP 200`  |  `HTTP 503`   |

---

## 3. Liveness Semantics

The liveness probe checks whether the Node.js event loop and HTTP server process are alive and responsive:

- **Response Schema**:
  ```json
  {
    "status": "healthy",
    "uptimeSeconds": 1420,
    "timestamp": "2026-08-21T15:00:00.000Z"
  }
  ```
- **Orchestrator Action**: If `GET /healthz` fails or times out (5 seconds), the container orchestrator should restart the container pod.

---

## 4. Readiness Semantics

The readiness probe validates that all critical data-layer dependencies are reachable and operational before routing live user traffic:

- **Response Schema (Healthy)**:
  ```json
  {
    "status": "healthy",
    "uptimeSeconds": 1420,
    "timestamp": "2026-08-21T15:00:00.000Z",
    "components": {
      "database": {
        "status": "healthy",
        "latencyMs": 4,
        "timestamp": "2026-08-21T15:00:00.000Z"
      },
      "redis": {
        "status": "healthy",
        "latencyMs": 1,
        "timestamp": "2026-08-21T15:00:00.000Z"
      }
    }
  }
  ```
- **Response Schema (Degraded / Unhealthy)**:
  If a dependency fails, the endpoint returns `HTTP 503 Service Unavailable`:
  ```json
  {
    "status": "unhealthy",
    "uptimeSeconds": 1420,
    "timestamp": "2026-08-21T15:00:00.000Z",
    "components": {
      "database": {
        "status": "unhealthy",
        "latencyMs": 3000,
        "error": "Database health check connection timeout",
        "timestamp": "2026-08-21T15:00:00.000Z"
      },
      "redis": {
        "status": "healthy",
        "latencyMs": 2,
        "timestamp": "2026-08-21T15:00:00.000Z"
      }
    }
  }
  ```
- **Execution Budget**: Each dependency check is bound by a strict **3000 ms timeout** (`HEALTH_POLICY.DEPENDENCY_TIMEOUT_MS`).

---

## 5. Structured Request Logging

The HTTP server records all completed requests upon the `res.finish` event:

- **Log Record Structure**:
  ```json
  {
    "level": "info",
    "time": "2026-08-21T15:00:01.120Z",
    "pid": 10240,
    "hostname": "prod-app-01",
    "message": "HTTP Request completed",
    "method": "GET",
    "route": "/api/clients",
    "statusCode": 200,
    "durationMs": 18
  }
  ```
- **Security Redaction Policy**: Pino automatically scrubs the following fields:
  `password`, `token`, `secret`, `apiKey`, `creditCard`, `authorization`, `email`, `phoneNumber`.
- **Zero Payload Logging**: Raw request bodies, cookies, and authorization headers are never logged.

---

## 6. Recommended Alert Conditions & Thresholds

| Metric / Event              | Warning Threshold   | Critical Alert Threshold          | Recommended Action                            |
| :-------------------------- | :------------------ | :-------------------------------- | :-------------------------------------------- |
| **HTTP 5xx Error Rate**     | $> 1\%$ for 5 mins  | $> 5\%$ for 2 mins                | Page on-call; check recent deployment         |
| **Readiness Failure**       | 1 failed check      | 3 consecutive failures (`503`)    | Remove instance from load balancer            |
| **P95 Latency**             | $> 250\text{ ms}$   | $> 1000\text{ ms}$                | Check database connection pool and query logs |
| **Redis Connection Loss**   | 1 reconnect attempt | Connection closed $> 30\text{ s}$ | Check Redis server health & memory            |
| **Stripe Webhook Failures** | 1 retryable error   | 5 consecutive 400/500 errors      | Inspect webhook signature and payload schema  |

---

## 7. Incident Response Workflows

### A. General Incident Response Steps

1. **Triage & Acknowledge**: Determine severity (P1: Outage, P2: Degraded, P3: Minor).
2. **Containment**: Reroute traffic or scale healthy replicas.
3. **Mitigation**: Apply hotfix, failover database, or execute rollback.
4. **Post-Mortem**: Document root cause, timeline, and corrective actions.

### B. PostgreSQL Outage Workflow

1. If `/readyz` reports `database: unhealthy`:
   - Inspect PostgreSQL server logs and container status.
   - Verify connection pool limits in `@freelanceos/db`.
   - Check disk space on database volumes.
   - If unrecoverable, initiate failover to standby replica.

### C. Redis Outage Workflow

1. If `/readyz` reports `redis: unhealthy`:
   - Inspect Redis server logs for memory limit (`OOM`) or network partition.
   - Verify BullMQ worker queue state.
   - Restart Redis service or failover to managed Redis replica.

### D. Authentication Incident Workflow

1. If unexpected mass authentication failures occur (HTTP 401 spike):
   - Verify cookie domain and `SESSION_COOKIE_NAME` configuration.
   - Check signing keys (`JWT_SECRET`) consistency across instances.
   - If session compromise is suspected, invoke `DELETE /api/settings/security/sessions` globally.

### E. AI Provider Degradation Workflow

1. If AI generation requests fail or exceed latency budgets:
   - Check error logs for provider rate limits (`HTTP 429`) or timeouts.
   - The platform falls back to deterministic heuristic rules where applicable.

### F. Secret Leakage Response

1. If a credential or secret is inadvertently logged or exposed:
   - Immediately rotate the compromised API key / token.
   - Trigger deployment redeploy to purge ephemeral runtime logs.
   - Audit access logs for unauthorized utilization.

---

## 8. Deployment Rollback Procedure

If a release causes critical errors or performance degradation:

1. **Trigger Rollback**: Revert deployment container image to the last certified release tag.
2. **Verify Health**: Run `curl -f http://<host>/readyz` to ensure all dependencies are green.
3. **Verify Regression**: Confirm HTTP 5xx error rate drops below $0.1\%$.

---

## 9. Escalation & Operational Ownership

- **Primary SRE / DevOps**: Operations Team _(Operational / Infrastructure Verification Required)_
- **Security Contact**: `security@freelanceos.com` _(Operational / Legal Verification Required)_
- **Status Page**: `https://status.freelanceos.com` _(Operational / Infrastructure Verification Required)_
