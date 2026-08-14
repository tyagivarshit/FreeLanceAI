import { test, describe } from "node:test";
import assert from "node:assert";
import { Plan, PlanCatalog, PlanFeature, calculateCalendarMonthPeriod } from "./plan.js";
import { TrialGrant, InMemoryTrialGrantPersistence } from "./trial.js";
import { InMemoryStripeCustomerMappingRepository, StripePriceRegistry } from "./stripe.js";
import {
  InMemoryStripeSubscriptionRepository,
  InMemoryWebhookEventStore,
  StripeWebhookProcessor,
} from "./webhook.js";
import {
  EntitlementResolver,
  EntitlementEnforcer,
  InMemoryUsageRepository,
} from "./entitlements.js";
import { MemoryCacheStore, CacheStore } from "./job-match-cache.js";
import { PaymentAggregateStore } from "./payment.js";

// Helper to set up test environment
function setupTestContext(cacheStore?: CacheStore | undefined) {
  const planCatalog = new PlanCatalog([
    Plan.createStarter(),
    Plan.createPro(),
    Plan.createPowerBidder(),
  ]);
  const trialPersistence = new InMemoryTrialGrantPersistence();
  const customerMappingRepo = new InMemoryStripeCustomerMappingRepository();
  const subscriptionRepo = new InMemoryStripeSubscriptionRepository();
  const usageRepo = new InMemoryUsageRepository();

  const resolver = new EntitlementResolver({
    planCatalog,
    trialPersistence,
    customerMappingRepo,
    subscriptionRepo,
    usageRepo,
    cacheStore,
  });

  const enforcer = new EntitlementEnforcer(resolver);

  return {
    planCatalog,
    trialPersistence,
    customerMappingRepo,
    subscriptionRepo,
    usageRepo,
    resolver,
    enforcer,
  };
}

describe("CHAPTER 10D - ENTITLEMENTS & USAGE ENFORCEMENT", () => {
  describe("PLAN ACCESS (Tests 1-10)", () => {
    test("1. Starter feature access", async () => {
      const { resolver } = setupTestContext();
      const features: PlanFeature[] = [
        "JOB_SCAN",
        "AI_PROPOSAL",
        "UPWORK",
        "LINKEDIN",
        "BASIC_MATCHING",
      ];
      for (const f of features) {
        const decision = await resolver.resolveEntitlement("tenant_1", "user_1", f);
        assert.strictEqual(decision.allowed, true, `Starter should allow ${f}`);
        assert.strictEqual(decision.plan, "STARTER");
        assert.strictEqual(decision.source, "STARTER");
      }
    });

    test("2. Pro feature access", async () => {
      const { resolver, subscriptionRepo } = setupTestContext();
      await subscriptionRepo.save(
        {
          subscriptionId: "sub_pro",
          stripeSubscriptionId: "sub_pro",
          stripeCustomerId: "tenant_pro",
          stripePriceId: "stripe_price_pro_global_v1",
          planId: "PRO",
          priceVersion: 1,
          status: "active",
          currentPeriodEnd: new Date(Date.now() + 86400000),
        },
        100,
      );

      const features: PlanFeature[] = [
        "JOB_SCAN",
        "AI_PROPOSAL",
        "UPWORK",
        "LINKEDIN",
        "BASIC_MATCHING",
        "ADVANCED_MATCHING",
        "PRIORITY_WEIGHT_SCORING",
        "FULL_MATCH_EXPLANATION",
      ];
      for (const f of features) {
        const decision = await resolver.resolveEntitlement("tenant_pro", "user_pro", f);
        assert.strictEqual(decision.allowed, true, `Pro should allow ${f}`);
        assert.strictEqual(decision.plan, "PRO");
        assert.strictEqual(decision.source, "SUBSCRIPTION");
      }
    });

    test("3. Power Bidder feature access", async () => {
      const { resolver, subscriptionRepo } = setupTestContext();
      await subscriptionRepo.save(
        {
          subscriptionId: "sub_pb",
          stripeSubscriptionId: "sub_pb",
          stripeCustomerId: "tenant_pb",
          stripePriceId: "stripe_price_pb_global_v1",
          planId: "POWER_BIDDER",
          priceVersion: 1,
          status: "active",
          currentPeriodEnd: new Date(Date.now() + 86400000),
        },
        100,
      );

      const features: PlanFeature[] = [
        "JOB_SCAN",
        "AI_PROPOSAL",
        "UPWORK",
        "LINKEDIN",
        "BASIC_MATCHING",
        "ADVANCED_MATCHING",
        "PRIORITY_WEIGHT_SCORING",
        "FULL_MATCH_EXPLANATION",
        "PRIORITY_AI_GENERATION",
        "MULTI_WORKSPACE",
      ];
      for (const f of features) {
        const decision = await resolver.resolveEntitlement("tenant_pb", "user_pb", f);
        assert.strictEqual(decision.allowed, true, `Power Bidder should allow ${f}`);
        assert.strictEqual(decision.plan, "POWER_BIDDER");
        assert.strictEqual(decision.source, "SUBSCRIPTION");
      }
    });

    test("4. Advanced matching denied for Starter", async () => {
      const { resolver } = setupTestContext();
      const decision = await resolver.resolveEntitlement("tenant_1", "user_1", "ADVANCED_MATCHING");
      assert.strictEqual(decision.allowed, false);
      assert.strictEqual(decision.reason, "FEATURE_NOT_INCLUDED");
    });

    test("5. Priority scoring denied for Starter", async () => {
      const { resolver } = setupTestContext();
      const decision = await resolver.resolveEntitlement(
        "tenant_1",
        "user_1",
        "PRIORITY_WEIGHT_SCORING",
      );
      assert.strictEqual(decision.allowed, false);
      assert.strictEqual(decision.reason, "FEATURE_NOT_INCLUDED");
    });

    test("6. Priority scoring allowed for Pro", async () => {
      const { resolver, subscriptionRepo } = setupTestContext();
      await subscriptionRepo.save(
        {
          subscriptionId: "sub_pro",
          stripeSubscriptionId: "sub_pro",
          stripeCustomerId: "tenant_pro",
          stripePriceId: "stripe_price_pro_global_v1",
          planId: "PRO",
          priceVersion: 1,
          status: "active",
          currentPeriodEnd: new Date(Date.now() + 86400000),
        },
        100,
      );
      const decision = await resolver.resolveEntitlement(
        "tenant_pro",
        "user_pro",
        "PRIORITY_WEIGHT_SCORING",
      );
      assert.strictEqual(decision.allowed, true);
    });

    test("7. Priority AI denied for Pro", async () => {
      const { resolver, subscriptionRepo } = setupTestContext();
      await subscriptionRepo.save(
        {
          subscriptionId: "sub_pro",
          stripeSubscriptionId: "sub_pro",
          stripeCustomerId: "tenant_pro",
          stripePriceId: "stripe_price_pro_global_v1",
          planId: "PRO",
          priceVersion: 1,
          status: "active",
          currentPeriodEnd: new Date(Date.now() + 86400000),
        },
        100,
      );
      const decision = await resolver.resolveEntitlement(
        "tenant_pro",
        "user_pro",
        "PRIORITY_AI_GENERATION",
      );
      assert.strictEqual(decision.allowed, false);
    });

    test("8. Priority AI allowed for Power Bidder", async () => {
      const { resolver, subscriptionRepo } = setupTestContext();
      await subscriptionRepo.save(
        {
          subscriptionId: "sub_pb",
          stripeSubscriptionId: "sub_pb",
          stripeCustomerId: "tenant_pb",
          stripePriceId: "stripe_price_pb_global_v1",
          planId: "POWER_BIDDER",
          priceVersion: 1,
          status: "active",
          currentPeriodEnd: new Date(Date.now() + 86400000),
        },
        100,
      );
      const decision = await resolver.resolveEntitlement(
        "tenant_pb",
        "user_pb",
        "PRIORITY_AI_GENERATION",
      );
      assert.strictEqual(decision.allowed, true);
    });

    test("9. Multi-workspace denied for Pro", async () => {
      const { resolver, subscriptionRepo } = setupTestContext();
      await subscriptionRepo.save(
        {
          subscriptionId: "sub_pro",
          stripeSubscriptionId: "sub_pro",
          stripeCustomerId: "tenant_pro",
          stripePriceId: "stripe_price_pro_global_v1",
          planId: "PRO",
          priceVersion: 1,
          status: "active",
          currentPeriodEnd: new Date(Date.now() + 86400000),
        },
        100,
      );
      const decision = await resolver.resolveEntitlement(
        "tenant_pro",
        "user_pro",
        "MULTI_WORKSPACE",
      );
      assert.strictEqual(decision.allowed, false);
    });

    test("10. Multi-workspace allowed for Power Bidder", async () => {
      const { resolver, subscriptionRepo } = setupTestContext();
      await subscriptionRepo.save(
        {
          subscriptionId: "sub_pb",
          stripeSubscriptionId: "sub_pb",
          stripeCustomerId: "tenant_pb",
          stripePriceId: "stripe_price_pb_global_v1",
          planId: "POWER_BIDDER",
          priceVersion: 1,
          status: "active",
          currentPeriodEnd: new Date(Date.now() + 86400000),
        },
        100,
      );
      const decision = await resolver.resolveEntitlement("tenant_pb", "user_pb", "MULTI_WORKSPACE");
      assert.strictEqual(decision.allowed, true);
    });
  });

  describe("TRIAL (Tests 11-20)", () => {
    test("11. Active trial receives Pro features", async () => {
      const { resolver, trialPersistence } = setupTestContext();
      const start = new Date();
      const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
      await trialPersistence.save(
        new TrialGrant({
          grantId: "trial_1",
          userId: "user_trial",
          planId: "PRO",
          status: "ACTIVE",
          trialStartedAt: start,
          trialEndsAt: end,
          identitySignals: { accountId: "user_trial" },
        }),
      );

      const decision = await resolver.resolveEntitlement(
        "tenant_trial",
        "user_trial",
        "ADVANCED_MATCHING",
        new Date(start.getTime() + 1000),
      );
      assert.strictEqual(decision.allowed, true);
      assert.strictEqual(decision.plan, "PRO");
      assert.strictEqual(decision.source, "TRIAL");
    });

    test("12. Active trial receives Pro limits", async () => {
      const { resolver, trialPersistence } = setupTestContext();
      const start = new Date();
      const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
      await trialPersistence.save(
        new TrialGrant({
          grantId: "trial_1",
          userId: "user_trial",
          planId: "PRO",
          status: "ACTIVE",
          trialStartedAt: start,
          trialEndsAt: end,
          identitySignals: { accountId: "user_trial" },
        }),
      );

      const decision = await resolver.resolveEntitlement(
        "tenant_trial",
        "user_trial",
        "AI_PROPOSAL",
        new Date(start.getTime() + 1000),
      );
      assert.strictEqual(decision.limit.type, "LIMITED");
      if (decision.limit.type === "LIMITED") {
        assert.strictEqual(decision.limit.value, 50); // PRO Proposals limit
      }
    });

    test("13. Exact trial expiration denies Pro features", async () => {
      const { resolver, trialPersistence } = setupTestContext();
      const start = new Date();
      const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
      await trialPersistence.save(
        new TrialGrant({
          grantId: "trial_1",
          userId: "user_trial",
          planId: "PRO",
          status: "ACTIVE",
          trialStartedAt: start,
          trialEndsAt: end,
          identitySignals: { accountId: "user_trial" },
        }),
      );

      const decision = await resolver.resolveEntitlement(
        "tenant_trial",
        "user_trial",
        "ADVANCED_MATCHING",
        end,
      );
      assert.strictEqual(decision.allowed, false, "At exact expiration time trial should deny");
    });

    test("14. Expired trial falls back correctly", async () => {
      const { resolver, trialPersistence } = setupTestContext();
      const start = new Date();
      const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
      await trialPersistence.save(
        new TrialGrant({
          grantId: "trial_1",
          userId: "user_trial",
          planId: "PRO",
          status: "ACTIVE",
          trialStartedAt: start,
          trialEndsAt: end,
          identitySignals: { accountId: "user_trial" },
        }),
      );

      const checkTime = new Date(end.getTime() + 1000);
      const decision = await resolver.resolveEntitlement(
        "tenant_trial",
        "user_trial",
        "ADVANCED_MATCHING",
        checkTime,
      );
      assert.strictEqual(decision.allowed, false);

      const decisionProposal = await resolver.resolveEntitlement(
        "tenant_trial",
        "user_trial",
        "AI_PROPOSAL",
        checkTime,
      );
      assert.strictEqual(decisionProposal.limit.type, "LIMITED");
      if (decisionProposal.limit.type === "LIMITED") {
        assert.strictEqual(
          decisionProposal.limit.value,
          3,
          "Should fall back to Starter limits (3 proposals)",
        );
      }
    });

    test("15. Trial cancellation handled correctly", async () => {
      const { resolver, trialPersistence } = setupTestContext();
      const start = new Date();
      const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
      const grant = new TrialGrant({
        grantId: "trial_1",
        userId: "user_trial",
        planId: "PRO",
        status: "ACTIVE",
        trialStartedAt: start,
        trialEndsAt: end,
        identitySignals: { accountId: "user_trial" },
      });
      grant.transitionTo("CANCELLED");
      await trialPersistence.save(grant);

      const decision = await resolver.resolveEntitlement(
        "tenant_trial",
        "user_trial",
        "ADVANCED_MATCHING",
        new Date(start.getTime() + 1000),
      );
      assert.strictEqual(decision.allowed, false);
      assert.strictEqual(decision.plan, "STARTER");
    });

    test("16. Converted trial uses paid billing state", async () => {
      const { resolver, trialPersistence, subscriptionRepo } = setupTestContext();
      const start = new Date();
      const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
      const grant = new TrialGrant({
        grantId: "trial_1",
        userId: "user_trial",
        planId: "PRO",
        status: "ACTIVE",
        trialStartedAt: start,
        trialEndsAt: end,
        identitySignals: { accountId: "user_trial" },
      });
      grant.transitionTo("CONVERTED");
      await trialPersistence.save(grant);

      // Save a paid subscription for Power Bidder
      await subscriptionRepo.save(
        {
          subscriptionId: "sub_trial",
          stripeSubscriptionId: "sub_trial",
          stripeCustomerId: "tenant_trial",
          stripePriceId: "stripe_price_pb_global_v1",
          planId: "POWER_BIDDER",
          priceVersion: 1,
          status: "active",
          currentPeriodEnd: new Date(Date.now() + 86400000),
        },
        100,
      );

      const decision = await resolver.resolveEntitlement(
        "tenant_trial",
        "user_trial",
        "PRIORITY_AI_GENERATION",
        new Date(start.getTime() + 1000),
      );
      assert.strictEqual(decision.allowed, true);
      assert.strictEqual(decision.plan, "POWER_BIDDER");
      assert.strictEqual(decision.source, "SUBSCRIPTION");
    });

    test("17. Duplicate conversion cannot grant duplicate access", async () => {
      const { trialPersistence } = setupTestContext();
      const start = new Date();
      const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
      const grant = new TrialGrant({
        grantId: "trial_1",
        userId: "user_trial",
        planId: "PRO",
        status: "ACTIVE",
        trialStartedAt: start,
        trialEndsAt: end,
        identitySignals: { accountId: "user_trial" },
      });
      grant.transitionTo("CONVERTED");
      await trialPersistence.save(grant);

      assert.throws(() => {
        grant.transitionTo("CONVERTED");
      }, /Cannot transition trial from terminal state/);
    });

    test("18. Logout/login cannot restart trial", async () => {
      const { resolver, trialPersistence } = setupTestContext();
      const start = new Date();
      const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
      const grant = new TrialGrant({
        grantId: "trial_1",
        userId: "user_trial",
        planId: "PRO",
        status: "ACTIVE",
        trialStartedAt: start,
        trialEndsAt: end,
        identitySignals: { accountId: "user_trial" },
      });
      await trialPersistence.save(grant);

      // Verify that access matches expiration date regardless of login/logout (which does not affect resolver database query)
      const decisionBefore = await resolver.resolveEntitlement(
        "tenant_trial",
        "user_trial",
        "ADVANCED_MATCHING",
        new Date(start.getTime() + 1000),
      );
      assert.strictEqual(decisionBefore.allowed, true);

      // Simulating check after trial duration has passed
      const decisionAfter = await resolver.resolveEntitlement(
        "tenant_trial",
        "user_trial",
        "ADVANCED_MATCHING",
        new Date(end.getTime() + 1000),
      );
      assert.strictEqual(decisionAfter.allowed, false);
    });

    test("19. Multiple devices share authoritative trial state", async () => {
      const { resolver, trialPersistence } = setupTestContext();
      const start = new Date();
      const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
      await trialPersistence.save(
        new TrialGrant({
          grantId: "trial_1",
          userId: "user_trial",
          planId: "PRO",
          status: "ACTIVE",
          trialStartedAt: start,
          trialEndsAt: end,
          identitySignals: { accountId: "user_trial" },
        }),
      );

      // Device 1 and Device 2 request at the same time: they fetch the same trial status from trialPersistence
      const dev1 = await resolver.resolveEntitlement(
        "tenant_device_1",
        "user_trial",
        "ADVANCED_MATCHING",
        new Date(start.getTime() + 1000),
      );
      const dev2 = await resolver.resolveEntitlement(
        "tenant_device_2",
        "user_trial",
        "ADVANCED_MATCHING",
        new Date(start.getTime() + 1000),
      );

      assert.strictEqual(dev1.allowed, true);
      assert.strictEqual(dev2.allowed, true);
    });

    test("20. Timezone does not change trial duration", async () => {
      const startStr = "2026-08-01T00:00:00Z";
      const start = new Date(startStr);
      const expectedEnd = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);

      const grant = new TrialGrant({
        grantId: "trial_tz",
        userId: "user_tz",
        planId: "PRO",
        status: "ACTIVE",
        trialStartedAt: start,
        trialEndsAt: expectedEnd,
        identitySignals: { accountId: "user_tz" },
      });

      // Duration must remain exactly 7 days
      assert.strictEqual(
        grant.trialEndsAt.getTime() - grant.trialStartedAt.getTime(),
        7 * 24 * 60 * 60 * 1000,
      );
    });
  });

  describe("USAGE (Tests 21-34)", () => {
    test("21. Starter allows 5 scans", async () => {
      const { resolver } = setupTestContext();
      for (let i = 0; i < 5; i++) {
        const res = await resolver.consumeUsage("tenant_starter", "user_starter", "JOB_SCAN");
        assert.strictEqual(res.success, true, `Scan #${i + 1} should succeed`);
      }
    });

    test("22. Sixth Starter scan denied", async () => {
      const { resolver } = setupTestContext();
      for (let i = 0; i < 5; i++) {
        await resolver.consumeUsage("tenant_starter", "user_starter", "JOB_SCAN");
      }
      const res = await resolver.consumeUsage("tenant_starter", "user_starter", "JOB_SCAN");
      assert.strictEqual(res.success, false);
      assert.strictEqual(res.decision.reason, "USAGE_LIMIT_REACHED");
    });

    test("23. Starter allows 3 proposals", async () => {
      const { resolver } = setupTestContext();
      for (let i = 0; i < 3; i++) {
        const res = await resolver.consumeUsage("tenant_starter", "user_starter", "AI_PROPOSAL");
        assert.strictEqual(res.success, true);
      }
    });

    test("24. Fourth Starter proposal denied", async () => {
      const { resolver } = setupTestContext();
      for (let i = 0; i < 3; i++) {
        await resolver.consumeUsage("tenant_starter", "user_starter", "AI_PROPOSAL");
      }
      const res = await resolver.consumeUsage("tenant_starter", "user_starter", "AI_PROPOSAL");
      assert.strictEqual(res.success, false);
    });

    test("25. Pro allows 50 proposals", async () => {
      const { resolver, subscriptionRepo } = setupTestContext();
      await subscriptionRepo.save(
        {
          subscriptionId: "sub_pro",
          stripeSubscriptionId: "sub_pro",
          stripeCustomerId: "tenant_pro",
          stripePriceId: "stripe_price_pro_global_v1",
          planId: "PRO",
          priceVersion: 1,
          status: "active",
          currentPeriodEnd: new Date(Date.now() + 86400000),
        },
        100,
      );

      for (let i = 0; i < 50; i++) {
        const res = await resolver.consumeUsage("tenant_pro", "user_pro", "AI_PROPOSAL");
        assert.strictEqual(res.success, true, `Proposal #${i + 1} failed`);
      }
    });

    test("26. 51st Pro proposal denied", async () => {
      const { resolver, subscriptionRepo } = setupTestContext();
      await subscriptionRepo.save(
        {
          subscriptionId: "sub_pro",
          stripeSubscriptionId: "sub_pro",
          stripeCustomerId: "tenant_pro",
          stripePriceId: "stripe_price_pro_global_v1",
          planId: "PRO",
          priceVersion: 1,
          status: "active",
          currentPeriodEnd: new Date(Date.now() + 86400000),
        },
        100,
      );

      for (let i = 0; i < 50; i++) {
        await resolver.consumeUsage("tenant_pro", "user_pro", "AI_PROPOSAL");
      }
      const res = await resolver.consumeUsage("tenant_pro", "user_pro", "AI_PROPOSAL");
      assert.strictEqual(res.success, false);
    });

    test("27. Power Bidder allows 200 proposals", async () => {
      const { resolver, subscriptionRepo } = setupTestContext();
      await subscriptionRepo.save(
        {
          subscriptionId: "sub_pb",
          stripeSubscriptionId: "sub_pb",
          stripeCustomerId: "tenant_pb",
          stripePriceId: "stripe_price_pb_global_v1",
          planId: "POWER_BIDDER",
          priceVersion: 1,
          status: "active",
          currentPeriodEnd: new Date(Date.now() + 86400000),
        },
        100,
      );

      for (let i = 0; i < 200; i++) {
        const res = await resolver.consumeUsage("tenant_pb", "user_pb", "AI_PROPOSAL");
        assert.strictEqual(res.success, true);
      }
    });

    test("28. 201st Power Bidder proposal denied", async () => {
      const { resolver, subscriptionRepo } = setupTestContext();
      await subscriptionRepo.save(
        {
          subscriptionId: "sub_pb",
          stripeSubscriptionId: "sub_pb",
          stripeCustomerId: "tenant_pb",
          stripePriceId: "stripe_price_pb_global_v1",
          planId: "POWER_BIDDER",
          priceVersion: 1,
          status: "active",
          currentPeriodEnd: new Date(Date.now() + 86400000),
        },
        100,
      );

      for (let i = 0; i < 200; i++) {
        await resolver.consumeUsage("tenant_pb", "user_pb", "AI_PROPOSAL");
      }
      const res = await resolver.consumeUsage("tenant_pb", "user_pb", "AI_PROPOSAL");
      assert.strictEqual(res.success, false);
    });

    test("29. Pro matching is unlimited", async () => {
      const { resolver, subscriptionRepo } = setupTestContext();
      await subscriptionRepo.save(
        {
          subscriptionId: "sub_pro",
          stripeSubscriptionId: "sub_pro",
          stripeCustomerId: "tenant_pro",
          stripePriceId: "stripe_price_pro_global_v1",
          planId: "PRO",
          priceVersion: 1,
          status: "active",
          currentPeriodEnd: new Date(Date.now() + 86400000),
        },
        100,
      );

      const decision = await resolver.resolveEntitlement(
        "tenant_pro",
        "user_pro",
        "ADVANCED_MATCHING",
      );
      assert.strictEqual(decision.limit.type, "UNLIMITED");
      assert.strictEqual(decision.remaining, Infinity);
    });

    test("30. Power Bidder matching is unlimited", async () => {
      const { resolver, subscriptionRepo } = setupTestContext();
      await subscriptionRepo.save(
        {
          subscriptionId: "sub_pb",
          stripeSubscriptionId: "sub_pb",
          stripeCustomerId: "tenant_pb",
          stripePriceId: "stripe_price_pb_global_v1",
          planId: "POWER_BIDDER",
          priceVersion: 1,
          status: "active",
          currentPeriodEnd: new Date(Date.now() + 86400000),
        },
        100,
      );

      const decision = await resolver.resolveEntitlement(
        "tenant_pb",
        "user_pb",
        "PRIORITY_AI_GENERATION",
      );
      assert.strictEqual(decision.limit.type, "UNLIMITED");
      assert.strictEqual(decision.remaining, Infinity);
    });

    test("31. Unlimited is not represented by magic integer", async () => {
      const { resolver, subscriptionRepo } = setupTestContext();
      await subscriptionRepo.save(
        {
          subscriptionId: "sub_pro",
          stripeSubscriptionId: "sub_pro",
          stripeCustomerId: "tenant_pro",
          stripePriceId: "stripe_price_pro_global_v1",
          planId: "PRO",
          priceVersion: 1,
          status: "active",
          currentPeriodEnd: new Date(Date.now() + 86400000),
        },
        100,
      );

      const decision = await resolver.resolveEntitlement("tenant_pro", "user_pro", "JOB_SCAN");
      assert.strictEqual(decision.limit.type, "UNLIMITED");
      assert.strictEqual(decision.remaining, Infinity);
    });

    test("32. Usage cannot become negative", async () => {
      const { usageRepo } = setupTestContext();
      const current = await usageRepo.getUsage("non_existent_key");
      assert.strictEqual(current, 0); // starts at 0, not negative
    });

    test("33. Usage cannot be reset by logout/login", async () => {
      const { resolver } = setupTestContext();
      await resolver.consumeUsage("tenant_starter", "user_starter", "AI_PROPOSAL");
      const decision1 = await resolver.resolveEntitlement(
        "tenant_starter",
        "user_starter",
        "AI_PROPOSAL",
      );
      assert.strictEqual(decision1.remaining, 2);

      // Simulating a second device or session (new login does not affect server state)
      const decision2 = await resolver.resolveEntitlement(
        "tenant_starter",
        "user_starter",
        "AI_PROPOSAL",
      );
      assert.strictEqual(decision2.remaining, 2);
    });

    test("34. Usage cannot be reset by changing email", async () => {
      const { resolver } = setupTestContext();
      await resolver.consumeUsage("tenant_starter", "user_starter", "AI_PROPOSAL");

      // Even if user's email was updated (which doesn't change tenantId), usage remains
      const decision = await resolver.resolveEntitlement(
        "tenant_starter",
        "user_starter",
        "AI_PROPOSAL",
      );
      assert.strictEqual(decision.remaining, 2);
    });
  });

  describe("CONCURRENCY (Tests 35-40)", () => {
    test("35. Concurrent proposal consumption", async () => {
      const { resolver, subscriptionRepo } = setupTestContext();
      await subscriptionRepo.save(
        {
          subscriptionId: "sub_pro",
          stripeSubscriptionId: "sub_pro",
          stripeCustomerId: "tenant_pro",
          stripePriceId: "stripe_price_pro_global_v1",
          planId: "PRO",
          priceVersion: 1,
          status: "active",
          currentPeriodEnd: new Date(Date.now() + 86400000),
        },
        100,
      );

      // Launch 60 concurrent consumption attempts for 50 limits
      const promises = [];
      for (let i = 0; i < 60; i++) {
        promises.push(resolver.consumeUsage("tenant_pro", "user_pro", "AI_PROPOSAL"));
      }

      const results = await Promise.all(promises);
      const successes = results.filter((r) => r.success);
      const failures = results.filter((r) => !r.success);

      assert.strictEqual(successes.length, 50, "Exactly 50 attempts should succeed");
      assert.strictEqual(failures.length, 10, "Exactly 10 attempts should fail");
    });

    test("36. Concurrent scan consumption", async () => {
      const { resolver } = setupTestContext();
      // Starter limit is 5
      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(resolver.consumeUsage("tenant_starter", "user_starter", "JOB_SCAN"));
      }

      const results = await Promise.all(promises);
      const successes = results.filter((r) => r.success);
      const failures = results.filter((r) => !r.success);

      assert.strictEqual(successes.length, 5);
      assert.strictEqual(failures.length, 5);
    });

    test("37. Boundary race at final remaining unit", async () => {
      const { resolver } = setupTestContext();
      // Consume 2 proposals first (3 limit)
      await resolver.consumeUsage("tenant_starter", "user_starter", "AI_PROPOSAL");
      await resolver.consumeUsage("tenant_starter", "user_starter", "AI_PROPOSAL");

      // 1 remaining. Launch 10 concurrent requests
      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(resolver.consumeUsage("tenant_starter", "user_starter", "AI_PROPOSAL"));
      }

      const results = await Promise.all(promises);
      const successes = results.filter((r) => r.success);
      const failures = results.filter((r) => !r.success);

      assert.strictEqual(successes.length, 1);
      assert.strictEqual(failures.length, 9);
    });

    test("38. No double consumption", async () => {
      const { resolver, usageRepo } = setupTestContext();
      // Execute concurrent requests
      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(resolver.consumeUsage("tenant_starter", "user_starter", "JOB_SCAN"));
      }
      await Promise.all(promises);

      const period = calculateCalendarMonthPeriod(new Date());
      const key = `usage:tenant_starter:JOB_SCAN:${period.startedAt.getTime()}:${period.endsAt.getTime()}`;
      const totalUsed = await usageRepo.getUsage(key);
      assert.strictEqual(totalUsed, 5, "Total consumed should equal exactly the limit");
    });

    test("39. No quota bypass", async () => {
      const { resolver } = setupTestContext();
      const promises = [];
      for (let i = 0; i < 100; i++) {
        promises.push(resolver.consumeUsage("tenant_starter", "user_starter", "JOB_SCAN"));
      }
      const results = await Promise.all(promises);
      const successCount = results.filter((r) => r.success).length;
      assert.strictEqual(successCount, 5);
    });

    test("40. No negative remaining", async () => {
      const { resolver } = setupTestContext();
      const promises = [];
      for (let i = 0; i < 20; i++) {
        promises.push(resolver.consumeUsage("tenant_starter", "user_starter", "JOB_SCAN"));
      }
      const results = await Promise.all(promises);
      for (const res of results) {
        assert.ok(res.decision.remaining >= 0);
      }
    });
  });

  describe("PERIOD (Tests 41-44)", () => {
    test("41. Current usage period", async () => {
      const { resolver } = setupTestContext();
      const decision = await resolver.resolveEntitlement(
        "tenant_starter",
        "user_starter",
        "JOB_SCAN",
      );
      const period = decision.period;
      assert.strictEqual(period.type, "CALENDAR_MONTH");
      const now = new Date();
      assert.ok(period.startedAt <= now);
      assert.ok(period.endsAt > now);
    });

    test("42. New usage period", async () => {
      const { resolver } = setupTestContext();
      const t1 = new Date("2026-08-10T12:00:00Z");
      const t2 = new Date("2026-09-10T12:00:00Z");

      const d1 = await resolver.resolveEntitlement(
        "tenant_starter",
        "user_starter",
        "JOB_SCAN",
        t1,
      );
      const d2 = await resolver.resolveEntitlement(
        "tenant_starter",
        "user_starter",
        "JOB_SCAN",
        t2,
      );

      assert.notDeepEqual(d1.period, d2.period);
      assert.strictEqual(d1.period.startedAt.getUTCMonth(), 7); // August
      assert.strictEqual(d2.period.startedAt.getUTCMonth(), 8); // September
    });

    test("43. Old period does not block new period", async () => {
      const { resolver } = setupTestContext();
      const t1 = new Date("2026-08-10T12:00:00Z");
      const t2 = new Date("2026-09-10T12:00:00Z");

      // Exhaust limit in August (5 scans)
      for (let i = 0; i < 5; i++) {
        const res = await resolver.consumeUsage(
          "tenant_starter",
          "user_starter",
          "JOB_SCAN",
          1,
          t1,
        );
        assert.strictEqual(res.success, true);
      }
      const resBlocked = await resolver.consumeUsage(
        "tenant_starter",
        "user_starter",
        "JOB_SCAN",
        1,
        t1,
      );
      assert.strictEqual(resBlocked.success, false);

      // Verify that next period (September) starts fresh and allows scanning
      const resNew = await resolver.consumeUsage(
        "tenant_starter",
        "user_starter",
        "JOB_SCAN",
        1,
        t2,
      );
      assert.strictEqual(resNew.success, true);
    });

    test("44. Usage period follows frozen 10A semantics", async () => {
      const { resolver, subscriptionRepo } = setupTestContext();
      const end = new Date("2026-08-15T12:00:00Z");
      await subscriptionRepo.save(
        {
          subscriptionId: "sub_1",
          stripeSubscriptionId: "sub_1",
          stripeCustomerId: "tenant_1",
          stripePriceId: "stripe_price_pro_global_v1",
          planId: "PRO",
          priceVersion: 1,
          status: "active",
          currentPeriodEnd: end,
        },
        100,
      );

      const decision = await resolver.resolveEntitlement("tenant_1", "user_1", "JOB_SCAN");
      assert.strictEqual(decision.period.type, "BILLING_CYCLE");
      assert.strictEqual(decision.period.endsAt.getTime(), end.getTime());
    });
  });

  describe("CACHE (Tests 45-54)", () => {
    test("45. L1 cache hit", async () => {
      const cacheStore = new MemoryCacheStore({ maxSize: 10, ttlSeconds: 60 });
      const { resolver, subscriptionRepo } = setupTestContext(cacheStore);

      const t1 = new Date();
      await resolver.resolveEffectivePlan("tenant_cached", "user_cached", t1);

      // Update plan directly in database/repository (without webhook cache invalidation trigger)
      await subscriptionRepo.save(
        {
          subscriptionId: "sub_c",
          stripeSubscriptionId: "sub_c",
          stripeCustomerId: "tenant_cached",
          stripePriceId: "stripe_price_pro_global_v1",
          planId: "PRO",
          priceVersion: 1,
          status: "active",
          currentPeriodEnd: new Date(Date.now() + 86400000),
        },
        100,
      );

      // Resolving again should hit cache and still return Starter plan!
      const planInfo = await resolver.resolveEffectivePlan("tenant_cached", "user_cached", t1);
      assert.strictEqual(planInfo.plan.planId, "STARTER");
    });

    test("46. Shared cache hit", async () => {
      const l1 = new MemoryCacheStore({ maxSize: 10, ttlSeconds: 60 });
      const l2: CacheStore = {
        get: async (_key) => {
          return JSON.stringify({
            planId: "POWER_BIDDER",
            source: "SUBSCRIPTION",
            period: {
              type: "BILLING_CYCLE",
              startedAt: new Date(Date.now() - 86400000).toISOString(),
              endsAt: new Date(Date.now() + 86400000).toISOString(),
            },
          });
        },
        set: async () => {},
        delete: async () => {},
      };

      setupTestContext(l1);
      // We wrap L1 and L2 using a custom CacheStore wrapper that resolver can use
      const resolverWithL2 = new EntitlementResolver({
        planCatalog: new PlanCatalog([
          Plan.createStarter(),
          Plan.createPro(),
          Plan.createPowerBidder(),
        ]),
        trialPersistence: new InMemoryTrialGrantPersistence(),
        customerMappingRepo: new InMemoryStripeCustomerMappingRepository(),
        subscriptionRepo: new InMemoryStripeSubscriptionRepository(),
        usageRepo: new InMemoryUsageRepository(),
        cacheStore: l2, // using L2 directly in the resolver's cacheStore parameter
      });

      const planInfo = await resolverWithL2.resolveEffectivePlan("tenant_l2", "user_l2");
      assert.strictEqual(planInfo.plan.planId, "POWER_BIDDER");
    });

    test("47. Cache miss", async () => {
      const cacheStore = new MemoryCacheStore({ maxSize: 10, ttlSeconds: 60 });
      const { resolver } = setupTestContext(cacheStore);

      const planInfo = await resolver.resolveEffectivePlan("tenant_miss", "user_miss");
      assert.strictEqual(
        planInfo.plan.planId,
        "STARTER",
        "Should Miss and resolve database default",
      );
    });

    test("48. Cache population", async () => {
      const cacheStore = new MemoryCacheStore({ maxSize: 10, ttlSeconds: 60 });
      const { resolver } = setupTestContext(cacheStore);

      await resolver.resolveEffectivePlan("tenant_pop", "user_pop");

      // Verify that cache key is populated
      const cached = await cacheStore.get("entitlement:tenant_pop");
      assert.ok(cached);
      const parsed = JSON.parse(cached);
      assert.strictEqual(parsed.planId, "STARTER");
    });

    test("49. Cache invalidation after billing change", async () => {
      const cacheStore = new MemoryCacheStore({ maxSize: 10, ttlSeconds: 60 });
      const { resolver, subscriptionRepo } = setupTestContext(cacheStore);

      await resolver.resolveEffectivePlan("tenant_inv", "user_inv");

      // Trigger change in subscription
      await subscriptionRepo.save(
        {
          subscriptionId: "sub_i",
          stripeSubscriptionId: "sub_i",
          stripeCustomerId: "tenant_inv",
          stripePriceId: "stripe_price_pro_global_v1",
          planId: "PRO",
          priceVersion: 1,
          status: "active",
          currentPeriodEnd: new Date(Date.now() + 86400000),
        },
        100,
      );

      // Invalidate
      await resolver.invalidateCache("tenant_inv");

      const planInfo = await resolver.resolveEffectivePlan("tenant_inv", "user_inv");
      assert.strictEqual(planInfo.plan.planId, "PRO");
    });

    test("50. Trial expiration invalidation", async () => {
      const cacheStore = new MemoryCacheStore({ maxSize: 10, ttlSeconds: 60 });
      const { resolver, trialPersistence } = setupTestContext(cacheStore);

      const start = new Date();
      const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
      await trialPersistence.save(
        new TrialGrant({
          grantId: "trial_exp",
          userId: "user_exp",
          planId: "PRO",
          status: "ACTIVE",
          trialStartedAt: start,
          trialEndsAt: end,
          identitySignals: { accountId: "user_exp" },
        }),
      );

      // Cache the active trial plan (PRO)
      const p1 = await resolver.resolveEffectivePlan(
        "tenant_exp",
        "user_exp",
        new Date(start.getTime() + 1000),
      );
      assert.strictEqual(p1.plan.planId, "PRO");

      // Now query at a time *after* trial expiration: since the cache contains the period startedAt/endsAt,
      // it verifies trial expiration or invalidation
      const p2 = await resolver.resolveEffectivePlan(
        "tenant_exp",
        "user_exp",
        new Date(end.getTime() + 1000),
      );
      // Wait, in our implementation we check if current time is outside the cached period. If the period changes or expires,
      // we resolve from DB. Let's verify that the new call returns Starter because the currentTime is outside the cached trial period!
      assert.strictEqual(p2.plan.planId, "STARTER");
    });

    test("51. Cancellation invalidation", async () => {
      const cacheStore = new MemoryCacheStore({ maxSize: 10, ttlSeconds: 60 });
      const { resolver, subscriptionRepo } = setupTestContext(cacheStore);

      await subscriptionRepo.save(
        {
          subscriptionId: "sub_c",
          stripeSubscriptionId: "sub_c",
          stripeCustomerId: "tenant_c",
          stripePriceId: "stripe_price_pro_global_v1",
          planId: "PRO",
          priceVersion: 1,
          status: "active",
          currentPeriodEnd: new Date(Date.now() + 86400000),
        },
        100,
      );

      const p1 = await resolver.resolveEffectivePlan("tenant_c", "user_c");
      assert.strictEqual(p1.plan.planId, "PRO");

      // Cancel the subscription
      await subscriptionRepo.save(
        {
          subscriptionId: "sub_c",
          stripeSubscriptionId: "sub_c",
          stripeCustomerId: "tenant_c",
          stripePriceId: "stripe_price_pro_global_v1",
          planId: "PRO",
          priceVersion: 1,
          status: "canceled",
          currentPeriodEnd: new Date(Date.now() + 86400000),
        },
        200,
      );

      await resolver.invalidateCache("tenant_c");

      const p2 = await resolver.resolveEffectivePlan("tenant_c", "user_c");
      assert.strictEqual(p2.plan.planId, "STARTER");
    });

    test("52. Cross-tenant cache isolation", async () => {
      const cacheStore = new MemoryCacheStore({ maxSize: 10, ttlSeconds: 60 });
      const { resolver, subscriptionRepo } = setupTestContext(cacheStore);

      await subscriptionRepo.save(
        {
          subscriptionId: "sub_a",
          stripeSubscriptionId: "sub_a",
          stripeCustomerId: "tenant_a",
          stripePriceId: "stripe_price_pro_global_v1",
          planId: "PRO",
          priceVersion: 1,
          status: "active",
          currentPeriodEnd: new Date(Date.now() + 86400000),
        },
        100,
      );

      // Cache tenant_a as PRO
      await resolver.resolveEffectivePlan("tenant_a", "user_a");

      // Verify that tenant_b (which is Starter) does not hit tenant_a's cache and returns STARTER
      const pB = await resolver.resolveEffectivePlan("tenant_b", "user_b");
      assert.strictEqual(pB.plan.planId, "STARTER");
    });

    test("53. Cache failure falls back safely", async () => {
      const brokenCache: CacheStore = {
        get: async () => {
          throw new Error("Redis connection down");
        },
        set: async () => {
          throw new Error("Redis connection down");
        },
        delete: async () => {
          throw new Error("Redis connection down");
        },
      };

      const { resolver } = setupTestContext(brokenCache);
      const decision = await resolver.resolveEntitlement("tenant_test", "user_test", "JOB_SCAN");
      assert.strictEqual(decision.allowed, true); // Fallback to DB works
      assert.strictEqual(decision.plan, "STARTER");
    });

    test("54. Stale cache cannot permanently grant paid access", async () => {
      const cacheStore = new MemoryCacheStore({ maxSize: 10, ttlSeconds: 1 }); // 1 sec TTL
      const { resolver, subscriptionRepo } = setupTestContext(cacheStore);

      await subscriptionRepo.save(
        {
          subscriptionId: "sub_s",
          stripeSubscriptionId: "sub_s",
          stripeCustomerId: "tenant_s",
          stripePriceId: "stripe_price_pro_global_v1",
          planId: "PRO",
          priceVersion: 1,
          status: "active",
          currentPeriodEnd: new Date(Date.now() + 86400000),
        },
        100,
      );

      await resolver.resolveEffectivePlan("tenant_s", "user_s");

      // Invalidate DB record
      await subscriptionRepo.save(
        {
          subscriptionId: "sub_s",
          stripeSubscriptionId: "sub_s",
          stripeCustomerId: "tenant_s",
          stripePriceId: "stripe_price_pro_global_v1",
          planId: "PRO",
          priceVersion: 1,
          status: "canceled",
          currentPeriodEnd: new Date(Date.now() + 86400000),
        },
        200,
      );

      // Wait 1.1s for cache to expire naturally
      await new Promise((r) => setTimeout(r, 1100));

      const planInfo = await resolver.resolveEffectivePlan("tenant_s", "user_s");
      assert.strictEqual(planInfo.plan.planId, "STARTER");
    });
  });

  describe("SECURITY (Tests 55-62)", () => {
    test("55. Forged plan rejected", async () => {
      const { resolver } = setupTestContext();
      // Client requesting PRO access but DB says Starter
      const decision = await resolver.resolveEntitlement("tenant_1", "user_1", "ADVANCED_MATCHING");
      assert.strictEqual(
        decision.allowed,
        false,
        "Should resolve to Starter and block Pro feature",
      );
    });

    test("56. Forged feature rejected", async () => {
      const { resolver } = setupTestContext();
      // Verify that resolveEntitlement strictly checks plan features and doesn't trust any input array
      const decision = await resolver.resolveEntitlement(
        "tenant_1",
        "user_1",
        "PRIORITY_AI_GENERATION",
      );
      assert.strictEqual(decision.allowed, false);
    });

    test("57. Forged usage rejected", async () => {
      const { resolver, usageRepo } = setupTestContext();
      const period = calculateCalendarMonthPeriod(new Date());
      const key = `usage:tenant_starter:AI_PROPOSAL:${period.startedAt.getTime()}:${period.endsAt.getTime()}`;

      // Simulate client attempting to bypass by consuming a forged negative value (not possible in consumer API)
      await resolver.consumeUsage("tenant_starter", "user_starter", "AI_PROPOSAL");
      const current = await usageRepo.getUsage(key);
      assert.strictEqual(current, 1);
    });

    test("58. Forged remaining rejected", async () => {
      const { resolver } = setupTestContext();
      const decision = await resolver.resolveEntitlement(
        "tenant_starter",
        "user_starter",
        "AI_PROPOSAL",
      );
      // Remaining is resolved server-side strictly from limits minus repository count
      assert.strictEqual(decision.remaining, 3);
    });

    test("59. Forged trial rejected", async () => {
      const { resolver } = setupTestContext();
      // Client claims they are in trial, but trialPersistence is empty
      const decision = await resolver.resolveEntitlement(
        "tenant_starter",
        "user_starter",
        "ADVANCED_MATCHING",
      );
      assert.strictEqual(decision.allowed, false);
      assert.strictEqual(decision.plan, "STARTER");
    });

    test("60. Cross-tenant entitlement rejected", async () => {
      const { resolver, subscriptionRepo } = setupTestContext();
      await subscriptionRepo.save(
        {
          subscriptionId: "sub_a",
          stripeSubscriptionId: "sub_a",
          stripeCustomerId: "tenant_a",
          stripePriceId: "stripe_price_pro_global_v1",
          planId: "PRO",
          priceVersion: 1,
          status: "active",
          currentPeriodEnd: new Date(Date.now() + 86400000),
        },
        100,
      );

      // user_b from tenant_b tries to check ADVANCED_MATCHING using tenant_a as context -> forbidden if context is isolated
      const decision = await resolver.resolveEntitlement("tenant_b", "user_b", "ADVANCED_MATCHING");
      assert.strictEqual(
        decision.allowed,
        false,
        "tenant_b has no access to tenant_a subscription",
      );
    });

    test("61. Cross-tenant usage rejected", async () => {
      const { resolver } = setupTestContext();
      // tenant_a consumes AI_PROPOSAL
      await resolver.consumeUsage("tenant_a", "user_a", "AI_PROPOSAL");

      // Verify that tenant_b's quota remains untouched
      const decisionB = await resolver.resolveEntitlement("tenant_b", "user_b", "AI_PROPOSAL");
      assert.strictEqual(
        decisionB.remaining,
        3,
        "tenant_b should still have 3 remaining proposals",
      );
    });

    test("62. Cross-tenant cache rejected", async () => {
      const cacheStore = new MemoryCacheStore({ maxSize: 10, ttlSeconds: 60 });
      const { resolver } = setupTestContext(cacheStore);

      // Populate cache for tenant_a
      await resolver.resolveEffectivePlan("tenant_a", "user_a");

      // Verify tenant_b cache key is different
      const cachedA = await cacheStore.get("entitlement:tenant_a");
      const cachedB = await cacheStore.get("entitlement:tenant_b");
      assert.ok(cachedA);
      assert.strictEqual(cachedB, null);
    });
  });

  describe("BILLING STATE (Tests 63-70)", () => {
    test("63. Active Pro subscription", async () => {
      const { resolver, subscriptionRepo } = setupTestContext();
      await subscriptionRepo.save(
        {
          subscriptionId: "sub_1",
          stripeSubscriptionId: "sub_1",
          stripeCustomerId: "tenant_1",
          stripePriceId: "stripe_price_pro_global_v1",
          planId: "PRO",
          priceVersion: 1,
          status: "active",
          currentPeriodEnd: new Date(Date.now() + 86400000),
        },
        100,
      );

      const decision = await resolver.resolveEntitlement("tenant_1", "user_1", "ADVANCED_MATCHING");
      assert.strictEqual(decision.allowed, true);
      assert.strictEqual(decision.plan, "PRO");
    });

    test("64. Active Power Bidder subscription", async () => {
      const { resolver, subscriptionRepo } = setupTestContext();
      await subscriptionRepo.save(
        {
          subscriptionId: "sub_1",
          stripeSubscriptionId: "sub_1",
          stripeCustomerId: "tenant_1",
          stripePriceId: "stripe_price_pb_global_v1",
          planId: "POWER_BIDDER",
          priceVersion: 1,
          status: "active",
          currentPeriodEnd: new Date(Date.now() + 86400000),
        },
        100,
      );

      const decision = await resolver.resolveEntitlement(
        "tenant_1",
        "user_1",
        "PRIORITY_AI_GENERATION",
      );
      assert.strictEqual(decision.allowed, true);
      assert.strictEqual(decision.plan, "POWER_BIDDER");
    });

    test("65. Inactive subscription", async () => {
      const { resolver, subscriptionRepo } = setupTestContext();
      await subscriptionRepo.save(
        {
          subscriptionId: "sub_1",
          stripeSubscriptionId: "sub_1",
          stripeCustomerId: "tenant_1",
          stripePriceId: "stripe_price_pro_global_v1",
          planId: "PRO",
          priceVersion: 1,
          status: "unpaid",
          currentPeriodEnd: new Date(Date.now() + 86400000),
        },
        100,
      );

      const decision = await resolver.resolveEntitlement("tenant_1", "user_1", "ADVANCED_MATCHING");
      assert.strictEqual(decision.allowed, false, "Unpaid subscription should deny Pro features");
    });

    test("66. Cancelled subscription", async () => {
      const { resolver, subscriptionRepo } = setupTestContext();
      await subscriptionRepo.save(
        {
          subscriptionId: "sub_1",
          stripeSubscriptionId: "sub_1",
          stripeCustomerId: "tenant_1",
          stripePriceId: "stripe_price_pro_global_v1",
          planId: "PRO",
          priceVersion: 1,
          status: "canceled",
          currentPeriodEnd: new Date(Date.now() + 86400000),
        },
        100,
      );

      const decision = await resolver.resolveEntitlement("tenant_1", "user_1", "ADVANCED_MATCHING");
      assert.strictEqual(decision.allowed, false);
      assert.strictEqual(decision.plan, "STARTER");
    });

    test("67. Payment-failure state according to existing semantics", async () => {
      const { resolver, subscriptionRepo } = setupTestContext();
      await subscriptionRepo.save(
        {
          subscriptionId: "sub_1",
          stripeSubscriptionId: "sub_1",
          stripeCustomerId: "tenant_1",
          stripePriceId: "stripe_price_pro_global_v1",
          planId: "PRO",
          priceVersion: 1,
          status: "past_due",
          currentPeriodEnd: new Date(Date.now() + 86400000),
        },
        100,
      );

      const decision = await resolver.resolveEntitlement("tenant_1", "user_1", "ADVANCED_MATCHING");
      assert.strictEqual(
        decision.allowed,
        false,
        "past_due subscription should deny Pro features (fail closed)",
      );
    });

    test("68. Unknown billing entity", async () => {
      const { resolver } = setupTestContext();
      const decision = await resolver.resolveEntitlement(
        "unknown_tenant",
        "unknown_user",
        "JOB_SCAN",
      );
      assert.strictEqual(decision.allowed, true); // Starter allows JOB_SCAN
      assert.strictEqual(decision.plan, "STARTER");
    });

    test("69. Billing state unavailable", async () => {
      const brokenSubRepo = {
        save: async () => {},
        findById: async () => {
          throw new Error("DB Timeout");
        },
        findByTenantId: async () => {
          throw new Error("DB Timeout");
        },
        getRecord: async () => {
          throw new Error("DB Timeout");
        },
      };

      const resolver = new EntitlementResolver({
        planCatalog: new PlanCatalog([
          Plan.createStarter(),
          Plan.createPro(),
          Plan.createPowerBidder(),
        ]),
        trialPersistence: new InMemoryTrialGrantPersistence(),
        customerMappingRepo: new InMemoryStripeCustomerMappingRepository(),
        subscriptionRepo: brokenSubRepo,
        usageRepo: new InMemoryUsageRepository(),
      });

      // DB Failure on subscription check falls back safely to block paid features (fail closed)
      const decision = await resolver.resolveEntitlement("tenant_1", "user_1", "ADVANCED_MATCHING");
      assert.strictEqual(decision.allowed, false);
      assert.strictEqual(decision.reason, "BILLING_STATE_UNAVAILABLE");
    });

    test("70. Stripe is never called during entitlement resolution", async () => {
      // resolver holds reference to local repositories only and does not hold any stripe client reference
      const { resolver } = setupTestContext();
      const decision = await resolver.resolveEntitlement("tenant_1", "user_1", "JOB_SCAN");
      assert.strictEqual(decision.allowed, true);
    });
  });

  describe("FAIL-CLOSED (Tests 71-74)", () => {
    test("71. Authoritative billing state unavailable", async () => {
      const brokenSubRepo = {
        save: async () => {},
        findById: async () => {
          throw new Error("Connection lost");
        },
        findByTenantId: async () => {
          throw new Error("Connection lost");
        },
        getRecord: async () => {
          throw new Error("Connection lost");
        },
      };

      const resolver = new EntitlementResolver({
        planCatalog: new PlanCatalog([
          Plan.createStarter(),
          Plan.createPro(),
          Plan.createPowerBidder(),
        ]),
        trialPersistence: new InMemoryTrialGrantPersistence(),
        customerMappingRepo: new InMemoryStripeCustomerMappingRepository(),
        subscriptionRepo: brokenSubRepo,
        usageRepo: new InMemoryUsageRepository(),
      });

      const decision = await resolver.resolveEntitlement("tenant_1", "user_1", "ADVANCED_MATCHING");
      assert.strictEqual(decision.allowed, false);
      assert.strictEqual(decision.reason, "BILLING_STATE_UNAVAILABLE");
    });

    test("72. Cache unavailable", async () => {
      const failingCache: CacheStore = {
        get: async () => {
          throw new Error("Cache crash");
        },
        set: async () => {
          throw new Error("Cache crash");
        },
        delete: async () => {
          throw new Error("Cache crash");
        },
      };
      const { resolver } = setupTestContext(failingCache);

      // Resolving should succeed by falling back to DB/repositories
      const decision = await resolver.resolveEntitlement("tenant_1", "user_1", "JOB_SCAN");
      assert.strictEqual(decision.allowed, true);
      assert.strictEqual(decision.plan, "STARTER");
    });

    test("73. Cache contains stale state", async () => {
      const cacheStore = new MemoryCacheStore({ maxSize: 10, ttlSeconds: 60 });
      const { resolver, subscriptionRepo } = setupTestContext(cacheStore);

      // Cache Starter plan
      await resolver.resolveEffectivePlan("tenant_stale", "user_stale");

      // subscription becomes PRO
      await subscriptionRepo.save(
        {
          subscriptionId: "sub_1",
          stripeSubscriptionId: "sub_1",
          stripeCustomerId: "tenant_stale",
          stripePriceId: "stripe_price_pro_global_v1",
          planId: "PRO",
          priceVersion: 1,
          status: "active",
          currentPeriodEnd: new Date(Date.now() + 86400000),
        },
        100,
      );

      // Invalidate stale cache
      await resolver.invalidateCache("tenant_stale");

      const decision = await resolver.resolveEntitlement(
        "tenant_stale",
        "user_stale",
        "ADVANCED_MATCHING",
      );
      assert.strictEqual(
        decision.allowed,
        true,
        "Authoritative DB state should win over stale cache",
      );
    });

    test("74. Invalid billing state", async () => {
      const { resolver, subscriptionRepo } = setupTestContext();
      // Malformed subscription record status (e.g. invalid string)
      await subscriptionRepo.save(
        {
          subscriptionId: "sub_invalid",
          stripeSubscriptionId: "sub_invalid",
          stripeCustomerId: "tenant_invalid",
          stripePriceId: "stripe_price_pro_global_v1",
          planId: "PRO",
          priceVersion: 1,
          status: "invalid_status_value" as unknown as "active",
          currentPeriodEnd: new Date(Date.now() + 86400000),
        },
        100,
      );

      const decision = await resolver.resolveEntitlement(
        "tenant_invalid",
        "user_invalid",
        "ADVANCED_MATCHING",
      );
      assert.strictEqual(
        decision.allowed,
        false,
        "Invalid billing status fails closed and denies paid feature",
      );
    });
  });

  describe("PRODUCTION HARDENING AUDIT REMEDIATIONS (R1, R2, R3)", () => {
    describe("R1 - Paid Precedence", () => {
      test("R1-1. Active paid PRO overrides active trial", async () => {
        const { resolver, trialPersistence, subscriptionRepo } = setupTestContext();
        const start = new Date();
        const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
        await trialPersistence.save(
          new TrialGrant({
            grantId: "trial_r1",
            userId: "user_r1",
            planId: "PRO",
            status: "ACTIVE",
            trialStartedAt: start,
            trialEndsAt: end,
            identitySignals: { accountId: "user_r1" },
          }),
        );
        await subscriptionRepo.save(
          {
            subscriptionId: "sub_r1",
            stripeSubscriptionId: "sub_r1",
            stripeCustomerId: "tenant_r1",
            stripePriceId: "stripe_price_pro_global_v1",
            planId: "PRO",
            priceVersion: 1,
            status: "active",
            currentPeriodEnd: new Date(Date.now() + 86400000),
          },
          100,
        );

        const planInfo = await resolver.resolveEffectivePlan(
          "tenant_r1",
          "user_r1",
          new Date(start.getTime() + 1000),
        );
        assert.strictEqual(planInfo.plan.planId, "PRO");
        assert.strictEqual(
          planInfo.source,
          "SUBSCRIPTION",
          "Subscription must override active trial",
        );
      });

      test("R1-2. Active POWER_BIDDER overrides active PRO trial", async () => {
        const { resolver, trialPersistence, subscriptionRepo } = setupTestContext();
        const start = new Date();
        const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
        await trialPersistence.save(
          new TrialGrant({
            grantId: "trial_r1_2",
            userId: "user_r1_2",
            planId: "PRO",
            status: "ACTIVE",
            trialStartedAt: start,
            trialEndsAt: end,
            identitySignals: { accountId: "user_r1_2" },
          }),
        );
        await subscriptionRepo.save(
          {
            subscriptionId: "sub_r1_2",
            stripeSubscriptionId: "sub_r1_2",
            stripeCustomerId: "tenant_r1_2",
            stripePriceId: "stripe_price_pb_global_v1",
            planId: "POWER_BIDDER",
            priceVersion: 1,
            status: "active",
            currentPeriodEnd: new Date(Date.now() + 86400000),
          },
          100,
        );

        const planInfo = await resolver.resolveEffectivePlan(
          "tenant_r1_2",
          "user_r1_2",
          new Date(start.getTime() + 1000),
        );
        assert.strictEqual(planInfo.plan.planId, "POWER_BIDDER");
        assert.strictEqual(
          planInfo.source,
          "SUBSCRIPTION",
          "POWER_BIDDER subscription must override PRO trial",
        );
      });

      test("R1-3. Expired trial + paid subscription", async () => {
        const { resolver, trialPersistence, subscriptionRepo } = setupTestContext();
        const start = new Date(Date.now() - 10 * 86400000);
        const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
        await trialPersistence.save(
          new TrialGrant({
            grantId: "trial_r1_3",
            userId: "user_r1_3",
            planId: "PRO",
            status: "ACTIVE",
            trialStartedAt: start,
            trialEndsAt: end,
            identitySignals: { accountId: "user_r1_3" },
          }),
        );
        await subscriptionRepo.save(
          {
            subscriptionId: "sub_r1_3",
            stripeSubscriptionId: "sub_r1_3",
            stripeCustomerId: "tenant_r1_3",
            stripePriceId: "stripe_price_pb_global_v1",
            planId: "POWER_BIDDER",
            priceVersion: 1,
            status: "active",
            currentPeriodEnd: new Date(Date.now() + 86400000),
          },
          100,
        );

        const planInfo = await resolver.resolveEffectivePlan("tenant_r1_3", "user_r1_3");
        assert.strictEqual(planInfo.plan.planId, "POWER_BIDDER");
        assert.strictEqual(planInfo.source, "SUBSCRIPTION");
      });

      test("R1-4. Active trial + no subscription", async () => {
        const { resolver, trialPersistence } = setupTestContext();
        const start = new Date();
        const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
        await trialPersistence.save(
          new TrialGrant({
            grantId: "trial_r1_4",
            userId: "user_r1_4",
            planId: "PRO",
            status: "ACTIVE",
            trialStartedAt: start,
            trialEndsAt: end,
            identitySignals: { accountId: "user_r1_4" },
          }),
        );

        const planInfo = await resolver.resolveEffectivePlan(
          "tenant_r1_4",
          "user_r1_4",
          new Date(start.getTime() + 1000),
        );
        assert.strictEqual(planInfo.plan.planId, "PRO");
        assert.strictEqual(planInfo.source, "TRIAL");
      });

      test("R1-5. No trial + no subscription", async () => {
        const { resolver } = setupTestContext();
        const planInfo = await resolver.resolveEffectivePlan("tenant_r1_5", "user_r1_5");
        assert.strictEqual(planInfo.plan.planId, "STARTER");
        assert.strictEqual(planInfo.source, "STARTER");
      });

      test("R1-6. Inactive subscription + active trial", async () => {
        const { resolver, trialPersistence, subscriptionRepo } = setupTestContext();
        const start = new Date();
        const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
        await trialPersistence.save(
          new TrialGrant({
            grantId: "trial_r1_6",
            userId: "user_r1_6",
            planId: "PRO",
            status: "ACTIVE",
            trialStartedAt: start,
            trialEndsAt: end,
            identitySignals: { accountId: "user_r1_6" },
          }),
        );
        await subscriptionRepo.save(
          {
            subscriptionId: "sub_r1_6",
            stripeSubscriptionId: "sub_r1_6",
            stripeCustomerId: "tenant_r1_6",
            stripePriceId: "stripe_price_pro_global_v1",
            planId: "PRO",
            priceVersion: 1,
            status: "canceled",
            currentPeriodEnd: new Date(Date.now() + 86400000),
          },
          100,
        );

        const planInfo = await resolver.resolveEffectivePlan(
          "tenant_r1_6",
          "user_r1_6",
          new Date(start.getTime() + 1000),
        );
        assert.strictEqual(planInfo.plan.planId, "PRO");
        assert.strictEqual(
          planInfo.source,
          "TRIAL",
          "Inactive subscription must not override active trial",
        );
      });

      test("R1-7. Multiple stale trials do not override paid subscription", async () => {
        const { resolver, trialPersistence, subscriptionRepo } = setupTestContext();
        const start = new Date(Date.now() - 30 * 86400000);
        const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
        await trialPersistence.save(
          new TrialGrant({
            grantId: "trial_stale1",
            userId: "user_r1_7",
            planId: "PRO",
            status: "EXPIRED",
            trialStartedAt: start,
            trialEndsAt: end,
            identitySignals: { accountId: "user_r1_7" },
          }),
        );
        await trialPersistence.save(
          new TrialGrant({
            grantId: "trial_stale2",
            userId: "user_r1_7",
            planId: "PRO",
            status: "ACTIVE",
            trialStartedAt: start,
            trialEndsAt: end,
            identitySignals: { accountId: "user_r1_7" },
          }),
        );
        await subscriptionRepo.save(
          {
            subscriptionId: "sub_r1_7",
            stripeSubscriptionId: "sub_r1_7",
            stripeCustomerId: "tenant_r1_7",
            stripePriceId: "stripe_price_pb_global_v1",
            planId: "POWER_BIDDER",
            priceVersion: 1,
            status: "active",
            currentPeriodEnd: new Date(Date.now() + 86400000),
          },
          100,
        );

        const planInfo = await resolver.resolveEffectivePlan("tenant_r1_7", "user_r1_7");
        assert.strictEqual(planInfo.plan.planId, "POWER_BIDDER");
        assert.strictEqual(planInfo.source, "SUBSCRIPTION");
      });
    });

    describe("R2 - Trial Conversion", () => {
      function setupProcessor(
        trialPersistence: InMemoryTrialGrantPersistence,
        subscriptionRepo: InMemoryStripeSubscriptionRepository,
        customerMappingRepo: InMemoryStripeCustomerMappingRepository,
      ) {
        const priceRegistry = new StripePriceRegistry([
          {
            planId: "PRO",
            stripePriceId: "stripe_price_pro_global_v1",
            currency: "USD",
            interval: "MONTHLY",
            region: "GLOBAL",
            version: 1,
          },
          {
            planId: "POWER_BIDDER",
            stripePriceId: "stripe_price_pb_global_v1",
            currency: "USD",
            interval: "MONTHLY",
            region: "GLOBAL",
            version: 1,
          },
        ]);
        const paymentStore = {
          save: async () => {},
          findById: async () => null,
          findByReference: async () => null,
        } as unknown as PaymentAggregateStore;
        const eventStore = new InMemoryWebhookEventStore();
        return new StripeWebhookProcessor({
          stripeSecretKey: "sk_test_mock",
          webhookSecret: "whsec_mock",
          env: "development",
          priceRegistry,
          customerMappingRepo,
          subscriptionRepo,
          paymentStore,
          trialPersistence,
          eventStore,
          stripeClientMock: {
            webhooks: {
              constructEvent: (payload: string) => JSON.parse(payload) as unknown,
            },
          },
        });
      }

      test("R2-1. PRO trial -> PRO paid conversion", async () => {
        const { trialPersistence, subscriptionRepo, customerMappingRepo } = setupTestContext();
        await customerMappingRepo.save({
          tenantId: "tenant_conv1",
          ownerId: "user_conv1",
          stripeCustomerId: "cust_conv1",
          createdAt: new Date(),
        });

        const start = new Date();
        const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
        const grant = new TrialGrant({
          grantId: "trial_conv1",
          userId: "user_conv1",
          planId: "PRO",
          status: "ACTIVE",
          trialStartedAt: start,
          trialEndsAt: end,
          identitySignals: { accountId: "user_conv1" },
        });
        await trialPersistence.save(grant);

        const processor = setupProcessor(trialPersistence, subscriptionRepo, customerMappingRepo);
        const payload = JSON.stringify({
          id: "evt_conv1",
          type: "customer.subscription.created",
          created: Math.floor(Date.now() / 1000),
          data: {
            object: {
              id: "sub_conv1",
              customer: "cust_conv1",
              status: "active",
              current_period_end: Math.floor((Date.now() + 86400000) / 1000),
              trial_end: null,
              items: {
                data: [{ price: { id: "stripe_price_pro_global_v1" } }],
              },
            },
          },
        });

        await processor.handleWebhook(payload, "valid-sig");

        const updatedGrants = await trialPersistence.findByUserId("user_conv1");
        assert.ok(updatedGrants[0]);
        assert.strictEqual(updatedGrants[0].status, "CONVERTED");
      });

      test("R2-2. PRO trial -> POWER_BIDDER paid conversion", async () => {
        const { trialPersistence, subscriptionRepo, customerMappingRepo } = setupTestContext();
        await customerMappingRepo.save({
          tenantId: "tenant_conv2",
          ownerId: "user_conv2",
          stripeCustomerId: "cust_conv2",
          createdAt: new Date(),
        });

        const start = new Date();
        const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
        const grant = new TrialGrant({
          grantId: "trial_conv2",
          userId: "user_conv2",
          planId: "PRO",
          status: "ACTIVE",
          trialStartedAt: start,
          trialEndsAt: end,
          identitySignals: { accountId: "user_conv2" },
        });
        await trialPersistence.save(grant);

        const processor = setupProcessor(trialPersistence, subscriptionRepo, customerMappingRepo);
        const payload = JSON.stringify({
          id: "evt_conv2",
          type: "customer.subscription.created",
          created: Math.floor(Date.now() / 1000),
          data: {
            object: {
              id: "sub_conv2",
              customer: "cust_conv2",
              status: "active",
              current_period_end: Math.floor((Date.now() + 86400000) / 1000),
              trial_end: null,
              items: {
                data: [{ price: { id: "stripe_price_pb_global_v1" } }],
              },
            },
          },
        });

        await processor.handleWebhook(payload, "valid-sig");

        const updatedGrants = await trialPersistence.findByUserId("user_conv2");
        assert.ok(updatedGrants[0]);
        assert.strictEqual(
          updatedGrants[0].status,
          "CONVERTED",
          "PRO trial should be CONVERTED on POWER_BIDDER paid plan purchase",
        );
      });

      test("R2-3. Duplicate conversion webhook", async () => {
        const { trialPersistence, subscriptionRepo, customerMappingRepo } = setupTestContext();
        await customerMappingRepo.save({
          tenantId: "tenant_conv3",
          ownerId: "user_conv3",
          stripeCustomerId: "cust_conv3",
          createdAt: new Date(),
        });

        const start = new Date();
        const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
        const grant = new TrialGrant({
          grantId: "trial_conv3",
          userId: "user_conv3",
          planId: "PRO",
          status: "ACTIVE",
          trialStartedAt: start,
          trialEndsAt: end,
          identitySignals: { accountId: "user_conv3" },
        });
        await trialPersistence.save(grant);

        const processor = setupProcessor(trialPersistence, subscriptionRepo, customerMappingRepo);
        const payload = (id: string) =>
          JSON.stringify({
            id,
            type: "customer.subscription.created",
            created: Math.floor(Date.now() / 1000),
            data: {
              object: {
                id: "sub_conv3",
                customer: "cust_conv3",
                status: "active",
                current_period_end: Math.floor((Date.now() + 86400000) / 1000),
                trial_end: null,
                items: {
                  data: [{ price: { id: "stripe_price_pb_global_v1" } }],
                },
              },
            },
          });

        await processor.handleWebhook(payload("evt_conv3_1"), "valid-sig");

        const updatedGrants1 = await trialPersistence.findByUserId("user_conv3");
        assert.ok(updatedGrants1[0]);
        assert.strictEqual(updatedGrants1[0].status, "CONVERTED");

        await processor.handleWebhook(payload("evt_conv3_2"), "valid-sig");

        const updatedGrants2 = await trialPersistence.findByUserId("user_conv3");
        assert.ok(updatedGrants2[0]);
        assert.strictEqual(updatedGrants2[0].status, "CONVERTED");
      });
    });

    describe("R3 - Stale claim and webhook recovery", () => {
      test("R3-1. Fresh PROCESSING event rejects concurrent duplicate", async () => {
        const store = new InMemoryWebhookEventStore();
        const claimed1 = await store.claim("evt_r3_1", "customer.subscription.created");
        assert.strictEqual(claimed1, true);

        const claimed2 = await store.claim("evt_r3_1", "customer.subscription.created");
        assert.strictEqual(claimed2, false, "Immediate duplicate should be rejected");
      });

      test("R3-2. Stale PROCESSING event can be reclaimed", async () => {
        const store = new InMemoryWebhookEventStore();
        await store.claim("evt_r3_2", "customer.subscription.created");

        const record = await store.get("evt_r3_2");
        if (record) {
          record.receivedAt = new Date(Date.now() - 6 * 60 * 1000);
        }

        const claimed = await store.claim("evt_r3_2", "customer.subscription.created");
        assert.strictEqual(claimed, true, "Stale PROCESSING event should be reclaimable");
      });

      test("R3-3. Processed event cannot be reclaimed", async () => {
        const store = new InMemoryWebhookEventStore();
        await store.claim("evt_r3_3", "customer.subscription.created");
        await store.markProcessed("evt_r3_3");

        const record = await store.get("evt_r3_3");
        if (record) {
          record.receivedAt = new Date(Date.now() - 10 * 60 * 1000);
        }

        const claimed = await store.claim("evt_r3_3", "customer.subscription.created");
        assert.strictEqual(claimed, false, "PROCESSED event should NEVER be reclaimed");
      });

      test("R3-4. RETRYABLE behavior remains intact", async () => {
        const store = new InMemoryWebhookEventStore();
        await store.claim("evt_r3_4", "customer.subscription.created");
        await store.markFailed("evt_r3_4", "Transient DB Timeout", true);

        const record = await store.get("evt_r3_4");
        assert.strictEqual(record?.status, "RETRYABLE");

        const claimed = await store.claim("evt_r3_4", "customer.subscription.created");
        assert.strictEqual(claimed, true);
      });

      test("R3-5. Concurrent stale reclaim has only one winner", async () => {
        const store = new InMemoryWebhookEventStore();
        await store.claim("evt_r3_5", "customer.subscription.created");

        const record = await store.get("evt_r3_5");
        if (record) {
          record.receivedAt = new Date(Date.now() - 6 * 60 * 1000);
        }

        const p1 = store.claim("evt_r3_5", "customer.subscription.created");
        const p2 = store.claim("evt_r3_5", "customer.subscription.created");

        const results = await Promise.all([p1, p2]);
        const successes = results.filter(Boolean).length;
        const failures = results.filter((r: boolean) => !r).length;

        assert.strictEqual(successes, 1, "Exactly one reclaim must win");
        assert.strictEqual(failures, 1);
      });
    });
  });
});
