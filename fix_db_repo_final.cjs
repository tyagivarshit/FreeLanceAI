const fs = require("fs");

let file = "packages/db/src/repository/prompt-repository.ts";
let content = fs.readFileSync(file, "utf8");

const correctClass = `export class PostgresPromptRepository {
  private cache: CacheStore;

  constructor(cache: CacheStore) {
    this.cache = cache;
  }

  /**
   * Retrieves a prompt. Implements Read-Through Caching.
   */
  async getActivePromptByReference(tenantId: string, reference: string): Promise<PromptRecord | null> {
    const cacheKey = \`prompt:\${tenantId}:\${reference}\`;
    
    // 1. Try Cache First
    const cached = await this.cache.get(cacheKey);
    if (cached) {
      return JSON.parse(cached) as PromptRecord;
    }

    // 2. Cache Miss -> Fetch from DB
    const result = await db.select()
      .from(prompts)
      .where(and(
        eq(prompts.tenantId, tenantId),
        eq(prompts.reference, reference),
        eq(prompts.status, "Published")
      ))
      .limit(1);

    const prompt = result[0] || null;

    // 3. Write to Cache (if found)
    if (prompt) {
      await this.cache.set(cacheKey, JSON.stringify(prompt));
    }

    return prompt as PromptRecord | null;
  }

  /**
   * Saves a prompt. Implements Write-Through Caching.
   */
  async savePrompt(data: PromptRecord): Promise<void> {
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

  async listPrompts(tenantId: string): Promise<PromptRecord[]> {
    return await db.select().from(prompts).where(eq(prompts.tenantId, tenantId)) as PromptRecord[];
  }
}`;

content = content.replace(/export class PostgresPromptRepository \{[\s\S]*\}?/, correctClass);

fs.writeFileSync(file, content);
console.log("Fixed DB Repo");
