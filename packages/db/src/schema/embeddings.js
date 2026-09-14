import { pgTable, uuid, varchar, text, jsonb, timestamp, index, uniqueIndex, vector } from "drizzle-orm/pg-core";
import { users } from "./auth.js";
import { clients } from "./clients.js";
export const clientEmbeddings = pgTable("client_embeddings", {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
        .references(() => users.id, { onDelete: "cascade" })
        .notNull(),
    clientId: uuid("client_id")
        .references(() => clients.id, { onDelete: "cascade" })
        .notNull(),
    // Poly-morphic association to map embeddings back to their source (Summary, Memory, File, etc.)
    resourceType: varchar("resource_type", { length: 50 }).notNull(),
    resourceId: varchar("resource_id", { length: 255 }).notNull(),
    // The raw text chunk that this vector represents
    chunkText: text("chunk_text").notNull(),
    // The high-dimensional dense vector mapping natively via pgvector
    embedding: vector("embedding", { dimensions: 1536 }).notNull(),
    // Optional scoped filters (e.g., tags, categories) for pre-filtering before vector seek
    metadata: jsonb("metadata").default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => {
    return {
        // 1. Strict Tenant Boundary Isolation
        tenantIdx: index("client_embeddings_tenant_idx").on(table.tenantId),
        // 2. Client Domain Boundary Isolation
        clientIdx: index("client_embeddings_client_idx").on(table.clientId),
        // 3. Exact Match Lookup (When a specific memory/summary changes, we quickly delete its old vectors)
        resourceIdx: index("client_embeddings_resource_idx").on(table.tenantId, table.clientId, table.resourceType, table.resourceId),
        // 4. pgvector HNSW Index for ultra-fast Approximate Nearest Neighbor (ANN) searches (Cosine Distance)
        hnswIdx: index("client_embeddings_hnsw_idx")
            .using("hnsw", table.embedding.op("vector_cosine_ops")),
    };
});
import { jobImports } from "./jobs.js";
export const jobEmbeddings = pgTable("job_embeddings", {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
        .references(() => users.id, { onDelete: "cascade" })
        .notNull(),
    jobId: uuid("job_id")
        .references(() => jobImports.id, { onDelete: "cascade" })
        .notNull(),
    // The raw text chunk that this vector represents
    chunkText: text("chunk_text").notNull(),
    // Drizzle Native Job Vector Schema
    embedding: vector("embedding", { dimensions: 1536 }).notNull(),
    metadata: jsonb("metadata").default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => {
    return {
        tenantIdx: index("job_embeddings_tenant_idx").on(table.tenantId),
        tenantJobUniqueIdx: uniqueIndex("job_embeddings_tenant_job_unique_idx").on(table.tenantId, table.jobId),
        hnswIdx: index("job_embeddings_hnsw_idx").using("hnsw", table.embedding.op("vector_cosine_ops")),
    };
});
