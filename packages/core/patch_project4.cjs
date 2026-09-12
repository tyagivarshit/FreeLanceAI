const fs = require('fs');
let code = fs.readFileSync('packages/core/src/project.test.ts', 'utf8');

code = code.replace(/Project\.create\(\s*"([^"]+)",\s*"client-1",\s*"owner-1",\s*"([^"]+)",\s*validMetadata,\s*validVisibility,?\s*\);?/g, 'Project.create(\n      "$1",\n      "tenant-1",\n      "client-1",\n      "owner-1",\n      "$2",\n      validMetadata,\n      validVisibility\n    );');

fs.writeFileSync('packages/core/src/project.test.ts', code);
