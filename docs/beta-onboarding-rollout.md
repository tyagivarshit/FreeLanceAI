# FreelanceOS — Beta Onboarding, Feedback & Rollout Specification

---

## 1. Executive Summary & Purpose

This document provides the authoritative operational runbook, user guide, and architectural specification for the **FreelanceOS Public/Private Beta Program** (Phase 12H).

The Beta Program enables early adopters, freelancers, and enterprise contractors to safely evaluate core AI matching, client memory, and proposal drafting workflows while maintaining strict tenant isolation, privacy guarantees, and controlled rollout management.

---

## 2. Beta User Onboarding Guide

### Step 1: Account Registration & Session Initialization

1. Navigate to the FreelanceOS web application at `https://freelanceos.com/login.html` (or `http://localhost:4000/login.html` in local development).
2. Select the **Create Account** tab.
3. Enter your work email and a strong password (minimum 8 characters).
4. Upon successful registration, the server automatically provisions:
   - A secure, HTTP-only session cookie.
   - An active **7-Day Full Access Beta Trial** (`STARTER` / `PRO` evaluation).
   - An isolated tenant workspace.
5. The application automatically redirects you to the **Main Dashboard** (`/dashboard.html`).

### Step 2: Workspace & Profile Configuration

1. Navigate to **Settings** (`/settings.html`).
2. Complete your freelancer profile:
   - **Display Name** & **Professional Title** (e.g., _Senior Full-Stack Engineer_).
   - **Primary Skills & Tech Stack** (e.g., _TypeScript, React, Node.js, PostgreSQL, GraphQL_).
   - **Target Hourly Rate / Compensation Range** (e.g., _$75 – $120 USD/hr_).
   - **Weekly Availability** (e.g., _20 – 40 hrs/wk_).
3. These parameters seed the **Deterministic Scoring Engine** to calculate personalized opportunity compatibility.

### Step 3: Chrome Extension Installation & Pairing

1. Download the verified Chrome Extension package from the Chrome Web Store _(or load unpacked `dist/` from `apps/extension` in developer mode)_.
2. Ensure the extension is enabled in `chrome://extensions/`.
3. The extension automatically detects active FreelanceOS browser sessions via secure session cookies without storing sensitive credentials in extension storage.

### Step 4: First Job Ingestion & Normalization

1. Open any supported public job detail page on **Upwork** (`upwork.com/jobs/*`) or **LinkedIn** (`linkedin.com/jobs/view/*`).
2. Click the **FreelanceOS Job Matcher** extension icon or use the web importer at `/matching.html`.
3. The extension extracts public job specifications (title, budget, required skills, client country, experience level) at `document_idle`.
4. Extracted job payloads are synchronized to `POST /api/jobs` and normalized into immutable `Job` domain records.

### Step 5: Match Evaluation & AI Proposal Drafting

1. Navigate to **Matching** (`/matching.html`).
2. View your scored opportunities ranked from highest to lowest compatibility (0–100%).
3. Inspect the **Match Explanation Card** to review:
   - **Strengths**: Direct skill overlaps and positive client hiring history.
   - **Gaps**: Missing technologies or rate discrepancies.
   - **Risks**: Unverified payment methods or ambiguous scopes.
   - **Recommended Bid Strategy**: Proposed rate and milestone structure.
4. Click **Generate Proposal** to open the Reply Studio and produce an AI-assisted, customized proposal draft tailored to the specific client.

---

## 3. Beta Feedback Loop & Bug Reporting

FreelanceOS provides a dedicated, tenant-isolated feedback submission mechanism enabling beta participants to report bugs, request features, and provide usability feedback.

### A. Feedback API Contract (`POST /api/feedback`)

- **Authentication**: Requires a valid, authenticated session cookie (`authenticateRequest`).
- **Tenant Scoping**: Identity (`userId`, `tenantId`, `email`) is derived strictly from the verified session JWT.
- **Payload Constraints**:
  - `category` (Required): Must be one of `BUG`, `FEATURE_REQUEST`, `USABILITY`, `AI_QUALITY`, `OTHER`.
  - `message` (Required): String, trimmed, min 10 characters, max 2,000 characters.
  - `subject` (Optional): String, trimmed, max 120 characters.
  - `metadata` (Optional): Safe telemetry only (`appVersion`, `currentPath`).
  - Request Body Limit: Maximum 16KB.

### B. Feedback Submission Schema

```json
{
  "category": "BUG",
  "subject": "Filter reset on page refresh",
  "message": "When applying the minScore=80 filter on /matching.html and refreshing the browser, the filter pill UI resets to default 0.",
  "metadata": {
    "appVersion": "0.1.0",
    "currentPath": "/matching.html"
  }
}
```

### C. Direct Contact & Support

- **Bug Reports & Critical Issues**: In addition to in-app feedback, critical bugs may be reported directly to: `support@freelanceos.com` _(OPERATIONAL / LEGAL VERIFICATION REQUIRED)_.
- **Security Disclosures**: Report security vulnerabilities to: `security@freelanceos.com` _(OPERATIONAL / LEGAL VERIFICATION REQUIRED)_.

---

## 4. Known Beta Risks & Limitations Taxonomy

To maintain engineering transparency, platform capabilities and constraints are categorized into **`CODE VERIFIED`** (proven via automated test suites) versus **`EXTERNAL VERIFICATION REQUIRED`** (operational dependencies requiring post-freeze cloud deployment):

| Subsystem                  | Verified In Repository (`CODE VERIFIED`)                                                              | Pending Deployment (`EXTERNAL VERIFICATION REQUIRED`)                                                                                      |          Classification          |
| :------------------------- | :---------------------------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------: |
| **PostgreSQL Database**    | Schemas, DDL migrations, repository serializations, and parameterized queries ($1, $2) 100% verified. | Multi-node RDS/Cloud SQL cluster with automated backups and volume encryption. _(16 integration tests skip when local Docker is offline)._ | `EXTERNAL VERIFICATION REQUIRED` |
| **Redis Cache / Queue**    | Fallback in-memory handlers and BullMQ job serialization verified.                                    | Multi-AZ managed Redis cluster (ElastiCache) with memory eviction policies.                                                                | `EXTERNAL VERIFICATION REQUIRED` |
| **Stripe Live Mode**       | PlanCatalog (`STARTER`, `PRO`, `POWER_BIDDER`), 7-day trial, and webhook idempotency verified.        | Live merchant KYC activation, production API keys (`sk_live_`), and live webhook setup.                                                    | `EXTERNAL VERIFICATION REQUIRED` |
| **Domain & Ingress TLS**   | Local HTTP server on port 4000 and CSP headers verified.                                              | Apex DNS records for `freelanceos.com` and automated TLS 1.3 certificate provisioning.                                                     | `EXTERNAL VERIFICATION REQUIRED` |
| **AI LLM Gateway**         | 10s timeout budget, heuristic fallback drafts, and prompt secret redaction verified.                  | Enterprise quota accounts with OpenAI, Anthropic, and Google Gemini.                                                                       | `EXTERNAL VERIFICATION REQUIRED` |
| **Chrome Web Store**       | Manifest V3 compliance, 139 tests, packaging script, and store listings verified.                     | Google Developer Dashboard upload, $5 USD fee, and store approval.                                                                         | `EXTERNAL VERIFICATION REQUIRED` |
| **Corporate Legal Entity** | Terms of Service & Privacy Policy published with explicit placeholder tags.                           | Formal corporate incorporation and registered office address verification.                                                                 | `EXTERNAL VERIFICATION REQUIRED` |
| **Transactional Email**    | Session authentication and token generation verified.                                                 | SMTP / API transactional email service (SES/SendGrid) with DKIM/SPF records.                                                               | `EXTERNAL VERIFICATION REQUIRED` |

### Important Beta Operational Limitations

1. **AI Provider Latency Spikes**: External LLM providers may occasionally experience cold-start latency ($> 5\text{s}$). The AI Gateway enforces a hard **10-second timeout budget**, after which it gracefully degrades to deterministic heuristic drafts.
2. **Third-Party Platform DOM Volatility**: Upwork and LinkedIn frequently adjust DOM class names. The Chrome extension utilizes resilient selector fallback chains, but major platform HTML redesigns may require an extension patch update.
3. **Single Trial Policy**: Trial access is limited to a single 7-day grant per user account. Resetting or extending trials requires administrator action.
4. **Extension Local Storage Budget**: IndexedDB offline storage is capped at 10 items with an automated 24-hour TTL.

---

## 5. Beta Rollout Controls & Access States

FreelanceOS supports configuration-driven, server-side rollout access control that fails safely and operates with zero modifications to core business logic.

```
┌───────────────────────────┐     ┌───────────────────────────────┐     ┌─────────────────────────────┐
│       BETA_ENABLED        │     │        BETA_RESTRICTED        │     │        BETA_DISABLED        │
├───────────────────────────┤     ├───────────────────────────────┤     ├─────────────────────────────┤
│ Open Beta / Active Access │     │ Invite / Allowlist Gated Mode │     │ Emergency Pause / Waitlist  │
│ Open signup + 7-day trial │     │ 403 for non-allowlisted emails│     │ 403 on all new signups      │
│ Full core workflow active │     │ Existing sessions preserved   │     │ Existing sessions preserved │
└───────────────────────────┘     └───────────────────────────────┘     └─────────────────────────────┘
```

### A. Canonical Access States

1. **`BETA_ENABLED` (Default)**:

   - Registration is open to all users.
   - Automatically provisions active session with 7-day trial access.
   - Enforces standard quota gating via `PlanCatalog` and `PolicyEngine`.

2. **`BETA_RESTRICTED`**:

   - Registration is restricted strictly to approved email addresses or domains configured in `BETA_INVITE_ALLOWLIST`.
   - Non-allowlisted signup attempts return HTTP `403 Forbidden`:
     ```json
     {
       "success": false,
       "error": "Registration is currently restricted to approved beta invitees. Please join the early access waitlist.",
       "code": "BETA_RESTRICTED"
     }
     ```
   - Existing authenticated sessions continue to operate without disruption.

3. **`BETA_DISABLED` (Emergency Pause)**:
   - Activated via `BETA_REGISTRATION_ENABLED=false`.
   - All new registrations are paused globally; returns HTTP `403 Forbidden` (`BETA_DISABLED`).

### B. Security & Fail-Safe Properties

- **Server-Side Enforcement**: Rollout checks execute strictly on the backend inside `apps/web/server.js`. Frontend state manipulation cannot bypass access controls.
- **Zero Secrets in Configuration**: Configuration uses standard public identifiers (`BETA_ACCESS_MODE`, `BETA_INVITE_ALLOWLIST`).
- **Fail-Safe Fallback**: Missing or malformed environment variables resolve to safe defaults without crashing the server.

---

## 6. Beta User Resource Discovery Map

Beta users can access key platform resources using the existing, standard UI navigation elements without requiring full layout redesigns:

| Resource                | Navigation Path                                  | UI Surface                                      |
| :---------------------- | :----------------------------------------------- | :---------------------------------------------- |
| **Onboarding Guide**    | Main Dashboard Quickstart Card                   | `/dashboard.html`                               |
| **Give Feedback**       | Navigation Header Button & Settings Support Tab  | `/dashboard.html`, `/settings.html`             |
| **Bug Reporting**       | Feedback Modal (`category: BUG`) & Support Email | `POST /api/feedback`, `support@freelanceos.com` |
| **Support & Inquiries** | Footer Help Links & Settings Support Tab         | `/settings.html#support`                        |
| **Privacy Policy**      | Application Footer & Settings Data Tab           | `/privacy-policy.md`, `/settings.html`          |
| **Terms of Service**    | Application Footer                               | `/terms-of-service.md`                          |

---

## 7. Operational Verification Checklist

The following items are designated for post-freeze corporate and cloud operations:

- [ ] Provision production PostgreSQL RDS cluster with AES-256 volume encryption _(Operational / Deployment Verification Required)_.
- [ ] Provision production Redis ElastiCache cluster _(Operational / Deployment Verification Required)_.
- [ ] Swap Stripe test keys for live production API keys (`pk_live_`, `sk_live_`, `whsec_`) _(Operational / Legal Verification Required)_.
- [ ] Upload Chrome Extension `.zip` bundle to Google Developer Console ($5 USD) _(Operational / Store Verification Required)_.
- [ ] Provision corporate support inbox (`support@freelanceos.com`) and privacy inbox (`privacy@freelanceos.com`) _(Operational / Legal Verification Required)_.
- [ ] Configure apex DNS records and TLS 1.3 certificate for `freelanceos.com` _(Operational / Deployment Verification Required)_.
