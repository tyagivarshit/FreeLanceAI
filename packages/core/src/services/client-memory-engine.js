import { db, clientMemories } from "@freelanceos/db";
import { eq, and } from "drizzle-orm";
import crypto from "crypto";
import { logger } from "@freelanceos/logger";
import { eventDispatcher } from "@freelanceos/auth";
/**
 * Chapter 4D: Client Dynamic Memory Engine
 * Implements strict Optimistic Locking for concurrency control and a
 * Rolling Window Token Eviction strategy to prevent Context Length Exceeded crashes.
 */
export class ClientMemoryEngineService {
    gateway;
    // Safe limit: 1500 Tokens (Approx 6000 chars)
    MAX_BUFFER_CHARS = 6000;
    MEMORY_DELIMITER = "\n---\n";
    constructor(gateway) {
        this.gateway = gateway;
    }
    /**
     * Pushes a new fact into the dynamic memory buffer.
     * Auto-handles concurrency race conditions (Lost Updates) and Token Eviction.
     */
    async updateMemoryState(context, maxRetries = 3) {
        let attempt = 0;
        while (attempt < maxRetries) {
            attempt++;
            try {
                await this.tryUpdateMemory(context);
                return; // Success, exit retry loop
            }
            catch (error) {
                if (error.message === "OPTIMISTIC_LOCK_FAILED") {
                    logger.warn({
                        message: `[MemoryEngine] Concurrent update detected. Retrying (${attempt}/${maxRetries})`,
                        clientId: context.clientId
                    });
                    // Tiny random backoff (10ms - 50ms) to desync parallel race conditions
                    await new Promise((resolve) => setTimeout(resolve, Math.random() * 40 + 10));
                    continue;
                }
                throw error; // Bubble up unexpected errors
            }
        }
        throw new Error("Failed to update memory state due to severe concurrency contention.");
    }
    /**
     * The atomic execution block for memory update.
     */
    async tryUpdateMemory(context) {
        const { tenantId, clientId, memoryKey, newFact } = context;
        // 1. Fetch current state with Version (No DB Locking required for read)
        const existingRows = await db
            .select()
            .from(clientMemories)
            .where(and(eq(clientMemories.tenantId, tenantId), eq(clientMemories.clientId, clientId), eq(clientMemories.memoryKey, memoryKey)))
            .limit(1);
        const existing = existingRows[0];
        // 2. Token Eviction Engine (Rolling Window Compression)
        let bufferFacts = [];
        let currentVersion = 0;
        if (existing) {
            bufferFacts = existing.contentBuffer.split(this.MEMORY_DELIMITER).filter(f => f.trim() !== "");
            currentVersion = existing.version;
        }
        // Append new fact to the bottom
        bufferFacts.push(`[${new Date().toISOString()}] ${newFact.trim()}`);
        // Eviction Strategy: Trim oldest facts until buffer is within token limits
        let newBuffer = bufferFacts.join(this.MEMORY_DELIMITER);
        while (newBuffer.length > this.MAX_BUFFER_CHARS && bufferFacts.length > 1) {
            // Discard the oldest fact (index 0)
            bufferFacts.shift();
            newBuffer = bufferFacts.join(this.MEMORY_DELIMITER);
        }
        // Optional advanced compression: Use LLM to compress the entire string if it's still too large
        // (Skipped for pure rolling-window approach to save tokens, but framework is ready)
        // 3. Write Phase with Strict Optimistic Locking
        if (!existing) {
            // Insert new memory stream
            const id = crypto.randomUUID();
            try {
                await db.insert(clientMemories).values({
                    id,
                    tenantId,
                    clientId,
                    memoryKey,
                    contentBuffer: newBuffer,
                    version: 1,
                    createdAt: new Date(),
                    updatedAt: new Date()
                });
            }
            catch (err) {
                // If unique constraint fails during insert, it means a race condition happened. Retry.
                if (err.code === "23505")
                    throw new Error("OPTIMISTIC_LOCK_FAILED");
                throw err;
            }
        }
        else {
            // Update existing memory stream with Version Check
            const nextVersion = currentVersion + 1;
            const updateResult = await db
                .update(clientMemories)
                .set({
                contentBuffer: newBuffer,
                version: nextVersion,
                updatedAt: new Date()
            })
                .where(and(eq(clientMemories.id, existing.id), eq(clientMemories.version, currentVersion) // <--- The Core Optimistic Lock
            ));
            // If affected rows = 0, another process updated the memory first. Throw to trigger retry.
            if (updateResult.rowCount === 0) {
                throw new Error("OPTIMISTIC_LOCK_FAILED");
            }
        }
        // 4. Dispatch Domain Event
        await eventDispatcher.publish("CLIENT_MEMORY_UPDATED", {
            tenantId,
            clientId,
            memoryKey,
            newVersion: currentVersion + 1
        });
    }
    /**
     * Query projection utility
     */
    async getMemoryBuffer(tenantId, clientId, memoryKey) {
        const rows = await db
            .select({ content: clientMemories.contentBuffer })
            .from(clientMemories)
            .where(and(eq(clientMemories.tenantId, tenantId), eq(clientMemories.clientId, clientId), eq(clientMemories.memoryKey, memoryKey)))
            .limit(1);
        return rows[0]?.content || null;
    }
}
