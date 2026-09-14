import { fetchJson } from "./api.js";
export const dashboardService = {
    async getScannedKpi(signal) {
        return fetchJson("/api/analytics/scanned", signal ? { signal } : undefined);
    },
    async getMatchesKpi(signal) {
        return fetchJson("/api/analytics/matches", signal ? { signal } : undefined);
    },
    async getProposalsKpi(signal) {
        return fetchJson("/api/analytics/proposals", signal ? { signal } : undefined);
    },
    async getPulse(signal) {
        return fetchJson("/api/analytics/pulse", signal ? { signal } : undefined);
    },
    async getJobs(signal) {
        return fetchJson("/api/jobs", signal ? { signal } : undefined);
    },
    async runJobMatch(jobId) {
        return fetchJson(`/api/jobs/${encodeURIComponent(jobId)}/match`, {
            method: "POST",
        });
    },
    async getEntitlements(signal) {
        return fetchJson("/api/entitlements", signal ? { signal } : undefined);
    },
    async getActivity(signal) {
        return fetchJson("/api/activity", signal ? { signal } : undefined);
    },
};
