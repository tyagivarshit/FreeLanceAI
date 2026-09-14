import { fetchJson } from "./api.js";
export const searchService = {
    async search(params) {
        const searchParams = new URLSearchParams({
            q: params.q,
            page: String(params.page || 1),
            pageSize: String(params.pageSize || 20),
        });
        if (params.resultTypes) {
            searchParams.set("resultTypes", params.resultTypes);
        }
        return fetchJson(`/api/search?${searchParams.toString()}`, params.signal ? { signal: params.signal } : undefined);
    },
};
