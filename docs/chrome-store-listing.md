# Chrome Web Store Listing & Asset Specification

**Extension Name**: FreelanceOS Job Matcher  
**Package Version**: 0.1.0  
**Target Category**: Productivity / Workflow & Planning  
**Primary Language**: English

---

## 1. Single-Purpose Statement

FreelanceOS Job Matcher serves a single, dedicated purpose:  
_To capture public freelance and contract job postings from supported platforms (Upwork and LinkedIn) and synchronize structured job context with the user's FreelanceOS workspace for fit scoring and proposal generation._

---

## 2. Store Listing Copy

### Short Description (Max 132 characters)

> Capture and score freelance job opportunities on Upwork and LinkedIn directly with your FreelanceOS intelligence workspace.

### Detailed Description

**FreelanceOS Job Matcher** connects your browser workflow to your personal FreelanceOS workspace. When browsing freelance and contract opportunities on Upwork or LinkedIn, the extension extracts job requirements, skills, budget/salary parameters, and client details, allowing you to instantly assess fit and draft targeted proposals.

#### Key Capabilities

- **Automatic Opportunity Detection**: Seamlessly detects when you navigate to job detail pages on Upwork and LinkedIn.
- **Structured Requirement Extraction**: Captures job titles, full descriptions, skill requirements, client locations, and compensation details with multi-tier fallback selectors.
- **Fit Scoring & Explanations**: Forwards captured job specifications to your FreelanceOS backend to compute deterministic match scores and actionable strength/gap breakdowns.
- **Offline Resilience**: Automatically caches recent job snapshots in local IndexedDB storage with 24-hour TTL, allowing you to review opportunities even during network disruptions.
- **Privacy-First Design**: Operates under strict least-privilege permissions. Does not track browsing history, does not inject third-party trackers, and strips all sensitive credentials before storage.

#### Supported Platforms

1. **Upwork**:
   - `https://*.upwork.com/jobs/*`
   - `https://*.upwork.com/nx/find-work/job-details/*`
   - `https://*.upwork.com/ab/jobs/*`
   - `https://*.upwork.com/freelance-jobs/*`
2. **LinkedIn**:
   - `https://*.linkedin.com/jobs/view/*`
   - `https://*.linkedin.com/jobs/search/*?currentJobId=*`
   - `https://*.linkedin.com/jobs/collections/*`

---

## 3. Recommended Keywords & Metadata

- **Primary Keywords**: `freelance`, `job matcher`, `upwork`, `linkedin`, `proposal generator`, `client intelligence`, `contract jobs`, `productivity`
- **Content Rating**: Everyone (Mature: No)
- **Pricing**: Free (Requires active FreelanceOS account for synchronization)

---

## 4. Visual Asset Specifications

### Extension Icons

All icons must be square PNG format with transparent backgrounds where appropriate:

- **16x16 px**: Toolbar favicon and context menu icon (`assets/icon-16.png`).
- **48x48 px**: Extension management page (`chrome://extensions`) (`assets/icon-48.png`).
- **128x128 px**: Chrome Web Store detail page and installation prompt (`assets/icon-128.png`).

### Promotional Screenshots

Screenshots must be PNG or JPEG format, 24-bit RGB without transparency:

- **Standard Resolution**: 1280 × 800 px (16:10 aspect ratio) or 640 × 400 px.
- **Planned Screenshots**:
  1. **Screenshot 1 — Upwork Opportunity Ingestion**: Demonstration of Upwork job detail view with extracted skills, budget, and FreelanceOS match score badge.
  2. **Screenshot 2 — LinkedIn Job Parsing**: Demonstration of LinkedIn job view showing company details, workplace type, and seniority extraction.
  3. **Screenshot 3 — Quick Extension Popup**: Overview of the popup dashboard displaying synchronization state, recent detected jobs, and match breakdown.
  4. **Screenshot 4 — Offline Snapshots**: View of offline cache resilience displaying stored job opportunities when offline.

### Promotional Tiles (Optional for Featured Placement)

- **Small Promo Tile**: 440 × 280 px
- **Marquee Promo Tile**: 1400 × 560 px

---

## 5. Web Store Compliance Checklist

- [x] Manifest V3 compliant (`manifest_version: 3`)
- [x] Background service worker uses ES module
- [x] Strict Content Security Policy (`script-src 'self'; object-src 'self'`)
- [x] Zero remotely hosted executable JavaScript (no CDN scripts, no `eval()`)
- [x] Single-purpose declaration verified
- [x] Minimal permissions requested (`storage` only)
- [x] Scoped host permissions (Upwork, LinkedIn, FreelanceOS API only)
- [x] No fake review metrics, testimonials, or unsupported feature claims

---

## 6. Official URLs & Support

- **Homepage URL**: `https://freelanceos.com/`
- **Support URL**: `https://freelanceos.com/support` _(EXTERNAL VERIFICATION REQUIRED)_
- **Privacy Policy URL**: `https://freelanceos.com/privacy.html` _(EXTERNAL VERIFICATION REQUIRED — to be formalized in Phase 12E)_
