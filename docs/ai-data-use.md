# AI Data Use & Governance Policy

**Document Version**: 1.0.0  
**Scope**: Artificial Intelligence & Large Language Model (LLM) Integration

---

## 1. Purpose & AI Capabilities

FreelanceOS utilizes AI models to provide assistive intelligence tools for freelancers:

1. **Job Fit Scoring & Match Explanations**: Evaluating job postings against user skills, rate targets, and risk criteria to explain strengths and skill gaps.
2. **Proposal & Reply Generation**: Drafting customized, persuasive proposals and client responses based on job specifications.
3. **Client Brain Intelligence**: Summarizing client communication history, past project scopes, and working preferences into structured insights.
4. **Tone & Style Refinement**: Adjusting communication tone (formal, direct, friendly) while preserving underlying intent.

---

## 2. Customer Data in AI Context

When an AI operation is initiated, the system constructs a scoped context payload containing:

- **Target Job Specification**: Job title, description, skills, and compensation parameters.
- **Relevant Client Background**: Client notes, project scopes, and communication preferences associated with the specific opportunity.
- **User Profile Data**: User-specified skills, experience level, and tone preferences.

### Data Excluded from AI Context

- **Account Credentials**: Passwords, password hashes, session cookies, and refresh tokens.
- **Billing Information**: Stripe payment tokens, customer card numbers, and banking details.
- **Unrelated Client Data**: Information regarding other clients or unrelated project histories.

---

## 3. Tenant Isolation & Context Scoping

- **Deterministic Context Assembly**: The Context Builder in `packages/core/src/ai/` gathers context exclusively using verified `ownerId` and `tenantId` parameters.
- **Cross-Tenant Prevention**: Prompt assembly algorithms prevent data from one tenant from ever entering the context of another tenant.

---

## 4. PII & Secret Redaction

- **Policy Engine Redaction**: Before prompts are dispatched to the AI Gateway, the policy engine scans input strings for credential patterns (e.g. `Bearer`, `sk_live_`, `sk_test_`, authorization tokens) and strips them.
- **Output Filtering**: AI model outputs are validated against policy filters to prevent hallucinated leakage of sensitive keywords.

---

## 5. Context Limits & Token Budgeting

- **Bounded Payloads**: Prompts are constrained to strict token budgets defined in the Prompt Registry (`packages/core/src/ai/prompt-registry.ts`) to prevent buffer exhaustion and out-of-memory errors.
- **Versioned Prompts**: All prompt templates are versioned, typed, and reviewed to ensure safety and deterministic performance.

---

## 6. Model Training & Data Retention Policy

- **Application Policy**: Under FreelanceOS application architecture and enterprise API agreements, customer prompts, client notes, and workspace records are processed ephemerally to fulfill user-initiated requests.
- **No Foundation Model Training**: Customer workspace data is not used to train, retrain, or improve public foundation AI models.
- **Data Ephemerality**: Prompt contexts sent to third-party model inference gateways are discarded following response completion.

---

## 7. AI Providers & Infrastructure

- **Enterprise Inference Gateways**: Configured via `@freelanceos/config` to communicate with approved enterprise LLM endpoints.
- **Transport Encryption**: All AI API traffic is transmitted via encrypted HTTPS connections.

---

## 8. Governance & Security Controls

- **Authorization Gates**: AI operations are gated by subscription plan entitlements and authenticated user quotas.
- **Logging & Observability**: System logs record token usage counts, response latency, and error status codes without persisting raw prompt payloads in plain text.
- **No Manual Human Review**: Prompt generation and inference are fully automated with zero human review of customer workspace data.
