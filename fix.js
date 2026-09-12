const fs = require('fs');
let project = fs.readFileSync('packages/core/src/project.test.ts', 'utf8');
project = project.replace(
  /Project\.create\(\n\s+"([^"]+)",\n\s+"([^"]+)",\n\s+"([^"]+)",\n\s+"([^"]+)",\n\s+([a-zA-Z_]+),\n\s+([a-zA-Z_]+),?\n\s+\)/g,
  'Project.create(\n        "$1",\n        "tenant-1",\n        "$2",\n        "$3",\n        "$4",\n        $5,\n        $6\n      )'
);
project = project.replace(
  /Project\.create\("([^"]+)", "([^"]+)", "([^"]+)", "([^"]+)", ([a-zA-Z_]+), ([a-zA-Z_]+)\)/g,
  'Project.create("$1", "tenant-1", "$2", "$3", "$4", $5, $6)'
);
fs.writeFileSync('packages/core/src/project.test.ts', project);

let timeline = fs.readFileSync('packages/core/src/timeline.test.ts', 'utf8');
timeline = timeline.replace(
  /ClientTimeline\.create\(\n\s+"([^"]+)",\n\s+"([^"]+)",\n\s+"([^"]+)"\n\s+\)/g,
  'ClientTimeline.create(\n      "$1",\n      "$2",\n      "tenant-1",\n      "$3"\n    )'
);
timeline = timeline.replace(
  /ClientTimeline\.create\("([^"]+)", "([^"]+)", "([^"]+)"\)/g,
  'ClientTimeline.create("$1", "$2", "tenant-1", "$3")'
);
fs.writeFileSync('packages/core/src/timeline.test.ts', timeline);
