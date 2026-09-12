const fs = require('fs');
let code = fs.readFileSync('apps/web/server.js', 'utf8');

const injection = `
// ==========================================
// Phase 3 AI Infrastructure Mock Stores
// ==========================================
const promptsStore = [];
const memoryStore = [];
const policiesStore = [];

const server = http.createServer`;

code = code.replace('const server = http.createServer', injection);
fs.writeFileSync('apps/web/server.js', code);
console.log('Stores added correctly this time!');
