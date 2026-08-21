# Chrome Web Store Privacy Disclosure & User Data Policy

This document outlines the privacy practices, data handling mechanisms, and security boundaries implemented in the **FreelanceOS Job Matcher** Chrome extension.

---

## 1. Single-Purpose Compliance

The FreelanceOS Job Matcher extension is engineered exclusively to:

> _Extract publicly visible job posting requirements from supported freelance platforms (Upwork and LinkedIn) and transmit them to the user's private FreelanceOS workspace for fit scoring and proposal generation._

The extension has no secondary purposes, does not collect telemetry for advertising, and does not monitor general web activity.

---

## 2. Data Accessed & Processed

### Public Job Data Extracted

When a user actively views a job posting on a supported platform, the extension reads:

- **Job Title**: Title of the opportunity.
- **Job Description**: Requirement details, scope of work, and project specifications.
- **Skills & Tags**: Listed skill tags and categories.
- **Budget & Compensation**: Fixed price, hourly rates, salary ranges, and currency.
- **Job Metadata**: Workplace type (Remote/Hybrid/On-site), seniority level, client country/location, and project length.

### Data NOT Accessed or Processed

- **No Private Messages**: Does NOT read Upwork messages, LinkedIn InMail, direct messages, or email.
- **No Financial Information**: Does NOT read bank accounts, payment methods, earnings statements, or tax forms.
- **No General Browsing History**: Does NOT log, monitor, or track websites outside Upwork and LinkedIn job detail URLs.
- **No Contact Lists**: Does NOT extract personal address books, phone numbers, or social connections.

---

## 3. Transmission & Storage

### Backend Transmission

- **Destination**: Transmitted directly to the user's configured FreelanceOS API backend (`https://api.freelanceos.com` or local dev port).
- **Protocol**: Encrypted HTTPS with secure token/cookie authentication.
- **Endpoints**: `POST /api/jobs/import`, `POST /api/jobs/detect`, `GET /api/jobs`, `POST /api/jobs/:id/match`.

### Local Offline Storage & Snapshot Management

- **Storage Engine**: Browser-native IndexedDB (`OfflineStorage` in `src/storage/db.ts`).
- **Retention Policy (TTL)**: Snapshots automatically expire after **24 hours** (`DEFAULT_TTL = 86,400,000 ms`).
- **Storage Quotas**: Bounded to a maximum of **10 snapshots** with an individual payload limit of **512 KB**.
- **Eviction Policy**: Expired items are purged first, followed by Least Recently Updated (LRU) eviction when capacity limits are met.

---

## 4. Sensitive Credential Sanitization

Before any data is written to local storage or forwarded through the offline snapshot pipeline, the `sanitizePrivateData()` engine recursively strips all authentication and credential fields:

```typescript
// Enforced in apps/extension/src/storage/db.ts
const sensitiveKeys = ["accesstoken", "refreshtoken", "password", "cookie", "authorization"];
```

- Zero passwords, access tokens, refresh tokens, session cookies, or authorization headers are stored in extension storage.

---

## 5. Third-Party Analytics & Remote Code

- **Zero Third-Party Analytics**: The extension contains no Google Analytics, Segment, Mixpanel, Amplitude, or advertising tracking scripts.
- **Zero Remotely Hosted Code**: 100% of executable JavaScript is locally bundled in the extension package.
- **Strict CSP**: Enforces `script-src 'self'; object-src 'self'`, prohibiting `unsafe-eval` and remote code loading.

---

## 6. User Control & Data Retention

- **User Control**: Users can toggle automatic job detection off in extension settings at any time.
- **Data Deletion**: Uninstalling the extension immediately purges all local IndexedDB and Chrome storage caches. Workspace data stored on FreelanceOS can be managed, exported, or deleted through the web application settings.

---

## 7. External Legal Reference

- **Official Privacy Policy URL**: `https://freelanceos.com/privacy.html` _(EXTERNAL VERIFICATION REQUIRED — formal policy document to be completed in Phase 12E)_
- **Data Protection Officer / Contact**: `privacy@freelanceos.com` _(EXTERNAL VERIFICATION REQUIRED)_
