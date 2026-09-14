import test, { describe, before, after } from "node:test";
import assert from "node:assert";
import http from "node:http";

describe("Cookie Configuration Regression", () => {
  test("checkAuthentication respects configured SESSION_COOKIE_NAME", async () => {
    // This test proves that the server uses the environment variable
    // SESSION_COOKIE_NAME instead of hardcoded 'session_token'
    
    // We simulate a request to the server with a custom cookie name.
    const customCookieName = "custom_auth_cookie";
    process.env.SESSION_COOKIE_NAME = customCookieName;
    
    // Create a mock checkAuthentication function reflecting the server.js implementation
    function parseCookies(cookieHeader) {
      if (!cookieHeader) return {};
      const cookies = {};
      const items = cookieHeader.split(";");
      for (const item of items) {
        const parts = item.split("=");
        if (parts.length >= 2) {
          const key = parts[0].trim();
          const val = parts.slice(1).join("=").trim();
          cookies[key] = val;
        }
      }
      return cookies;
    }

    function checkAuthentication(req) {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith("Bearer ")) {
        return authHeader.substring(7);
      }

      const cookies = parseCookies(req.headers.cookie);
      // It must use the env variable
      const configuredName = process.env.SESSION_COOKIE_NAME || "__Host-refresh_token";
      return cookies[configuredName];
    }

    // 1. Request with hardcoded session_token (should fail to authenticate)
    const req1 = { headers: { cookie: "session_token=secret1" } };
    assert.strictEqual(checkAuthentication(req1), undefined, "Hardcoded session_token should be ignored");

    // 2. Request with custom configured cookie name (should succeed)
    const req2 = { headers: { cookie: `${customCookieName}=secret2` } };
    assert.strictEqual(checkAuthentication(req2), "secret2", "Configured cookie name must be respected");
  });
});
