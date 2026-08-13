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
  TITLE: [
    ".job-details-jobs-unified-top-card__job-title",
    ".jobs-unified-top-card__job-title",
    ".jobs-details-top-card__job-title",
    ".top-card-layout__title",
    "h1.top-card-layout__title",
    "h1",
  ],
  COMPANY: [
    ".job-details-jobs-unified-top-card__company-name a",
    ".job-details-jobs-unified-top-card__company-name",
    ".jobs-unified-top-card__company-name a",
    ".jobs-unified-top-card__company-name",
    ".top-card-layout__company-name",
    '.top-card-layout__first-subline a[href*="/company/"]',
    ".jobs-details-top-card__company-name",
  ],
  DESCRIPTION: [
    "#job-details",
    ".jobs-description__content",
    ".jobs-description",
    ".jobs-box__html-content",
    ".description__text",
  ],
  LOCATION: [
    ".job-details-jobs-unified-top-card__bullet",
    ".jobs-unified-top-card__bullet",
    ".topcard__flavor--bullet",
    ".top-card-layout__first-subline .topcard__flavor",
    ".jobs-details-top-card__bullet",
  ],
  WORKPLACE_TYPE: [
    ".jobs-unified-top-card__workplace-type",
    ".jobs-details-top-card__workplace-type",
    ".topcard__flavor--workplace",
    ".jobs-workplace-type",
    ".jobs-unified-top-card__job-insight",
  ],
  EMPLOYMENT_TYPE: [
    ".jobs-unified-top-card__job-insight",
    ".jobs-details-top-card__job-insight",
    ".topcard__flavor--insight",
    ".jobs-insight",
  ],
  SENIORITY: [
    ".jobs-unified-top-card__job-insight",
    ".jobs-details-top-card__job-insight",
    ".topcard__flavor--insight",
    ".jobs-insight",
    ".jobs-unified-top-card__experience-level",
  ],
  SKILLS: [
    '.jobs-description__content a[href*="/skills/"]',
    ".jobs-details__skills a",
    ".job-details-skills span",
    ".jobs-unified-top-card__skills a",
  ],
  SALARY: [
    ".jobs-unified-top-card__salary",
    ".jobs-details-top-card__salary",
    ".top-card-layout__salary",
    ".salary-range",
  ],
};

export class LinkedInAdapter implements PlatformAdapter {
  readonly identity = "LINKEDIN";
  public domTimeoutMs = 2000;

  /**
   * Validates if the given context URL belongs to a supported LinkedIn page.
   */
  canHandle(context: PlatformContext): boolean {
    const { url, hostname, pathname } = context;

    // Secure URL protocol validation
    if (!url.startsWith("https://")) {
      return false;
    }

    // Hostname validation to prevent lookalikes (e.g., evil-linkedin.com)
    const isLinkedInHost = hostname === "linkedin.com" || hostname.endsWith(".linkedin.com");
    if (!isLinkedInHost) {
      return false;
    }

    // Path check to reject common unsupported pages
    const isUnsupportedPage =
      pathname.startsWith("/feed") ||
      pathname.startsWith("/in/") ||
      pathname.startsWith("/company/") ||
      pathname.startsWith("/messaging/") ||
      pathname.startsWith("/notifications/") ||
      pathname.startsWith("/settings/") ||
      pathname === "/";

    if (isUnsupportedPage) {
      return false;
    }

    // Determine job context and check for stable jobId in path or query
    const isJobView = pathname.includes("/jobs/view/");
    let hasCurrentJobId = false;
    try {
      const urlObj = new URL(url);
      hasCurrentJobId = urlObj.searchParams.has("currentJobId");
    } catch {
      // url parsing fallback
    }

    const jobIdInPathMatch = pathname.match(/\/jobs\/view\/(?:[^\/]+-)?([0-9]{8,12})/);
    const jobIdInQueryMatch = url.match(/[?&]currentJobId=([0-9]{8,12})/);
    const hasJobId = Boolean(jobIdInPathMatch || jobIdInQueryMatch);

    const isSupportedPath =
      isJobView ||
      hasCurrentJobId ||
      pathname.includes("/jobs/search/") ||
      pathname.includes("/jobs/collections/");

    return hasJobId && isSupportedPath;
  }

  /**
   * Detects if the context points to a valid LinkedIn job page.
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
        `UNSUPPORTED_PLATFORM: URL ${context.url} is not supported by LinkedInAdapter.`,
      );
    }

    const { url, pathname } = context;
    const jobIdInPathMatch = pathname.match(/\/jobs\/view\/(?:[^\/]+-)?([0-9]{8,12})/);
    let externalId: string | undefined;

    if (jobIdInPathMatch && jobIdInPathMatch[1]) {
      externalId = jobIdInPathMatch[1];
    } else {
      const jobIdInQueryMatch = url.match(/[?&]currentJobId=([0-9]{8,12})/);
      if (jobIdInQueryMatch && jobIdInQueryMatch[1]) {
        externalId = jobIdInQueryMatch[1];
      }
    }

    if (!externalId) {
      throw new Error("FAILED_IDENTITY_EXTRACTION: Stable external job ID could not be extracted.");
    }

    const canonicalUrl = `https://www.linkedin.com/jobs/view/${externalId}`;

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
          message: "Context URL is not a supported LinkedIn job page.",
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
          { type: "LINKEDIN_EXTRACT_DOM", context },
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

    // 3. COMPANY (Optional)
    const company = this.extractCompany();
    if (company) {
      payload.metadata = payload.metadata || {};
      payload.metadata.company = company;
    } else {
      warnings.push({ code: "MISSING_COMPANY", message: "Company details are unavailable." });
    }

    // 4. LOCATION (Optional)
    const location = this.extractLocation();
    if (location) {
      payload.metadata = payload.metadata || {};
      payload.metadata.location = location;
    } else {
      warnings.push({ code: "MISSING_LOCATION", message: "Job location is unavailable." });
    }

    // 5. WORKPLACE TYPE (Optional)
    const workplace = this.extractWorkplaceType();
    if (workplace) {
      payload.metadata = payload.metadata || {};
      payload.metadata.workplaceType = workplace;
    } else {
      warnings.push({ code: "MISSING_WORKPLACE_TYPE", message: "Workplace type is unavailable." });
    }

    // 6. EMPLOYMENT TYPE (Optional)
    const employment = this.extractEmploymentType();
    if (employment) {
      payload.metadata = payload.metadata || {};
      payload.metadata.employmentType = employment;
    } else {
      warnings.push({
        code: "MISSING_EMPLOYMENT_TYPE",
        message: "Employment type is unavailable.",
      });
    }

    // 7. SENIORITY (Optional)
    const seniority = this.extractSeniority();
    if (seniority) {
      payload.experience = seniority;
      payload.metadata = payload.metadata || {};
      payload.metadata.seniority = seniority;
    } else {
      warnings.push({ code: "MISSING_SENIORITY", message: "Seniority details are unavailable." });
    }

    // 8. SKILLS (Optional)
    const skills = this.extractSkills();
    if (skills && skills.length > 0) {
      payload.skills = skills;
    } else {
      warnings.push({ code: "MISSING_SKILLS", message: "Skills tags are unavailable." });
    }

    // 9. SALARY (Optional)
    const salaryInfo = this.extractSalary();
    if (salaryInfo) {
      payload.metadata = payload.metadata || {};
      if (salaryInfo.min) {
        payload.metadata.salaryMin = salaryInfo.min;
      }
      if (salaryInfo.max) {
        payload.metadata.salaryMax = salaryInfo.max;
      }
      if (salaryInfo.currency) {
        payload.metadata.salaryCurrency = salaryInfo.currency;
      }
      if (salaryInfo.period) {
        payload.metadata.salaryPeriod = salaryInfo.period;
      }
      if (salaryInfo.raw) {
        payload.metadata.salary = salaryInfo.raw;
        payload.budget = salaryInfo.raw; // also map to main budget parameter
      }
    } else {
      warnings.push({ code: "MISSING_SALARY", message: "Salary information is unavailable." });
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
    const title = raw
      .replace(/\r?\n|\r/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    return title.length > 0 ? title : undefined;
  }

  /**
   * Extracts clean company.
   */
  private extractCompany(): string | undefined {
    const raw = this.extractTextFromSelectors(SELECTORS.COMPANY);
    if (!raw) {
      return undefined;
    }
    const company = raw
      .replace(/\r?\n|\r/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    return company.length > 0 ? company : undefined;
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

    const desc = lines
      .join("")
      .replace(/\r?\n|\r/g, "\n")
      .replace(/[ \t]+/g, " ")
      .trim();
    return desc.length > 0 ? desc : undefined;
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
   * Extracts workplace type Remote/Hybrid/On-site from DOM.
   */
  private extractWorkplaceType(): string | undefined {
    for (const selector of SELECTORS.WORKPLACE_TYPE) {
      const elements = document.querySelectorAll(selector);
      for (let i = 0; i < elements.length; i++) {
        const text = elements[i]?.textContent?.trim() || "";
        if (/remote/i.test(text)) {
          return "Remote";
        }
        if (/hybrid/i.test(text)) {
          return "Hybrid";
        }
        if (/on-site|onsite/i.test(text)) {
          return "On-site";
        }
      }
    }
    return undefined;
  }

  /**
   * Extracts employment type.
   */
  private extractEmploymentType(): string | undefined {
    const keywords = ["Full-time", "Part-time", "Contract", "Temporary", "Internship"];
    for (const selector of SELECTORS.EMPLOYMENT_TYPE) {
      const elements = document.querySelectorAll(selector);
      for (let i = 0; i < elements.length; i++) {
        const text = elements[i]?.textContent || "";
        for (const kw of keywords) {
          const regex = new RegExp(`\\b${kw}\\b`, "i");
          if (regex.test(text)) {
            return kw;
          }
        }
      }
    }
    return undefined;
  }

  /**
   * Extracts seniority.
   */
  private extractSeniority(): string | undefined {
    const keywords = ["Entry level", "Associate", "Mid-Senior level", "Director", "Executive"];
    for (const selector of SELECTORS.SENIORITY) {
      const elements = document.querySelectorAll(selector);
      for (let i = 0; i < elements.length; i++) {
        const text = elements[i]?.textContent || "";
        for (const kw of keywords) {
          const regex = new RegExp(kw.replace("-", "\\-"), "i");
          if (regex.test(text)) {
            return kw;
          }
        }
      }
    }
    return undefined;
  }

  /**
   * Extracts skills array.
   */
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
   * Extracts salary range from DOM.
   */
  private extractSalary():
    | {
        min?: string | undefined;
        max?: string | undefined;
        currency?: string | undefined;
        period?: string | undefined;
        raw?: string;
      }
    | undefined {
    const raw = this.extractTextFromSelectors(SELECTORS.SALARY);
    if (!raw) {
      return undefined;
    }

    const cleanText = raw.trim();
    if (cleanText.length === 0) {
      return undefined;
    }

    const numberMatches = cleanText.replace(/,/g, "").match(/\b[0-9]+(?:\.[0-9]+)?\b/g);
    let min: string | undefined;
    let max: string | undefined;

    if (numberMatches) {
      if (numberMatches.length === 1) {
        min = numberMatches[0];
        max = numberMatches[0];
      } else if (numberMatches.length >= 2) {
        min = numberMatches[0];
        max = numberMatches[1];
      }
    }

    let currency: string | undefined;
    if (cleanText.includes("$")) {
      currency = "USD";
    } else if (cleanText.includes("£")) {
      currency = "GBP";
    } else if (cleanText.includes("€")) {
      currency = "EUR";
    }

    let period: string | undefined;
    if (/hr|hour/i.test(cleanText)) {
      period = "hourly";
    } else if (/yr|year|annual/i.test(cleanText)) {
      period = "yearly";
    } else if (/mo|month/i.test(cleanText)) {
      period = "monthly";
    }

    return {
      min,
      max,
      currency,
      period,
      raw: cleanText,
    };
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
