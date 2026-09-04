import test from "node:test";
import assert from "node:assert";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "../..");
const termsPath = path.join(repoRoot, "docs", "terms-of-service.md");
const privacyPath = path.join(repoRoot, "docs", "privacy-policy.md");
const dataHandlingPath = path.join(repoRoot, "docs", "data-handling.md");
const aiDataUsePath = path.join(repoRoot, "docs", "ai-data-use.md");

// =====================================================================
// Phase 12F: Terms of Service Test Suite
// =====================================================================

test("Terms 1. Terms document exists on filesystem", () => {
  assert.ok(fs.existsSync(termsPath), "docs/terms-of-service.md must exist");
});

test("Terms 2. Required Terms of Service sections are present", () => {
  const content = fs.readFileSync(termsPath, "utf-8");

  assert.match(content, /1\.\s+Agreement to Terms/i);
  assert.match(content, /2\.\s+Description of the Service/i);
  assert.match(content, /3\.\s+Account Registration\s*&\s*Security/i);
  assert.match(content, /4\.\s+Subscriptions,\s*Trials\s*&\s*Billing/i);
  assert.match(content, /5\.\s+AI Disclaimers\s*&\s*Limitations of Output/i);
  assert.match(content, /6\.\s+Acceptable Use Policy/i);
  assert.match(content, /7\.\s+User Content\s*&\s*Data Ownership/i);
  assert.match(content, /8\.\s+Intellectual Property Rights/i);
  assert.match(content, /9\.\s+Service Availability\s*&\s*Modifications/i);
  assert.match(content, /10\.\s+Limitation of Liability\s*&\s*Indemnification/i);
  assert.match(content, /11\.\s+Third-Party Integrations\s*&\s*Platform Terms/i);
  assert.match(content, /12\.\s+Legal Entity,\s*Governing Law\s*&\s*Contact/i);
});

test("Terms 3. Canonical plan identifiers are represented accurately", () => {
  const content = fs.readFileSync(termsPath, "utf-8");

  assert.match(content, /STARTER/);
  assert.match(content, /PRO/);
  assert.match(content, /POWER_BIDDER/);
});

test("Terms 4. Trial/billing language matches implementation", () => {
  const content = fs.readFileSync(termsPath, "utf-8");

  assert.match(content, /monthly billing cycle/i);
  assert.match(content, /Stripe/);
  assert.match(content, /seven\s*\(\s*7\s*\)\s*days/i);
});

test("Terms 5. AI limitation and disclaimer clauses exist", () => {
  const content = fs.readFileSync(termsPath, "utf-8");

  assert.match(content, /inaccurate,\s*incomplete,\s*or outdated/i);
  assert.match(
    content,
    /does not guarantee contracts,\s*clients,\s*revenue,\s*proposal acceptance/i,
  );
  assert.match(content, /No Professional or Legal Advice/i);
});

test("Terms 6. User responsibility for AI output is explicit", () => {
  const content = fs.readFileSync(termsPath, "utf-8");

  assert.match(content, /independently review/i);
  assert.match(content, /sole and absolute responsibility for anything they send/i);
});

test("Terms 7. Acceptable-use and security restrictions exist", () => {
  const content = fs.readFileSync(termsPath, "utf-8");

  assert.match(content, /credential theft/i);
  assert.match(content, /authentication bypass/i);
  assert.match(content, /tenant isolation bypass/i);
  assert.match(content, /security probing/i);
  assert.match(content, /malicious automation/i);
  assert.match(content, /spam/i);
  assert.match(content, /third-party platform abuse/i);
  assert.match(content, /extract private messages/i);
  assert.match(content, /unsupported extension usage/i);
});

test("Terms 8. Liability and warranty boundaries exist", () => {
  const content = fs.readFileSync(termsPath, "utf-8");

  assert.match(content, /AS IS/);
  assert.match(content, /AS AVAILABLE/);
  assert.match(content, /DISCLAIMS ALL WARRANTIES/i);
  assert.match(content, /No Guarantee of Outcomes or Uptime/i);
  assert.match(content, /Exclusion of Consequential Damages/i);
  assert.match(content, /Limitation of Aggregate Liability/i);
  assert.match(content, /User Indemnification for Misuse/i);
});

test("Terms 9. Third-party platform disclaimers exist", () => {
  const content = fs.readFileSync(termsPath, "utf-8");

  assert.match(content, /Upwork/);
  assert.match(content, /LinkedIn/);
  assert.match(content, /Stripe/);
  assert.match(
    content,
    /NOT affiliated with,\s*authorized by,\s*partnered with,\s*sponsored by,\s*or endorsed by/i,
  );
  assert.match(content, /Independent Service/i);
});

test("Terms 10. Terms are consistent with Privacy and AI governance docs", () => {
  const termsContent = fs.readFileSync(termsPath, "utf-8");
  const privacyContent = fs.readFileSync(privacyPath, "utf-8");
  const dataHandlingContent = fs.readFileSync(dataHandlingPath, "utf-8");
  const aiDataUseContent = fs.readFileSync(aiDataUsePath, "utf-8");

  assert.ok(privacyContent.length > 500, "Privacy policy must be non-empty");
  assert.ok(dataHandlingContent.length > 500, "Data handling specification must be non-empty");
  assert.ok(aiDataUseContent.length > 500, "AI data use specification must be non-empty");

  assert.match(termsContent, /never used to train public or foundational machine learning models/i);
  assert.match(termsContent, /GET \/api\/settings\/data\/export/);
});

test("Terms 11. No credentials, secrets, or database connection strings exist", () => {
  const content = fs.readFileSync(termsPath, "utf-8");

  assert.strictEqual(content.includes("postgres://"), false);
  assert.strictEqual(content.includes("redis://"), false);
  assert.strictEqual(content.includes("sk_test_"), false);
  assert.strictEqual(content.includes("sk_live_"), false);
  assert.strictEqual(content.includes("whsec_"), false);
  assert.strictEqual(content.includes("password123"), false);
  assert.strictEqual(content.includes("JWT_SECRET"), false);
});

test("Terms 12. Operational/legal placeholders are explicitly marked where needed", () => {
  const content = fs.readFileSync(termsPath, "utf-8");

  assert.match(content, /Legal Entity.*OPERATIONAL \/ LEGAL VERIFICATION REQUIRED/i);
  assert.match(content, /Registered Address.*OPERATIONAL \/ LEGAL VERIFICATION REQUIRED/i);
  assert.match(content, /Governing Law.*OPERATIONAL \/ LEGAL VERIFICATION REQUIRED/i);
  assert.match(content, /Official Legal Contact.*OPERATIONAL \/ LEGAL VERIFICATION REQUIRED/i);
});
