const fs = require('fs');
let code = fs.readFileSync('packages/core/src/timeline.test.ts', 'utf8');
code = code.replace(/timeline\.appendEntry\("owner-1"/g, 'timeline.appendEntry("tenant-1"');
code = code.replace(/timeline\.archive\("owner-1"/g, 'timeline.archive("tenant-1"');
code = code.replace(/timeline\.reactivate\("owner-1"/g, 'timeline.reactivate("tenant-1"');
fs.writeFileSync('packages/core/src/timeline.test.ts', code);
