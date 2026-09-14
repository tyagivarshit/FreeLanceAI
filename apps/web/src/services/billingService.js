import { fetchJson } from "./api.js";
export const billingService = {
    async getPlans(signal) {
        return fetchJson("/api/billing/plans", signal ? { signal } : undefined);
    },
    async getSubscription(signal) {
        return fetchJson("/api/billing/subscription", signal ? { signal } : undefined);
    },
    async createCheckout(payload) {
        return fetchJson("/api/billing/checkout", {
            method: "POST",
            body: JSON.stringify({
                planId: payload.planId,
                version: payload.version ?? 1,
            }),
        });
    },
    async createPortal() {
        return fetchJson("/api/billing/portal", {
            method: "POST",
        });
    },
};
