//@ts-nocheck
import { BasePlatformAdapter } from "../core/adapter.js";
export class LinkedInPlatformAdapter extends BasePlatformAdapter {
    async extractJobData() {
        try {
            const payload = this.parseAggressively();
            if (!payload.title || payload.title === "Unknown Title" || !payload.description || payload.description.length < 20) {
                throw new Error("Insufficient job data extracted. Title or description is missing/invalid.");
            }
            return payload;
        }
        catch (error) {
            console.warn("[FreelanceOS] LinkedIn Parser Diagnostic: Extraction Failed safely. " + error.message);
            throw new Error("Extraction Failed: " + error.message);
        }
    }
    async injectSidebarWidget(_shadowRoot) {
        console.log("[FreelanceOS] LinkedIn sidebar widget mounting initialized.");
    }
    parseAggressively() {
        const jsonLdPayload = this.parseJsonLdGraph();
        if (jsonLdPayload) {
            return jsonLdPayload;
        }
        return this.parseSemanticFallback();
    }
    parseJsonLdGraph() {
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
            }
            catch (e) {
                continue;
            }
        }
        return null;
    }
    parseSemanticFallback() {
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
    extractJobIdFromUrl() {
        const url = window.location.href;
        const viewMatch = url.match(/\/view\/(\d+)/);
        if (viewMatch && viewMatch[1])
            return viewMatch[1];
        const queryMatch = url.match(/currentJobId=(\d+)/);
        if (queryMatch && queryMatch[1])
            return queryMatch[1];
        return "UNKNOWN_ID";
    }
    extractBudgetFromGraph(json) {
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
    extractBudgetFromText(text) {
        if (!text)
            return undefined;
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
