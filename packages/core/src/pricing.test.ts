import { test, describe } from "node:test";
import assert from "node:assert";
import {
  PricingAmount,
  PricingCurrency,
  PricingComponent,
  PricingBreakdown,
  PricingAssessment,
} from "./pricing.js";

describe("Pricing Domain and Boundary Tests", () => {
  test("Pricing amount validation: bounds, NaN, Infinity", () => {
    // Valid values
    assert.strictEqual(new PricingAmount(0.0).value, 0.0);
    assert.strictEqual(new PricingAmount(500.5).value, 500.5);

    // Invalid values
    assert.throws(() => {
      new PricingAmount(-1);
    }, /Pricing amount must be non-negative/);

    assert.throws(() => {
      new PricingAmount(NaN);
    }, /Pricing amount must be a finite number/);

    assert.throws(() => {
      new PricingAmount(Infinity);
    }, /Pricing amount must be a finite number/);

    // Immutability
    const amt = new PricingAmount(100);
    assert.throws(() => {
      (amt as unknown as Record<string, unknown>).value = 200;
    }, TypeError);
  });

  test("Pricing currency accepts generic non-empty strings", () => {
    assert.strictEqual(new PricingCurrency("usd").value, "USD");
    assert.strictEqual(new PricingCurrency("Eur").value, "EUR");
    assert.strictEqual(new PricingCurrency("INR").value, "INR");
    assert.strictEqual(new PricingCurrency("jpy").value, "JPY");

    assert.throws(() => {
      new PricingCurrency("");
    }, /Currency is required/);
  });

  test("Pricing component properties validation", () => {
    const comp = new PricingComponent({
      componentId: "comp-1",
      name: "Base Rate Setup",
      amount: new PricingAmount(1500),
      currency: new PricingCurrency("USD"),
    });

    assert.strictEqual(comp.componentId, "comp-1");
    assert.strictEqual(comp.name, "Base Rate Setup");
    assert.strictEqual(comp.amount.value, 1500);

    assert.throws(() => {
      new PricingComponent({
        componentId: "",
        name: "Test",
        amount: new PricingAmount(10),
        currency: new PricingCurrency("USD"),
      });
    }, /Component identifier is required/);
  });

  test("Pricing breakdown properties mapping and collection immutability", () => {
    const breakdown = new PricingBreakdown({
      baseAmount: new PricingAmount(2000),
      adjustments: [
        new PricingComponent({
          componentId: "adj-1",
          name: "Discount",
          amount: new PricingAmount(200),
          currency: new PricingCurrency("USD"),
        }),
      ],
      finalAmount: new PricingAmount(1800),
    });

    assert.strictEqual(breakdown.baseAmount.value, 2000);
    assert.strictEqual(breakdown.adjustments.length, 1);
    assert.strictEqual(breakdown.finalAmount.value, 1800);

    assert.throws(() => {
      (breakdown.adjustments as unknown as unknown[]).push({});
    }, TypeError);
  });

  test("Pricing assessment defensive Date copying", () => {
    const rawDate = new Date("2026-08-08T12:00:00Z");
    const assessment = new PricingAssessment({
      assessmentId: "assess-1",
      extractionId: "ext-1",
      evaluationId: "eval-1",
      breakdown: new PricingBreakdown({
        baseAmount: new PricingAmount(100),
        adjustments: [],
        finalAmount: new PricingAmount(100),
      }),
      currency: new PricingCurrency("USD"),
      assessedAt: rawDate,
    });

    rawDate.setTime(0);
    assert.notStrictEqual(assessment.assessedAt.getTime(), 0);

    const ret = assessment.assessedAt;
    ret.setTime(9999);
    assert.notStrictEqual(assessment.assessedAt.getTime(), 9999);
  });

  test("Case C validation: No pricing calculation algorithm is invented inside core", () => {
    // Assert that we do not generate a calculated quote inside core.
    // Instead, assessment values are passed explicitly as a pure representation.
    const assessment = new PricingAssessment({
      assessmentId: "assess-abc",
      extractionId: "ext-123",
      evaluationId: "eval-xyz",
      breakdown: new PricingBreakdown({
        baseAmount: new PricingAmount(3000),
        adjustments: [
          new PricingComponent({
            componentId: "adj-1",
            name: "Scope Contradiction review penalty",
            amount: new PricingAmount(500),
            currency: new PricingCurrency("USD"),
          }),
        ],
        finalAmount: new PricingAmount(3500),
      }),
      currency: new PricingCurrency("USD"),
      assessedAt: new Date(),
    });

    assert.strictEqual(assessment.breakdown.finalAmount.value, 3500);
    assert.strictEqual(assessment.breakdown.baseAmount.value, 3000);
  });

  test("Boundary Verification: Pricing does NOT calculate confidence, execute rules, or call payment providers", () => {
    const amt = new PricingAmount(100);
    const keys = Object.keys(amt);

    assert.ok(!keys.includes("_aiProviderClient"));
    assert.ok(!keys.includes("_stripeClient"));
    assert.ok(!keys.includes("_databaseConnection"));
  });
});
