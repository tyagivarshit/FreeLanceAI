const fs = require('fs');

const pTest = 'D:/FreelanceAI/packages/core/src/project.test.ts';
if (fs.existsSync(pTest)) {
  let p = fs.readFileSync(pTest, 'utf8');
  p = p.replace(/projectId: /g, 'tenantId: "tenant-1",\n        projectId: ');
  p = p.replace(/projectId,\n/g, 'projectId,\n      "tenant-1",\n');
  fs.writeFileSync(pTest, p);
}

const tTest = 'D:/FreelanceAI/packages/core/src/timeline.test.ts';
if (fs.existsSync(tTest)) {
  let t = fs.readFileSync(tTest, 'utf8');
  t = t.replace(/timelineId: /g, 'tenantId: "tenant-1",\n        timelineId: ');
  t = t.replace(/timelineId,\n/g, 'timelineId,\n      "tenant-1",\n');
  fs.writeFileSync(tTest, t);
}
