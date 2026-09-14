import { fetchJson } from "./api.js";
export const authService = {
    async getSession(signal) {
        return fetchJson("/api/session", signal ? { signal } : undefined);
    },
    async signup(payload) {
        return fetchJson("/api/signup", {
            method: "POST",
            body: JSON.stringify(payload),
        });
    },
    async login(payload) {
        return fetchJson("/api/login", {
            method: "POST",
            body: JSON.stringify(payload),
        });
    },
    async logout(options = {}) {
        return fetchJson("/api/logout", {
            method: "POST",
            body: JSON.stringify({ global: options.global ?? false }),
        });
    },
    async verifyEmail(token) {
        return fetchJson("/api/auth/verify-email", {
            method: "POST",
            body: JSON.stringify({ token }),
        });
    },
};
