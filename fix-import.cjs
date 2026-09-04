const fs = require('fs');
let c = fs.readFileSync('packages/auth/src/session.ts', 'utf8');

c = c.replace(/import \{ RedisCacheStore \} from "@freelanceos\/redis";\r?\nconst redisCache = new RedisCacheStore\(\);\r?\nimport \{ RedisCacheStore \} from "@freelanceos\/redis";\r?\nconst redisCache = new RedisCacheStore\(\);/, 'import { RedisCacheStore } from "@freelanceos/redis";\nconst redisCache = new RedisCacheStore();');
fs.writeFileSync('packages/auth/src/session.ts', c);
