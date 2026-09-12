import { BasePlatformAdapter } from "./adapter.js";

/**
 * Tab-Isolated Immutable Factory
 * Evaluates the runtime platform context strictly using the immutable browser parameter window.location.hostname
 */
export class PlatformAdapterFactory {
  /**
   * Generates a localized, single-use immutable adapter instance.
   * Completely eliminates cross-tab context bleeding by rejecting global singletons.
   */
  public static async createAdapter(): Promise<BasePlatformAdapter> {
    const hostname = window.location.hostname.toLowerCase();

    if (hostname.includes("upwork.com")) {
      // Dynamically resolve the Upwork adapter to keep the main bundle lightweight
      const { UpworkAdapter } = await import("../upwork/adapter.js");
      return new UpworkAdapter();
    }

    if (hostname.includes("linkedin.com")) {
      const { LinkedInAdapter } = await import("../linkedin/adapter.js");
      return new LinkedInAdapter();
    }

    throw new Error(`[PLATFORM ROUTER EXCEPTION] Unrecognized or unsupported host context: ${hostname}`);
  }
}
