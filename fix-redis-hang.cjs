const fs = require('fs');
let code = fs.readFileSync('packages/auth/src/session.ts', 'utf8');

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

code = code.replace(/await redisCache\.get/g, 'await withTimeout(redisCache.get');
code = code.replace(/\(graceKey\);/g, '(graceKey), 200);');

code = code.replace(/await redisCache\.set\(graceKey, JSON\.stringify\(result\), runtimeConfig\.ROTATION_GRACE_PERIOD_SEC\);/g, 'await withTimeout(redisCache.set(graceKey, JSON.stringify(result), runtimeConfig.ROTATION_GRACE_PERIOD_SEC), 200);');

fs.writeFileSync('packages/auth/src/session.ts', code);
