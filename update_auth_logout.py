import re

with open('packages/auth/src/token.ts', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace(
    'export function signExtensionToken(userId: string, email: string): string {',
    'export function signExtensionToken(userId: string, email: string, sessionId: string): string {'
)
content = content.replace(
    'jwt.sign({ userId, email, scope: "extension" }',
    'jwt.sign({ userId, email, sessionId, scope: "extension" }'
)

content = content.replace(
    'export function verifyExtensionToken(token: string): { userId: string, email: string } {',
    'export function verifyExtensionToken(token: string): { userId: string, email: string, sessionId: string } {'
)
content = content.replace(
    'return { userId: decoded.userId, email: decoded.email };',
    'return { userId: decoded.userId, email: decoded.email, sessionId: decoded.sessionId };'
)

with open('packages/auth/src/token.ts', 'w', encoding='utf-8') as f:
    f.write(content)

# Now update server.js to use sessionId and check session validity
with open('apps/web/server.js', 'r', encoding='utf-8') as f:
    server = f.read()

new_get_token = r'''  if (pathname === '/api/extension/token' && req.method === 'GET') {
    const auth = await checkAuthentication();
    const ownerId = requireAuthenticatedOwner(auth);
    if (!ownerId) return;

    try {
      const { signExtensionToken } = await import('@freelanceos/auth');
      // Pass the active sessionId from auth context
      const token = signExtensionToken(auth.userId, auth.email, auth.sessionId || "unknown");
      sendJson(200, { success: true, token, tenantId: auth.tenantId });
    } catch (e) {
      handleClientApiError(e);
    }
    return;
  }'''

server = re.sub(
    r"  if \(pathname === '/api/extension/token' && req.method === 'GET'\) \{.*?(?=  if \(pathname === '/api/jobs/import' && req\.method === 'POST'\) \{)",
    new_get_token + '\n\n',
    server,
    flags=re.DOTALL
)

new_bearer_check = r'''    let extensionAuth = null;
    if (!sessionToken && req.headers.authorization && req.headers.authorization.startsWith("Bearer ")) {
      try {
        const { verifyExtensionToken, findActiveSession } = await import("@freelanceos/auth");
        extensionAuth = verifyExtensionToken(req.headers.authorization.substring(7));
        
        // Ensure the session hasn't been revoked/logged out
        if (extensionAuth.sessionId && extensionAuth.sessionId !== "unknown") {
          const sessionData = await findActiveSession(extensionAuth.sessionId);
          if (!sessionData) {
            throw new Error("Session revoked or expired");
          }
        }
      } catch (e) {
        console.error("Extension token invalid", e);
        extensionAuth = null;
      }
    }'''

server = re.sub(
    r'    let extensionAuth = null;\s+if \(!sessionToken && req.headers.authorization && req.headers.authorization.startsWith\("Bearer "\)\) \{.*?      \}\s+    \}',
    new_bearer_check,
    server,
    flags=re.DOTALL
)

with open('apps/web/server.js', 'w', encoding='utf-8') as f:
    f.write(server)
