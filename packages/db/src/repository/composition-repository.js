import { db } from "../client.js";
import { promptCompositions } from "../schema/prompt-compositions.js";
import { eq, and } from "drizzle-orm";
export class PostgresCompositionRepository {
    cache;
    constructor(cache) {
        this.cache = cache;
    }
    async getActiveCompositionByReference(tenantId, reference) {
        const cacheKey = `comp:${tenantId}:${reference}`;
        // 1. Try Cache First
        const cached = await this.cache.get(cacheKey);
        if (cached) {
            return JSON.parse(cached);
        }
        // 2. Fetch from DB
        const result = await db.select()
            .from(promptCompositions)
            .where(and(eq(promptCompositions.tenantId, tenantId), eq(promptCompositions.reference, reference), eq(promptCompositions.status, "Published")))
            .limit(1);
        const comp = result[0] || null;
        // 3. Write-Through Cache
        if (comp) {
            await this.cache.set(cacheKey, JSON.stringify(comp));
        }
        return comp;
    }
    async saveComposition(data) {
        await db.insert(promptCompositions).values({
            id: data.id,
            tenantId: data.tenantId,
            ownerId: data.ownerId,
            reference: data.reference,
            pipelineLayout: data.pipelineLayout,
            status: data.status,
            createdAt: new Date(),
            updatedAt: new Date()
        }).onConflictDoUpdate({
            target: promptCompositions.id,
            set: {
                pipelineLayout: data.pipelineLayout,
                status: data.status,
                updatedAt: new Date()
            }
        });
        const cacheKey = `comp:${data.tenantId}:${data.reference}`;
        if (data.status === "Published") {
            await this.cache.set(cacheKey, JSON.stringify(data));
        }
        else {
            await this.cache.delete(cacheKey);
        }
    }
    async listCompositions(tenantId) {
        return await db.select().from(promptCompositions).where(eq(promptCompositions.tenantId, tenantId));
    }
}
