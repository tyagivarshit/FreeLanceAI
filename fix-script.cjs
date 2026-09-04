const fs = require('fs');
let code = fs.readFileSync('packages/auth/src/session.ts', 'utf8');

// Add Redis import
code = code.replace(
  'import { logger } from "@freelanceos/logger";',
  'import { logger } from "@freelanceos/logger";\nimport { redis } from "@freelanceos/redis";'
);

// Add missing drizzle-orm operators
code = code.replace(
  'import { eq, and, gt, isNull } from "drizzle-orm";',
  'import { eq, and, gt, isNull, lt, isNotNull, or, asc, inArray } from "drizzle-orm";'
);

// Bug #2 Fix: Add opportunistic cleanup and cap enforcement inside createSession
const createSessionTarget = '  const credentials = await db';
const capLogic = `
  // Opportunistic Cleanup: Delete expired or revoked sessions for this user to prevent DB bloat
  await db.delete(sessions)
    .where(
      and(
        eq(sessions.userId, userId),
        or(isNotNull(sessions.revokedAt), lt(sessions.expiresAt, new Date()))
      )
    );

  // Enforce Max Concurrent Sessions Cap
  const maxSessions = runtimeConfig.MAX_CONCURRENT_SESSIONS ?? 5;
  const activeSessions = await db.select({ id: sessions.id })
    .from(sessions)
    .where(and(eq(sessions.userId, userId), isNull(sessions.revokedAt), gt(sessions.expiresAt, new Date())))
    .orderBy(asc(sessions.lastActivityAt));

  if (activeSessions.length >= maxSessions) {
    const toRevokeCount = activeSessions.length - maxSessions + 1;
    const toRevokeIds = activeSessions.slice(0, toRevokeCount).map(s => s.id);
    await db.update(sessions)
      .set({ revokedAt: new Date() })
      .where(inArray(sessions.id, toRevokeIds));
    logger.info({ message: \`Revoked \${toRevokeCount} oldest sessions to enforce concurrency cap of \${maxSessions}\`, userId });
  }

  const credentials = await db`;
code = code.replace(createSessionTarget, capLogic);

// Bug #1 Fix: Use Redis for Grace Period to return Identical Tokens idenpotently
const rotateSessionStart = '  const submittedHash = hashRefreshToken(rawToken);';
const graceCacheLogic = `
  const submittedHash = hashRefreshToken(rawToken);
  const graceKey = \`session:grace:\${submittedHash}\`;

  const cachedStr = await redis.get(graceKey);
  if (cachedStr) {
    logger.info({ message: "Served identical token pair from concurrent rotation grace cache", sessionId });
    return JSON.parse(cachedStr);
  }`;
code = code.replace(rotateSessionStart, graceCacheLogic);

const isWithinGracePeriodBlock = /if \(isWithinGracePeriod\) \{\s+logger\.warn\(\{[\s\S]+?return \{\s+newRawRefreshToken[^}]+\};\s+\}\s+/;
code = code.replace(isWithinGracePeriodBlock, '');

// Also remove the timeSinceLastUpdateMs declaration since it's unused now
code = code.replace(/const timeSinceLastUpdateMs =[^;]+;\s+const isWithinGracePeriod =[^;]+;\s+/, '');

// Now add the setex at the end of the transaction
code = code.replace(
  /return \{\s+newRawRefreshToken: `\$\{session\.id\}\.\$\{newRawToken\}`,\s+newSignedAccessToken,\s+\};\s+\}\);/,
  `const result = {
      newRawRefreshToken: \`\${session.id}.\${newRawToken}\`,
      newSignedAccessToken,
    };
    
    await redis.setex(graceKey, runtimeConfig.ROTATION_GRACE_PERIOD_SEC, JSON.stringify(result));
    return result;
  });`
);

fs.writeFileSync('packages/auth/src/session.ts', code);
