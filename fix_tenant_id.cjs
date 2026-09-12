const fs = require("fs");

let file = "packages/db/src/repository/prompt-repository.ts";
let content = fs.readFileSync(file, "utf8");

content = content.replace(/const cacheKey = `prompt:\$\{tenantId\}:\$\{reference\}`;/g, 'const cacheKey = `prompt:${data.tenantId}:${data.reference}`;');

// wait, the first one in getActivePromptByReference SHOULD be tenantId!
// I'll just write it from scratch to be 100% sure.
content = content.replace(/async savePrompt\(data: PromptRecord\): Promise<void> \{[\s\S]*?async listPrompts/m, `async savePrompt(data: PromptRecord): Promise<void> {
    // 1. Write to Postgres
    await db.insert(prompts).values({
      id: data.id,
      tenantId: data.tenantId,
      ownerId: data.ownerId,
      reference: data.reference,
      definition: data.definition,
      metadata: data.metadata,
      visibility: data.visibility || "Private",
      status: data.status as any,
      createdAt: new Date(),
      updatedAt: new Date()
    }).onConflictDoUpdate({
      target: prompts.id,
      set: {
        definition: data.definition,
        status: data.status as any,
        updatedAt: new Date()
      }
    });

    // 2. Write-Through Cache
    const cacheKey = \`prompt:\${data.tenantId}:\${data.reference}\`;
    if (data.status === "Published") {
      await this.cache.set(cacheKey, JSON.stringify(data));
    } else {
      await this.cache.delete(cacheKey);
    }
  }

  async listPrompts`);

fs.writeFileSync(file, content);
console.log("Fixed tenantId in savePrompt");
