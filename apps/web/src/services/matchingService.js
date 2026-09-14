import { fetchJson } from "./api.js";
export const matchingService = {
    async getMatches(params) {
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
        return fetchJson(`/api/matches?${searchParams.toString()}`, params.signal ? { signal: params.signal } : undefined);
    },
    async getMatch(id, signal) {
        return fetchJson(`/api/matches/${encodeURIComponent(id)}`, signal ? { signal } : undefined);
    },
    async archiveMatch(id) {
        return fetchJson(`/api/matches/${encodeURIComponent(id)}`, {
            method: "PATCH",
            body: JSON.stringify({ status: "ARCHIVED" }),
        });
    },
};
