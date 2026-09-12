import os

path = 'packages/db/src/index.ts'
with open(path, 'r', encoding='utf8') as f:
    c = f.read()

c = c.replace('// Export Payments Domain Schemas\n', '')
c = c.replace('export { payments } from "./schema/payments.js";\n', '')
c = c.replace('export type { PaymentRow, PaymentInsert } from "./schema/payments.js";\n', '')
c = c.replace('export { PostgresPaymentRepository } from "./repository/payment-repository.js";\n', '')

with open(path, 'w', encoding='utf8') as f:
    f.write(c)

print('Updated index.ts')
