import { fetchJson } from "./api.js";
export const clientsService = {
    async getClients(params) {
        const searchParams = new URLSearchParams({
            page: String(params.page || 1),
            pageSize: String(params.pageSize || 20),
        });
        if (params.status) {
            searchParams.set("status", params.status);
        }
        return fetchJson(`/api/clients?${searchParams.toString()}`, params.signal ? { signal: params.signal } : undefined);
    },
    async getClient(id, signal) {
        return fetchJson(`/api/clients/${encodeURIComponent(id)}`, signal ? { signal } : undefined);
    },
    async getClientTimeline(id, params = {}) {
        const searchParams = new URLSearchParams({
            page: String(params.page || 1),
            pageSize: String(params.pageSize || 20),
        });
        return fetchJson(`/api/clients/${encodeURIComponent(id)}/timeline?${searchParams.toString()}`, params.signal ? { signal: params.signal } : undefined);
    },
};
