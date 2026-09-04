const fs = require('fs');
const lines = fs.readFileSync('apps/web/server.js', 'utf8').split('\n');
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('if (') && lines[i].includes('req.method ===') && !lines[i].includes('verify-email')) {
    console.log(lines[i].trim());
    console.log(lines[i+1].trim());
  }
}
