import { db } from "@freelanceos/db";
import { sql } from "drizzle-orm";
import { EmbeddingEngineService } from "./embedding-engine.js";

export class HybridSearchEngineService {
  constructor(private readonly embeddingEngine: EmbeddingEngineService) {}

  /**
   * Database-Level Hybrid Search Engine
   * Merges Keyword Exact Matches (pg_trgm ILIKE) and Semantic Matches (pgvector HNSW)
   * natively on PostgreSQL using Reciprocal Rank Fusion (RRF), bypassing slow V8 heap sorts.
   */
  public async searchHybrid(
    tenantId: string,
    clientId: string,
    queryText: string,
    resourceType?: string,
    limit: number = 5
  ) {
    // 1. Concurrency Shield: Hard ceiling constraint on row limits
    const safeLimit = Math.min(Math.max(limit, 1), 50);

    // 2. Fetch dense semantic embeddings from the AI Gateway
    const queryVector = await this.embeddingEngine.generateVector(tenantId, queryText);
    const queryVectorString = `[${queryVector.join(",")}]`;
    const textPattern = `%${queryText}%`; // Text search wildcard

    // 3. Optimized PostgreSQL Native Fusion (RRF)
    const result = await db.execute(sql`
      WITH semantic_search AS (
        SELECT id, resource_id, resource_type, chunk_text, metadata,
               (1 - (embedding <=> ${queryVectorString}::vector)) AS vector_score,
               ROW_NUMBER() OVER (ORDER BY embedding <=> ${queryVectorString}::vector) AS vector_rank
        FROM client_embeddings
        WHERE tenant_id = ${tenantId}
          AND client_id = ${clientId}
          ${resourceType ? sql`AND resource_type = ${resourceType}` : sql``}
        ORDER BY embedding <=> ${queryVectorString}::vector
        LIMIT ${safeLimit}
      ),
      keyword_search AS (
        SELECT id, resource_id, resource_type, chunk_text, metadata,
               -- Simulate basic text ranking using length/match heuristics natively, or strict ID ordering
               ROW_NUMBER() OVER (ORDER BY id) AS keyword_rank
        FROM client_embeddings
        WHERE tenant_id = ${tenantId}
          AND client_id = ${clientId}
          ${resourceType ? sql`AND resource_type = ${resourceType}` : sql``}
          AND chunk_text ILIKE ${textPattern}
        LIMIT ${safeLimit}
      )
      SELECT 
        COALESCE(s.id, k.id) AS id,
        COALESCE(s.resource_id, k.resource_id) AS "resourceId",
        COALESCE(s.resource_type, k.resource_type) AS "resourceType",
        COALESCE(s.chunk_text, k.chunk_text) AS "chunkText",
        COALESCE(s.metadata, k.metadata) AS metadata,
        COALESCE(1.0 / (60 + s.vector_rank), 0.0) + 
        COALESCE(1.0 / (60 + k.keyword_rank), 0.0) AS rrf_score
      FROM semantic_search s
      FULL OUTER JOIN keyword_search k ON s.id = k.id
      ORDER BY rrf_score DESC
      LIMIT ${safeLimit};
    `);

    return result.rows;
  }
}
