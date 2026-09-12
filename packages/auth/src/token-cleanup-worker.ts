import { db, emailVerifications, passwordResets, sessions } from "@freelanceos/db";
import { lt } from "drizzle-orm";
import { logger } from "@freelanceos/logger";

/**
 * TokenCleanupWorker: Dead Token Bloat Resolution Engine (Issue 4 Fix)
 * Safely purges expired verification tokens, password reset tokens, and dead sessions 
 * from the database to prevent infinite storage bloat.
 */
export class TokenCleanupWorker {
  /**
   * Executes the cleanup operation.
   * Finds all rows where `expiresAt` is strictly in the past and deletes them.
   */
  public async purgeExpiredTokens(): Promise<void> {
    const now = new Date();

    try {
      logger.info({ message: "Starting dead token cleanup cycle..." });

      // Run sequentially to minimize DB connection pool spikes
      await db.delete(sessions).where(lt(sessions.expiresAt, now));
      await db.delete(emailVerifications).where(lt(emailVerifications.expiresAt, now));
      await db.delete(passwordResets).where(lt(passwordResets.expiresAt, now));

      logger.info({ message: "Dead token cleanup cycle completed successfully." });
    } catch (error) {
      logger.error({
        message: "Failed to purge expired tokens",
        error: error instanceof Error ? error : new Error(String(error))
      });
      throw error;
    }
  }

  /**
   * Cron/Interval Automation Layout:
   * Safely mounts the worker to run in the background on a given interval.
   * 
   * @param intervalMinutes The frequency of the cleanup (Default: 60 mins).
   * @returns The NodeJS timeout instance to allow graceful shutdown.
   */
  public startBackgroundScheduler(intervalMinutes = 60): NodeJS.Timeout {
    logger.info({ message: `TokenCleanupWorker scheduled to run every ${intervalMinutes} minutes.` });
    
    // Execute the first purge immediately on startup
    this.purgeExpiredTokens().catch(() => {});

    // Setup the recurring cron interval
    const intervalMs = intervalMinutes * 60 * 1000;
    const timerId = setInterval(() => {
      this.purgeExpiredTokens().catch((err) => {
        logger.error({ message: "Scheduled token cleanup failed", error: err });
      });
    }, intervalMs);

    // Prevent the interval from keeping the Node.js event loop alive 
    // if everything else has gracefully shut down.
    if (timerId.unref) {
      timerId.unref();
    }

    return timerId;
  }
}

// Export singleton instance
export const tokenCleanupWorker = new TokenCleanupWorker();
