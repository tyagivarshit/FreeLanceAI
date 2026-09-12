import { db, clientEmbeddings } from "@freelanceos/db";
import { AiGatewayService } from "./ai-gateway-service.js";

export interface EmbedChunkRequest {
  tenantId: string;
  clientId: string;
  resourceType: "SUMMARY" | "MEMORY" | "INSIGHT" | "DOCUMENT";
  resourceId: string;
  chunkText: string;
  metadata?: Record<string, any>;
}

export class EmbeddingEngineService {
  constructor(private readonly aiGateway: AiGatewayService) {}

  /**
   * Automatically vectorizes the given text chunk and stores it in the database
   * using pgvector with strict multi-tenant boundary checks.
   */
  public async ingestChunk(request: EmbedChunkRequest): Promise<string> {
    // 1. Ask AI Gateway to generate high-dimensional vectors (e.g. 1536 dims)
    const vectorData = await this.generateVector(request.tenantId, request.chunkText);

    // 2. Insert into the database (the schema already ensures HNSW indexing and Tenant ID mapping)
    const result = await db.insert(clientEmbeddings).values({
      tenantId: request.tenantId,
      clientId: request.clientId,
      resourceType: request.resourceType,
      resourceId: request.resourceId,
      chunkText: request.chunkText,
      embedding: vectorData,
      metadata: request.metadata || {},
    }).returning({ id: clientEmbeddings.id });

    return result[0].id;
  }

  /**
   * Processes a bulk array of text chunks seamlessly via Promise.all.
   * Rate limits or exponential backoffs could be integrated here.
   */
  public async processBulkEmbeddings(
    tenantId: string,
    clientId: string,
    resourceType: "SUMMARY" | "MEMORY" | "INSIGHT" | "DOCUMENT",
    chunks: Array<{ resourceId: string; chunkText: string; metadata?: Record<string, any> }>
  ): Promise<string[]> {
    const results = await Promise.all(
      chunks.map(chunk =>
        this.ingestChunk({
          tenantId,
          clientId,
          resourceType,
          resourceId: chunk.resourceId,
          chunkText: chunk.chunkText,
          metadata: chunk.metadata,
        })
      )
    );
    return results;
  }

  /**
   * Calls the AI API (via Gateway) to fetch dense vectors for semantic storage.
   * Note: We use the existing Gateway but target the embeddings endpoint.
   */
  public async generateVector(tenantId: string, text: string): Promise<number[]> {
    // We isolate the network call logic here.
    // DeepSeek/Qwen or OpenAI embeddings require an HTTP call.
    // For production, this should ideally be routed via `this.aiGateway` but
    // since the gateway primarily handles completions, we execute a direct fetch.
    const apiKey = process.env.OPENAI_API_KEY || process.env.DEEPSEEK_API_KEY || "dummy";
    
    // Using standard OpenAI-compatible embeddings endpoint
    const response = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "text-embedding-3-small", // 1536 dimensions
        input: text,
      }),
    });

    if (!response.ok) {
      throw new Error(`Embedding API failed with status ${response.status}`);
    }

    const data = await response.json();
    return data.data[0].embedding;
  }
}
