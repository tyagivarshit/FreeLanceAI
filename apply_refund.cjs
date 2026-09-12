const fs = require("fs");

// 1. Update Core Interface
let coreFile = "packages/core/src/entitlements.ts";
if (fs.existsSync(coreFile)) {
  let coreContent = fs.readFileSync(coreFile, "utf8");
  if (!coreContent.includes("refund(key")) {
    coreContent = coreContent.replace(
      /getUsage\(key: string\): Promise<number>;/g,
      "refund(key: string, amount: number): Promise<void>;\n  getUsage(key: string): Promise<number>;"
    );
    fs.writeFileSync(coreFile, coreContent);
  }
}

// 2. Update Redis Repository
let redisFile = "packages/redis/src/usage-repository.ts";
if (fs.existsSync(redisFile)) {
  let redisContent = fs.readFileSync(redisFile, "utf8");
  if (!redisContent.includes("public async refund")) {
    const refundLogic = `
  public async refund(key: string, amount: number): Promise<void> {
    const script = \`
      local current = tonumber(redis.call('GET', KEYS[1]))
      if current then
        local amt = tonumber(ARGV[1])
        local next_val = current - amt
        if next_val < 0 then next_val = 0 end
        redis.call('SET', KEYS[1], next_val, 'KEEPTTL')
      end
    \`;
    await redis.eval(script, 1, key, amount);
  }

  public async getUsage`;
    redisContent = redisContent.replace(/public async getUsage/g, refundLogic.trim());
    fs.writeFileSync(redisFile, redisContent);
  }
}
