const fs = require('fs');
let code = fs.readFileSync('packages/core/src/payment.test.ts', 'utf8');

code = code.replace(
  'test("Cancellation transitions: Authorized/Captured/Completed -> Cancelled", () => {',
  'test("Cancellation transitions: Authorized/Captured -> Cancelled", () => {'
);

code = code.replace(
  `    // 3. Completed -> Cancelled
    const p3 = Payment.create("p3", "tenant-1", "client-1", "owner-1", usd100, "ref-3");
    p3.capture("owner-1");
    p3.complete("owner-1");
    p3.cancel("owner-1");
    assert.strictEqual(p3.status, "Cancelled");`,
  `    // 3. Completed -> Cancelled (SHOULD THROW)
    const p3 = Payment.create("p3", "tenant-1", "client-1", "owner-1", usd100, "ref-3");
    p3.capture("owner-1");
    p3.complete("owner-1");
    assert.throws(() => {
      p3.cancel("owner-1");
    }, /Cannot cancel payment in state: Completed/);`
);

code = code.replace(
  'test("Failure transitions: Pending/Authorized/Captured/Completed -> Failed", () => {',
  'test("Failure transitions: Pending/Authorized/Captured -> Failed", () => {'
);

code = code.replace(
  `  test("Failure transitions: Pending/Authorized/Captured -> Failed", () => {
    const p = Payment.create("p", "tenant-1", "client-1", "owner-1", usd100, "ref-1");
    p.fail("owner-1");
    assert.strictEqual(p.status, "Failed");
  });`,
  `  test("Failure transitions: Pending/Authorized/Captured -> Failed", () => {
    const p = Payment.create("p", "tenant-1", "client-1", "owner-1", usd100, "ref-1");
    p.fail("owner-1");
    assert.strictEqual(p.status, "Failed");
    
    const p2 = Payment.create("p2", "tenant-1", "client-1", "owner-1", usd100, "ref-2");
    p2.capture("owner-1");
    p2.complete("owner-1");
    assert.throws(() => {
      p2.fail("owner-1");
    }, /Cannot mark payment as failed in state: Completed/);
  });`
);

fs.writeFileSync('packages/core/src/payment.test.ts', code);
console.log("Patched payment.test.ts");
