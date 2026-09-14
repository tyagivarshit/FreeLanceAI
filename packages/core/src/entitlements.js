import { calculateCalendarMonthPeriod, calculateTrialPeriod, } from "./plan.js";
import { logger } from "@freelanceos/logger";
export class InMemoryUsageRepository {
    _usage = new Map();
    async consume(key, limit, amount, _ttlSeconds) {
        const current = this._usage.get(key) ?? 0;
        if (current + amount <= limit) {
            const next = current + amount;
            this._usage.set(key, next);
            return { success: true, current: next };
        }
        return { success: false, current };
    }
    async refund(key, amount) {
        const current = this._usage.get(key) || 0;
        this._usage.set(key, Math.max(0, current - amount));
    }
    async getUsage(key) {
        return this._usage.get(key) ?? 0;
    }
    async reset() {
        this._usage.clear();
    }
}
export function getLimitKeyForFeature(feature) {
    if (feature === "JOB_SCAN") {
        return "jobScans";
    }
    if (feature === "AI_PROPOSAL") {
        return "aiProposals";
    }
    if (feature === "MULTI_WORKSPACE") {
        return "maxWorkspaces";
    }
    return null;
}
export function getSubscriptionPeriod(currentPeriodEnd) {
    const endsAt = new Date(currentPeriodEnd.getTime());
    const startedAt = new Date(endsAt.getTime());
    startedAt.setUTCMonth(startedAt.getUTCMonth() - 1);
    return {
        type: "BILLING_CYCLE",
        startedAt,
        endsAt,
    };
}
export class EntitlementResolver {
    _planCatalog;
    _trialPersistence;
    _customerMappingRepo;
    _subscriptionRepo;
    _usageRepo;
    _cacheStore;
    constructor(params) {
        this._planCatalog = params.planCatalog;
        this._trialPersistence = params.trialPersistence;
        this._customerMappingRepo = params.customerMappingRepo;
        this._subscriptionRepo = params.subscriptionRepo;
        this._usageRepo = params.usageRepo;
        this._cacheStore = params.cacheStore;
    }
    async findSubscriptionForTenant(tenantId) {
        // 1. Try directly with tenantId
        let sub = await this._subscriptionRepo.findByTenantId(tenantId);
        if (sub) {
            return sub;
        }
        // 2. Try via customer mapping lookup
        const mapping = await this._customerMappingRepo.findByTenantId(tenantId);
        if (mapping) {
            sub = await this._subscriptionRepo.findByTenantId(mapping.stripeCustomerId);
            if (sub) {
                return sub;
            }
        }
        return null;
    }
    async resolveEffectivePlan(tenantId, userId, currentTime = new Date()) {
        const cacheKey = `entitlement:${tenantId}`;
        if (this._cacheStore) {
            try {
                const cached = await this._cacheStore.get(cacheKey);
                if (cached) {
                    const parsed = JSON.parse(cached);
                    const startedAt = new Date(parsed.period.startedAt);
                    const endsAt = new Date(parsed.period.endsAt);
                    if (currentTime.getTime() >= startedAt.getTime() &&
                        currentTime.getTime() < endsAt.getTime()) {
                        const plan = this._planCatalog.getPlan(parsed.planId);
                        if (plan) {
                            logger.info({
                                message: "entitlement_cache_hit",
                                tenantId,
                            });
                            return {
                                plan,
                                source: parsed.source,
                                period: {
                                    type: parsed.period.type,
                                    startedAt,
                                    endsAt,
                                },
                                subscriptionId: parsed.subscriptionId,
                            };
                        }
                    }
                }
            }
            catch {
                // Cache read failure falls back safely
            }
        }
        logger.info({
            message: "entitlement_cache_miss",
            tenantId,
        });
        const result = await this.resolveEffectivePlanFromDb(tenantId, userId, currentTime);
        if (this._cacheStore) {
            try {
                const valueToCache = JSON.stringify({
                    planId: result.plan.planId,
                    source: result.source,
                    period: result.period,
                    subscriptionId: result.subscriptionId,
                });
                await this._cacheStore.set(cacheKey, valueToCache);
            }
            catch {
                // Cache write failure falls back safely
            }
        }
        return result;
    }
    async resolveEffectivePlanFromDb(tenantId, userId, currentTime) {
        // 1. Resolve Subscription state first
        const sub = await this.findSubscriptionForTenant(tenantId);
        if (sub && (sub.status === "active" || sub.status === "trialing")) {
            const plan = this._planCatalog.getPlan(sub.planId);
            if (!plan) {
                throw new Error(`Plan ${sub.planId} not found in catalog`);
            }
            return {
                plan,
                source: "SUBSCRIPTION",
                period: getSubscriptionPeriod(sub.currentPeriodEnd),
                subscriptionId: sub.stripeSubscriptionId,
            };
        }
        // 2. Resolve Trial state second
        const trialGrants = await this._trialPersistence.findByUserId(userId);
        const activeTrial = trialGrants.find((g) => g.status === "ACTIVE" && g.getStatusAt(currentTime) === "ACTIVE");
        if (activeTrial) {
            const plan = this._planCatalog.getPlan("PRO");
            if (!plan) {
                throw new Error("PRO plan not found in catalog");
            }
            return {
                plan,
                source: "TRIAL",
                period: calculateTrialPeriod(activeTrial.trialStartedAt, activeTrial.trialEndsAt),
            };
        }
        // 3. Fallback to Starter plan
        const plan = this._planCatalog.getPlan("STARTER");
        if (!plan) {
            throw new Error("STARTER plan not found in catalog");
        }
        return {
            plan,
            source: "STARTER",
            period: calculateCalendarMonthPeriod(currentTime),
        };
    }
    async invalidateCache(tenantId) {
        if (this._cacheStore) {
            try {
                await this._cacheStore.delete(`entitlement:${tenantId}`);
                logger.info({
                    message: "entitlement_cache_invalidated",
                    tenantId,
                });
            }
            catch {
                // Cache delete failure falls back safely
            }
        }
    }
    async resolveEntitlement(tenantId, userId, feature, currentTime = new Date()) {
        try {
            const { plan, source, period } = await this.resolveEffectivePlan(tenantId, userId, currentTime);
            if (!plan.hasFeature(feature)) {
                const decision = {
                    allowed: false,
                    feature,
                    plan: plan.planId,
                    source,
                    limit: { type: "LIMITED", value: 0 },
                    remaining: 0,
                    period,
                    reason: "FEATURE_NOT_INCLUDED",
                };
                logger.info({
                    message: "entitlement_denied",
                    tenantId,
                    userId,
                    feature,
                    plan: plan.planId,
                    reason: "FEATURE_NOT_INCLUDED",
                    allowed: false,
                });
                return decision;
            }
            const limitKey = getLimitKeyForFeature(feature);
            if (!limitKey) {
                const decision = {
                    allowed: true,
                    feature,
                    plan: plan.planId,
                    source,
                    limit: { type: "UNLIMITED" },
                    remaining: Infinity,
                    period,
                    reason: "ALLOWED",
                };
                logger.info({
                    message: "entitlement_resolved",
                    tenantId,
                    userId,
                    feature,
                    plan: plan.planId,
                    allowed: true,
                });
                return decision;
            }
            const limit = plan.getLimit(limitKey);
            if (limit.type === "UNLIMITED") {
                const decision = {
                    allowed: true,
                    feature,
                    plan: plan.planId,
                    source,
                    limit,
                    remaining: Infinity,
                    period,
                    reason: "ALLOWED",
                };
                logger.info({
                    message: "entitlement_resolved",
                    tenantId,
                    userId,
                    feature,
                    plan: plan.planId,
                    allowed: true,
                });
                return decision;
            }
            const key = `usage:${tenantId}:${feature}:${period.startedAt.getTime()}:${period.endsAt.getTime()}`;
            const currentUsage = await this._usageRepo.getUsage(key);
            const remaining = limit.value - currentUsage;
            if (remaining <= 0) {
                const decision = {
                    allowed: false,
                    feature,
                    plan: plan.planId,
                    source,
                    limit,
                    remaining: 0,
                    period,
                    reason: "USAGE_LIMIT_REACHED",
                };
                logger.info({
                    message: "entitlement_denied",
                    tenantId,
                    userId,
                    feature,
                    plan: plan.planId,
                    reason: "USAGE_LIMIT_REACHED",
                    allowed: false,
                });
                return decision;
            }
            const decision = {
                allowed: true,
                feature,
                plan: plan.planId,
                source,
                limit,
                remaining,
                period,
                reason: "ALLOWED",
            };
            logger.info({
                message: "entitlement_resolved",
                tenantId,
                userId,
                feature,
                plan: plan.planId,
                allowed: true,
            });
            return decision;
        }
        catch (err) {
            logger.error({
                message: "Failed to resolve entitlement due to error",
                error: err instanceof Error ? err : new Error(String(err)),
            });
            const fallbackPeriod = calculateCalendarMonthPeriod(currentTime);
            return {
                allowed: false,
                feature,
                plan: "STARTER",
                source: "NONE",
                limit: { type: "LIMITED", value: 0 },
                remaining: 0,
                period: fallbackPeriod,
                reason: "BILLING_STATE_UNAVAILABLE",
            };
        }
    }
    async consumeUsage(tenantId, userId, feature, amount = 1, currentTime = new Date()) {
        try {
            const { plan, source, period } = await this.resolveEffectivePlan(tenantId, userId, currentTime);
            if (!plan.hasFeature(feature)) {
                const decision = {
                    allowed: false,
                    feature,
                    plan: plan.planId,
                    source,
                    limit: { type: "LIMITED", value: 0 },
                    remaining: 0,
                    period,
                    reason: "FEATURE_NOT_INCLUDED",
                };
                logger.info({
                    message: "entitlement_denied",
                    tenantId,
                    userId,
                    feature,
                    plan: plan.planId,
                    reason: "FEATURE_NOT_INCLUDED",
                    allowed: false,
                });
                return { success: false, decision };
            }
            const limitKey = getLimitKeyForFeature(feature);
            if (!limitKey) {
                const decision = {
                    allowed: true,
                    feature,
                    plan: plan.planId,
                    source,
                    limit: { type: "UNLIMITED" },
                    remaining: Infinity,
                    period,
                    reason: "ALLOWED",
                };
                logger.info({
                    message: "entitlement_resolved",
                    tenantId,
                    userId,
                    feature,
                    plan: plan.planId,
                    allowed: true,
                });
                return { success: true, decision };
            }
            const limit = plan.getLimit(limitKey);
            if (limit.type === "UNLIMITED") {
                const decision = {
                    allowed: true,
                    feature,
                    plan: plan.planId,
                    source,
                    limit,
                    remaining: Infinity,
                    period,
                    reason: "ALLOWED",
                };
                logger.info({
                    message: "entitlement_resolved",
                    tenantId,
                    userId,
                    feature,
                    plan: plan.planId,
                    allowed: true,
                });
                return { success: true, decision };
            }
            const key = `usage:${tenantId}:${feature}:${period.startedAt.getTime()}:${period.endsAt.getTime()}`;
            const result = await this._usageRepo.consume(key, limit.value, amount);
            if (!result.success) {
                const decision = {
                    allowed: false,
                    feature,
                    plan: plan.planId,
                    source,
                    limit,
                    remaining: 0,
                    period,
                    reason: "USAGE_LIMIT_REACHED",
                };
                logger.info({
                    message: "usage_limit_reached",
                    tenantId,
                    userId,
                    feature,
                    amount,
                });
                return { success: false, decision };
            }
            const remaining = limit.value - result.current;
            const decision = {
                allowed: true,
                feature,
                plan: plan.planId,
                source,
                limit,
                remaining,
                period,
                reason: "ALLOWED",
            };
            logger.info({
                message: "usage_consumed",
                tenantId,
                userId,
                feature,
                amount,
            });
            return { success: true, decision };
        }
        catch (err) {
            logger.error({
                message: "Failed to consume usage due to error",
                error: err instanceof Error ? err : new Error(String(err)),
            });
            const fallbackPeriod = calculateCalendarMonthPeriod(currentTime);
            const decision = {
                allowed: false,
                feature,
                plan: "STARTER",
                source: "NONE",
                limit: { type: "LIMITED", value: 0 },
                remaining: 0,
                period: fallbackPeriod,
                reason: "BILLING_STATE_UNAVAILABLE",
            };
            return { success: false, decision };
        }
    }
}
export class EntitlementEnforcer {
    _resolver;
    constructor(resolver) {
        this._resolver = resolver;
    }
    async enforce(tenantId, userId, feature) {
        const decision = await this._resolver.resolveEntitlement(tenantId, userId, feature);
        if (!decision.allowed) {
            throw new Error(`Entitlement Denied: ${decision.reason}`);
        }
        return decision;
    }
    async enforceAndConsume(tenantId, userId, feature, amount = 1) {
        const result = await this._resolver.consumeUsage(tenantId, userId, feature, amount);
        if (!result.success) {
            throw new Error(`Entitlement Denied: ${result.decision.reason}`);
        }
        return result.decision;
    }
}
