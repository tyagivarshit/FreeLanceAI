import { fetchJson } from "./api.js";
export const settingsService = {
    async getProfile(signal) {
        return fetchJson("/api/settings/profile", signal ? { signal } : undefined);
    },
    async getSessions(signal) {
        return fetchJson("/api/settings/security/sessions", signal ? { signal } : undefined);
    },
    async changePassword(payload) {
        return fetchJson("/api/settings/security/password", {
            method: "POST",
            body: JSON.stringify(payload),
        });
    },
    async revokeSession(sessionId) {
        return fetchJson(`/api/settings/security/sessions/${encodeURIComponent(sessionId)}`, {
            method: "DELETE",
        });
    },
    async revokeAllOtherSessions() {
        return fetchJson("/api/settings/security/sessions", {
            method: "DELETE",
        });
    },
    async getExtensionSettings(signal) {
        return fetchJson("/api/settings/extension", signal ? { signal } : undefined);
    },
    async getDataExport() {
        return fetchJson("/api/settings/data/export");
    },
};
