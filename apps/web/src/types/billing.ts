export interface PriceInfo {
  planId: string;
  region: string;
  currency: string;
  interval: string;
  version: number;
  amountMinor: number;
  formatted?: string;
  stripePriceId?: string;
}

export interface PlanFeature {
  featureId: string;
  displayName: string;
  description?: string;
}

export interface PlanItem {
  planId: "STARTER" | "PRO" | "POWER_BIDDER" | string;
  name: string;
  description: string;
  prices: PriceInfo[];
  features?: PlanFeature[];
}

export interface PlansResponse {
  success: boolean;
  plans: PlanItem[];
  error?: string;
}

export interface UsageLimit {
  type: "LIMITED" | "UNLIMITED";
  value?: number;
}

export interface SubscriptionResponse {
  success: boolean;
  planId: string;
  planName?: string;
  status: "active" | "trialing" | "past_due" | "canceled" | "free" | string;
  source?: "SUBSCRIPTION" | "TRIAL" | "STARTER" | string;
  hasCustomer?: boolean;
  trialDaysRemaining?: number | null;
  period?: {
    startedAt?: string;
    endsAt?: string;
  };
  limits?: {
    aiProposals?: UsageLimit;
    jobScans?: UsageLimit;
    maxWorkspaces?: UsageLimit;
  };
  usage?: {
    aiProposals?: number;
    jobScans?: number;
    workspaces?: number;
  };
  error?: string;
}

export interface CheckoutResponse {
  success: boolean;
  checkoutUrl?: string;
  error?: string;
}

export interface PortalResponse {
  success: boolean;
  portalUrl?: string;
  error?: string;
}
