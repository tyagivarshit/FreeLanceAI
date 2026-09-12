import { eventDispatcher } from "@freelanceos/auth";
import { db, conversationImports } from "@freelanceos/db";
import { eq, and } from "drizzle-orm";
import { EmbeddingEngineService } from "../services/embedding-engine.js";
import { AiGatewayService } from "../services/ai-gateway-service.js";
import { PostgresGatewayRepository } from "@freelanceos/db";
import { RedisUsageRepository } from "@freelanceos/redis";

/**
 * Clean Event Subscriber for Phase 5A
 * Listens to Phase 4B BULK_IMPORT_COMPLETED to seamlessly run EmbeddingEngineService.processBulkEmbeddings()
 */
export function registerEmbeddingSubscribers() {
  eventDispatcher.subscribe("BULK_IMPORT_COMPLETED", async (payload: any) => {
    const { tenantId, clientId } = payload;
    if (!tenantId || !clientId) return;

    console.log(`[EmbeddingSubscriber] Intercepted BULK_IMPORT_COMPLETED for Tenant: ${tenantId}`);

    try {
      // 1. Pull newly imported content chunks from the Phase 4B imports table
      const newlyImported = await db.select()
        .from(conversationImports)
        .where(
          and(
            eq(conversationImports.tenantId, tenantId),
            eq(conversationImports.clientId, clientId),
            eq(conversationImports.status, "Completed")
          )
        );

      if (newlyImported.length === 0) {
        return;
      }

      // 2. Prepare Chunks
      const chunks = newlyImported.map(record => ({
        resourceId: record.id,
        chunkText: typeof record.rawPayload === "string" ? record.rawPayload : JSON.stringify(record.rawPayload),
        metadata: { sourceProvider: record.sourceProvider }
      }));

      // 3. Setup Dependencies
      const gatewayEnv = {
        DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY || "",
        QWEN_API_KEY: process.env.QWEN_API_KEY || ""
      };
      const aiGateway = new AiGatewayService(
        new PostgresGatewayRepository(),
        new RedisUsageRepository(),
        gatewayEnv
      );
      const embeddingEngine = new EmbeddingEngineService(aiGateway);

      // 4. Pass directly to processBulkEmbeddings without manual trigger
      console.log(`[EmbeddingSubscriber] Processing ${chunks.length} bulk chunks...`);
      await embeddingEngine.processBulkEmbeddings(tenantId, clientId, "DOCUMENT", chunks);
      console.log(`[EmbeddingSubscriber] Successfully generated and stored vectors for Client: ${clientId}`);

    } catch (err) {
      console.error("[EmbeddingSubscriber] Bulk embedding pipeline failed:", err);
    }
  });
}
