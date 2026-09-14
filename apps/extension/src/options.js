import { ExtensionMessageClient } from "./messaging/client.js";
export class DashboardUI {
    client;
    jobs = [];
    selectedJobId = null;
    currentFilter = "all";
    searchQuery = "";
    // DOM elements cache
    elJobList = document.getElementById("job-list-items");
    elListSkeleton = document.getElementById("list-skeleton");
    elListEmpty = document.getElementById("list-empty-state");
    elListError = document.getElementById("list-error-state");
    elListErrorTitle = document.getElementById("list-error-title");
    elListErrorMessage = document.getElementById("list-error-message");
    elListRetryBtn = document.getElementById("list-retry-btn");
    elDetailPlaceholder = document.getElementById("detail-placeholder");
    elDetailContent = document.getElementById("detail-content");
    elDetailSkeleton = document.getElementById("detail-skeleton");
    elDetailError = document.getElementById("detail-error-state");
    elSearchInput = document.getElementById("search-input");
    elFilterAll = document.getElementById("filter-all");
    elFilterUpwork = document.getElementById("filter-upwork");
    elFilterLinkedin = document.getElementById("filter-linkedin");
    elGlobalRefreshBtn = document.getElementById("global-refresh-btn");
    elConnectionStatus = document.getElementById("connection-status");
    elConnectionStatusText = document.getElementById("connection-status-text");
    // Detail content elements
    elJobTitle = document.getElementById("job-detail-title");
    elJobPlatform = document.getElementById("job-detail-platform");
    elJobLocation = document.getElementById("job-detail-location");
    elJobBudget = document.getElementById("job-detail-budget");
    elJobScore = document.getElementById("job-detail-score");
    elJobSourceLink = document.getElementById("job-source-link");
    elJobRetryMatchBtn = document.getElementById("job-retry-match-btn");
    elJobExplanation = document.getElementById("job-match-explanation");
    elJobDescription = document.getElementById("job-detail-description");
    elJobSkillsContainer = document.getElementById("job-skills-container");
    // Compatibility metrics elements
    elMetricSkills = document.getElementById("metric-skills-coverage");
    elMetricExperience = document.getElementById("metric-experience-match");
    elMetricBudget = document.getElementById("metric-budget-fit");
    elMetricLocation = document.getElementById("metric-location-fit");
    constructor() {
        this.client = new ExtensionMessageClient();
        this.setupEventListeners();
    }
    async initialize() {
        this.setConnectionStatus("online");
        await this.loadJobs(true);
    }
    setupEventListeners() {
        // Refresh handlers
        this.elGlobalRefreshBtn.addEventListener("click", () => this.loadJobs(false));
        this.elListRetryBtn.addEventListener("click", () => this.loadJobs(true));
        // Search and Filters
        this.elSearchInput.addEventListener("input", (e) => {
            this.searchQuery = e.target.value.trim();
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
    setConnectionStatus(status) {
        const dot = this.elConnectionStatus.querySelector(".status-dot");
        dot.className = "status-dot";
        if (status === "online") {
            dot.classList.remove("stale", "offline");
            this.elConnectionStatusText.textContent = "Connected";
        }
        else if (status === "offline") {
            dot.classList.add("offline");
            this.elConnectionStatusText.textContent = "Offline";
        }
        else {
            dot.classList.add("stale");
            this.elConnectionStatusText.textContent = "Stale";
        }
    }
    setFilter(filter) {
        this.currentFilter = filter;
        [this.elFilterAll, this.elFilterUpwork, this.elFilterLinkedin].forEach((tab) => {
            tab.classList.remove("active");
            tab.setAttribute("aria-selected", "false");
        });
        if (filter === "all") {
            this.elFilterAll.classList.add("active");
            this.elFilterAll.setAttribute("aria-selected", "true");
        }
        else if (filter === "upwork") {
            this.elFilterUpwork.classList.add("active");
            this.elFilterUpwork.setAttribute("aria-selected", "true");
        }
        else if (filter === "linkedin") {
            this.elFilterLinkedin.classList.add("active");
            this.elFilterLinkedin.setAttribute("aria-selected", "true");
        }
        this.renderJobList();
    }
    showListState(state) {
        this.elListSkeleton.classList.add("hidden");
        this.elJobList.classList.add("hidden");
        this.elListEmpty.classList.add("hidden");
        this.elListError.classList.add("hidden");
        if (state === "LOADING" || state === "INITIALIZING") {
            this.elListSkeleton.classList.remove("hidden");
        }
        else if (state === "READY" || state === "STALE") {
            this.elJobList.classList.remove("hidden");
        }
        else if (state === "EMPTY") {
            this.elListEmpty.classList.remove("hidden");
        }
        else if (state === "ERROR" || state === "OFFLINE") {
            this.elListError.classList.remove("hidden");
        }
    }
    showDetailState(state) {
        this.elDetailPlaceholder.classList.add("hidden");
        this.elDetailContent.classList.add("hidden");
        this.elDetailSkeleton.classList.add("hidden");
        this.elDetailError.classList.add("hidden");
        if (state === "placeholder") {
            this.elDetailPlaceholder.classList.remove("hidden");
        }
        else if (state === "loading") {
            this.elDetailSkeleton.classList.remove("hidden");
        }
        else if (state === "ready") {
            this.elDetailContent.classList.remove("hidden");
        }
        else if (state === "error") {
            this.elDetailError.classList.remove("hidden");
        }
    }
    async loadJobs(showSkeleton) {
        if (showSkeleton) {
            this.showListState("LOADING");
        }
        else {
            this.setConnectionStatus("stale");
        }
        try {
            // IPC Messaging boundary
            const jobs = await this.client.request("GET_DASHBOARD_JOBS", {});
            this.jobs = jobs || [];
            // Query offline status to configure connectivity badge
            const status = await this.client
                .request("GET_OFFLINE_STATUS", {})
                .catch(() => ({ isOnline: true, status: "LIVE", capturedAt: undefined }));
            if (status.status === "OFFLINE_SNAPSHOT") {
                this.setConnectionStatus("offline");
                if (status.capturedAt) {
                    const dateStr = new Date(status.capturedAt).toLocaleTimeString();
                    this.elConnectionStatusText.textContent = `Offline (Snapshot: ${dateStr})`;
                }
                else {
                    this.elConnectionStatusText.textContent = "Offline Snapshot";
                }
                this.elJobRetryMatchBtn.disabled = true;
                this.elJobRetryMatchBtn.title = "Unavailable offline";
            }
            else if (status.status === "DEGRADED") {
                this.setConnectionStatus("offline");
                this.elConnectionStatusText.textContent = "Degraded (Backend Unavailable)";
                this.elJobRetryMatchBtn.disabled = true;
                this.elJobRetryMatchBtn.title = "Unavailable offline";
            }
            else if (status.status === "RECONNECTING") {
                this.setConnectionStatus("stale");
                this.elConnectionStatusText.textContent = "Reconnecting...";
            }
            else {
                this.setConnectionStatus("online");
                this.elConnectionStatusText.textContent = "Connected";
                this.elJobRetryMatchBtn.disabled = false;
                this.elJobRetryMatchBtn.title = "";
            }
            if (this.jobs.length === 0) {
                this.showListState("EMPTY");
                this.showDetailState("placeholder");
            }
            else {
                this.showListState("READY");
                this.renderJobList();
                // Autoselect first job if none selected
                if (!this.selectedJobId && this.jobs.length > 0) {
                    const filtered = this.getFilteredJobs();
                    const firstJob = filtered[0];
                    if (firstJob) {
                        await this.selectJob(firstJob.id);
                    }
                }
                else if (this.selectedJobId) {
                    // Re-render selected details in case score updated
                    await this.selectJob(this.selectedJobId);
                }
            }
        }
        catch (err) {
            const error = err;
            console.error("[Dashboard] Error loading jobs:", error);
            if (!navigator.onLine) {
                this.elListErrorTitle.textContent = "Internet Connection Unavailable";
                this.elListErrorMessage.textContent =
                    "You are currently offline and no cached offline snapshot is available.";
                this.showListState("OFFLINE");
            }
            else {
                this.elListErrorTitle.textContent = "Background Service Unreachable";
                this.elListErrorMessage.textContent = this.sanitizeText(error.message || "Failed to communicate with Chrome Service Worker.");
                this.showListState("ERROR");
            }
        }
    }
    getFilteredJobs() {
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
    renderJobList() {
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
                }
                else if (score >= 50) {
                    scoreClass = "medium";
                }
                scoreBadge.className = `match-score-badge ${scoreClass}`;
                card.appendChild(scoreBadge);
            }
            this.elJobList.appendChild(card);
        });
    }
    async selectJob(jobId) {
        this.selectedJobId = jobId;
        this.showDetailState("loading");
        try {
            const job = await this.client.request("GET_JOB_DETAILS", {
                jobId,
            });
            if (!job) {
                this.showDetailState("error");
                return;
            }
            this.renderJobDetails(job);
            // Disable match retries if we are offline
            const status = await this.client
                .request("GET_OFFLINE_STATUS", {})
                .catch(() => ({
                isOnline: true,
            }));
            if (!status.isOnline) {
                this.elJobRetryMatchBtn.disabled = true;
                this.elJobRetryMatchBtn.title = "Unavailable offline";
            }
            else {
                this.elJobRetryMatchBtn.disabled = false;
                this.elJobRetryMatchBtn.title = "";
            }
            this.showDetailState("ready");
        }
        catch (err) {
            console.error("[Dashboard] Error loading job details:", err);
            this.showDetailState("error");
        }
    }
    renderJobDetails(job) {
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
        }
        else {
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
            }
            else if (score >= 50) {
                scoreClass = "medium";
            }
            this.elJobScore.className = `match-score-badge ${scoreClass}`;
            this.elJobExplanation.textContent =
                job.matchResult.explanation || "No match explanation available.";
            this.elJobScore.classList.remove("hidden");
            this.elJobExplanation.classList.remove("hidden");
            // Metrics UI updates
            this.updateMetricUI(this.elMetricSkills, `${Math.round(job.matchResult.skillCoverage * 100)}%`);
            this.updateMetricUI(this.elMetricExperience, job.matchResult.experienceCompatibility);
            this.updateMetricUI(this.elMetricBudget, job.matchResult.budgetCompatibility);
            this.updateMetricUI(this.elMetricLocation, job.matchResult.locationCompatibility);
        }
        else {
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
                    const matched = (job.matchResult.matchedSkills || []).map((s) => s.toLowerCase());
                    const missing = (job.matchResult.missingSkills || []).map((s) => s.toLowerCase());
                    const skLower = skill.toLowerCase();
                    if (matched.includes(skLower)) {
                        tag.classList.add("matched");
                    }
                    else if (missing.includes(skLower)) {
                        tag.classList.add("missing");
                    }
                }
                this.elJobSkillsContainer.appendChild(tag);
            });
        }
        else {
            const noneText = document.createElement("span");
            noneText.className = "text-secondary";
            noneText.textContent = "No required skills identified.";
            this.elJobSkillsContainer.appendChild(noneText);
        }
    }
    updateMetricUI(element, value) {
        const val = value ?? "Not provided";
        element.textContent = val;
        element.className = "match-metric-value";
        const valLower = val.toLowerCase();
        if (valLower.includes("compatible") || valLower.includes("100%") || parseInt(valLower) >= 80) {
            element.classList.add("compatible");
        }
        else if (valLower.includes("partial") || parseInt(valLower) >= 50) {
            element.classList.add("partial");
        }
        else if (valLower.includes("incompatible") || parseInt(valLower) < 50) {
            element.classList.add("incompatible");
        }
    }
    async retryMatch() {
        if (!this.selectedJobId) {
            return;
        }
        const status = await this.client
            .request("GET_OFFLINE_STATUS", {})
            .catch(() => ({
            isOnline: true,
        }));
        if (!status.isOnline) {
            alert("Match re-evaluation is not available in offline mode.");
            return;
        }
        this.showDetailState("loading");
        try {
            const updatedJob = await this.client.request("RETRY_MATCH", {
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
        }
        catch (err) {
            console.error("[Dashboard] Error retrying match:", err);
            this.showDetailState("error");
        }
    }
    // Secure URL verification to prevent javascript: or redirect schemes
    verifySafeUrl(url) {
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
            const domainMatch = validDomains.some((domain) => parsed.hostname === domain || parsed.hostname.endsWith("." + domain));
            return domainMatch ? parsed.href : null;
        }
        catch {
            return null;
        }
    }
    sanitizeText(raw) {
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
