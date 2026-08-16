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
  clientRepo,
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
  Client,
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
const originalTimelineFindEntriesByClient = timelineRepo.findTimelineEntriesByClientId;
const originalClientList = clientRepo.list;
const originalClientFindById = clientRepo.findById;
const originalClientCreate = clientRepo.create;
const originalClientUpdate = clientRepo.update;

// Test variables to control mocks dynamically
let currentUserId = "user-123";
let currentUserEmail = "user@example.com";
let currentSessionId = "session-123";

let mockScannedCount = 0;
let mockMatchesCount = 0;

let mockJobs = [];
let mockClients = [];
let mockTimelineEntries = [];
let savedMatches = [];
let savedTimelines = [];
let savedClients = [];
let updatedClients = [];

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
      timelineRepo.findTimelineEntriesByClientId = originalTimelineFindEntriesByClient;
      clientRepo.list = originalClientList;
      clientRepo.findById = originalClientFindById;
      clientRepo.create = originalClientCreate;
      clientRepo.update = originalClientUpdate;
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
  mockClients = [];
  mockTimelineEntries = [];
  savedMatches = [];
  savedTimelines = [];
  savedClients = [];
  updatedClients = [];

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

  timelineRepo.findTimelineEntriesByClientId = async (clientId, ownerId, options) => {
    const clientTimeline = savedTimelines.find(
      (timeline) => timeline.clientId === clientId && timeline.ownerId === ownerId,
    );
    if (!clientTimeline) {
      return { timelineId: null, status: null, items: [], total: 0 };
    }
    const entries = clientTimeline.entries.slice().reverse();
    const offset = (options.page - 1) * options.pageSize;
    return {
      timelineId: clientTimeline.timelineId,
      status: clientTimeline.status,
      items: entries.slice(offset, offset + options.pageSize),
      total: entries.length,
    };
  };

  clientRepo.list = async (ownerId, options = {}) => {
    const page = options.page ?? 1;
    const pageSize = options.pageSize ?? 20;
    const filtered = mockClients
      .filter((client) => client.ownerId === ownerId)
      .filter((client) => (options.status ? client.status === options.status : true))
      .sort(
        (a, b) =>
          b.systemMetadata.createdAt.getTime() - a.systemMetadata.createdAt.getTime() ||
          b.id.localeCompare(a.id),
      );
    const offset = (page - 1) * pageSize;
    return {
      items: filtered.slice(offset, offset + pageSize),
      total: filtered.length,
      page,
      pageSize,
    };
  };

  clientRepo.findById = async (id, ownerId) => {
    return mockClients.find((client) => client.id === id && client.ownerId === ownerId) || null;
  };

  clientRepo.create = async (client) => {
    const duplicate = mockClients.find(
      (existing) =>
        existing.ownerId === client.ownerId &&
        existing.primaryContact?.email?.trim().toLowerCase() ===
          client.primaryContact?.email?.trim().toLowerCase(),
    );
    if (duplicate) {
      throw new Error("Duplicate client identity: email already exists for this tenant.");
    }
    savedClients.push(client);
    mockClients.push(client);
  };

  clientRepo.update = async (client, ownerId) => {
    if (client.ownerId !== ownerId) {
      throw new Error("Ownership validation failed.");
    }
    const index = mockClients.findIndex(
      (existing) => existing.id === client.id && existing.ownerId === ownerId,
    );
    if (index === -1) {
      throw new Error("Client not found.");
    }
    updatedClients.push(client);
    mockClients[index] = client;
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
        const contentType = String(res.headers["content-type"] || "");
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body:
            responseBody && contentType.includes("application/json")
              ? JSON.parse(responseBody)
              : responseBody || null,
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

function buildTestClient({
  id,
  ownerId,
  name,
  email = "client@example.com",
  status = "Lead",
  createdAt = new Date("2026-08-16T10:00:00.000Z"),
}) {
  return new Client({
    id,
    ownerId,
    status,
    profile: { name, website: "https://example.com" },
    primaryContact: { firstName: "Casey", lastName: "Client", email },
    systemMetadata: {
      createdAt,
      updatedAt: createdAt,
    },
  });
}

// -------------------------------------------------------------
// PART 15 - SECURITY & PART 16 - FUNCTIONAL INTEGRATION TESTS
// -------------------------------------------------------------

test("client API: unauthenticated list returns 401", async () => {
  const res = await makeRequest("/api/clients");
  assert.strictEqual(res.statusCode, 401);
  assert.strictEqual(res.body.success, false);
  assert.strictEqual(res.body.error, "Unauthorized");
});

test("client API: authenticated list is owner isolated, paginated, and deterministic", async () => {
  const cookie = getSessionCookie("user-123", "user@example.com");
  mockClients = [
    buildTestClient({
      id: "client-a",
      ownerId: "user-123",
      name: "Alpha Client",
      createdAt: new Date("2026-08-14T10:00:00.000Z"),
    }),
    buildTestClient({
      id: "client-b",
      ownerId: "user-123",
      name: "Beta Client",
      createdAt: new Date("2026-08-15T10:00:00.000Z"),
    }),
    buildTestClient({
      id: "client-c",
      ownerId: "user-456",
      name: "Other Owner Client",
      createdAt: new Date("2026-08-16T10:00:00.000Z"),
    }),
  ];

  const res = await makeRequest("/api/clients?page=1&pageSize=1&tenantId=user-456", "GET", {
    Cookie: cookie,
  });

  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.body.success, true);
  assert.strictEqual(res.body.total, 2);
  assert.strictEqual(res.body.page, 1);
  assert.strictEqual(res.body.pageSize, 1);
  assert.strictEqual(res.body.clients.length, 1);
  assert.strictEqual(res.body.clients[0].id, "client-b");
  assert.strictEqual(JSON.stringify(res.body).includes("user-456"), false);
});

test("client API: invalid list query parameters return 400", async () => {
  const cookie = getSessionCookie("user-123", "user@example.com");

  const badPage = await makeRequest("/api/clients?page=0", "GET", { Cookie: cookie });
  assert.strictEqual(badPage.statusCode, 400);

  const badPageSize = await makeRequest("/api/clients?pageSize=101", "GET", { Cookie: cookie });
  assert.strictEqual(badPageSize.statusCode, 400);

  const badStatus = await makeRequest("/api/clients?status=Deleted", "GET", { Cookie: cookie });
  assert.strictEqual(badStatus.statusCode, 400);
});

test("client API: get own client succeeds and cross-owner get returns 404", async () => {
  const cookie = getSessionCookie("user-123", "user@example.com");
  mockClients = [
    buildTestClient({ id: "client-a", ownerId: "user-123", name: "Own Client" }),
    buildTestClient({ id: "client-b", ownerId: "user-456", name: "Other Client" }),
  ];

  const own = await makeRequest("/api/clients/client-a", "GET", { Cookie: cookie });
  assert.strictEqual(own.statusCode, 200);
  assert.strictEqual(own.body.client.name, "Own Client");
  assert.strictEqual(own.body.client.ownerId, undefined);

  const other = await makeRequest("/api/clients/client-b", "GET", { Cookie: cookie });
  assert.strictEqual(other.statusCode, 404);
  assert.strictEqual(other.body.error, "Client not found");
});

test("client API: valid create ignores forged ownership and returns safe DTO", async () => {
  const cookie = getSessionCookie("user-123", "user@example.com");
  const res = await makeRequest(
    "/api/clients",
    "POST",
    { Cookie: cookie },
    {
      ownerId: "user-456",
      tenantId: "user-456",
      name: "New Client",
      email: "new@example.com",
      primaryContact: { firstName: "New", lastName: "Client" },
    },
  );

  assert.strictEqual(res.statusCode, 201);
  assert.strictEqual(savedClients.length, 1);
  assert.strictEqual(savedClients[0].ownerId, "user-123");
  assert.strictEqual(res.body.client.name, "New Client");
  assert.strictEqual(res.body.client.email, "new@example.com");
  assert.strictEqual(res.body.client.ownerId, undefined);
  assert.strictEqual(JSON.stringify(res.body).includes("user-456"), false);
});

test("client API: invalid create, unknown fields, and duplicate identity fail safely", async () => {
  const cookie = getSessionCookie("user-123", "user@example.com");
  mockClients = [
    buildTestClient({
      id: "client-a",
      ownerId: "user-123",
      name: "Existing Client",
      email: "dupe@example.com",
    }),
  ];

  const badEmail = await makeRequest(
    "/api/clients",
    "POST",
    { Cookie: cookie },
    { name: "Bad Client", email: "not-an-email" },
  );
  assert.strictEqual(badEmail.statusCode, 400);

  const unknown = await makeRequest(
    "/api/clients",
    "POST",
    { Cookie: cookie },
    { name: "Bad Client", password: "secret" },
  );
  assert.strictEqual(unknown.statusCode, 400);

  const duplicate = await makeRequest(
    "/api/clients",
    "POST",
    { Cookie: cookie },
    { name: "Duplicate Client", email: "DUPE@example.com" },
  );
  assert.strictEqual(duplicate.statusCode, 409);
  assert.strictEqual(duplicate.body.error, "Client identity already exists");
});

test("client API: valid update is owner scoped and rejects cross-owner update", async () => {
  const cookie = getSessionCookie("user-123", "user@example.com");
  mockClients = [
    buildTestClient({ id: "client-a", ownerId: "user-123", name: "Old Name" }),
    buildTestClient({ id: "client-b", ownerId: "user-456", name: "Other Client" }),
  ];

  const updated = await makeRequest(
    "/api/clients/client-a",
    "PATCH",
    { Cookie: cookie },
    { name: "Updated Name", ownerId: "user-456", tenantId: "user-456" },
  );
  assert.strictEqual(updated.statusCode, 200);
  assert.strictEqual(updated.body.client.name, "Updated Name");
  assert.strictEqual(updatedClients.length, 1);
  assert.strictEqual(updatedClients[0].ownerId, "user-123");

  const other = await makeRequest(
    "/api/clients/client-b",
    "PATCH",
    { Cookie: cookie },
    { name: "Forbidden Update" },
  );
  assert.strictEqual(other.statusCode, 404);
});

test("client API: malformed update and unsafe repository errors are sanitized", async () => {
  const cookie = getSessionCookie("user-123", "user@example.com");
  mockClients = [buildTestClient({ id: "client-a", ownerId: "user-123", name: "Client A" })];

  const badUrl = await makeRequest(
    "/api/clients/client-a",
    "PATCH",
    { Cookie: cookie },
    { website: "ftp://example.com" },
  );
  assert.strictEqual(badUrl.statusCode, 400);

  clientRepo.update = async () => {
    throw new Error("Sensitive SQL failed at /var/lib/postgres/private.js with password=secret");
  };

  const failed = await makeRequest(
    "/api/clients/client-a",
    "PATCH",
    { Cookie: cookie },
    { name: "Still Safe" },
  );
  assert.strictEqual(failed.statusCode, 500);
  assert.strictEqual(failed.body.error, "Internal Server Error");
  assert.strictEqual(JSON.stringify(failed.body).includes("password"), false);
  assert.strictEqual(JSON.stringify(failed.body).includes("/var/lib"), false);
});

test("client API: response schema excludes sensitive fields", async () => {
  const cookie = getSessionCookie("user-123", "user@example.com");
  mockClients = [buildTestClient({ id: "client-a", ownerId: "user-123", name: "Safe Client" })];

  const res = await makeRequest("/api/clients/client-a", "GET", { Cookie: cookie });
  const body = JSON.stringify(res.body);

  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(body.includes("password"), false);
  assert.strictEqual(body.includes("accessToken"), false);
  assert.strictEqual(body.includes("refreshToken"), false);
  assert.strictEqual(body.includes("session"), false);
  assert.strictEqual(body.includes("stripe"), false);
});

test("client detail route: authenticated static route serves Client Detail shell", async () => {
  const cookie = getSessionCookie("user-123", "user@example.com");
  const res = await makeRequest("/clients/client-a", "GET", { Cookie: cookie });

  assert.strictEqual(res.statusCode, 200);
  assert.ok(String(res.headers["content-type"]).includes("text/html"));
  assert.ok(res.body.includes("Client Detail"));
  assert.ok(res.body.includes("/client-detail.js"));
});

test("client timeline API: unauthenticated access returns 401", async () => {
  const res = await makeRequest("/api/clients/client-a/timeline");
  assert.strictEqual(res.statusCode, 401);
  assert.strictEqual(res.body.success, false);
});

test("client timeline API: cross-owner access returns safe not-found", async () => {
  const cookie = getSessionCookie("user-123", "user@example.com");
  mockClients = [buildTestClient({ id: "client-b", ownerId: "user-456", name: "Other Client" })];

  const res = await makeRequest("/api/clients/client-b/timeline", "GET", { Cookie: cookie });

  assert.strictEqual(res.statusCode, 404);
  assert.strictEqual(res.body.error, "Client not found");
});

test("client timeline API: 403 repository authorization failure is safe", async () => {
  const cookie = getSessionCookie("user-123", "user@example.com");
  const originalFind = clientRepo.findById;
  const forbidden = new Error("Forbidden");
  forbidden.statusCode = 403;
  clientRepo.findById = async () => {
    throw forbidden;
  };

  try {
    const res = await makeRequest("/api/clients/client-a/timeline", "GET", { Cookie: cookie });
    assert.strictEqual(res.statusCode, 403);
    assert.strictEqual(res.body.error, "Forbidden");
  } finally {
    clientRepo.findById = originalFind;
  }
});

test("client timeline API: empty timeline returns bounded empty page without fabricated events", async () => {
  const cookie = getSessionCookie("user-123", "user@example.com");
  mockClients = [buildTestClient({ id: "client-a", ownerId: "user-123", name: "Own Client" })];

  const res = await makeRequest("/api/clients/client-a/timeline?page=1&pageSize=20", "GET", {
    Cookie: cookie,
  });

  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.body.success, true);
  assert.strictEqual(res.body.timeline.clientId, "client-a");
  assert.deepStrictEqual(res.body.timeline.entries, []);
  assert.strictEqual(res.body.timeline.total, 0);
  assert.strictEqual(JSON.stringify(res.body).includes("Client created"), false);
});

test("client timeline API: populated timeline is owner scoped, bounded, and deterministically ordered", async () => {
  const cookie = getSessionCookie("user-123", "user@example.com");
  mockClients = [buildTestClient({ id: "client-a", ownerId: "user-123", name: "Own Client" })];
  const timeline = ClientTimeline.create("timeline-a", "client-a", "user-123");
  timeline.appendEntry("user-123", "user-123", {
    entryId: "entry-old",
    category: "Lifecycle Event",
    timestamp: new Date("2026-08-14T10:00:00.000Z"),
    metadata: { message: "Older event" },
    visibility: "Public",
  });
  timeline.appendEntry("user-123", "user-123", {
    entryId: "entry-new",
    category: "Status Event",
    timestamp: new Date("2026-08-15T10:00:00.000Z"),
    metadata: { message: "Newer event" },
    visibility: "Internal",
  });
  savedTimelines = [timeline];

  const res = await makeRequest("/api/clients/client-a/timeline?page=1&pageSize=1", "GET", {
    Cookie: cookie,
  });

  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.body.timeline.id, "timeline-a");
  assert.strictEqual(res.body.timeline.total, 2);
  assert.strictEqual(res.body.timeline.pageSize, 1);
  assert.strictEqual(res.body.timeline.entries.length, 1);
  assert.strictEqual(res.body.timeline.entries[0].id, "entry-new");
  assert.strictEqual(res.body.timeline.entries[0].message, "Newer event");
  assert.strictEqual(res.body.timeline.entries[0].actorRef, undefined);
  assert.strictEqual(res.body.timeline.entries[0].metadata, undefined);
});

test("client timeline API: invalid pagination and sensitive metadata messages are sanitized", async () => {
  const cookie = getSessionCookie("user-123", "user@example.com");
  mockClients = [buildTestClient({ id: "client-a", ownerId: "user-123", name: "Own Client" })];

  const invalid = await makeRequest("/api/clients/client-a/timeline?pageSize=101", "GET", {
    Cookie: cookie,
  });
  assert.strictEqual(invalid.statusCode, 400);

  const timeline = ClientTimeline.create("timeline-safe", "client-a", "user-123");
  timeline.appendEntry("user-123", "user-123", {
    entryId: "entry-sensitive",
    category: "Audit Event",
    timestamp: new Date("2026-08-14T10:00:00.000Z"),
    metadata: { message: "password=secret stack trace with raw SQL" },
    visibility: "Internal",
  });
  savedTimelines = [timeline];

  const res = await makeRequest("/api/clients/client-a/timeline", "GET", { Cookie: cookie });
  const body = JSON.stringify(res.body);
  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.body.timeline.entries[0].message, "Timeline event recorded");
  assert.strictEqual(body.includes("password"), false);
  assert.strictEqual(body.includes("secret"), false);
  assert.strictEqual(body.includes("SQL"), false);
});

test("client live integration: list, detail, timeline, jobs, and update stay tenant isolated", async () => {
  const cookieA = getSessionCookie("user-A", "a@example.com", "session-A");
  const cookieB = getSessionCookie("user-B", "b@example.com", "session-B");
  const clientA = buildTestClient({ id: "client-a", ownerId: "user-A", name: "Tenant A Client" });
  const clientB = buildTestClient({ id: "client-b", ownerId: "user-B", name: "Tenant B Client" });
  mockClients = [clientA, clientB];
  mockJobs = [
    buildTestJobImport({ id: "job-a", tenantId: "user-A", title: "Tenant A Job" }),
    buildTestJobImport({ id: "job-b", tenantId: "user-B", title: "Tenant B Job" }),
  ];

  const timelineA = ClientTimeline.create("timeline-a", "client-a", "user-A");
  timelineA.appendEntry("user-A", "user-A", {
    entryId: "entry-a",
    category: "Lifecycle Event",
    timestamp: new Date("2026-08-14T10:00:00.000Z"),
    metadata: { message: "Tenant A event" },
    visibility: "Internal",
  });
  const timelineB = ClientTimeline.create("timeline-b", "client-b", "user-B");
  timelineB.appendEntry("user-B", "user-B", {
    entryId: "entry-b",
    category: "Lifecycle Event",
    timestamp: new Date("2026-08-14T10:00:00.000Z"),
    metadata: { message: "Tenant B event" },
    visibility: "Internal",
  });
  savedTimelines = [timelineA, timelineB];

  currentUserId = "user-A";
  currentUserEmail = "a@example.com";
  currentSessionId = "session-A";

  const listA = await makeRequest("/api/clients", "GET", { Cookie: cookieA });
  assert.strictEqual(listA.statusCode, 200);
  assert.deepStrictEqual(
    listA.body.clients.map((client) => client.id),
    ["client-a"],
  );
  assert.strictEqual(JSON.stringify(listA.body).includes("client-b"), false);

  const detailA = await makeRequest("/api/clients/client-a", "GET", { Cookie: cookieA });
  assert.strictEqual(detailA.statusCode, 200);
  assert.strictEqual(detailA.body.client.name, "Tenant A Client");

  const detailBFromA = await makeRequest("/api/clients/client-b", "GET", { Cookie: cookieA });
  assert.strictEqual(detailBFromA.statusCode, 404);

  const timelineARes = await makeRequest("/api/clients/client-a/timeline", "GET", {
    Cookie: cookieA,
  });
  assert.strictEqual(timelineARes.statusCode, 200);
  assert.strictEqual(timelineARes.body.timeline.id, "timeline-a");
  assert.strictEqual(timelineARes.body.timeline.entries[0].message, "Tenant A event");
  assert.strictEqual(JSON.stringify(timelineARes.body).includes("Tenant B event"), false);

  const timelineBFromA = await makeRequest("/api/clients/client-b/timeline", "GET", {
    Cookie: cookieA,
  });
  assert.strictEqual(timelineBFromA.statusCode, 404);

  const updateBFromA = await makeRequest(
    "/api/clients/client-b",
    "PATCH",
    { Cookie: cookieA },
    { name: "Cross Tenant Edit" },
  );
  assert.strictEqual(updateBFromA.statusCode, 404);

  const jobsA = await makeRequest("/api/jobs", "GET", { Cookie: cookieA });
  assert.strictEqual(jobsA.statusCode, 200);
  assert.deepStrictEqual(
    jobsA.body.jobs.map((job) => job.title),
    ["Tenant A Job"],
  );
  assert.strictEqual(JSON.stringify(jobsA.body).includes("Tenant B Job"), false);

  currentUserId = "user-B";
  currentUserEmail = "b@example.com";
  currentSessionId = "session-B";

  const listB = await makeRequest("/api/clients", "GET", { Cookie: cookieB });
  assert.strictEqual(listB.statusCode, 200);
  assert.deepStrictEqual(
    listB.body.clients.map((client) => client.id),
    ["client-b"],
  );

  const detailAFromB = await makeRequest("/api/clients/client-a", "GET", { Cookie: cookieB });
  assert.strictEqual(detailAFromB.statusCode, 404);

  const timelineBRes = await makeRequest("/api/clients/client-b/timeline", "GET", {
    Cookie: cookieB,
  });
  assert.strictEqual(timelineBRes.statusCode, 200);
  assert.strictEqual(timelineBRes.body.timeline.id, "timeline-b");
  assert.strictEqual(timelineBRes.body.timeline.entries[0].message, "Tenant B event");
});

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
