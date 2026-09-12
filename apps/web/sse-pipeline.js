import Redis from "ioredis";

/**
 * Issue 7 Fix: Robust SSE (Server-Sent Events) Pipeline
 * Acts as the HTTP bridge delivering the Pub/Sub AI stream 
 * directly to the frontend chunk-by-chunk.
 */
export class SseStreamHandler {
  private redisUrl: string;

  constructor(redisUrl: string = process.env.REDIS_URL || "redis://localhost:6379") {
    this.redisUrl = redisUrl;
  }

  /**
   * Binds an active HTTP connection to the Redis Pub/Sub stream for a specific jobId.
   * Keeps the connection alive via SSE headers to prevent Load Balancer (Nginx/ALB) 504 timeouts.
   */
  public async handleClientStream(req: any, res: any, jobId: string) {
    // 1. Setup proper SSE HTTP Headers
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "Access-Control-Allow-Origin": "*",
    });

    // Flush headers instantly so the Load Balancer knows connection is established
    if (res.flushHeaders) {
      res.flushHeaders();
    }

    // 2. Create isolated Redis subscriber for this exact client connection
    const subscriber = new Redis(this.redisUrl);
    const channel = `ai:stream:${jobId}`;

    // 3. Keep-alive heartbeat (Every 15s) to bypass strict proxy idle timeouts
    const heartbeat = setInterval(() => {
      res.write(":\n\n"); // SSE comment acts as ping
    }, 15000);

    // 4. Redis Subscription Hook
    subscriber.subscribe(channel, (err, count) => {
      if (err) {
        console.error(`[SSE] Failed to subscribe to ${channel}:`, err);
        res.write(`data: ${JSON.stringify({ type: "error", error: "Internal Stream Error" })}\n\n`);
        return this.cleanup(res, subscriber, heartbeat);
      }
    });

    // 5. Message Event Loop
    subscriber.on("message", (subChannel, message) => {
      if (subChannel !== channel) return;

      try {
        const payload = JSON.parse(message);
        
        // Write standard SSE data frame
        res.write(`data: ${message}\n\n`);

        // Close connection cleanly when worker says done or error
        if (payload.type === "done" || payload.type === "error") {
          this.cleanup(res, subscriber, heartbeat);
        }
      } catch (e) {
        console.error("[SSE] Corrupt message received:", e);
      }
    });

    // 6. Client Disconnect Hook (Avoid Memory Leaks)
    req.on("close", () => {
      this.cleanup(res, subscriber, heartbeat);
    });
  }

  /**
   * Gracefully tears down connections and releases memory.
   */
  private cleanup(res: any, subscriber: Redis, heartbeat: NodeJS.Timeout) {
    clearInterval(heartbeat);
    subscriber.quit().catch(() => {}); // Close redis connection quietly
    if (!res.writableEnded) {
      res.end();
    }
  }
}
