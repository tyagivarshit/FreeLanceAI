const fs = require('fs');
let code = fs.readFileSync('packages/core/src/payment.test.ts', 'utf8');

code = code.replace(
  '    // 3. Completed -> Cancelled\\n    const p3 = Payment.create("p3", "tenant-1", "client-1", "owner-1", usd100, "ref-3");\\n    p3.capture("owner-1");\\n    p3.complete("owner-1");\\n    p3.cancel("owner-1");\\n    assert.strictEqual(p3.status, "Cancelled");',
  '    // 3. Completed -> Cancelled (SHOULD THROW)\\n    const p3 = Payment.create("p3", "tenant-1", "client-1", "owner-1", usd100, "ref-3");\\n    p3.capture("owner-1");\\n    p3.complete("owner-1");\\n    assert.throws(() => {\\n      p3.cancel("owner-1");\\n    }, /Cannot cancel payment in state: Completed/);'
);

// Fallback if the strict replacement didn't work
code = code.replace(
  /p3\.cancel\("owner-1"\);\s*assert\.strictEqual\(p3\.status, "Cancelled"\);/,
  `assert.throws(() => {
      p3.cancel("owner-1");
    }, /Cannot cancel payment in state: Completed/);`
);

code = code.replace(
  /const fetched = await mockStore\.findById\("payment-1", "owner-1"\);/,
  'const fetched = await mockStore.findById("payment-1", "tenant-1");'
);

fs.writeFileSync('packages/core/src/payment.test.ts', code);
