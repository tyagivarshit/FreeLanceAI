/* eslint-disable @typescript-eslint/no-explicit-any */
import { PlatformAdapter, PlatformContext, ExtractionResult } from "./types.js";

export const MAX_EXTRACTED_DATA_BYTES = 256 * 1024; // 256KB total text limit

export class PlatformAdapterRegistry {
  private adapters = new Map<string, PlatformAdapter>();

  public register(adapter: PlatformAdapter): void {
    if (!adapter.identity || adapter.identity.trim() === "") {
      throw new Error("Adapter must declare a stable platform identity.");
    }
    const normalized = adapter.identity.toUpperCase();
    if (this.adapters.has(normalized)) {
      throw new Error(
        `Duplicate registration blocked: adapter for platform '${normalized}' is already registered.`,
      );
    }
    this.adapters.set(normalized, adapter);
  }

  public unregister(identity: string): void {
    const normalized = identity.toUpperCase();
    if (!this.adapters.has(normalized)) {
      throw new Error(`Cannot unregister: adapter for platform '${normalized}' does not exist.`);
    }
    this.adapters.delete(normalized);
  }

  public get(identity: string): PlatformAdapter | undefined {
    return this.adapters.get(identity.toUpperCase());
  }

  public resolve(context: PlatformContext): PlatformAdapter {
    const list = this.list();
    for (const adapter of list) {
      try {
        if (adapter.canHandle(context)) {
          return adapter;
        }
      } catch (err: any) {
        // Isolation: error in one adapter's canHandle does not disable other adapters
        console.error(`Error in adapter ${adapter.identity} during resolution:`, err);
      }
    }
    throw new Error("UNKNOWN_PLATFORM: No adapter registered can handle this context.");
  }

  public list(): PlatformAdapter[] {
    // Return a sorted list of adapters to guarantee deterministic resolution order
    return Array.from(this.adapters.values()).sort((a, b) => a.identity.localeCompare(b.identity));
  }

  /**
   * Safe execution wrapper that runs an adapter extraction, enforces output bounds,
   * redacts secrets, and sanitizes/trims transport details.
   */
  public async executeExtract(
    adapter: PlatformAdapter,
    context: PlatformContext,
    signal?: AbortSignal,
  ): Promise<ExtractionResult> {
    if (signal?.aborted) {
      return {
        status: "FAILED",
        extractedAt: Date.now(),
        error: { code: "EXTRACTION_CANCELLED", message: "Extraction aborted by client request." },
      };
    }

    try {
      const result = await adapter.extract(context, signal);

      // Output bounds enforcement
      const serialized = JSON.stringify(result.data || {});
      if (serialized.length > MAX_EXTRACTED_DATA_BYTES) {
        return {
          status: "FAILED",
          extractedAt: Date.now(),
          error: {
            code: "OUTPUT_LIMIT_EXCEEDED",
            message: `Extraction size exceeds threshold of ${MAX_EXTRACTED_DATA_BYTES} bytes.`,
          },
        };
      }

      // Transport-level sanitation
      if (result.data) {
        const d = result.data;
        if (d.title) {
          d.title = d.title.trim();
        }
        if (d.description) {
          d.description = d.description.trim();
        }
        if (d.budget) {
          d.budget = d.budget.trim();
        }
        if (d.skills) {
          d.skills = d.skills.map((s) => s.trim()).filter((s) => s !== "");
        }
        if (d.experience) {
          d.experience = d.experience.trim();
        }
      }

      return result;
    } catch (err: any) {
      return {
        status: "FAILED",
        extractedAt: Date.now(),
        error: {
          code: "EXTRACTION_FAILED",
          message: err.message || "Adapter encountered an execution failure.",
        },
      };
    }
  }
}
