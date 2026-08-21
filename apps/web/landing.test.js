import test from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import http from "node:http";
import { server } from "./server.js";
import { signAccessToken } from "@freelanceos/auth";
import { db } from "@freelanceos/db";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const originalSelect = db.select;

test.after(() => {
  db.select = originalSelect;
});

db.select = function () {
  const queryObj = {
    from() {
      return queryObj;
    },
    where() {
      return queryObj;
    },
    limit() {
      return queryObj;
    },
    then(resolve) {
      resolve([
        {
          id: "session-123",
          userId: "auth-user",
          refreshTokenHash: "hashed",
          expiresAt: new Date(Date.now() + 1000000),
          revokedAt: null,
          credentialVersion: 1,
          status: "active",
        },
      ]);
    },
  };
  return queryObj;
};

const landingHtmlPath = path.join(__dirname, "landing.html");
const landingHtmlContent = fs.readFileSync(landingHtmlPath, "utf-8");
const landingJsPath = path.join(__dirname, "landing.js");
const landingJsContent = fs.readFileSync(landingJsPath, "utf-8");

function makeRequest(pathName, method = "GET", headers = {}) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: "127.0.0.1",
      port: 0,
      path: pathName,
      method,
      headers,
    };

    const srv = http.createServer(server.listeners("request")[0]);
    srv.listen(0, "127.0.0.1", () => {
      const address = srv.address();
      options.port = address.port;

      const req = http.request(options, (res) => {
        let rawData = "";
        res.on("data", (chunk) => {
          rawData += chunk;
        });
        res.on("end", () => {
          srv.close(() => {
            resolve({
              statusCode: res.statusCode,
              headers: res.headers,
              body: rawData,
            });
          });
        });
      });

      req.on("error", (err) => {
        srv.close(() => reject(err));
      });

      req.end();
    });
  });
}

function getSessionCookie(
  userId = "user-123",
  _email = "user@example.com",
  sessionId = "session-123",
) {
  const token = signAccessToken({
    sessionId,
    userId,
    credentialVersion: 1,
  });
  return `__Host-refresh_token=${token}`;
}

// =====================================================================
// Phase 12B: Landing Page Test Suite
// =====================================================================

test("Landing 1. GET /landing.html returns 200 publicly", async () => {
  const res = await makeRequest("/landing.html", "GET");
  assert.strictEqual(res.statusCode, 200);
  assert.match(res.body, /The AI Operating System for High-Growth Freelancers/i);
});

test("Landing 2. Landing page is accessible without authentication cookie", async () => {
  const res = await makeRequest("/landing.html", "GET");
  assert.strictEqual(res.statusCode, 200);
  assert.ok(!res.headers.location);
});

test("Landing 3. Root route / serves landing.html publicly", async () => {
  const res = await makeRequest("/", "GET");
  assert.strictEqual(res.statusCode, 200);
  assert.match(res.body, /The AI Operating System for High-Growth Freelancers/i);
});

test("Landing 4. Authenticated user visiting /landing.html or / redirects (302) to /dashboard.html", async () => {
  const cookie = getSessionCookie("auth-user", "auth@example.com");

  const resLanding = await makeRequest("/landing.html", "GET", { Cookie: cookie });
  assert.strictEqual(resLanding.statusCode, 302);
  assert.strictEqual(resLanding.headers.location, "/dashboard.html");

  const resRoot = await makeRequest("/", "GET", { Cookie: cookie });
  assert.strictEqual(resRoot.statusCode, 302);
  assert.strictEqual(resRoot.headers.location, "/dashboard.html");
});

test("Landing 5. Semantic header exists with role banner and brand logo", () => {
  assert.match(landingHtmlContent, /<header\s+class="landing-header"\s+role="banner">/i);
  assert.match(landingHtmlContent, /<span\s+class="logo-text">FreelanceOS<\/span>/i);
  assert.match(landingHtmlContent, /<span\s+class="logo-mark"/i);
});

test("Landing 6. Semantic nav exists with accessible menubar and anchors", () => {
  assert.match(
    landingHtmlContent,
    /<nav\s+class="landing-nav"\s+id="main-nav"\s+aria-label="Main Navigation">/i,
  );
  assert.match(landingHtmlContent, /href="#features"/);
  assert.match(landingHtmlContent, /href="#how-it-works"/);
  assert.match(landingHtmlContent, /href="#pricing"/);
  assert.match(landingHtmlContent, /href="#privacy"/);
  assert.match(landingHtmlContent, /href="#faq"/);
});

test("Landing 7. Semantic main exists", () => {
  assert.match(landingHtmlContent, /<main\s+id="main-content"\s+class="landing-main">/i);
  assert.match(landingHtmlContent, /<\/main>/i);
});

test("Landing 8. Semantic footer exists with role contentinfo and copyright", () => {
  assert.match(landingHtmlContent, /<footer\s+class="landing-footer"\s+role="contentinfo">/i);
  assert.match(landingHtmlContent, /© 2026 FreelanceOS\. All rights reserved\./i);
  assert.match(
    landingHtmlContent,
    /The complete AI operating system for independent freelancers\./i,
  );
});

test("Landing 9. Exactly one h1 exists on the page", () => {
  const h1Matches = landingHtmlContent.match(/<h1[^>]*>[\s\S]*?<\/h1>/gi) || [];
  assert.strictEqual(h1Matches.length, 1, "There must be exactly one <h1> element");
  assert.match(h1Matches[0], /The AI Operating System for High-Growth Freelancers/i);
});

test("Landing 10. Required h2 section headings exist in logical hierarchy", () => {
  const h2Matches = landingHtmlContent.match(/<h2[^>]*>[\s\S]*?<\/h2>/gi) || [];
  assert.ok(h2Matches.length >= 5, "Must have at least 5 <h2> headings");

  const combinedH2 = h2Matches.join(" ");
  assert.match(combinedH2, /Built for Every Stage/i);
  assert.match(combinedH2, /How FreelanceOS Works/i);
  assert.match(combinedH2, /Plans Designed for Freelancers/i);
  assert.match(combinedH2, /Privacy-First & Secure by Design/i);
  assert.match(combinedH2, /Frequently Asked Questions/i);
  assert.match(combinedH2, /Ready to Accelerate Your Freelance Pipeline/i);
});

test("Landing 11. Hero section exists with value proposition and subheadline", () => {
  assert.match(landingHtmlContent, /<section\s+id="hero"\s+class="landing-hero"/i);
  assert.match(landingHtmlContent, /class="hero-subtitle"/i);
  assert.match(
    landingHtmlContent,
    /Automate client discovery, rank high-paying Upwork and LinkedIn opportunities/i,
  );
  assert.match(landingHtmlContent, /Next-Generation Freelance Intelligence/i);
});

test("Landing 12. Primary CTA points to /index.html and Secondary CTA points to /login.html", () => {
  assert.match(
    landingHtmlContent,
    /<a\s+href="\/index\.html"\s+class="btn btn-primary btn-lg"\s+id="hero-primary-cta">Get Started Free<\/a>/i,
  );
  assert.match(
    landingHtmlContent,
    /<a\s+href="\/login\.html"\s+class="btn btn-secondary btn-lg"\s+id="hero-secondary-cta">Sign In<\/a>/i,
  );
});

test("Landing 13. Four core product pillars exist (AI Job Matching, Client Brain, Proposal Studio, Unified Search)", () => {
  assert.match(landingHtmlContent, /<h3[^>]*>AI Job Matching<\/h3>/i);
  assert.match(landingHtmlContent, /<h3[^>]*>Client Brain Intelligence<\/h3>/i);
  assert.match(landingHtmlContent, /<h3[^>]*>Proposal & Scope Intelligence<\/h3>/i);
  assert.match(landingHtmlContent, /<h3[^>]*>Unified Global Search<\/h3>/i);
  assert.match(landingHtmlContent, /Ctrl\+K/i);
});

test("Landing 14. How It Works contains 3 distinct workflow steps (Ingest, Match & Analyze, Win Clients)", () => {
  assert.match(landingHtmlContent, /<h3\s+class="step-title">Ingest<\/h3>/i);
  assert.match(landingHtmlContent, /<h3\s+class="step-title">Match & Analyze<\/h3>/i);
  assert.match(landingHtmlContent, /<h3\s+class="step-title">Win Clients<\/h3>/i);
});

test("Landing 15. Starter pricing tier exists with $0 and free forever label", () => {
  assert.match(landingHtmlContent, /<h3\s+class="plan-name">Starter<\/h3>/i);
  assert.match(landingHtmlContent, /<span\s+class="price-val">\$0<\/span>/i);
  assert.match(landingHtmlContent, /<span\s+class="price-period">Free forever<\/span>/i);
  assert.match(landingHtmlContent, /5 job matches per day/i);
  assert.match(landingHtmlContent, /5 AI proposals per month/i);
});

test("Landing 16. Pro pricing tier exists with $29/mo and 7-day free trial badge", () => {
  assert.match(landingHtmlContent, /<h3\s+class="plan-name">Pro<\/h3>/i);
  assert.match(landingHtmlContent, /<span\s+class="price-val">\$29<\/span>/i);
  assert.match(landingHtmlContent, /<span\s+class="price-period">\/ month<\/span>/i);
  assert.match(landingHtmlContent, /Most Popular • 7-Day Free Trial/i);
  assert.match(landingHtmlContent, /Start 7-Day Free Trial/i);
  assert.match(landingHtmlContent, /50.*AI proposals per month/i);
});

test("Landing 17. Enterprise pricing tier exists with custom volume label", () => {
  assert.match(landingHtmlContent, /<h3\s+class="plan-name">Enterprise<\/h3>/i);
  assert.match(landingHtmlContent, /<span\s+class="price-val">Custom<\/span>/i);
  assert.match(landingHtmlContent, /<span\s+class="price-period">volume<\/span>/i);
  assert.match(landingHtmlContent, /Contact Sales/i);
});

test("Landing 18. Privacy & Trust section communicates data isolation and encryption", () => {
  assert.match(
    landingHtmlContent,
    /<section\s+id="privacy"\s+class="landing-section landing-privacy"/i,
  );
  assert.match(landingHtmlContent, /Strict Tenant Isolation/i);
  assert.match(landingHtmlContent, /Zero PII Tracking/i);
  assert.match(landingHtmlContent, /Client Data Confidentiality/i);
});

test("Landing 19. FAQ section contains accordion items with accessible controls", () => {
  assert.match(landingHtmlContent, /<section\s+id="faq"\s+class="landing-section landing-faq"/i);
  assert.match(landingHtmlContent, /How does AI job matching work\?/i);
  assert.match(landingHtmlContent, /Does FreelanceOS work with Upwork and LinkedIn\?/i);
  assert.match(landingHtmlContent, /What is included in the Pro 7-Day Free Trial\?/i);
  assert.match(landingHtmlContent, /What does Client Brain do\?/i);
  assert.match(landingHtmlContent, /What are the AI proposal generation limits\?/i);
});

test("Landing 20. Mobile menu toggle button exists with ARIA attributes", () => {
  assert.match(
    landingHtmlContent,
    /<button\s+id="mobile-menu-toggle"\s+class="mobile-menu-btn"\s+aria-label="Toggle navigation menu"\s+aria-expanded="false"\s+aria-controls="main-nav">/i,
  );
});

test("Landing 21. No Stripe secret keys, API keys, or JWT tokens in landing HTML/JS", () => {
  const combined = landingHtmlContent + " " + landingJsContent;
  assert.strictEqual(combined.includes("sk_live_"), false);
  assert.strictEqual(combined.includes("sk_test_"), false);
  assert.strictEqual(combined.includes("stripe_price_"), false);
  assert.strictEqual(combined.includes("passwordHash"), false);
  assert.strictEqual(combined.includes("refreshTokenHash"), false);
});

test("Landing 22. No external analytics SDK or tracking scripts in landing.html", () => {
  assert.strictEqual(landingHtmlContent.includes("google-analytics.com"), false);
  assert.strictEqual(landingHtmlContent.includes("gtag"), false);
  assert.strictEqual(landingHtmlContent.includes("mixpanel"), false);
  assert.strictEqual(landingHtmlContent.includes("segment"), false);
});

test("Landing 23. No private ownerId, tenantId, or client database records in landing page", () => {
  assert.strictEqual(landingHtmlContent.includes("tenant_"), false);
  assert.strictEqual(landingHtmlContent.includes("user-123"), false);
  assert.strictEqual(landingHtmlContent.includes("TopSecretClientCorp"), false);
});

test("Landing 24. Client-side JS: Handles mobile navigation toggle and FAQ accordion safely", () => {
  // Verify landing.js contains mobile toggle and FAQ accordion event handlers
  assert.match(landingJsContent, /mobileToggle\.addEventListener\("click"/);
  assert.match(landingJsContent, /faqButtons\.forEach/);
  assert.match(landingJsContent, /button\.setAttribute\("aria-expanded"/);
  assert.match(landingJsContent, /mainNav\.classList\.toggle\("nav-open"/);
  assert.strictEqual(landingJsContent.includes("fetch("), false);
  assert.strictEqual(landingJsContent.includes("eval("), false);
});
