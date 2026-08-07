import http from "http";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  signupUser,
  ValidationError,
  DuplicateEmailError,
  getSessionCookieConfig,
  serializeCookie,
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

        let platform = "unknown";
        if (userAgent.includes("Windows")) {
          platform = "Windows";
        } else if (userAgent.includes("Macintosh")) {
          platform = "macOS";
        } else if (userAgent.includes("Linux")) {
          platform = "Linux";
        } else if (userAgent.includes("Android")) {
          platform = "Android";
        } else if (userAgent.includes("iPhone")) {
          platform = "iOS";
        }

        let browser = "unknown";
        if (userAgent.includes("Chrome")) {
          browser = "Chrome";
        } else if (userAgent.includes("Firefox")) {
          browser = "Firefox";
        } else if (userAgent.includes("Safari")) {
          browser = "Safari";
        }

        const sessionMetadata = {
          userAgent,
          ipAddress,
          platform,
          browser,
          deviceName: platform,
        };

        const result = await signupUser({
          email,
          password,
          sessionMetadata,
        });

        // Set stateful refresh token cookie securely
        if (result.tokens) {
          const cookieConfig = getSessionCookieConfig(result.tokens.refreshToken);
          const cookieHeader = serializeCookie(cookieConfig);
          res.setHeader("Set-Cookie", cookieHeader);
        }

        res.writeHead(201, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            success: true,
            user: result.user,
            signedAccessToken: result.tokens ? result.tokens.signedAccessToken : undefined,
            verificationTriggered: result.verificationTriggered,
          }),
        );
      } catch (err) {
        logger.error({
          message: "Signup API request failed",
          error: err instanceof Error ? err : new Error(String(err)),
        });

        if (err instanceof ValidationError) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({ success: false, code: "VALIDATION_FAILED", errors: err.errors }),
          );
        } else if (err instanceof DuplicateEmailError) {
          res.writeHead(409, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({ success: false, code: "DUPLICATE_EMAIL", message: err.message }),
          );
        } else {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({
              success: false,
              code: "INTERNAL_ERROR",
              message: "An infrastructure error occurred.",
            }),
          );
        }
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
  console.log(`[Web Server] Running on http://localhost:${PORT}`);
});
