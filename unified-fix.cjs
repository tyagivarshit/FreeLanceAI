const fs = require('fs');
let code = fs.readFileSync('packages/auth/src/session.ts', 'utf8');

// 1. Add redisCache import
code = code.replace(
  'import { logger } from "@freelanceos/logger";',
  'import { logger } from "@freelanceos/logger";\nimport { RedisCacheStore } from "@freelanceos/redis";\nconst redisCache = new RedisCacheStore();'
);

const timeoutHelper = `
/**
 * Wraps a promise with a hard timeout to prevent offline queues from hanging the request.
 */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('Redis timeout')), ms))
  ]);
}
`;
code = code.replace(/export interface SessionResult/, timeoutHelper + '\nexport interface SessionResult');

// 2. Add the grace cache check at the START of rotateSession
const rotateSessionStart = '  const submittedHash = hashRefreshToken(rawToken);';
const graceCacheLogic = `
  const submittedHash = hashRefreshToken(rawToken);
  const graceKey = \`session:grace:\${submittedHash}\`;

  try {
    const cachedStr = await withTimeout(redisCache.get(graceKey), 200);
    if (cachedStr) {
      logger.info({ message: "Served identical token pair from concurrent rotation grace cache", sessionId });
      return JSON.parse(cachedStr);
    }
  } catch (err) {
    logger.error({ message: "Redis cache get failed during rotation", err });
  }`;
code = code.replace(rotateSessionStart, graceCacheLogic);

// 3. Remove the old DB-based fallback
const isWithinGracePeriodBlock = /if \(isWithinGracePeriod\) \{\s+logger\.warn\(\{[\s\S]+?return \{\s+newRawRefreshToken[^}]+\};\s+\}\s+/;
code = code.replace(isWithinGracePeriodBlock, '');
code = code.replace(/const timeSinceLastUpdateMs =[^;]+;\s+const isWithinGracePeriod =[^;]+;\s+/, '');

// 4. Save the new token pair to redis cache at the end
code = code.replace(
  /return \{\s+newRawRefreshToken: `\$\{session\.id\}\.\$\{newRawToken\}`,\s+newSignedAccessToken,\s+\};\s+\}\);/,
  `const result = {
      newRawRefreshToken: \`\${session.id}.\${newRawToken}\`,
      newSignedAccessToken,
    };
    
    try {
      await withTimeout(redisCache.set(graceKey, JSON.stringify(result), runtimeConfig.ROTATION_GRACE_PERIOD_SEC), 200);
    } catch(err) {
      logger.error({ message: "Redis cache set failed during rotation", err });
    }
    return result;
  });`
);

fs.writeFileSync('packages/auth/src/session.ts', code);
