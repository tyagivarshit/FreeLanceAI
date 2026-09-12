const fs = require("fs");
let c = fs.readFileSync("packages/db/src/repository/client-repository.test.ts", "utf8");
c = c.replace(/Client\.create\(\s*\"8b1deb4d-[^\"]+\",\s*\"8b1deb4d-[^\"]+\",\s*\{ name: \"Acme Corp\"\}/g, \"Client.create(\\\"8b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d\\\", \\\"8b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d\\\", \\\"8b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d\\\", { name: \\\"Acme Corp\\\"}\");
c = c.replace(/Client\.create\(\s*client1,\s*tenantA,\s*\{ name: \"Client 1\",/g, \"Client.create(client1, tenantA, tenantA, { name: \\\"Client 1\\\",\");
c = c.replace(/Client\.create\(\s*client2,\s*tenantA,\s*\{ name: \"Client 2\",/g, \"Client.create(client2, tenantA, tenantA, { name: \\\"Client 2\\\",\");
c = c.replace(/Client\.create\(\s*foreignClient,\s*tenantB,\s*\{ name: \"Foreign Client\",/g, \"Client.create(foreignClient, tenantB, tenantB, { name: \\\"Foreign Client\\\",\");
fs.writeFileSync("packages/db/src/repository/client-repository.test.ts", c);
console.log("Fixed");
