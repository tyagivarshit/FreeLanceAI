# FreelanceOS Privacy Policy

**Effective Date**: August 21, 2026  
**Last Updated**: August 21, 2026

---

## 1. Scope & Overview

FreelanceOS ("we", "our", or "the Platform") provides an intelligent operating system for freelancers and independent contractors, comprising the FreelanceOS web application, background job matching engine, Client Brain intelligence services, and the FreelanceOS Job Matcher Chrome extension.

This Privacy Policy explains how personal and professional information is collected, processed, isolated, and protected when you use our web platform, browser extensions, and associated services.

---

## 2. Information We Collect

We collect only the minimum information necessary to provide, secure, and operate our workspace and matching services:

### A. Account & Authentication Data

- **Account Credentials**: Email address, full name, and cryptographically hashed passwords (using standard secure hashing algorithms). Plaintext passwords are never stored.
- **Session & Device Records**: Active session identifiers, user-agent strings, device metadata, creation timestamps, and expiration timestamps used for session management and multi-device revocation.

### B. Workspace & Client Management Data

- **Client Domain Records**: Client names, company names, contact emails, phone numbers, standard hourly/project rates, currency, and notes entered into your Client aggregate.
- **Client Timeline & Activity**: Timeline events, project scope milestones, delivery updates, and metadata associated with client relationships.
- **Client Brain & Intelligence Data**: AI summaries, client preferences, communication style profiles, and memory notes generated to assist in client relationship management.

### C. Job Matching & Extraction Data

- **Platform Job Postings**: Public job titles, descriptions, required skill tags, compensation parameters (hourly rate, fixed budget), client country/location, and experience levels ingested from supported platforms (Upwork and LinkedIn).
- **Match & Scoring Records**: Deterministic match scores, skill overlap evaluations, strength/gap breakdowns, and AI-generated proposal drafts.

### D. Billing & Subscription Data

- **Subscription Tiers**: Active plan tier (`Starter`, `Pro`, `Enterprise`), billing cycle status, trial timestamps, and feature quota usage counters.
- **Payment Processing**: Stripe Customer ID and Subscription ID mappings. **Credit card numbers, CVVs, and bank account details are handled exclusively by Stripe and are never stored on FreelanceOS servers.**

### E. Extension & Browser Data

- **Targeted Job Specifications**: When using the FreelanceOS Job Matcher extension on Upwork or LinkedIn job detail pages, the extension reads only the publicly visible job requirements at `document_idle`.
- **Local Offline Snapshots**: Up to 10 recent job snapshots stored in browser-native IndexedDB with an automated 24-hour Time-To-Live (TTL).

### F. Aggregated Platform Analytics

- **Privacy-Safe Telemetry**: Non-PII aggregated counts of feature activation, matching throughput, subscription transitions, and system errors used strictly for reliability and performance monitoring.

---

## 3. Information We Do NOT Collect

To maintain our privacy-first design principles, the Platform strictly excludes:

- **No Plaintext Passwords**: Passwords are never stored or exportable.
- **No Unrelated Browsing History**: The Chrome extension does not monitor, record, or transmit websites visited outside supported job detail pages.
- **No Private Platform Messages**: The Chrome extension does not access Upwork client messages, LinkedIn InMail, direct messages, or personal email threads.
- **No Financial Secrets**: Stripe secret keys, banking credentials, and customer payment cards are never stored or exposed.
- **No Cross-Tenant Data Sharing**: Your client relationships, proposals, and memory notes are cryptographically scoped to your tenant and never shared with other users.
- **No Third-Party Advertising Trackers**: We do not deploy Google Tag Manager, Meta Pixel, tracking beacons, or data broker scripts.

---

## 4. Tenant & Owner Isolation

Every database record and API endpoint in FreelanceOS enforces server-side tenant isolation:

- All database queries require verified `ownerId` and `tenantId` parameters derived from your authenticated session.
- Cross-tenant data retrieval is strictly prohibited at the database and repository layers.
- Multi-tenant search indexes and AI prompt contexts are filtered strictly by authenticated identity before execution.

---

## 5. Authentication, Cookies & Storage

FreelanceOS utilizes secure, browser-native authentication mechanisms:

- **Session Cookies**: Authenticated sessions utilize secure, HTTP-only, `SameSite=Lax` session cookies (`freelanceos_session` and `__Host-refresh_token`).
- **Session Lifecycle**: Sessions expire automatically after inactivity and can be revoked individually or globally from the Settings dashboard.
- **Local Extension Storage**: The Chrome extension uses local `chrome.storage` for user UI preferences (theme, auto-match toggle) and IndexedDB for temporary offline caching.

---

## 6. Self-Service Data Export

FreelanceOS provides real-time, automated data export capabilities:

- **Endpoint**: `GET /api/settings/data/export` (accessible directly via the Settings UI under "Data & Privacy").
- **Format**: Standard JSON archive (`.json`).
- **Included Categories**: All tenant-owned Clients, Jobs, Job Matches, Timeline Entries, and Client Brain Analyses.
- **Excluded Data**: Passwords, password hashes, session tokens, refresh tokens, Stripe secret keys, and internal system identifiers are automatically excluded from the export archive.

---

## 7. Data Deletion & Account Termination

- **Session Deletion**: Users can immediately revoke any active session or all other sessions from the Settings UI.
- **Account Deletion**: Complete account and tenant deletion is currently processed through administrative operational runbooks upon request (_Operational / Legal Verification Required_). Automated self-service tenant cascade purging is scheduled for a future release.
- **Extension Data Purge**: Uninstalling the Chrome extension immediately purges all local IndexedDB cache snapshots and stored preferences from your local machine.

---

## 8. AI Data Use & Governance

- **Scoped Context Only**: When generating job match explanations or proposal drafts, the AI subsystem receives only the specific job requirements and the authenticated user's profile/client context.
- **PII & Secret Redaction**: The AI policy engine redacts sensitive access tokens, passwords, and authorization headers prior to prompt construction.
- **Application Model Policy**: Under FreelanceOS application policy, customer workspace data and client notes are processed solely to fulfill user-initiated requests and are not used to train or fine-tune foundation AI models.

---

## 9. Third-Party Service Providers

FreelanceOS engages third-party infrastructure providers under strict confidentiality agreements:

- **Stripe Inc.**: Subscription billing, invoicing, and PCI-compliant payment processing.
- **AI Model Gateway**: Enterprise LLM inference providers configured for the platform.
- **Zero Data Brokers**: We do not sell, rent, or monetize your personal or client data under any circumstances.

---

## 10. Security Controls

We protect your data using defense-in-depth security measures:

- Cryptographic password hashing.
- Server-side authentication and session rotation.
- Content Security Policy (`script-src 'self'; object-src 'self'`) blocking remote script execution and `unsafe-eval`.
- Automated secrets scanning across all codebase assets.

---

## 11. Data Retention Policy

- **Workspace Records**: Retained in your account for the duration of your active subscription.
- **Extension Snapshots**: Automatically deleted after 24 hours from local IndexedDB storage.
- **Session Records**: Expired sessions are purged periodically from the authentication store.

---

## 12. User Rights

Subject to applicable data protection laws (such as GDPR and CCPA/CPRA where applicable), you have the right to:

- **Access & Portability**: Download a full JSON archive of your tenant data at any time.
- **Correction**: Update profile information, client records, and workspace details directly in the dashboard.
- **Revocation**: Immediately revoke active browser sessions and extension access.
- **Deletion Inquiries**: Request deletion of your account and associated tenant records.

---

## 13. Privacy Inquiries & Contact

For questions regarding this Privacy Policy or data handling practices:

- **Privacy Contact**: `privacy@freelanceos.com` _(Operational / Legal Verification Required)_
- **Support Portal**: `https://freelanceos.com/support` _(Operational / Legal Verification Required)_
