import { fetchJson } from "./api.js";
import type { SearchResponse } from "../types/search.js";

export const searchService = {
  async search(params: {
    q: string;
    resultTypes?: string;
    page?: number;
    pageSize?: number;
    signal?: AbortSignal;
  }): Promise<SearchResponse> {
    const searchParams = new URLSearchParams({
      q: params.q,
      page: String(params.page || 1),
      pageSize: String(params.pageSize || 20),
    });
    if (params.resultTypes) {
      searchParams.set("resultTypes", params.resultTypes);
    }
    return fetchJson<SearchResponse>(
      `/api/search?${searchParams.toString()}`,
      params.signal ? { signal: params.signal } : undefined,
    );
  },
};
