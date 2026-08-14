import http from "http";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
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
} from "@freelanceos/core";

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
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  // 1. Hook the Signup use case to POST /api/signup
  if (req.url === "/api/signup" && req.method === "POST") {
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
  if (req.url === "/api/login" && req.method === "POST") {
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
  if (req.url === "/api/logout" && req.method === "POST") {
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
  if (req.url === "/api/webhooks/stripe" && req.method === "POST") {
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
  if (req.url === "/" || req.url === "/index.html" || req.url === "/login.html") {
    const auth = await checkAuthentication();
    if (auth) {
      res.writeHead(302, { Location: "/dashboard.html" });
      res.end();
      return;
    }
  }

  // Protect dashboard routes
  if (req.url === "/dashboard.html" || req.url === "/dashboard") {
    const auth = await checkAuthentication();
    if (!auth) {
      res.writeHead(302, { Location: "/login.html" });
      res.end();
      return;
    }
    // Clean rewrite if requested without extension
    if (req.url === "/dashboard") {
      req.url = "/dashboard.html";
    }
  }

  // Get active user session info API
  if (req.url === "/api/session" && req.method === "GET") {
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
  if (req.url === "/api/entitlements" && req.method === "GET") {
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

  // 2. Serve static pages
  const filePath = path.join(__dirname, req.url === "/" ? "index.html" : req.url);
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

server.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`[Web Server] Running on http://localhost:${PORT}`);
});
