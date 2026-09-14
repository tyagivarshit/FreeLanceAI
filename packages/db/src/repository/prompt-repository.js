import { db } from "../client.js";
import { prompts } from "../schema/prompts.js";
import { eq, and } from "drizzle-orm";
export class PostgresPromptRepository {
    cache;
    constructor(cache) {
        this.cache = cache;
    }
    /**
     * Retrieves a prompt. Implements Read-Through Caching.
     */
    async getActivePromptByReference(tenantId, reference) {
        const cacheKey = `prompt:${tenantId}:${reference}`;
        // 1. Try Cache First
        const cached = await this.cache.get(cacheKey);
        if (cached) {
            return JSON.parse(cached);
        }
        // 2. Cache Miss -> Fetch from DB
        const result = await db.select()
            .from(prompts)
            .where(and(eq(prompts.tenantId, tenantId), eq(prompts.reference, reference), eq(prompts.status, "Published")))
            .limit(1);
        const prompt = result[0] || null;
        // 3. Write to Cache (if found)
        if (prompt) {
            await this.cache.set(cacheKey, JSON.stringify(prompt));
        }
        return prompt;
    }
    /**
     * Saves a prompt. Implements Write-Through Caching.
     */
    async savePrompt(data) {
        // 1. Write to Postgres
        await db.insert(prompts).values({
            id: data.id,
            tenantId: data.tenantId,
            ownerId: data.ownerId,
            reference: data.reference,
            definition: data.definition,
            metadata: data.metadata,
            visibility: data.visibility || "Private",
            status: data.status,
            createdAt: new Date(),
            updatedAt: new Date()
        }).onConflictDoUpdate({
            target: prompts.id,
            set: {
                definition: data.definition,
                status: data.status,
                updatedAt: new Date()
            }
        });
        // 2. Write-Through Cache
        const cacheKey = `prompt:${data.tenantId}:${data.reference}`;
        if (data.status === "Published") {
            await this.cache.set(cacheKey, JSON.stringify(data));
        }
        else {
            await this.cache.delete(cacheKey);
        }
    }
    async listPrompts(tenantId) {
        return await db.select().from(prompts).where(eq(prompts.tenantId, tenantId));
    }
}
