import { db, outboxEvents } from "@freelanceos/db";
import { eq, sql } from "drizzle-orm";
import { eventDispatcher } from "@freelanceos/auth";
import { logger } from "@freelanceos/logger";
/**
 * Transactional Outbox Worker Engine (Issue 1 Fix)
 * Solves the Dual-Write problem by safely pulling pending domain events
 * that were atomically committed to the database, and dispatching them
 * ensuring At-Least-Once delivery guarantees.
 */
export class OutboxWorker {
    isRunning = false;
    timerId = null;
    /**
     * Starts the polling background worker safely.
     */
    start(pollIntervalMs = 5000) {
        if (this.isRunning)
            return;
        this.isRunning = true;
        logger.info({ message: "[Outbox Worker] Started background event processor." });
        const loop = async () => {
            try {
                await this.processPendingEvents();
            }
            catch (err) {
                logger.error({ message: "[Outbox Worker] Execution failed", error: err instanceof Error ? err : new Error(String(err)) });
            }
            finally {
                if (this.isRunning) {
                    this.timerId = setTimeout(loop, pollIntervalMs);
                }
            }
        };
        loop();
    }
    /**
     * Gracefully shuts down the worker.
     */
    stop() {
        this.isRunning = false;
        if (this.timerId) {
            clearTimeout(this.timerId);
            this.timerId = null;
        }
        logger.info({ message: "[Outbox Worker] Stopped." });
    }
    /**
     * Processes a batch of pending events.
     * Uses FOR UPDATE SKIP LOCKED to prevent concurrent workers from processing the same event.
     */
    async processPendingEvents() {
        return await db.transaction(async (tx) => {
            // 1. Fetch pending events with strict concurrency locks
            const pendingRows = await tx.execute(sql `
        SELECT * FROM ${outboxEvents}
        WHERE status = 'PENDING'
        ORDER BY created_at ASC
        LIMIT 50
        FOR UPDATE SKIP LOCKED
      `);
            const rows = pendingRows.rows ?? pendingRows;
            if (!rows || rows.length === 0) {
                return 0; // Queue empty
            }
            let processedCount = 0;
            // 2. Dispatch and mark processed
            for (const row of rows) {
                try {
                    // Dispatch to the application's actual Event Bus/Broker
                    // Assuming eventDispatcher handles dynamic payload mapping
                    // @ts-ignore
                    await eventDispatcher.publish(row.event_type, row.payload);
                    // Mark as PROCESSED
                    await tx
                        .update(outboxEvents)
                        .set({
                        status: "PROCESSED",
                        processedAt: new Date(),
                        updatedAt: new Date()
                    })
                        .where(eq(outboxEvents.id, row.id));
                    processedCount++;
                }
                catch (e) {
                    // Mark as FAILED to prevent poison pill infinite loops
                    logger.error({
                        message: `[Outbox Worker] Failed to dispatch event ${row.id}`,
                        error: e instanceof Error ? e : new Error(String(e))
                    });
                    await tx
                        .update(outboxEvents)
                        .set({
                        status: "FAILED",
                        updatedAt: new Date()
                    })
                        .where(eq(outboxEvents.id, row.id));
                }
            }
            return processedCount;
        });
    }
}
export const outboxWorker = new OutboxWorker();
