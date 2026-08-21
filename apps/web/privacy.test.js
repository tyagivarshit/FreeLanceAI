import test from "node:test";
import assert from "node:assert";
import http from "http";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { signAccessToken } from "@freelanceos/auth";
import { db, sessions, userPasswordHashes, users, jobMatches, jobImports } from "@freelanceos/db";
import { server, jobsRepo, timelineRepo, clientRepo, brainAnalysisRepo } from "./server.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "../..");

// Save original methods
const originalSelect = db.select;
const originalUpdate = db.update;
const originalInsert = db.insert;
const originalJobsFindByTenant = jobsRepo.findByTenant;
const originalTimelineFindEntries = timelineRepo.findTimelineEntriesByOwner;
const originalClientList = clientRepo.list;
const originalBrainListByScope = brainAnalysisRepo.listByScope;

let currentUserId = "privacy-user-1";
let currentUserEmail = "privacy@example.com";
let currentSessionId = "session-privacy-1";

function getSessionCookie(
  userId = "privacy-user-1",
  email = "privacy@example.com",
  sessionId = "session-privacy-1",
) {
  currentUserId = userId;
  currentUserEmail = email;
  currentSessionId = sessionId;
  const token = signAccessToken({
    sessionId,
    userId,
    credentialVersion: 1,
  });
  return `__Host-refresh_token=${token}`;
}

function makeRequest(pathName, method = "GET", headers = {}, body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: "127.0.0.1",
      port: 0,
      path: pathName,
      method,
      headers: {
        ...headers,
      },
    };

    if (body) {
      if (typeof body === "object") {
        body = JSON.stringify(body);
        if (!options.headers["Content-Type"]) {
          options.headers["Content-Type"] = "application/json";
        }
      }
      options.headers["Content-Length"] = Buffer.byteLength(body);
    }

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
            let parsedBody = rawData;
            try {
              parsedBody = JSON.parse(rawData);
            } catch {
              // keep as raw string
            }
            resolve({
              statusCode: res.statusCode,
              headers: res.headers,
              body: parsedBody,
            });
          });
        });
      });

      req.on("error", (err) => {
        srv.close(() => reject(err));
      });

      if (body) {
        req.write(body);
      }
      req.end();
    });
  });
}

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
      },
    ];
  }
  if (table === jobImports) {
    return [{ count: 0 }];
  }
  if (table === jobMatches) {
    return [];
  }
  return [];
}

test.beforeEach(() => {
  // Setup DB mocks
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

  db.insert = function () {
    return {
      values: function () {
        return {
          onConflictDoUpdate: () => Promise.resolve([{ id: "inserted" }]),
          onConflictDoNothing: () => Promise.resolve([{ id: "inserted" }]),
        };
      },
    };
  };

  // Mock repository methods
  clientRepo.list = async (ownerId) => {
    return {
      items: [
        {
          id: "client_1",
          ownerId,
          name: "Acme Corp",
          email: "billing@acme.com",
          company: "Acme Inc",
        },
      ],
      total: 1,
    };
  };

  jobsRepo.findByTenant = async (tenantId) => {
    return {
      items: [
        {
          id: "job_1",
          tenantId,
          title: "Fullstack Developer",
          source: "UPWORK",
        },
      ],
      total: 1,
    };
  };

  timelineRepo.findTimelineEntriesByOwner = async () => {
    return {
      items: [
        {
          id: "timeline_1",
          category: "MILESTONE",
          metadataSummary: "Project delivered",
        },
      ],
      total: 1,
    };
  };

  brainAnalysisRepo.listByScope = async () => {
    return {
      items: [
        {
          id: "brain_1",
          summary: "Client values fast delivery",
        },
      ],
      total: 1,
    };
  };
});

test.after(() => {
  db.select = originalSelect;
  db.update = originalUpdate;
  db.insert = originalInsert;
  jobsRepo.findByTenant = originalJobsFindByTenant;
  timelineRepo.findTimelineEntriesByOwner = originalTimelineFindEntries;
  clientRepo.list = originalClientList;
  brainAnalysisRepo.listByScope = originalBrainListByScope;
});

// =====================================================================
// Phase 12E: Privacy & Data Governance Test Suite
// =====================================================================

test("Privacy 1. GET /api/settings/data/export requires authentication (HTTP 401)", async () => {
  const res = await makeRequest("/api/settings/data/export", "GET");
  assert.strictEqual(res.statusCode, 401);
  assert.strictEqual(res.body.success, false);
  assert.strictEqual(res.body.error, "Unauthorized");
});

test("Privacy 2. Authenticated GET /api/settings/data/export returns structured export archive", async () => {
  const cookie = getSessionCookie("privacy-test-user", "privacy-test@example.com");
  const res = await makeRequest("/api/settings/data/export", "GET", { Cookie: cookie });

  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.body.success, true);
  assert.ok(res.body.export, "Export payload must exist");
  assert.strictEqual(res.body.export.version, "1.0.0");
  assert.ok(res.body.export.exportedAt, "Export timestamp must be present");
});

test("Privacy 3. Export archive is strictly scoped to authenticated tenant and owner ID", async () => {
  const targetUserId = "privacy-user-888";
  const cookie = getSessionCookie(targetUserId, "user888@example.com");
  const res = await makeRequest("/api/settings/data/export", "GET", { Cookie: cookie });

  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.body.export.ownerId, targetUserId);
  assert.strictEqual(res.body.export.tenantId, `tenant_${targetUserId}`);
});

test("Privacy 4. Export archive contains all expected tenant domain categories as arrays", async () => {
  const cookie = getSessionCookie("privacy-user-2", "user2@example.com");
  const res = await makeRequest("/api/settings/data/export", "GET", { Cookie: cookie });

  assert.strictEqual(res.statusCode, 200);
  assert.ok(Array.isArray(res.body.export.clients), "clients array must exist");
  assert.ok(Array.isArray(res.body.export.jobs), "jobs array must exist");
  assert.ok(Array.isArray(res.body.export.matches), "matches array must exist");
  assert.ok(Array.isArray(res.body.export.timeline), "timeline array must exist");
  assert.ok(Array.isArray(res.body.export.brainAnalyses), "brainAnalyses array must exist");
});

test("Privacy 5. Export payload excludes passwords, password hashes, and security secrets", async () => {
  const cookie = getSessionCookie("privacy-user-3", "user3@example.com");
  const res = await makeRequest("/api/settings/data/export", "GET", { Cookie: cookie });

  const rawJson = JSON.stringify(res.body);
  assert.strictEqual(
    rawJson.includes("passwordHash"),
    false,
    "Password hashes must not be exported",
  );
  assert.strictEqual(
    rawJson.includes("refreshTokenHash"),
    false,
    "Refresh token hashes must not be exported",
  );
  assert.strictEqual(
    rawJson.includes("stripe_price_"),
    false,
    "Stripe price identifiers must not leak",
  );
  assert.strictEqual(rawJson.includes("sk_test_"), false, "Stripe secret keys must not leak");
  assert.strictEqual(rawJson.includes("sk_live_"), false, "Stripe live keys must not leak");
});

test("Privacy 6. Session revocation endpoint DELETE /api/settings/security/sessions behaves securely", async () => {
  // 1. Unauthenticated request rejected
  const unauthRes = await makeRequest("/api/settings/security/sessions", "DELETE");
  assert.strictEqual(unauthRes.statusCode, 401);

  // 2. Authenticated request revokes other sessions
  const cookie = getSessionCookie("privacy-user-4", "user4@example.com");
  const authRes = await makeRequest("/api/settings/security/sessions", "DELETE", {
    Cookie: cookie,
  });
  assert.strictEqual(authRes.statusCode, 200);
  assert.strictEqual(authRes.body.success, true);
  assert.match(authRes.body.message, /all other sessions revoked/i);
});

test("Privacy 7. docs/privacy-policy.md exists and contains required legal and privacy sections", () => {
  const docPath = path.join(repoRoot, "docs", "privacy-policy.md");
  assert.ok(fs.existsSync(docPath), "docs/privacy-policy.md must exist");
  const content = fs.readFileSync(docPath, "utf-8");

  assert.match(content, /Scope\s*&\s*Overview/i);
  assert.match(content, /Information We Collect/i);
  assert.match(content, /Information We Do NOT Collect/i);
  assert.match(content, /Tenant\s*&\s*Owner Isolation/i);
  assert.match(content, /Self-Service Data Export/i);
  assert.match(content, /Data Deletion/i);
  assert.match(content, /AI Data Use/i);
  assert.match(content, /User Rights/i);
});

test("Privacy 8. docs/data-handling.md exists and specifies technical data architecture", () => {
  const docPath = path.join(repoRoot, "docs", "data-handling.md");
  assert.ok(fs.existsSync(docPath), "docs/data-handling.md must exist");
  const content = fs.readFileSync(docPath, "utf-8");

  assert.match(content, /System Data Flow Architecture/i);
  assert.match(content, /Multi-Tenant Isolation Model/i);
  assert.match(content, /Data Category Mapping/i);
  assert.match(content, /Secret Exclusion in Data Exports/i);
  assert.match(content, /AI Gateway Boundary/i);
  assert.match(content, /Chrome Extension Data Handling/i);
});

test("Privacy 9. docs/data-export-delete-process.md exists and outlines export and deletion runbooks", () => {
  const docPath = path.join(repoRoot, "docs", "data-export-delete-process.md");
  assert.ok(fs.existsSync(docPath), "docs/data-export-delete-process.md must exist");
  const content = fs.readFileSync(docPath, "utf-8");

  assert.match(content, /Data Export Runbook/i);
  assert.match(content, /GET \/api\/settings\/data\/export/i);
  assert.match(content, /Data Deletion Capabilities/i);
  assert.match(content, /Single Session Revocation/i);
  assert.match(content, /NOT CURRENTLY IMPLEMENTED/i);
  assert.match(content, /Incident\s*&\s*Failure Handling/i);
});

test("Privacy 10. docs/ai-data-use.md exists and establishes AI governance rules", () => {
  const docPath = path.join(repoRoot, "docs", "ai-data-use.md");
  assert.ok(fs.existsSync(docPath), "docs/ai-data-use.md must exist");
  const content = fs.readFileSync(docPath, "utf-8");

  assert.match(content, /Purpose\s*&\s*AI Capabilities/i);
  assert.match(content, /Customer Data in AI Context/i);
  assert.match(content, /Tenant Isolation/i);
  assert.match(content, /PII\s*&\s*Secret Redaction/i);
  assert.match(content, /Context Limits\s*&\s*Token Budgeting/i);
  assert.match(content, /Model Training/i);
  assert.match(content, /Governance\s*&\s*Security Controls/i);
});
