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
} from "@freelanceos/auth";
import { runtimeConfig } from "@freelanceos/config";
import { logger } from "@freelanceos/logger";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
