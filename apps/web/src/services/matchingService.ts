import { fetchJson } from "./api.js";
import type { MatchesResponse, MatchDetailResponse, MatchItem } from "../types/match.js";

export const matchingService = {
  async getMatches(params: {
    page?: number;
    pageSize?: number;
    status?: string;
    minScore?: string | number;
    platform?: string;
    signal?: AbortSignal;
  }): Promise<MatchesResponse> {
    const searchParams = new URLSearchParams({
      page: String(params.page || 1),
      pageSize: String(params.pageSize || 20),
    });
    if (params.status) {
      searchParams.set("status", params.status);
    }
    if (params.minScore) {
      searchParams.set("minScore", String(params.minScore));
    }
    if (params.platform) {
      searchParams.set("platform", params.platform);
    }
    return fetchJson<MatchesResponse>(
      `/api/matches?${searchParams.toString()}`,
      params.signal ? { signal: params.signal } : undefined,
    );
  },

  async getMatch(id: string, signal?: AbortSignal): Promise<MatchDetailResponse> {
    return fetchJson<MatchDetailResponse>(
      `/api/matches/${encodeURIComponent(id)}`,
      signal ? { signal } : undefined,
    );
  },

  async archiveMatch(id: string): Promise<{ success: boolean; match?: MatchItem }> {
    return fetchJson<{ success: boolean; match?: MatchItem }>(
      `/api/matches/${encodeURIComponent(id)}`,
      {
        method: "PATCH",
        body: JSON.stringify({ status: "ARCHIVED" }),
      },
    );
  },
};
