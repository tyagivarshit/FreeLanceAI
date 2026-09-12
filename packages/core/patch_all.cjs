const fs = require('fs');
let p = 'src/payment.test.ts';
let code = fs.readFileSync(p, 'utf8');

code = code.replace(
  /const fetched = await mockStore\.findById\("payment-1", "owner-1"\);/g,
  'const fetched = await mockStore.findById("payment-1", "tenant-1");'
);

fs.writeFileSync(p, code);

let t = 'src/timeline.test.ts';
let tcode = fs.readFileSync(t, 'utf8');

tcode = tcode.replace(
  /ClientTimeline\.create\("timeline-1", "client-1", "owner-1"\)/g,
  'ClientTimeline.create("timeline-1", "client-1", "tenant-1", "owner-1")'
);

tcode = tcode.replace(
  /new ClientTimeline\({/g,
  'new ClientTimeline({ tenantId: "tenant-1",'
);

fs.writeFileSync(t, tcode);
console.log("Done");
