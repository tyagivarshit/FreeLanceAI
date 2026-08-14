import {
  Plan,
  PlanCatalog,
  PlanFeature,
  PlanId,
  UsageLimitValue,
  UsageLimits,
  UsagePeriod,
  calculateCalendarMonthPeriod,
  calculateTrialPeriod,
} from "./plan.js";
import { TrialGrantPersistenceContract } from "./trial.js";
import { StripeCustomerMappingRepository, StripeSubscriptionInfo } from "./stripe.js";
import { StripeSubscriptionRepository } from "./webhook.js";
import { CacheStore } from "./job-match-cache.js";
import { logger } from "@freelanceos/logger";

export interface EntitlementDecision {
  allowed: boolean;
  feature: PlanFeature;
  plan: PlanId;
  source: "TRIAL" | "SUBSCRIPTION" | "STARTER" | "NONE";
  limit: UsageLimitValue;
  remaining: number;
  period: UsagePeriod;
  reason:
    | "ALLOWED"
    | "FEATURE_NOT_INCLUDED"
    | "USAGE_LIMIT_REACHED"
    | "TRIAL_EXPIRED"
    | "SUBSCRIPTION_INACTIVE"
    | "TENANT_NOT_FOUND"
    | "BILLING_STATE_UNAVAILABLE"
    | "UNSUPPORTED_FEATURE";
}

export interface UsageRepository {
  consume(
    key: string,
    limit: number,
    amount: number,
  ): Promise<{ success: boolean; current: number }>;
  getUsage(key: string): Promise<number>;
  reset(): Promise<void>;
}

export class InMemoryUsageRepository implements UsageRepository {
  private readonly _usage = new Map<string, number>();

  public async consume(
    key: string,
    limit: number,
    amount: number,
  ): Promise<{ success: boolean; current: number }> {
    const current = this._usage.get(key) ?? 0;
    if (current + amount <= limit) {
      const next = current + amount;
      this._usage.set(key, next);
      return { success: true, current: next };
    }
    return { success: false, current };
  }

  public async getUsage(key: string): Promise<number> {
    return this._usage.get(key) ?? 0;
  }

  public async reset(): Promise<void> {
    this._usage.clear();
  }
}

export function getLimitKeyForFeature(feature: PlanFeature): keyof UsageLimits | null {
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

export function getSubscriptionPeriod(currentPeriodEnd: Date): UsagePeriod {
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
  private readonly _planCatalog: PlanCatalog;
  private readonly _trialPersistence: TrialGrantPersistenceContract;
  private readonly _customerMappingRepo: StripeCustomerMappingRepository;
  private readonly _subscriptionRepo: StripeSubscriptionRepository;
  private readonly _usageRepo: UsageRepository;
  private readonly _cacheStore?: CacheStore | undefined;

  constructor(params: {
    planCatalog: PlanCatalog;
    trialPersistence: TrialGrantPersistenceContract;
    customerMappingRepo: StripeCustomerMappingRepository;
    subscriptionRepo: StripeSubscriptionRepository;
    usageRepo: UsageRepository;
    cacheStore?: CacheStore | undefined;
  }) {
    this._planCatalog = params.planCatalog;
    this._trialPersistence = params.trialPersistence;
    this._customerMappingRepo = params.customerMappingRepo;
    this._subscriptionRepo = params.subscriptionRepo;
    this._usageRepo = params.usageRepo;
    this._cacheStore = params.cacheStore;
  }

  private async findSubscriptionForTenant(
    tenantId: string,
  ): Promise<StripeSubscriptionInfo | null> {
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

  public async resolveEffectivePlan(
    tenantId: string,
    userId: string,
    currentTime: Date = new Date(),
  ): Promise<{
    plan: Plan;
    source: "TRIAL" | "SUBSCRIPTION" | "STARTER";
    period: UsagePeriod;
    subscriptionId?: string;
  }> {
    const cacheKey = `entitlement:${tenantId}`;
    if (this._cacheStore) {
      try {
        const cached = await this._cacheStore.get(cacheKey);
        if (cached) {
          const parsed = JSON.parse(cached);
          const startedAt = new Date(parsed.period.startedAt);
          const endsAt = new Date(parsed.period.endsAt);

          if (
            currentTime.getTime() >= startedAt.getTime() &&
            currentTime.getTime() < endsAt.getTime()
          ) {
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
      } catch {
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
      } catch {
        // Cache write failure falls back safely
      }
    }

    return result;
  }

  private async resolveEffectivePlanFromDb(
    tenantId: string,
    userId: string,
    currentTime: Date,
  ): Promise<{
    plan: Plan;
    source: "TRIAL" | "SUBSCRIPTION" | "STARTER";
    period: UsagePeriod;
    subscriptionId?: string;
  }> {
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
    const activeTrial = trialGrants.find(
      (g) => g.status === "ACTIVE" && g.getStatusAt(currentTime) === "ACTIVE",
    );

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

  public async invalidateCache(tenantId: string): Promise<void> {
    if (this._cacheStore) {
      try {
        await this._cacheStore.delete(`entitlement:${tenantId}`);
        logger.info({
          message: "entitlement_cache_invalidated",
          tenantId,
        });
      } catch {
        // Cache delete failure falls back safely
      }
    }
  }

  public async resolveEntitlement(
    tenantId: string,
    userId: string,
    feature: PlanFeature,
    currentTime: Date = new Date(),
  ): Promise<EntitlementDecision> {
    try {
      const { plan, source, period } = await this.resolveEffectivePlan(
        tenantId,
        userId,
        currentTime,
      );

      if (!plan.hasFeature(feature)) {
        const decision: EntitlementDecision = {
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
        const decision: EntitlementDecision = {
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
        const decision: EntitlementDecision = {
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
        const decision: EntitlementDecision = {
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

      const decision: EntitlementDecision = {
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
    } catch (err) {
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

  public async consumeUsage(
    tenantId: string,
    userId: string,
    feature: PlanFeature,
    amount: number = 1,
    currentTime: Date = new Date(),
  ): Promise<{ success: boolean; decision: EntitlementDecision }> {
    try {
      const { plan, source, period } = await this.resolveEffectivePlan(
        tenantId,
        userId,
        currentTime,
      );

      if (!plan.hasFeature(feature)) {
        const decision: EntitlementDecision = {
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
        const decision: EntitlementDecision = {
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
        const decision: EntitlementDecision = {
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
        const decision: EntitlementDecision = {
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
      const decision: EntitlementDecision = {
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
    } catch (err) {
      logger.error({
        message: "Failed to consume usage due to error",
        error: err instanceof Error ? err : new Error(String(err)),
      });
      const fallbackPeriod = calculateCalendarMonthPeriod(currentTime);
      const decision: EntitlementDecision = {
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
  private readonly _resolver: EntitlementResolver;

  constructor(resolver: EntitlementResolver) {
    this._resolver = resolver;
  }

  public async enforce(
    tenantId: string,
    userId: string,
    feature: PlanFeature,
  ): Promise<EntitlementDecision> {
    const decision = await this._resolver.resolveEntitlement(tenantId, userId, feature);
    if (!decision.allowed) {
      throw new Error(`Entitlement Denied: ${decision.reason}`);
    }
    return decision;
  }

  public async enforceAndConsume(
    tenantId: string,
    userId: string,
    feature: PlanFeature,
    amount: number = 1,
  ): Promise<EntitlementDecision> {
    const result = await this._resolver.consumeUsage(tenantId, userId, feature, amount);
    if (!result.success) {
      throw new Error(`Entitlement Denied: ${result.decision.reason}`);
    }
    return result.decision;
  }
}
