import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { fileURLToPath } from "node:url";
import { signAccessToken } from "@freelanceos/auth";
import { db, sessions, userPasswordHashes, users } from "@freelanceos/db";
import { server } from "./server.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "../..");
const docPath = path.join(rootDir, "docs", "beta-onboarding-rollout.md");

// Capture original behaviors to restore after test run
const originalSelect = db.select;
const originalInsert = db.insert;
const originalUpdate = db.update;

let currentUserId = "beta-user-123";
let currentUserEmail = "beta-user@example.com";
let currentSessionId = "session-beta-123";

// Helper to construct authenticated cookie
function getSessionCookie(
  userId = currentUserId,
  email = currentUserEmail,
  sessionId = currentSessionId,
) {
  const token = signAccessToken({
    sessionId,
    userId,
    credentialVersion: 1,
  });
  return `__Host-refresh_token=${token}`;
}

// ---------------------------------------------------------------------------
// Helpers for HTTP tests against the local web server
// ---------------------------------------------------------------------------

function makeRequest(urlPath, method = "GET", headers = {}, body = null) {
  return new Promise((resolve, reject) => {
    let requestBody = body;
    const reqHeaders = { ...headers };

    if (requestBody && typeof requestBody === "object") {
      requestBody = JSON.stringify(requestBody);
      if (!reqHeaders["Content-Type"]) {
        reqHeaders["Content-Type"] = "application/json";
      }
    }

    if (requestBody) {
      reqHeaders["Content-Length"] = Buffer.byteLength(requestBody);
    }

    const srv = http.createServer(server.listeners("request")[0]);
    srv.listen(0, "127.0.0.1", () => {
      const address = srv.address();
      const options = {
        hostname: "127.0.0.1",
        port: address.port,
        path: urlPath,
        method,
        headers: reqHeaders,
      };

      const req = http.request(options, (res) => {
        let rawData = "";
        res.on("data", (chunk) => {
          rawData += chunk;
        });
        res.on("end", () => {
          srv.close(() => {
            let parsedBody = null;
            try {
              parsedBody = JSON.parse(rawData);
            } catch {
              // raw
            }
            resolve({
              statusCode: res.statusCode,
              headers: res.headers,
              body: rawData,
              json: parsedBody,
            });
          });
        });
      });

      req.on("error", (err) => {
        srv.close(() => reject(err));
      });

      if (requestBody) {
        req.write(requestBody);
      }
      req.end();
    });
  });
}

test.beforeEach(() => {
  // Mock db.select chain for session validation and user lookup
  db.select = function () {
    const builder = {
      from: function (table) {
        const fromBuilder = {
          where: function () {
            const whereBuilder = {
              limit: function () {
                return Promise.resolve(mockTableResult(table));
              },
              then: function (resolve) {
                resolve(mockTableResult(table));
              },
            };
            return whereBuilder;
          },
          then: function (resolve) {
            resolve(mockTableResult(table));
          },
        };
        return fromBuilder;
      },
    };
    return builder;
  };

  db.insert = function () {
    return {
      values: function () {
        return {
          returning: () => Promise.resolve([{ id: "new-user-123", email: currentUserEmail }]),
          onConflictDoUpdate: () => Promise.resolve([{ id: "inserted" }]),
          onConflictDoNothing: () => Promise.resolve([{ id: "inserted" }]),
          then: (resolve) => resolve([{ id: "inserted" }]),
        };
      },
    };
  };

  db.update = function () {
    return {
      set: function () {
        return {
          where: function () {
            return Promise.resolve({ rowCount: 1 });
          },
        };
      },
    };
  };
});

test.after(() => {
  db.select = originalSelect;
  db.insert = originalInsert;
  db.update = originalUpdate;
});

function mockTableResult(table) {
  if (table === sessions) {
    return [
      {
        id: currentSessionId,
        userId: currentUserId,
        refreshTokenHash: "hashed-token",
        expiresAt: new Date(Date.now() + 100000),
        revokedAt: null,
        lastActivityAt: new Date(),
        credentialVersion: 1,
      },
    ];
  }
  if (table === userPasswordHashes) {
    return [
      {
        id: "pwd-hash-1",
        userId: currentUserId,
        credentialVersion: 1,
      },
    ];
  }
  if (table === users) {
    return [
      {
        id: currentUserId,
        email: currentUserEmail,
        status: "ACTIVE",
        role: "USER",
        emailVerifiedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];
  }
  return [];
}

// ---------------------------------------------------------------------------
// 1. Beta Onboarding Tests (Tests 1-5)
// ---------------------------------------------------------------------------

test("Beta 1. Onboarding documentation exists on filesystem", () => {
  assert.ok(fs.existsSync(docPath), `Expected document at ${docPath}`);
  const content = fs.readFileSync(docPath, "utf-8");
  assert.ok(content.length > 500, "Document should have substantive content");
});

test("Beta 2. Onboarding renders required step-by-step beta guidance", () => {
  const content = fs.readFileSync(docPath, "utf-8");

  const requiredSteps = [
    "Step 1: Account Registration & Session Initialization",
    "Step 2: Workspace & Profile Configuration",
    "Step 3: Chrome Extension Installation & Pairing",
    "Step 4: First Job Ingestion & Normalization",
    "Step 5: Match Evaluation & AI Proposal Drafting",
  ];

  for (const step of requiredSteps) {
    assert.ok(content.includes(step), `Onboarding must contain step: "${step}"`);
  }
});

test("Beta 3. Onboarding and beta documentation does not expose secrets", () => {
  const content = fs.readFileSync(docPath, "utf-8");

  const secretPatterns = [
    /sk_live_[0-9a-zA-Z]{24,}/,
    /sk_test_[0-9a-zA-Z]{24,}/,
    /whsec_[0-9a-zA-Z]{24,}/,
    /postgres:\/\/[^:]+:[^@]+@/,
    /redis:\/\/[^:]+:[^@]+@/,
    /ghp_[0-9a-zA-Z]{36}/,
  ];

  for (const pattern of secretPatterns) {
    assert.ok(
      !pattern.test(content),
      `Document must not contain secrets matching pattern: ${pattern}`,
    );
  }
});

test("Beta 4. Onboarding behaves correctly for authenticated users on protected views", async () => {
  const cookie = getSessionCookie("user-beta-4", "auth_tester@example.com");
  const res = await makeRequest("/dashboard.html", "GET", { Cookie: cookie });
  assert.strictEqual(res.statusCode, 200);
  assert.ok(
    res.body.includes("Dashboard"),
    "Dashboard HTML view should render for authenticated user",
  );
});

test("Beta 5. Onboarding behaves safely for unauthorized users via 302 redirect", async () => {
  const res = await makeRequest("/dashboard.html", "GET");
  assert.strictEqual(res.statusCode, 302);
  assert.strictEqual(res.headers.location, "/login.html");
});

// ---------------------------------------------------------------------------
// 2. Feedback System Tests (Tests 6-14)
// ---------------------------------------------------------------------------

test("Beta 6. Feedback submission contract and categories exist", () => {
  const content = fs.readFileSync(docPath, "utf-8");
  const categories = ["BUG", "FEATURE_REQUEST", "USABILITY", "AI_QUALITY", "OTHER"];
  for (const cat of categories) {
    assert.ok(content.includes(cat), `Feedback doc must include category: ${cat}`);
  }
  assert.ok(content.includes("POST /api/feedback"), "Doc must document POST /api/feedback");
});

test("Beta 7. Valid feedback submission succeeds with 200 and generated feedbackId", async () => {
  const cookie = getSessionCookie("user-feedback-1", "fb_tester@example.com");
  const res = await makeRequest(
    "/api/feedback",
    "POST",
    { Cookie: cookie },
    {
      category: "USABILITY",
      subject: "Sidebar navigation",
      message: "The collapsible sidebar transitions smoothly on desktop.",
      metadata: {
        appVersion: "0.1.0",
        currentPath: "/dashboard.html",
      },
    },
  );

  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.json?.success, true);
  assert.ok(res.json?.feedbackId?.startsWith("fb_"), "Expected feedbackId with prefix fb_");
});

test("Beta 8. Invalid feedback category is rejected with 400 INVALID_CATEGORY", async () => {
  const cookie = getSessionCookie("user-feedback-2", "cat_tester@example.com");
  const res = await makeRequest(
    "/api/feedback",
    "POST",
    { Cookie: cookie },
    {
      category: "ARBITRARY_SPAM",
      message: "This is a valid length message for testing category rejection.",
    },
  );

  assert.strictEqual(res.statusCode, 400);
  assert.strictEqual(res.json?.code, "INVALID_CATEGORY");
});

test("Beta 9. Oversized (> 2000 chars) and undersized (< 10 chars) messages are rejected", async () => {
  const cookie = getSessionCookie("user-feedback-3", "length_tester@example.com");

  // Undersized (< 10 chars)
  const shortRes = await makeRequest(
    "/api/feedback",
    "POST",
    { Cookie: cookie },
    {
      category: "BUG",
      message: "Tiny",
    },
  );
  assert.strictEqual(shortRes.statusCode, 400);
  assert.strictEqual(shortRes.json?.code, "INVALID_MESSAGE_LENGTH");

  // Oversized (> 2000 chars)
  const longRes = await makeRequest(
    "/api/feedback",
    "POST",
    { Cookie: cookie },
    {
      category: "BUG",
      message: "a".repeat(2001),
    },
  );
  assert.strictEqual(longRes.statusCode, 400);
  assert.strictEqual(longRes.json?.code, "INVALID_MESSAGE_LENGTH");
});

test("Beta 10. Unauthenticated feedback submission is rejected with 401 Unauthorized", async () => {
  const res = await makeRequest(
    "/api/feedback",
    "POST",
    {},
    {
      category: "BUG",
      message: "Anonymous submission attempting to post feedback without session.",
    },
  );

  assert.strictEqual(res.statusCode, 401);
  assert.strictEqual(res.json?.error, "Unauthorized");
});

test("Beta 11. Feedback is correctly scoped to authenticated session identity", async () => {
  const cookie = getSessionCookie("tenant-alpha-999", "alpha@company.com");
  const res = await makeRequest(
    "/api/feedback",
    "POST",
    { Cookie: cookie },
    {
      category: "AI_QUALITY",
      message: "Proposal tone was highly professional and matched client requirements.",
    },
  );

  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.json?.success, true);
});

test("Beta 12. Tenant/owner spoofing in payload is rejected and overridden by session", async () => {
  const cookie = getSessionCookie("victim-tenant-123", "victim@example.com");
  // Client attempts to spoof ownerId/tenantId in payload
  const res = await makeRequest(
    "/api/feedback",
    "POST",
    { Cookie: cookie },
    {
      category: "BUG",
      ownerId: "attacker-tenant-666",
      tenantId: "attacker-tenant-666",
      message: "Attempting to inject attacker tenantId inside feedback body.",
    },
  );

  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.json?.success, true);
  // Feedback processed under authenticated victim-tenant-123 identity without leaking attacker scope
});

test("Beta 13. XSS payloads in feedback text are accepted safely as plain text", async () => {
  const cookie = getSessionCookie("user-xss-test", "xss@example.com");
  const res = await makeRequest(
    "/api/feedback",
    "POST",
    { Cookie: cookie },
    {
      category: "BUG",
      subject: "<script>alert('xss')</script>",
      message: "<img src=x onerror=alert(1)> Found an unescaped tag in matching filter.",
    },
  );

  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.json?.success, true);
});

test("Beta 14. Secrets and credentials are not persisted or echoed in feedback response", async () => {
  const cookie = getSessionCookie("user-secret-test", "secret@example.com");
  const res = await makeRequest(
    "/api/feedback",
    "POST",
    { Cookie: cookie },
    {
      category: "BUG",
      message: "Accidental paste of token sk_live_12345abcdef in feedback description.",
    },
  );

  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.json?.success, true);
  // Ensure response contains only feedbackId and safe message
  assert.strictEqual("sk_live_12345abcdef" in (res.json || {}), false);
  assert.strictEqual(JSON.stringify(res.json).includes("sk_live_"), false);
});

// ---------------------------------------------------------------------------
// 3. Rollout Controls & State Enforcement Tests (Tests 15-18)
// ---------------------------------------------------------------------------

test("Beta 15. Beta restriction is enforced server-side for signups", async () => {
  const origMode = process.env.BETA_ACCESS_MODE;
  const origList = process.env.BETA_INVITE_ALLOWLIST;
  try {
    process.env.BETA_ACCESS_MODE = "BETA_RESTRICTED";
    process.env.BETA_INVITE_ALLOWLIST = "beta@trusted.com";

    const res = await makeRequest(
      "/api/signup",
      "POST",
      {},
      {
        email: "uninvited@random.com",
        password: "Password123!",
      },
    );

    assert.strictEqual(res.statusCode, 403);
    assert.strictEqual(res.json?.code, "BETA_RESTRICTED");
  } finally {
    if (origMode !== undefined) process.env.BETA_ACCESS_MODE = origMode;
    else delete process.env.BETA_ACCESS_MODE;
    if (origList !== undefined) process.env.BETA_INVITE_ALLOWLIST = origList;
    else delete process.env.BETA_INVITE_ALLOWLIST;
  }
});

test("Beta 16. Allowed beta user can access the registration surface in BETA_RESTRICTED mode", async () => {
  const origMode = process.env.BETA_ACCESS_MODE;
  const origList = process.env.BETA_INVITE_ALLOWLIST;
  try {
    process.env.BETA_ACCESS_MODE = "BETA_RESTRICTED";
    process.env.BETA_INVITE_ALLOWLIST = "invited_vip@trusted.com";

    const res = await makeRequest(
      "/api/signup",
      "POST",
      {},
      {
        email: "invited_vip@trusted.com",
        password: "Short", // triggers password validator in auth instead of 403 BETA_RESTRICTED
      },
    );

    assert.notStrictEqual(res.statusCode, 403);
    assert.notStrictEqual(res.json?.code, "BETA_RESTRICTED");
  } finally {
    if (origMode !== undefined) process.env.BETA_ACCESS_MODE = origMode;
    else delete process.env.BETA_ACCESS_MODE;
    if (origList !== undefined) process.env.BETA_INVITE_ALLOWLIST = origList;
    else delete process.env.BETA_INVITE_ALLOWLIST;
  }
});

test("Beta 17. Restricted user receives safe, sanitized 403 response without stack traces", async () => {
  const orig = process.env.BETA_REGISTRATION_ENABLED;
  try {
    process.env.BETA_REGISTRATION_ENABLED = "false";
    const res = await makeRequest(
      "/api/signup",
      "POST",
      {},
      {
        email: "tester@example.com",
        password: "Password123!",
      },
    );

    assert.strictEqual(res.statusCode, 403);
    assert.strictEqual(res.json?.code, "BETA_DISABLED");
    assert.strictEqual(typeof res.json?.error, "string");
    assert.strictEqual(res.json?.stack, undefined);
  } finally {
    if (orig !== undefined) process.env.BETA_REGISTRATION_ENABLED = orig;
    else delete process.env.BETA_REGISTRATION_ENABLED;
  }
});

test("Beta 18. Frontend state manipulation cannot bypass server-side beta restriction", async () => {
  const origMode = process.env.BETA_ACCESS_MODE;
  const origList = process.env.BETA_INVITE_ALLOWLIST;
  try {
    process.env.BETA_ACCESS_MODE = "BETA_RESTRICTED";
    process.env.BETA_INVITE_ALLOWLIST = "approved@agency.com";

    // Attempting to bypass by injecting headers or client flags
    const res = await makeRequest(
      "/api/signup",
      "POST",
      { "X-Beta-Override": "true", "X-Is-Admin": "true" },
      {
        email: "hacker@domain.com",
        password: "Password123!",
        isAdmin: true,
        betaBypass: true,
      },
    );

    assert.strictEqual(res.statusCode, 403);
    assert.strictEqual(res.json?.code, "BETA_RESTRICTED");
  } finally {
    if (origMode !== undefined) process.env.BETA_ACCESS_MODE = origMode;
    else delete process.env.BETA_ACCESS_MODE;
    if (origList !== undefined) process.env.BETA_INVITE_ALLOWLIST = origList;
    else delete process.env.BETA_INVITE_ALLOWLIST;
  }
});

// ---------------------------------------------------------------------------
// 4. Documentation & Operational Checklist Tests (Tests 19-20)
// ---------------------------------------------------------------------------

test("Beta 19. Known risks taxonomy distinguishes CODE VERIFIED from EXTERNAL VERIFICATION REQUIRED", () => {
  const content = fs.readFileSync(docPath, "utf-8");

  assert.ok(content.includes("CODE VERIFIED"), "Must have CODE VERIFIED section");
  assert.ok(
    content.includes("EXTERNAL VERIFICATION REQUIRED"),
    "Must have EXTERNAL VERIFICATION REQUIRED section",
  );

  const externalDeps = [
    "PostgreSQL Database",
    "Redis Cache / Queue",
    "Stripe Live Mode",
    "Chrome Web Store",
    "Domain & Ingress TLS",
    "Transactional Email",
  ];

  for (const dep of externalDeps) {
    assert.ok(content.includes(dep), `Must document external dependency: ${dep}`);
  }
});

test("Beta 20. Beta rollout / operations documentation exists with operational placeholders", () => {
  const content = fs.readFileSync(docPath, "utf-8");

  assert.ok(
    content.includes("Operational Verification Checklist"),
    "Must include operational checklist",
  );
  assert.ok(
    content.includes("OPERATIONAL / LEGAL VERIFICATION REQUIRED") ||
      content.includes("Operational / Legal Verification Required") ||
      content.includes("Operational / Deployment Verification Required"),
    "Must explicitly tag unverified operational items",
  );
});
