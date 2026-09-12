const fs = require('fs');
let code = fs.readFileSync('apps/web/server.js', 'utf8');

code = code.replace('  revokeSession,', '  revokeSession,\n  generateMfaSetup,\n  verifyAndEnableMfa,\n  disableMfa,');

const mfaRoutes = `
  // 1D_MFA. MFA Settings Endpoints
  if (pathname.startsWith("/api/auth/mfa/") && req.method === "POST") {
    // Skip /verify-login as it is an unauthenticated endpoint handled above
    if (pathname === "/api/auth/mfa/verify-login") return;

    const auth = await checkAuthentication();
    if (!auth) {
      sendJson(401, { success: false, error: "Unauthorized" });
      return;
    }
    const userId = auth.context.identity.userId;
    
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
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: true, enabled }));
        } else if (pathname === "/api/auth/mfa/disable") {
          const disabled = await disableMfa(userId);
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: true, disabled }));
        } else {
          sendJson(404, { success: false, error: "Not Found" });
        }
      } catch (err) {
        logger.error({ message: "MFA endpoint failed", error: err instanceof Error ? err : new Error(String(err)) });
        sendJson(400, { success: false, error: err.message || "MFA Request Failed" });
      }
    });
    return;
  }
`;

code = code.replace(
  '  // 1E. Hook the Device Listing use case to GET /api/settings/security/sessions',
  mfaRoutes + '\n  // 1E. Hook the Device Listing use case to GET /api/settings/security/sessions'
);

fs.writeFileSync('apps/web/server.js', code);
console.log("Patched server.js with MFA routes!");
