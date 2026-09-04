import { fetchJson } from "./api.js";
import type { KpiMetric, OpportunityPulse, ActivityResponse } from "../types/dashboard.js";
import type { JobsResponse, JobMatchResult } from "../types/job.js";
import type { SubscriptionResponse } from "../types/billing.js";

export const dashboardService = {
  async getScannedKpi(signal?: AbortSignal): Promise<KpiMetric> {
    return fetchJson<KpiMetric>("/api/analytics/scanned", signal ? { signal } : undefined);
  },

  async getMatchesKpi(signal?: AbortSignal): Promise<KpiMetric> {
    return fetchJson<KpiMetric>("/api/analytics/matches", signal ? { signal } : undefined);
  },

  async getProposalsKpi(signal?: AbortSignal): Promise<KpiMetric> {
    return fetchJson<KpiMetric>("/api/analytics/proposals", signal ? { signal } : undefined);
  },

  async getPulse(signal?: AbortSignal): Promise<OpportunityPulse> {
    return fetchJson<OpportunityPulse>("/api/analytics/pulse", signal ? { signal } : undefined);
  },

  async getJobs(signal?: AbortSignal): Promise<JobsResponse> {
    return fetchJson<JobsResponse>("/api/jobs", signal ? { signal } : undefined);
  },

  async runJobMatch(jobId: string): Promise<JobMatchResult> {
    return fetchJson<JobMatchResult>(`/api/jobs/${encodeURIComponent(jobId)}/match`, {
      method: "POST",
    });
  },

  async getEntitlements(signal?: AbortSignal): Promise<SubscriptionResponse> {
    return fetchJson<SubscriptionResponse>("/api/entitlements", signal ? { signal } : undefined);
  },

  async getActivity(signal?: AbortSignal): Promise<ActivityResponse> {
    return fetchJson<ActivityResponse>("/api/activity", signal ? { signal } : undefined);
  },
};
