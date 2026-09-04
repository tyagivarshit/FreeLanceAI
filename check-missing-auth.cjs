const fs = require('fs');
const lines = fs.readFileSync('apps/web/server.js', 'utf8').split('\n');
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('if (') && lines[i].includes('req.method ===') && !lines[i].includes('verify-email')) {
    // get next 15 lines
    let block = lines.slice(i, i+15).join('\n');
    if (!block.includes('checkAuthentication') && !lines[i].includes('/healthz') && !lines[i].includes('/readyz') && !lines[i].includes('/api/signup') && !lines[i].includes('/api/login') && !lines[i].includes('/api/logout') && !lines[i].includes('/api/webhooks/stripe') && !lines[i].includes('OPTIONS')) {
      console.log('MISSING AUTH:', lines[i].trim());
    }
  }
}
