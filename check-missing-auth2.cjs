const fs = require('fs');
const lines = fs.readFileSync('apps/web/server.js', 'utf8').split('\n');
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('if (pathname ===') || lines[i].includes('if (pathname.match') || lines[i].includes('if (pathname.startsWith')) {
    let block = lines.slice(i, i+15).join('\n');
    if (!block.includes('checkAuthentication') && !lines[i].includes('/healthz') && !lines[i].includes('/readyz') && !lines[i].includes('/api/signup') && !lines[i].includes('/api/login') && !lines[i].includes('/api/logout') && !lines[i].includes('/api/webhooks/stripe') && !lines[i].includes('OPTIONS') && !lines[i].includes('/api/billing/plans')) {
      console.log('POTENTIAL MISSING AUTH:', lines[i].trim());
    }
  }
}
