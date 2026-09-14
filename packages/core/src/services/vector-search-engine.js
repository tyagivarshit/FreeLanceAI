import { db, clientEmbeddings } from "@freelanceos/db";
import { eq, and, sql } from "drizzle-orm";
export class VectorSearchEngineService {
    embeddingEngine;
    constructor(embeddingEngine) {
        this.embeddingEngine = embeddingEngine;
    }
    /**
     * Pre-Filtered HNSW Vector Search Engine
     * Enforces strict multi-tenant SQL boundaries BEFORE performing semantic cosine similarity execution.
     */
    async searchSimilarity(tenantId, clientId, queryText, resourceType, limit = 5, similarityThreshold = 0.70) {
        // 1. Generate dense vector for the user query string
        // @ts-ignore - Assuming generateVector is made accessible or injected properly in execution
        const queryVector = await this.embeddingEngine.generateVector(tenantId, queryText);
        // 2. Format the array into a pgvector compatible string explicitly mapped
        const queryVectorString = `[${queryVector.join(",")}]`;
        // Strict Memory Thrashing Guard: Max limits enforced
        const safeLimit = Math.min(Math.max(limit, 1), 50);
        // 3. Strict Pre-Filtered Vector DB Query
        const results = await db
            .select({
            id: clientEmbeddings.id,
            resourceId: clientEmbeddings.resourceId,
            resourceType: clientEmbeddings.resourceType,
            chunkText: clientEmbeddings.chunkText,
            metadata: clientEmbeddings.metadata,
            // Drizzle specific explicit typecast for calculating distance
            similarity: sql `1 - (${clientEmbeddings.embedding} <=> ${queryVectorString})`.as("similarity"),
        })
            .from(clientEmbeddings)
            .where(
        // The most critical part: SQL pre-filtering index boundary BEFORE <-> math runs
        and(eq(clientEmbeddings.tenantId, tenantId), eq(clientEmbeddings.clientId, clientId), resourceType ? eq(clientEmbeddings.resourceType, resourceType) : undefined))
            // Force pgvector to use the HNSW index by mapping the operator inside ORDER BY directly
            .orderBy(sql `${clientEmbeddings.embedding} <=> ${queryVectorString}`)
            .limit(safeLimit);
        // Post-filter the final results via similarity threshold score safely
        return results.filter(row => row.similarity >= similarityThreshold);
    }
}
