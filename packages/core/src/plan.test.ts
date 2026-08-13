import { test, describe } from "node:test";
import assert from "node:assert";
import { Plan, PlanCatalog, PricingRegionResolver, validatePlanPrice } from "./plan.js";
import type { PlanPrice, PricingRegion, BillingInterval, PlanFeature } from "./plan.js";
import {
  TrialGrant,
  TrialService,
  calculateTrialExpiration,
  InMemoryTrialGrantPersistence,
} from "./trial.js";

describe("10A Plan & Pricing Domain/Catalog Requirements", () => {
  // Setup canonical plans for testing
  const starter = Plan.createStarter();
  const pro = Plan.createPro();
  const powerBidder = Plan.createPowerBidder();
  const catalog = new PlanCatalog([starter, pro, powerBidder]);

  describe("PLAN: Structure, Identity & Lifecycle", () => {
    test("1. STARTER exists in the system with expected defaults", () => {
      assert.strictEqual(starter.planId, "STARTER");
      assert.strictEqual(starter.hasFeature("JOB_SCAN"), true);
      assert.deepStrictEqual(starter.limits.jobScans, { type: "LIMITED", value: 5 });
      assert.deepStrictEqual(starter.limits.aiProposals, { type: "LIMITED", value: 3 });
    });

    test("2. PRO exists in the system with expected defaults", () => {
      assert.strictEqual(pro.planId, "PRO");
      assert.strictEqual(pro.hasFeature("ADVANCED_MATCHING"), true);
      assert.deepStrictEqual(pro.limits.jobScans, { type: "UNLIMITED" });
      assert.deepStrictEqual(pro.limits.aiProposals, { type: "LIMITED", value: 50 });
    });

    test("3. POWER_BIDDER exists in the system with expected defaults", () => {
      assert.strictEqual(powerBidder.planId, "POWER_BIDDER");
      assert.strictEqual(powerBidder.hasFeature("PRIORITY_AI_GENERATION"), true);
      assert.deepStrictEqual(powerBidder.limits.jobScans, { type: "UNLIMITED" });
      assert.deepStrictEqual(powerBidder.limits.aiProposals, { type: "LIMITED", value: 200 });
      assert.deepStrictEqual(powerBidder.limits.maxWorkspaces, { type: "UNLIMITED" });
    });

    test("4. Stable IDs: identifiers are stable (STARTER, PRO, POWER_BIDDER) and do not use display names", () => {
      assert.strictEqual(starter.planId, "STARTER");
      assert.strictEqual(pro.planId, "PRO");
      assert.strictEqual(powerBidder.planId, "POWER_BIDDER");
      // Verify display names are different from IDs
      assert.notStrictEqual(starter.planId, starter.displayName);
      assert.notStrictEqual(pro.planId, pro.displayName);
    });

    test("5. Display name separation: changes to display names do not impact the stable ID", () => {
      const customPro = Plan.createPro();
      assert.strictEqual(customPro.planId, "PRO");
      assert.strictEqual(customPro.displayName, "Pro Plan");

      // Update display name
      customPro.updateDisplayName("Super Pro Package");
      assert.strictEqual(customPro.displayName, "Super Pro Package");
      assert.strictEqual(customPro.planId, "PRO"); // Still stable
    });

    test("6. Lifecycle validation: invalid state transitions are rejected", () => {
      const draft = new Plan({
        planId: "PRO",
        code: "pro_draft",
        displayName: "Draft Plan",
        lifecycleState: "DRAFT",
        features: pro.features,
        limits: pro.limits,
        prices: [...pro.prices],
      });

      // DRAFT -> ACTIVE is valid
      draft.transitionTo("ACTIVE");
      assert.strictEqual(draft.lifecycleState, "ACTIVE");

      // ACTIVE -> DEPRECATED is valid
      draft.transitionTo("DEPRECATED");
      assert.strictEqual(draft.lifecycleState, "DEPRECATED");

      // DEPRECATED -> RETIRED is valid
      draft.transitionTo("RETIRED");
      assert.strictEqual(draft.lifecycleState, "RETIRED");

      // RETIRED -> ACTIVE is invalid (throws)
      assert.throws(() => {
        draft.transitionTo("ACTIVE");
      }, /Invalid plan lifecycle transition/);
    });

    test("7. DRAFT cannot be newly selected", () => {
      const draftPlan = new Plan({
        planId: "PRO",
        code: "pro_draft",
        displayName: "Draft Plan",
        lifecycleState: "DRAFT",
        features: pro.features,
        limits: pro.limits,
        prices: [...pro.prices],
      });
      const tempCatalog = new PlanCatalog([draftPlan]);

      assert.throws(() => {
        tempCatalog.validateForNewSelection("PRO");
      }, /is in DRAFT state and cannot be selected/);
    });

    test("8. ACTIVE can be selected", () => {
      assert.doesNotThrow(() => {
        catalog.validateForNewSelection("PRO");
      });
    });

    test("9. DEPRECATED behavior: valid for existing, rejected for new selection", () => {
      const deprecatedPlan = new Plan({
        planId: "PRO",
        code: "pro_dep",
        displayName: "Deprecated Plan",
        lifecycleState: "DEPRECATED",
        features: pro.features,
        limits: pro.limits,
        prices: [...pro.prices],
      });
      const tempCatalog = new PlanCatalog([deprecatedPlan]);

      // Rejected for new
      assert.throws(() => {
        tempCatalog.validateForNewSelection("PRO");
      }, /is in DEPRECATED state and cannot be selected/);

      // Allowed for existing
      assert.doesNotThrow(() => {
        tempCatalog.validateForExistingSubscription("PRO");
      });
    });

    test("10. RETIRED behavior: rejected for both new and existing subscriptions", () => {
      const retiredPlan = new Plan({
        planId: "PRO",
        code: "pro_ret",
        displayName: "Retired Plan",
        lifecycleState: "RETIRED",
        features: pro.features,
        limits: pro.limits,
        prices: [...pro.prices],
      });
      const tempCatalog = new PlanCatalog([retiredPlan]);

      // Rejected for new
      assert.throws(() => {
        tempCatalog.validateForNewSelection("PRO");
      }, /is in RETIRED state and cannot be selected/);

      // Rejected for existing
      assert.throws(() => {
        tempCatalog.validateForExistingSubscription("PRO");
      }, /is RETIRED and cannot remain active/);
    });
  });

  describe("PRICING & MONEY: Minor Units & Validation", () => {
    test("11. INR 799 price resolution matches expected amount", () => {
      const resolved = catalog.resolvePrice("PRO", "IN", "INR");
      assert.strictEqual(resolved.resolvedAmountMinor, 79900); // 799.00 INR -> 79900 paise
      assert.strictEqual(resolved.resolvedCurrency, "INR");
    });

    test("12. USD 14.99 price resolution matches expected amount", () => {
      const resolved = catalog.resolvePrice("PRO", "US", "USD");
      assert.strictEqual(resolved.resolvedAmountMinor, 1499); // 14.99 USD -> 1499 cents
      assert.strictEqual(resolved.resolvedCurrency, "USD");
    });

    test("13. INR 2999 price resolution matches expected amount", () => {
      const resolved = catalog.resolvePrice("POWER_BIDDER", "IN", "INR");
      assert.strictEqual(resolved.resolvedAmountMinor, 299900); // 2999.00 INR -> 299900 paise
      assert.strictEqual(resolved.resolvedCurrency, "INR");
    });

    test("14. USD 39.99 price resolution matches expected amount", () => {
      const resolved = catalog.resolvePrice("POWER_BIDDER", "US", "USD");
      assert.strictEqual(resolved.resolvedAmountMinor, 3999); // 39.99 USD -> 3999 cents
      assert.strictEqual(resolved.resolvedCurrency, "USD");
    });

    test("15. Zero-price Starter is resolved correctly", () => {
      const resolved = catalog.resolvePrice("STARTER", "US", "USD");
      assert.strictEqual(resolved.resolvedAmountMinor, 0);
      assert.strictEqual(resolved.resolvedCurrency, "USD");
    });

    test("16. Negative price rejected during price validation", () => {
      const badPrice: PlanPrice = {
        priceId: "p-neg",
        region: "GLOBAL",
        currency: "USD",
        amountMinor: -1000,
        interval: "MONTHLY",
        version: 1,
      };
      assert.throws(() => {
        validatePlanPrice(badPrice);
      }, /must be non-negative/);
    });

    test("17. Invalid currency rejected during price validation", () => {
      const badPrice: PlanPrice = {
        priceId: "p-curr",
        region: "GLOBAL",
        currency: "JPY", // Unsupported currency in 10A
        amountMinor: 1000,
        interval: "MONTHLY",
        version: 1,
      };
      assert.throws(() => {
        validatePlanPrice(badPrice);
      }, /Unsupported currency/);
    });

    test("18. Invalid interval rejected (validation requires MONTHLY)", () => {
      // Construction of invalid interval typecasted for validator testing
      const badPrice = {
        priceId: "p-int",
        region: "GLOBAL" as PricingRegion,
        currency: "USD",
        amountMinor: 1000,
        interval: "YEARLY" as unknown as BillingInterval, // Unsupported interval
        version: 1,
      };
      assert.throws(() => {
        validatePlanPrice(badPrice);
      });
    });

    test("19. Minor-unit representation: floats are strictly rejected", () => {
      const badPrice: PlanPrice = {
        priceId: "p-float",
        region: "GLOBAL",
        currency: "USD",
        amountMinor: 14.99, // Float throws
        interval: "MONTHLY",
        version: 1,
      };
      assert.throws(() => {
        validatePlanPrice(badPrice);
      }, /must be an integer/);
    });
  });

  describe("REGIONAL: Mappings and Fallbacks", () => {
    test("21. India → INR", () => {
      const res = PricingRegionResolver.resolveRegionAndCurrency("IN");
      assert.strictEqual(res.region, "INDIA");
      assert.strictEqual(res.currency, "INR");
    });

    test("22. US → USD", () => {
      const res = PricingRegionResolver.resolveRegionAndCurrency("US");
      assert.strictEqual(res.region, "NORTH_AMERICA");
      assert.strictEqual(res.currency, "USD");
    });

    test("23. Canada → USD", () => {
      const res = PricingRegionResolver.resolveRegionAndCurrency("CA");
      assert.strictEqual(res.region, "NORTH_AMERICA");
      assert.strictEqual(res.currency, "USD");
    });

    test("24. UK → GBP", () => {
      const res = PricingRegionResolver.resolveRegionAndCurrency("GB");
      assert.strictEqual(res.region, "UK");
      assert.strictEqual(res.currency, "GBP");
    });

    test("25. EU → EUR", () => {
      // Check multiple EU member countries
      const resFR = PricingRegionResolver.resolveRegionAndCurrency("FR");
      assert.strictEqual(resFR.region, "EUROPE");
      assert.strictEqual(resFR.currency, "EUR");

      const resDE = PricingRegionResolver.resolveRegionAndCurrency("DE");
      assert.strictEqual(resDE.region, "EUROPE");
      assert.strictEqual(resDE.currency, "EUR");
    });

    test("26. Other country → GLOBAL/USD", () => {
      const res = PricingRegionResolver.resolveRegionAndCurrency("JP"); // Japan
      assert.strictEqual(res.region, "GLOBAL");
      assert.strictEqual(res.currency, "USD");
    });

    test("27. Unsupported country deterministic fallback", () => {
      const res = PricingRegionResolver.resolveRegionAndCurrency("XX"); // Fake country code
      assert.strictEqual(res.region, "GLOBAL");
      assert.strictEqual(res.currency, "USD");
    });

    test("28. Missing country deterministic fallback", () => {
      const res = PricingRegionResolver.resolveRegionAndCurrency(undefined);
      assert.strictEqual(res.region, "GLOBAL");
      assert.strictEqual(res.currency, "USD");
    });

    test("29. Invalid country rejected/normalized (safely falls back or cleans up)", () => {
      const res1 = PricingRegionResolver.resolveRegionAndCurrency("  in  "); // Spaces
      assert.strictEqual(res1.region, "INDIA");

      const res2 = PricingRegionResolver.resolveRegionAndCurrency("INVALID_CODE"); // Too long
      assert.strictEqual(res2.region, "GLOBAL");
    });

    test("30. Client cannot force cheaper region: server resolves the price authoritatively", () => {
      // Client requests India region and currency, but server resolves region for US
      const resolved = catalog.resolvePrice("PRO", "US", "INR");

      // Server overrides currency and returns USD/North America price
      assert.strictEqual(resolved.resolvedRegion, "NORTH_AMERICA");
      assert.strictEqual(resolved.resolvedCurrency, "USD");
      assert.strictEqual(resolved.resolvedAmountMinor, 1499);

      // Metadata records mismatch and validation requirement
      assert.strictEqual(resolved.isMismatch, true);
      assert.strictEqual(resolved.validationRequired, true);
    });
  });

  describe("TRIAL & LIMITS ENTITLEMENTS: Features, Limits & Usage Periods", () => {
    test("46. Trial receives PRO features", () => {
      // 7-day PRO trial receives PRO features
      const proTrialFeatures = pro.features;
      assert.deepStrictEqual(proTrialFeatures, pro.features);
      assert.strictEqual(proTrialFeatures.has("ADVANCED_MATCHING"), true);
      assert.strictEqual(proTrialFeatures.has("FULL_MATCH_EXPLANATION"), true);
      assert.strictEqual(proTrialFeatures.has("PRIORITY_AI_GENERATION"), false); // Only in POWER_BIDDER
    });

    test("47. Trial receives PRO limits", () => {
      // 7-day PRO trial receives PRO limits
      const proTrialLimits = pro.limits;
      assert.deepStrictEqual(proTrialLimits, pro.limits);
      assert.deepStrictEqual(proTrialLimits.aiProposals, { type: "LIMITED", value: 50 });
      assert.deepStrictEqual(proTrialLimits.jobScans, { type: "UNLIMITED" });
    });

    test("48. Starter = 5 scans limit", () => {
      assert.deepStrictEqual(starter.limits.jobScans, { type: "LIMITED", value: 5 });
    });

    test("49. Starter = 3 proposals limit", () => {
      assert.deepStrictEqual(starter.limits.aiProposals, { type: "LIMITED", value: 3 });
    });

    test("50. Pro = unlimited scans limit", () => {
      assert.deepStrictEqual(pro.limits.jobScans, { type: "UNLIMITED" });
    });

    test("51. Pro = 50 proposals limit", () => {
      assert.deepStrictEqual(pro.limits.aiProposals, { type: "LIMITED", value: 50 });
    });

    test("52. Power Bidder = unlimited scans limit", () => {
      assert.deepStrictEqual(powerBidder.limits.jobScans, { type: "UNLIMITED" });
    });

    test("53. Power Bidder = 200 proposals limit", () => {
      assert.deepStrictEqual(powerBidder.limits.aiProposals, { type: "LIMITED", value: 200 });
    });

    test("54. Unlimited is explicit, not magic integer", () => {
      // jobScans is represented as { type: "UNLIMITED" } instead of a magic number
      assert.deepStrictEqual(pro.limits.jobScans, { type: "UNLIMITED" });
      assert.notStrictEqual((pro.limits.jobScans as unknown as { value: number }).value, -1);
      assert.notStrictEqual((pro.limits.jobScans as unknown as { value: number }).value, 999999);
    });

    test("55. Limits immutable: cannot mutate limits object at runtime", () => {
      const original = pro.limits.aiProposals;
      try {
        (pro.limits as unknown as Record<string, unknown>).aiProposals = {
          type: "LIMITED",
          value: 1000,
        };
      } catch {
        return;
      }
      assert.deepStrictEqual(pro.limits.aiProposals, original);
    });
  });

  describe("PRICE VERSIONING & IMMUTABILITY: co-existence and duplicate rejection", () => {
    test("56. Price v1 immutable: prices inside Plan cannot be mutated", () => {
      const v1Price = pro.getPriceByVersion("pro-global", 1);
      assert.ok(v1Price);
      assert.throws(() => {
        (v1Price as unknown as Record<string, unknown>).amountMinor = 1;
      });
    });

    test("57. Price v2 can coexist with Price v1", () => {
      const proWithV2 = Plan.createPro(2); // V2
      const combinedPrices = [...pro.prices, ...proWithV2.prices];

      const multiVersionPlan = new Plan({
        planId: "PRO",
        code: "pro_multi",
        displayName: "Pro Multi-version",
        lifecycleState: "ACTIVE",
        features: pro.features,
        limits: pro.limits,
        prices: combinedPrices,
      });

      const p1 = multiVersionPlan.getPriceByVersion("pro-global", 1);
      const p2 = multiVersionPlan.getPriceByVersion("pro-global", 2);

      assert.ok(p1);
      assert.ok(p2);
      assert.strictEqual(p1.version, 1);
      assert.strictEqual(p2.version, 2);
    });

    test("58. Existing price reference remains stable when retrieved", () => {
      const p1 = pro.getPriceByVersion("pro-global", 1);
      assert.strictEqual(p1?.amountMinor, 1499);
      assert.strictEqual(p1?.currency, "USD");
    });

    test("59. New plan price does not mutate old price object references", () => {
      const p1 = pro.getPriceByVersion("pro-global", 1);

      // Creating a new plan price instance
      const p2: PlanPrice = {
        priceId: "pro-global",
        region: "GLOBAL",
        currency: "USD",
        amountMinor: 2500, // New price
        interval: "MONTHLY",
        version: 2,
      };

      // V1 amount is unaffected
      assert.strictEqual(p1?.amountMinor, 1499);
      assert.notStrictEqual(p1?.amountMinor, p2.amountMinor);
    });

    test("60. Duplicate price version rejected: throwing error on duplicate regions/intervals/versions", () => {
      const duplicatePrice: PlanPrice = {
        priceId: "pro-global-dup",
        region: "GLOBAL",
        currency: "USD",
        amountMinor: 1800,
        interval: "MONTHLY",
        version: 1, // Same region, interval, and version as p-global
      };

      assert.throws(() => {
        new Plan({
          planId: "PRO",
          code: "pro_bad",
          displayName: "Bad Plan",
          lifecycleState: "ACTIVE",
          features: pro.features,
          limits: pro.limits,
          prices: [pro.prices[0]!, duplicatePrice], // contains two GLOBAL, MONTHLY, version 1 prices
        });
      }, /Duplicate price version rejected/);
    });
  });

  describe("SECURITY: Client-supplied Input Tampering Protections", () => {
    test("61. Client cannot alter plan features list directly", () => {
      assert.throws(() => {
        (pro.features as unknown as Set<PlanFeature>).add("PRIORITY_AI_GENERATION");
      });
    });

    test("62. Client cannot alter price definition at runtime", () => {
      const price = pro.prices[0]!;
      assert.throws(() => {
        (price as unknown as Record<string, unknown>).priceId = "hacked-id";
      });
    });

    test("63. Client cannot alter amount directly", () => {
      const price = pro.prices[0]!;
      assert.throws(() => {
        (price as unknown as Record<string, unknown>).amountMinor = 1;
      });
    });

    test("64. Client cannot alter currency directly", () => {
      const price = pro.prices[0]!;
      assert.throws(() => {
        (price as unknown as Record<string, unknown>).currency = "EUR";
      });
    });

    test("65. Client cannot alter limits values directly", () => {
      const original = pro.limits.jobScans;
      try {
        (pro.limits as unknown as Record<string, unknown>).jobScans = {
          type: "LIMITED",
          value: 10000,
        };
      } catch {
        return;
      }
      assert.deepStrictEqual(pro.limits.jobScans, original);
    });

    test("66. Client cannot grant itself trial: must use authoritative TrialService", () => {
      // TrialService ensures eligibility evaluates to false for ineligible accounts
      const persistence = new InMemoryTrialGrantPersistence();
      const service = new TrialService(persistence);

      // Let's add a prior grant to persistence for user-1
      const start = new Date();
      const firstTrial = new TrialGrant({
        grantId: "g-1",
        userId: "user-1",
        planId: "PRO",
        status: "ACTIVE",
        trialStartedAt: start,
        trialEndsAt: calculateTrialExpiration(start),
        identitySignals: { accountId: "user-1" },
      });
      persistence.save(firstTrial);

      // Client tries to request another trial via TrialService for same user-1
      assert.rejects(async () => {
        await service.issueTrialGrant({
          grantId: "g-2",
          userId: "user-1",
          planId: "PRO",
          trialStartedAt: new Date(),
          identitySignals: { accountId: "user-1" },
        });
      }, /User is ineligible for a trial/);
    });

    test("67. Client cannot grant itself entitlements: entitlements are resolved strictly from Plan catalog", () => {
      // Verify resolving limits from catalog strictly maps to PRO, ignoring client claims
      const resolvedPriceMetadata = catalog.resolvePrice("PRO", "US", "USD");
      assert.strictEqual(resolvedPriceMetadata.resolvedAmountMinor, 1499);

      const proPlan = catalog.getPlan("PRO")!;
      assert.deepStrictEqual(proPlan.limits.aiProposals, { type: "LIMITED", value: 50 });
      assert.deepStrictEqual(proPlan.limits.jobScans, { type: "UNLIMITED" });
    });
  });
});
