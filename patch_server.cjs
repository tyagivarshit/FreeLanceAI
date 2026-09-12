const fs = require('fs');
let code = fs.readFileSync('apps/web/server.js', 'utf8');

// Normalize to \n
const originalCode = code;
code = code.replace(/\r\n/g, '\n');

let count = 0;

if (code.includes('  verifyEmailToken,\n} from "@freelanceos/auth";')) count++;
code = code.replace(
  '  verifyEmailToken,\n} from "@freelanceos/auth";',
  '  verifyEmailToken,\n  verifyMfaLogin,\n  generateMfaSetup,\n  verifyAndEnableMfa,\n  disableMfa,\n} from "@freelanceos/auth";'
);

if (code.includes(`            verificationTriggered: result.verificationTriggered,\n          }),\n        );`)) count++;
code = code.replace(
  `            verificationTriggered: result.verificationTriggered,\n          }),\n        );`,
  `            verificationTriggered: result.verificationTriggered,\n            requiresMfa: result.requiresMfa || false,\n            mfaToken: result.mfaToken,\n          }),\n        );`
);

const mfaVerifyStr = `    });
    return;
  }

  // 1B-MFA. Hook the MFA Login verification to POST /api/auth/mfa/verify-login
  if (pathname === "/api/auth/mfa/verify-login" && req.method === "POST") {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });

    req.on("end", async () => {
      try {
        const payload = JSON.parse(body);
        const { mfaToken, code } = payload;

        const userAgent = req.headers["user-agent"] || "unknown";
        const ipAddress = req.socket.remoteAddress || "127.0.0.1";
        const sessionMetadata = parseUserAgent(userAgent, ipAddress);

        const result = await verifyMfaLogin({
          mfaToken,
          code,
          sessionMetadata,
        });

        if (result.tokens) {
          res.setHeader("Set-Cookie", issueSessionCookie(result.tokens.signedAccessToken));
        }

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            success: true,
            user: result.user,
          }),
        );
      } catch (err) {
        logger.error({
          message: "MFA Login API request failed",
          error: err instanceof Error ? err : new Error(String(err)),
        });
        const httpResponse = mapAuthError(err);
        res.writeHead(httpResponse.statusCode, { "Content-Type": "application/json" });
        res.end(JSON.stringify(httpResponse.body));
      }
    });
    return;
  }

  // 1C. Hook the Logout use case to POST /api/logout`;

if (code.includes(`    });\n    return;\n  }\n\n  // 1C. Hook the Logout use case to POST /api/logout`)) count++;
code = code.replace(
  `    });\n    return;\n  }\n\n  // 1C. Hook the Logout use case to POST /api/logout`,
  mfaVerifyStr
);

const mfaSettingsStr = `  // 1D_MFA. MFA Settings Endpoints
  if (pathname.startsWith("/api/auth/mfa/") && req.method === "POST" && pathname !== "/api/auth/mfa/verify-login") {
    const authHeader = req.headers["authorization"] || "";
    const cookieHeader = req.headers.cookie || "";
    const sessionToken = getCookie(cookieHeader, runtimeConfig.SESSION_COOKIE_NAME);
    const accessToken = authHeader.startsWith("Bearer ") ? authHeader.substring(7) : sessionToken;
    
    if (!accessToken) {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Unauthorized" }));
      return;
    }

    let authResult;
    try {
      authResult = await verifyAccessToken(accessToken);
    } catch (err) {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Invalid Token" }));
      return;
    }
    const userId = authResult.userId;

    let body = "";
    req.on("data", (chunk) => { body += chunk; });
    req.on("end", async () => {
      try {
        if (pathname === "/api/auth/mfa/setup") {
          const userRecs = await db.select().from(users).where(eq(users.id, userId)).limit(1);
          if (!userRecs[0]) throw new Error("User not found");
          const setup = await generateMfaSetup(userId, userRecs[0].email);
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: true, ...setup }));
        } else if (pathname === "/api/auth/mfa/enable") {
          const payload = JSON.parse(body);
          const enabled = await verifyAndEnableMfa(userId, payload.code);
          if (enabled) {
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ success: true }));
          } else {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Invalid code" }));
          }
        } else if (pathname === "/api/auth/mfa/disable") {
          await disableMfa(userId);
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: true }));
        } else {
          res.writeHead(404, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Not found" }));
        }
      } catch (err) {
        logger.error({ message: "MFA settings error", error: err });
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: String(err) }));
      }
    });
    return;
  }

  // 1A_ATTACHMENTS. Attachments API (Upload and Delete)`;

if (code.includes(`  // 1A_ATTACHMENTS. Attachments API (Upload and Delete)`)) count++;
code = code.replace(
  `  // 1A_ATTACHMENTS. Attachments API (Upload and Delete)`,
  mfaSettingsStr
);

console.log("Replacements made:", count);

// Convert back to CRLF before writing
code = code.replace(/\n/g, '\r\n');
fs.writeFileSync('apps/web/server.js', code);
