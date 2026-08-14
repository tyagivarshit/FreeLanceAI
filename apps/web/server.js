import http from "http";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { randomUUID } from "crypto";
import { eq, and, desc, inArray, sql } from "drizzle-orm";
import {
  signupUser,
  loginUser,
  mapAuthError,
  parseUserAgent,
  issueSessionCookie,
  logoutUser,
  issueClearSessionCookie,
  authenticateRequest,
} from "@freelanceos/auth";
import { runtimeConfig } from "@freelanceos/config";
import { logger } from "@freelanceos/logger";
import {
  StripeWebhookProcessor,
  InMemoryStripeCustomerMappingRepository,
  InMemoryStripeSubscriptionRepository,
  InMemoryWebhookEventStore,
  StripePriceRegistry,
  EntitlementResolver,
  PlanCatalog,
  Plan,
  InMemoryUsageRepository,
  JobMatch,
  JobMatchScore,
  ScoreWeightProfile,
  ClientTimeline,
  EntitlementEnforcer,
} from "@freelanceos/core";
import {
  db,
  jobImports,
  jobMatches,
  PostgresJobsRepository,
  PostgresJobMatchRepository,
  PostgresTimelineRepository,
} from "@freelanceos/db";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Define the standard price catalog configuration
const priceRegistry = new StripePriceRegistry([
  {
    planId: "BASIC",
    region: "GLOBAL",
    currency: "USD",
    interval: "MONTHLY",
    version: 1,
    stripePriceId: "stripe_price_basic_global_v1",
  },
  {
    planId: "PRO",
    region: "GLOBAL",
    currency: "USD",
    interval: "MONTHLY",
    version: 1,
    stripePriceId: "stripe_price_pro_global_v1",
  },
  {
    planId: "PRO",
    region: "INDIA",
    currency: "INR",
    interval: "MONTHLY",
    version: 1,
    stripePriceId: "stripe_price_pro_india_v1",
  },
]);

// Instantiate In-Memory Repositories as Singletons for Web Layer
const customerMappingRepo = new InMemoryStripeCustomerMappingRepository();
const subscriptionRepo = new InMemoryStripeSubscriptionRepository();
const eventStore = new InMemoryWebhookEventStore();
const usageRepo = new InMemoryUsageRepository();

// Mock / placeholder PaymentAggregateStore since it's locally mock-defined in tests
const paymentStore = {
  save: async (payment) => {
    logger.info({ message: "Mock Payment Saved", paymentId: payment.id, status: payment.status });
  },
  findByReference: async (reference, ownerId) => {
    logger.info({ message: "Mock Payment findByReference", reference, ownerId });
    return null;
  },
};

// Shared Mock Trial Grant Persistence Contract
const trialPersistence = {
  save: async (grant) => {
    logger.info({
      message: "Mock Trial Grant Saved",
      grantId: grant.grantId,
      status: grant.status,
    });
  },
  findById: async (_id) => null,
  findByUserId: async (_userId) => [],
  findBySignal: async (_signalType, _signalValue) => [],
};

const planCatalog = new PlanCatalog([
  Plan.createStarter(),
  Plan.createPro(),
  Plan.createPowerBidder(),
]);

const entitlementResolver = new EntitlementResolver({
  planCatalog,
  trialPersistence,
  customerMappingRepo,
  subscriptionRepo,
  usageRepo,
});

// Instantiate the StripeWebhookProcessor
const webhookProcessor = new StripeWebhookProcessor({
  stripeSecretKey: runtimeConfig.STRIPE_SECRET_KEY || "mock_secret_key",
  webhookSecret: runtimeConfig.STRIPE_WEBHOOK_SECRET || "mock_webhook_secret",
  env: runtimeConfig.NODE_ENV || "development",
  priceRegistry,
  customerMappingRepo,
  subscriptionRepo,
  paymentStore,
  eventStore,
  trialPersistence,
});

const jobsRepo = new PostgresJobsRepository();
const matchRepo = new PostgresJobMatchRepository();
const timelineRepo = new PostgresTimelineRepository();

const PORT = runtimeConfig.API_PORT || 4000;

const MIME_TYPES = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "application/javascript",
  ".json": "application/json",
};

function getCookie(cookieHeader, name) {
  if (!cookieHeader) {
    return undefined;
  }
  const cookies = cookieHeader.split(";");
  for (const cookie of cookies) {
    const [key, val] = cookie.trim().split("=");
    if (key === name) {
      return val;
    }
  }
  return undefined;
}

const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url, "http://localhost");
  const pathname = parsedUrl.pathname;

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  // 1. Hook the Signup use case to POST /api/signup
  if (pathname === "/api/signup" && req.method === "POST") {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });

    req.on("end", async () => {
      try {
        const payload = JSON.parse(body);
        const { email, password } = payload;

        // Build session metadata from request details
        const userAgent = req.headers["user-agent"] || "unknown";
        const ipAddress = req.socket.remoteAddress || "127.0.0.1";
        const sessionMetadata = parseUserAgent(userAgent, ipAddress);

        const result = await signupUser({
          email,
          password,
          sessionMetadata,
        });

        // Set stateful refresh token cookie securely
        if (result.tokens) {
          res.setHeader("Set-Cookie", issueSessionCookie(result.tokens.refreshToken));
        }

        res.writeHead(201, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            success: true,
            user: result.user,
            verificationTriggered: result.verificationTriggered,
          }),
        );
      } catch (err) {
        logger.error({
          message: "Signup API request failed",
          error: err instanceof Error ? err : new Error(String(err)),
        });

        const httpResponse = mapAuthError(err);
        res.writeHead(httpResponse.statusCode, { "Content-Type": "application/json" });
        res.end(JSON.stringify(httpResponse.body));
      }
    });
    return;
  }

  // 1B. Hook the Login use case to POST /api/login
  if (pathname === "/api/login" && req.method === "POST") {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });

    req.on("end", async () => {
      try {
        const payload = JSON.parse(body);
        const { email, password } = payload;

        // Build session metadata from request details
        const userAgent = req.headers["user-agent"] || "unknown";
        const ipAddress = req.socket.remoteAddress || "127.0.0.1";
        const sessionMetadata = parseUserAgent(userAgent, ipAddress);

        const result = await loginUser({
          email,
          password,
          sessionMetadata,
        });

        // Set stateful refresh token cookie securely
        if (result.tokens) {
          res.setHeader("Set-Cookie", issueSessionCookie(result.tokens.refreshToken));
        }

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            success: true,
            user: result.user,
            verificationTriggered: result.verificationTriggered,
          }),
        );
      } catch (err) {
        logger.error({
          message: "Login API request failed",
          error: err instanceof Error ? err : new Error(String(err)),
        });

        const httpResponse = mapAuthError(err);
        res.writeHead(httpResponse.statusCode, { "Content-Type": "application/json" });
        res.end(JSON.stringify(httpResponse.body));
      }
    });
    return;
  }

  // 1C. Hook the Logout use case to POST /api/logout
  if (pathname === "/api/logout" && req.method === "POST") {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });

    req.on("end", async () => {
      try {
        const payload = body ? JSON.parse(body) : {};
        const { global = false } = payload;

        // Extract credentials from cookies and headers
        const cookieHeader = req.headers.cookie || "";
        const cookieName = runtimeConfig.SESSION_COOKIE_NAME;
        const refreshToken = getCookie(cookieHeader, cookieName);

        const authHeader = req.headers["authorization"] || "";
        const accessToken = authHeader.startsWith("Bearer ") ? authHeader.substring(7) : undefined;
        const ipAddress = req.socket.remoteAddress || "127.0.0.1";

        const result = await logoutUser({
          accessToken,
          refreshToken,
          global,
          ipAddress,
        });

        // If directive is set, clear the secure refresh token cookie
        if (result.clearCredentialDirective) {
          res.setHeader("Set-Cookie", issueClearSessionCookie());
        }

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            success: true,
          }),
        );
      } catch (err) {
        logger.error({
          message: "Logout API request failed",
          error: err instanceof Error ? err : new Error(String(err)),
        });

        const httpResponse = mapAuthError(err);
        res.writeHead(httpResponse.statusCode, { "Content-Type": "application/json" });
        res.end(JSON.stringify(httpResponse.body));
      }
    });
    return;
  }

  // 1D. Stripe Webhook Processing Boundary Hookup
  if (pathname === "/api/webhooks/stripe" && req.method === "POST") {
    const signatureHeader = req.headers["stripe-signature"];

    // Size limit protection: 1MB (1024 * 1024 bytes) max to prevent resource exhaustion attacks
    const MAX_SIZE = 1024 * 1024;
    let bodyChunks = [];
    let bodySize = 0;
    let aborted = false;

    req.on("data", (chunk) => {
      if (aborted) return;
      bodySize += chunk.length;
      if (bodySize > MAX_SIZE) {
        aborted = true;
        logger.warn({
          message: "Stripe webhook rejected: Payload size limit exceeded",
          size: bodySize,
        });
        res.writeHead(413, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Payload too large" }));
        req.destroy();
      } else {
        bodyChunks.push(chunk);
      }
    });

    req.on("end", async () => {
      if (aborted) return;

      const rawBody = Buffer.concat(bodyChunks).toString("utf8");

      // Timeout control: 10 seconds timeout for webhook processing
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Webhook processing timeout")), 10000),
      );

      try {
        const processPromise = webhookProcessor.handleWebhook(rawBody, signatureHeader);
        const result = await Promise.race([processPromise, timeoutPromise]);

        // Success / processed response
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            success: true,
            status: result.status,
            eventId: result.eventId,
          }),
        );
      } catch (err) {
        logger.error({
          message: "Stripe webhook processing failed",
          error: err instanceof Error ? err : new Error(String(err)),
        });

        // Determine correct HTTP status code based on error type
        let statusCode = 400; // default for validation / bad requests
        let errorCode = "PROCESSING_ERROR";

        if (err && typeof err === "object") {
          errorCode = err.code || "PROCESSING_ERROR";
          if (errorCode === "INVALID_SIGNATURE") {
            statusCode = 400;
          } else if (errorCode === "INVALID_EVENT") {
            statusCode = 400;
          } else if (errorCode === "PERMANENT_PROCESSING_FAILURE") {
            statusCode = 500;
          } else if (errorCode === "TRANSIENT_PROCESSING_FAILURE") {
            statusCode = 500; // triggers retry from Stripe
          }
        }

        res.writeHead(statusCode, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            success: false,
            code: errorCode,
            message: err instanceof Error ? err.message : String(err),
          }),
        );
      }
    });
    return;
  }

  // 1E. Authentication & Entitlements API & Redirects
  const cookieHeader = req.headers.cookie || "";
  const cookieName = runtimeConfig.SESSION_COOKIE_NAME;
  const refreshToken = getCookie(cookieHeader, cookieName);

  // Authenticate user check helper
  async function checkAuthentication() {
    if (!refreshToken) return null;
    try {
      const authResult = await authenticateRequest({
        credentialToken: refreshToken,
        routePolicy: "Protected",
        ipAddress: req.socket.remoteAddress || "127.0.0.1",
      });
      if (authResult.status === "Authenticated") {
        return authResult;
      }
    } catch (err) {
      logger.error({ message: "Authentication helper failure", error: err });
    }
    return null;
  }

  // Redirect authenticated users away from signup/login pages to dashboard
  if (pathname === "/" || pathname === "/index.html" || pathname === "/login.html") {
    const auth = await checkAuthentication();
    if (auth) {
      res.writeHead(302, { Location: "/dashboard.html" });
      res.end();
      return;
    }
  }

  // Protect dashboard routes
  if (pathname === "/dashboard.html" || pathname === "/dashboard") {
    const auth = await checkAuthentication();
    if (!auth) {
      res.writeHead(302, { Location: "/login.html" });
      res.end();
      return;
    }
    // Clean rewrite if requested without extension
    if (pathname === "/dashboard") {
      req.url = "/dashboard.html";
    }
  }

  // Get active user session info API
  if (pathname === "/api/session" && req.method === "GET") {
    const auth = await checkAuthentication();
    if (!auth) {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: false, error: "Unauthorized" }));
      return;
    }

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        success: true,
        user: {
          email: auth.context.identity.email,
          userId: auth.context.identity.userId,
        },
      }),
    );
    return;
  }

  // Get active entitlements & usage API
  if (pathname === "/api/entitlements" && req.method === "GET") {
    const auth = await checkAuthentication();
    if (!auth) {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: false, error: "Unauthorized" }));
      return;
    }

    const userId = auth.context.identity.userId;
    const tenantId = `tenant_${userId}`;
    const now = new Date();

    try {
      const effectivePlanResult = await entitlementResolver.resolveEffectivePlan(
        tenantId,
        userId,
        now,
      );
      const plan = effectivePlanResult.plan;
      const period = effectivePlanResult.period;
      const source = effectivePlanResult.source;

      // Construct usage key for AI proposals
      const usageKey = `usage:${tenantId}:AI_PROPOSAL:${period.startedAt.getTime()}:${period.endsAt.getTime()}`;
      const proposalsUsed = await usageRepo.getUsage(usageKey);

      // Construct limits structure
      const limits = {
        aiProposals: plan.limits.aiProposals,
        jobScans: plan.limits.jobScans,
        maxWorkspaces: plan.limits.maxWorkspaces,
      };

      const payload = {
        success: true,
        planId: plan.planId,
        source: source,
        period: {
          type: period.type,
          startedAt: period.startedAt.toISOString(),
          endsAt: period.endsAt.toISOString(),
        },
        limits,
        usage: {
          aiProposals: proposalsUsed,
        },
      };

      if (source === "TRIAL") {
        const timeDiff = period.endsAt.getTime() - now.getTime();
        const daysRemaining = Math.max(0, Math.ceil(timeDiff / (1000 * 60 * 60 * 24)));
        payload.trialDaysRemaining = daysRemaining;
      }

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(payload));
    } catch (err) {
      logger.error({ message: "Failed to resolve entitlements API", error: err });
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({ success: false, message: "Internal server error resolving entitlements" }),
      );
    }
    return;
  }

  // 1F. GET /api/jobs
  if (pathname === "/api/jobs" && req.method === "GET") {
    const auth = await checkAuthentication();
    if (!auth) {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: false, error: "Unauthorized" }));
      return;
    }

    const userId = auth.context.identity.userId;
    const tenantId = userId;

    // Parse query params
    const pageVal = parsedUrl.searchParams.get("page");
    const pageSizeVal = parsedUrl.searchParams.get("pageSize");
    const platform = parsedUrl.searchParams.get("platform") || undefined;
    const status = parsedUrl.searchParams.get("status") || undefined;

    let page = 1;
    let pageSize = 20;

    if (pageVal) {
      const p = parseInt(pageVal, 10);
      if (isNaN(p) || p < 1 || String(p) !== pageVal) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: false, error: "Invalid page parameter" }));
        return;
      }
      page = p;
    }

    if (pageSizeVal) {
      const ps = parseInt(pageSizeVal, 10);
      if (isNaN(ps) || ps < 1 || ps > 100 || String(ps) !== pageSizeVal) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: false, error: "Invalid pageSize parameter" }));
        return;
      }
      pageSize = ps;
    }

    // Validate status if present
    if (status && !["RECEIVED", "IMPORTED", "ARCHIVED"].includes(status)) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: false, error: "Invalid status parameter" }));
      return;
    }

    try {
      const result = await jobsRepo.findByTenant(tenantId, {
        page,
        pageSize,
        platform,
        status,
      });

      // Get match signals for these jobs to populate scores and explanations
      const jobIds = result.items.map((j) => j.id);
      const matches =
        jobIds.length > 0
          ? await db
              .select()
              .from(jobMatches)
              .where(and(eq(jobMatches.tenantId, tenantId), inArray(jobMatches.jobId, jobIds)))
          : [];

      const matchesMap = new Map();
      matches.forEach((m) => {
        matchesMap.set(m.jobId, m);
      });

      const jobsDto = result.items.map((job) => {
        const match = matchesMap.get(job.id);
        const signals = match ? match.matchSignals : null;
        const score =
          signals && typeof signals.semanticSimilarity === "number"
            ? Math.round(signals.semanticSimilarity * 100)
            : null;

        return {
          id: job.id,
          platform: job.externalIdentity.source.value,
          externalJobId: job.externalIdentity.externalJobId,
          canonicalUrl: job.provenance.sourceUrl || "",
          title: job.rawPayload.data.title || "",
          description: job.rawPayload.data.description || "",
          status: job.status,
          createdAt: job.createdAt.toISOString(),
          score,
          budget: formatBudget(job.rawPayload.data.budget),
          skills: job.rawPayload.data.skills || [],
          matchExplanation:
            signals && signals.matchedSkills && signals.matchedSkills.length > 0
              ? `Fits your profile with skills: ${signals.matchedSkills.join(", ")}.`
              : null,
        };
      });

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: true, jobs: jobsDto, total: result.total }));
    } catch (err) {
      logger.error({ message: "Failed to fetch jobs API", error: err });
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: false, error: "Internal Server Error" }));
    }
    return;
  }

  // 1G. POST /api/jobs/:id/match
  const matchJobRegex = /^\/api\/jobs\/([a-zA-Z0-9-]+)\/match$/i;
  const matchResult = pathname.match(matchJobRegex);
  if (matchResult && req.method === "POST") {
    const jobId = matchResult[1];
    const auth = await checkAuthentication();
    if (!auth) {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: false, error: "Unauthorized" }));
      return;
    }

    const userId = auth.context.identity.userId;
    const tenantId = userId;

    try {
      // Load job within tenant (ensures isolation)
      const jobImport = await jobsRepo.findById(jobId, tenantId);
      if (!jobImport) {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: false, error: "Job not found" }));
        return;
      }

      // Check applicable Phase 10 entitlement/usage
      const enforcer = new EntitlementEnforcer(entitlementResolver);
      const billingTenantId = `tenant_${userId}`;
      try {
        await enforcer.enforce(billingTenantId, userId, "BASIC_MATCHING");
      } catch (entitlementError) {
        res.writeHead(403, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            success: false,
            error: "Entitlement Denied",
            reason: entitlementError.message,
          }),
        );
        return;
      }

      // Check if a match already exists to prevent duplicate matches on double-click
      const existingMatch = await matchRepo.findByMatchingIdentity(
        tenantId,
        userId,
        jobImport.id,
        "v1",
      );
      if (existingMatch) {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            success: true,
            matchId: existingMatch.id,
            score: Math.round((existingMatch.matchSignals?.semanticSimilarity || 0) * 100),
            status: existingMatch.status,
          }),
        );
        return;
      }

      // Construct dynamic inputs based on job and default freelancer
      const freelancerProfile = {
        freelancerId: userId,
        tenantId,
        skills: ["javascript", "node.js", "postgresql", "react", "typescript", "fastapi", "python"],
        experience: "senior",
        budget: { type: "hourly", rate: 50, currency: "USD" },
        preferredJobTypes: ["hourly", "fixed"],
        location: { country: "US" },
        embeddingVector: [0.1, 0.2, 0.3],
      };

      const rawData = jobImport.rawPayload.data || {};
      const jobNormalization = {
        id: jobImport.id,
        tenantId,
        normalizationVersion: "v1",
        canonicalJob: {
          title: rawData.title || "Job Title",
          description: rawData.description || "Job Description",
          skills: rawData.skills || [],
          experience: "senior",
          budget: rawData.budget
            ? {
                type: rawData.budget.type || "hourly",
                minimum: rawData.budget.minimum || 10,
                maximum: rawData.budget.maximum || 100,
                currency: rawData.budget.currency || "USD",
              }
            : { type: "hourly", minimum: 10, maximum: 100, currency: "USD" },
          jobType: "hourly",
          location: { country: "US" },
        },
      };

      const jobEmbedding = {
        id: jobImport.id,
        tenantId,
        embeddingVersion: "v1",
        vector: [0.1, 0.2, 0.3],
      };

      const matchId = randomUUID();
      const jobMatch = JobMatch.create(
        matchId,
        tenantId,
        userId,
        userId,
        jobImport.id,
        jobImport.id,
        "v1",
        "v1",
        jobImport.id,
        "v1",
      );

      // Evaluate Phase 8 matching
      jobMatch.evaluate(userId, {
        freelancerProfile,
        jobNormalization,
        jobEmbedding,
      });

      // Calculate score
      const weightProfile = new ScoreWeightProfile("v1", {
        semanticSimilarity: 0.5,
        skillCoverage: 0.5,
        experienceCompatibility: 0.0,
        budgetCompatibility: 0.0,
        jobTypeCompatibility: 0.0,
        locationCompatibility: 0.0,
      });

      const scoringConfig = {
        scoringVersion: "v1",
        weightProfile,
        compatibilityMapping: {
          COMPATIBLE: 1.0,
          PARTIAL: 0.5,
          INCOMPATIBLE: 0.0,
          UNKNOWN: 0.0,
        },
        missingSignalPolicy: "available-weight",
        scoreScale: "0-100",
      };

      const scoreId = randomUUID();
      const matchScore = JobMatchScore.create(scoreId, tenantId, userId, matchId, "v1", "v1", "v1");
      matchScore.calculate(userId, jobMatch.matchSignals, scoringConfig);

      // Store calculated finalScore in the match signals for later retrieval
      const finalScore = matchScore.finalScore || 0;
      const updatedSignals = {
        ...jobMatch.matchSignals,
        semanticSimilarity: finalScore / 100,
      };

      // Re-create evaluated match with populated signals
      const finalMatch = new JobMatch({
        id: jobMatch.id,
        tenantId: jobMatch.tenantId,
        ownerId: jobMatch.ownerId,
        freelancerId: jobMatch.freelancerId,
        jobId: jobMatch.jobId,
        jobNormalizationId: jobMatch.jobNormalizationId,
        normalizationVersion: jobMatch.normalizationVersion,
        jobEmbeddingId: jobMatch.jobEmbeddingId,
        embeddingVersion: jobMatch.embeddingVersion,
        matchingVersion: jobMatch.matchingVersion,
        matchSignals: updatedSignals,
        status: "EVALUATED",
        snapshots: [...jobMatch.snapshots],
        createdAt: jobMatch.createdAt,
        updatedAt: new Date(),
      });

      // Save match to repository
      await matchRepo.save(finalMatch);

      // Log activity to timeline
      let timeline = await timelineRepo.findById(userId, userId);
      if (!timeline) {
        timeline = ClientTimeline.create(userId, userId, userId);
      }
      timeline.appendEntry(userId, "system", {
        entryId: randomUUID(),
        category: "Lifecycle Event",
        timestamp: new Date(),
        metadata: {
          message: `Job "${jobImport.rawPayload.data.title}" matched with score ${finalScore}%.`,
          jobId: jobImport.id,
        },
        visibility: "Public",
      });
      await timelineRepo.save(timeline);

      res.writeHead(201, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          success: true,
          matchId: finalMatch.id,
          score: finalScore,
          status: finalMatch.status,
        }),
      );
    } catch (err) {
      logger.error({ message: "Failed to run job matching API", error: err });
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: false, error: "Internal Server Error" }));
    }
    return;
  }

  // 1H. GET /api/analytics/*
  if (pathname.startsWith("/api/analytics/") && req.method === "GET") {
    const auth = await checkAuthentication();
    if (!auth) {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: false, error: "Unauthorized" }));
      return;
    }

    const userId = auth.context.identity.userId;
    const tenantId = userId;

    const action = pathname.substring("/api/analytics/".length);

    try {
      if (action === "scanned") {
        const countRes = await db
          .select({ count: sql`count(*)` })
          .from(jobImports)
          .where(eq(jobImports.tenantId, tenantId));
        const count = Number(countRes[0]?.count || 0);

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true, value: count, trend: "No trend" }));
        return;
      }

      if (action === "matches") {
        const countRes = await db
          .select({ count: sql`count(*)` })
          .from(jobMatches)
          .where(eq(jobMatches.tenantId, tenantId));
        const count = Number(countRes[0]?.count || 0);

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true, value: count, trend: "No trend" }));
        return;
      }

      if (action === "proposals") {
        const billingTenantId = `tenant_${userId}`;
        const effectivePlanResult = await entitlementResolver.resolveEffectivePlan(
          billingTenantId,
          userId,
          new Date(),
        );
        const period = effectivePlanResult.period;
        const usageKey = `usage:${billingTenantId}:AI_PROPOSAL:${period.startedAt.getTime()}:${period.endsAt.getTime()}`;
        const proposalsUsed = await usageRepo.getUsage(usageKey);

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true, value: proposalsUsed, trend: "No trend" }));
        return;
      }

      if (action === "pulse") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            success: true,
            description: "Scans are active. We're matching candidates against your experience.",
          }),
        );
        return;
      }

      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: false, error: "Analytics endpoint not found" }));
    } catch (err) {
      logger.error({ message: "Failed to resolve analytics API", error: err });
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: false, error: "Internal Server Error" }));
    }
    return;
  }

  // 1I. GET /api/activity
  if (pathname === "/api/activity" && req.method === "GET") {
    const auth = await checkAuthentication();
    if (!auth) {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: false, error: "Unauthorized" }));
      return;
    }

    const userId = auth.context.identity.userId;

    // Parse pagination params
    const pageVal = parsedUrl.searchParams.get("page");
    const pageSizeVal = parsedUrl.searchParams.get("pageSize");

    let page = 1;
    let pageSize = 20;

    if (pageVal) {
      const p = parseInt(pageVal, 10);
      if (isNaN(p) || p < 1) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: false, error: "Invalid page parameter" }));
        return;
      }
      page = p;
    }

    if (pageSizeVal) {
      const ps = parseInt(pageSizeVal, 10);
      if (isNaN(ps) || ps < 1) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: false, error: "Invalid pageSize parameter" }));
        return;
      }
      pageSize = Math.min(100, ps);
    }

    try {
      const result = await timelineRepo.findTimelineEntriesByOwner(userId, {
        page,
        pageSize,
      });

      const activityDto = result.items.map((entry) => ({
        id: entry.entryId,
        message: entry.metadata.message || "Activity event logged",
        timestamp: entry.timestamp.toISOString(),
      }));

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: true, activity: activityDto, total: result.total }));
    } catch (err) {
      logger.error({ message: "Failed to fetch activity timeline API", error: err });
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: false, error: "Internal Server Error" }));
    }
    return;
  }

  function formatBudget(budget) {
    if (!budget) return null;
    if (typeof budget === "string") return budget;
    if (typeof budget === "object") {
      if (budget.type === "hourly") {
        if (budget.minimum && budget.maximum) {
          return `$${budget.minimum}-$${budget.maximum}/hr`;
        }
        return `$${budget.rate || budget.minimum || budget.maximum || ""}/hr`;
      }
      if (budget.type === "fixed") {
        return `$${budget.amount || budget.rate || budget.minimum || ""}`;
      }
    }
    return null;
  }

  // 2. Serve static pages
  const filePath = path.join(__dirname, pathname === "/" ? "index.html" : pathname);
  const ext = path.extname(filePath);
  const contentType = MIME_TYPES[ext] || "text/plain";

  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/html" });
      res.end("<h1>404 Not Found</h1>", "utf-8");
    } else {
      res.writeHead(200, { "Content-Type": contentType });
      res.end(content, "utf-8");
    }
  });
});

if (process.env.NODE_ENV !== "test") {
  server.listen(PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`[Web Server] Running on http://localhost:${PORT}`);
  });
}

export {
  server,
  jobsRepo,
  matchRepo,
  timelineRepo,
  subscriptionRepo,
  usageRepo,
  entitlementResolver,
};
