const fs = require('fs');
let code = fs.readFileSync('packages/auth/src/session.ts', 'utf8');

const target = `    if (!isCurrentToken) {
      // Replay attack invariant triggered! Invalidate all user sessions immediately.`;

const replacement = `    if (!isCurrentToken) {
      try {
        const concurrentCache = await withTimeout(redisCache.get(graceKey), 200);
        if (concurrentCache) {
          logger.info({ message: "Served identical token pair from concurrent rotation grace cache AFTER lock", sessionId });
          return JSON.parse(concurrentCache);
        }
      } catch (err) {
        logger.error({ message: "Redis secondary grace cache read failed", err });
      }
      // Replay attack invariant triggered! Invalidate all user sessions immediately.`;

code = code.replace(target, replacement);
fs.writeFileSync('packages/auth/src/session.ts', code);
