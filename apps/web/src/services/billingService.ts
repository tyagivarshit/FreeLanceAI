import { fetchJson } from "./api.js";
import type {
  PlansResponse,
  SubscriptionResponse,
  CheckoutResponse,
  PortalResponse,
} from "../types/billing.js";

export const billingService = {
  async getPlans(signal?: AbortSignal): Promise<PlansResponse> {
    return fetchJson<PlansResponse>("/api/billing/plans", signal ? { signal } : undefined);
  },

  async getSubscription(signal?: AbortSignal): Promise<SubscriptionResponse> {
    return fetchJson<SubscriptionResponse>(
      "/api/billing/subscription",
      signal ? { signal } : undefined,
    );
  },

  async createCheckout(payload: { planId: string; version?: number }): Promise<CheckoutResponse> {
    return fetchJson<CheckoutResponse>("/api/billing/checkout", {
      method: "POST",
      body: JSON.stringify({
        planId: payload.planId,
        version: payload.version ?? 1,
      }),
    });
  },

  async createPortal(): Promise<PortalResponse> {
    return fetchJson<PortalResponse>("/api/billing/portal", {
      method: "POST",
    });
  },
};
