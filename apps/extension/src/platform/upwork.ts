import {
  PlatformAdapter,
  PlatformContext,
  PlatformJobIdentity,
  ExtractionResult,
  ExtractionPayload,
  ExtractionWarning,
} from "./types.js";

// Centralized selectors with fallbacks
const SELECTORS = {
  TITLE: ['[data-testid="job-title"]', "h1.job-title", ".job-title", "main h1", "h1"],
  DESCRIPTION: [
    '[data-testid="job-description"]',
    ".job-description",
    'div[itemprop="description"]',
    ".fe-proposal-job-description",
    "section .break-word",
  ],
  BUDGET: [
    '[data-testid="budget"]',
    '[data-testid="job-features"] li:has(strong:contains("Budget"))',
    '[data-testid="job-features"] li:has([data-qa="budget"])',
    '[data-qa="budget"]',
    ".job-features li",
  ],
  SKILLS: [
    '[data-testid="skills"] a',
    '[data-testid="skills"] span',
    ".skills-list a",
    ".job-skills a",
    ".up-skill-badge a",
    'a[href*="/freelance-jobs/"]',
  ],
  LOCATION: [
    '[data-testid="client-location"]',
    '[data-testid="client-country"]',
    '[data-test="client-country"]',
    'strong[itemprop="addressCountry"]',
    ".client-location",
  ],
  EXPERIENCE: [
    '[data-testid="experience-level"]',
    '[data-qa="experience-level"]',
    ".experience-level",
  ],
  HOURS: ['[data-testid="expected-hours"]'],
  DURATION: ['[data-testid="project-length"]'],
};

export class UpworkAdapter implements PlatformAdapter {
  readonly identity = "UPWORK";
  public domTimeoutMs = 2000;

  /**
   * Validates if the given context URL belongs to a supported Upwork page.
   */
  canHandle(context: PlatformContext): boolean {
    const { hostname, pathname } = context;

    // Secure URL protocol validation
    if (!context.url.startsWith("https://")) {
      return false;
    }

    // Hostname validation to prevent lookalikes (e.g., evil-upwork.com)
    const isUpworkHost = hostname === "upwork.com" || hostname.endsWith(".upwork.com");
    if (!isUpworkHost) {
      return false;
    }

    // Pathname validation for supported job shapes
    const hasJobId = /~[a-zA-Z0-9]{15,30}/.test(pathname);
    const isSupportedPath =
      pathname.includes("/jobs/") ||
      pathname.includes("/freelance-jobs/") ||
      pathname.includes("/ab/jobs/") ||
      pathname.includes("/nx/find-work/job-details/");

    return hasJobId && isSupportedPath;
  }

  /**
   * Detects if the context points to a valid Upwork job page.
   */
  async detect(context: PlatformContext): Promise<boolean> {
    return this.canHandle(context);
  }

  /**
   * Extracts external job identity and validates canonical url.
   */
  async identify(context: PlatformContext): Promise<PlatformJobIdentity> {
    if (!this.canHandle(context)) {
      throw new Error(
        `UNSUPPORTED_PLATFORM: URL ${context.url} is not supported by UpworkAdapter.`,
      );
    }

    const match = context.pathname.match(/~([a-zA-Z0-9]{15,30})/);
    if (!match || !match[1]) {
      throw new Error("FAILED_IDENTITY_EXTRACTION: Stable external job ID could not be extracted.");
    }

    const externalId = `~${match[1]}`;
    const canonicalUrl = `https://www.upwork.com/jobs/${externalId}`;

    return {
      platform: this.identity,
      externalId,
      canonicalUrl,
    };
  }

  /**
   * Main entry point for extraction.
   * Delegates to content script via tab messaging if running in service worker,
   * otherwise parses the DOM directly.
   */
  async extract(context: PlatformContext, signal?: AbortSignal): Promise<ExtractionResult> {
    if (signal?.aborted) {
      return {
        status: "FAILED",
        extractedAt: Date.now(),
        error: { code: "EXTRACTION_CANCELLED", message: "Extraction aborted by client request." },
      };
    }

    // 1. Context validation
    if (!this.canHandle(context)) {
      return {
        status: "UNSUPPORTED",
        extractedAt: Date.now(),
        error: {
          code: "UNSUPPORTED_CONTEXT",
          message: "Context URL is not a supported Upwork job page.",
        },
      };
    }

    // Identify job
    let jobId: PlatformJobIdentity;
    try {
      jobId = await this.identify(context);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      return {
        status: "FAILED",
        extractedAt: Date.now(),
        error: { code: "IDENTITY_FAILED", message: errMsg },
      };
    }

    // 2. Delegate to Content Script if in Service Worker (no document object)
    if (typeof document === "undefined") {
      return this.delegateToContentScript(context, jobId, signal);
    }

    // 3. Perform local DOM scraping (running in Content Script context)
    return this.scrapeDOM(context, jobId, signal);
  }

  /**
   * Sends a message to the content script of the tab to extract the job DOM.
   */
  private async delegateToContentScript(
    context: PlatformContext,
    jobId: PlatformJobIdentity,
    signal?: AbortSignal,
  ): Promise<ExtractionResult> {
    return new Promise((resolve) => {
      if (signal?.aborted) {
        return resolve({
          status: "FAILED",
          jobId,
          extractedAt: Date.now(),
          error: { code: "EXTRACTION_CANCELLED", message: "Extraction aborted." },
        });
      }

      let aborted = false;
      const onAbort = () => {
        aborted = true;
        resolve({
          status: "FAILED",
          jobId,
          extractedAt: Date.now(),
          error: { code: "EXTRACTION_CANCELLED", message: "Extraction aborted." },
        });
      };

      if (signal) {
        signal.addEventListener("abort", onAbort);
      }

      // Tab messaging using chrome.tabs if chrome runtime is available
      if (typeof chrome !== "undefined" && chrome.tabs?.sendMessage) {
        chrome.tabs.sendMessage(
          context.tabId,
          { type: "UPWORK_EXTRACT_DOM", context },
          (response) => {
            if (signal) {
              signal.removeEventListener("abort", onAbort);
            }
            if (aborted) {
              return;
            }

            const err = chrome.runtime.lastError;
            if (err) {
              resolve({
                status: "FAILED",
                jobId,
                extractedAt: Date.now(),
                error: {
                  code: "TAB_COMMUNICATION_FAILED",
                  message: `Failed to communicate with tab content script: ${err.message}`,
                },
              });
            } else if (!response) {
              resolve({
                status: "FAILED",
                jobId,
                extractedAt: Date.now(),
                error: {
                  code: "NO_TAB_RESPONSE",
                  message: "Content script did not return any extraction payload.",
                },
              });
            } else {
              // Ensure we enforce job identity context checks to prevent stale page mismatch
              const res = response as ExtractionResult;
              if (res.jobId && res.jobId.externalId !== jobId.externalId) {
                resolve({
                  status: "FAILED",
                  jobId,
                  extractedAt: Date.now(),
                  error: {
                    code: "STALE_CONTEXT",
                    message: `Stale context mismatch: expected ${jobId.externalId}, received ${res.jobId.externalId}`,
                  },
                });
              } else {
                resolve(res);
              }
            }
          },
        );
      } else {
        if (signal) {
          signal.removeEventListener("abort", onAbort);
        }
        resolve({
          status: "FAILED",
          jobId,
          extractedAt: Date.now(),
          error: {
            code: "CHROME_UNAVAILABLE",
            message: "Chrome extension runtime is unavailable.",
          },
        });
      }
    });
  }

  /**
   * Scrapes page DOM contents using centralized selectors and fallbacks.
   */
  private async scrapeDOM(
    context: PlatformContext,
    jobId: PlatformJobIdentity,
    signal?: AbortSignal,
  ): Promise<ExtractionResult> {
    // Dynamic wait block for page load readiness
    try {
      await this.waitForDOMReady(signal, this.domTimeoutMs);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      if (signal?.aborted || errMsg === "AbortError") {
        return {
          status: "FAILED",
          jobId,
          extractedAt: Date.now(),
          error: { code: "EXTRACTION_CANCELLED", message: "Extraction aborted by client request." },
        };
      }

      const hasTitle = Boolean(this.extractTitle());
      const hasDesc = Boolean(this.extractDescription());
      if (!hasTitle && !hasDesc) {
        return {
          status: "FAILED",
          jobId,
          extractedAt: Date.now(),
          error: { code: "TIMEOUT", message: "DOM elements did not become ready within bounds." },
        };
      }
    }

    if (signal?.aborted) {
      return {
        status: "FAILED",
        jobId,
        extractedAt: Date.now(),
        error: { code: "EXTRACTION_CANCELLED", message: "Extraction aborted by client request." },
      };
    }

    // Stale context double check: verify current page URL still matches context URL
    if (typeof window !== "undefined" && window.location?.href) {
      const currentUrl = window.location.href;
      try {
        const currentId = (
          await this.identify({
            ...context,
            url: currentUrl,
            pathname: new URL(currentUrl).pathname,
          })
        ).externalId;
        if (currentId !== jobId.externalId) {
          return {
            status: "FAILED",
            jobId,
            extractedAt: Date.now(),
            error: {
              code: "STALE_CONTEXT",
              message: `Stale context detected. Navigated from ${jobId.externalId} to ${currentId}.`,
            },
          };
        }
      } catch {
        return {
          status: "FAILED",
          jobId,
          extractedAt: Date.now(),
          error: {
            code: "STALE_CONTEXT",
            message: "Stale context detected. Current page is no longer a valid job detail page.",
          },
        };
      }
    }

    const warnings: ExtractionWarning[] = [];
    const payload: ExtractionPayload = {};

    // 1. TITLE (Critical)
    const title = this.extractTitle();
    if (!title) {
      return {
        status: "FAILED",
        jobId,
        extractedAt: Date.now(),
        error: {
          code: "MISSING_CRITICAL_FIELD",
          message: "Critical field 'title' could not be extracted.",
        },
      };
    }
    payload.title = title;

    // 2. DESCRIPTION (Critical)
    const description = this.extractDescription();
    if (!description) {
      return {
        status: "FAILED",
        jobId,
        extractedAt: Date.now(),
        error: {
          code: "MISSING_CRITICAL_FIELD",
          message: "Critical field 'description' could not be extracted.",
        },
      };
    }
    payload.description = description;

    // 3. BUDGET & CURRENCY (Optional)
    const budgetInfo = this.extractBudgetAndCurrency();
    if (budgetInfo.budget) {
      payload.budget = budgetInfo.budget;
    } else {
      warnings.push({ code: "MISSING_BUDGET", message: "Budget details are unavailable." });
    }
    if (budgetInfo.currency) {
      payload.metadata = payload.metadata || {};
      payload.metadata.currency = budgetInfo.currency;
    }

    // 4. SKILLS (Optional)
    const skills = this.extractSkills();
    if (skills && skills.length > 0) {
      payload.skills = skills;
    } else {
      warnings.push({ code: "MISSING_SKILLS", message: "Skills tags are unavailable." });
    }

    // 5. LOCATION (Optional)
    const location = this.extractLocation();
    if (location) {
      payload.metadata = payload.metadata || {};
      payload.metadata.location = location;
    } else {
      warnings.push({ code: "MISSING_LOCATION", message: "Client location is unavailable." });
    }

    // 6. SUPPORTED METADATA (Optional)
    const experience = this.extractTextFromSelectors(SELECTORS.EXPERIENCE);
    if (experience) {
      payload.experience = experience;
    }
    const hours = this.extractTextFromSelectors(SELECTORS.HOURS);
    if (hours) {
      payload.metadata = payload.metadata || {};
      payload.metadata.expectedHours = hours;
    }
    const duration = this.extractTextFromSelectors(SELECTORS.DURATION);
    if (duration) {
      payload.metadata = payload.metadata || {};
      payload.metadata.projectLength = duration;
    }

    // Determine status (if warnings exist, status is PARTIAL)
    const status = warnings.length > 0 ? "PARTIAL" : "SUCCESS";

    return {
      status,
      jobId,
      extractedAt: Date.now(),
      data: payload,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }

  /**
   * Bounded wait for DOM selectors to settle.
   */
  private async waitForDOMReady(signal?: AbortSignal, timeoutMs = 2000): Promise<void> {
    const start = Date.now();
    const checkFn = () => {
      const title = this.extractTitle();
      const desc = this.extractDescription();
      return Boolean(title && desc);
    };

    while (Date.now() - start < timeoutMs) {
      if (signal?.aborted) {
        throw new Error("AbortError");
      }
      if (checkFn()) {
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    if (!checkFn()) {
      throw new Error("TIMEOUT");
    }
  }

  /**
   * Extracts clean trimmed title.
   */
  private extractTitle(): string | undefined {
    const raw = this.extractTextFromSelectors(SELECTORS.TITLE);
    if (!raw) {
      return undefined;
    }
    // Clean Upwork tags or nav leftovers if any
    const title = raw
      .replace(/\r?\n|\r/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    return title.length > 0 ? title : undefined;
  }

  /**
   * Extracts clean trimmed description preserving paragraph structures.
   */
  private extractDescription(): string | undefined {
    let el: Element | null = null;
    for (const selector of SELECTORS.DESCRIPTION) {
      el = document.querySelector(selector);
      if (el) {
        break;
      }
    }

    if (!el) {
      return undefined;
    }

    // Enforce output boundaries and preserve layout whitespace/paragraphs
    const lines: string[] = [];
    el.childNodes.forEach((node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        lines.push(node.textContent || "");
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const elem = node as Element;
        if (elem.tagName === "BR" || elem.tagName === "P" || elem.tagName === "DIV") {
          lines.push("\n");
        }
        lines.push(elem.textContent || "");
      }
    });

    const fullDesc = lines
      .join("")
      .split("\n")
      .map((line) => line.trim())
      .filter((line, i, arr) => line !== "" || (i > 0 && arr[i - 1] !== ""))
      .join("\n")
      .trim();

    return fullDesc.length > 0 ? fullDesc : undefined;
  }

  private extractBudgetAndCurrency(): { budget?: string; currency?: string } {
    let budgetText = this.extractTextFromSelectors(SELECTORS.BUDGET);
    if (!budgetText) {
      // Look for hourly range / features info
      const features = document.querySelectorAll('[data-testid="job-features"] li');
      for (let i = 0; i < features.length; i++) {
        const text = features[i]?.textContent || "";
        if (text.includes("Budget") || text.includes("Fixed-price")) {
          budgetText = text;
          break;
        }
      }
    }

    if (!budgetText) {
      return {};
    }

    // Parse currency if present
    let currency: string | undefined;
    if (budgetText.includes("$")) {
      currency = "USD";
    } else if (budgetText.includes("€") || budgetText.includes("EUR")) {
      currency = "EUR";
    } else if (budgetText.includes("£") || budgetText.includes("GBP")) {
      currency = "GBP";
    }

    // Format clean budget string (e.g. "$500")
    // Keep fixed price budgets or hourly rate strings clean
    const cleaned = budgetText
      .replace(/\r?\n|\r/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    const result: { budget?: string; currency?: string } = {};
    if (cleaned.length > 0) {
      result.budget = cleaned;
    }
    if (currency) {
      result.currency = currency;
    }
    return result;
  }

  private extractSkills(): string[] | undefined {
    let elements: NodeListOf<Element> | null = null;
    for (const selector of SELECTORS.SKILLS) {
      elements = document.querySelectorAll(selector);
      if (elements && elements.length > 0) {
        break;
      }
    }

    if (!elements || elements.length === 0) {
      return undefined;
    }

    const skills: string[] = [];
    for (let i = 0; i < elements.length; i++) {
      const text = elements[i]?.textContent?.trim();
      if (text && text.length > 0 && !skills.includes(text)) {
        skills.push(text);
      }
    }

    return skills.length > 0 ? skills : undefined;
  }

  /**
   * Extracts client location.
   */
  private extractLocation(): string | undefined {
    const raw = this.extractTextFromSelectors(SELECTORS.LOCATION);
    if (!raw) {
      return undefined;
    }
    const clean = raw
      .replace(/\r?\n|\r/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    return clean.length > 0 ? clean : undefined;
  }

  /**
   * Helper to retrieve clean text from a list of selectors.
   */
  private extractTextFromSelectors(selectors: string[]): string | undefined {
    for (const selector of selectors) {
      const el = document.querySelector(selector);
      if (el) {
        const text = el.textContent?.trim();
        if (text && text.length > 0) {
          return text;
        }
      }
    }
    return undefined;
  }
}
