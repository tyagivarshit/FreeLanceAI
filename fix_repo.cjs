const fs = require("fs");
let c = fs.readFileSync("packages/db/src/repository/client-repository.test.ts", "utf8");
c = c.replace(/Client\.create\(([^,]+),\s*([^,]+),\s*(\{ name:[^,]+})/g, "Client.create(" + String.fromCharCode(36) + "1, " + String.fromCharCode(36) + "2, " + String.fromCharCode(36) + "2, " + String.fromCharCode(36) + "3");
c = c.replace(/Client\.create\(([^,]+),\s*([^,]+),\s*validProfile\)/g, "Client.create(" + String.fromCharCode(36) + "1, " + String.fromCharCode(36) + "2, " + String.fromCharCode(36) + "2, validProfile)");
c = c.replace(/Client\.create\(\s*\"client-id\",\s*\"owner-id\",\s*validProfile\)/g, "Client.create(\"client-id\", \"owner-id\", \"owner-id\", validProfile)");
c = c.replace(/ownerId: tenantA,/g, "ownerId: tenantA, tenantId: tenantA,");
fs.writeFileSync("packages/db/src/repository/client-repository.test.ts", c);
console.log("Fixed");
