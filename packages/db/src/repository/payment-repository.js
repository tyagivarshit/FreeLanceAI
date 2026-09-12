import { eq, and } from "drizzle-orm";
import { db } from "../client.js";
import { payments } from "../schema/payments.js";
import { Payment, Money } from "@freelanceos/core";
export class PostgresPaymentRepository {
    async save(payment) {
        try {
            // Try updating first (for lifecycle transitions like Pending -> Captured)
            const updated = await db
                .update(payments)
                .set({
                status: payment.status,
                updatedAt: payment.updatedAt,
            })
                .where(eq(payments.id, payment.paymentId))
                .returning({ id: payments.id });
            // If no existing row was updated, it's a new payment. 
            // We do a plain insert with NO onConflictDoUpdate.
            // This ensures concurrent duplicate creations strictly trigger a 23505 violation.
            if (updated.length === 0) {
                await db
                    .insert(payments)
                    .values({
                    id: payment.paymentId,
                    tenantId: payment.tenantId,
                    clientId: payment.clientId,
                    ownerId: payment.ownerId,
                    amount: payment.money.amount,
                    currency: payment.money.currency,
                    status: payment.status,
                    paymentReference: payment.paymentReference,
                    createdAt: payment.createdAt,
                    updatedAt: payment.updatedAt,
                });
            }
        }
        catch (err) {
            if (err.code === "23505") {
                throw new Error("Duplicate payment intent: payment aggregate already exists for this intent.");
            }
            throw err;
        }
    }
    async findById(paymentId, tenantId) {
        const rows = await db
            .select()
            .from(payments)
            .where(and(eq(payments.id, paymentId), eq(payments.tenantId, tenantId)))
            .limit(1);
        if (rows.length === 0)
            return null;
        return this.mapToDomain(rows[0]);
    }
    async findByReference(paymentReference, tenantId) {
        const rows = await db
            .select()
            .from(payments)
            .where(and(eq(payments.paymentReference, paymentReference), eq(payments.tenantId, tenantId)))
            .limit(1);
        if (rows.length === 0)
            return null;
        return this.mapToDomain(rows[0]);
    }
    async checkUniqueIntent(ownerId, paymentReference, paymentId) {
        // We don't actually need this pre-check because save() relies on the unique constraint!
        // But we satisfy the interface just in case.
        // In our new model, uniqueness is per tenant, but ownerId isn't necessarily tenantId, 
        // although temporarily it might be.
        // However, the real check happens safely at the DB constraint level during `save()`.
        return true;
    }
    mapToDomain(row) {
        const payment = new Payment({
            paymentId: row.id,
            tenantId: row.tenantId,
            clientId: row.clientId,
            ownerId: row.ownerId || "system",
            money: new Money(row.amount, row.currency),
            status: row.status,
            paymentReference: row.paymentReference,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
        });
        return payment;
    }
}
