import re

with open('apps/web/server.js', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update requireAuthenticatedOwner
content = re.sub(
    r'function requireAuthenticatedOwner\(auth\) \{\s+if \(!auth\?\.context\?\.identity\?\.userId\) \{\s+sendJson\(401, \{ success: false, error: "Unauthorized" \}\);\s+return null;\s+\}\s+return auth\.context\.identity\.userId;\s+\}',
    r'''function requireAuthenticatedOwner(auth) {
    if (!auth?.userId) {
      sendJson(401, { success: false, error: "Unauthorized" });
      return null;
    }
    return auth.userId;
  }''',
    content
)

# 2. Update checkAuthentication to handle Bearer tokens and add tenantId
new_check_auth = r'''  async function checkAuthentication() {
    let sessionToken = "";
    if (req.headers.cookie) {
      const cookies = req.headers.cookie.split(";").map((c) => c.trim());
      const sessionCookie = cookies.find((c) => c.startsWith("session_token="));
      if (sessionCookie) {
        sessionToken = sessionCookie.split("=")[1];
      }
    }

    let extensionAuth = null;
    if (!sessionToken && req.headers.authorization && req.headers.authorization.startsWith("Bearer ")) {
      try {
        const { verifyExtensionToken } = await import("@freelanceos/auth");
        extensionAuth = verifyExtensionToken(req.headers.authorization.substring(7));
      } catch (e) {
        console.error("Extension token invalid", e);
      }
    }

    if (extensionAuth) {
      return {
        userId: extensionAuth.userId,
        email: extensionAuth.email,
        tenantId: "tenant_" + extensionAuth.userId
      };
    }

    if (!sessionToken) return null;
    try {
      const authResult = await authenticateRequest({
        credentialToken: sessionToken,
        routePolicy: "Protected",
        ipAddress: req.socket.remoteAddress || "127.0.0.1",
        userAgent: req.headers["user-agent"] || "unknown",
      });
      if (authResult.status === "Authenticated") {
        try {
          const decoded = verifyAccessToken(sessionToken);
          if (decoded && decoded.sessionId) {
            authResult.context.identity.sessionId = decoded.sessionId;
          }
        } catch(e) {}
        const identity = authResult.context.identity;
        identity.tenantId = "tenant_" + identity.userId;
        return identity;
      }
    } catch (e) {
      console.error(e);
    }
    return null;
  }'''

content = re.sub(
    r'  async function checkAuthentication\(\) \{.*?(?=  function sendJson)',
    new_check_auth + '\n\n',
    content,
    flags=re.DOTALL
)

# 3. Add /api/extension/token endpoint
extension_endpoint = r'''  if (pathname === '/api/extension/token' && req.method === 'GET') {
    const auth = await checkAuthentication();
    const ownerId = requireAuthenticatedOwner(auth);
    if (!ownerId) return;

    try {
      const { signExtensionToken } = await import('@freelanceos/auth');
      const token = signExtensionToken(auth.userId, auth.email);
      sendJson(200, { success: true, token, tenantId: auth.tenantId });
    } catch (e) {
      handleClientApiError(e);
    }
    return;
  }

  if (pathname === '/api/jobs/import' && req.method === 'POST') {'''

content = content.replace("  if (pathname === '/api/jobs/import' && req.method === 'POST') {", extension_endpoint)

with open('apps/web/server.js', 'w', encoding='utf-8') as f:
    f.write(content)
