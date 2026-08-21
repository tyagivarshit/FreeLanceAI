# Data Export & Deletion Operational Runbook

**Document Version**: 1.0.0  
**Scope**: User Data Export, Session Revocation, and Account Deletion Workflows

---

## 1. Data Export Runbook

### A. Endpoint & Authorization

- **HTTP Method & Path**: `GET /api/settings/data/export`
- **Authentication**: Requires an active, authenticated session cookie (`freelanceos_session`).
- **Unauthenticated Response**: Returns `HTTP 401 Unauthorized` (`{ success: false, error: "Unauthorized" }`).
- **User-Facing Trigger**: Navigating to `settings.html#privacy` and clicking the **"Download Data Archive (.json)"** button.

### B. Export Archive Structure

The endpoint generates a JSON archive with the following structure:

```json
{
  "success": true,
  "export": {
    "version": "1.0.0",
    "exportedAt": "2026-08-21T15:00:00.000Z",
    "tenantId": "tenant_usr_12345",
    "ownerId": "usr_12345",
    "clients": [
      {
        "id": "client_abc",
        "name": "Acme Corp",
        "email": "contact@acme.com",
        "company": "Acme Inc.",
        "hourlyRate": 150,
        "currency": "USD"
      }
    ],
    "jobs": [
      {
        "id": "job_xyz",
        "title": "Senior Cloud Architect",
        "description": "...",
        "source": "UPWORK",
        "budget": "$10,000"
      }
    ],
    "matches": [
      {
        "id": "match_123",
        "jobId": "job_xyz",
        "overallScore": 92,
        "explanation": "..."
      }
    ],
    "timeline": [
      {
        "id": "tl_001",
        "type": "NOTE",
        "content": "Initial kickoff call completed."
      }
    ],
    "brainAnalyses": [
      {
        "id": "brain_001",
        "summary": "High-budget client with fast turnaround expectations."
      }
    ]
  }
}
```

### C. Security & Secret Exclusion

The data export subsystem executes strict field sanitization:

- Password hashes (`userPasswordHashes`) are never retrieved or included.
- Active session tokens and refresh tokens are excluded.
- Internal Stripe API keys and webhook signing secrets are excluded.
- Database connection strings and server paths are excluded.

---

## 2. Data Deletion Capabilities & Status

### A. Implemented Self-Service Deletion Capabilities

1. **Single Session Revocation**:
   - **Endpoint**: `DELETE /api/settings/security/sessions/:id`
   - **Action**: Immediately revokes the specified session from the database `sessions` table.
2. **Global Session Revocation (All Other Sessions)**:
   - **Endpoint**: `DELETE /api/settings/security/sessions`
   - **Action**: Revokes all active sessions for the authenticated user except the session issuing the request.
3. **Local Extension Storage Deletion**:
   - **Action**: Uninstalling the extension or clearing browser site data immediately purges all IndexedDB snapshots and stored preferences.

### B. Current Account-Level Deletion Status

- **Automated Self-Service Account Deletion**: **NOT CURRENTLY IMPLEMENTED**.
- Complete account and tenant deletion is not currently exposed via an automated self-service web endpoint.
- **Manual Operational Deletion Process**:
  - Account closure and GDPR/CCPA deletion requests are handled through administrative operational runbooks (_Operational / Legal Verification Required_).
  - Database administrator executes verified deletion queries with cascade constraints against `users`, `sessions`, `clients`, `job_imports`, and `client_brain_analyses`.

---

## 3. Incident & Failure Handling

- **Export Timeouts or Query Failures**:
  - The export handler wraps database reads in individual `.catch(() => [])` handlers to prevent partial database unavailability from aborting the entire export.
  - If a fatal error occurs, the server logs the error internally via `@freelanceos/logger` without emitting stack traces to the client and responds with `HTTP 500 Internal Server Error`.
- **Rate Limiting & Abuse Prevention**:
  - The web UI enforces in-flight locking (`isExportInFlight = true`) to prevent rapid consecutive export triggers by the user.
