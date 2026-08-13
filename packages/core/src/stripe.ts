import Stripe from "stripe";
import {
  PlanId,
  PricingRegion,
  BillingInterval,
  PlanCatalog,
  PricingRegionResolver,
} from "./plan.js";
import {
  TrialService,
  TrialIdentitySignals,
  TrialGrant,
  TrialGrantPersistenceContract,
} from "./trial.js";

// Safe Application Errors
export class StripeBillingError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "StripeBillingError";
  }
}

// Mapped pricing structures
export interface StripePriceMapping {
  planId: PlanId;
  region: PricingRegion;
  currency: string;
  interval: BillingInterval;
  version: number;
  stripePriceId: string;
}

export interface StripeCustomerMapping {
  tenantId: string;
  ownerId: string;
  stripeCustomerId: string;
  email?: string;
  createdAt: Date;
}

export interface CheckoutSessionResult {
  sessionId: string;
  checkoutUrl: string;
}

export interface PortalSessionResult {
  portalUrl: string;
}

export interface StripeSubscriptionInfo {
  subscriptionId: string;
  stripeSubscriptionId: string;
  stripeCustomerId: string;
  stripePriceId: string;
  planId: PlanId;
  priceVersion: number;
  status:
    | "active"
    | "incomplete"
    | "incomplete_expired"
    | "past_due"
    | "canceled"
    | "unpaid"
    | "trialing";
  trialEnd?: Date;
  currentPeriodEnd: Date;
}

export interface StripeCustomerMappingRepository {
  save(mapping: StripeCustomerMapping): Promise<void>;
  findByTenantId(tenantId: string): Promise<StripeCustomerMapping | null>;
  findByStripeCustomerId(stripeCustomerId: string): Promise<StripeCustomerMapping | null>;
}

export class InMemoryStripeCustomerMappingRepository implements StripeCustomerMappingRepository {
  private readonly _mappings = new Map<string, StripeCustomerMapping>();

  public async save(mapping: StripeCustomerMapping): Promise<void> {
    this._mappings.set(mapping.tenantId, mapping);
    this._mappings.set(`stripe_${mapping.stripeCustomerId}`, mapping);
  }

  public async findByTenantId(tenantId: string): Promise<StripeCustomerMapping | null> {
    return this._mappings.get(tenantId) ?? null;
  }

  public async findByStripeCustomerId(
    stripeCustomerId: string,
  ): Promise<StripeCustomerMapping | null> {
    return this._mappings.get(`stripe_${stripeCustomerId}`) ?? null;
  }
}

export class StripePriceRegistry {
  private readonly _mappings: StripePriceMapping[];

  constructor(mappings: StripePriceMapping[]) {
    this._mappings = mappings;
  }

  public getStripePriceId(
    planId: PlanId,
    region: PricingRegion,
    currency: string,
    interval: BillingInterval,
    version: number,
  ): string {
    const match = this._mappings.find(
      (m) =>
        m.planId === planId &&
        m.region === region &&
        m.currency.toUpperCase() === currency.toUpperCase() &&
        m.interval === interval &&
        m.version === version,
    );
    if (!match) {
      throw new StripeBillingError(
        "PRICE_MAPPING_INVALID",
        `Stripe price mapping not found for plan ${planId}, region ${region}, currency ${currency}, version ${version}`,
      );
    }
    return match.stripePriceId;
  }

  public getPriceVersionFromStripePriceId(stripePriceId: string): StripePriceMapping {
    const match = this._mappings.find((m) => m.stripePriceId === stripePriceId);
    if (!match) {
      throw new StripeBillingError(
        "PRICE_MAPPING_INVALID",
        `No price version mapping found for Stripe Price ID ${stripePriceId}`,
      );
    }
    return match;
  }
}

// Bounded timeout helper
async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timeoutId: NodeJS.Timeout;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new StripeBillingError("STRIPE_TIMEOUT", "Stripe API request timed out."));
    }, timeoutMs);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => {
    clearTimeout(timeoutId);
  });
}

// Retry policy helper
async function retrySafe<T>(fn: () => Promise<T>, maxRetries = 2): Promise<T> {
  let attempt = 0;
  while (true) {
    try {
      return await fn();
    } catch (err) {
      attempt++;
      if (attempt > maxRetries) {
        throw err;
      }
      await new Promise((res) => setTimeout(res, 100 * attempt));
    }
  }
}

// Translate Stripe Errors
export function translateStripeError(err: unknown): StripeBillingError {
  if (err instanceof StripeBillingError) {
    return err;
  }
  const e = err as
    | { message?: string; code?: string; name?: string; type?: string; param?: string }
    | null
    | undefined;
  const message = e?.message || "An unknown billing provider error occurred.";
  if (e?.code === "ETIMEOUT" || e?.message?.includes("timeout") || e?.name === "TimeoutError") {
    return new StripeBillingError("STRIPE_TIMEOUT", "Billing service request timed out.");
  }
  if (e?.type === "StripeConnectionError" || e?.type === "StripeAPIError") {
    return new StripeBillingError(
      "STRIPE_UNAVAILABLE",
      "Billing service is temporarily unavailable.",
    );
  }
  if (e?.type === "StripeCardError") {
    return new StripeBillingError("PAYMENT_FAILED", message);
  }
  if (e?.type === "StripeInvalidRequestError") {
    if (e?.param === "customer" || message.includes("No such customer")) {
      return new StripeBillingError(
        "CUSTOMER_NOT_FOUND",
        "Customer not found on payment provider.",
      );
    }
    return new StripeBillingError("CHECKOUT_CREATION_FAILED", `Invalid request: ${message}`);
  }
  return new StripeBillingError("CHECKOUT_CREATION_FAILED", "Stripe operation failed.");
}

export class StripeBillingProviderImpl {
  private readonly _env: "development" | "staging" | "production";
  private readonly _timeoutMs: number;
  private readonly _priceRegistry: StripePriceRegistry;
  private readonly _customerMappingRepo: StripeCustomerMappingRepository;
  private readonly _planCatalog: PlanCatalog;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private readonly _stripeClient: any;

  constructor(params: {
    secretKey?: string;
    publishableKey?: string;
    apiVersion?: string;
    timeoutMs?: number;
    env: "development" | "staging" | "production";
    priceRegistry: StripePriceRegistry;
    customerMappingRepo: StripeCustomerMappingRepository;
    planCatalog: PlanCatalog;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    stripeClientMock?: any;
  }) {
    if (params.env === "production") {
      if (!params.secretKey || params.secretKey.trim() === "") {
        throw new StripeBillingError(
          "INVALID_PROVIDER_CONFIGURATION",
          "Production Stripe secret key is missing.",
        );
      }
      if (params.secretKey.startsWith("sk_test_")) {
        throw new StripeBillingError(
          "INVALID_PROVIDER_CONFIGURATION",
          "Production Stripe must not use development/test credentials.",
        );
      }
    } else {
      if (!params.secretKey || params.secretKey.trim() === "") {
        throw new StripeBillingError(
          "INVALID_PROVIDER_CONFIGURATION",
          "Stripe secret key is missing.",
        );
      }
    }

    this._env = params.env;
    this._timeoutMs = params.timeoutMs ?? 10000;
    this._priceRegistry = params.priceRegistry;
    this._customerMappingRepo = params.customerMappingRepo;
    this._planCatalog = params.planCatalog;
    this._stripeClient =
      params.stripeClientMock ??
      new Stripe(params.secretKey, {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        apiVersion: "2023-10-16" as any,
        timeout: this._timeoutMs,
      });
  }

  private async _callStripe<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await withTimeout(fn(), this._timeoutMs);
    } catch (err) {
      throw translateStripeError(err);
    }
  }

  public toJSON() {
    return {
      env: this._env,
      timeoutMs: this._timeoutMs,
      stripeClient: "[REDACTED]",
    };
  }

  public async resolveOrCreateCustomer(params: {
    tenantId: string;
    ownerId: string;
    email?: string;
    idempotencyKey?: string;
  }): Promise<StripeCustomerMapping> {
    if (!params.tenantId || params.tenantId.trim() === "") {
      throw new StripeBillingError("OWNERSHIP_MISMATCH", "Tenant ID is required.");
    }
    if (!params.ownerId || params.ownerId.trim() === "") {
      throw new StripeBillingError("OWNERSHIP_MISMATCH", "Owner ID is required.");
    }

    // Read mapping (safe to retry)
    const existing = await retrySafe(() =>
      this._customerMappingRepo.findByTenantId(params.tenantId),
    );

    if (existing) {
      if (existing.ownerId !== params.ownerId) {
        throw new StripeBillingError(
          "OWNERSHIP_MISMATCH",
          "Customer mapping belongs to another owner.",
        );
      }
      return existing;
    }

    const idempotencyKey = params.idempotencyKey ?? `cust_${params.tenantId}`;
    const stripeCustomer = await retrySafe(() =>
      this._callStripe<{ id: string }>(() =>
        this._stripeClient.customers.create(
          {
            email: params.email,
            metadata: {
              tenantId: params.tenantId,
              ownerId: params.ownerId,
            },
          },
          { idempotencyKey },
        ),
      ),
    );

    const mapping: StripeCustomerMapping = {
      tenantId: params.tenantId,
      ownerId: params.ownerId,
      stripeCustomerId: stripeCustomer.id,
      createdAt: new Date(),
    };
    if (params.email !== undefined) {
      mapping.email = params.email;
    }

    await this._customerMappingRepo.save(mapping);
    return mapping;
  }

  public async createCheckoutSession(params: {
    tenantId: string;
    ownerId: string;
    planId: PlanId;
    version: number;
    countryCode?: string;
    successUrl: string;
    cancelUrl: string;
    idempotencyKey?: string;
    trialService?: TrialService;
    identitySignals?: TrialIdentitySignals;
  }): Promise<CheckoutSessionResult> {
    if (!params.tenantId || params.tenantId.trim() === "") {
      throw new StripeBillingError("OWNERSHIP_MISMATCH", "Tenant ID is required.");
    }
    if (!params.ownerId || params.ownerId.trim() === "") {
      throw new StripeBillingError("OWNERSHIP_MISMATCH", "Owner ID is required.");
    }

    const plan = this._planCatalog.getPlan(params.planId);
    if (!plan) {
      throw new StripeBillingError("CHECKOUT_CREATION_FAILED", `Plan ${params.planId} not found.`);
    }
    if (plan.lifecycleState !== "ACTIVE") {
      throw new StripeBillingError(
        "CHECKOUT_CREATION_FAILED",
        `Plan ${params.planId} is not active.`,
      );
    }

    const resolvedGeo = PricingRegionResolver.resolveRegionAndCurrency(params.countryCode);
    let priceVersion = plan.prices.find(
      (p) => p.region === resolvedGeo.region && p.version === params.version,
    );
    if (!priceVersion) {
      priceVersion = plan.prices.find((p) => p.region === "GLOBAL" && p.version === params.version);
    }
    if (!priceVersion) {
      throw new StripeBillingError(
        "PRICE_MAPPING_INVALID",
        `Price version ${params.version} not found for region ${resolvedGeo.region}.`,
      );
    }

    if (priceVersion.amountMinor === 0) {
      throw new StripeBillingError(
        "CHECKOUT_CREATION_FAILED",
        "Starter/free plan cannot be processed via paid checkout.",
      );
    }

    const stripePriceId = this._priceRegistry.getStripePriceId(
      params.planId,
      priceVersion.region,
      priceVersion.currency,
      priceVersion.interval,
      priceVersion.version,
    );

    // Retrieve price config (safe to retry)
    const stripePrice = await retrySafe(() =>
      this._callStripe<{
        unit_amount: number;
        currency: string;
        recurring?: { interval: string };
      }>(() => this._stripeClient.prices.retrieve(stripePriceId)),
    );

    const expectedStripeInterval =
      priceVersion.interval === "MONTHLY"
        ? "month"
        : (priceVersion.interval as string).toLowerCase();
    if (
      stripePrice.unit_amount !== priceVersion.amountMinor ||
      stripePrice.currency.toUpperCase() !== priceVersion.currency.toUpperCase() ||
      stripePrice.recurring?.interval !== expectedStripeInterval
    ) {
      throw new StripeBillingError(
        "PRICE_MAPPING_INVALID",
        "Stripe price configuration does not match internal plan definition.",
      );
    }

    const customerMapping = await this.resolveOrCreateCustomer({
      tenantId: params.tenantId,
      ownerId: params.ownerId,
    });

    if (customerMapping.ownerId !== params.ownerId) {
      throw new StripeBillingError("OWNERSHIP_MISMATCH", "Stripe customer mapping owner mismatch.");
    }

    let trialPeriodDays: number | undefined;
    if (params.trialService && params.identitySignals) {
      const persistence = (
        params.trialService as unknown as { _persistence: TrialGrantPersistenceContract }
      )._persistence;
      if (persistence) {
        const historicalGrants: TrialGrant[] = [];
        const userGrants = await persistence.findByUserId(params.ownerId);
        historicalGrants.push(...userGrants);

        if (params.identitySignals.verifiedEmail) {
          const emailGrants = await persistence.findBySignal(
            "verifiedEmail",
            params.identitySignals.verifiedEmail,
          );
          historicalGrants.push(...emailGrants);
        }
        if (params.identitySignals.billingCustomerId) {
          const billingGrants = await persistence.findBySignal(
            "billingCustomerId",
            params.identitySignals.billingCustomerId,
          );
          historicalGrants.push(...billingGrants);
        }
        if (params.identitySignals.paymentMethodId) {
          const paymentGrants = await persistence.findBySignal(
            "paymentMethodId",
            params.identitySignals.paymentMethodId,
          );
          historicalGrants.push(...paymentGrants);
        }

        const uniqueHistoricalGrants = Array.from(
          new Map(historicalGrants.map((g) => [g.grantId, g])).values(),
        );

        // evaluate eligibility
        // In 10A, TrialService evaluates using TrialEligibility.evaluate
        const { TrialEligibility: TrialEligibilityClass } = await import("./trial.js");
        const eligibility = TrialEligibilityClass.evaluate(
          params.identitySignals,
          uniqueHistoricalGrants,
        );
        if (eligibility.isEligible) {
          trialPeriodDays = 7;
        }
      }
    }

    const idempotencyKey =
      params.idempotencyKey ?? `chk_${params.tenantId}_${params.planId}_${params.version}`;
    const session = await this._callStripe<{ id: string; url: string | null }>(() =>
      this._stripeClient.checkout.sessions.create(
        {
          customer: customerMapping.stripeCustomerId,
          mode: "subscription",
          payment_method_types: ["card"],
          line_items: [
            {
              price: stripePriceId,
              quantity: 1,
            },
          ],
          success_url: params.successUrl,
          cancel_url: params.cancelUrl,
          subscription_data: trialPeriodDays ? { trial_period_days: trialPeriodDays } : undefined,
          metadata: {
            tenantId: params.tenantId,
            ownerId: params.ownerId,
            planId: params.planId,
            version: String(params.version),
          },
        },
        { idempotencyKey },
      ),
    );

    return {
      sessionId: session.id,
      checkoutUrl: session.url ?? "",
    };
  }

  public async createPortalSession(params: {
    tenantId: string;
    ownerId: string;
    returnUrl: string;
    idempotencyKey?: string;
  }): Promise<PortalSessionResult> {
    if (!params.tenantId || params.tenantId.trim() === "") {
      throw new StripeBillingError("OWNERSHIP_MISMATCH", "Tenant ID is required.");
    }
    if (!params.ownerId || params.ownerId.trim() === "") {
      throw new StripeBillingError("OWNERSHIP_MISMATCH", "Owner ID is required.");
    }

    const mapping = await retrySafe(() =>
      this._customerMappingRepo.findByTenantId(params.tenantId),
    );

    if (!mapping) {
      throw new StripeBillingError(
        "CUSTOMER_NOT_FOUND",
        "Stripe customer mapping not found for tenant.",
      );
    }
    if (mapping.ownerId !== params.ownerId) {
      throw new StripeBillingError(
        "OWNERSHIP_MISMATCH",
        "Customer mapping belongs to another owner.",
      );
    }

    const idempotencyKey = params.idempotencyKey ?? `port_${params.tenantId}`;
    const session = await this._callStripe<{ url: string }>(() =>
      this._stripeClient.billingPortal.sessions.create(
        {
          customer: mapping.stripeCustomerId,
          return_url: params.returnUrl,
        },
        { idempotencyKey },
      ),
    );

    return {
      portalUrl: session.url,
    };
  }

  public async getSubscription(params: {
    tenantId: string;
    ownerId: string;
    stripeSubscriptionId: string;
  }): Promise<StripeSubscriptionInfo> {
    if (!params.tenantId || params.tenantId.trim() === "") {
      throw new StripeBillingError("OWNERSHIP_MISMATCH", "Tenant ID is required.");
    }
    if (!params.ownerId || params.ownerId.trim() === "") {
      throw new StripeBillingError("OWNERSHIP_MISMATCH", "Owner ID is required.");
    }

    // Safe to retry read operation
    const sub = await retrySafe(() =>
      this._callStripe<{
        id: string;
        customer: string | { id: string };
        status: StripeSubscriptionInfo["status"];
        trial_end: number | null;
        current_period_end: number;
        items: {
          data: Array<{
            price: { id: string };
          }>;
        };
      }>(() => this._stripeClient.subscriptions.retrieve(params.stripeSubscriptionId)),
    );

    if (!sub) {
      throw new StripeBillingError("CUSTOMER_NOT_FOUND", "Subscription not found.");
    }

    const stripeCustomerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
    const mapping = await retrySafe(() =>
      this._customerMappingRepo.findByStripeCustomerId(stripeCustomerId),
    );

    if (!mapping) {
      throw new StripeBillingError(
        "OWNERSHIP_MISMATCH",
        "Stripe customer not mapped to any local tenant.",
      );
    }
    if (mapping.tenantId !== params.tenantId || mapping.ownerId !== params.ownerId) {
      throw new StripeBillingError("OWNERSHIP_MISMATCH", "Subscription belongs to another tenant.");
    }

    const stripePriceId = sub.items.data[0]?.price.id;
    if (!stripePriceId) {
      throw new StripeBillingError(
        "PRICE_MAPPING_INVALID",
        "Subscription has no associated price.",
      );
    }

    const priceMapping = this._priceRegistry.getPriceVersionFromStripePriceId(stripePriceId);

    const info: StripeSubscriptionInfo = {
      subscriptionId: sub.id,
      stripeSubscriptionId: sub.id,
      stripeCustomerId,
      stripePriceId,
      planId: priceMapping.planId,
      priceVersion: priceMapping.version,
      status: sub.status,
      currentPeriodEnd: new Date(sub.current_period_end * 1000),
    };
    if (sub.trial_end) {
      info.trialEnd = new Date(sub.trial_end * 1000);
    }

    return info;
  }
}
