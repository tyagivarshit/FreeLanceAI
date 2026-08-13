import { ExtensionMessageClient } from "./messaging/client.js";

// Explicit Dashboard UI State Enum
type DashboardState =
  | "INITIALIZING"
  | "LOADING"
  | "READY"
  | "EMPTY"
  | "ERROR"
  | "STALE"
  | "OFFLINE";

interface DashboardJob {
  id: string;
  platform: string;
  title: string;
  url: string;
  company?: string;
  location?: string;
  budget?: string;
  description?: string;
  skills: string[];
  experience?: string;
  importedAt: number;
  matchResult?: {
    score: number;
    status: "CREATED" | "EVALUATED" | "ARCHIVED";
    matchedSkills: string[];
    missingSkills: string[];
    skillCoverage: number;
    experienceCompatibility: string;
    budgetCompatibility: string;
    jobTypeCompatibility: string;
    locationCompatibility: string;
    explanation?: string;
  };
}

export class DashboardUI {
  private client: ExtensionMessageClient;
  private jobs: DashboardJob[] = [];
  private selectedJobId: string | null = null;
  private currentFilter: "all" | "upwork" | "linkedin" = "all";
  private searchQuery = "";

  // DOM elements cache
  private elJobList = document.getElementById("job-list-items") as HTMLDivElement;
  private elListSkeleton = document.getElementById("list-skeleton") as HTMLDivElement;
  private elListEmpty = document.getElementById("list-empty-state") as HTMLDivElement;
  private elListError = document.getElementById("list-error-state") as HTMLDivElement;
  private elListErrorTitle = document.getElementById("list-error-title") as HTMLDivElement;
  private elListErrorMessage = document.getElementById("list-error-message") as HTMLDivElement;
  private elListRetryBtn = document.getElementById("list-retry-btn") as HTMLButtonElement;

  private elDetailPlaceholder = document.getElementById("detail-placeholder") as HTMLDivElement;
  private elDetailContent = document.getElementById("detail-content") as HTMLDivElement;
  private elDetailSkeleton = document.getElementById("detail-skeleton") as HTMLDivElement;
  private elDetailError = document.getElementById("detail-error-state") as HTMLDivElement;

  private elSearchInput = document.getElementById("search-input") as HTMLInputElement;
  private elFilterAll = document.getElementById("filter-all") as HTMLButtonElement;
  private elFilterUpwork = document.getElementById("filter-upwork") as HTMLButtonElement;
  private elFilterLinkedin = document.getElementById("filter-linkedin") as HTMLButtonElement;

  private elGlobalRefreshBtn = document.getElementById("global-refresh-btn") as HTMLButtonElement;
  private elConnectionStatus = document.getElementById("connection-status") as HTMLDivElement;
  private elConnectionStatusText = document.getElementById(
    "connection-status-text",
  ) as HTMLSpanElement;

  // Detail content elements
  private elJobTitle = document.getElementById("job-detail-title") as HTMLHeadingElement;
  private elJobPlatform = document.getElementById("job-detail-platform") as HTMLSpanElement;
  private elJobLocation = document.getElementById("job-detail-location") as HTMLSpanElement;
  private elJobBudget = document.getElementById("job-detail-budget") as HTMLSpanElement;
  private elJobScore = document.getElementById("job-detail-score") as HTMLDivElement;
  private elJobSourceLink = document.getElementById("job-source-link") as HTMLAnchorElement;
  private elJobRetryMatchBtn = document.getElementById("job-retry-match-btn") as HTMLButtonElement;
  private elJobExplanation = document.getElementById(
    "job-match-explanation",
  ) as HTMLParagraphElement;
  private elJobDescription = document.getElementById("job-detail-description") as HTMLDivElement;
  private elJobSkillsContainer = document.getElementById("job-skills-container") as HTMLDivElement;

  // Compatibility metrics elements
  private elMetricSkills = document.getElementById("metric-skills-coverage") as HTMLSpanElement;
  private elMetricExperience = document.getElementById(
    "metric-experience-match",
  ) as HTMLSpanElement;
  private elMetricBudget = document.getElementById("metric-budget-fit") as HTMLSpanElement;
  private elMetricLocation = document.getElementById("metric-location-fit") as HTMLSpanElement;

  constructor() {
    this.client = new ExtensionMessageClient();
    this.setupEventListeners();
  }

  public async initialize(): Promise<void> {
    this.setConnectionStatus("online");
    await this.loadJobs(true);
  }

  private setupEventListeners(): void {
    // Refresh handlers
    this.elGlobalRefreshBtn.addEventListener("click", () => this.loadJobs(false));
    this.elListRetryBtn.addEventListener("click", () => this.loadJobs(true));

    // Search and Filters
    this.elSearchInput.addEventListener("input", (e) => {
      this.searchQuery = (e.target as HTMLInputElement).value.trim();
      this.renderJobList();
    });

    this.elFilterAll.addEventListener("click", () => this.setFilter("all"));
    this.elFilterUpwork.addEventListener("click", () => this.setFilter("upwork"));
    this.elFilterLinkedin.addEventListener("click", () => this.setFilter("linkedin"));

    // Retry Match
    this.elJobRetryMatchBtn.addEventListener("click", () => this.retryMatch());

    // Offline state window detection
    window.addEventListener("online", () => {
      this.setConnectionStatus("online");
    });
    window.addEventListener("offline", () => {
      this.setConnectionStatus("offline");
    });
  }

  private setConnectionStatus(status: "online" | "offline" | "stale"): void {
    const dot = this.elConnectionStatus.querySelector(".status-dot") as HTMLSpanElement;
    dot.className = "status-dot";

    if (status === "online") {
      dot.classList.remove("stale", "offline");
      this.elConnectionStatusText.textContent = "Connected";
    } else if (status === "offline") {
      dot.classList.add("offline");
      this.elConnectionStatusText.textContent = "Offline";
    } else {
      dot.classList.add("stale");
      this.elConnectionStatusText.textContent = "Stale";
    }
  }

  private setFilter(filter: "all" | "upwork" | "linkedin"): void {
    this.currentFilter = filter;
    [this.elFilterAll, this.elFilterUpwork, this.elFilterLinkedin].forEach((tab) => {
      tab.classList.remove("active");
      tab.setAttribute("aria-selected", "false");
    });

    if (filter === "all") {
      this.elFilterAll.classList.add("active");
      this.elFilterAll.setAttribute("aria-selected", "true");
    } else if (filter === "upwork") {
      this.elFilterUpwork.classList.add("active");
      this.elFilterUpwork.setAttribute("aria-selected", "true");
    } else if (filter === "linkedin") {
      this.elFilterLinkedin.classList.add("active");
      this.elFilterLinkedin.setAttribute("aria-selected", "true");
    }

    this.renderJobList();
  }

  private showListState(state: DashboardState): void {
    this.elListSkeleton.classList.add("hidden");
    this.elJobList.classList.add("hidden");
    this.elListEmpty.classList.add("hidden");
    this.elListError.classList.add("hidden");

    if (state === "LOADING" || state === "INITIALIZING") {
      this.elListSkeleton.classList.remove("hidden");
    } else if (state === "READY" || state === "STALE") {
      this.elJobList.classList.remove("hidden");
    } else if (state === "EMPTY") {
      this.elListEmpty.classList.remove("hidden");
    } else if (state === "ERROR" || state === "OFFLINE") {
      this.elListError.classList.remove("hidden");
    }
  }

  private showDetailState(state: "placeholder" | "loading" | "ready" | "error"): void {
    this.elDetailPlaceholder.classList.add("hidden");
    this.elDetailContent.classList.add("hidden");
    this.elDetailSkeleton.classList.add("hidden");
    this.elDetailError.classList.add("hidden");

    if (state === "placeholder") {
      this.elDetailPlaceholder.classList.remove("hidden");
    } else if (state === "loading") {
      this.elDetailSkeleton.classList.remove("hidden");
    } else if (state === "ready") {
      this.elDetailContent.classList.remove("hidden");
    } else if (state === "error") {
      this.elDetailError.classList.remove("hidden");
    }
  }

  private async loadJobs(showSkeleton: boolean): Promise<void> {
    if (showSkeleton) {
      this.showListState("LOADING");
    } else {
      this.setConnectionStatus("stale");
    }

    try {
      // IPC Messaging boundary
      const jobs = await this.client.request<object, DashboardJob[]>("GET_DASHBOARD_JOBS", {});
      this.jobs = jobs || [];

      // Query offline status to configure connectivity badge
      const status = await this.client
        .request<
          object,
          { isOnline: boolean; status: string; capturedAt?: number }
        >("GET_OFFLINE_STATUS", {})
        .catch(() => ({ isOnline: true, status: "LIVE", capturedAt: undefined }));

      if (status.status === "OFFLINE_SNAPSHOT") {
        this.setConnectionStatus("offline");
        if (status.capturedAt) {
          const dateStr = new Date(status.capturedAt).toLocaleTimeString();
          this.elConnectionStatusText.textContent = `Offline (Snapshot: ${dateStr})`;
        } else {
          this.elConnectionStatusText.textContent = "Offline Snapshot";
        }
        this.elJobRetryMatchBtn.disabled = true;
        this.elJobRetryMatchBtn.title = "Unavailable offline";
      } else if (status.status === "DEGRADED") {
        this.setConnectionStatus("offline");
        this.elConnectionStatusText.textContent = "Degraded (Backend Unavailable)";
        this.elJobRetryMatchBtn.disabled = true;
        this.elJobRetryMatchBtn.title = "Unavailable offline";
      } else if (status.status === "RECONNECTING") {
        this.setConnectionStatus("stale");
        this.elConnectionStatusText.textContent = "Reconnecting...";
      } else {
        this.setConnectionStatus("online");
        this.elConnectionStatusText.textContent = "Connected";
        this.elJobRetryMatchBtn.disabled = false;
        this.elJobRetryMatchBtn.title = "";
      }

      if (this.jobs.length === 0) {
        this.showListState("EMPTY");
        this.showDetailState("placeholder");
      } else {
        this.showListState("READY");
        this.renderJobList();

        // Autoselect first job if none selected
        if (!this.selectedJobId && this.jobs.length > 0) {
          const filtered = this.getFilteredJobs();
          const firstJob = filtered[0];
          if (firstJob) {
            await this.selectJob(firstJob.id);
          }
        } else if (this.selectedJobId) {
          // Re-render selected details in case score updated
          await this.selectJob(this.selectedJobId);
        }
      }
    } catch (err) {
      const error = err as Error;
      console.error("[Dashboard] Error loading jobs:", error);

      if (!navigator.onLine) {
        this.elListErrorTitle.textContent = "Internet Connection Unavailable";
        this.elListErrorMessage.textContent =
          "You are currently offline and no cached offline snapshot is available.";
        this.showListState("OFFLINE");
      } else {
        this.elListErrorTitle.textContent = "Background Service Unreachable";
        this.elListErrorMessage.textContent = this.sanitizeText(
          error.message || "Failed to communicate with Chrome Service Worker.",
        );
        this.showListState("ERROR");
      }
    }
  }

  private getFilteredJobs(): DashboardJob[] {
    return this.jobs.filter((job) => {
      // 1. Platform check
      if (this.currentFilter !== "all" && job.platform !== this.currentFilter) {
        return false;
      }

      // 2. Search check
      if (this.searchQuery) {
        const query = this.searchQuery.toLowerCase();
        const titleMatch = job.title.toLowerCase().includes(query);
        const descMatch = (job.description || "").toLowerCase().includes(query);
        const companyMatch = (job.company || "").toLowerCase().includes(query);
        const skillsMatch = (job.skills || []).some((s) => s.toLowerCase().includes(query));
        return titleMatch || descMatch || companyMatch || skillsMatch;
      }

      return true;
    });
  }

  private renderJobList(): void {
    const filteredJobs = this.getFilteredJobs();
    this.elJobList.innerHTML = "";

    if (filteredJobs.length === 0) {
      this.elJobList.classList.add("hidden");
      this.elListEmpty.classList.remove("hidden");
      return;
    }

    this.elListEmpty.classList.add("hidden");
    this.elJobList.classList.remove("hidden");

    // Preserve the backend/service ranked order (do not sort by score in UI unless service worker provides ranked)
    filteredJobs.forEach((job) => {
      const card = document.createElement("div");
      card.className = "job-card";
      if (job.id === this.selectedJobId) {
        card.classList.add("selected");
      }

      card.setAttribute("role", "button");
      card.setAttribute("tabindex", "0");
      card.setAttribute("aria-label", `Job: ${job.title}, platform: ${job.platform}`);

      // Handle card click and keyboard accessibility
      const selectHandler = async () => {
        const prevSelected = this.elJobList.querySelector(".job-card.selected");
        if (prevSelected) {
          prevSelected.classList.remove("selected");
        }
        card.classList.add("selected");
        await this.selectJob(job.id);
      };

      card.addEventListener("click", selectHandler);
      card.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          selectHandler();
        }
      });

      // Secure content building to prevent XSS
      const cardHeader = document.createElement("div");
      cardHeader.className = "job-card-header";

      const title = document.createElement("span");
      title.className = "job-card-title";
      title.textContent = job.title;

      const badge = document.createElement("span");
      badge.className = `platform-badge ${job.platform}`;
      badge.textContent = job.platform;

      cardHeader.appendChild(title);
      cardHeader.appendChild(badge);

      const cardMeta = document.createElement("div");
      cardMeta.className = "job-card-meta";

      const companyItem = document.createElement("span");
      companyItem.className = "job-card-meta-item";
      companyItem.textContent = job.company ?? "Not provided";

      const locationItem = document.createElement("span");
      locationItem.className = "job-card-meta-item";
      locationItem.textContent = job.location ?? "Not provided";

      const budgetItem = document.createElement("span");
      budgetItem.className = "job-card-meta-item";
      budgetItem.textContent = job.budget ?? "Not provided";

      cardMeta.appendChild(companyItem);
      cardMeta.appendChild(locationItem);
      cardMeta.appendChild(budgetItem);

      card.appendChild(cardHeader);
      card.appendChild(cardMeta);

      // Match score badge rendering if match exists
      if (job.matchResult) {
        const score = job.matchResult.score;
        const scoreBadge = document.createElement("div");
        scoreBadge.textContent = `Match: ${score}%`;

        let scoreClass = "low";
        if (score >= 80) {
          scoreClass = "high";
        } else if (score >= 50) {
          scoreClass = "medium";
        }

        scoreBadge.className = `match-score-badge ${scoreClass}`;
        card.appendChild(scoreBadge);
      }

      this.elJobList.appendChild(card);
    });
  }

  private async selectJob(jobId: string): Promise<void> {
    this.selectedJobId = jobId;
    this.showDetailState("loading");

    try {
      const job = await this.client.request<{ jobId: string }, DashboardJob>("GET_JOB_DETAILS", {
        jobId,
      });
      if (!job) {
        this.showDetailState("error");
        return;
      }

      this.renderJobDetails(job);

      // Disable match retries if we are offline
      const status = await this.client
        .request<object, { isOnline: boolean }>("GET_OFFLINE_STATUS", {})
        .catch(() => ({
          isOnline: true,
        }));

      if (!status.isOnline) {
        this.elJobRetryMatchBtn.disabled = true;
        this.elJobRetryMatchBtn.title = "Unavailable offline";
      } else {
        this.elJobRetryMatchBtn.disabled = false;
        this.elJobRetryMatchBtn.title = "";
      }

      this.showDetailState("ready");
    } catch (err) {
      console.error("[Dashboard] Error loading job details:", err);
      this.showDetailState("error");
    }
  }

  private renderJobDetails(job: DashboardJob): void {
    // 1. Text content fields (Strictly textContent to prevent XSS)
    this.elJobTitle.textContent = job.title;
    this.elJobPlatform.textContent = job.platform;
    this.elJobPlatform.className = `platform-badge ${job.platform}`;
    this.elJobLocation.textContent = job.location ?? "Not provided";
    this.elJobBudget.textContent = job.budget ?? "Not provided";
    this.elJobDescription.textContent = job.description ?? "Not provided";

    // 2. Safe URL Link Protocol verification
    const safeUrl = this.verifySafeUrl(job.url);
    if (safeUrl) {
      this.elJobSourceLink.setAttribute("href", safeUrl);
      this.elJobSourceLink.classList.remove("hidden");
    } else {
      this.elJobSourceLink.removeAttribute("href");
      this.elJobSourceLink.classList.add("hidden");
    }

    // 3. Match Result rendering
    if (job.matchResult) {
      const score = job.matchResult.score;
      this.elJobScore.textContent = `Match: ${score}%`;

      let scoreClass = "low";
      if (score >= 80) {
        scoreClass = "high";
      } else if (score >= 50) {
        scoreClass = "medium";
      }

      this.elJobScore.className = `match-score-badge ${scoreClass}`;
      this.elJobExplanation.textContent =
        job.matchResult.explanation || "No match explanation available.";
      this.elJobScore.classList.remove("hidden");
      this.elJobExplanation.classList.remove("hidden");

      // Metrics UI updates
      this.updateMetricUI(
        this.elMetricSkills,
        `${Math.round(job.matchResult.skillCoverage * 100)}%`,
      );
      this.updateMetricUI(this.elMetricExperience, job.matchResult.experienceCompatibility);
      this.updateMetricUI(this.elMetricBudget, job.matchResult.budgetCompatibility);
      this.updateMetricUI(this.elMetricLocation, job.matchResult.locationCompatibility);
    } else {
      this.elJobScore.classList.add("hidden");
      this.elJobExplanation.classList.add("hidden");
      this.updateMetricUI(this.elMetricSkills, "N/A");
      this.updateMetricUI(this.elMetricExperience, "N/A");
      this.updateMetricUI(this.elMetricBudget, "N/A");
      this.updateMetricUI(this.elMetricLocation, "N/A");
    }

    // 4. Skills tags render
    this.elJobSkillsContainer.innerHTML = "";
    if (job.skills && job.skills.length > 0) {
      job.skills.forEach((skill) => {
        const tag = document.createElement("span");
        tag.className = "skill-tag";
        tag.textContent = skill;

        // Color coding skills tag according to match signals
        if (job.matchResult) {
          const matched = (job.matchResult.matchedSkills || []).map((s: string) => s.toLowerCase());
          const missing = (job.matchResult.missingSkills || []).map((s: string) => s.toLowerCase());
          const skLower = skill.toLowerCase();

          if (matched.includes(skLower)) {
            tag.classList.add("matched");
          } else if (missing.includes(skLower)) {
            tag.classList.add("missing");
          }
        }

        this.elJobSkillsContainer.appendChild(tag);
      });
    } else {
      const noneText = document.createElement("span");
      noneText.className = "text-secondary";
      noneText.textContent = "No required skills identified.";
      this.elJobSkillsContainer.appendChild(noneText);
    }
  }

  private updateMetricUI(element: HTMLSpanElement, value?: string): void {
    const val = value ?? "Not provided";
    element.textContent = val;
    element.className = "match-metric-value";

    const valLower = val.toLowerCase();
    if (valLower.includes("compatible") || valLower.includes("100%") || parseInt(valLower) >= 80) {
      element.classList.add("compatible");
    } else if (valLower.includes("partial") || parseInt(valLower) >= 50) {
      element.classList.add("partial");
    } else if (valLower.includes("incompatible") || parseInt(valLower) < 50) {
      element.classList.add("incompatible");
    }
  }

  private async retryMatch(): Promise<void> {
    if (!this.selectedJobId) {
      return;
    }

    const status = await this.client
      .request<object, { isOnline: boolean }>("GET_OFFLINE_STATUS", {})
      .catch(() => ({
        isOnline: true,
      }));

    if (!status.isOnline) {
      alert("Match re-evaluation is not available in offline mode.");
      return;
    }

    this.showDetailState("loading");
    try {
      const updatedJob = await this.client.request<{ jobId: string }, DashboardJob>("RETRY_MATCH", {
        jobId: this.selectedJobId,
      });

      // Update in memory jobs list
      const idx = this.jobs.findIndex((j) => j.id === updatedJob.id);
      if (idx >= 0) {
        this.jobs[idx] = updatedJob;
      }

      this.renderJobList();
      this.renderJobDetails(updatedJob);
      this.showDetailState("ready");
    } catch (err) {
      console.error("[Dashboard] Error retrying match:", err);
      this.showDetailState("error");
    }
  }

  // Secure URL verification to prevent javascript: or redirect schemes
  private verifySafeUrl(url: string): string | null {
    if (!url) {
      return null;
    }
    const trimmed = url.trim();
    if (!trimmed.startsWith("https://") && !trimmed.startsWith("http://")) {
      return null;
    }
    try {
      const parsed = new URL(trimmed);
      // Whitelist approved domains
      const validDomains = ["upwork.com", "linkedin.com"];
      const domainMatch = validDomains.some(
        (domain) => parsed.hostname === domain || parsed.hostname.endsWith("." + domain),
      );
      return domainMatch ? parsed.href : null;
    } catch {
      return null;
    }
  }

  private sanitizeText(raw: string): string {
    return raw
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#x27;");
  }
}

// Instantiate and initialize Dashboard on DOM ready
document.addEventListener("DOMContentLoaded", () => {
  const ui = new DashboardUI();
  ui.initialize().catch((err) => console.error("[Dashboard] Startup failure:", err));
});
