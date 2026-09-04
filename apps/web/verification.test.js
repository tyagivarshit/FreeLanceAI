import test from "node:test";
import assert from "node:assert";
import http from "http";
import crypto from "crypto";
import { db, users, emailVerifications, userPasswordHashes, sessions } from "@freelanceos/db";
import { hashPassword } from "@freelanceos/auth";
import { server } from "./server.js";

const originalSelect = db.select;
const originalInsert = db.insert;
const originalUpdate = db.update;
const originalTransaction = db.transaction;

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
      db.select = originalSelect;
      db.insert = originalInsert;
      db.update = originalUpdate;
      db.transaction = originalTransaction;
      resolve();
    });
  });
});

function makeRequest(path, method = "GET", headers = {}, body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: "localhost",
      port: serverPort,
      path,
      method,
      headers: {
        ...headers,
      },
    };

    if (body) {
      options.headers["Content-Type"] = "application/json";
      options.headers["Content-Length"] = Buffer.byteLength(body);
    }

    const req = http.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => {
        data += chunk;
      });
      res.on("end", () => {
        let json = null;
        try {
          json = JSON.parse(data);
        } catch {
          // not json
        }
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data,
          json,
        });
      });
    });

    req.on("error", reject);
    if (body) {
      req.write(body);
    }
    req.end();
  });
}

test.describe("Email Verification Endpoint & Integration Tests", () => {
  test("1. GET /api/auth/verify-email with valid token redirects to login with verified=true", async () => {
    const rawToken = "valid-token-abcdef1234567890";
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");

    const mockVerification = {
      id: "v-1",
      userId: "u-1",
      tokenHash,
      expiresAt: new Date(Date.now() + 86400000),
      consumedAt: null,
      attemptCount: 0,
    };

    const mockUser = {
      id: "u-1",
      email: "user@freelanceos.com",
      status: "pending",
      emailVerifiedAt: null,
    };

    let callCount = 0;
    db.select = function () {
      return {
        from: () => ({
          where: () => ({
            limit: () => {
              callCount++;
              if (callCount === 1) return Promise.resolve([mockVerification]);
              return Promise.resolve([mockUser]);
            },
          }),
        }),
      };
    };

    db.transaction = async function (callback) {
      const mockTx = {
        update: () => ({
          set: () => ({
            where: () => Promise.resolve(),
          }),
        }),
      };
      return await callback(mockTx);
    };

    const res = await makeRequest(`/api/auth/verify-email?token=${rawToken}`, "GET");

    assert.strictEqual(res.statusCode, 302);
    assert.strictEqual(res.headers.location, "/login.html?verified=true");
  });

  test("2. GET /api/auth/verify-email with invalid token redirects to login with verifyError", async () => {
    db.select = function () {
      return {
        from: () => ({
          where: () => ({
            limit: () => Promise.resolve([]), // Unknown token
          }),
        }),
      };
    };

    const res = await makeRequest("/api/auth/verify-email?token=invalid-token-xyz", "GET");

    assert.strictEqual(res.statusCode, 302);
    assert.ok(res.headers.location.includes("/login.html?verifyError=INVALID_TOKEN"));
  });

  test("3. POST /api/auth/verify-email with valid token returns JSON success", async () => {
    const rawToken = "json-valid-token-1234567890";
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");

    const mockVerification = {
      id: "v-2",
      userId: "u-2",
      tokenHash,
      expiresAt: new Date(Date.now() + 86400000),
      consumedAt: null,
      attemptCount: 0,
    };

    const mockUser = {
      id: "u-2",
      email: "json-user@freelanceos.com",
      status: "pending",
      emailVerifiedAt: null,
    };

    let callCount = 0;
    db.select = function () {
      return {
        from: () => ({
          where: () => ({
            limit: () => {
              callCount++;
              if (callCount === 1) return Promise.resolve([mockVerification]);
              return Promise.resolve([mockUser]);
            },
          }),
        }),
      };
    };

    db.transaction = async function (callback) {
      const mockTx = {
        update: () => ({
          set: () => ({
            where: () => Promise.resolve(),
          }),
        }),
      };
      return await callback(mockTx);
    };

    const res = await makeRequest(
      "/api/auth/verify-email",
      "POST",
      {},
      JSON.stringify({ token: rawToken }),
    );

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.json.success, true);
    assert.strictEqual(res.json.message, "Email verified successfully.");
    assert.strictEqual(res.json.user.id, "u-2");
    assert.strictEqual(res.json.user.email, "json-user@freelanceos.com");
  });

  test("4. POST /api/auth/verify-email with expired token returns HTTP 410", async () => {
    const rawToken = "expired-token-1234567890";
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");

    const mockVerification = {
      id: "v-3",
      userId: "u-3",
      tokenHash,
      expiresAt: new Date(Date.now() - 3600000), // Expired
      consumedAt: null,
      attemptCount: 0,
    };

    db.select = function () {
      return {
        from: () => ({
          where: () => ({
            limit: () => Promise.resolve([mockVerification]),
          }),
        }),
      };
    };

    const res = await makeRequest(
      "/api/auth/verify-email",
      "POST",
      {},
      JSON.stringify({ token: rawToken }),
    );

    assert.strictEqual(res.statusCode, 410);
    assert.strictEqual(res.json.success, false);
    assert.strictEqual(res.json.code, "TOKEN_EXPIRED");
  });

  test("5. POST /api/auth/verify-email with already consumed token returns HTTP 409", async () => {
    const rawToken = "consumed-token-1234567890";
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");

    const mockVerification = {
      id: "v-4",
      userId: "u-4",
      tokenHash,
      expiresAt: new Date(Date.now() + 86400000),
      consumedAt: new Date(), // Already used
      attemptCount: 1,
    };

    db.select = function () {
      return {
        from: () => ({
          where: () => ({
            limit: () => Promise.resolve([mockVerification]),
          }),
        }),
      };
    };

    const res = await makeRequest(
      "/api/auth/verify-email",
      "POST",
      {},
      JSON.stringify({ token: rawToken }),
    );

    assert.strictEqual(res.statusCode, 409);
    assert.strictEqual(res.json.success, false);
    assert.strictEqual(res.json.code, "TOKEN_ALREADY_USED");
  });

  test("6. End-to-end lifecycle: verify email transitions status and allows successful authentication", async () => {
    const rawToken = "e2e-token-flow-test-1234567890";
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");

    let userStatus = "pending";
    let emailVerifiedAt = null;
    let tokenConsumedAt = null;

    const mockVerification = {
      id: "v-e2e",
      userId: "u-e2e",
      tokenHash,
      expiresAt: new Date(Date.now() + 86400000),
      get consumedAt() {
        return tokenConsumedAt;
      },
      attemptCount: 0,
    };

    const mockUser = {
      id: "u-e2e",
      email: "e2e-user@freelanceos.com",
      get status() {
        return userStatus;
      },
      get emailVerifiedAt() {
        return emailVerifiedAt;
      },
    };

    let queryCount = 0;
    db.select = function () {
      return {
        from: () => ({
          where: () => ({
            limit: () => {
              queryCount++;
              if (queryCount % 2 === 1) return Promise.resolve([mockVerification]);
              return Promise.resolve([mockUser]);
            },
          }),
        }),
      };
    };

    db.transaction = async function (callback) {
      const mockTx = {
        update: (table) => ({
          set: (vals) => {
            if (vals.consumedAt) tokenConsumedAt = vals.consumedAt;
            if (vals.status) userStatus = vals.status;
            if (vals.emailVerifiedAt) emailVerifiedAt = vals.emailVerifiedAt;
            return {
              where: () => Promise.resolve(),
            };
          },
        }),
      };
      return await callback(mockTx);
    };

    // Step 1: User visits verification link from email
    const verifyRes = await makeRequest(`/api/auth/verify-email?token=${rawToken}`, "GET");
    assert.strictEqual(verifyRes.statusCode, 302);
    assert.strictEqual(verifyRes.headers.location, "/login.html?verified=true");

    // Step 2: Validate state changes
    assert.strictEqual(userStatus, "active", "User status must be updated to active");
    assert.ok(emailVerifiedAt instanceof Date, "emailVerifiedAt timestamp must be recorded");
    assert.ok(tokenConsumedAt instanceof Date, "token consumedAt timestamp must be recorded");
  });

  test("7. End-to-end login flow: verified login sets valid access token cookie, dashboard loads and stays authenticated, logout succeeds", async () => {
    const password = "StrongPassword123!";
    const { passwordHash, algorithm, hashVersion } = await hashPassword(password);

    const mockActiveUser = {
      id: "u-real-auth-1",
      email: "real-user@freelanceos.com",
      normalizedEmail: "real-user@freelanceos.com",
      status: "active",
      createdAt: new Date(),
    };

    const mockPasswordRecord = {
      id: "pwd-1",
      userId: "u-real-auth-1",
      passwordHash,
      algorithm,
      hashVersion,
      credentialVersion: 1,
    };

    let sessionRevoked = false;
    const mockSessionRecord = {
      id: "sess-real-1",
      userId: "u-real-auth-1",
      refreshTokenHash: "mock-hash",
      expiresAt: new Date(Date.now() + 86400000),
      lastActivityAt: new Date(),
      get revokedAt() {
        return sessionRevoked ? new Date() : null;
      },
    };

    db.select = function () {
      return {
        from: (table) => ({
          where: () => {
            let result = [];
            if (table === users) {
              result = [mockActiveUser];
            } else if (table === userPasswordHashes) {
              result = [mockPasswordRecord];
            } else if (table === sessions) {
              result = [mockSessionRecord];
            }
            const p = Promise.resolve(result);
            p.limit = () => p;
            p.for = () => p;
            return p;
          },
          then: (resolve) => {
            let result = [];
            if (table === users) result = [mockActiveUser];
            else if (table === userPasswordHashes) result = [mockPasswordRecord];
            else if (table === sessions) result = [mockSessionRecord];
            resolve(result);
          },
        }),
      };
    };

    db.insert = function (table) {
      return {
        values: () => ({
          returning: () => Promise.resolve([{ id: "sess-real-1" }]),
        }),
      };
    };

    db.update = function () {
      return {
        set: (params) => {
          if (params.revokedAt) {
            sessionRevoked = true;
          }
          return {
            where: () => Promise.resolve({ rowCount: 1 }),
          };
        },
      };
    };

    // 1. Post to /api/login with valid verified credentials
    const loginRes = await makeRequest(
      "/api/login",
      "POST",
      {},
      JSON.stringify({
        email: "real-user@freelanceos.com",
        password,
      }),
    );

    assert.strictEqual(loginRes.statusCode, 200, "Login must return 200 OK");
    assert.strictEqual(loginRes.json.success, true);
    assert.ok(loginRes.headers["set-cookie"], "Login response must include Set-Cookie header");

    // Extract cookie from Set-Cookie header
    const setCookie = loginRes.headers["set-cookie"];
    const cookieString = Array.isArray(setCookie) ? setCookie[0] : setCookie;
    const cookiePair = cookieString.split(";")[0];
    assert.ok(
      cookiePair.startsWith("__Host-refresh_token="),
      "Cookie must start with __Host-refresh_token",
    );

    // 2. Request /dashboard.html with the received session cookie
    const dashboardRes = await makeRequest("/dashboard.html", "GET", {
      Cookie: cookiePair,
    });

    assert.strictEqual(
      dashboardRes.statusCode,
      200,
      "GET /dashboard.html with valid session cookie must return 200 OK (not 302)",
    );
    assert.ok(dashboardRes.body.includes("<!DOCTYPE html>"), "Dashboard HTML must be rendered");

    // 3. Request /api/session to verify active identity context
    const sessionRes = await makeRequest("/api/session", "GET", {
      Cookie: cookiePair,
    });

    assert.strictEqual(sessionRes.statusCode, 200);
    assert.strictEqual(sessionRes.json.success, true);
    assert.strictEqual(sessionRes.json.user.email, "real-user@freelanceos.com");
    assert.strictEqual(sessionRes.json.user.userId, "u-real-auth-1");

    // 4. Request /api/logout with the session cookie
    const logoutRes = await makeRequest(
      "/api/logout",
      "POST",
      {
        Cookie: cookiePair,
      },
      JSON.stringify({ global: false }),
    );

    assert.strictEqual(logoutRes.statusCode, 200);
    assert.strictEqual(logoutRes.json.success, true);
    assert.strictEqual(sessionRevoked, true, "Session must be revoked in the database");

    // 5. Subsequent request to /dashboard.html with revoked session or without cookie redirects to login
    const unauthDashboardRes = await makeRequest("/dashboard.html", "GET");
    assert.strictEqual(unauthDashboardRes.statusCode, 302);
    assert.strictEqual(unauthDashboardRes.headers.location, "/login.html");
  });
});
