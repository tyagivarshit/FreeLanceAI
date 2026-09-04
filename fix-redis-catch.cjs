const fs = require('fs');
let code = fs.readFileSync('packages/auth/src/session.ts', 'utf8');

const redisGet1 = `  let cachedStr = null;
  try {
    cachedStr = await redisCache.get(graceKey);
  } catch (err) {
    logger.warn({ message: "Redis grace cache read failed, falling back to db transaction only", error: err.message });
  }

  if (cachedStr) {`;

code = code.replace(/  const cachedStr = await redisCache\.get\(graceKey\);\s+if \(cachedStr\) \{/, redisGet1);

const redisGet2 = `      let concurrentCache = null;
      try {
        concurrentCache = await redisCache.get(graceKey);
      } catch (err) {
        logger.warn({ message: "Redis secondary grace cache read failed", error: err.message });
      }
      if (concurrentCache) {`;

code = code.replace(/      const concurrentCache = await redisCache\.get\(graceKey\);\s+if \(concurrentCache\) \{/, redisGet2);

const redisSet = `    try {
      await redisCache.set(graceKey, JSON.stringify(result), runtimeConfig.ROTATION_GRACE_PERIOD_SEC);
    } catch (err) {
      logger.warn({ message: "Redis grace cache write failed", error: err.message });
    }
    return result;`;

code = code.replace(/    await redisCache\.set\(graceKey, JSON\.stringify\(result\), runtimeConfig\.ROTATION_GRACE_PERIOD_SEC\);\s+return result;/, redisSet);

fs.writeFileSync('packages/auth/src/session.ts', code);
