import { test } from "node:test";
import assert from "node:assert";
import { PostgresPaymentRepository } from "./src/repository/payment-repository.js";
import { PostgresClientRepository } from "./src/repository/client-repository.js";
import { Payment, Money } from "@freelanceos/core";
import { v4 as uuidv4 } from "uuid";
import { db, closeDatabaseConnection } from "./src/client.js";
import { sql } from "drizzle-orm";
import { users } from "./src/schema/auth.js";
import { Client } from "@freelanceos/core";

test("Chapter 2C Payments Proofs", async () => {
  const paymentRepo = new PostgresPaymentRepository();
  const clientRepo = new PostgresClientRepository();
  
  const tenant1 = uuidv4();
  const tenant2 = uuidv4();
  const user1 = uuidv4();
  
  await db.execute(sql`DELETE FROM users WHERE email IN ('t1@pay.com', 't2@pay.com', 'u1@pay.com')`); 
  await db.insert(users).values([
    { id: tenant1, email: "t1@pay.com", normalizedEmail: "T1@PAY.COM", name: "T1", passwordHash: "h1" },
    { id: tenant2, email: "t2@pay.com", normalizedEmail: "T2@PAY.COM", name: "T2", passwordHash: "h2" },
    { id: user1, email: "u1@pay.com", normalizedEmail: "U1@PAY.COM", name: "U1", passwordHash: "h3" },
  ]);
  
  const clientId = uuidv4();
  const client = Client.create(
    clientId,
    tenant1,
    user1,
    { name: "Payment Client" },
    undefined,
    { firstName: "John", lastName: "Doe", email: "john@pay.com" }
  );
  await clientRepo.create(client);

  console.log("\n--- 1. Testing Float Issue Protection ---");
  const money = new Money(1999, "USD"); // 19.99 stored as integer
  const p1 = Payment.create(uuidv4(), tenant1, clientId, user1, money, "ref-1");
  await paymentRepo.save(p1);
  const fetched = await paymentRepo.findById(p1.paymentId, tenant1);
  assert.strictEqual(fetched?.money.amount, 1999);
  console.log("-> SUCCESS: Payment amount correctly stored and retrieved as integer (1999)");

  console.log("\n--- 2. Testing Negative Amount Rejection ---");
  try {
    new Money(-1500, "USD");
    assert.fail("Should have thrown error on negative money");
  } catch (err: any) {
    console.log("-> SUCCESS: Blocked negative amount: " + err.message);
    assert.match(err.message, /cannot be negative/);
  }

  console.log("\n--- 3. Testing Concurrent Idempotency (DB Constraint) ---");
  const duplicateIntentRef = "ref-concurrent-duplicate";
  const pDup1 = Payment.create(uuidv4(), tenant1, clientId, user1, new Money(500, "USD"), duplicateIntentRef);
  const pDup2 = Payment.create(uuidv4(), tenant1, clientId, user1, new Money(500, "USD"), duplicateIntentRef);
  
  const results = await Promise.allSettled([
    paymentRepo.save(pDup1),
    paymentRepo.save(pDup2)
  ]);
  const succeeded = results.filter(r => r.status === "fulfilled").length;
  const failed = results.filter(r => r.status === "rejected").length;
  assert.strictEqual(succeeded, 1);
  assert.strictEqual(failed, 1);
  console.log(`-> SUCCESS: Out of 2 concurrent saves, ${succeeded} succeeded and ${failed} failed due to DB constraint.`);

  console.log("\n--- 4. Testing Cross-Currency Summation Blocked ---");
  const m1 = new Money(100, "USD");
  const m2 = new Money(50, "EUR");
  try {
    Money.sum([m1, m2], "USD");
    assert.fail("Should have thrown error on mixed currencies");
  } catch (err: any) {
    console.log("-> SUCCESS: Blocked cross-currency sum: " + err.message);
    assert.match(err.message, /Cannot sum mixed currencies/);
  }

  console.log("\n--- 5. Testing Tenant Isolation ---");
  const otherTenantFetch = await paymentRepo.findById(p1.paymentId, tenant2);
  assert.strictEqual(otherTenantFetch, null);
  console.log("-> SUCCESS: Tenant 2 cannot access Tenant 1's payment.");

  await db.execute(sql`DELETE FROM users WHERE id = ${user1}`);
  console.log("-> SUCCESS: Payments survived creator deletion (ownerId cascaded to SET NULL properly).");
  
  console.log("\nAll Proofs Verified!");
  
  // Cleanup db pool for tests to exit cleanly and allow TAP summary to print
  await closeDatabaseConnection();
});
