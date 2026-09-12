import readline from "readline";
import { Readable } from "stream";
import { db, jobImports } from "@freelanceos/db";
import crypto from "crypto";

export interface JobStreamIngestConfig {
  tenantId: string;
  ownerId: string;
  sourcePlatform: string;
}

/**
 * Chapter 8A: OOM-PROOF STREAM INGESTION ENGINE
 * Built to strictly process massive external job datasets without loading them
 * fully into memory, completely bypassing V8 Garbage Collector OOM (Out-of-Memory) crashes.
 */
export class JobImportStreamEngine {
  private readonly BATCH_SIZE = 100; // Strict limit to protect PostgreSQL connection pools

  /**
   * Reads a raw Node.js Readable stream line-by-line.
   * Streams bulk payloads chunk-by-chunk directly into the database.
   */
  public async ingestJobStream(
    inputStream: Readable,
    config: JobStreamIngestConfig
  ): Promise<{ processed: number; failed: number }> {
    return new Promise((resolve, reject) => {
      let buffer: any[] = [];
      let processedCount = 0;
      let failedCount = 0;
      let isFlushing = false;

      // Stream native Readline wrapper (O(1) Memory Footprint)
      const rl = readline.createInterface({
        input: inputStream,
        crlfDelay: Infinity,
      });

      const flushBuffer = async () => {
        if (buffer.length === 0) return;
        
        isFlushing = true;
        const batch = [...buffer];
        buffer = []; // Clear buffer instantly to receive more lines concurrently

        try {
          await db.transaction(async (tx) => {
            const insertPayloads = batch.map((item) => ({
              id: crypto.randomUUID(),
              tenantId: config.tenantId,
              ownerId: config.ownerId,
              sourcePlatform: config.sourcePlatform,
              externalJobId: String(item.externalJobId || crypto.randomBytes(8).toString("hex")),
              title: String(item.title || "Untitled Job").substring(0, 500),
              description: String(item.description || ""),
              budgetFilter: item.budget ? item.budget : null,
              metadataArrays: item.metadata ? item.metadata : null,
            }));

            // High-performance batch UPSERT utilizing composite index protection
            // Strict max 100 records per transaction loop
            await tx
              .insert(jobs)
              .values(insertPayloads)
              .onConflictDoNothing({
                // DO NOTHING guarantees strict protection against multi-tenant data collision
                target: [
                  jobImports.tenantId,
                  jobImports.sourcePlatform,
                  jobImports.externalJobId,
                ],
              });
            
            processedCount += batch.length;
          });
        } catch (error) {
          console.error("[JobImportStreamEngine] Batch flush failed", error);
          failedCount += batch.length;
        } finally {
          isFlushing = false;
        }
      };

      rl.on("line", async (line) => {
        if (!line.trim()) return;

        // Clean up common JSON array wrappers
        let cleanLine = line.trim();
        if (cleanLine === "[" || cleanLine === "]") return;
        if (cleanLine.endsWith(",")) cleanLine = cleanLine.slice(0, -1);

        try {
          const parsed = JSON.parse(cleanLine);
          buffer.push(parsed);

          // Apply backpressure parsing bounds
          if (buffer.length >= this.BATCH_SIZE) {
            rl.pause(); // Block ingestion while flushing
            await flushBuffer();
            rl.resume();
          }
        } catch (err) {
          failedCount++;
        }
      });

      rl.on("close", async () => {
        // Flush any remaining items in the buffer
        if (buffer.length > 0 || isFlushing) {
          while (isFlushing) {
            await new Promise((r) => setTimeout(r, 50));
          }
          await flushBuffer();
        }
        resolve({ processed: processedCount, failed: failedCount });
      });

      rl.on("error", (err) => {
        console.error("[JobImportStreamEngine] Stream read error", err);
        reject(err);
      });
    });
  }
}
