import Stripe from "stripe";
import { PricingRegionResolver, } from "./plan.js";
// Safe Application Errors
export class StripeBillingError extends Error {
    code;
    constructor(code, message) {
        super(message);
        this.code = code;
        this.name = "StripeBillingError";
    }
}
export class InMemoryStripeCustomerMappingRepository {
    _mappings = new Map();
    async save(mapping) {
        this._mappings.set(mapping.tenantId, mapping);
        this._mappings.set(`stripe_${mapping.stripeCustomerId}`, mapping);
    }
    async findByTenantId(tenantId) {
        return this._mappings.get(tenantId) ?? null;
    }
    async findByStripeCustomerId(stripeCustomerId) {
        return this._mappings.get(`stripe_${stripeCustomerId}`) ?? null;
    }
}
export class StripePriceRegistry {
    _mappings;
    constructor(mappings) {
        this._mappings = mappings;
    }
    getStripePriceId(planId, region, currency, interval, version) {
        const match = this._mappings.find((m) => m.planId === planId &&
            m.region === region &&
            m.currency.toUpperCase() === currency.toUpperCase() &&
            m.interval === interval &&
            m.version === version);
        if (!match) {
            throw new StripeBillingError("PRICE_MAPPING_INVALID", `Stripe price mapping not found for plan ${planId}, region ${region}, currency ${currency}, version ${version}`);
        }
        return match.stripePriceId;
    }
    getPriceVersionFromStripePriceId(stripePriceId) {
        const match = this._mappings.find((m) => m.stripePriceId === stripePriceId);
        if (!match) {
            throw new StripeBillingError("PRICE_MAPPING_INVALID", `No price version mapping found for Stripe Price ID ${stripePriceId}`);
        }
        return match;
    }
}
// Bounded timeout helper
async function withTimeout(promise, timeoutMs) {
    let timeoutId;
    const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => {
            reject(new StripeBillingError("STRIPE_TIMEOUT", "Stripe API request timed out."));
        }, timeoutMs);
    });
    return Promise.race([promise, timeoutPromise]).finally(() => {
        clearTimeout(timeoutId);
    });
}
// Retry policy helper
async function retrySafe(fn, maxRetries = 2) {
    let attempt = 0;
    while (true) {
        try {
            return await fn();
        }
        catch (err) {
            attempt++;
            if (attempt > maxRetries) {
                throw err;
            }
            await new Promise((res) => setTimeout(res, 100 * attempt));
        }
    }
}
// Translate Stripe Errors
export function translateStripeError(err) {
    if (err instanceof StripeBillingError) {
        return err;
    }
    const e = err;
    const message = e?.message || "An unknown billing provider error occurred.";
    if (e?.code === "ETIMEOUT" || e?.message?.includes("timeout") || e?.name === "TimeoutError") {
        return new StripeBillingError("STRIPE_TIMEOUT", "Billing service request timed out.");
    }
    if (e?.type === "StripeConnectionError" || e?.type === "StripeAPIError") {
        return new StripeBillingError("STRIPE_UNAVAILABLE", "Billing service is temporarily unavailable.");
    }
    if (e?.type === "StripeCardError") {
        return new StripeBillingError("PAYMENT_FAILED", message);
    }
    if (e?.type === "StripeInvalidRequestError") {
        if (e?.param === "customer" || message.includes("No such customer")) {
            return new StripeBillingError("CUSTOMER_NOT_FOUND", "Customer not found on payment provider.");
        }
        return new StripeBillingError("CHECKOUT_CREATION_FAILED", `Invalid request: ${message}`);
    }
    return new StripeBillingError("CHECKOUT_CREATION_FAILED", "Stripe operation failed.");
}
export class StripeBillingProviderImpl {
    _env;
    _timeoutMs;
    _priceRegistry;
    _customerMappingRepo;
    _planCatalog;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    _stripeClient;
    constructor(params) {
        if (params.env === "production") {
            if (!params.secretKey || params.secretKey.trim() === "") {
                throw new StripeBillingError("INVALID_PROVIDER_CONFIGURATION", "Production Stripe secret key is missing.");
            }
            if (params.secretKey.startsWith("sk_test_")) {
                throw new StripeBillingError("INVALID_PROVIDER_CONFIGURATION", "Production Stripe must not use development/test credentials.");
            }
        }
        this._env = params.env;
        this._timeoutMs = params.timeoutMs ?? 10000;
        this._priceRegistry = params.priceRegistry;
        this._customerMappingRepo = params.customerMappingRepo;
        this._planCatalog = params.planCatalog;
        this._stripeClient =
            params.stripeClientMock ??
                new Stripe(params.secretKey || "sk_test_placeholder", {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    apiVersion: "2023-10-16",
                    timeout: this._timeoutMs,
                });
    }
    async _callStripe(fn) {
        try {
            return await withTimeout(fn(), this._timeoutMs);
        }
        catch (err) {
            throw translateStripeError(err);
        }
    }
    toJSON() {
        return {
            env: this._env,
            timeoutMs: this._timeoutMs,
            stripeClient: "[REDACTED]",
        };
    }
    async resolveOrCreateCustomer(params) {
        if (!params.tenantId || params.tenantId.trim() === "") {
            throw new StripeBillingError("OWNERSHIP_MISMATCH", "Tenant ID is required.");
        }
        if (!params.ownerId || params.ownerId.trim() === "") {
            throw new StripeBillingError("OWNERSHIP_MISMATCH", "Owner ID is required.");
        }
        // Read mapping (safe to retry)
        const existing = await retrySafe(() => this._customerMappingRepo.findByTenantId(params.tenantId));
        if (existing) {
            if (existing.ownerId !== params.ownerId) {
                throw new StripeBillingError("OWNERSHIP_MISMATCH", "Customer mapping belongs to another owner.");
            }
            return existing;
        }
        const idempotencyKey = params.idempotencyKey ?? `cust_${params.tenantId}`;
        const stripeCustomer = await retrySafe(() => this._callStripe(() => this._stripeClient.customers.create({
            email: params.email,
            metadata: {
                tenantId: params.tenantId,
                ownerId: params.ownerId,
            },
        }, { idempotencyKey })));
        const mapping = {
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
    async createCheckoutSession(params) {
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
            throw new StripeBillingError("CHECKOUT_CREATION_FAILED", `Plan ${params.planId} is not active.`);
        }
        const resolvedGeo = PricingRegionResolver.resolveRegionAndCurrency(params.countryCode);
        let priceVersion = plan.prices.find((p) => p.region === resolvedGeo.region && p.version === params.version);
        if (!priceVersion) {
            priceVersion = plan.prices.find((p) => p.region === "GLOBAL" && p.version === params.version);
        }
        if (!priceVersion) {
            throw new StripeBillingError("PRICE_MAPPING_INVALID", `Price version ${params.version} not found for region ${resolvedGeo.region}.`);
        }
        if (priceVersion.amountMinor === 0) {
            throw new StripeBillingError("CHECKOUT_CREATION_FAILED", "Starter/free plan cannot be processed via paid checkout.");
        }
        const stripePriceId = this._priceRegistry.getStripePriceId(params.planId, priceVersion.region, priceVersion.currency, priceVersion.interval, priceVersion.version);
        // Retrieve price config (safe to retry)
        const stripePrice = await retrySafe(() => this._callStripe(() => this._stripeClient.prices.retrieve(stripePriceId)));
        const expectedStripeInterval = priceVersion.interval === "MONTHLY"
            ? "month"
            : priceVersion.interval.toLowerCase();
        if (stripePrice.unit_amount !== priceVersion.amountMinor ||
            stripePrice.currency.toUpperCase() !== priceVersion.currency.toUpperCase() ||
            stripePrice.recurring?.interval !== expectedStripeInterval) {
            throw new StripeBillingError("PRICE_MAPPING_INVALID", "Stripe price configuration does not match internal plan definition.");
        }
        const customerMapping = await this.resolveOrCreateCustomer({
            tenantId: params.tenantId,
            ownerId: params.ownerId,
        });
        if (customerMapping.ownerId !== params.ownerId) {
            throw new StripeBillingError("OWNERSHIP_MISMATCH", "Stripe customer mapping owner mismatch.");
        }
        let trialPeriodDays;
        if (params.trialService && params.identitySignals) {
            const persistence = params.trialService._persistence;
            if (persistence) {
                const historicalGrants = [];
                const userGrants = await persistence.findByUserId(params.ownerId);
                historicalGrants.push(...userGrants);
                if (params.identitySignals.verifiedEmail) {
                    const emailGrants = await persistence.findBySignal("verifiedEmail", params.identitySignals.verifiedEmail);
                    historicalGrants.push(...emailGrants);
                }
                if (params.identitySignals.billingCustomerId) {
                    const billingGrants = await persistence.findBySignal("billingCustomerId", params.identitySignals.billingCustomerId);
                    historicalGrants.push(...billingGrants);
                }
                if (params.identitySignals.paymentMethodId) {
                    const paymentGrants = await persistence.findBySignal("paymentMethodId", params.identitySignals.paymentMethodId);
                    historicalGrants.push(...paymentGrants);
                }
                const uniqueHistoricalGrants = Array.from(new Map(historicalGrants.map((g) => [g.grantId, g])).values());
                // evaluate eligibility
                // In 10A, TrialService evaluates using TrialEligibility.evaluate
                const { TrialEligibility: TrialEligibilityClass } = await import("./trial.js");
                const eligibility = TrialEligibilityClass.evaluate(params.identitySignals, uniqueHistoricalGrants);
                if (eligibility.isEligible) {
                    trialPeriodDays = 7;
                }
            }
        }
        const idempotencyKey = params.idempotencyKey ?? `chk_${params.tenantId}_${params.planId}_${params.version}`;
        const session = await this._callStripe(() => this._stripeClient.checkout.sessions.create({
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
        }, { idempotencyKey }));
        return {
            sessionId: session.id,
            checkoutUrl: session.url ?? "",
        };
    }
    async createPortalSession(params) {
        if (!params.tenantId || params.tenantId.trim() === "") {
            throw new StripeBillingError("OWNERSHIP_MISMATCH", "Tenant ID is required.");
        }
        if (!params.ownerId || params.ownerId.trim() === "") {
            throw new StripeBillingError("OWNERSHIP_MISMATCH", "Owner ID is required.");
        }
        const mapping = await retrySafe(() => this._customerMappingRepo.findByTenantId(params.tenantId));
        if (!mapping) {
            throw new StripeBillingError("CUSTOMER_NOT_FOUND", "Stripe customer mapping not found for tenant.");
        }
        if (mapping.ownerId !== params.ownerId) {
            throw new StripeBillingError("OWNERSHIP_MISMATCH", "Customer mapping belongs to another owner.");
        }
        const idempotencyKey = params.idempotencyKey ?? `port_${params.tenantId}`;
        const session = await this._callStripe(() => this._stripeClient.billingPortal.sessions.create({
            customer: mapping.stripeCustomerId,
            return_url: params.returnUrl,
        }, { idempotencyKey }));
        return {
            portalUrl: session.url,
        };
    }
    async getSubscription(params) {
        if (!params.tenantId || params.tenantId.trim() === "") {
            throw new StripeBillingError("OWNERSHIP_MISMATCH", "Tenant ID is required.");
        }
        if (!params.ownerId || params.ownerId.trim() === "") {
            throw new StripeBillingError("OWNERSHIP_MISMATCH", "Owner ID is required.");
        }
        // Safe to retry read operation
        const sub = await retrySafe(() => this._callStripe(() => this._stripeClient.subscriptions.retrieve(params.stripeSubscriptionId)));
        if (!sub) {
            throw new StripeBillingError("CUSTOMER_NOT_FOUND", "Subscription not found.");
        }
        const stripeCustomerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
        const mapping = await retrySafe(() => this._customerMappingRepo.findByStripeCustomerId(stripeCustomerId));
        if (!mapping) {
            throw new StripeBillingError("OWNERSHIP_MISMATCH", "Stripe customer not mapped to any local tenant.");
        }
        if (mapping.tenantId !== params.tenantId || mapping.ownerId !== params.ownerId) {
            throw new StripeBillingError("OWNERSHIP_MISMATCH", "Subscription belongs to another tenant.");
        }
        const stripePriceId = sub.items.data[0]?.price.id;
        if (!stripePriceId) {
            throw new StripeBillingError("PRICE_MAPPING_INVALID", "Subscription has no associated price.");
        }
        const priceMapping = this._priceRegistry.getPriceVersionFromStripePriceId(stripePriceId);
        const info = {
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
