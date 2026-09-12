import { BasePlatformAdapter, IngestedJobPayload } from "../core/adapter.js";

/**
 * Chapter 9D: Upwork DOM Interceptor & Semantic Parser
 * Concrete adapter for Upwork, featuring resilient JSON-LD parsing, semantic container bounds,
 * and strict try/catch sandboxes to prevent IPC Port disconnection on layout ruptures.
 */
export class UpworkPlatformAdapter extends BasePlatformAdapter {
  
  public async extractJobData(): Promise<IngestedJobPayload> {
    try {
      return this.parseAggressively();
    } catch (error) {
      console.error("[FreelanceOS] Upwork Parser Uncaught Sandbox Exception:", error);
      // Return a safe fallback to guarantee the multiplexed streaming Port never crashes
      return {
        title: "Extraction Failed",
        description: "Failed to parse Upwork job. Layout rupture detected.",
        sourcePlatform: "UPWORK",
        externalJobId: this.extractJobIdFromUrl(),
        rawMetadata: { error: (error as Error).message }
      };
    }
  }

  public async injectSidebarWidget(shadowRoot: ShadowRoot): Promise<void> {
    // UI injection logic is deferred to Chapter 9F (Overlay UI Views)
    // For now, this meets the interface contract safely.
    console.log("[FreelanceOS] Upwork sidebar widget mounting initialized.");
  }

  private parseAggressively(): IngestedJobPayload {
    // Attempt 1: Strict JSON-LD Structured Graph (Highest Fidelity)
    const jsonLdPayload = this.parseJsonLdGraph();
    if (jsonLdPayload) {
      return jsonLdPayload;
    }

    // Attempt 2: Strict Semantic Fallback (Bounded to main/article to prevent data poisoning)
    return this.parseSemanticFallback();
  }

  /**
   * Targets the main `<script type="application/ld+json">` graph block natively.
   */
  private parseJsonLdGraph(): IngestedJobPayload | null {
    const scripts = document.querySelectorAll('script[type="application/ld+json"]');
    
    for (let i = 0; i < scripts.length; i++) {
      try {
        const textContent = scripts[i].textContent || "";
        const json = JSON.parse(textContent);
        
        // Defensive optional chaining against schema A/B tests
        const isJobPosting = json?.["@type"] === "JobPosting";
        if (isJobPosting) {
          return {
            title: json?.title || "Unknown Title",
            description: json?.description || "",
            sourcePlatform: "UPWORK",
            externalJobId: this.extractJobIdFromUrl(),
            rawMetadata: json,
            budgetFilter: this.extractBudgetFromGraph(json)
          };
        }
      } catch (e) {
        // Silently skip malformed JSON-LD scripts
        continue;
      }
    }
    return null;
  }

  /**
   * Strict semantic fallback targeting only `main[role="main"]` or `article`.
   * Prevents scanning sidebar "similar jobs" or client history to eliminate financial data poisoning.
   */
  private parseSemanticFallback(): IngestedJobPayload {
    const mainContainer = document.querySelector('main[role="main"]') || document.querySelector('article');
    
    if (!mainContainer) {
      throw new Error("Critical layout rupture: Cannot locate main semantic bounds.");
    }

    const titleNode = mainContainer.querySelector("h1");
    const title = titleNode?.textContent?.trim() || "Unknown Title";
    
    // Attempt to isolate the primary description block safely
    const descriptionText = mainContainer.textContent?.trim() || "";

    return {
      title,
      description: descriptionText.substring(0, 5000), // Cap length
      sourcePlatform: "UPWORK",
      externalJobId: this.extractJobIdFromUrl(),
      rawMetadata: { fallbackUsed: true },
      // Without JSON-LD, budget parsing requires regex inside the secure bounds
      budgetFilter: this.extractBudgetFromText(descriptionText)
    };
  }

  private extractJobIdFromUrl(): string {
    const url = window.location.href;
    // Upwork Job IDs usually start with a tilde e.g. ~01abc123...
    const match = url.match(/~([a-zA-Z0-9]+)/);
    return match ? `~${match[1]}` : "UNKNOWN_ID";
  }

  private extractBudgetFromGraph(json: any): { isFixed: boolean, minCents: number, maxCents: number } | undefined {
    // Upwork JSON-LD often includes baseSalary or similar objects
    const baseSalary = json?.baseSalary;
    if (baseSalary?.value?.value) {
      const numericVal = parseFloat(baseSalary.value.value);
      if (!isNaN(numericVal)) {
        const cents = Math.round(numericVal * 100);
        return { isFixed: true, minCents: cents, maxCents: cents };
      }
    }
    return undefined;
  }

  private extractBudgetFromText(text: string): { isFixed: boolean, minCents: number, maxCents: number } | undefined {
    // Extreme fallback: look for "$XX.XX" strictly inside the bounded container
    const match = text.match(/\$(\d+(?:\.\d{2})?)/);
    if (match && match[1]) {
      const numericVal = parseFloat(match[1]);
      if (!isNaN(numericVal)) {
        const cents = Math.round(numericVal * 100);
        return { isFixed: true, minCents: cents, maxCents: cents };
      }
    }
    return undefined;
  }
}
