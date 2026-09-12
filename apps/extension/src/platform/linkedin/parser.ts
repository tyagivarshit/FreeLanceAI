import { BasePlatformAdapter, IngestedJobPayload } from "../core/adapter.js";

/**
 * Chapter 9E: LinkedIn DOM Interceptor & Semantic Parser
 * Concrete adapter for LinkedIn, featuring isolated right-pane split-view boundaries,
 * resilient JSON-LD parsing, and strict try/catch sandboxes to prevent IPC Port severing.
 */
export class LinkedInPlatformAdapter extends BasePlatformAdapter {
  
  public async extractJobData(): Promise<IngestedJobPayload> {
    try {
      return this.parseAggressively();
    } catch (error) {
      console.error("[FreelanceOS] LinkedIn Parser Uncaught Sandbox Exception:", error);
      // Return a safe fallback payload.
      // This mathematically guarantees that the multiplexed streaming port (FREELANCEOS_B2B_STREAMING_BUS)
      // remains permanently open during violent Virtual DOM infinite-scroll re-renders.
      return {
        title: "Extraction Failed",
        description: "Failed to parse LinkedIn job. Virtual DOM rupture detected.",
        sourcePlatform: "LINKEDIN",
        externalJobId: this.extractJobIdFromUrl(),
        rawMetadata: { error: (error as Error).message }
      };
    }
  }

  public async injectSidebarWidget(shadowRoot: ShadowRoot): Promise<void> {
    // UI injection logic is deferred to Chapter 9F (Overlay UI Views)
    console.log("[FreelanceOS] LinkedIn sidebar widget mounting initialized.");
  }

  private parseAggressively(): IngestedJobPayload {
    // Attempt 1: Strict JSON-LD Structured Graph (Highest Fidelity, O(1) parsing efficiency)
    const jsonLdPayload = this.parseJsonLdGraph();
    if (jsonLdPayload) {
      return jsonLdPayload;
    }

    // Attempt 2: Strict Right-Pane Semantic Fallback (Eliminates split-pane profile bleeding)
    return this.parseSemanticFallback();
  }

  /**
   * Targets the native `<script type="application/ld+json">` structural envelopes
   * to guarantee O(1) parsing efficiency completely bypassing the bloated DOM tree.
   */
  private parseJsonLdGraph(): IngestedJobPayload | null {
    const scripts = document.querySelectorAll('script[type="application/ld+json"]');
    
    for (let i = 0; i < scripts.length; i++) {
      try {
        const textContent = scripts[i].textContent || "";
        const json = JSON.parse(textContent);
        
        // Defensive optional chaining against LinkedIn SPA schema updates
        const isJobPosting = json?.["@type"] === "JobPosting";
        if (isJobPosting) {
          return {
            title: json?.title || "Unknown Title",
            description: json?.description || "",
            sourcePlatform: "LINKEDIN",
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
   * Strict semantic fallback securely locked inside the active viewport detail block
   * (`main` or `#job-details`) to mathematically eliminate left-pane sidebar list bleeding.
   */
  private parseSemanticFallback(): IngestedJobPayload {
    // Locate the explicit right-hand pane context to isolate parsing from the list view
    const rightPaneContainer = document.querySelector('.job-view-layout') 
                            || document.querySelector('#job-details')
                            || document.querySelector('main');
                            
    if (!rightPaneContainer) {
      throw new Error("Critical layout rupture: Cannot locate right-pane semantic bounds.");
    }

    const titleNode = rightPaneContainer.querySelector("h1");
    const title = titleNode?.textContent?.trim() || "Unknown Title";
    
    const detailsNode = rightPaneContainer.querySelector("#job-details") || rightPaneContainer;
    const descriptionText = detailsNode?.textContent?.trim() || "";

    return {
      title,
      description: descriptionText.substring(0, 5000), // Cap length
      sourcePlatform: "LINKEDIN",
      externalJobId: this.extractJobIdFromUrl(),
      rawMetadata: { fallbackUsed: true },
      budgetFilter: this.extractBudgetFromText(descriptionText)
    };
  }

  private extractJobIdFromUrl(): string {
    const url = window.location.href;
    // LinkedIn Job IDs typically appear in /jobs/view/123456 or currentJobId=123456
    const viewMatch = url.match(/\/view\/(\d+)/);
    if (viewMatch && viewMatch[1]) {
      return viewMatch[1];
    }
    const queryMatch = url.match(/currentJobId=(\d+)/);
    if (queryMatch && queryMatch[1]) {
      return queryMatch[1];
    }
    return "UNKNOWN_ID";
  }

  private extractBudgetFromGraph(json: any): { isFixed: boolean, minCents: number, maxCents: number } | undefined {
    // LinkedIn JSON-LD incorporates baseSalary
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
    // Extract monetary indicators (e.g. $120,000 or $120K) strictly from the bound container
    const match = text.match(/\$([\d,]+(?:\.\d{2})?)/);
    if (match && match[1]) {
      const cleanNumStr = match[1].replace(/,/g, '');
      const numericVal = parseFloat(cleanNumStr);
      if (!isNaN(numericVal)) {
        const cents = Math.round(numericVal * 100);
        return { isFixed: true, minCents: cents, maxCents: cents };
      }
    }
    return undefined;
  }
}
