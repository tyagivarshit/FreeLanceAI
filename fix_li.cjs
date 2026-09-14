const fs = require('fs');

const ts = `import { BasePlatformAdapter, IngestedJobPayload } from "../core/adapter.js";

export class LinkedInPlatformAdapter extends BasePlatformAdapter {
  
  public async extractJobData(): Promise<IngestedJobPayload> {
    try {
      const payload = this.parseAggressively();
      if (!payload.title || payload.title === "Unknown Title" || !payload.description || payload.description.length < 20) {
        throw new Error("Insufficient job data extracted. Title or description is missing/invalid.");
      }
      return payload;
    } catch (error: any) {
      console.warn("[FreelanceOS] LinkedIn Parser Diagnostic: Extraction Failed safely. " + error.message);
      throw new Error("Extraction Failed: " + error.message);
    }
  }

  public async injectSidebarWidget(_shadowRoot: ShadowRoot): Promise<void> {
    console.log("[FreelanceOS] LinkedIn sidebar widget mounting initialized.");
  }

  private parseAggressively(): IngestedJobPayload {
    const jsonLdPayload = this.parseJsonLdGraph();
    if (jsonLdPayload) {
      return jsonLdPayload;
    }
    return this.parseSemanticFallback();
  }

  private parseJsonLdGraph(): IngestedJobPayload | null {
    const scripts = document.querySelectorAll('script[type="application/ld+json"]');
    for (let i = 0; i < scripts.length; i++) {
      try {
        const textContent = scripts[i].textContent || "";
        const json = JSON.parse(textContent);
        if (json?.["@type"] === "JobPosting") {
          return {
            title: json?.title || "",
            description: json?.description || "",
            sourcePlatform: "LINKEDIN",
            externalJobId: this.extractJobIdFromUrl(),
            rawMetadata: json,
            ...(this.extractBudgetFromGraph(json) ? { budgetFilter: this.extractBudgetFromGraph(json) } : {})
          };
        }
      } catch (e) {
        continue;
      }
    }
    return null;
  }

  private parseSemanticFallback(): IngestedJobPayload {
    const rightPaneContainer = document.querySelector('main') || document.body;
    const titleNode = rightPaneContainer.querySelector('h1.t-24') || rightPaneContainer.querySelector('h1') || document.querySelector('h1');
    const title = titleNode?.textContent?.trim() || "";
    const detailsNode = rightPaneContainer.querySelector('#job-details') || document.querySelector('.jobs-description');
    const descriptionText = detailsNode?.textContent?.trim() || "";

    return {
      title,
      description: descriptionText.substring(0, 5000),
      sourcePlatform: "LINKEDIN",
      externalJobId: this.extractJobIdFromUrl(),
      rawMetadata: { fallbackUsed: true },
      ...(this.extractBudgetFromText(descriptionText) ? { budgetFilter: this.extractBudgetFromText(descriptionText) } : {})
    };
  }

  private extractJobIdFromUrl(): string {
    const url = window.location.href;
    const viewMatch = url.match(/\/view\/(\d+)/);
    if (viewMatch && viewMatch[1]) return viewMatch[1];
    const queryMatch = url.match(/currentJobId=(\d+)/);
    if (queryMatch && queryMatch[1]) return queryMatch[1];
    return "UNKNOWN_ID";
  }

  private extractBudgetFromGraph(json: any): { isFixed: boolean, minCents: number, maxCents: number } | undefined {
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
    if (!text) return undefined;
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
`;
fs.writeFileSync('apps/extension/src/platform/linkedin/parser.ts', ts);
