import readline from "readline";
import { db, conversationImports } from "@freelanceos/db";
import crypto from "crypto";
import { logger } from "@freelanceos/logger";
import { eventDispatcher } from "@freelanceos/auth"; // Dispatcher for decoupled processing
/**
 * Chapter 4B: Stream-Based Conversation Ingestion Engine.
 * Built to strictly process massive JSONL datasets (e.g. 50k+ rows) without loading them
 * fully into memory, completely bypassing V8 Garbage Collector OOM (Out-of-Memory) crashes.
 */
export class ImportStreamEngine {
    BATCH_SIZE = 500;
    /**
     * Reads a raw Node.js Readable stream line-by-line (ideal for JSONL payloads).
     * Accumulates chunks in memory and automatically flushes them into Postgres atomically.
     */
    async ingestJsonlStream(inputStream, config) {
        return new Promise((resolve, reject) => {
            let buffer = [];
            let processedCount = 0;
            let failedCount = 0;
            let isFlushing = false;
            // Stream native Readline wrapper (O(1) Memory Footprint)
            const rl = readline.createInterface({
                input: inputStream,
                crlfDelay: Infinity,
            });
            const flushBuffer = async () => {
                if (buffer.length === 0)
                    return;
                isFlushing = true;
                const batch = [...buffer];
                buffer = []; // Instantly clear buffer to receive more lines concurrently
                try {
                    await db.transaction(async (tx) => {
                        const insertPayloads = batch.map((item) => ({
                            id: crypto.randomUUID(),
                            tenantId: config.tenantId,
                            clientId: config.clientId,
                            sourceProvider: config.sourceProvider,
                            externalReferenceId: String(item.externalId || crypto.randomBytes(8).toString("hex")),
                            payload: item.data || item,
                            status: "PENDING",
                        }));
                        // High-performance batch UPSERT utilizing composite index protection
                        await tx
                            .insert(conversationImports)
                            .values(insertPayloads)
                            .onConflictDoNothing({
                            // DO NOTHING guarantees strict protection against duplicate external IDs
                            target: [
                                conversationImports.tenantId,
                                conversationImports.sourceProvider,
                                conversationImports.externalReferenceId,
                            ],
                        });
                        processedCount += batch.length;
                    });
                }
                catch (error) {
                    logger.error({ message: "[ImportStreamEngine] Batch flush failed", error });
                    failedCount += batch.length;
                }
                finally {
                    isFlushing = false;
                }
            };
            rl.on("line", async (line) => {
                if (!line.trim())
                    return;
                try {
                    // Parse precisely one line at a time
                    const parsed = JSON.parse(line);
                    buffer.push(parsed);
                    // Flush asynchronously when batch size is reached
                    if (buffer.length >= this.BATCH_SIZE) {
                        // Pause the stream so we don't overwhelm the DB pool
                        rl.pause();
                        await flushBuffer();
                        rl.resume();
                    }
                }
                catch (err) {
                    logger.warn({ message: "[ImportStreamEngine] Invalid JSON line skipped", line });
                    failedCount++;
                }
            });
            rl.on("close", async () => {
                // Flush any remaining items in the buffer
                if (buffer.length > 0 || isFlushing) {
                    // Wait for flush if it's currently active
                    while (isFlushing) {
                        await new Promise((r) => setTimeout(r, 50));
                    }
                    await flushBuffer();
                }
                // Emit an event for background workers to start mapping raw imports to brains
                await eventDispatcher.publish("BULK_IMPORT_COMPLETED", {
                    tenantId: config.tenantId,
                    clientId: config.clientId,
                    sourceProvider: config.sourceProvider,
                    totalProcessed: processedCount,
                });
                resolve({ processed: processedCount, failed: failedCount });
            });
            rl.on("error", (err) => {
                logger.error({ message: "[ImportStreamEngine] Stream read error", err });
                reject(err);
            });
        });
    }
}
