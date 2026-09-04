import test from "node:test";
import assert from "node:assert";
import http from "http";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { server, healthService } from "./server.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "../..");

const originalCheckReadiness = healthService.checkReadiness;
const originalCheckLiveness = healthService.checkLiveness;

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
              // keep raw
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

test.beforeEach(() => {
  healthService.checkReadiness = async () => ({
    status: "healthy",
    uptimeSeconds: 120,
    timestamp: new Date().toISOString(),
    components: {
      database: { status: "healthy", latencyMs: 2, timestamp: new Date().toISOString() },
      redis: { status: "healthy", latencyMs: 1, timestamp: new Date().toISOString() },
    },
  });
  healthService.checkLiveness = async () => ({
    status: "healthy",
    uptimeSeconds: 120,
    timestamp: new Date().toISOString(),
  });
});

test.after(() => {
  healthService.checkReadiness = originalCheckReadiness;
  healthService.checkLiveness = originalCheckLiveness;
});

// =====================================================================
// Phase 12F: Monitoring & Observability Test Suite
// =====================================================================

test("Monitoring 1. GET /healthz returns 200 with valid JSON", async () => {
  const res = await makeRequest("/healthz", "GET");
  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.headers["content-type"], "application/json");
  assert.ok(res.body);
  assert.strictEqual(res.body.status, "healthy");
});

test("Monitoring 2. GET /livez returns valid process liveness response", async () => {
  const res = await makeRequest("/livez", "GET");
  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.body.status, "healthy");
  assert.strictEqual(typeof res.body.uptimeSeconds, "number");
  assert.ok(res.body.timestamp);
});

test("Monitoring 3. GET /readyz returns structured readiness response when healthy", async () => {
  const res = await makeRequest("/readyz", "GET");
  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.body.status, "healthy");
  assert.strictEqual(res.body.components.database.status, "healthy");
  assert.strictEqual(res.body.components.redis.status, "healthy");
});

test("Monitoring 4. GET /readyz returns HTTP 503 when dependency is degraded or unhealthy", async () => {
  healthService.checkReadiness = async () => ({
    status: "unhealthy",
    uptimeSeconds: 120,
    timestamp: new Date().toISOString(),
    components: {
      database: {
        status: "unhealthy",
        latencyMs: 3000,
        error: "Connection timeout",
        timestamp: new Date().toISOString(),
      },
      redis: { status: "healthy", latencyMs: 1, timestamp: new Date().toISOString() },
    },
  });

  const res = await makeRequest("/readyz", "GET");
  assert.strictEqual(res.statusCode, 503);
  assert.strictEqual(res.body.status, "unhealthy");
  assert.strictEqual(res.body.components.database.status, "unhealthy");
});

test("Monitoring 5. GET /api/health alias returns valid health response", async () => {
  const res = await makeRequest("/api/health", "GET");
  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.body.status, "healthy");
});

test("Monitoring 6. Health endpoints are publicly accessible without authentication cookies", async () => {
  const endpoints = ["/healthz", "/livez", "/readyz", "/api/health"];
  for (const endpoint of endpoints) {
    const res = await makeRequest(endpoint, "GET");
    assert.notStrictEqual(res.statusCode, 401, `${endpoint} must not return 401`);
    assert.notStrictEqual(res.statusCode, 403, `${endpoint} must not return 403`);
  }
});

test("Monitoring 7. Health responses contain zero credentials, SQL, or connection strings", async () => {
  const endpoints = ["/healthz", "/livez", "/readyz", "/api/health"];
  for (const endpoint of endpoints) {
    const res = await makeRequest(endpoint, "GET");
    const rawJson = JSON.stringify(res.body);

    assert.strictEqual(
      rawJson.includes("postgres://"),
      false,
      "Database connection strings must not leak",
    );
    assert.strictEqual(
      rawJson.includes("redis://"),
      false,
      "Redis connection strings must not leak",
    );
    assert.strictEqual(rawJson.includes("password"), false, "Passwords must not leak");
    assert.strictEqual(rawJson.includes("secret"), false, "Secrets must not leak");
    assert.strictEqual(rawJson.includes("SELECT"), false, "SQL statements must not leak");
  }
});

test("Monitoring 8. Protected domain routes still strictly require authentication", async () => {
  const protectedRoutes = [
    "/api/clients",
    "/api/matches",
    "/api/jobs",
    "/api/billing/subscription",
    "/api/settings/data/export",
    "/api/settings/profile",
  ];

  for (const route of protectedRoutes) {
    const res = await makeRequest(route, "GET");
    assert.strictEqual(res.statusCode, 401, `${route} must require authentication (HTTP 401)`);
    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error, "Unauthorized");
  }
});

test("Monitoring 9. docs/monitoring-alerting-runbook.md exists and contains required operational sections", () => {
  const docPath = path.join(repoRoot, "docs", "monitoring-alerting-runbook.md");
  assert.ok(fs.existsSync(docPath), "docs/monitoring-alerting-runbook.md must exist");
  const content = fs.readFileSync(docPath, "utf-8");

  assert.match(content, /System Monitoring Overview/i);
  assert.match(content, /Health Endpoints\s*&\s*Specifications/i);
  assert.match(content, /Liveness Semantics/i);
  assert.match(content, /Readiness Semantics/i);
  assert.match(content, /Structured Request Logging/i);
  assert.match(content, /Alert Conditions\s*&\s*Thresholds/i);
  assert.match(content, /Incident Response Workflows/i);
  assert.match(content, /PostgreSQL Outage Workflow/i);
  assert.match(content, /Redis Outage Workflow/i);
  assert.match(content, /Deployment Rollback Procedure/i);
});
