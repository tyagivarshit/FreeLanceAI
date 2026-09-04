const fs = require('fs');
let code = fs.readFileSync('packages/auth/src/session.ts', 'utf8');

code = code.replace(
  'import { redis } from "@freelanceos/redis";',
  'import { RedisCacheStore } from "@freelanceos/redis";\nconst redisCache = new RedisCacheStore();'
);

code = code.replace(/await redis\.get/g, 'await redisCache.get');
code = code.replace(/await redis\.setex\(graceKey, (.*?), JSON\.stringify\(result\)\)/g, 'await redisCache.set(graceKey, JSON.stringify(result), $1)');

fs.writeFileSync('packages/auth/src/session.ts', code);
