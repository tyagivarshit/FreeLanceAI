import { db } from "../client.js";
import { promptCompositions } from "../schema/prompt-compositions.js";
import { eq, and } from "drizzle-orm";

export interface CompositionRecord {
  id: string;
  tenantId: string;
  ownerId: string;
  reference: string;
  pipelineLayout: any;
  status: string;
}

export interface CacheStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds?: number): Promise<void>;
  delete(key: string): Promise<void>;
}

export class PostgresCompositionRepository {
  private cache: CacheStore;

  constructor(cache: CacheStore) {
    this.cache = cache;
  }

  async getActiveCompositionByReference(tenantId: string, reference: string): Promise<CompositionRecord | null> {
    const cacheKey = `comp:${tenantId}:${reference}`;
    
    // 1. Try Cache First
    const cached = await this.cache.get(cacheKey);
    if (cached) {
      return JSON.parse(cached) as CompositionRecord;
    }

    // 2. Fetch from DB
    const result = await db.select()
      .from(promptCompositions)
      .where(and(
        eq(promptCompositions.tenantId, tenantId),
        eq(promptCompositions.reference, reference),
        eq(promptCompositions.status, "Published")
      ))
      .limit(1);

    const comp = result[0] || null;

    // 3. Write-Through Cache
    if (comp) {
      await this.cache.set(cacheKey, JSON.stringify(comp));
    }

    return comp as CompositionRecord | null;
  }

  async saveComposition(data: CompositionRecord): Promise<void> {
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
    } else {
      await this.cache.delete(cacheKey);
    }
  }

  async listCompositions(tenantId: string): Promise<CompositionRecord[]> {
    return await db.select().from(promptCompositions).where(eq(promptCompositions.tenantId, tenantId)) as CompositionRecord[];
  }
}
