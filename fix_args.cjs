const fs = require("fs");

let file = "packages/core/src/services/ai-gateway-service.ts";
let content = fs.readFileSync(file, "utf8");

content = content.replace(/consume\(usageKey, this.DAILY_TOKEN_LIMIT, estimatedTotalCost, 86400\)/g, "consume(usageKey, this.DAILY_TOKEN_LIMIT, estimatedTotalCost)");
content = content.replace(/consume\(usageKey, this.DAILY_TOKEN_LIMIT, actualUsage - estimatedTotalCost, 86400\)/g, "consume(usageKey, this.DAILY_TOKEN_LIMIT, actualUsage - estimatedTotalCost)");

fs.writeFileSync(file, content);
console.log("Removed 4th argument");
