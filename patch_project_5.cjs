const fs = require('fs');
let code = fs.readFileSync('packages/core/src/project.test.ts', 'utf8');

// The string we want to replace is exactly this:
const search = `    const project = Project.create(
      "project-1",
      "client-1",
      "owner-1",
      "ref-proj-1",
      validMetadata,
      validVisibility,
    );`;

const replace = `    const project = Project.create(
      "project-1",
      "tenant-1",
      "client-1",
      "owner-1",
      "ref-proj-1",
      validMetadata,
      validVisibility,
    );`;

code = code.split(search).join(replace);

const search2 = `    const project = Project.create(
      "project-1",
      "client-1",
      "owner-1",
      "ref-1",
      validMetadata,
      validVisibility,
    );`;

const replace2 = `    const project = Project.create(
      "project-1",
      "tenant-1",
      "client-1",
      "owner-1",
      "ref-1",
      validMetadata,
      validVisibility,
    );`;

code = code.split(search2).join(replace2);

fs.writeFileSync('packages/core/src/project.test.ts', code);
