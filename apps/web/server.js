import http from "http";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { randomUUID } from "crypto";
import { eq, and, desc, inArray, sql, ne, gt, isNull } from "drizzle-orm";
import {
  signupUser,
  loginUser,
  mapAuthError,
  parseUserAgent,
  issueSessionCookie,
  logoutUser,
  issueClearSessionCookie,
  authenticateRequest,
  verifyAccessToken,
  hashPassword,
  verifyPassword,
  revokeSession,
  revokeAllSessions,
  findActiveSession,
} from "@freelanceos/auth";
import { runtimeConfig } from "@freelanceos/config";
import { logger } from "@freelanceos/logger";
import {
  StripeWebhookProcessor,
  InMemoryStripeCustomerMappingRepository,
  InMemoryStripeSubscriptionRepository,
  InMemoryWebhookEventStore,
  StripePriceRegistry,
  StripeBillingProviderImpl,
  StripeBillingError,
  TrialService,
  EntitlementResolver,
  PlanCatalog,
  Plan,
  InMemoryUsageRepository,
  JobMatch,
  JobMatchScore,
  ScoreWeightProfile,
  ClientTimeline,
  EntitlementEnforcer,
  Client,
  BrainAnalysisRequest,
  BrainContext,
  BrainDomainError,
  BrainExecutionService,
  BrainFailure,
  BrainRequestMetadata,
  BrainScope,
  BrainResult,
  parseBrainAnalysisType,
  HeuristicBrainEngine,
  BrainContextOrchestrator,
  BrainDecisionDeriver,
  SearchQuery,
  AuthorizedSearchScope,
  SearchDomainError,
  UnifiedSearchEngine,
  ClientSearchEngine,
  JobSearchEngine,
  MatchSearchEngine,
  TimelineSearchEngine,
} from "@freelanceos/core";
import {
  db,
  users,
  userPasswordHashes,
  sessions,
  clients,
  jobImports,
  jobMatches,
  clientTimelines,
  timelineEntries,
  brainAnalyses,
  PostgresJobsRepository,
  PostgresJobMatchRepository,
  PostgresTimelineRepository,
  PostgresClientRepository,
  PostgresBrainAnalysisRepository,
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
  {
    planId: "PRO",
    region: "NORTH_AMERICA",
    currency: "USD",
    interval: "MONTHLY",
    version: 1,
    stripePriceId: "stripe_price_pro_na_v1",
  },
  {
    planId: "PRO",
    region: "UK",
    currency: "GBP",
    interval: "MONTHLY",
    version: 1,
    stripePriceId: "stripe_price_pro_uk_v1",
  },
  {
    planId: "PRO",
    region: "EUROPE",
    currency: "EUR",
    interval: "MONTHLY",
    version: 1,
    stripePriceId: "stripe_price_pro_eu_v1",
  },
  {
    planId: "POWER_BIDDER",
    region: "GLOBAL",
    currency: "USD",
    interval: "MONTHLY",
    version: 1,
    stripePriceId: "stripe_price_power_bidder_global_v1",
  },
  {
    planId: "POWER_BIDDER",
    region: "INDIA",
    currency: "INR",
    interval: "MONTHLY",
    version: 1,
    stripePriceId: "stripe_price_power_bidder_india_v1",
  },
  {
    planId: "POWER_BIDDER",
    region: "NORTH_AMERICA",
    currency: "USD",
    interval: "MONTHLY",
    version: 1,
    stripePriceId: "stripe_price_power_bidder_na_v1",
  },
  {
    planId: "POWER_BIDDER",
    region: "UK",
    currency: "GBP",
    interval: "MONTHLY",
    version: 1,
    stripePriceId: "stripe_price_power_bidder_uk_v1",
  },
  {
    planId: "POWER_BIDDER",
    region: "EUROPE",
    currency: "EUR",
    interval: "MONTHLY",
    version: 1,
    stripePriceId: "stripe_price_power_bidder_eu_v1",
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

// Instantiate StripeBillingProvider
const stripeBillingProvider = new StripeBillingProviderImpl({
  secretKey: runtimeConfig.STRIPE_SECRET_KEY || "mock_secret_key",
  env: runtimeConfig.NODE_ENV === "production" ? "production" : "development",
  priceRegistry,
  customerMappingRepo,
  planCatalog,
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
const clientRepo = new PostgresClientRepository();
const brainAnalysisRepo = new PostgresBrainAnalysisRepository();
const brainEntitlementGateway = {
  canUseBrain: async (scope, _analysisType) => {
    const decision = await entitlementResolver.resolveEntitlement(
      `tenant_${scope.ownerId}`,
      scope.actorId,
      "AI_PROPOSAL",
    );
    return {
      allowed: decision.allowed,
      feature: "AI_PROPOSAL",
      reason: decision.allowed ? "ALLOWED" : "DENIED",
    };
  },
};
const brainEngine = new HeuristicBrainEngine();
const brainContextOrchestrator = new BrainContextOrchestrator({
  clientRepo,
  jobsRepo,
  matchRepo,
  timelineRepo,
});
const brainDecisionDeriver = new BrainDecisionDeriver();
const brainExecutionService = new BrainExecutionService({
  engine: brainEngine,
  entitlementGateway: brainEntitlementGateway,
  repository: brainAnalysisRepo,
  defaultTimeoutMs: 5000,
});

const clientSearchEngine = new ClientSearchEngine(clientRepo);
const jobSearchEngine = new JobSearchEngine(jobsRepo);
const matchSearchEngine = new MatchSearchEngine(matchRepo);
const timelineSearchEngine = new TimelineSearchEngine(timelineRepo);

const unifiedSearchEngine = new UnifiedSearchEngine({
  clientEngine: clientSearchEngine,
  jobEngine: jobSearchEngine,
  matchEngine: matchSearchEngine,
  timelineEngine: timelineSearchEngine,
});

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
  let staticPathname = pathname;

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, PATCH, OPTIONS");
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
        try {
          const decoded = verifyAccessToken(refreshToken);
          if (decoded && decoded.sessionId) {
            authResult.context.identity.sessionId = decoded.sessionId;
          }
        } catch {
          // Token decode fallback
        }
        return authResult;
      }
    } catch (err) {
      logger.error({ message: "Authentication helper failure", error: err });
    }
    return null;
  }

  function sendJson(statusCode, payload) {
    res.writeHead(statusCode, { "Content-Type": "application/json" });
    res.end(JSON.stringify(payload));
  }

  async function readJsonBody() {
    const MAX_SIZE = 64 * 1024;
    let body = "";
    let bodySize = 0;

    for await (const chunk of req) {
      bodySize += chunk.length;
      if (bodySize > MAX_SIZE) {
        const err = new Error("Payload too large");
        err.statusCode = 413;
        throw err;
      }
      body += chunk;
    }

    if (!body.trim()) {
      return {};
    }

    try {
      return JSON.parse(body);
    } catch {
      const err = new Error("Malformed JSON body");
      err.statusCode = 400;
      throw err;
    }
  }

  function requireAuthenticatedOwner(auth) {
    if (!auth?.context?.identity?.userId) {
      sendJson(401, { success: false, error: "Unauthorized" });
      return null;
    }
    return auth.context.identity.userId;
  }

  const CLIENT_STATUSES = ["Lead", "Active", "Suspended", "Archived", "Closed"];

  function isPlainObject(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
  }

  function throwValidationError(message) {
    const err = new Error(message);
    err.statusCode = 400;
    throw err;
  }

  function rejectUnknownFields(input, allowed, context) {
    for (const key of Object.keys(input)) {
      if (!allowed.includes(key)) {
        throwValidationError(`Unknown ${context} field: ${key}`);
      }
    }
  }

  function rejectNulls(value, path = "body") {
    if (value === null) {
      throwValidationError(`${path} cannot be null`);
    }
    if (Array.isArray(value)) {
      throwValidationError(`${path} cannot be an array`);
    }
    if (isPlainObject(value)) {
      for (const [key, child] of Object.entries(value)) {
        rejectNulls(child, `${path}.${key}`);
      }
    }
  }

  function assertString(value, field, { min = 1, max = 255, optional = false } = {}) {
    if (value === undefined) {
      if (optional) return undefined;
      throwValidationError(`${field} is required`);
    }
    if (value === null || typeof value !== "string") {
      throwValidationError(`${field} must be a string`);
    }
    const trimmed = value.trim();
    if (trimmed.length < min || trimmed.length > max) {
      throwValidationError(`${field} must be between ${min} and ${max} characters`);
    }
    return trimmed;
  }

  function assertEmail(value, field, optional = false) {
    const email = assertString(value, field, { min: 3, max: 254, optional });
    if (email === undefined) return undefined;
    if (!/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email)) {
      throwValidationError(`${field} must be a valid email address`);
    }
    return email;
  }

  function assertUrl(value, field, optional = false) {
    const url = assertString(value, field, { min: 1, max: 2048, optional });
    if (url === undefined) return undefined;
    try {
      const parsed = new URL(url);
      if (!["http:", "https:"].includes(parsed.protocol)) {
        throw new Error("Invalid protocol");
      }
      return url;
    } catch {
      throwValidationError(`${field} must be a valid URL`);
    }
  }

  function parsePagination(searchParams) {
    const pageVal = searchParams.get("page");
    const pageSizeVal = searchParams.get("pageSize");
    let page = 1;
    let pageSize = 20;

    if (pageVal) {
      const parsedPage = parseInt(pageVal, 10);
      if (isNaN(parsedPage) || parsedPage < 1 || String(parsedPage) !== pageVal) {
        throwValidationError("Invalid page parameter");
      }
      page = parsedPage;
    }

    if (pageSizeVal) {
      const parsedPageSize = parseInt(pageSizeVal, 10);
      if (
        isNaN(parsedPageSize) ||
        parsedPageSize < 1 ||
        parsedPageSize > 100 ||
        String(parsedPageSize) !== pageSizeVal
      ) {
        throwValidationError("Invalid pageSize parameter");
      }
      pageSize = parsedPageSize;
    }

    return { page, pageSize };
  }

  function parseClientProfile(payload, existingProfile = {}, requireName = false) {
    const profileInput = isPlainObject(payload.profile) ? payload.profile : {};
    if (payload.profile !== undefined && !isPlainObject(payload.profile)) {
      throwValidationError("profile must be an object");
    }
    rejectUnknownFields(profileInput, ["name", "website", "phone"], "profile");

    const source = { ...existingProfile, ...profileInput };
    if (payload.name !== undefined) source.name = payload.name;
    if (payload.website !== undefined) source.website = payload.website;
    if (payload.phone !== undefined) source.phone = payload.phone;

    const profile = {};
    if (source.name !== undefined || requireName) {
      profile.name = assertString(source.name, "name", { min: 2, max: 100 });
    }
    if (source.website !== undefined) {
      profile.website = assertUrl(source.website, "website", true);
    }
    if (source.phone !== undefined) {
      profile.phone = assertString(source.phone, "phone", { min: 3, max: 40, optional: true });
    }
    return profile;
  }

  function parsePrimaryContact(payload, existingContact = {}) {
    const contactInput = isPlainObject(payload.primaryContact) ? payload.primaryContact : {};
    if (payload.primaryContact !== undefined && !isPlainObject(payload.primaryContact)) {
      throwValidationError("primaryContact must be an object");
    }
    rejectUnknownFields(contactInput, ["firstName", "lastName", "email"], "primaryContact");

    const contact = { ...existingContact, ...contactInput };
    if (payload.email !== undefined) contact.email = payload.email;

    const result = {};
    if (contact.firstName !== undefined) {
      result.firstName = assertString(contact.firstName, "primaryContact.firstName", {
        min: 1,
        max: 100,
      });
    }
    if (contact.lastName !== undefined) {
      result.lastName = assertString(contact.lastName, "primaryContact.lastName", {
        min: 1,
        max: 100,
      });
    }
    if (contact.email !== undefined) {
      result.email = assertEmail(contact.email, "email");
    }
    return Object.keys(result).length > 0 ? result : undefined;
  }

  function parseBillingDetails(payload, existingBilling = undefined) {
    if (payload.billingDetails === undefined) {
      return existingBilling;
    }
    if (!isPlainObject(payload.billingDetails)) {
      throwValidationError("billingDetails must be an object");
    }
    rejectUnknownFields(
      payload.billingDetails,
      ["taxRegistrationId", "currency", "billingAddress"],
      "billingDetails",
    );

    const billing = { ...(existingBilling ?? {}), ...payload.billingDetails };
    const result = {};
    if (billing.taxRegistrationId !== undefined) {
      result.taxRegistrationId = assertString(
        billing.taxRegistrationId,
        "billingDetails.taxRegistrationId",
        { min: 1, max: 80 },
      );
    }
    if (billing.currency !== undefined) {
      result.currency = assertString(billing.currency, "billingDetails.currency", {
        min: 3,
        max: 3,
      });
      if (!/^[A-Z]{3}$/.test(result.currency)) {
        throwValidationError("billingDetails.currency must be a 3-letter uppercase ISO code");
      }
    }
    if (billing.billingAddress !== undefined) {
      if (!isPlainObject(billing.billingAddress)) {
        throwValidationError("billingDetails.billingAddress must be an object");
      }
      rejectUnknownFields(
        billing.billingAddress,
        ["street", "city", "state", "postalCode", "country"],
        "billingAddress",
      );
      result.billingAddress = {
        street: assertString(billing.billingAddress.street, "billingAddress.street", {
          min: 1,
          max: 200,
        }),
        city: assertString(billing.billingAddress.city, "billingAddress.city", {
          min: 1,
          max: 100,
        }),
        state: assertString(billing.billingAddress.state, "billingAddress.state", {
          min: 1,
          max: 100,
        }),
        postalCode: assertString(billing.billingAddress.postalCode, "billingAddress.postalCode", {
          min: 1,
          max: 10,
        }),
        country: assertString(billing.billingAddress.country, "billingAddress.country", {
          min: 2,
          max: 2,
        }),
      };
      if (!/^[A-Z]{2}$/.test(result.billingAddress.country)) {
        throwValidationError("billingAddress.country must be a 2-letter uppercase ISO code");
      }
    }
    return Object.keys(result).length > 0 ? result : undefined;
  }

  function parseCreateClientBody(payload, ownerId) {
    if (!isPlainObject(payload)) {
      throwValidationError("Request body must be an object");
    }
    rejectNulls(payload);
    rejectUnknownFields(
      payload,
      [
        "name",
        "website",
        "phone",
        "email",
        "profile",
        "primaryContact",
        "billingDetails",
        "status",
        "ownerId",
        "tenantId",
      ],
      "client",
    );

    if (payload.status !== undefined && payload.status !== "Lead") {
      throwValidationError("status must be Lead on create");
    }

    return Client.create(
      randomUUID(),
      ownerId,
      parseClientProfile(payload, {}, true),
      parseBillingDetails(payload),
      parsePrimaryContact(payload),
    );
  }

  function parsePatchClientBody(payload, existing, ownerId) {
    if (!isPlainObject(payload)) {
      throwValidationError("Request body must be an object");
    }
    rejectNulls(payload);
    rejectUnknownFields(
      payload,
      [
        "name",
        "website",
        "phone",
        "email",
        "profile",
        "primaryContact",
        "billingDetails",
        "status",
        "ownerId",
        "tenantId",
      ],
      "client",
    );

    const client = new Client({
      id: existing.id,
      ownerId,
      status: existing.status,
      profile: existing.profile,
      billingDetails: existing.billingDetails,
      primaryContact: existing.primaryContact,
      systemMetadata: existing.systemMetadata,
    });

    const hasMutableFields = [
      "name",
      "website",
      "phone",
      "email",
      "profile",
      "primaryContact",
      "billingDetails",
    ].some((field) => payload[field] !== undefined);

    if (hasMutableFields) {
      client.updateProfile(
        ownerId,
        parseClientProfile(payload, existing.profile, true),
        parseBillingDetails(payload, existing.billingDetails),
        parsePrimaryContact(payload, existing.primaryContact),
      );
    }

    if (payload.status !== undefined) {
      if (!CLIENT_STATUSES.includes(payload.status)) {
        throwValidationError("Invalid status");
      }
      client.transitionTo(payload.status, ownerId);
    }

    return client;
  }

  function clientDto(client) {
    return {
      id: client.id,
      name: client.profile.name,
      website: client.profile.website ?? null,
      phone: client.profile.phone ?? null,
      email: client.primaryContact?.email ?? null,
      status: client.status,
      primaryContact: client.primaryContact
        ? {
            firstName: client.primaryContact.firstName ?? null,
            lastName: client.primaryContact.lastName ?? null,
            email: client.primaryContact.email ?? null,
          }
        : null,
      billingDetails: client.billingDetails
        ? {
            taxRegistrationId: client.billingDetails.taxRegistrationId ?? null,
            currency: client.billingDetails.currency ?? null,
            billingAddress: client.billingDetails.billingAddress ?? null,
          }
        : null,
      createdAt: client.systemMetadata.createdAt.toISOString(),
      updatedAt: client.systemMetadata.updatedAt.toISOString(),
    };
  }

  function handleClientApiError(err) {
    const message = err instanceof Error ? err.message : String(err);
    const statusCode = err && typeof err === "object" && err.statusCode ? err.statusCode : null;

    if (statusCode && statusCode < 500) {
      sendJson(statusCode, { success: false, error: message });
      return;
    }

    if (/duplicate client identity|duplicate key/i.test(message)) {
      sendJson(409, { success: false, error: "Client identity already exists" });
      return;
    }

    if (
      /invalid|must|required|cannot|ownership validation failed|lifecycle transition/i.test(message)
    ) {
      sendJson(400, { success: false, error: message });
      return;
    }

    logger.error({
      message: "Client API request failed",
      error: err instanceof Error ? err : new Error(String(err)),
    });
    sendJson(500, { success: false, error: "Internal Server Error" });
  }

  // Redirect authenticated users away from landing/signup/login pages to dashboard
  if (
    pathname === "/" ||
    pathname === "/landing.html" ||
    pathname === "/landing" ||
    pathname === "/index.html" ||
    pathname === "/login.html"
  ) {
    const auth = await checkAuthentication();
    if (auth) {
      res.writeHead(302, { Location: "/dashboard.html" });
      res.end();
      return;
    }
  }

  // Protect authenticated app routes
  const clientDetailRouteMatch = pathname.match(/^\/clients\/([a-zA-Z0-9-]+)$/);

  if (
    pathname === "/dashboard.html" ||
    pathname === "/dashboard" ||
    pathname === "/clients.html" ||
    pathname === "/clients" ||
    pathname === "/client-detail.html" ||
    pathname === "/search.html" ||
    pathname === "/search" ||
    pathname === "/matching.html" ||
    pathname === "/matching" ||
    pathname === "/billing.html" ||
    pathname === "/billing" ||
    pathname === "/settings.html" ||
    pathname === "/settings" ||
    clientDetailRouteMatch
  ) {
    const auth = await checkAuthentication();
    if (!auth) {
      res.writeHead(302, { Location: "/login.html" });
      res.end();
      return;
    }
    // Clean rewrite if requested without extension
    if (pathname === "/dashboard") {
      staticPathname = "/dashboard.html";
    }
    if (pathname === "/clients") {
      staticPathname = "/clients.html";
    }
    if (pathname === "/search") {
      staticPathname = "/search.html";
    }
    if (pathname === "/matching") {
      staticPathname = "/matching.html";
    }
    if (pathname === "/billing") {
      staticPathname = "/billing.html";
    }
    if (pathname === "/settings") {
      staticPathname = "/settings.html";
    }
    if (clientDetailRouteMatch) {
      staticPathname = "/client-detail.html";
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

  // 1F. Search API Error Handler (Phase 11D-8)
  function handleSearchApiError(err) {
    if (err instanceof SearchDomainError) {
      let statusCode = 400;
      if (err.code === "UNAUTHORIZED_SCOPE") {
        statusCode = 401;
      } else if (err.code === "SEARCH_PROVIDER_ERROR") {
        statusCode = 500;
      }
      sendJson(statusCode, {
        success: false,
        error: err.publicMessage,
        code: err.code,
      });
      return;
    }

    const message = err instanceof Error ? err.message : String(err);
    const statusCode = err && typeof err === "object" && err.statusCode ? err.statusCode : null;
    if (statusCode && statusCode < 500) {
      sendJson(statusCode, { success: false, error: message, code: "INVALID_SEARCH_REQUEST" });
      return;
    }

    logger.error({
      message: "Search API request failed",
      error: err instanceof Error ? err : new Error(String(err)),
    });
    sendJson(500, {
      success: false,
      error: "Search service unavailable",
      code: "SEARCH_PROVIDER_ERROR",
    });
  }

  // 1G. Unified Search API (Phase 11D-8)
  if (pathname === "/api/search" && req.method === "GET") {
    const auth = await checkAuthentication();
    const ownerId = requireAuthenticatedOwner(auth);
    if (!ownerId) return;

    try {
      const searchParams = parsedUrl.searchParams;

      // Build raw query parameter object for canonical SearchQuery validation
      const queryObj = {};
      for (const [key, value] of searchParams.entries()) {
        if (key === "q" || key === "query") {
          queryObj.query = value;
        } else if (key === "resultTypes" || key === "types") {
          const types = value
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);
          for (const t of types) {
            if (
              t.toUpperCase() === "OPPORTUNITY" ||
              !["CLIENT", "JOB", "MATCH", "TIMELINE"].includes(t.toUpperCase())
            ) {
              throw new SearchDomainError(
                "INVALID_SEARCH_REQUEST",
                `Unsupported search result type: ${t}`,
              );
            }
          }
          queryObj.resultTypes = types;
        } else if (key === "page") {
          const p = parseInt(value, 10);
          queryObj.page = isNaN(p) || String(p) !== value ? value : p;
        } else if (key === "pageSize") {
          const ps = parseInt(value, 10);
          queryObj.pageSize = isNaN(ps) || String(ps) !== value ? value : ps;
        } else {
          // Pass unknown/forged query parameters (e.g. ownerId, tenantId) directly
          // so SearchQuery.fromRaw triggers strict unknown key validation
          queryObj[key] = value;
        }
      }

      if (queryObj.query === undefined) {
        throw new SearchDomainError("INVALID_QUERY", "Search query is required.");
      }

      const searchQuery = SearchQuery.fromRaw(queryObj);

      const scope = new AuthorizedSearchScope({
        tenantId: ownerId,
        ownerId: ownerId,
      });

      const resultSet = await unifiedSearchEngine.search(searchQuery, scope);

      sendJson(200, {
        success: true,
        ...resultSet.toJSON(),
        count: resultSet.count,
        isEmpty: resultSet.isEmpty,
      });
    } catch (err) {
      handleSearchApiError(err);
    }
    return;
  }

  // =====================================================================
  // Matching API Endpoints (Phase 11E)
  // =====================================================================

  function mapMatchToDto(matchRow, jobRow) {
    const signals = matchRow.matchSignals || null;
    const baseScore =
      signals && typeof signals.semanticSimilarity === "number"
        ? signals.semanticSimilarity
        : signals && typeof signals.skillCoverage === "number"
          ? signals.skillCoverage
          : 0;
    const score = Math.round(baseScore * 100);

    const matchedSkills = Array.isArray(signals?.matchedSkills) ? signals.matchedSkills : [];
    const missingSkills = Array.isArray(signals?.missingSkills) ? signals.missingSkills : [];

    let explanation = null;
    if (matchedSkills.length > 0) {
      explanation = `Strong fit with matched skills: ${matchedSkills.join(", ")}.`;
    } else if (signals?.skillCoverage !== undefined) {
      explanation = `Evaluated with ${Math.round(signals.skillCoverage * 100)}% skill coverage.`;
    } else {
      explanation = "Compatibility evaluated against your profile.";
    }

    let risks = null;
    if (signals?.budgetCompatibility === "INCOMPATIBLE") {
      risks = "Budget parameters do not align with target rates.";
    } else if (signals?.experienceCompatibility === "INCOMPATIBLE") {
      risks = "Experience requirements exceed current profile baseline.";
    }

    let recommendations = "Review job details and submit a tailored proposal.";
    if (score >= 85) {
      recommendations = "High priority match: highlight core skill strengths in proposal.";
    } else if (score < 60) {
      recommendations = "Moderate fit: address missing skill requirements directly.";
    }

    const rawJobData = jobRow?.rawPayload || jobRow?.rawPayload?.data || {};

    return {
      id: matchRow.id,
      jobId: matchRow.jobId,
      jobTitle: rawJobData.title || jobRow?.title || "Opportunity",
      jobDescription: rawJobData.description || "",
      platform: jobRow?.source || jobRow?.platform || "Upwork",
      canonicalUrl: jobRow?.sourceUrl || jobRow?.canonicalUrl || "",
      budget: formatBudget(rawJobData.budget),
      score,
      scoreBreakdown: {
        skills: typeof signals?.skillCoverage === "number" ? signals.skillCoverage : 0,
        semantic:
          typeof signals?.semanticSimilarity === "number" ? signals.semanticSimilarity : null,
        experience: signals?.experienceCompatibility || "UNKNOWN",
        budget: signals?.budgetCompatibility || "UNKNOWN",
        jobType: signals?.jobTypeCompatibility || "UNKNOWN",
        location: signals?.locationCompatibility || "UNKNOWN",
      },
      matchSignals: signals,
      explanation,
      strengths: matchedSkills,
      gaps: missingSkills,
      risks,
      recommendations,
      status: matchRow.status,
      cacheState: "CACHED",
      createdAt:
        matchRow.createdAt instanceof Date
          ? matchRow.createdAt.toISOString()
          : String(matchRow.createdAt),
      updatedAt:
        matchRow.updatedAt instanceof Date
          ? matchRow.updatedAt.toISOString()
          : String(matchRow.updatedAt),
    };
  }

  const matchingSingleRegex = /^\/api\/matches\/([a-zA-Z0-9-]+)$/;
  const matchingSingleMatch = pathname.match(matchingSingleRegex);

  // GET /api/matches
  if (pathname === "/api/matches" && req.method === "GET") {
    const auth = await checkAuthentication();
    const ownerId = requireAuthenticatedOwner(auth);
    if (!ownerId) return;

    const tenantId = ownerId;
    const urlObj = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    const searchParams = urlObj.searchParams;

    let page = 1;
    let pageSize = 20;
    const pageVal = searchParams.get("page");
    const pageSizeVal = searchParams.get("pageSize");
    const status = searchParams.get("status")?.trim().toUpperCase();
    const minScoreVal = searchParams.get("minScore") || searchParams.get("score");
    const platform = searchParams.get("platform")?.trim().toLowerCase();

    if (pageVal) {
      const p = parseInt(pageVal, 10);
      if (isNaN(p) || p < 1 || String(p) !== pageVal) {
        sendJson(400, { success: false, error: "Invalid page parameter" });
        return;
      }
      page = p;
    }

    if (pageSizeVal) {
      const ps = parseInt(pageSizeVal, 10);
      if (isNaN(ps) || ps < 1 || ps > 20 || String(ps) !== pageSizeVal) {
        sendJson(400, { success: false, error: "Invalid pageSize parameter" });
        return;
      }
      pageSize = ps;
    }

    if (status && !["CREATED", "EVALUATED", "ARCHIVED"].includes(status)) {
      sendJson(400, { success: false, error: "Invalid status parameter" });
      return;
    }

    let minScore = null;
    if (minScoreVal) {
      const ms = parseInt(minScoreVal, 10);
      if (isNaN(ms) || ms < 0 || ms > 100 || String(ms) !== minScoreVal) {
        sendJson(400, { success: false, error: "Invalid minScore parameter" });
        return;
      }
      minScore = ms;
    }

    try {
      const whereConditions = [eq(jobMatches.tenantId, tenantId), eq(jobMatches.ownerId, ownerId)];

      if (status) {
        whereConditions.push(eq(jobMatches.status, status));
      }

      const matchRows = await db
        .select()
        .from(jobMatches)
        .where(and(...whereConditions));

      const jobIds = [...new Set(matchRows.map((m) => m.jobId))];
      const jobRows =
        jobIds.length > 0
          ? await db
              .select()
              .from(jobImports)
              .where(and(eq(jobImports.tenantId, tenantId), inArray(jobImports.id, jobIds)))
          : [];

      const jobMap = new Map();
      jobRows.forEach((j) => {
        jobMap.set(j.id, j);
      });

      let mappedMatches = matchRows.map((m) => mapMatchToDto(m, jobMap.get(m.jobId)));

      if (minScore !== null) {
        mappedMatches = mappedMatches.filter((m) => m.score >= minScore);
      }

      if (platform) {
        mappedMatches = mappedMatches.filter(
          (m) => m.platform && m.platform.toLowerCase() === platform,
        );
      }

      // Deterministic sort: score DESC, createdAt DESC, id DESC
      mappedMatches.sort((a, b) => {
        if (b.score !== a.score) {
          return b.score - a.score;
        }
        const timeA = new Date(a.createdAt).getTime();
        const timeB = new Date(b.createdAt).getTime();
        if (timeB !== timeA) {
          return timeB - timeA;
        }
        return b.id.localeCompare(a.id);
      });

      const total = mappedMatches.length;
      const offset = (page - 1) * pageSize;
      const paginatedMatches = mappedMatches.slice(offset, offset + pageSize);
      const totalPages = Math.max(1, Math.ceil(total / pageSize));

      sendJson(200, {
        success: true,
        matches: paginatedMatches,
        total,
        page,
        pageSize,
        totalPages,
        count: paginatedMatches.length,
        isEmpty: paginatedMatches.length === 0,
      });
    } catch (err) {
      logger.error({ message: "Failed to fetch matches API", error: err });
      sendJson(500, { success: false, error: "Internal Server Error" });
    }
    return;
  }

  // GET /api/matches/:id
  if (matchingSingleMatch && req.method === "GET") {
    const auth = await checkAuthentication();
    const ownerId = requireAuthenticatedOwner(auth);
    if (!ownerId) return;

    const matchId = matchingSingleMatch[1];
    const tenantId = ownerId;

    try {
      const matchRows = await db
        .select()
        .from(jobMatches)
        .where(
          and(
            eq(jobMatches.id, matchId),
            eq(jobMatches.tenantId, tenantId),
            eq(jobMatches.ownerId, ownerId),
          ),
        )
        .limit(1);

      if (matchRows.length === 0) {
        sendJson(404, { success: false, error: "Match not found" });
        return;
      }

      const matchRow = matchRows[0];
      const jobRows = await db
        .select()
        .from(jobImports)
        .where(and(eq(jobImports.id, matchRow.jobId), eq(jobImports.tenantId, tenantId)))
        .limit(1);

      const jobRow = jobRows[0] || null;
      const dto = mapMatchToDto(matchRow, jobRow);

      sendJson(200, { success: true, match: dto });
    } catch (err) {
      logger.error({ message: "Failed to fetch single match", error: err });
      sendJson(500, { success: false, error: "Internal Server Error" });
    }
    return;
  }

  // PATCH /api/matches/:id
  if (matchingSingleMatch && req.method === "PATCH") {
    const auth = await checkAuthentication();
    const ownerId = requireAuthenticatedOwner(auth);
    if (!ownerId) return;

    const matchId = matchingSingleMatch[1];
    const tenantId = ownerId;

    try {
      const body = await readJsonBody();
      if (!body || body.status !== "ARCHIVED") {
        sendJson(400, {
          success: false,
          error: "Invalid status mutation. Only ARCHIVED status is supported.",
        });
        return;
      }

      const matchRows = await db
        .select()
        .from(jobMatches)
        .where(
          and(
            eq(jobMatches.id, matchId),
            eq(jobMatches.tenantId, tenantId),
            eq(jobMatches.ownerId, ownerId),
          ),
        )
        .limit(1);

      if (matchRows.length === 0) {
        sendJson(404, { success: false, error: "Match not found" });
        return;
      }

      const matchRow = matchRows[0];
      const updatedDate = new Date();

      await db
        .update(jobMatches)
        .set({ status: "ARCHIVED", updatedAt: updatedDate })
        .where(and(eq(jobMatches.id, matchId), eq(jobMatches.tenantId, tenantId)));

      matchRow.status = "ARCHIVED";
      matchRow.updatedAt = updatedDate;

      const jobRows = await db
        .select()
        .from(jobImports)
        .where(and(eq(jobImports.id, matchRow.jobId), eq(jobImports.tenantId, tenantId)))
        .limit(1);

      const jobRow = jobRows[0] || null;
      const dto = mapMatchToDto(matchRow, jobRow);

      sendJson(200, { success: true, match: dto });
    } catch (err) {
      logger.error({ message: "Failed to patch match", error: err });
      sendJson(500, { success: false, error: "Internal Server Error" });
    }
    return;
  }

  function timelineEntryDto(entry) {
    const message = safeTimelineMessage(entry.metadata?.message);
    return {
      id: entry.entryId,
      eventRef: entry.eventRef ?? null,
      category: entry.category,
      timestamp: entry.timestamp.toISOString(),
      message,
      visibility: entry.visibility,
    };
  }

  function safeTimelineMessage(value) {
    if (typeof value !== "string" || !value.trim()) {
      return "Timeline event recorded";
    }
    const message = value.trim();
    if (
      /(password|token|cookie|credential|secret|stripe|postgres|database|db_|sql|stack trace|traceback)/i.test(
        message,
      )
    ) {
      return "Timeline event recorded";
    }
    return message;
  }

  const BRAIN_ANALYSIS_STATUSES = [
    "REQUESTED",
    "RUNNING",
    "COMPLETED",
    "FAILED",
    "TIMEOUT",
    "INSUFFICIENT_CONTEXT",
  ];
  const brainDetailMatch = pathname.match(/^\/api\/brain\/analyses\/([a-zA-Z0-9-]+)$/);

  function assertIdArray(value, field, { optional = true, max = 25 } = {}) {
    if (value === undefined) {
      if (optional) return [];
      throwValidationError(`${field} is required`);
    }
    if (!Array.isArray(value)) {
      throwValidationError(`${field} must be an array`);
    }
    if (value.length > max) {
      throwValidationError(`${field} cannot contain more than ${max} IDs`);
    }
    return value.map((item, index) => {
      const id = assertString(item, `${field}[${index}]`, { min: 1, max: 128 });
      if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(id)) {
        throwValidationError(`${field}[${index}] has an invalid ID format`);
      }
      return id;
    });
  }

  function parseBrainConstraints(value) {
    if (value === undefined) {
      return undefined;
    }
    if (!isPlainObject(value)) {
      throwValidationError("constraints must be an object");
    }
    rejectUnknownFields(
      value,
      ["maxRecommendations", "maxInsights", "responseFormat"],
      "constraints",
    );
    const constraints = {};
    for (const field of ["maxRecommendations", "maxInsights"]) {
      if (value[field] !== undefined) {
        if (!Number.isInteger(value[field]) || value[field] < 1 || value[field] > 10) {
          throwValidationError(`${field} must be between 1 and 10`);
        }
        constraints[field] = value[field];
      }
    }
    if (value.responseFormat !== undefined) {
      if (value.responseFormat !== "structured") {
        throwValidationError("responseFormat must be structured");
      }
      constraints.responseFormat = value.responseFormat;
    }
    return constraints;
  }

  function parseBrainCreateBody(payload) {
    if (!isPlainObject(payload)) {
      throwValidationError("Request body must be an object");
    }
    rejectUnknownFields(
      payload,
      ["analysisType", "context", "constraints", "idempotencyKey", "ownerId", "tenantId"],
      "brain analysis",
    );

    const analysisType = parseBrainAnalysisType(
      assertString(payload.analysisType, "analysisType", { min: 1, max: 64 }),
    );
    const idempotencyKey =
      payload.idempotencyKey === undefined
        ? undefined
        : assertString(payload.idempotencyKey, "idempotencyKey", { min: 8, max: 128 });
    if (idempotencyKey && !/^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/.test(idempotencyKey)) {
      throwValidationError("idempotencyKey has an invalid format");
    }

    const contextInput = payload.context ?? {};
    if (!isPlainObject(contextInput)) {
      throwValidationError("context must be an object");
    }
    rejectUnknownFields(
      contextInput,
      ["clientIds", "jobIds", "matchIds", "timelineIds", "businessSignals"],
      "brain context",
    );

    const businessSignals = contextInput.businessSignals ?? [];
    if (!Array.isArray(businessSignals)) {
      throwValidationError("businessSignals must be an array");
    }
    if (businessSignals.length > 10) {
      throwValidationError("businessSignals cannot contain more than 10 signals");
    }
    const parsedBusinessSignals = businessSignals.map((signal, index) => {
      if (!isPlainObject(signal)) {
        throwValidationError(`businessSignals[${index}] must be an object`);
      }
      rejectUnknownFields(signal, ["metric", "value", "unit"], `businessSignals[${index}]`);
      const metric = assertString(signal.metric, `businessSignals[${index}].metric`, {
        min: 1,
        max: 80,
      });
      if (!Number.isFinite(signal.value)) {
        throwValidationError(`businessSignals[${index}].value must be a finite number`);
      }
      const unit =
        signal.unit === undefined
          ? undefined
          : assertString(signal.unit, `businessSignals[${index}].unit`, { min: 1, max: 32 });
      return { metric, value: signal.value, unit };
    });

    return {
      analysisType,
      idempotencyKey,
      constraints: parseBrainConstraints(payload.constraints),
      clientIds: assertIdArray(contextInput.clientIds, "context.clientIds"),
      jobIds: assertIdArray(contextInput.jobIds, "context.jobIds"),
      matchIds: assertIdArray(contextInput.matchIds, "context.matchIds"),
      timelineIds: assertIdArray(contextInput.timelineIds, "context.timelineIds"),
      businessSignals: parsedBusinessSignals,
    };
  }

  async function buildBrainContext(input, ownerId) {
    const scope = new BrainScope({ tenantId: ownerId, ownerId, actorId: ownerId });
    const clients = [];
    const jobs = [];
    const matches = [];
    const timelines = [];
    const businessSignals = input.businessSignals.map((signal, index) => ({
      signalId: `business-${index + 1}`,
      tenantId: scope.tenantId,
      ownerId: scope.ownerId,
      ...signal,
    }));

    for (const clientId of input.clientIds) {
      const client = await clientRepo.findById(clientId, ownerId);
      if (!client) {
        const err = new Error("Referenced resource not found");
        err.statusCode = 404;
        throw err;
      }
      clients.push({
        signalId: `client-${client.id}`,
        tenantId: scope.tenantId,
        ownerId: scope.ownerId,
        clientId: client.id,
        name: client.profile.name,
        status: client.status,
      });
    }

    for (const jobId of input.jobIds) {
      const job = await jobsRepo.findById(jobId, ownerId);
      if (!job) {
        const err = new Error("Referenced resource not found");
        err.statusCode = 404;
        throw err;
      }
      jobs.push({
        signalId: `job-${job.id}`,
        tenantId: scope.tenantId,
        ownerId: scope.ownerId,
        jobId: job.id,
        title: job.rawPayload.data.title,
        source: job.externalIdentity.source.value,
        requiredSkills: Array.isArray(job.rawPayload.data.skills) ? job.rawPayload.data.skills : [],
      });
    }

    for (const matchId of input.matchIds) {
      const match = await matchRepo.findById(matchId, ownerId);
      if (!match) {
        const err = new Error("Referenced resource not found");
        err.statusCode = 404;
        throw err;
      }
      matches.push({
        signalId: `match-${match.id}`,
        tenantId: scope.tenantId,
        ownerId: scope.ownerId,
        matchId: match.id,
        jobId: match.jobId,
        score:
          typeof match.matchSignals?.semanticSimilarity === "number"
            ? match.matchSignals.semanticSimilarity
            : undefined,
        strengths: Array.isArray(match.matchSignals?.matchedSkills)
          ? match.matchSignals.matchedSkills
          : [],
        risks: [],
      });
    }

    for (const timelineId of input.timelineIds) {
      const timeline = await timelineRepo.findById(timelineId, ownerId);
      if (!timeline) {
        const err = new Error("Referenced resource not found");
        err.statusCode = 404;
        throw err;
      }
      const latest = [...timeline.entries].sort(
        (a, b) => b.timestamp.getTime() - a.timestamp.getTime(),
      )[0];
      timelines.push({
        signalId: `timeline-${timeline.timelineId}`,
        tenantId: scope.tenantId,
        ownerId: scope.ownerId,
        timelineId: timeline.timelineId,
        clientId: timeline.clientId,
        eventCount: timeline.entries.length,
        latestEventAt: latest?.timestamp,
      });
    }

    return new BrainContext({ scope, clients, jobs, matches, timelines, businessSignals });
  }

  function brainFailureStatus(code) {
    if (
      code === "INVALID_REQUEST" ||
      code === "UNSUPPORTED_ANALYSIS" ||
      code === "INSUFFICIENT_CONTEXT"
    ) {
      return 400;
    }
    if (code === "UNAUTHORIZED_CONTEXT") {
      return 403;
    }
    if (code === "ENTITLEMENT_UNAVAILABLE" || code === "PROVIDER_UNAVAILABLE") {
      return 503;
    }
    if (code === "PROVIDER_TIMEOUT") {
      return 504;
    }
    return 500;
  }

  function brainAnalysisDto(analysis) {
    let decision = null;
    if (analysis.status === "COMPLETED") {
      try {
        const resultObj = new BrainResult({
          analysisId: analysis.id,
          analysisType: analysis.analysisType,
          status: analysis.status,
          summary: analysis.summary ?? "",
          insights: analysis.insights,
          recommendations: analysis.recommendations,
          confidence: analysis.confidence,
          evidence: analysis.evidence,
          generatedAt: analysis.completedAt ?? analysis.createdAt,
          scope: analysis.scope,
        });
        decision = brainDecisionDeriver.derive(resultObj);
      } catch {
        decision = null;
      }
    }

    return {
      analysisId: analysis.id,
      analysisType: analysis.analysisType,
      status: analysis.status,
      summary: analysis.summary ?? null,
      insights: analysis.insights.map((insight) => ({
        insightId: insight.insightId,
        title: insight.title,
        body: insight.body,
      })),
      recommendations: analysis.recommendations.map((recommendation) => ({
        recommendationId: recommendation.recommendationId,
        action: recommendation.action,
        rationale: recommendation.rationale,
        priority: recommendation.priority,
      })),
      confidence: analysis.confidence ? analysis.confidence.toJSON() : null,
      evidence: analysis.evidence.map((item) => item.toJSON()),
      decision,
      failure: analysis.failure
        ? {
            code: analysis.failure.code,
            message: analysis.failure.message,
            retryable: analysis.failure.retryable,
          }
        : null,
      createdAt: analysis.createdAt.toISOString(),
      startedAt: analysis.claimedAt ? analysis.claimedAt.toISOString() : null,
      completedAt: analysis.completedAt ? analysis.completedAt.toISOString() : null,
    };
  }

  function brainResultDto(result) {
    const dto = result.toJSON();
    let decision = null;
    if (result.status === "COMPLETED") {
      try {
        decision = brainDecisionDeriver.derive(result);
      } catch {
        decision = null;
      }
    }

    return {
      analysisId: dto.analysisId,
      analysisType: dto.analysisType,
      status: dto.status,
      summary: dto.summary,
      insights: dto.insights.map((insight) => ({
        insightId: insight.insightId,
        title: insight.title,
        body: insight.body,
      })),
      recommendations: dto.recommendations.map((recommendation) => ({
        recommendationId: recommendation.recommendationId,
        action: recommendation.action,
        rationale: recommendation.rationale,
        priority: recommendation.priority,
      })),
      confidence: dto.confidence.toJSON(),
      evidence: dto.evidence.map((item) => item.toJSON()),
      decision,
      failure: dto.failure
        ? { code: dto.failure.code, message: dto.failure.message, retryable: dto.failure.retryable }
        : null,
      createdAt: dto.generatedAt.toISOString(),
      startedAt: null,
      completedAt: dto.status === "COMPLETED" ? dto.generatedAt.toISOString() : null,
    };
  }

  function handleBrainApiError(err) {
    if (err instanceof BrainDomainError) {
      sendJson(brainFailureStatus(err.code), {
        success: false,
        error: err.publicMessage,
        code: err.code,
      });
      return;
    }
    if (err instanceof BrainFailure) {
      sendJson(brainFailureStatus(err.code), {
        success: false,
        error: err.message,
        code: err.code,
      });
      return;
    }
    const message = err instanceof Error ? err.message : String(err);
    const statusCode = err && typeof err === "object" && err.statusCode ? err.statusCode : null;
    if (statusCode && statusCode < 500) {
      sendJson(statusCode, { success: false, error: message });
      return;
    }
    logger.error({
      message: "Brain API request failed",
      error: err instanceof Error ? err : new Error(String(err)),
    });
    sendJson(500, { success: false, error: "Internal Server Error" });
  }

  if (pathname === "/api/brain/analyses" && req.method === "POST") {
    const auth = await checkAuthentication();
    const ownerId = requireAuthenticatedOwner(auth);
    if (!ownerId) return;

    const controller = new AbortController();
    req.on("aborted", () => controller.abort());

    try {
      const payload = await readJsonBody();
      const input = parseBrainCreateBody(payload);
      const context = await buildBrainContext(input, ownerId);
      const requestId = randomUUID();
      const request = new BrainAnalysisRequest({
        analysisType: input.analysisType,
        context,
        metadata: new BrainRequestMetadata({
          requestId,
          correlationId: Array.isArray(req.headers["x-request-id"])
            ? req.headers["x-request-id"][0]
            : req.headers["x-request-id"] || requestId,
          requestedAt: new Date(),
          idempotencyKey: input.idempotencyKey,
        }),
        constraints: input.constraints,
      });

      const result = await brainExecutionService.analyze(request, {
        timeoutMs: 5000,
        signal: controller.signal,
      });
      const statusCode =
        result.status === "COMPLETED"
          ? 201
          : brainFailureStatus(result.failure?.code ?? "INTERNAL_FAILURE");
      sendJson(statusCode, {
        success: result.status === "COMPLETED",
        analysis: brainResultDto(result),
      });
    } catch (err) {
      handleBrainApiError(err);
    }
    return;
  }

  if (pathname === "/api/brain/analyses" && req.method === "GET") {
    const auth = await checkAuthentication();
    const ownerId = requireAuthenticatedOwner(auth);
    if (!ownerId) return;

    try {
      const { page, pageSize } = parsePagination(parsedUrl.searchParams);
      const rawType = parsedUrl.searchParams.get("analysisType");
      const rawStatus = parsedUrl.searchParams.get("status");
      const filters = { limit: pageSize, offset: (page - 1) * pageSize };
      if (rawType) {
        filters.analysisType = parseBrainAnalysisType(rawType);
      }
      if (rawStatus) {
        if (!BRAIN_ANALYSIS_STATUSES.includes(rawStatus)) {
          throwValidationError("Invalid status parameter");
        }
        filters.status = rawStatus;
      }
      const scope = new BrainScope({ tenantId: ownerId, ownerId, actorId: ownerId });
      const result = await brainAnalysisRepo.listByScope(scope, filters);
      sendJson(200, {
        success: true,
        analyses: result.items.map(brainAnalysisDto),
        total: result.total,
        page,
        pageSize,
      });
    } catch (err) {
      handleBrainApiError(err);
    }
    return;
  }

  if (brainDetailMatch && req.method === "GET") {
    const auth = await checkAuthentication();
    const ownerId = requireAuthenticatedOwner(auth);
    if (!ownerId) return;

    try {
      const scope = new BrainScope({ tenantId: ownerId, ownerId, actorId: ownerId });
      const analysis = await brainAnalysisRepo.findById(brainDetailMatch[1], scope);
      if (!analysis) {
        sendJson(404, { success: false, error: "Brain analysis not found" });
        return;
      }
      sendJson(200, { success: true, analysis: brainAnalysisDto(analysis) });
    } catch (err) {
      handleBrainApiError(err);
    }
    return;
  }

  // 1F. Client API contracts
  const clientIdMatch = pathname.match(/^\/api\/clients\/([a-zA-Z0-9-]+)$/);
  const clientTimelineMatch = pathname.match(/^\/api\/clients\/([a-zA-Z0-9-]+)\/timeline$/);

  if (pathname === "/api/clients" && req.method === "GET") {
    const auth = await checkAuthentication();
    const ownerId = requireAuthenticatedOwner(auth);
    if (!ownerId) return;

    try {
      const { page, pageSize } = parsePagination(parsedUrl.searchParams);
      const status = parsedUrl.searchParams.get("status") || undefined;
      if (status && !CLIENT_STATUSES.includes(status)) {
        throwValidationError("Invalid status parameter");
      }

      const result = await clientRepo.list(ownerId, { page, pageSize, status });
      sendJson(200, {
        success: true,
        clients: result.items.map(clientDto),
        total: result.total,
        page: result.page,
        pageSize: result.pageSize,
      });
    } catch (err) {
      handleClientApiError(err);
    }
    return;
  }

  if (clientIdMatch && req.method === "GET") {
    const auth = await checkAuthentication();
    const ownerId = requireAuthenticatedOwner(auth);
    if (!ownerId) return;

    try {
      const client = await clientRepo.findById(clientIdMatch[1], ownerId);
      if (!client) {
        sendJson(404, { success: false, error: "Client not found" });
        return;
      }
      sendJson(200, { success: true, client: clientDto(client) });
    } catch (err) {
      handleClientApiError(err);
    }
    return;
  }

  if (clientTimelineMatch && req.method === "GET") {
    const auth = await checkAuthentication();
    const ownerId = requireAuthenticatedOwner(auth);
    if (!ownerId) return;

    try {
      const { page, pageSize } = parsePagination(parsedUrl.searchParams);
      const client = await clientRepo.findById(clientTimelineMatch[1], ownerId);
      if (!client) {
        sendJson(404, { success: false, error: "Client not found" });
        return;
      }

      const timelinePage = await timelineRepo.findTimelineEntriesByClientId(client.id, ownerId, {
        page,
        pageSize,
      });

      sendJson(200, {
        success: true,
        timeline: {
          id: timelinePage.timelineId,
          clientId: client.id,
          status: timelinePage.status ?? "Initialized",
          entries: timelinePage.items.map(timelineEntryDto),
          total: timelinePage.total,
          page,
          pageSize,
        },
      });
    } catch (err) {
      handleClientApiError(err);
    }
    return;
  }

  if (pathname === "/api/clients" && req.method === "POST") {
    const auth = await checkAuthentication();
    const ownerId = requireAuthenticatedOwner(auth);
    if (!ownerId) return;

    try {
      const payload = await readJsonBody();
      const client = parseCreateClientBody(payload, ownerId);
      await clientRepo.create(client);
      sendJson(201, { success: true, client: clientDto(client) });
    } catch (err) {
      handleClientApiError(err);
    }
    return;
  }

  if (clientIdMatch && req.method === "PATCH") {
    const auth = await checkAuthentication();
    const ownerId = requireAuthenticatedOwner(auth);
    if (!ownerId) return;

    try {
      const existing = await clientRepo.findById(clientIdMatch[1], ownerId);
      if (!existing) {
        sendJson(404, { success: false, error: "Client not found" });
        return;
      }

      const payload = await readJsonBody();
      const updated = parsePatchClientBody(payload, existing, ownerId);
      await clientRepo.update(updated, ownerId);
      sendJson(200, { success: true, client: clientDto(updated) });
    } catch (err) {
      handleClientApiError(err);
    }
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

  // =====================================================================
  // Phase 11F: Billing API Endpoints
  // =====================================================================

  // GET /api/billing/plans
  if (pathname === "/api/billing/plans" && req.method === "GET") {
    try {
      const plans = [
        planCatalog.getPlan("STARTER"),
        planCatalog.getPlan("PRO"),
        planCatalog.getPlan("POWER_BIDDER"),
      ].filter((p) => Boolean(p && p.lifecycleState === "ACTIVE"));

      const plansDto = plans.map((p) => {
        const pricesDto = p.prices.map((pr) => {
          let formatted = "";
          if (pr.currency === "USD") {
            formatted = `$${(pr.amountMinor / 100).toFixed(pr.amountMinor % 100 === 0 ? 0 : 2)}`;
          } else if (pr.currency === "INR") {
            formatted = `₹${(pr.amountMinor / 100).toFixed(0)}`;
          } else if (pr.currency === "GBP") {
            formatted = `£${(pr.amountMinor / 100).toFixed(pr.amountMinor % 100 === 0 ? 0 : 2)}`;
          } else if (pr.currency === "EUR") {
            formatted = `€${(pr.amountMinor / 100).toFixed(pr.amountMinor % 100 === 0 ? 0 : 2)}`;
          } else {
            formatted = `${pr.currency} ${(pr.amountMinor / 100).toFixed(2)}`;
          }

          return {
            region: pr.region,
            currency: pr.currency,
            amountMinor: pr.amountMinor,
            formatted,
            interval: pr.interval,
            version: pr.version,
          };
        });

        let description = "";
        if (p.planId === "STARTER") {
          description = "Essential features for freelancers starting out.";
        } else if (p.planId === "PRO") {
          description = "Advanced matching, full explanations, and higher proposal limits.";
        } else if (p.planId === "POWER_BIDDER") {
          description = "High-volume bidding across multiple workspaces with priority generation.";
        }

        return {
          planId: p.planId,
          code: p.code,
          name: p.displayName,
          description,
          lifecycleState: p.lifecycleState,
          features: Array.from(p.features),
          limits: p.limits,
          prices: pricesDto,
          billingInterval: "MONTHLY",
        };
      });

      sendJson(200, {
        success: true,
        plans: plansDto,
      });
    } catch (err) {
      logger.error({ message: "Failed to fetch billing plans", error: err });
      sendJson(500, { success: false, error: "Internal Server Error" });
    }
    return;
  }

  // GET /api/billing/subscription
  if (pathname === "/api/billing/subscription" && req.method === "GET") {
    const auth = await checkAuthentication();
    const ownerId = requireAuthenticatedOwner(auth);
    if (!ownerId) return;

    const tenantId = `tenant_${ownerId}`;
    const now = new Date();

    try {
      const effectivePlanResult = await entitlementResolver.resolveEffectivePlan(
        tenantId,
        ownerId,
        now,
      );
      const plan = effectivePlanResult.plan;
      const period = effectivePlanResult.period;
      const source = effectivePlanResult.source;

      // Construct usage keys
      const proposalKey = `usage:${tenantId}:AI_PROPOSAL:${period.startedAt.getTime()}:${period.endsAt.getTime()}`;
      const proposalsUsed = await usageRepo.getUsage(proposalKey);

      const scanKey = `usage:${tenantId}:JOB_SCAN:${period.startedAt.getTime()}:${period.endsAt.getTime()}`;
      const scansUsed = await usageRepo.getUsage(scanKey);

      let trialDaysRemaining = null;
      if (source === "TRIAL") {
        const diffMs = period.endsAt.getTime() - now.getTime();
        trialDaysRemaining = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
      }

      // Check customer mapping for Stripe customer existence
      const customerMapping = await customerMappingRepo.findByTenantId(tenantId);
      let subStatus =
        source === "SUBSCRIPTION" ? "active" : source === "TRIAL" ? "trialing" : "free";

      const subRecord = await subscriptionRepo.findByTenantId(tenantId);
      if (subRecord && subRecord.status) {
        subStatus = subRecord.status;
      }

      sendJson(200, {
        success: true,
        planId: plan.planId,
        planName: plan.displayName,
        source,
        status: subStatus,
        billingInterval: "MONTHLY",
        period: {
          type: period.type,
          startedAt: period.startedAt.toISOString(),
          endsAt: period.endsAt.toISOString(),
        },
        trialDaysRemaining,
        limits: {
          jobScans: plan.limits.jobScans,
          aiProposals: plan.limits.aiProposals,
          maxWorkspaces: plan.limits.maxWorkspaces,
        },
        usage: {
          jobScans: scansUsed,
          aiProposals: proposalsUsed,
        },
        hasCustomer: Boolean(customerMapping),
      });
    } catch (err) {
      logger.error({ message: "Failed to fetch billing subscription", error: err });
      sendJson(500, { success: false, error: "Internal Server Error" });
    }
    return;
  }

  // POST /api/billing/checkout
  if (pathname === "/api/billing/checkout" && req.method === "POST") {
    const auth = await checkAuthentication();
    const ownerId = requireAuthenticatedOwner(auth);
    if (!ownerId) return;

    const tenantId = `tenant_${ownerId}`;

    try {
      const body = await readJsonBody();
      if (!body || typeof body !== "object") {
        sendJson(400, { success: false, error: "Invalid request payload" });
        return;
      }

      const planId = body.planId;
      if (!planId || !["PRO", "POWER_BIDDER"].includes(planId)) {
        sendJson(400, {
          success: false,
          error:
            planId === "STARTER"
              ? "Starter/free plan cannot be processed via paid checkout."
              : "Invalid planId. Supported checkout plans are PRO and POWER_BIDDER.",
        });
        return;
      }

      const host = req.headers.host || "localhost";
      const protocol = req.headers["x-forwarded-proto"] || "http";
      const origin = `${protocol}://${host}`;

      const successUrl = `${origin}/billing.html?checkout=success`;
      const cancelUrl = `${origin}/billing.html?checkout=cancel`;

      const checkoutResult = await stripeBillingProvider.createCheckoutSession({
        tenantId,
        ownerId,
        planId,
        version: typeof body.version === "number" ? body.version : 1,
        countryCode: typeof body.countryCode === "string" ? body.countryCode : undefined,
        successUrl,
        cancelUrl,
      });

      if (!checkoutResult || !checkoutResult.checkoutUrl) {
        sendJson(500, { success: false, error: "Failed to generate checkout URL." });
        return;
      }

      sendJson(200, {
        success: true,
        sessionId: checkoutResult.sessionId,
        checkoutUrl: checkoutResult.checkoutUrl,
      });
    } catch (err) {
      logger.error({ message: "Failed to create checkout session", error: err });
      const isStripeError = err instanceof StripeBillingError;
      const isUserError =
        isStripeError && err.code !== "STRIPE_TIMEOUT" && err.code !== "STRIPE_UNAVAILABLE";
      const msg = isStripeError ? err.message : "Internal Server Error";
      sendJson(isUserError ? 400 : 500, { success: false, error: msg });
    }
    return;
  }

  // POST /api/billing/portal
  if (pathname === "/api/billing/portal" && req.method === "POST") {
    const auth = await checkAuthentication();
    const ownerId = requireAuthenticatedOwner(auth);
    if (!ownerId) return;

    const tenantId = `tenant_${ownerId}`;

    try {
      const host = req.headers.host || "localhost";
      const protocol = req.headers["x-forwarded-proto"] || "http";
      const origin = `${protocol}://${host}`;
      const returnUrl = `${origin}/billing.html`;

      const portalResult = await stripeBillingProvider.createPortalSession({
        tenantId,
        ownerId,
        returnUrl,
      });

      if (!portalResult || !portalResult.portalUrl) {
        sendJson(500, { success: false, error: "Failed to generate portal URL." });
        return;
      }

      sendJson(200, {
        success: true,
        portalUrl: portalResult.portalUrl,
      });
    } catch (err) {
      logger.error({ message: "Failed to create customer portal session", error: err });
      const isStripeError = err instanceof StripeBillingError;
      let statusCode = 500;
      if (isStripeError && err.code === "CUSTOMER_NOT_FOUND") {
        statusCode = 404;
      } else if (
        isStripeError &&
        err.code !== "STRIPE_TIMEOUT" &&
        err.code !== "STRIPE_UNAVAILABLE"
      ) {
        statusCode = 400;
      }
      const msg = isStripeError
        ? err.message
        : "Failed to create customer portal session. Please try again.";
      sendJson(statusCode, { success: false, error: msg });
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
      if (action === "summary") {
        const ownerId = userId;
        const billingTenantId = `tenant_${ownerId}`;

        // Concurrently query domain aggregates with tenant/owner isolation
        const [
          userRows,
          sessionRows,
          timelineData,
          clientData,
          scannedRows,
          matchRows,
          effectivePlanResult,
        ] = await Promise.all([
          Promise.resolve(
            db
              .select({
                id: users.id,
                createdAt: users.createdAt,
              })
              .from(users)
              .where(eq(users.id, userId))
              .limit(1),
          ).catch(() => []),
          Promise.resolve(
            db
              .select({
                id: sessions.id,
                createdAt: sessions.createdAt,
                lastActivityAt: sessions.lastActivityAt,
                expiresAt: sessions.expiresAt,
                revokedAt: sessions.revokedAt,
              })
              .from(sessions)
              .where(eq(sessions.userId, userId)),
          ).catch(() => []),
          Promise.resolve(
            timelineRepo.findTimelineEntriesByOwner(ownerId, { page: 1, pageSize: 100 }),
          )
            .then((r) => (r && r.items ? r.items : []))
            .catch(() => []),
          Promise.resolve(clientRepo.list(ownerId, { pageSize: 100 }))
            .then((r) => (r && r.items ? r.items : []))
            .catch(() => []),
          Promise.resolve(
            db
              .select({
                id: jobImports.id,
                createdAt: jobImports.createdAt,
              })
              .from(jobImports)
              .where(eq(jobImports.tenantId, tenantId)),
          ).catch(() => []),
          Promise.resolve(
            db
              .select({
                id: jobMatches.id,
                jobId: jobMatches.jobId,
                status: jobMatches.status,
                matchSignals: jobMatches.matchSignals,
                createdAt: jobMatches.createdAt,
              })
              .from(jobMatches)
              .where(eq(jobMatches.tenantId, tenantId)),
          ).catch(() => []),
          Promise.resolve(
            entitlementResolver.resolveEffectivePlan(billingTenantId, userId, new Date()),
          ).catch(() => null),
        ]);

        // 1. Activation domain
        const user = userRows[0];
        const registeredAt =
          user && user.createdAt
            ? new Date(user.createdAt).toISOString()
            : new Date().toISOString();
        const hasScannedJobs = (scannedRows?.length || 0) > 0;
        const hasGeneratedMatches = (matchRows?.length || 0) > 0;
        const hasCreatedClients = (clientData?.length || 0) > 0;
        const isActivated = hasScannedJobs || hasGeneratedMatches || hasCreatedClients;

        // 2. Retention domain
        const now = new Date();
        const activeSessions = (sessionRows || []).filter(
          (s) => !s.revokedAt && new Date(s.expiresAt) > now,
        );
        const activeSessionsCount = activeSessions.length;

        const activeDaysSet = new Set();
        let mostRecentActivity = user?.createdAt
          ? new Date(user.createdAt).getTime()
          : now.getTime();

        (sessionRows || []).forEach((s) => {
          if (s.lastActivityAt) {
            const d = new Date(s.lastActivityAt);
            activeDaysSet.add(d.toISOString().slice(0, 10));
            if (d.getTime() > mostRecentActivity) mostRecentActivity = d.getTime();
          }
          if (s.createdAt) {
            const d = new Date(s.createdAt);
            activeDaysSet.add(d.toISOString().slice(0, 10));
            if (d.getTime() > mostRecentActivity) mostRecentActivity = d.getTime();
          }
        });

        (timelineData || []).forEach((t) => {
          if (t.timestamp) {
            const d = new Date(t.timestamp);
            activeDaysSet.add(d.toISOString().slice(0, 10));
            if (d.getTime() > mostRecentActivity) mostRecentActivity = d.getTime();
          }
        });

        const activeDaysCount = Math.max(1, activeDaysSet.size);
        const lastActiveAt = new Date(mostRecentActivity).toISOString();

        // 3. Matching domain
        const totalScanned = scannedRows?.length || 0;
        const totalMatches = matchRows?.length || 0;

        let totalScore = 0;
        let scoreCount = 0;
        const scoreDistribution = {
          high: 0,
          medium: 0,
          low: 0,
        };
        const statusBreakdown = {
          created: 0,
          evaluated: 0,
          archived: 0,
        };

        (matchRows || []).forEach((m) => {
          const signals = m.matchSignals || null;
          const baseScore =
            signals && typeof signals.semanticSimilarity === "number"
              ? signals.semanticSimilarity
              : signals && typeof signals.skillCoverage === "number"
                ? signals.skillCoverage
                : typeof m.score === "number"
                  ? m.score / 100
                  : 0;
          const score = Math.round(baseScore * 100);

          totalScore += score;
          scoreCount++;

          if (score >= 80) {
            scoreDistribution.high++;
          } else if (score >= 60) {
            scoreDistribution.medium++;
          } else {
            scoreDistribution.low++;
          }

          const st = (m.status || "CREATED").toLowerCase();
          if (st === "created") {
            statusBreakdown.created++;
          } else if (st === "evaluated") {
            statusBreakdown.evaluated++;
          } else if (st === "archived") {
            statusBreakdown.archived++;
          } else {
            statusBreakdown[st] = (statusBreakdown[st] || 0) + 1;
          }
        });

        const averageScore = scoreCount > 0 ? Number((totalScore / scoreCount).toFixed(1)) : 0;

        // 4. Billing domain
        const planId = effectivePlanResult?.planId || "STARTER";
        const billingStatus = effectivePlanResult?.status || "active";
        const isTrial =
          effectivePlanResult?.isTrial || effectivePlanResult?.source === "TRIAL" || false;
        const trialDaysRemaining = effectivePlanResult?.trialDaysRemaining ?? null;

        let proposalsUsed = 0;
        if (effectivePlanResult && effectivePlanResult.period) {
          const period = effectivePlanResult.period;
          const usageKey = `usage:${billingTenantId}:AI_PROPOSAL:${period.startedAt.getTime()}:${period.endsAt.getTime()}`;
          proposalsUsed = (await usageRepo.getUsage(usageKey)) || 0;
        }

        const planConfig = planCatalog[planId] || planCatalog.STARTER;
        const proposalsLimit =
          planConfig?.limits?.AI_PROPOSALS ??
          planConfig?.limits?.aiProposals ??
          (planId === "ENTERPRISE" ? 999999 : planId === "PRO" ? 50 : 5);
        const percentUsed =
          proposalsLimit > 0 ? Number(((proposalsUsed / proposalsLimit) * 100).toFixed(1)) : 0;

        // 5. Health domain
        const healthStatus = "healthy";
        const syncActive = true;
        const lastCheckedAt = new Date().toISOString();

        sendJson(200, {
          success: true,
          analytics: {
            activation: {
              registeredAt,
              hasScannedJobs,
              hasGeneratedMatches,
              hasCreatedClients,
              isActivated,
            },
            retention: {
              activeDaysCount,
              activeSessionsCount,
              lastActiveAt,
            },
            matching: {
              totalScanned,
              totalMatches,
              averageScore,
              scoreDistribution,
              statusBreakdown,
            },
            billing: {
              planId,
              status: billingStatus,
              isTrial,
              trialDaysRemaining,
              usage: {
                proposalsUsed,
                proposalsLimit,
                percentUsed,
              },
            },
            health: {
              status: healthStatus,
              syncActive,
              lastCheckedAt,
            },
          },
        });
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

  // =====================================================================
  // Phase 11G: Settings API Endpoints
  // =====================================================================

  // 1J. GET /api/settings/profile
  if (pathname === "/api/settings/profile" && req.method === "GET") {
    const auth = await checkAuthentication();
    if (!auth) {
      sendJson(401, { success: false, error: "Unauthorized" });
      return;
    }

    try {
      const userId = auth.context.identity.userId;
      const userRows = await db
        .select({
          id: users.id,
          email: users.email,
          status: users.status,
          emailVerifiedAt: users.emailVerifiedAt,
          createdAt: users.createdAt,
        })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      const user = userRows[0];
      const profile = {
        userId,
        email: user ? user.email : auth.context.identity.email,
        status: user ? user.status : "active",
        emailVerifiedAt: user ? user.emailVerifiedAt : null,
        createdAt: user && user.createdAt ? user.createdAt : new Date().toISOString(),
      };

      sendJson(200, {
        success: true,
        profile,
      });
    } catch (err) {
      logger.error({
        message: "Failed to retrieve user profile",
        error: err instanceof Error ? err : new Error(String(err)),
      });
      sendJson(500, { success: false, error: "Internal Server Error" });
    }
    return;
  }

  // 1K. POST /api/settings/security/password
  if (pathname === "/api/settings/security/password" && req.method === "POST") {
    const auth = await checkAuthentication();
    if (!auth) {
      sendJson(401, { success: false, error: "Unauthorized" });
      return;
    }

    try {
      const payload = await readJsonBody();
      const { currentPassword, newPassword } = payload || {};

      if (
        !currentPassword ||
        typeof currentPassword !== "string" ||
        !newPassword ||
        typeof newPassword !== "string"
      ) {
        sendJson(400, {
          success: false,
          error: "Current password and new password are required.",
        });
        return;
      }

      if (newPassword.length < 8) {
        sendJson(400, {
          success: false,
          error: "New password must be at least 8 characters long.",
        });
        return;
      }

      const userId = auth.context.identity.userId;

      // Retrieve existing password hash
      const storedHashes = await db
        .select({
          id: userPasswordHashes.id,
          passwordHash: userPasswordHashes.passwordHash,
          algorithm: userPasswordHashes.algorithm,
          hashVersion: userPasswordHashes.hashVersion,
          credentialVersion: userPasswordHashes.credentialVersion,
        })
        .from(userPasswordHashes)
        .where(eq(userPasswordHashes.userId, userId))
        .limit(1);

      const stored = storedHashes[0];
      if (!stored) {
        sendJson(400, {
          success: false,
          error: "Incorrect current password.",
        });
        return;
      }

      // Verify current password
      const isCurrentValid = await verifyPassword(
        currentPassword,
        stored.passwordHash,
        stored.algorithm,
        stored.hashVersion,
      );

      if (!isCurrentValid) {
        sendJson(400, {
          success: false,
          error: "Incorrect current password.",
        });
        return;
      }

      // Hash new password using modern auth configuration
      const newHash = await hashPassword(newPassword);
      const nextCredentialVersion = (stored.credentialVersion || 1) + 1;

      // Update password hash and increment credential version
      await db
        .update(userPasswordHashes)
        .set({
          passwordHash: newHash.passwordHash,
          algorithm: newHash.algorithm,
          hashVersion: newHash.hashVersion,
          passwordChangedAt: new Date(),
          credentialVersion: nextCredentialVersion,
        })
        .where(eq(userPasswordHashes.userId, userId));

      sendJson(200, {
        success: true,
        message: "Password updated successfully.",
      });
    } catch (err) {
      if (err && err.statusCode === 400) {
        sendJson(400, { success: false, error: "Malformed JSON payload." });
        return;
      }
      if (err && err.statusCode === 413) {
        sendJson(413, { success: false, error: "Payload too large." });
        return;
      }
      logger.error({
        message: "Failed to update user password",
        error: err instanceof Error ? err : new Error(String(err)),
      });
      sendJson(500, { success: false, error: "Internal Server Error" });
    }
    return;
  }

  // 1L. GET /api/settings/security/sessions
  if (pathname === "/api/settings/security/sessions" && req.method === "GET") {
    const auth = await checkAuthentication();
    if (!auth) {
      sendJson(401, { success: false, error: "Unauthorized" });
      return;
    }

    try {
      const userId = auth.context.identity.userId;
      const currentSessionId = auth.context.identity.sessionId;

      const activeSessions = await db
        .select({
          id: sessions.id,
          deviceName: sessions.deviceName,
          platform: sessions.platform,
          browser: sessions.browser,
          ipAddress: sessions.ipAddress,
          lastActivityAt: sessions.lastActivityAt,
          createdAt: sessions.createdAt,
          expiresAt: sessions.expiresAt,
          revokedAt: sessions.revokedAt,
        })
        .from(sessions)
        .where(
          and(
            eq(sessions.userId, userId),
            isNull(sessions.revokedAt),
            gt(sessions.expiresAt, new Date()),
          ),
        );

      const sessionDtos = activeSessions.map((s) => ({
        sessionId: s.id,
        deviceName: s.deviceName || "Desktop Device",
        platform: s.platform || "Web",
        browser: s.browser || "Browser",
        ipAddress: s.ipAddress,
        lastActivityAt: s.lastActivityAt,
        createdAt: s.createdAt,
        expiresAt: s.expiresAt,
        isCurrent: s.id === currentSessionId,
      }));

      sendJson(200, {
        success: true,
        currentSessionId,
        sessions: sessionDtos,
      });
    } catch (err) {
      logger.error({
        message: "Failed to retrieve user active sessions",
        error: err instanceof Error ? err : new Error(String(err)),
      });
      sendJson(500, { success: false, error: "Internal Server Error" });
    }
    return;
  }

  // 1M. DELETE /api/settings/security/sessions/:id
  const deleteSessionMatch = pathname.match(
    /^\/api\/settings\/security\/sessions\/([a-zA-Z0-9-]+)$/,
  );
  if (deleteSessionMatch && req.method === "DELETE") {
    const auth = await checkAuthentication();
    if (!auth) {
      sendJson(401, { success: false, error: "Unauthorized" });
      return;
    }

    try {
      const targetSessionId = deleteSessionMatch[1];
      const userId = auth.context.identity.userId;

      // Verify target session exists and belongs to the authenticated user
      const existing = await db
        .select({
          id: sessions.id,
          userId: sessions.userId,
        })
        .from(sessions)
        .where(eq(sessions.id, targetSessionId))
        .limit(1);

      const session = existing[0];
      if (!session || session.userId !== userId) {
        sendJson(404, { success: false, error: "Session not found." });
        return;
      }

      await revokeSession(targetSessionId);

      sendJson(200, {
        success: true,
        message: "Session revoked successfully.",
      });
    } catch (err) {
      logger.error({
        message: "Failed to revoke session",
        error: err instanceof Error ? err : new Error(String(err)),
      });
      sendJson(500, { success: false, error: "Internal Server Error" });
    }
    return;
  }

  // 1N. DELETE /api/settings/security/sessions (Revoke all OTHER sessions)
  if (pathname === "/api/settings/security/sessions" && req.method === "DELETE") {
    const auth = await checkAuthentication();
    if (!auth) {
      sendJson(401, { success: false, error: "Unauthorized" });
      return;
    }

    try {
      const userId = auth.context.identity.userId;
      const currentSessionId = auth.context.identity.sessionId;

      await db
        .update(sessions)
        .set({ revokedAt: new Date() })
        .where(
          and(
            eq(sessions.userId, userId),
            ne(sessions.id, currentSessionId),
            isNull(sessions.revokedAt),
          ),
        );

      sendJson(200, {
        success: true,
        message: "All other sessions revoked successfully.",
      });
    } catch (err) {
      logger.error({
        message: "Failed to revoke other sessions",
        error: err instanceof Error ? err : new Error(String(err)),
      });
      sendJson(500, { success: false, error: "Internal Server Error" });
    }
    return;
  }

  // 1O. GET /api/settings/data/export
  if (pathname === "/api/settings/data/export" && req.method === "GET") {
    const auth = await checkAuthentication();
    if (!auth) {
      sendJson(401, { success: false, error: "Unauthorized" });
      return;
    }

    try {
      const ownerId = auth.context.identity.userId;
      const tenantId = `tenant_${ownerId}`;

      // Query tenant-scoped domain aggregates safely
      const [clientsList, jobsList, matchesList, timelineList, brainList] = await Promise.all([
        Promise.resolve(clientRepo.list(ownerId, { pageSize: 100 }))
          .then((r) => (r && r.items ? r.items : []))
          .catch(() => []),
        Promise.resolve(jobsRepo.findByTenant(tenantId)).catch(() => []),
        Promise.resolve(
          matchRepo.findByTenant
            ? matchRepo.findByTenant(tenantId)
            : db.select().from(jobMatches).where(eq(jobMatches.tenantId, tenantId)),
        ).catch(() => []),
        Promise.resolve(
          timelineRepo.findTimelineEntriesByOwner(ownerId, { page: 1, pageSize: 100 }),
        )
          .then((r) => (r && r.items ? r.items : []))
          .catch(() => []),
        Promise.resolve(
          brainAnalysisRepo.listByScope({ ownerId, tenantId, actorId: ownerId }, { limit: 100 }),
        )
          .then((r) => (r && r.items ? r.items : []))
          .catch(() => []),
      ]);

      const exportData = {
        version: "1.0.0",
        exportedAt: new Date().toISOString(),
        tenantId,
        ownerId,
        clients: Array.isArray(clientsList) ? clientsList : [],
        jobs: Array.isArray(jobsList) ? jobsList : [],
        matches: Array.isArray(matchesList) ? matchesList : [],
        timeline: Array.isArray(timelineList) ? timelineList : [],
        brainAnalyses: Array.isArray(brainList) ? brainList : [],
      };

      sendJson(200, {
        success: true,
        export: exportData,
      });
    } catch (err) {
      logger.error({
        message: "Failed to generate data export",
        error: err instanceof Error ? err : new Error(String(err)),
      });
      sendJson(500, { success: false, error: "Internal Server Error" });
    }
    return;
  }

  // 1P. GET /api/settings/extension
  if (pathname === "/api/settings/extension" && req.method === "GET") {
    const auth = await checkAuthentication();
    if (!auth) {
      sendJson(401, { success: false, error: "Unauthorized" });
      return;
    }

    try {
      sendJson(200, {
        success: true,
        extension: {
          name: "FreelanceOS Job Matcher",
          version: "0.1.0",
          manifestVersion: 3,
          supportedPlatforms: [
            {
              id: "upwork",
              name: "Upwork",
              supported: true,
              matchPattern: "https://*.upwork.com/*",
            },
            {
              id: "linkedin",
              name: "LinkedIn",
              supported: true,
              matchPattern: "https://*.linkedin.com/*",
            },
          ],
          syncPreferences: {
            autoImport: true,
            backgroundSync: true,
          },
          connectionStatus: "available",
        },
      });
    } catch (err) {
      logger.error({
        message: "Failed to retrieve extension settings",
        error: err instanceof Error ? err : new Error(String(err)),
      });
      sendJson(500, { success: false, error: "Internal Server Error" });
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
  let targetFile =
    staticPathname === "/" || staticPathname === "/landing" ? "landing.html" : staticPathname;
  const filePath = path.join(__dirname, targetFile);
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
  clientRepo,
  subscriptionRepo,
  usageRepo,
  entitlementResolver,
  brainAnalysisRepo,
  brainExecutionService,
  brainEngine,
  brainEntitlementGateway,
  brainContextOrchestrator,
  unifiedSearchEngine,
  clientSearchEngine,
  jobSearchEngine,
  matchSearchEngine,
  timelineSearchEngine,
  stripeBillingProvider,
  planCatalog,
  customerMappingRepo,
  priceRegistry,
  trialPersistence,
};
