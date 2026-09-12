const fs = require("fs");
let code = fs.readFileSync("apps/web/server.js", "utf8");
code = code.replace(
  'import { AiGatewayService, PostgresGatewayRepository } from "@freelanceos/db";',
  'import { AiGatewayService } from "@freelanceos/core";\nimport { PostgresGatewayRepository } from "@freelanceos/db";'
);
fs.writeFileSync("apps/web/server.js", code);
