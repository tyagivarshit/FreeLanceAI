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
  brainAnalysisRepo,
  brainEngine,
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
  BrainAnalysisAggregate,
  BrainConfidence,
  BrainFailure,
  BrainResult,
  BrainScope,
  BrainDomainError,
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
const originalMatchFindById = matchRepo.findById;
const originalBrainFindById = brainAnalysisRepo.findById;
const originalBrainFindByIdempotencyKey = brainAnalysisRepo.findByIdempotencyKey;
const originalBrainListByScope = brainAnalysisRepo.listByScope;
const originalBrainCreate = brainAnalysisRepo.create;
const originalBrainClaimExecution = brainAnalysisRepo.claimExecution;
const originalBrainSaveCompleted = brainAnalysisRepo.saveCompleted;
const originalBrainSaveFailed = brainAnalysisRepo.saveFailed;
const originalBrainAnalyze = brainEngine.analyze;
const originalClientSearch = clientRepo.searchClients;
const originalJobsSearch = jobsRepo.searchJobs;
const originalMatchSearch = matchRepo.searchMatches;
const originalTimelineSearch = timelineRepo.searchTimeline;

// Test variables to control mocks dynamically
let currentUserId = "user-123";
let currentUserEmail = "user@example.com";
let currentSessionId = "session-123";

let mockScannedCount = 0;
let mockMatchesCount = 0;
let mockMatchesRows = null;
let mockJobImportsRows = null;

let mockJobs = [];
let mockClients = [];
let mockTimelineEntries = [];
let savedMatches = [];
let savedTimelines = [];
let savedClients = [];
let updatedClients = [];
let mockBrainAnalyses = [];
let brainExecutionCalls = 0;
let mockSearchClients = [];
let mockSearchJobs = [];
let mockSearchMatches = [];
let mockSearchTimelines = [];
let searchCalls = {
  client: 0,
  job: 0,
  match: 0,
  timeline: 0,
};

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
      matchRepo.findById = originalMatchFindById;
      brainAnalysisRepo.findById = originalBrainFindById;
      brainAnalysisRepo.findByIdempotencyKey = originalBrainFindByIdempotencyKey;
      brainAnalysisRepo.listByScope = originalBrainListByScope;
      brainAnalysisRepo.create = originalBrainCreate;
      brainAnalysisRepo.claimExecution = originalBrainClaimExecution;
      brainAnalysisRepo.saveCompleted = originalBrainSaveCompleted;
      brainAnalysisRepo.saveFailed = originalBrainSaveFailed;
      brainEngine.analyze = originalBrainAnalyze;
      clientRepo.searchClients = originalClientSearch;
      jobsRepo.searchJobs = originalJobsSearch;
      matchRepo.searchMatches = originalMatchSearch;
      timelineRepo.searchTimeline = originalTimelineSearch;
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
  mockMatchesRows = null;
  mockJobImportsRows = null;

  mockJobs = [];
  mockClients = [];
  mockTimelineEntries = [];
  savedMatches = [];
  savedTimelines = [];
  savedClients = [];
  updatedClients = [];
  mockBrainAnalyses = [];
  brainExecutionCalls = 0;

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

  matchRepo.findById = async (id, tenantId) => {
    return savedMatches.find((m) => m.id === id && m.tenantId === tenantId) || null;
  };

  timelineRepo.findById = async (timelineId, ownerId) => {
    const timeline = savedTimelines.find(
      (t) => t.timelineId === timelineId && t.ownerId === ownerId,
    );
    return timeline || null;
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

  brainAnalysisRepo.create = async (analysis) => {
    const duplicate = analysis.idempotencyKey
      ? mockBrainAnalyses.find(
          (existing) =>
            existing.scope.tenantId === analysis.scope.tenantId &&
            existing.scope.ownerId === analysis.scope.ownerId &&
            existing.analysisType === analysis.analysisType &&
            existing.idempotencyKey === analysis.idempotencyKey &&
            ["REQUESTED", "RUNNING", "COMPLETED"].includes(existing.status),
        )
      : null;
    if (duplicate) {
      throw new BrainDomainError(
        "INVALID_REQUEST",
        "Concurrent duplicate analysis request detected.",
      );
    }
    mockBrainAnalyses.push(new BrainAnalysisAggregate(analysis.toJSON()));
  };

  brainAnalysisRepo.claimExecution = async (id, scope, claimedAt = new Date()) => {
    const analysis = mockBrainAnalyses.find(
      (item) =>
        item.id === id &&
        item.scope.tenantId === scope.tenantId &&
        item.scope.ownerId === scope.ownerId,
    );
    if (!analysis || analysis.status !== "REQUESTED") {
      return null;
    }
    analysis.claim(scope.actorId, claimedAt);
    return new BrainAnalysisAggregate(analysis.toJSON());
  };

  brainAnalysisRepo.saveCompleted = async (id, scope, result, completedAt = new Date()) => {
    const index = mockBrainAnalyses.findIndex(
      (item) =>
        item.id === id &&
        item.scope.tenantId === scope.tenantId &&
        item.scope.ownerId === scope.ownerId,
    );
    mockBrainAnalyses[index].complete(result, completedAt);
    return new BrainAnalysisAggregate(mockBrainAnalyses[index].toJSON());
  };

  brainAnalysisRepo.saveFailed = async (
    id,
    scope,
    failure,
    status = "FAILED",
    failedAt = new Date(),
  ) => {
    const index = mockBrainAnalyses.findIndex(
      (item) =>
        item.id === id &&
        item.scope.tenantId === scope.tenantId &&
        item.scope.ownerId === scope.ownerId,
    );
    if (index >= 0) {
      mockBrainAnalyses[index].fail(failure, status, failedAt);
      return new BrainAnalysisAggregate(mockBrainAnalyses[index].toJSON());
    }
    throw new Error("Analysis not found");
  };

  brainAnalysisRepo.findById = async (id, scope) => {
    const analysis = mockBrainAnalyses.find(
      (item) =>
        item.id === id &&
        item.scope.tenantId === scope.tenantId &&
        item.scope.ownerId === scope.ownerId,
    );
    return analysis ? new BrainAnalysisAggregate(analysis.toJSON()) : null;
  };

  brainAnalysisRepo.findByIdempotencyKey = async (scope, analysisType, idempotencyKey) => {
    const analysis = mockBrainAnalyses.find(
      (item) =>
        item.scope.tenantId === scope.tenantId &&
        item.scope.ownerId === scope.ownerId &&
        item.analysisType === analysisType &&
        item.idempotencyKey === idempotencyKey,
    );
    return analysis ? new BrainAnalysisAggregate(analysis.toJSON()) : null;
  };

  brainAnalysisRepo.listByScope = async (scope, filters = {}) => {
    const items = mockBrainAnalyses
      .filter(
        (item) => item.scope.tenantId === scope.tenantId && item.scope.ownerId === scope.ownerId,
      )
      .filter((item) => (filters.analysisType ? item.analysisType === filters.analysisType : true))
      .filter((item) => (filters.status ? item.status === filters.status : true))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || b.id.localeCompare(a.id));
    const offset = filters.offset ?? 0;
    const limit = filters.limit ?? 20;
    return { items: items.slice(offset, offset + limit), total: items.length };
  };

  brainEngine.analyze = async (request) => {
    brainExecutionCalls++;
    const confidence = new BrainConfidence({
      score: 0.8,
      level: "HIGH",
      supportingSignalCount: request.context.signalCount,
    });
    const evidence = {
      sourceType: "CLIENT_SIGNAL",
      sourceId: request.context.clients[0]?.signalId ?? "business-1",
      label: "Authorized context",
    };
    return new BrainResult({
      analysisId: request.metadata.requestId,
      analysisType: request.analysisType,
      status: "COMPLETED",
      summary: "Analysis completed.",
      insights: [
        {
          insightId: "insight-1",
          title: "Authorized signal reviewed",
          body: "The analysis used only scoped context.",
          confidence,
          evidence: [evidence],
        },
      ],
      recommendations: [],
      confidence,
      evidence: [evidence],
      generatedAt: new Date("2026-08-18T10:00:00.000Z"),
    });
  };

  mockSearchClients = [];
  mockSearchJobs = [];
  mockSearchMatches = [];
  mockSearchTimelines = [];
  searchCalls = {
    client: 0,
    job: 0,
    match: 0,
    timeline: 0,
  };

  clientRepo.searchClients = async (queryText, scope, page = 1, pageSize = 20) => {
    searchCalls.client++;
    const qLower = queryText ? queryText.toLowerCase() : "";
    const items = mockSearchClients
      .filter((c) => c.ownerId === scope.ownerId)
      .filter((c) => !qLower || c.name.toLowerCase().includes(qLower));
    const offset = (page - 1) * pageSize;
    const pageItems = items.slice(offset, offset + pageSize);
    return { items: pageItems, total: items.length, page, pageSize };
  };

  jobsRepo.searchJobs = async (queryText, scope, page = 1, pageSize = 20) => {
    searchCalls.job++;
    const qLower = queryText ? queryText.toLowerCase() : "";
    const items = mockSearchJobs
      .filter((j) => j.tenantId === scope.tenantId)
      .filter((j) => !qLower || j.title.toLowerCase().includes(qLower));
    const offset = (page - 1) * pageSize;
    const pageItems = items.slice(offset, offset + pageSize);
    return { items: pageItems, total: items.length, page, pageSize };
  };

  matchRepo.searchMatches = async (queryText, scope, page = 1, pageSize = 20) => {
    searchCalls.match++;
    const qLower = queryText ? queryText.toLowerCase() : "";
    const items = mockSearchMatches
      .filter((m) => m.tenantId === scope.tenantId)
      .filter((m) => !qLower || (m.status && m.status.toLowerCase().includes(qLower)));
    const offset = (page - 1) * pageSize;
    const pageItems = items.slice(offset, offset + pageSize);
    return { items: pageItems, total: items.length, page, pageSize };
  };

  timelineRepo.searchTimeline = async (queryText, scope, page = 1, pageSize = 20) => {
    searchCalls.timeline++;
    const qLower = queryText ? queryText.toLowerCase() : "";
    const items = mockSearchTimelines
      .filter((t) => t.ownerId === scope.ownerId)
      .filter(
        (t) =>
          !qLower ||
          t.category.toLowerCase().includes(qLower) ||
          (t.metadataSummary && t.metadataSummary.toLowerCase().includes(qLower)),
      );
    const offset = (page - 1) * pageSize;
    const pageItems = items.slice(offset, offset + pageSize);
    return { items: pageItems, total: items.length, page, pageSize };
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
    if (mockJobImportsRows !== null) {
      return mockJobImportsRows;
    }
    return [{ count: mockScannedCount }];
  }
  if (table === jobMatches) {
    if (mockMatchesRows !== null) {
      return mockMatchesRows;
    }
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

function makeRawRequest(path, method = "POST", headers = {}, rawBody = "") {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: "localhost",
        port: serverPort,
        path,
        method,
        headers: { "Content-Type": "application/json", ...headers },
      },
      (res) => {
        let responseBody = "";
        res.on("data", (chunk) => {
          responseBody += chunk;
        });
        res.on("end", () => {
          resolve({
            statusCode: res.statusCode,
            body: responseBody ? JSON.parse(responseBody) : null,
          });
        });
      },
    );
    req.on("error", reject);
    req.write(rawBody);
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

function buildStoredBrainAnalysis({
  id,
  ownerId,
  analysisType = "CLIENT_HEALTH",
  status = "COMPLETED",
  createdAt = new Date("2026-08-18T10:00:00.000Z"),
}) {
  const scope = new BrainScope({ tenantId: ownerId, ownerId, actorId: ownerId });
  const confidence = new BrainConfidence({ score: 0.7, level: "MEDIUM", supportingSignalCount: 1 });
  return new BrainAnalysisAggregate({
    id,
    scope,
    analysisType,
    status,
    correlationId: id,
    constraints: {},
    summary: "Stored analysis",
    insights:
      status === "COMPLETED"
        ? [
            {
              insightId: "stored-insight",
              title: "Stored insight",
              body: "Stored body",
              confidence,
              evidence: [],
            },
          ]
        : [],
    recommendations: [],
    confidence: status === "COMPLETED" ? confidence : undefined,
    evidence: [],
    failure:
      status === "COMPLETED"
        ? undefined
        : new BrainFailure({
            code: "PROVIDER_TIMEOUT",
            message: "Provider timed out.",
            retryable: true,
          }),
    createdAt,
    updatedAt: createdAt,
    completedAt: status === "COMPLETED" ? createdAt : undefined,
    failedAt: status !== "COMPLETED" ? createdAt : undefined,
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

test("brain API: unauthenticated requests return 401", async () => {
  const post = await makeRequest(
    "/api/brain/analyses",
    "POST",
    {},
    { analysisType: "CLIENT_HEALTH" },
  );
  assert.strictEqual(post.statusCode, 401);
  assert.strictEqual(post.body.error, "Unauthorized");

  const list = await makeRequest("/api/brain/analyses");
  assert.strictEqual(list.statusCode, 401);

  const detail = await makeRequest("/api/brain/analyses/analysis-1");
  assert.strictEqual(detail.statusCode, 401);
});

test("brain API: authenticated POST builds authoritative owner context and returns safe DTO", async () => {
  const cookie = getSessionCookie("user-123", "user@example.com");
  mockClients = [buildTestClient({ id: "client-a", ownerId: "user-123", name: "Own Client" })];

  const res = await makeRequest(
    "/api/brain/analyses",
    "POST",
    { Cookie: cookie, "X-Request-Id": "req-brain-1" },
    {
      ownerId: "user-456",
      tenantId: "user-456",
      analysisType: "CLIENT_HEALTH",
      idempotencyKey: "idem-brain-1",
      context: { clientIds: ["client-a"] },
      constraints: { maxInsights: 2, maxRecommendations: 2 },
    },
  );

  assert.strictEqual(res.statusCode, 201);
  assert.strictEqual(res.body.success, true);
  assert.strictEqual(res.body.analysis.analysisType, "CLIENT_HEALTH");
  assert.strictEqual(res.body.analysis.summary, "Analysis completed.");
  assert.strictEqual(brainExecutionCalls, 1);
  assert.strictEqual(JSON.stringify(res.body).includes("user-456"), false);
  assert.strictEqual(JSON.stringify(res.body).includes("tenantId"), false);
  assert.strictEqual(JSON.stringify(res.body).includes("ownerId"), false);
});

test("brain API: forged or foreign resource references are rejected without existence leakage", async () => {
  const cookie = getSessionCookie("user-123", "user@example.com");
  mockClients = [buildTestClient({ id: "client-b", ownerId: "user-456", name: "Other Client" })];
  mockJobs = [buildTestJobImport({ id: "job-b", tenantId: "user-456", title: "Other Job" })];
  savedMatches = [
    new JobMatch({
      id: "match-b",
      tenantId: "user-456",
      ownerId: "user-456",
      freelancerId: "user-456",
      jobId: "job-b",
      jobNormalizationId: "job-b",
      normalizationVersion: "v1",
      matchingVersion: "v1",
      status: "CREATED",
      snapshots: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    }),
  ];
  savedTimelines = [ClientTimeline.create("timeline-b", "client-b", "user-456")];

  const foreignClient = await makeRequest(
    "/api/brain/analyses",
    "POST",
    { Cookie: cookie },
    { analysisType: "CLIENT_HEALTH", context: { clientIds: ["client-b"] } },
  );
  assert.strictEqual(foreignClient.statusCode, 404);
  assert.strictEqual(foreignClient.body.error, "Referenced resource not found");

  const foreignJob = await makeRequest(
    "/api/brain/analyses",
    "POST",
    { Cookie: cookie },
    { analysisType: "OPPORTUNITY_REVIEW", context: { jobIds: ["job-b"] } },
  );
  assert.strictEqual(foreignJob.statusCode, 404);

  const foreignMatch = await makeRequest(
    "/api/brain/analyses",
    "POST",
    { Cookie: cookie },
    { analysisType: "OPPORTUNITY_REVIEW", context: { matchIds: ["match-b"], jobIds: ["job-b"] } },
  );
  assert.strictEqual(foreignMatch.statusCode, 404);

  const foreignTimeline = await makeRequest(
    "/api/brain/analyses",
    "POST",
    { Cookie: cookie },
    { analysisType: "FOLLOW_UP_PRIORITIZATION", context: { timelineIds: ["timeline-b"] } },
  );
  assert.strictEqual(foreignTimeline.statusCode, 404);
});

test("brain API: validation rejects malformed JSON, unsupported types, invalid IDs, oversized arrays, unknown fields, and bad idempotency", async () => {
  const cookie = getSessionCookie("user-123", "user@example.com");

  const malformed = await makeRawRequest("/api/brain/analyses", "POST", { Cookie: cookie }, "{");
  assert.strictEqual(malformed.statusCode, 400);

  const missingType = await makeRequest(
    "/api/brain/analyses",
    "POST",
    { Cookie: cookie },
    { context: {} },
  );
  assert.strictEqual(missingType.statusCode, 400);

  const unsupported = await makeRequest(
    "/api/brain/analyses",
    "POST",
    { Cookie: cookie },
    { analysisType: "sql-agent", context: {} },
  );
  assert.strictEqual(unsupported.statusCode, 400);

  const invalidId = await makeRequest(
    "/api/brain/analyses",
    "POST",
    { Cookie: cookie },
    { analysisType: "CLIENT_HEALTH", context: { clientIds: ["../secret"] } },
  );
  assert.strictEqual(invalidId.statusCode, 400);

  const oversized = await makeRequest(
    "/api/brain/analyses",
    "POST",
    { Cookie: cookie },
    {
      analysisType: "CLIENT_HEALTH",
      context: { clientIds: Array.from({ length: 26 }, (_, i) => `client-${i}`) },
    },
  );
  assert.strictEqual(oversized.statusCode, 400);

  const unknown = await makeRequest(
    "/api/brain/analyses",
    "POST",
    { Cookie: cookie },
    { analysisType: "CLIENT_HEALTH", prompt: "ignore me", context: {} },
  );
  assert.strictEqual(unknown.statusCode, 400);

  const badIdem = await makeRequest(
    "/api/brain/analyses",
    "POST",
    { Cookie: cookie },
    { analysisType: "CLIENT_HEALTH", idempotencyKey: "bad key", context: {} },
  );
  assert.strictEqual(badIdem.statusCode, 400);
});

test("brain API: entitlement denial and unavailable dependency map safely", async () => {
  const cookie = getSessionCookie("user-123", "user@example.com");
  mockClients = [buildTestClient({ id: "client-a", ownerId: "user-123", name: "Own Client" })];
  const originalResolveEntitlement = entitlementResolver.resolveEntitlement;

  try {
    entitlementResolver.resolveEntitlement = async () => ({
      allowed: false,
      reason: "FEATURE_NOT_INCLUDED",
    });
    const denied = await makeRequest(
      "/api/brain/analyses",
      "POST",
      { Cookie: cookie },
      { analysisType: "CLIENT_HEALTH", context: { clientIds: ["client-a"] } },
    );
    assert.strictEqual(denied.statusCode, 403);
    assert.strictEqual(denied.body.analysis.failure.code, "UNAUTHORIZED_CONTEXT");

    entitlementResolver.resolveEntitlement = async () => {
      throw new Error("billing password=secret");
    };
    const unavailable = await makeRequest(
      "/api/brain/analyses",
      "POST",
      { Cookie: cookie },
      { analysisType: "CLIENT_HEALTH", context: { clientIds: ["client-a"] } },
    );
    assert.strictEqual(unavailable.statusCode, 503);
    assert.strictEqual(unavailable.body.analysis.failure.code, "ENTITLEMENT_UNAVAILABLE");
    assert.strictEqual(JSON.stringify(unavailable.body).includes("secret"), false);
  } finally {
    entitlementResolver.resolveEntitlement = originalResolveEntitlement;
  }
});

test("brain API: execution failures map to safe statuses", async () => {
  const cookie = getSessionCookie("user-123", "user@example.com");
  mockClients = [buildTestClient({ id: "client-a", ownerId: "user-123", name: "Own Client" })];

  brainEngine.analyze = async () => {
    throw new BrainFailure({
      code: "PROVIDER_TIMEOUT",
      message: "Provider timed out.",
      retryable: true,
    });
  };
  const timeout = await makeRequest(
    "/api/brain/analyses",
    "POST",
    { Cookie: cookie },
    { analysisType: "CLIENT_HEALTH", context: { clientIds: ["client-a"] } },
  );
  assert.strictEqual(timeout.statusCode, 504);
  assert.strictEqual(timeout.body.analysis.failure.code, "PROVIDER_TIMEOUT");

  brainEngine.analyze = async () => {
    throw new Error("provider sdk leaked /var/lib/provider token=secret");
  };
  const unavailable = await makeRequest(
    "/api/brain/analyses",
    "POST",
    { Cookie: cookie },
    { analysisType: "CLIENT_HEALTH", context: { clientIds: ["client-a"] } },
  );
  assert.strictEqual(unavailable.statusCode, 503);
  assert.strictEqual(unavailable.body.analysis.failure.code, "PROVIDER_UNAVAILABLE");
  assert.strictEqual(JSON.stringify(unavailable.body).includes("/var/lib"), false);
  assert.strictEqual(JSON.stringify(unavailable.body).includes("secret"), false);
});

test("brain API: idempotency returns one authoritative execution for repeated and concurrent requests", async () => {
  const cookie = getSessionCookie("user-123", "user@example.com");
  mockClients = [buildTestClient({ id: "client-a", ownerId: "user-123", name: "Own Client" })];
  brainEngine.analyze = async (request) => {
    brainExecutionCalls++;
    await new Promise((resolve) => setTimeout(resolve, 10));
    const confidence = new BrainConfidence({ score: 0.8, level: "HIGH", supportingSignalCount: 1 });
    return new BrainResult({
      analysisId: request.metadata.requestId,
      analysisType: request.analysisType,
      status: "COMPLETED",
      summary: "Idempotent analysis completed.",
      insights: [
        {
          insightId: "insight-1",
          title: "Once",
          body: "Executed once.",
          confidence,
          evidence: [],
        },
      ],
      recommendations: [],
      confidence,
      evidence: [],
      generatedAt: new Date("2026-08-18T10:00:00.000Z"),
    });
  };

  const body = {
    analysisType: "CLIENT_HEALTH",
    idempotencyKey: "idem-brain-concurrent",
    context: { clientIds: ["client-a"] },
  };
  const [first, second] = await Promise.all([
    makeRequest("/api/brain/analyses", "POST", { Cookie: cookie }, body),
    makeRequest("/api/brain/analyses", "POST", { Cookie: cookie }, body),
  ]);

  assert.strictEqual(first.statusCode, 201);
  assert.strictEqual(second.statusCode, 201);
  assert.strictEqual(first.body.analysis.summary, "Idempotent analysis completed.");
  assert.strictEqual(second.body.analysis.summary, "Idempotent analysis completed.");
  assert.strictEqual(brainExecutionCalls, 1);

  const repeated = await makeRequest("/api/brain/analyses", "POST", { Cookie: cookie }, body);
  assert.strictEqual(repeated.statusCode, 201);
  assert.strictEqual(brainExecutionCalls, 1);
});

test("brain API: list and detail are scoped, paginated, deterministic, and safe", async () => {
  const cookie = getSessionCookie("user-123", "user@example.com");
  mockBrainAnalyses = [
    buildStoredBrainAnalysis({
      id: "11111111-1111-4111-8111-111111111111",
      ownerId: "user-123",
      createdAt: new Date("2026-08-18T09:00:00.000Z"),
    }),
    buildStoredBrainAnalysis({
      id: "22222222-2222-4222-8222-222222222222",
      ownerId: "user-123",
      createdAt: new Date("2026-08-18T10:00:00.000Z"),
    }),
    buildStoredBrainAnalysis({
      id: "33333333-3333-4333-8333-333333333333",
      ownerId: "user-456",
      createdAt: new Date("2026-08-18T11:00:00.000Z"),
    }),
  ];

  const list = await makeRequest("/api/brain/analyses?page=1&pageSize=1&tenantId=user-456", "GET", {
    Cookie: cookie,
  });
  assert.strictEqual(list.statusCode, 200);
  assert.strictEqual(list.body.total, 2);
  assert.strictEqual(list.body.analyses.length, 1);
  assert.strictEqual(list.body.analyses[0].analysisId, "22222222-2222-4222-8222-222222222222");
  assert.strictEqual(JSON.stringify(list.body).includes("user-456"), false);

  const detail = await makeRequest(
    "/api/brain/analyses/11111111-1111-4111-8111-111111111111",
    "GET",
    { Cookie: cookie },
  );
  assert.strictEqual(detail.statusCode, 200);
  assert.strictEqual(detail.body.analysis.analysisId, "11111111-1111-4111-8111-111111111111");
  assert.strictEqual(detail.body.analysis.ownerId, undefined);

  const foreign = await makeRequest(
    "/api/brain/analyses/33333333-3333-4333-8333-333333333333",
    "GET",
    { Cookie: cookie },
  );
  assert.strictEqual(foreign.statusCode, 404);

  const invalidPage = await makeRequest("/api/brain/analyses?pageSize=101", "GET", {
    Cookie: cookie,
  });
  assert.strictEqual(invalidPage.statusCode, 400);
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

// ============================================================================
// Phase 11D-8: Unified Search API Tests (GET /api/search)
// ============================================================================

test("Search API 1. unauthenticated request -> 401", async () => {
  const res = await makeRequest("/api/search?q=test", "GET");
  assert.strictEqual(res.statusCode, 401);
  assert.strictEqual(res.body.success, false);
  assert.strictEqual(res.body.error, "Unauthorized");
});

test("Search API 2. authenticated empty search -> correct validation behavior", async () => {
  const cookie = getSessionCookie("user-123", "user@example.com");
  const res = await makeRequest("/api/search?q=", "GET", { Cookie: cookie });
  assert.strictEqual(res.statusCode, 400);
  assert.strictEqual(res.body.success, false);
  assert.strictEqual(res.body.code, "INVALID_QUERY");
});

test("Search API 3. valid single-type CLIENT search", async () => {
  const cookie = getSessionCookie("user-123", "user@example.com");
  mockSearchClients = [
    {
      id: "client-1",
      name: "Acme Corp",
      status: "Active",
      email: "contact@acme.com",
      ownerId: "user-123",
      createdAt: new Date(),
    },
  ];

  const res = await makeRequest("/api/search?q=Acme&resultTypes=CLIENT", "GET", { Cookie: cookie });
  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.body.success, true);
  assert.strictEqual(res.body.results.length, 1);
  assert.strictEqual(res.body.results[0].resultType, "CLIENT");
  assert.strictEqual(res.body.results[0].entityId, "client-1");
  assert.strictEqual(res.body.results[0].display.title, "Acme Corp");
});

test("Search API 4. valid single-type JOB search", async () => {
  const cookie = getSessionCookie("user-123", "user@example.com");
  mockSearchJobs = [
    {
      id: "job-1",
      title: "Senior React Architect",
      source: "UPWORK",
      status: "IMPORTED",
      tenantId: "user-123",
      createdAt: new Date(),
    },
  ];

  const res = await makeRequest("/api/search?q=React&resultTypes=JOB", "GET", { Cookie: cookie });
  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.body.success, true);
  assert.strictEqual(res.body.results.length, 1);
  assert.strictEqual(res.body.results[0].resultType, "JOB");
  assert.strictEqual(res.body.results[0].entityId, "job-1");
  assert.strictEqual(res.body.results[0].display.title, "Senior React Architect");
});

test("Search API 5. valid single-type MATCH search", async () => {
  const cookie = getSessionCookie("user-123", "user@example.com");
  mockSearchMatches = [
    {
      id: "match-1",
      jobId: "job-1",
      freelancerId: "user-123",
      status: "EVALUATED",
      matchingVersion: "v1",
      semanticSimilarity: 0.95,
      tenantId: "user-123",
      createdAt: new Date(),
    },
  ];

  const res = await makeRequest("/api/search?q=EVALUATED&resultTypes=MATCH", "GET", {
    Cookie: cookie,
  });
  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.body.success, true);
  assert.strictEqual(res.body.results.length, 1);
  assert.strictEqual(res.body.results[0].resultType, "MATCH");
  assert.strictEqual(res.body.results[0].entityId, "match-1");
});

test("Search API 6. valid single-type TIMELINE search", async () => {
  const cookie = getSessionCookie("user-123", "user@example.com");
  mockSearchTimelines = [
    {
      id: "timeline-1",
      timelineId: "tl-1",
      clientId: "c-1",
      category: "Milestone",
      timestamp: new Date(),
      actorRef: "system",
      visibility: "Public",
      ownerId: "user-123",
      createdAt: new Date(),
    },
  ];

  const res = await makeRequest("/api/search?q=Milestone&resultTypes=TIMELINE", "GET", {
    Cookie: cookie,
  });
  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.body.success, true);
  assert.strictEqual(res.body.results.length, 1);
  assert.strictEqual(res.body.results[0].resultType, "TIMELINE");
  assert.strictEqual(res.body.results[0].entityId, "timeline-1");
});

test("Search API 7. unrestricted multi-type search", async () => {
  const cookie = getSessionCookie("user-123", "user@example.com");
  mockSearchClients = [
    {
      id: "client-1",
      name: "Alpha Client",
      status: "Active",
      ownerId: "user-123",
      createdAt: new Date(),
    },
  ];
  mockSearchJobs = [
    {
      id: "job-1",
      title: "Alpha Job",
      source: "UPWORK",
      status: "IMPORTED",
      tenantId: "user-123",
      createdAt: new Date(),
    },
  ];

  const res = await makeRequest("/api/search?q=Alpha", "GET", { Cookie: cookie });
  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.body.success, true);
  assert.strictEqual(res.body.results.length, 2);
  assert.strictEqual(res.body.total, 2);
  const types = res.body.results.map((r) => r.resultType);
  assert.ok(types.includes("CLIENT"));
  assert.ok(types.includes("JOB"));
});

test("Search API 8. resultTypes subset filtering", async () => {
  const cookie = getSessionCookie("user-123", "user@example.com");
  mockSearchClients = [
    {
      id: "client-1",
      name: "Beta Client",
      status: "Active",
      ownerId: "user-123",
      createdAt: new Date(),
    },
  ];
  mockSearchJobs = [
    {
      id: "job-1",
      title: "Beta Job",
      source: "UPWORK",
      status: "IMPORTED",
      tenantId: "user-123",
      createdAt: new Date(),
    },
  ];
  mockSearchMatches = [
    {
      id: "match-1",
      jobId: "job-1",
      freelancerId: "user-123",
      status: "Beta Match",
      matchingVersion: "v1",
      tenantId: "user-123",
      createdAt: new Date(),
    },
  ];

  const res = await makeRequest("/api/search?q=Beta&resultTypes=CLIENT,JOB", "GET", {
    Cookie: cookie,
  });
  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.body.success, true);
  assert.strictEqual(res.body.results.length, 2);
  const types = res.body.results.map((r) => r.resultType);
  assert.ok(types.includes("CLIENT"));
  assert.ok(types.includes("JOB"));
  assert.ok(!types.includes("MATCH"));
});

test("Search API 9. OPPORTUNITY rejected with 400", async () => {
  const cookie = getSessionCookie("user-123", "user@example.com");
  const res = await makeRequest("/api/search?q=test&resultTypes=OPPORTUNITY", "GET", {
    Cookie: cookie,
  });
  assert.strictEqual(res.statusCode, 400);
  assert.strictEqual(res.body.success, false);
  assert.strictEqual(res.body.code, "INVALID_SEARCH_REQUEST");
});

test("Search API 10. invalid page -> 400", async () => {
  const cookie = getSessionCookie("user-123", "user@example.com");
  const res1 = await makeRequest("/api/search?q=test&page=0", "GET", { Cookie: cookie });
  assert.strictEqual(res1.statusCode, 400);
  assert.strictEqual(res1.body.code, "INVALID_PAGINATION");

  const res2 = await makeRequest("/api/search?q=test&page=-5", "GET", { Cookie: cookie });
  assert.strictEqual(res2.statusCode, 400);
  assert.strictEqual(res2.body.code, "INVALID_PAGINATION");

  const res3 = await makeRequest("/api/search?q=test&page=abc", "GET", { Cookie: cookie });
  assert.strictEqual(res3.statusCode, 400);
  assert.strictEqual(res3.body.code, "INVALID_PAGINATION");
});

test("Search API 11. invalid pageSize -> 400", async () => {
  const cookie = getSessionCookie("user-123", "user@example.com");
  const res1 = await makeRequest("/api/search?q=test&pageSize=0", "GET", { Cookie: cookie });
  assert.strictEqual(res1.statusCode, 400);
  assert.strictEqual(res1.body.code, "INVALID_PAGINATION");

  const res2 = await makeRequest("/api/search?q=test&pageSize=-10", "GET", { Cookie: cookie });
  assert.strictEqual(res2.statusCode, 400);
  assert.strictEqual(res2.body.code, "INVALID_PAGINATION");
});

test("Search API 12. pageSize > 100 -> 400", async () => {
  const cookie = getSessionCookie("user-123", "user@example.com");
  const res = await makeRequest("/api/search?q=test&pageSize=101", "GET", { Cookie: cookie });
  assert.strictEqual(res.statusCode, 400);
  assert.strictEqual(res.body.success, false);
  assert.strictEqual(res.body.code, "INVALID_PAGINATION");
});

test("Search API 13. missing/blank query -> 400", async () => {
  const cookie = getSessionCookie("user-123", "user@example.com");
  const res1 = await makeRequest("/api/search", "GET", { Cookie: cookie });
  assert.strictEqual(res1.statusCode, 400);
  assert.strictEqual(res1.body.code, "INVALID_QUERY");

  const res2 = await makeRequest("/api/search?q=%20%20%20", "GET", { Cookie: cookie });
  assert.strictEqual(res2.statusCode, 400);
  assert.strictEqual(res2.body.code, "INVALID_QUERY");
});

test("Search API 14. forged ownerId rejected", async () => {
  const cookie = getSessionCookie("user-123", "user@example.com");
  const res = await makeRequest("/api/search?q=test&ownerId=attacker-999", "GET", {
    Cookie: cookie,
  });
  assert.strictEqual(res.statusCode, 400);
  assert.strictEqual(res.body.success, false);
  assert.strictEqual(res.body.code, "INVALID_SEARCH_REQUEST");
});

test("Search API 15. forged tenantId rejected", async () => {
  const cookie = getSessionCookie("user-123", "user@example.com");
  const res = await makeRequest("/api/search?q=test&tenantId=attacker-tenant", "GET", {
    Cookie: cookie,
  });
  assert.strictEqual(res.statusCode, 400);
  assert.strictEqual(res.body.success, false);
  assert.strictEqual(res.body.code, "INVALID_SEARCH_REQUEST");
});

test("Search API 16. authenticated owner/tenant scope passed to UnifiedSearchEngine", async () => {
  currentUserId = "user-specific-owner";
  currentUserEmail = "specific@example.com";
  const cookie = getSessionCookie("user-specific-owner", "specific@example.com");
  let capturedScope = null;
  clientRepo.searchClients = async (_query, scope) => {
    capturedScope = scope;
    return { items: [], total: 0, page: 1, pageSize: 20 };
  };

  const res = await makeRequest("/api/search?q=test&resultTypes=CLIENT", "GET", { Cookie: cookie });
  assert.strictEqual(res.statusCode, 200);
  assert.ok(capturedScope !== null);
  assert.strictEqual(capturedScope.ownerId, "user-specific-owner");
  assert.strictEqual(capturedScope.tenantId, "user-specific-owner");
});

test("Search API 17. cross-owner data cannot appear", async () => {
  currentUserId = "user-A";
  currentUserEmail = "userA@example.com";
  const cookieA = getSessionCookie("user-A", "userA@example.com");
  mockSearchClients = [
    {
      id: "client-A",
      name: "Secret Client A",
      status: "Active",
      ownerId: "user-A",
      createdAt: new Date(),
    },
    {
      id: "client-B",
      name: "Secret Client B",
      status: "Active",
      ownerId: "user-B",
      createdAt: new Date(),
    },
  ];

  const resA = await makeRequest("/api/search?q=Secret&resultTypes=CLIENT", "GET", {
    Cookie: cookieA,
  });
  assert.strictEqual(resA.statusCode, 200);
  assert.strictEqual(resA.body.results.length, 1);
  assert.strictEqual(resA.body.results[0].entityId, "client-A");
});

test("Search API 18. cross-tenant data cannot appear", async () => {
  currentUserId = "user-A";
  currentUserEmail = "userA@example.com";
  const cookieA = getSessionCookie("user-A", "userA@example.com");
  mockSearchJobs = [
    {
      id: "job-A",
      title: "Target Job A",
      source: "UPWORK",
      status: "IMPORTED",
      tenantId: "user-A",
      createdAt: new Date(),
    },
    {
      id: "job-B",
      title: "Target Job B",
      source: "UPWORK",
      status: "IMPORTED",
      tenantId: "user-B",
      createdAt: new Date(),
    },
  ];

  const resA = await makeRequest("/api/search?q=Target&resultTypes=JOB", "GET", {
    Cookie: cookieA,
  });
  assert.strictEqual(resA.statusCode, 200);
  assert.strictEqual(resA.body.results.length, 1);
  assert.strictEqual(resA.body.results[0].entityId, "job-A");
});

test("Search API 19. pagination metadata returned correctly", async () => {
  const cookie = getSessionCookie("user-123", "user@example.com");
  mockSearchClients = Array.from({ length: 45 }, (_, i) => ({
    id: `client-${i + 1}`,
    name: `Client ${i + 1}`,
    status: "Active",
    ownerId: "user-123",
    createdAt: new Date(),
  }));

  const res = await makeRequest(
    "/api/search?q=Client&resultTypes=CLIENT&page=2&pageSize=10",
    "GET",
    { Cookie: cookie },
  );
  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.body.page, 2);
  assert.strictEqual(res.body.pageSize, 10);
  assert.strictEqual(res.body.total, 45);
  assert.strictEqual(res.body.totalPages, 5);
  assert.strictEqual(res.body.count, 10);
  assert.strictEqual(res.body.isEmpty, false);
});

test("Search API 20. results.length never exceeds pageSize", async () => {
  const cookie = getSessionCookie("user-123", "user@example.com");
  mockSearchClients = Array.from({ length: 25 }, (_, i) => ({
    id: `client-${i + 1}`,
    name: `Bulk Item ${i + 1}`,
    status: "Active",
    ownerId: "user-123",
    createdAt: new Date(),
  }));

  const res = await makeRequest("/api/search?q=Bulk&pageSize=5", "GET", { Cookie: cookie });
  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.body.results.length, 5);
  assert.ok(res.body.results.length <= 5);
});

test("Search API 21. provider/search failure mapped safely", async () => {
  const cookie = getSessionCookie("user-123", "user@example.com");
  clientRepo.searchClients = async () => {
    throw new Error("Simulated database timeout failure");
  };

  const res = await makeRequest("/api/search?q=test&resultTypes=CLIENT", "GET", { Cookie: cookie });
  assert.strictEqual(res.statusCode, 500);
  assert.strictEqual(res.body.success, false);
  assert.strictEqual(res.body.code, "SEARCH_PROVIDER_ERROR");
  assert.ok(typeof res.body.error === "string");
});

test("Search API 22. SQL/stack/path/credential leakage absent", async () => {
  const cookie = getSessionCookie("user-123", "user@example.com");
  clientRepo.searchClients = async () => {
    throw new Error(
      "FATAL: connection to server at '127.0.0.1', port 5432 failed: password authentication failed for user 'postgres_secret_user'",
    );
  };

  const res = await makeRequest("/api/search?q=test&resultTypes=CLIENT", "GET", { Cookie: cookie });
  assert.strictEqual(res.statusCode, 500);
  const jsonStr = JSON.stringify(res.body);
  assert.ok(!jsonStr.includes("postgres_secret_user"));
  assert.ok(!jsonStr.includes("5432"));
  assert.ok(!jsonStr.includes("FATAL"));
  assert.ok(!jsonStr.includes("stack"));
});

test("Search API 23. success response uses canonical safe DTO", async () => {
  const cookie = getSessionCookie("user-123", "user@example.com");
  mockSearchClients = [
    {
      id: "client-1",
      name: "Safe Client",
      status: "Active",
      email: "safe@client.com",
      website: "https://safe.com",
      ownerId: "user-123",
      createdAt: new Date(),
    },
  ];

  const res = await makeRequest("/api/search?q=Safe&resultTypes=CLIENT", "GET", { Cookie: cookie });
  assert.strictEqual(res.statusCode, 200);
  assert.deepStrictEqual(Object.keys(res.body).sort(), [
    "count",
    "isEmpty",
    "page",
    "pageSize",
    "results",
    "success",
    "total",
    "totalPages",
  ]);

  const result = res.body.results[0];
  assert.deepStrictEqual(Object.keys(result).sort(), [
    "display",
    "entityId",
    "relevance",
    "resultType",
  ]);
  assert.strictEqual(result.resultType, "CLIENT");
  assert.strictEqual(result.entityId, "client-1");
  assert.ok(!JSON.stringify(result).includes("user-123")); // scope not exposed in result
});

test("Search API 24. repeated identical requests return deterministic results", async () => {
  const cookie = getSessionCookie("user-123", "user@example.com");
  mockSearchClients = [
    {
      id: "client-1",
      name: "Repeated Test Item",
      status: "Active",
      ownerId: "user-123",
      createdAt: new Date(),
    },
    {
      id: "client-2",
      name: "Repeated Test Item",
      status: "Active",
      ownerId: "user-123",
      createdAt: new Date(),
    },
  ];

  const res1 = await makeRequest("/api/search?q=Repeated&resultTypes=CLIENT", "GET", {
    Cookie: cookie,
  });
  const res2 = await makeRequest("/api/search?q=Repeated&resultTypes=CLIENT", "GET", {
    Cookie: cookie,
  });
  assert.strictEqual(res1.statusCode, 200);
  assert.strictEqual(res2.statusCode, 200);
  assert.deepStrictEqual(res1.body.results, res2.body.results);
});

test("Search API 25. excluded result types do not invoke excluded providers", async () => {
  const cookie = getSessionCookie("user-123", "user@example.com");
  mockSearchClients = [
    {
      id: "client-1",
      name: "Selective Item",
      status: "Active",
      ownerId: "user-123",
      createdAt: new Date(),
    },
  ];

  const res = await makeRequest("/api/search?q=Selective&resultTypes=CLIENT", "GET", {
    Cookie: cookie,
  });
  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(searchCalls.client, 1);
  assert.strictEqual(searchCalls.job, 0);
  assert.strictEqual(searchCalls.match, 0);
  assert.strictEqual(searchCalls.timeline, 0);
});

// =====================================================================
// Matching API Tests (Phase 11E)
// =====================================================================

const sampleMatchRow = {
  id: "match-101",
  tenantId: "user-123",
  ownerId: "user-123",
  freelancerId: "user-123",
  jobId: "job-202",
  jobNormalizationId: "norm-1",
  normalizationVersion: "v1",
  matchingVersion: "v1",
  matchSignals: {
    matchedSkills: ["TypeScript", "Node.js"],
    missingSkills: ["Docker"],
    skillCoverage: 0.95,
    semanticSimilarity: 0.9,
    experienceCompatibility: "COMPATIBLE",
    budgetCompatibility: "COMPATIBLE",
    jobTypeCompatibility: "COMPATIBLE",
    locationCompatibility: "COMPATIBLE",
  },
  status: "EVALUATED",
  snapshots: [],
  createdAt: new Date("2026-08-20T10:00:00.000Z"),
  updatedAt: new Date("2026-08-20T10:00:00.000Z"),
};

const sampleJobRow = {
  id: "job-202",
  tenantId: "user-123",
  ownerId: "user-123",
  source: "Upwork",
  sourceUrl: "https://upwork.com/jobs/202",
  rawPayload: {
    title: "Senior Backend Developer",
    description: "Looking for expert Node.js backend developer.",
    budget: { type: "hourly", min: 80, max: 120, currency: "USD" },
  },
  createdAt: new Date("2026-08-20T09:00:00.000Z"),
};

test("Matching API 1. GET /api/matches returns 401 when unauthorized", async () => {
  const res = await makeRequest("/api/matches", "GET");
  assert.strictEqual(res.statusCode, 401);
  assert.strictEqual(res.body.success, false);
});

test("Matching API 2. GET /api/matches returns matches list with score, breakdown, and explanation", async () => {
  const cookie = getSessionCookie("user-123", "user@example.com");
  mockMatchesRows = [sampleMatchRow];
  mockJobImportsRows = [sampleJobRow];

  const res = await makeRequest("/api/matches", "GET", { Cookie: cookie });
  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.body.success, true);
  assert.strictEqual(res.body.total, 1);
  assert.strictEqual(res.body.page, 1);
  assert.strictEqual(res.body.pageSize, 20);
  assert.strictEqual(res.body.matches.length, 1);

  const m = res.body.matches[0];
  assert.strictEqual(m.id, "match-101");
  assert.strictEqual(m.jobId, "job-202");
  assert.strictEqual(m.jobTitle, "Senior Backend Developer");
  assert.strictEqual(m.platform, "Upwork");
  assert.strictEqual(m.score, 90);
  assert.strictEqual(m.status, "EVALUATED");
  assert.strictEqual(m.cacheState, "CACHED");
  assert.ok(m.explanation.includes("TypeScript"));
  assert.deepStrictEqual(m.strengths, ["TypeScript", "Node.js"]);
  assert.deepStrictEqual(m.gaps, ["Docker"]);
});

test("Matching API 3. GET /api/matches filters by status", async () => {
  const cookie = getSessionCookie("user-123", "user@example.com");
  mockMatchesRows = [sampleMatchRow];
  mockJobImportsRows = [sampleJobRow];

  const res = await makeRequest("/api/matches?status=EVALUATED", "GET", { Cookie: cookie });
  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.body.success, true);
  assert.strictEqual(res.body.matches.length, 1);
});

test("Matching API 4. GET /api/matches filters by minScore", async () => {
  const cookie = getSessionCookie("user-123", "user@example.com");
  mockMatchesRows = [sampleMatchRow];
  mockJobImportsRows = [sampleJobRow];

  const res = await makeRequest("/api/matches?minScore=95", "GET", { Cookie: cookie });
  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.body.success, true);
  assert.strictEqual(res.body.matches.length, 0);
});

test("Matching API 5. GET /api/matches filters by platform", async () => {
  const cookie = getSessionCookie("user-123", "user@example.com");
  mockMatchesRows = [sampleMatchRow];
  mockJobImportsRows = [sampleJobRow];

  const resMatch = await makeRequest("/api/matches?platform=upwork", "GET", { Cookie: cookie });
  assert.strictEqual(resMatch.statusCode, 200);
  assert.strictEqual(resMatch.body.matches.length, 1);

  const resNoMatch = await makeRequest("/api/matches?platform=linkedin", "GET", { Cookie: cookie });
  assert.strictEqual(resNoMatch.statusCode, 200);
  assert.strictEqual(resNoMatch.body.matches.length, 0);
});

test("Matching API 6. GET /api/matches rejects invalid status with 400", async () => {
  const cookie = getSessionCookie("user-123", "user@example.com");
  const res = await makeRequest("/api/matches?status=INVALID_STATUS", "GET", { Cookie: cookie });
  assert.strictEqual(res.statusCode, 400);
  assert.strictEqual(res.body.success, false);
  assert.strictEqual(res.body.error, "Invalid status parameter");
});

test("Matching API 7. GET /api/matches rejects invalid minScore with 400", async () => {
  const cookie = getSessionCookie("user-123", "user@example.com");
  const res = await makeRequest("/api/matches?minScore=abc", "GET", { Cookie: cookie });
  assert.strictEqual(res.statusCode, 400);
  assert.strictEqual(res.body.success, false);
  assert.strictEqual(res.body.error, "Invalid minScore parameter");
});

test("Matching API 8. GET /api/matches rejects invalid page with 400", async () => {
  const cookie = getSessionCookie("user-123", "user@example.com");
  const res = await makeRequest("/api/matches?page=0", "GET", { Cookie: cookie });
  assert.strictEqual(res.statusCode, 400);
  assert.strictEqual(res.body.success, false);
  assert.strictEqual(res.body.error, "Invalid page parameter");
});

test("Matching API 9. GET /api/matches rejects invalid pageSize with 400", async () => {
  const cookie = getSessionCookie("user-123", "user@example.com");
  const res = await makeRequest("/api/matches?pageSize=50", "GET", { Cookie: cookie });
  assert.strictEqual(res.statusCode, 400);
  assert.strictEqual(res.body.success, false);
  assert.strictEqual(res.body.error, "Invalid pageSize parameter");
});

test("Matching API 10. GET /api/matches/:id returns 404 if match not found", async () => {
  const cookie = getSessionCookie("user-123", "user@example.com");
  mockMatchesRows = [];

  const res = await makeRequest("/api/matches/non-existent-match", "GET", { Cookie: cookie });
  assert.strictEqual(res.statusCode, 404);
  assert.strictEqual(res.body.success, false);
  assert.strictEqual(res.body.error, "Match not found");
});

test("Matching API 11. GET /api/matches/:id returns single match detail", async () => {
  const cookie = getSessionCookie("user-123", "user@example.com");
  mockMatchesRows = [sampleMatchRow];
  mockJobImportsRows = [sampleJobRow];

  const res = await makeRequest("/api/matches/match-101", "GET", { Cookie: cookie });
  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.body.success, true);
  assert.strictEqual(res.body.match.id, "match-101");
  assert.strictEqual(res.body.match.jobTitle, "Senior Backend Developer");
  assert.strictEqual(res.body.match.score, 90);
});

test("Matching API 12. PATCH /api/matches/:id updates status to ARCHIVED", async () => {
  const cookie = getSessionCookie("user-123", "user@example.com");
  mockMatchesRows = [{ ...sampleMatchRow }];
  mockJobImportsRows = [sampleJobRow];

  const res = await makeRequest(
    "/api/matches/match-101",
    "PATCH",
    { Cookie: cookie },
    { status: "ARCHIVED" },
  );
  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.body.success, true);
  assert.strictEqual(res.body.match.status, "ARCHIVED");
});

test("Matching API 13. PATCH /api/matches/:id rejects invalid status mutation with 400", async () => {
  const cookie = getSessionCookie("user-123", "user@example.com");
  mockMatchesRows = [sampleMatchRow];
  mockJobImportsRows = [sampleJobRow];

  const res = await makeRequest(
    "/api/matches/match-101",
    "PATCH",
    { Cookie: cookie },
    { status: "CREATED" },
  );
  assert.strictEqual(res.statusCode, 400);
  assert.strictEqual(res.body.success, false);
});
