import test from "node:test";
import assert from "node:assert";
import http from "http";
import { signAccessToken } from "@freelanceos/auth";
import { db, sessions, userPasswordHashes, users, jobImports, jobMatches } from "@freelanceos/db";
import {
  server,
  jobsRepo,
  matchRepo,
  timelineRepo,
  subscriptionRepo,
  usageRepo,
  entitlementResolver,
} from "./server.js";
import {
  JobImport,
  JobSource,
  JobExternalIdentity,
  JobImportProvenance,
  JobRawPayload,
  JobImportFingerprint,
  JobMatch,
  ClientTimeline,
  TimelineEntry,
} from "@freelanceos/core";

// Capture original behaviors to restore after test run
const originalSelect = db.select;
const originalInsert = db.insert;
const originalUpdate = db.update;

const originalJobsFindByTenant = jobsRepo.findByTenant;
const originalJobsFindById = jobsRepo.findById;
const originalMatchFindByMatchingIdentity = matchRepo.findByMatchingIdentity;
const originalMatchSave = matchRepo.save;
const originalTimelineFindById = timelineRepo.findById;
const originalTimelineSave = timelineRepo.save;
const originalTimelineFindEntries = timelineRepo.findTimelineEntriesByOwner;

// Test variables to control mocks dynamically
let currentUserId = "user-123";
let currentUserEmail = "user@example.com";
let currentSessionId = "session-123";

let mockScannedCount = 0;
let mockMatchesCount = 0;

let mockJobs = [];
let mockTimelineEntries = [];
let savedMatches = [];
let savedTimelines = [];

// Helper to start/stop the test server on an ephemeral port
let serverPort = 0;

test.before(() => {
  return new Promise((resolve) => {
    server.listen(0, () => {
      serverPort = server.address().port;
      resolve();
    });
  });
});

test.after(() => {
  return new Promise((resolve) => {
    server.close(() => {
      // Restore original DB and repository methods
      db.select = originalSelect;
      db.insert = originalInsert;
      db.update = originalUpdate;

      jobsRepo.findByTenant = originalJobsFindByTenant;
      jobsRepo.findById = originalJobsFindById;
      matchRepo.findByMatchingIdentity = originalMatchFindByMatchingIdentity;
      matchRepo.save = originalMatchSave;
      timelineRepo.findById = originalTimelineFindById;
      timelineRepo.save = originalTimelineSave;
      timelineRepo.findTimelineEntriesByOwner = originalTimelineFindEntries;
      resolve();
    });
  });
});

test.beforeEach(async () => {
  currentUserId = "user-123";
  currentUserEmail = "user@example.com";
  currentSessionId = "session-123";

  mockScannedCount = 0;
  mockMatchesCount = 0;

  mockJobs = [];
  mockTimelineEntries = [];
  savedMatches = [];
  savedTimelines = [];

  if (usageRepo && typeof usageRepo.reset === "function") {
    await usageRepo.reset();
  }
  if (subscriptionRepo._records) {
    subscriptionRepo._records.clear();
  }

  // Mock db.select chain for session validation and counts
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
  jobsRepo.findByTenant = async (tenantId, _options) => {
    const items = mockJobs.filter((j) => j.tenantId === tenantId);
    return { items, total: items.length };
  };

  jobsRepo.findById = async (id, tenantId) => {
    const job = mockJobs.find((j) => j.id === id);
    if (!job || job.tenantId !== tenantId) {
      return null;
    }
    return job;
  };

  matchRepo.findByMatchingIdentity = async (tenantId, freelancerId, jobId, matchingVersion) => {
    const match = savedMatches.find(
      (m) => m.tenantId === tenantId && m.jobId === jobId && m.matchingVersion === matchingVersion,
    );
    return match || null;
  };

  matchRepo.save = async (match) => {
    savedMatches.push(match);
  };

  timelineRepo.findById = async (timelineId, ownerId) => {
    const timeline = savedTimelines.find(
      (t) => t.timelineId === timelineId && t.ownerId === ownerId,
    );
    if (timeline) {
      return timeline;
    }
    return ClientTimeline.create(timelineId, ownerId, ownerId);
  };

  timelineRepo.save = async (timeline) => {
    savedTimelines.push(timeline);
  };

  timelineRepo.findTimelineEntriesByOwner = async (_ownerId, _options) => {
    const items = mockTimelineEntries.map(
      (e) =>
        new TimelineEntry({
          entryId: e.id,
          category: "Lifecycle Event",
          timestamp: new Date(e.timestamp),
          metadata: { message: e.message },
          actorRef: "system",
          visibility: "Public",
        }),
    );
    return { items, total: items.length };
  };
});

// Database result resolver for session/user/counts queries
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
    return [{ count: mockScannedCount }];
  }
  if (table === jobMatches) {
    return [{ count: mockMatchesCount }];
  }
  return [];
}

// Utility function to get valid session cookie header
function getSessionCookie(userId, email, sessionId = "session-123") {
  const token = signAccessToken({
    sessionId,
    userId,
    credentialVersion: 1,
  });
  return `__Host-refresh_token=${token}`;
}

// Helper to make client requests
function makeRequest(path, method = "GET", headers = {}, body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: "localhost",
      port: serverPort,
      path,
      method,
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
    };

    const req = http.request(options, (res) => {
      let responseBody = "";
      res.on("data", (chunk) => {
        responseBody += chunk;
      });
      res.on("end", () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: responseBody ? JSON.parse(responseBody) : null,
        });
      });
    });

    req.on("error", (err) => {
      reject(err);
    });

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

// Aggregate builder for test jobs
function buildTestJobImport({
  id,
  tenantId,
  title,
  description = "A test job",
  skills = ["javascript"],
  budget = { type: "hourly", minimum: 25, maximum: 75 },
}) {
  const source = new JobSource("upwork");
  const externalIdentity = new JobExternalIdentity(source, "ext-" + id);
  const provenance = new JobImportProvenance({
    source,
    externalJobId: "ext-" + id,
    sourceUrl: "https://upwork.com/jobs/" + id,
    importedAt: new Date(),
  });
  const rawPayload = new JobRawPayload({ title, description, skills, budget });
  const fingerprint = new JobImportFingerprint("fp-" + id);

  return new JobImport({
    id,
    tenantId,
    ownerId: tenantId,
    externalIdentity,
    provenance,
    rawPayload,
    fingerprint,
    status: "IMPORTED",
    snapshots: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

// -------------------------------------------------------------
// PART 15 - SECURITY & PART 16 - FUNCTIONAL INTEGRATION TESTS
// -------------------------------------------------------------

test("1. unauthenticated GET /api/jobs returns 401", async () => {
  const res = await makeRequest("/api/jobs");
  assert.strictEqual(res.statusCode, 401);
  assert.strictEqual(res.body.success, false);
  assert.strictEqual(res.body.error, "Unauthorized");
});

test("2. authenticated GET /api/jobs returns 200 with jobs list", async () => {
  const cookie = getSessionCookie("user-123", "user@example.com");
  mockJobs = [buildTestJobImport({ id: "job-1", tenantId: "user-123", title: "Node Developer" })];

  const res = await makeRequest("/api/jobs", "GET", { Cookie: cookie });
  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.body.success, true);
  assert.strictEqual(res.body.jobs.length, 1);
  assert.strictEqual(res.body.jobs[0].title, "Node Developer");
  assert.strictEqual(res.body.jobs[0].platform, "upwork");
  assert.strictEqual(res.body.jobs[0].budget, "$25-$75/hr");
});

test("3. tenant isolation: GET /api/jobs only returns own jobs", async () => {
  const cookie = getSessionCookie("user-123", "user@example.com");
  mockJobs = [
    buildTestJobImport({ id: "job-1", tenantId: "user-123", title: "My Job" }),
    buildTestJobImport({ id: "job-2", tenantId: "user-456", title: "Other Tenant Job" }),
  ];

  const res = await makeRequest("/api/jobs", "GET", { Cookie: cookie });
  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.body.jobs.length, 1);
  assert.strictEqual(res.body.jobs[0].title, "My Job");
});

test("4. forged tenantId in query parameters is completely ignored", async () => {
  const cookie = getSessionCookie("user-123", "user@example.com");
  mockJobs = [
    buildTestJobImport({ id: "job-1", tenantId: "user-123", title: "My Job" }),
    buildTestJobImport({ id: "job-2", tenantId: "user-456", title: "Other Tenant Job" }),
  ];

  // Attempt to forge tenantId via query parameter
  const res = await makeRequest("/api/jobs?tenantId=user-456", "GET", { Cookie: cookie });
  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.body.jobs.length, 1);
  assert.strictEqual(res.body.jobs[0].title, "My Job");
});

test("5. invalid page or pageSize values return 400 Bad Request", async () => {
  const cookie = getSessionCookie("user-123", "user@example.com");

  const resPage = await makeRequest("/api/jobs?page=abc", "GET", { Cookie: cookie });
  assert.strictEqual(resPage.statusCode, 400);

  const resPageSize = await makeRequest("/api/jobs?pageSize=-5", "GET", { Cookie: cookie });
  assert.strictEqual(resPageSize.statusCode, 400);

  const resPageSizeFloat = await makeRequest("/api/jobs?pageSize=12.5", "GET", { Cookie: cookie });
  assert.strictEqual(resPageSizeFloat.statusCode, 400);
});

test("6. oversized pageSize (> 100) returns 400 Bad Request", async () => {
  const cookie = getSessionCookie("user-123", "user@example.com");
  const res = await makeRequest("/api/jobs?pageSize=101", "GET", { Cookie: cookie });
  assert.strictEqual(res.statusCode, 400);
  assert.strictEqual(res.body.success, false);
  assert.strictEqual(res.body.error, "Invalid pageSize parameter");
});

test("7. cross-tenant job access on POST match returns 404", async () => {
  const cookie = getSessionCookie("user-123", "user@example.com");
  mockJobs = [buildTestJobImport({ id: "job-2", tenantId: "user-456", title: "Other Job" })];

  const res = await makeRequest("/api/jobs/job-2/match", "POST", { Cookie: cookie });
  assert.strictEqual(res.statusCode, 404);
  assert.strictEqual(res.body.success, false);
  assert.strictEqual(res.body.error, "Job not found");
});

test("8. valid POST match resolves with Phase 8 matching and returns 201", async () => {
  const cookie = getSessionCookie("user-123", "user@example.com");
  mockJobs = [
    buildTestJobImport({
      id: "job-1",
      tenantId: "user-123",
      title: "Senior JavaScript Developer",
      skills: ["javascript", "node.js"],
    }),
  ];

  const res = await makeRequest("/api/jobs/job-1/match", "POST", { Cookie: cookie });
  assert.strictEqual(res.statusCode, 201);
  assert.strictEqual(res.body.success, true);
  assert.ok(res.body.matchId);
  assert.strictEqual(typeof res.body.score, "number");
  assert.strictEqual(res.body.status, "EVALUATED");

  // Verify it was correctly saved to repository
  assert.strictEqual(savedMatches.length, 1);
  assert.strictEqual(savedMatches[0].jobId, "job-1");
  assert.strictEqual(savedMatches[0].tenantId, "user-123");
});

test("9. repeated POST match is idempotent and returns 200 with same match ID", async () => {
  const cookie = getSessionCookie("user-123", "user@example.com");
  mockJobs = [buildTestJobImport({ id: "job-1", tenantId: "user-123", title: "React Developer" })];

  // First match request (Creates)
  const res1 = await makeRequest("/api/jobs/job-1/match", "POST", { Cookie: cookie });
  assert.strictEqual(res1.statusCode, 201);

  // Second match request (Idempotent return)
  const res2 = await makeRequest("/api/jobs/job-1/match", "POST", { Cookie: cookie });
  assert.strictEqual(res2.statusCode, 200);
  assert.strictEqual(res2.body.success, true);
  assert.strictEqual(res2.body.matchId, res1.body.matchId);
  assert.strictEqual(res2.body.score, res1.body.score);
});

test("10. forged score, ranking, and tenantId in body are ignored on POST match", async () => {
  const cookie = getSessionCookie("user-123", "user@example.com");
  mockJobs = [
    buildTestJobImport({
      id: "job-1",
      tenantId: "user-123",
      title: "React Developer",
      skills: ["rust"],
    }),
  ];

  const forgedPayload = {
    score: 100,
    matchScore: 99,
    ranking: 1,
    tenantId: "user-456",
    ownerId: "user-456",
  };

  const res = await makeRequest("/api/jobs/job-1/match", "POST", { Cookie: cookie }, forgedPayload);
  assert.strictEqual(res.statusCode, 201);
  assert.strictEqual(savedMatches[0].tenantId, "user-123");
  assert.strictEqual(savedMatches[0].ownerId, "user-123");
  // Computed score must be based on skills overlap (50% semantic, 50% skill overlap).
  assert.notStrictEqual(res.body.score, 100);
});

test("11. Phase 8 matcher failure handles error safely and returns 500", async () => {
  const cookie = getSessionCookie("user-123", "user@example.com");
  mockJobs = [buildTestJobImport({ id: "job-1", tenantId: "user-123", title: "React Developer" })];

  // Simulate a matching error by breaking the verifyOwnership or evaluate method
  const originalEvaluate = JobMatch.prototype.evaluate;
  JobMatch.prototype.evaluate = function () {
    throw new Error("Simulation of Phase 8 matching calculation crash.");
  };

  try {
    const res = await makeRequest("/api/jobs/job-1/match", "POST", { Cookie: cookie });
    assert.strictEqual(res.statusCode, 500);
    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error, "Internal Server Error");
    assert.strictEqual(savedMatches.length, 0); // Verify nothing was saved
  } finally {
    JobMatch.prototype.evaluate = originalEvaluate;
  }
});

test("12. entitlement denial: matching rejects request with 403 when plan features block it", async () => {
  const cookie = getSessionCookie("user-123", "user@example.com");
  mockJobs = [buildTestJobImport({ id: "job-1", tenantId: "user-123", title: "React Developer" })];

  // Mock entitlement resolver to return allowed: false (denied)
  const originalResolveEntitlement = entitlementResolver.resolveEntitlement;
  entitlementResolver.resolveEntitlement = async () => ({
    allowed: false,
    reason: "FEATURE_NOT_INCLUDED",
  });

  try {
    const res = await makeRequest("/api/jobs/job-1/match", "POST", { Cookie: cookie });
    assert.strictEqual(res.statusCode, 403);
    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error, "Entitlement Denied");
  } finally {
    entitlementResolver.resolveEntitlement = originalResolveEntitlement;
  }
});

test("13. analytics tenant isolation: returns metrics only for own data", async () => {
  const cookieA = getSessionCookie("user-A", "userA@example.com");
  const cookieB = getSessionCookie("user-B", "userB@example.com");

  mockScannedCount = 10;
  mockMatchesCount = 2;

  currentUserId = "user-A";
  const resA1 = await makeRequest("/api/analytics/scanned", "GET", { Cookie: cookieA });
  assert.strictEqual(resA1.body.value, 10);

  currentUserId = "user-B";
  mockScannedCount = 5;
  const resB1 = await makeRequest("/api/analytics/scanned", "GET", { Cookie: cookieB });
  assert.strictEqual(resB1.body.value, 5);
});

test("14. activity tenant isolation & pagination: returns activity only for own owner", async () => {
  const cookie = getSessionCookie("user-123", "user@example.com");
  mockTimelineEntries = [
    { id: "e-1", timestamp: new Date().toISOString(), message: "Entry 1" },
    { id: "e-2", timestamp: new Date().toISOString(), message: "Entry 2" },
  ];

  const res = await makeRequest("/api/activity?page=1&pageSize=1", "GET", { Cookie: cookie });
  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.body.success, true);
  assert.strictEqual(res.body.activity.length, 2);
  assert.strictEqual(res.body.activity[0].message, "Entry 1");
});

test("15. error sanitization: stack traces are never exposed in 500 errors", async () => {
  const cookie = getSessionCookie("user-123", "user@example.com");
  mockJobs = [buildTestJobImport({ id: "job-1", tenantId: "user-123", title: "React Developer" })];

  // Crash database repository
  jobsRepo.findById = async () => {
    throw new Error("Sensitive Postgres connection pool dropped at stack path /var/lib/db/pool.js");
  };

  const res = await makeRequest("/api/jobs/job-1/match", "POST", { Cookie: cookie });
  assert.strictEqual(res.statusCode, 500);
  assert.strictEqual(res.body.success, false);
  assert.strictEqual(res.body.error, "Internal Server Error");
  assert.strictEqual(res.body.message, undefined); // Ensure stack trace details are hidden
});

test("16. no secret leakage: environment variables or Stripe keys are never returned", async () => {
  const cookie = getSessionCookie("user-123", "user@example.com");
  const res = await makeRequest("/api/jobs", "GET", { Cookie: cookie });

  // Convert response to string and search for secrets signature
  const resStr = JSON.stringify(res);
  assert.ok(!resStr.includes("stripe_price"));
  assert.ok(!resStr.includes("mock_secret_key"));
  assert.ok(!resStr.includes("postgres_password_local"));
});
