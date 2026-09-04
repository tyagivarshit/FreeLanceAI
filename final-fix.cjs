const fs = require('fs');
let c = fs.readFileSync('packages/auth/src/session.ts', 'utf8');

c = c.replace('import { logger } from "@freelanceos/logger";', 'import { logger } from "@freelanceos/logger";\nimport { RedisCacheStore } from "@freelanceos/redis";\nconst redisCache = new RedisCacheStore();');

c = c.replace(/export interface SessionResult/, `/**
 * Wraps a promise with a hard timeout to prevent offline queues from hanging the request.
 */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('Redis timeout')), ms))
  ]);
}
export interface SessionResult`);

const oldGrace = `      // Audit check: Compare timestamp delta to support concurrent grace windows
      if (isWithinGracePeriod) {
        logger.warn({
          message: "Session token reuse within concurrency grace window.",
          sessionId,
          timeSinceLastUpdateMs,
        });

        // Fallback: Generate a new valid token pair for the client without revoking session
        const newRawToken = generateRefreshToken();
        const newHash = hashRefreshToken(newRawToken);

        await tx
          .update(sessions)
          .set({
            refreshTokenHash: newHash,
            lastActivityAt: new Date(),
            deviceName: metadata.deviceName ?? session.deviceName,
            platform: metadata.platform ?? session.platform,
            browser: metadata.browser ?? session.browser,
            userAgent: metadata.userAgent,
            ipAddress: metadata.ipAddress,
          })
          .where(eq(sessions.id, sessionId));

        const credentials = await tx
          .select({ credentialVersion: userPasswordHashes.credentialVersion })
          .from(userPasswordHashes)
          .where(eq(userPasswordHashes.userId, session.userId))
          .limit(1);

        const firstCredential = credentials[0];
        const credentialVersion = firstCredential ? firstCredential.credentialVersion : 0;

        const newSignedAccessToken = signAccessToken({
          sessionId: session.id,
          userId: session.userId,
          credentialVersion,
        });

        return {
          newRawRefreshToken: \`\${session.id}.\${newRawToken}\`,
          newSignedAccessToken,
        };
      }`;
c = c.replace(oldGrace, "");

fs.writeFileSync('packages/auth/src/session.ts', c);
