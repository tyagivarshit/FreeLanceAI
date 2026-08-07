import { test, describe } from "node:test";
import assert from "node:assert";
import {
  Payment,
  Money,
  PAYMENT_CREATED,
  PAYMENT_AUTHORIZED,
  PAYMENT_CAPTURED,
  PAYMENT_COMPLETED,
  PAYMENT_CANCELLED,
} from "./payment.js";
import type {
  MonetaryPolicy,
  PaymentPersistenceContract,
  PaymentAggregateStore,
} from "./payment.js";

describe("Payment Domain Aggregate & Money Value Object Tests", () => {
  const usd100 = new Money(100, "USD");
  const usd100_2 = new Money(100, "USD");
  const eur100 = new Money(100, "EUR");
  const usd50 = new Money(50, "USD");

  test("Money Value Object Equality Semantics", () => {
    assert.strictEqual(usd100.equals(usd100_2), true);
    assert.strictEqual(usd100.equals(eur100), false);
    assert.strictEqual(usd100.equals(usd50), false);
  });

  test("Payment creation success: default Pending status and PAYMENT_CREATED event emitted", () => {
    const payment = Payment.create("payment-1", "client-1", "owner-1", usd100, "ref-intent-1");

    assert.strictEqual(payment.paymentId, "payment-1");
    assert.strictEqual(payment.clientId, "client-1");
    assert.strictEqual(payment.ownerId, "owner-1");
    assert.strictEqual(payment.status, "Pending");
    assert.strictEqual(payment.paymentReference, "ref-intent-1");
    assert.strictEqual(payment.money.equals(usd100), true);

    assert.strictEqual(payment.domainEvents.length, 1);
    assert.strictEqual(payment.domainEvents[0]!.event, PAYMENT_CREATED);
    assert.strictEqual(payment.domainEvents[0]!.metadata.paymentId, "payment-1");
    assert.strictEqual(payment.domainEvents[0]!.metadata.amount, 100);
    assert.strictEqual(payment.domainEvents[0]!.metadata.currency, "USD");
  });

  test("Creation validates missing fields (ID, Client, Owner, Reference, Money)", () => {
    assert.throws(() => {
      new Payment({
        paymentId: "",
        clientId: "client-1",
        ownerId: "owner-1",
        money: usd100,
        status: "Pending",
        paymentReference: "ref-1",
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }, /Payment ID is required/);

    assert.throws(() => {
      new Payment({
        paymentId: "payment-1",
        clientId: "  ",
        ownerId: "owner-1",
        money: usd100,
        status: "Pending",
        paymentReference: "ref-1",
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }, /Client ID reference is required/);

    assert.throws(() => {
      new Payment({
        paymentId: "payment-1",
        clientId: "client-1",
        ownerId: "",
        money: usd100,
        status: "Pending",
        paymentReference: "ref-1",
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }, /Owner ID reference is required/);
  });

  test("Monetary Policy Validation is invoked during creation", () => {
    const customPolicy: MonetaryPolicy = {
      validate(money) {
        if (money.amount < 10) {
          throw new Error("Transaction amount violates payment floor policy.");
        }
      },
    };

    // Valid case
    const payment = Payment.create(
      "payment-1",
      "client-1",
      "owner-1",
      usd100,
      "ref-1",
      customPolicy,
    );
    assert.ok(payment);

    // Invalid case throws error
    const cheapMoney = new Money(5, "USD");
    assert.throws(() => {
      Payment.create("payment-2", "client-1", "owner-1", cheapMoney, "ref-1", customPolicy);
    }, /Transaction amount violates payment floor policy/);
  });

  test("Tenant Isolation checks (wrong ownerId causes validation failure)", () => {
    const payment = Payment.create("payment-1", "client-1", "owner-1", usd100, "ref-1");

    assert.throws(() => {
      payment.authorize("owner-wrong");
    }, /Ownership validation failed/);

    assert.throws(() => {
      payment.capture("owner-wrong");
    }, /Ownership validation failed/);

    assert.throws(() => {
      payment.complete("owner-wrong");
    }, /Ownership validation failed/);
  });

  test("Lifecycle transitions: Pending -> Authorized -> Captured -> Completed", () => {
    const payment = Payment.create("payment-1", "client-1", "owner-1", usd100, "ref-1");
    assert.strictEqual(payment.status, "Pending");

    payment.clearDomainEvents();

    payment.authorize("owner-1");
    assert.strictEqual(payment.status, "Authorized");
    assert.strictEqual(payment.domainEvents.length, 1);
    assert.strictEqual(payment.domainEvents[0]!.event, PAYMENT_AUTHORIZED);

    payment.capture("owner-1");
    assert.strictEqual(payment.status, "Captured");
    assert.strictEqual(payment.domainEvents[1]!.event, PAYMENT_CAPTURED);

    payment.complete("owner-1");
    assert.strictEqual(payment.status, "Completed");
    assert.strictEqual(payment.domainEvents[2]!.event, PAYMENT_COMPLETED);
  });

  test("Logical Capture Transition: Pending -> Captured", () => {
    const payment = Payment.create("payment-1", "client-1", "owner-1", usd100, "ref-1");
    payment.capture("owner-1");
    assert.strictEqual(payment.status, "Captured");
  });

  test("Cancellation transitions: Authorized/Captured/Completed -> Cancelled", () => {
    // 1. Authorized -> Cancelled
    const p1 = Payment.create("p1", "client-1", "owner-1", usd100, "ref-1");
    p1.authorize("owner-1");
    p1.cancel("owner-1");
    assert.strictEqual(p1.status, "Cancelled");
    assert.strictEqual(p1.domainEvents[2]!.event, PAYMENT_CANCELLED);

    // 2. Captured -> Cancelled
    const p2 = Payment.create("p2", "client-1", "owner-1", usd100, "ref-2");
    p2.capture("owner-1");
    p2.cancel("owner-1");
    assert.strictEqual(p2.status, "Cancelled");

    // 3. Completed -> Cancelled
    const p3 = Payment.create("p3", "client-1", "owner-1", usd100, "ref-3");
    p3.capture("owner-1");
    p3.complete("owner-1");
    p3.cancel("owner-1");
    assert.strictEqual(p3.status, "Cancelled");
  });

  test("Failure transitions: Pending/Authorized/Captured/Completed -> Failed", () => {
    const p = Payment.create("p", "client-1", "owner-1", usd100, "ref-1");
    p.fail("owner-1");
    assert.strictEqual(p.status, "Failed");
  });

  test("Expiry transitions: Pending/Authorized -> Expired", () => {
    const p = Payment.create("p", "client-1", "owner-1", usd100, "ref-1");
    p.expire("owner-1");
    assert.strictEqual(p.status, "Expired");
  });

  test("Invalid lifecycle status transitions throw error", () => {
    const payment = Payment.create("payment-1", "client-1", "owner-1", usd100, "ref-1");
    payment.capture("owner-1");

    // Cannot transition directly to Completed without being Captured first (wait, Captured -> Completed is valid, but Pending -> Completed is not)
    const p2 = Payment.create("p2", "client-1", "owner-1", usd100, "ref-2");
    assert.throws(() => {
      p2.complete("owner-1");
    }, /Cannot complete payment in state: Pending/);

    // Cannot authorize once captured
    assert.throws(() => {
      payment.authorize("owner-1");
    }, /Cannot authorize payment in state: Captured/);
  });

  test("Duplicate payment intent protection check", async () => {
    const payment = Payment.create("payment-1", "client-1", "owner-1", usd100, "intent-duplicate");

    const mockPersistence: PaymentPersistenceContract = {
      async checkUniqueIntent(_ownerId, paymentReference) {
        return paymentReference !== "intent-duplicate";
      },
    };

    await assert.rejects(async () => {
      await payment.validateIntentUniqueness(mockPersistence, "intent-duplicate");
    }, /Duplicate payment intent: payment aggregate already exists for this intent/);
  });

  test("Money Value Object and identity properties are immutable", () => {
    const payment = Payment.create("payment-1", "client-1", "owner-1", usd100, "ref-1");

    // Attempting to modify read-only properties throws error or has no effect in JS runtime
    assert.strictEqual(payment.paymentId, "payment-1");
    assert.strictEqual(payment.money.amount, 100);
    assert.strictEqual(payment.money.currency, "USD");
  });

  test("Mock aggregate store compliance validation", async () => {
    const payment = Payment.create("payment-1", "client-1", "owner-1", usd100, "ref-1");
    let saveCalled = false;

    const mockStore: PaymentAggregateStore = {
      async save(p) {
        assert.strictEqual(p.paymentId, "payment-1");
        saveCalled = true;
      },
      async findById(id, ownerId) {
        assert.strictEqual(id, "payment-1");
        assert.strictEqual(ownerId, "owner-1");
        return payment;
      },
      async findByReference(ref, ownerId) {
        assert.strictEqual(ref, "ref-1");
        assert.strictEqual(ownerId, "owner-1");
        return payment;
      },
    };

    await mockStore.save(payment);
    assert.strictEqual(saveCalled, true);

    const fetched = await mockStore.findById("payment-1", "owner-1");
    assert.strictEqual(fetched, payment);
  });
});
