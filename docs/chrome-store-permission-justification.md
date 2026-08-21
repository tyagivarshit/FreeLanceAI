# Chrome Web Store Permission Justification Document

This document provides explicit reviewer-facing justifications for every permission and host permission declared in `manifest.json` under Google's **Least Privilege** and **Single-Purpose** policies.

---

## 1. Extension Information

- **Extension Name**: FreelanceOS Job Matcher
- **Extension ID/Package**: `freelanceos-extension`
- **Manifest Version**: 3
- **Declared Purpose**: Capture freelance and contract job specifications from supported job boards (Upwork, LinkedIn) and sync them to the user's FreelanceOS workspace for job fit matching.

---

## 2. API Permissions Justification

### Permission: `"storage"`

1. **Why required**:
   The extension needs local client-side storage to store user interface preferences (such as dark theme and auto-matching toggle) and to manage offline fallback state in conjunction with IndexedDB.
2. **Which feature uses it**:
   - `src/options.ts` and `src/service-worker.ts` (`GET_SETTINGS` message handler).
   - IndexedDB fallback snapshot management in `src/storage/db.ts`.
3. **Why a narrower permission is insufficient**:
   `"storage"` is the minimal, standard permission provided by Chrome MV3 for saving key-value preferences.
4. **How the permission is limited**:
   The extension only stores non-sensitive user preferences and sanitized offline job snapshots.
5. **What the extension does NOT access**:
   The storage API is strictly sandboxed to the extension's local origin. It does not access browser cookies, web storage of visited websites, or credentials.

---

## 3. Host Permissions Justification

### Host: `"https://*.upwork.com/*"`

1. **Why required**:
   Allows the content script (`dist/src/content-script.js`) to parse public job posting details when a user views a job on Upwork.
2. **Which feature uses it**:
   `UpworkAdapter` (`src/platform/upwork.ts`) to extract title, description, skills, budget, and experience level.
3. **Why a narrower permission is insufficient**:
   Upwork utilizes multiple subdomain endpoints and SPA paths (e.g. `www.upwork.com/jobs/...`, `www.upwork.com/nx/find-work/job-details/...`). Wildcard subdomain matching is required for reliable operation across Upwork's regional and routing variations.
4. **How the permission is limited**:
   - Script execution is restricted to `document_idle`.
   - `UpworkAdapter.canHandle()` strictly rejects any non-job URLs.
5. **What the extension does NOT access**:
   Does NOT access Upwork messages, billing accounts, banking/payment information, tax documents, or client communication threads.

---

### Host: `"https://*.linkedin.com/*"`

1. **Why required**:
   Allows the content script (`dist/src/content-script.js`) to parse job requirements when a user navigates to a job posting on LinkedIn.
2. **Which feature uses it**:
   `LinkedInAdapter` (`src/platform/linkedin.ts`) to extract job title, company name, job description, workplace type (Remote/Hybrid/On-site), seniority, and salary ranges.
3. **Why a narrower permission is insufficient**:
   LinkedIn hosts job listings under `www.linkedin.com/jobs/view/...` as well as dynamic query views `linkedin.com/jobs/search/...`.
4. **How the permission is limited**:
   - Explicitly rejects non-job URLs including `/feed`, `/in/` (user profiles), `/company/`, `/messaging/` (InMail), `/notifications/`, and `/settings/`.
5. **What the extension does NOT access**:
   Does NOT access LinkedIn InMail/messages, private profile connections, user posts, feed interactions, or account settings.

---

### Host: `"http://localhost:4000/*"` / `"https://*.freelanceos.com/*"` (Backend API Origin)

1. **Why required**:
   Enables the background Service Worker to transmit extracted job data to the user's FreelanceOS workspace API and retrieve calculated match scores.
2. **Which feature uses it**:
   `src/service-worker.ts` invoking `/api/jobs/import`, `/api/jobs/detect`, `/api/jobs`, and `/api/jobs/:id/match`.
3. **Why a narrower permission is insufficient**:
   Cross-origin `fetch()` from an MV3 service worker to the backend API origin requires an explicit host permission declaration.
4. **How the permission is limited**:
   Requests are strictly restricted to authenticated FreelanceOS API endpoints.
5. **What the extension does NOT access**:
   Does not communicate with any third-party advertising, telemetry, or external analytics endpoints.

---

## 4. Omitted High-Risk Permissions Audit

To enforce strict least-privilege principles, the extension explicitly omits all high-risk browser capabilities:

| High-Risk Permission                |   Status    | Justification for Omission                                                            |
| :---------------------------------- | :---------: | :------------------------------------------------------------------------------------ |
| `<all_urls>` / `*://*/*`            | **OMITTED** | Broad wildcards are prohibited. Only Upwork, LinkedIn, and backend API are requested. |
| `tabs`                              | **OMITTED** | Extension does not inspect arbitrary open tabs or tab URLs.                           |
| `cookies`                           | **OMITTED** | Extension does not read or manipulate browser cookies directly.                       |
| `webRequest` / `webRequestBlocking` | **OMITTED** | Extension does not intercept or modify network traffic.                               |
| `webNavigation`                     | **OMITTED** | Navigation events are handled naturally within content scripts at `document_idle`.    |
| `management`                        | **OMITTED** | Extension has no need to query or control other browser extensions.                   |
| `nativeMessaging`                   | **OMITTED** | Extension does not interface with native desktop binaries.                            |
| `clipboardRead` / `clipboardWrite`  | **OMITTED** | Extension does not read or write clipboard contents.                                  |
| `geolocation`                       | **OMITTED** | Extension does not request physical device location.                                  |
