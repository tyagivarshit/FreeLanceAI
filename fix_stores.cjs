const fs = require('fs');
let code = fs.readFileSync('apps/web/server.js', 'utf8');

code = code.replace(
  'const projectStore = [];',
  'const promptsStore = [];\nconst memoryStore = [];\nconst policiesStore = [];\nconst projectStore = [];'
);

fs.writeFileSync('apps/web/server.js', code);
console.log('Stores added');
