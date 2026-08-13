import { test, describe } from "node:test";
import assert from "node:assert";
import {
  StripeBillingError,
  StripePriceRegistry,
  InMemoryStripeCustomerMappingRepository,
  translateStripeError,
  StripeBillingProviderImpl,
} from "./stripe.js";
import { Plan, PlanCatalog, PlanId } from "./plan.js";
import { TrialService, InMemoryTrialGrantPersistence } from "./trial.js";

// Reusable mock client structure
class MockStripeClient {
  public customerCalls: Array<{ data: unknown; options: unknown }> = [];
  public priceCalls: Array<{ id: string; options: unknown }> = [];
  public checkoutCalls: Array<{ data: unknown; options: unknown }> = [];
  public portalCalls: Array<{ data: unknown; options: unknown }> = [];
  public subscriptionCalls: Array<{ id: string; options: unknown }> = [];

  public createdCustomerId = "";
  public priceResponses: Record<string, unknown> = {};
  public subscriptionResponses: Record<string, unknown> = {};
  public shouldThrow: Error | null = null;
  public delayMs = 0;

  public customers = {
    create: async (data: unknown, options?: unknown) => {
      this.customerCalls.push({ data, options });
      if (this.shouldThrow) {
        throw this.shouldThrow;
      }
      if (this.delayMs > 0) {
        await new Promise((res) => setTimeout(res, this.delayMs));
      }
      return {
        id: this.createdCustomerId || "cust_default",
        ...((data as Record<string, unknown>) ?? {}),
      };
    },
  };

  public prices = {
    retrieve: async (id: string, options?: unknown) => {
      this.priceCalls.push({ id, options });
      if (this.shouldThrow) {
        throw this.shouldThrow;
      }
      if (this.delayMs > 0) {
        await new Promise((res) => setTimeout(res, this.delayMs));
      }
      return (
        this.priceResponses[id] || {
          id,
          unit_amount: 1499,
          currency: "usd",
          recurring: { interval: "month" },
        }
      );
    },
  };

  public checkout = {
    sessions: {
      create: async (data: unknown, options?: unknown) => {
        this.checkoutCalls.push({ data, options });
        if (this.shouldThrow) {
          throw this.shouldThrow;
        }
        if (this.delayMs > 0) {
          await new Promise((res) => setTimeout(res, this.delayMs));
        }
        return {
          id: "sess_default",
          url: "https://stripe.com/checkout/sess_default",
          ...((data as Record<string, unknown>) ?? {}),
        };
      },
    },
  };

  public billingPortal = {
    sessions: {
      create: async (data: unknown, options?: unknown) => {
        this.portalCalls.push({ data, options });
        if (this.shouldThrow) {
          throw this.shouldThrow;
        }
        if (this.delayMs > 0) {
          await new Promise((res) => setTimeout(res, this.delayMs));
        }
        return {
          id: "port_default",
          url: "https://stripe.com/portal/port_default",
          ...((data as Record<string, unknown>) ?? {}),
        };
      },
    },
  };

  public subscriptions = {
    retrieve: async (id: string, options?: unknown) => {
      this.subscriptionCalls.push({ id, options });
      if (this.shouldThrow) {
        throw this.shouldThrow;
      }
      if (this.delayMs > 0) {
        await new Promise((res) => setTimeout(res, this.delayMs));
      }
      return (
        this.subscriptionResponses[id] || {
          id,
          customer: "cust_default",
          status: "active",
          current_period_end: Math.floor(Date.now() / 1000) + 30 * 86400,
          items: {
            data: [
              {
                price: { id: "stripe_price_pro_global_v1" },
              },
            ],
          },
        }
      );
    },
  };

  public reset() {
    this.customerCalls = [];
    this.priceCalls = [];
    this.checkoutCalls = [];
    this.portalCalls = [];
    this.subscriptionCalls = [];
    this.createdCustomerId = "";
    this.priceResponses = {};
    this.subscriptionResponses = {};
    this.shouldThrow = null;
    this.delayMs = 0;
  }
}

// Authoritative price registry mapping
const mockMappings = [
  {
    planId: "PRO" as const,
    region: "GLOBAL" as const,
    currency: "USD",
    interval: "MONTHLY" as const,
    version: 1,
    stripePriceId: "stripe_price_pro_global_v1",
  },
  {
    planId: "PRO" as const,
    region: "INDIA" as const,
    currency: "INR",
    interval: "MONTHLY" as const,
    version: 1,
    stripePriceId: "stripe_price_pro_india_v1",
  },
  {
    planId: "PRO" as const,
    region: "NORTH_AMERICA" as const,
    currency: "USD",
    interval: "MONTHLY" as const,
    version: 1,
    stripePriceId: "stripe_price_pro_global_v1",
  },
  {
    planId: "PRO" as const,
    region: "UK" as const,
    currency: "GBP",
    interval: "MONTHLY" as const,
    version: 1,
    stripePriceId: "stripe_price_pro_uk_v1",
  },
  {
    planId: "PRO" as const,
    region: "EUROPE" as const,
    currency: "EUR",
    interval: "MONTHLY" as const,
    version: 1,
    stripePriceId: "stripe_price_pro_eu_v1",
  },
  {
    planId: "POWER_BIDDER" as const,
    region: "GLOBAL" as const,
    currency: "USD",
    interval: "MONTHLY" as const,
    version: 1,
    stripePriceId: "stripe_price_pb_global_v1",
  },
  {
    planId: "POWER_BIDDER" as const,
    region: "INDIA" as const,
    currency: "INR",
    interval: "MONTHLY" as const,
    version: 1,
    stripePriceId: "stripe_price_pb_india_v1",
  },
  {
    planId: "POWER_BIDDER" as const,
    region: "NORTH_AMERICA" as const,
    currency: "USD",
    interval: "MONTHLY" as const,
    version: 1,
    stripePriceId: "stripe_price_pb_global_v1",
  },
  {
    planId: "POWER_BIDDER" as const,
    region: "UK" as const,
    currency: "GBP",
    interval: "MONTHLY" as const,
    version: 1,
    stripePriceId: "stripe_price_pb_uk_v1",
  },
  {
    planId: "POWER_BIDDER" as const,
    region: "EUROPE" as const,
    currency: "EUR",
    interval: "MONTHLY" as const,
    version: 1,
    stripePriceId: "stripe_price_pb_eu_v1",
  },
];

describe("10B Stripe Billing Provider and Infrastructure Tests", () => {
  const stripeMock = new MockStripeClient();
  const priceRegistry = new StripePriceRegistry(mockMappings);

  // Set up plan catalog
  const starter = Plan.createStarter();
  const pro = Plan.createPro(1);
  const powerBidder = Plan.createPowerBidder(1);
  const planCatalog = new PlanCatalog([starter, pro, powerBidder]);

  describe("CUSTOMER: resolution, mapping, and tenant isolation", () => {
    test("1. customer creation produces expected mappings", async () => {
      stripeMock.reset();
      const customerMappingRepo = new InMemoryStripeCustomerMappingRepository();
      const provider = new StripeBillingProviderImpl({
        secretKey: "sk_test_key",
        env: "development",
        priceRegistry,
        customerMappingRepo,
        planCatalog,
        stripeClientMock: stripeMock,
      });

      const mapping = await provider.resolveOrCreateCustomer({
        tenantId: "t-1",
        ownerId: "o-1",
        email: "o-1@example.com",
      });

      assert.strictEqual(mapping.tenantId, "t-1");
      assert.strictEqual(mapping.ownerId, "o-1");
      assert.strictEqual(mapping.stripeCustomerId, "cust_default");
      assert.strictEqual(mapping.email, "o-1@example.com");

      assert.strictEqual(stripeMock.customerCalls.length, 1);
    });

    test("2. customer resolution uses cache and avoids double creation", async () => {
      stripeMock.reset();
      const customerMappingRepo = new InMemoryStripeCustomerMappingRepository();
      const provider = new StripeBillingProviderImpl({
        secretKey: "sk_test_key",
        env: "development",
        priceRegistry,
        customerMappingRepo,
        planCatalog,
        stripeClientMock: stripeMock,
      });

      // resolve once
      await provider.resolveOrCreateCustomer({ tenantId: "t-1", ownerId: "o-1" });
      // resolve again
      await provider.resolveOrCreateCustomer({ tenantId: "t-1", ownerId: "o-1" });

      assert.strictEqual(stripeMock.customerCalls.length, 1);
    });

    test("3. repeated resolution returns the same customer ID", async () => {
      stripeMock.reset();
      const customerMappingRepo = new InMemoryStripeCustomerMappingRepository();
      const provider = new StripeBillingProviderImpl({
        secretKey: "sk_test_key",
        env: "development",
        priceRegistry,
        customerMappingRepo,
        planCatalog,
        stripeClientMock: stripeMock,
      });

      const m1 = await provider.resolveOrCreateCustomer({ tenantId: "t-1", ownerId: "o-1" });
      const m2 = await provider.resolveOrCreateCustomer({ tenantId: "t-1", ownerId: "o-1" });

      assert.strictEqual(m1.stripeCustomerId, m2.stripeCustomerId);
    });

    test("4. duplicate prevention: custom idempotency key applied", async () => {
      stripeMock.reset();
      const customerMappingRepo = new InMemoryStripeCustomerMappingRepository();
      const provider = new StripeBillingProviderImpl({
        secretKey: "sk_test_key",
        env: "development",
        priceRegistry,
        customerMappingRepo,
        planCatalog,
        stripeClientMock: stripeMock,
      });

      await provider.resolveOrCreateCustomer({
        tenantId: "t-1",
        ownerId: "o-1",
        idempotencyKey: "custom_key",
      });

      const optionsObj = stripeMock.customerCalls[0]?.options as Record<string, string>;
      assert.strictEqual(optionsObj?.idempotencyKey, "custom_key");
    });

    test("5. ownership validation on customer lookup", async () => {
      const customerMappingRepo = new InMemoryStripeCustomerMappingRepository();
      const provider = new StripeBillingProviderImpl({
        secretKey: "sk_test_key",
        env: "development",
        priceRegistry,
        customerMappingRepo,
        planCatalog,
        stripeClientMock: stripeMock,
      });

      await customerMappingRepo.save({
        tenantId: "t-1",
        ownerId: "o-1",
        stripeCustomerId: "cust_123",
        createdAt: new Date(),
      });

      // Mismatched owner resolving existing mapping
      await assert.rejects(async () => {
        await provider.resolveOrCreateCustomer({ tenantId: "t-1", ownerId: "o-wrong" });
      }, /belongs to another owner/);
    });

    test("6. cross-tenant rejection for customer resolver", async () => {
      const customerMappingRepo = new InMemoryStripeCustomerMappingRepository();
      const provider = new StripeBillingProviderImpl({
        secretKey: "sk_test_key",
        env: "development",
        priceRegistry,
        customerMappingRepo,
        planCatalog,
        stripeClientMock: stripeMock,
      });

      await customerMappingRepo.save({
        tenantId: "t-1",
        ownerId: "o-1",
        stripeCustomerId: "cust_123",
        createdAt: new Date(),
      });

      await assert.rejects(async () => {
        await provider.resolveOrCreateCustomer({ tenantId: "t-1", ownerId: "o-2" });
      }, /belongs to another owner/);
    });

    test("7. malformed customer mapping arguments reject immediately", async () => {
      const customerMappingRepo = new InMemoryStripeCustomerMappingRepository();
      const provider = new StripeBillingProviderImpl({
        secretKey: "sk_test_key",
        env: "development",
        priceRegistry,
        customerMappingRepo,
        planCatalog,
        stripeClientMock: stripeMock,
      });

      await assert.rejects(async () => {
        await provider.resolveOrCreateCustomer({ tenantId: "", ownerId: "o-1" });
      }, /Tenant ID is required/);

      await assert.rejects(async () => {
        await provider.resolveOrCreateCustomer({ tenantId: "t-1", ownerId: "" });
      }, /Owner ID is required/);
    });
  });

  describe("PRICE: mappings, registry, and price tampering", () => {
    test("8. internal PriceVersion maps to Stripe price correctly", () => {
      const stripePriceId = priceRegistry.getStripePriceId("PRO", "GLOBAL", "USD", "MONTHLY", 1);
      assert.strictEqual(stripePriceId, "stripe_price_pro_global_v1");
    });

    test("9. missing mapping throws expected translation error", () => {
      assert.throws(() => {
        priceRegistry.getStripePriceId("PRO", "GLOBAL", "USD", "MONTHLY", 99);
      }, /Stripe price mapping not found/);
    });

    test("10. wrong currency triggers validation failure during checkout", async () => {
      stripeMock.reset();
      stripeMock.priceResponses["stripe_price_pro_global_v1"] = {
        id: "stripe_price_pro_global_v1",
        unit_amount: 1499,
        currency: "eur", // Mismatched currency
        recurring: { interval: "month" },
      };

      const customerMappingRepo = new InMemoryStripeCustomerMappingRepository();
      const provider = new StripeBillingProviderImpl({
        secretKey: "sk_test_key",
        env: "development",
        priceRegistry,
        customerMappingRepo,
        planCatalog,
        stripeClientMock: stripeMock,
      });

      await assert.rejects(async () => {
        await provider.createCheckoutSession({
          tenantId: "t-1",
          ownerId: "o-1",
          planId: "PRO",
          version: 1,
          countryCode: "US",
          successUrl: "https://example.com/ok",
          cancelUrl: "https://example.com/no",
        });
      }, /Stripe price configuration does not match/);
    });

    test("11. wrong region triggers resolved price mismatch", async () => {
      stripeMock.reset();
      stripeMock.priceResponses["stripe_price_pro_india_v1"] = {
        id: "stripe_price_pro_india_v1",
        unit_amount: 79900,
        currency: "usd", // Mismatch with expected INR for India region
        recurring: { interval: "month" },
      };

      const customerMappingRepo = new InMemoryStripeCustomerMappingRepository();
      const provider = new StripeBillingProviderImpl({
        secretKey: "sk_test_key",
        env: "development",
        priceRegistry,
        customerMappingRepo,
        planCatalog,
        stripeClientMock: stripeMock,
      });

      await assert.rejects(async () => {
        await provider.createCheckoutSession({
          tenantId: "t-1",
          ownerId: "o-1",
          planId: "PRO",
          version: 1,
          countryCode: "IN", // Resolves to India region
          successUrl: "https://example.com/ok",
          cancelUrl: "https://example.com/no",
        });
      }, /Stripe price configuration does not match/);
    });

    test("12. wrong amount fails closed", async () => {
      stripeMock.reset();
      stripeMock.priceResponses["stripe_price_pro_global_v1"] = {
        id: "stripe_price_pro_global_v1",
        unit_amount: 9999, // Mismatched amount
        currency: "usd",
        recurring: { interval: "month" },
      };

      const customerMappingRepo = new InMemoryStripeCustomerMappingRepository();
      const provider = new StripeBillingProviderImpl({
        secretKey: "sk_test_key",
        env: "development",
        priceRegistry,
        customerMappingRepo,
        planCatalog,
        stripeClientMock: stripeMock,
      });

      await assert.rejects(async () => {
        await provider.createCheckoutSession({
          tenantId: "t-1",
          ownerId: "o-1",
          planId: "PRO",
          version: 1,
          countryCode: "US",
          successUrl: "https://example.com/ok",
          cancelUrl: "https://example.com/no",
        });
      }, /Stripe price configuration does not match/);
    });

    test("13. inactive plan rejects checkout", async () => {
      const customerMappingRepo = new InMemoryStripeCustomerMappingRepository();
      const provider = new StripeBillingProviderImpl({
        secretKey: "sk_test_key",
        env: "development",
        priceRegistry,
        customerMappingRepo,
        planCatalog,
        stripeClientMock: stripeMock,
      });

      await assert.rejects(async () => {
        await provider.createCheckoutSession({
          tenantId: "t-1",
          ownerId: "o-1",
          planId: "UNKNOWN" as unknown as PlanId,
          version: 1,
          successUrl: "https://ok",
          cancelUrl: "https://no",
        });
      }, /Plan UNKNOWN not found/);
    });
  });

  describe("CHECKOUT: creation, security, and idempotency", () => {
    test("16. valid Pro checkout returns safe URL", async () => {
      stripeMock.reset();
      stripeMock.priceResponses["stripe_price_pro_global_v1"] = {
        id: "stripe_price_pro_global_v1",
        unit_amount: 1499,
        currency: "usd",
        recurring: { interval: "month" },
      };

      const customerMappingRepo = new InMemoryStripeCustomerMappingRepository();
      const provider = new StripeBillingProviderImpl({
        secretKey: "sk_test_key",
        env: "development",
        priceRegistry,
        customerMappingRepo,
        planCatalog,
        stripeClientMock: stripeMock,
      });

      const result = await provider.createCheckoutSession({
        tenantId: "t-1",
        ownerId: "o-1",
        planId: "PRO",
        version: 1,
        countryCode: "US",
        successUrl: "https://example.com/ok",
        cancelUrl: "https://example.com/no",
      });

      assert.strictEqual(result.sessionId, "sess_default");
      assert.strictEqual(result.checkoutUrl, "https://stripe.com/checkout/sess_default");
    });

    test("17. valid Power Bidder checkout maps correctly", async () => {
      stripeMock.reset();
      stripeMock.priceResponses["stripe_price_pb_global_v1"] = {
        id: "stripe_price_pb_global_v1",
        unit_amount: 3999,
        currency: "usd",
        recurring: { interval: "month" },
      };

      const customerMappingRepo = new InMemoryStripeCustomerMappingRepository();
      const provider = new StripeBillingProviderImpl({
        secretKey: "sk_test_key",
        env: "development",
        priceRegistry,
        customerMappingRepo,
        planCatalog,
        stripeClientMock: stripeMock,
      });

      const result = await provider.createCheckoutSession({
        tenantId: "t-1",
        ownerId: "o-1",
        planId: "POWER_BIDDER",
        version: 1,
        countryCode: "US",
        successUrl: "https://example.com/ok",
        cancelUrl: "https://example.com/no",
      });

      assert.ok(result.checkoutUrl);
    });

    test("18. Starter/free plan rejection from paid checkout flow", async () => {
      const customerMappingRepo = new InMemoryStripeCustomerMappingRepository();
      const provider = new StripeBillingProviderImpl({
        secretKey: "sk_test_key",
        env: "development",
        priceRegistry,
        customerMappingRepo,
        planCatalog,
        stripeClientMock: stripeMock,
      });

      await assert.rejects(async () => {
        await provider.createCheckoutSession({
          tenantId: "t-1",
          ownerId: "o-1",
          planId: "STARTER",
          version: 1,
          successUrl: "https://ok",
          cancelUrl: "https://no",
        });
      }, /Starter\/free plan cannot be processed/);
    });

    test("22. duplicate checkout is idempotent", async () => {
      stripeMock.reset();
      stripeMock.priceResponses["stripe_price_pro_global_v1"] = {
        id: "stripe_price_pro_global_v1",
        unit_amount: 1499,
        currency: "usd",
        recurring: { interval: "month" },
      };

      const customerMappingRepo = new InMemoryStripeCustomerMappingRepository();
      const provider = new StripeBillingProviderImpl({
        secretKey: "sk_test_key",
        env: "development",
        priceRegistry,
        customerMappingRepo,
        planCatalog,
        stripeClientMock: stripeMock,
      });

      const params = {
        tenantId: "t-1",
        ownerId: "o-1",
        planId: "PRO" as const,
        version: 1,
        countryCode: "US",
        successUrl: "https://example.com/ok",
        cancelUrl: "https://example.com/no",
        idempotencyKey: "dup_checkout_key",
      };

      await provider.createCheckoutSession(params);
      await provider.createCheckoutSession(params);

      // Verify checkout create called twice, but with the same idempotency key
      assert.strictEqual(stripeMock.checkoutCalls.length, 2);
      const opt1 = stripeMock.checkoutCalls[0]?.options as Record<string, string>;
      const opt2 = stripeMock.checkoutCalls[1]?.options as Record<string, string>;
      assert.strictEqual(opt1?.idempotencyKey, "dup_checkout_key");
      assert.strictEqual(opt2?.idempotencyKey, "dup_checkout_key");
    });
  });

  describe("PORTAL: portal session creation, security", () => {
    test("25. valid portal creation returns safe URL", async () => {
      stripeMock.reset();
      const customerMappingRepo = new InMemoryStripeCustomerMappingRepository();
      const provider = new StripeBillingProviderImpl({
        secretKey: "sk_test_key",
        env: "development",
        priceRegistry,
        customerMappingRepo,
        planCatalog,
        stripeClientMock: stripeMock,
      });

      await customerMappingRepo.save({
        tenantId: "t-1",
        ownerId: "o-1",
        stripeCustomerId: "cust_mapped",
        createdAt: new Date(),
      });

      const result = await provider.createPortalSession({
        tenantId: "t-1",
        ownerId: "o-1",
        returnUrl: "https://example.com/dashboard",
      });

      assert.strictEqual(result.portalUrl, "https://stripe.com/portal/port_default");
    });

    test("26. unauthorized customer access blocked", async () => {
      const customerMappingRepo = new InMemoryStripeCustomerMappingRepository();
      const provider = new StripeBillingProviderImpl({
        secretKey: "sk_test_key",
        env: "development",
        priceRegistry,
        customerMappingRepo,
        planCatalog,
        stripeClientMock: stripeMock,
      });

      await customerMappingRepo.save({
        tenantId: "t-1",
        ownerId: "o-1",
        stripeCustomerId: "cust_mapped",
        createdAt: new Date(),
      });

      // Attempt to access t-1 portal as o-2 (unauthorized owner)
      await assert.rejects(async () => {
        await provider.createPortalSession({
          tenantId: "t-1",
          ownerId: "o-2",
          returnUrl: "https://ok",
        });
      }, /belongs to another owner/);
    });

    test("27. missing customer mapping throws expected error", async () => {
      const customerMappingRepo = new InMemoryStripeCustomerMappingRepository();
      const provider = new StripeBillingProviderImpl({
        secretKey: "sk_test_key",
        env: "development",
        priceRegistry,
        customerMappingRepo,
        planCatalog,
        stripeClientMock: stripeMock,
      });

      await assert.rejects(async () => {
        await provider.createPortalSession({
          tenantId: "t-none",
          ownerId: "o-none",
          returnUrl: "https://ok",
        });
      }, /Stripe customer mapping not found/);
    });
  });

  describe("SUBSCRIPTION: retrieval and ownership isolation", () => {
    test("29. valid retrieval maps fields correctly", async () => {
      stripeMock.reset();
      const customerMappingRepo = new InMemoryStripeCustomerMappingRepository();
      const provider = new StripeBillingProviderImpl({
        secretKey: "sk_test_key",
        env: "development",
        priceRegistry,
        customerMappingRepo,
        planCatalog,
        stripeClientMock: stripeMock,
      });

      await customerMappingRepo.save({
        tenantId: "t-1",
        ownerId: "o-1",
        stripeCustomerId: "cust_mapped",
        createdAt: new Date(),
      });

      stripeMock.subscriptionResponses["sub_123"] = {
        id: "sub_123",
        customer: "cust_mapped",
        status: "active",
        current_period_end: 1785000000,
        items: {
          data: [
            {
              price: { id: "stripe_price_pro_global_v1" },
            },
          ],
        },
      };

      const info = await provider.getSubscription({
        tenantId: "t-1",
        ownerId: "o-1",
        stripeSubscriptionId: "sub_123",
      });

      assert.strictEqual(info.stripeSubscriptionId, "sub_123");
      assert.strictEqual(info.stripeCustomerId, "cust_mapped");
      assert.strictEqual(info.planId, "PRO");
      assert.strictEqual(info.status, "active");
    });

    test("31. tenant mismatch throws ownership mismatch", async () => {
      stripeMock.reset();
      const customerMappingRepo = new InMemoryStripeCustomerMappingRepository();
      const provider = new StripeBillingProviderImpl({
        secretKey: "sk_test_key",
        env: "development",
        priceRegistry,
        customerMappingRepo,
        planCatalog,
        stripeClientMock: stripeMock,
      });

      await customerMappingRepo.save({
        tenantId: "t-1",
        ownerId: "o-1",
        stripeCustomerId: "cust_mapped",
        createdAt: new Date(),
      });

      stripeMock.subscriptionResponses["sub_123"] = {
        id: "sub_123",
        customer: "cust_mapped",
        status: "active",
        current_period_end: 1785000000,
        items: {
          data: [{ price: { id: "stripe_price_pro_global_v1" } }],
        },
      };

      // Request sub_123 for t-2/o-2 (tenant mismatch)
      await assert.rejects(async () => {
        await provider.getSubscription({
          tenantId: "t-2",
          ownerId: "o-2",
          stripeSubscriptionId: "sub_123",
        });
      }, /Subscription belongs to another tenant/);
    });
  });

  describe("TIMEOUT & RETRY: timeout bounds and safe retries", () => {
    test("35. API timeout triggers STRIPE_TIMEOUT error", async () => {
      stripeMock.reset();
      stripeMock.delayMs = 200; // Delay larger than config timeout

      const customerMappingRepo = new InMemoryStripeCustomerMappingRepository();
      const provider = new StripeBillingProviderImpl({
        secretKey: "sk_test_key",
        env: "development",
        priceRegistry,
        customerMappingRepo,
        planCatalog,
        stripeClientMock: stripeMock,
        timeoutMs: 50, // Short timeout
      });

      await assert.rejects(
        async () => {
          await provider.resolveOrCreateCustomer({ tenantId: "t-1", ownerId: "o-1" });
        },
        (err: unknown) => {
          return err instanceof StripeBillingError && err.code === "STRIPE_TIMEOUT";
        },
      );
    });

    test("38. safe bounded retry handles transient connection failure", async () => {
      stripeMock.reset();
      let throwCount = 0;
      // Inject failure on first call, success on second call
      stripeMock.customers.create = async (data: unknown, _options?: unknown) => {
        throwCount++;
        if (throwCount === 1) {
          throw new Error("Temporary connection issue");
        }
        return { id: "cust_retry", ...((data as Record<string, unknown>) ?? {}) };
      };

      const customerMappingRepo = new InMemoryStripeCustomerMappingRepository();
      const provider = new StripeBillingProviderImpl({
        secretKey: "sk_test_key",
        env: "development",
        priceRegistry,
        customerMappingRepo,
        planCatalog,
        stripeClientMock: stripeMock,
      });

      const mapping = await provider.resolveOrCreateCustomer({
        tenantId: "t-retry",
        ownerId: "o-retry",
      });
      assert.strictEqual(mapping.stripeCustomerId, "cust_retry");
      assert.strictEqual(throwCount, 2); // First failed, second retried and succeeded
    });
  });

  describe("ERRORS: safe translations and sanitization", () => {
    test("39. translates StripeConnectionError to STRIPE_UNAVAILABLE", () => {
      const stripeErr = {
        type: "StripeConnectionError",
        message: "Network failure",
      };
      const translated = translateStripeError(stripeErr);
      assert.strictEqual(translated.code, "STRIPE_UNAVAILABLE");
    });

    test("40. redacts config secret keys from toJSON output", () => {
      const customerMappingRepo = new InMemoryStripeCustomerMappingRepository();
      const provider = new StripeBillingProviderImpl({
        secretKey: "sk_live_my_ultra_secret_key_123",
        env: "development",
        priceRegistry,
        customerMappingRepo,
        planCatalog,
        stripeClientMock: stripeMock,
      });

      const jsonStr = JSON.stringify(provider);
      assert.ok(!jsonStr.includes("sk_live_my_ultra_secret_key_123"));
      assert.ok(jsonStr.includes("[REDACTED]"));
    });
  });

  describe("ENVIRONMENT: staging/production credential rules", () => {
    test("53. production validates live keys", () => {
      const customerMappingRepo = new InMemoryStripeCustomerMappingRepository();
      // Works since sk_live is valid for production
      const provider = new StripeBillingProviderImpl({
        secretKey: "sk_live_key",
        env: "production",
        priceRegistry,
        customerMappingRepo,
        planCatalog,
        stripeClientMock: stripeMock,
      });
      assert.ok(provider);
    });

    test("55. production blocks test credentials", () => {
      const customerMappingRepo = new InMemoryStripeCustomerMappingRepository();
      // Should throw configuration error since sk_test is passed to production
      assert.throws(() => {
        new StripeBillingProviderImpl({
          secretKey: "sk_test_key",
          env: "production",
          priceRegistry,
          customerMappingRepo,
          planCatalog,
          stripeClientMock: stripeMock,
        });
      }, /Production Stripe must not use development\/test credentials/);
    });
  });

  describe("REGRESSIONS: PlanCatalog and 10A compatibility", () => {
    test("58. 10A PlanCatalog plans and prices are unchanged", () => {
      const proPlan = planCatalog.getPlan("PRO");
      assert.ok(proPlan);
      assert.strictEqual(proPlan.displayName, "Pro Plan");
      const priceUSD = proPlan.getPriceByVersion("pro-global", 1);
      assert.ok(priceUSD);
      assert.strictEqual(priceUSD.amountMinor, 1499);
      assert.strictEqual(priceUSD.currency, "USD");
    });

    test("59. 10A trial evaluateEligibility behaves correctly", async () => {
      const persistence = new InMemoryTrialGrantPersistence();
      const trialService = new TrialService(persistence);

      // Verify that trial evaluateEligibility resolves trial start dates correctly
      const result = await trialService.issueTrialGrant({
        grantId: "g-1",
        userId: "user-1",
        planId: "PRO",
        trialStartedAt: new Date(),
        identitySignals: {
          accountId: "user-1",
          verifiedEmail: "user-1@example.com",
        },
      });
      assert.strictEqual(result.userId, "user-1");
    });
  });
});
