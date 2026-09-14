import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import crypto from "crypto";
import { db, users, emailVerifications } from "@freelanceos/db";
import { verifyEmailToken, InvalidVerificationTokenError, VerificationTokenExpiredError, VerificationTokenAlreadyConsumedError, UserNotFoundError, } from "./verify-email.js";
const originalSelect = db.select;
const originalTransaction = db.transaction;
describe("Email Verification Use Case Tests", () => {
    let updateCalls = [];
    beforeEach(() => {
        updateCalls = [];
    });
    afterEach(() => {
        db.select = originalSelect;
        db.transaction = originalTransaction;
    });
    test("1. Rejects missing or empty verification tokens", async () => {
        await assert.rejects(async () => {
            await verifyEmailToken("");
        }, InvalidVerificationTokenError);
        await assert.rejects(async () => {
            // @ts-expect-error testing runtime validation
            await verifyEmailToken(null);
        }, InvalidVerificationTokenError);
    });
    test("2. Rejects unknown or unrecorded token hash", async () => {
        // Mock db.select returning empty array
        // @ts-expect-error override read-only select for unit testing
        db.select = function () {
            return {
                from: () => ({
                    where: () => ({
                        limit: () => Promise.resolve([]),
                    }),
                }),
            };
        };
        await assert.rejects(async () => {
            await verifyEmailToken("unknown-token-1234567890abcdef");
        }, InvalidVerificationTokenError);
    });
    test("3. Rejects already consumed verification token", async () => {
        const rawToken = "valid-raw-token-1234567890abcdef";
        const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
        const mockVerificationRecord = {
            id: "ver-1",
            userId: "user-1",
            tokenHash,
            expiresAt: new Date(Date.now() + 86400000),
            consumedAt: new Date(Date.now() - 3600000), // already consumed
            attemptCount: 1,
        };
        // @ts-expect-error override read-only select for unit testing
        db.select = function () {
            return {
                from: () => ({
                    where: () => ({
                        limit: () => Promise.resolve([mockVerificationRecord]),
                    }),
                }),
            };
        };
        await assert.rejects(async () => {
            await verifyEmailToken(rawToken);
        }, VerificationTokenAlreadyConsumedError);
    });
    test("4. Rejects expired verification token", async () => {
        const rawToken = "expired-raw-token-1234567890abcdef";
        const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
        const mockVerificationRecord = {
            id: "ver-2",
            userId: "user-2",
            tokenHash,
            expiresAt: new Date(Date.now() - 3600000), // expired 1 hour ago
            consumedAt: null,
            attemptCount: 0,
        };
        // @ts-expect-error override read-only select for unit testing
        db.select = function () {
            return {
                from: () => ({
                    where: () => ({
                        limit: () => Promise.resolve([mockVerificationRecord]),
                    }),
                }),
            };
        };
        await assert.rejects(async () => {
            await verifyEmailToken(rawToken);
        }, VerificationTokenExpiredError);
    });
    test("5. Rejects if associated user cannot be found", async () => {
        const rawToken = "orphan-raw-token-1234567890abcdef";
        const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
        const mockVerificationRecord = {
            id: "ver-3",
            userId: "user-nonexistent",
            tokenHash,
            expiresAt: new Date(Date.now() + 86400000),
            consumedAt: null,
            attemptCount: 0,
        };
        let callCount = 0;
        // @ts-expect-error override read-only select for unit testing
        db.select = function () {
            return {
                from: (_table) => ({
                    where: () => ({
                        limit: () => {
                            callCount++;
                            if (callCount === 1) {
                                return Promise.resolve([mockVerificationRecord]);
                            }
                            return Promise.resolve([]); // User not found
                        },
                    }),
                }),
            };
        };
        await assert.rejects(async () => {
            await verifyEmailToken(rawToken);
        }, UserNotFoundError);
    });
    test("6. Successfully verifies token and transitions user status to active", async () => {
        const rawToken = "valid-unconsumed-token-1234567890abcdef";
        const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
        const mockVerificationRecord = {
            id: "ver-4",
            userId: "user-4",
            tokenHash,
            expiresAt: new Date(Date.now() + 86400000),
            consumedAt: null,
            attemptCount: 0,
        };
        const mockUserRecord = {
            id: "user-4",
            email: "test@freelanceos.com",
            status: "pending",
            emailVerifiedAt: null,
        };
        let callCount = 0;
        // @ts-expect-error override read-only select for unit testing
        db.select = function () {
            return {
                from: () => ({
                    where: () => ({
                        limit: () => {
                            callCount++;
                            if (callCount === 1) {
                                return Promise.resolve([mockVerificationRecord]);
                            }
                            return Promise.resolve([mockUserRecord]);
                        },
                    }),
                }),
            };
        };
        db.transaction = async function (callback) {
            const mockTx = {
                update: (table) => ({
                    set: (setValues) => ({
                        where: (whereClause) => {
                            updateCalls.push({ table, setValues, whereClause });
                            return Promise.resolve();
                        },
                    }),
                }),
            };
            return await callback(mockTx);
        };
        const result = await verifyEmailToken(rawToken);
        assert.strictEqual(result.success, true);
        assert.strictEqual(result.userId, "user-4");
        assert.strictEqual(result.email, "test@freelanceos.com");
        assert.strictEqual(updateCalls.length, 2);
        // 1st update: emailVerifications.consumedAt
        assert.strictEqual(updateCalls[0]?.table, emailVerifications);
        assert.ok(updateCalls[0]?.setValues?.consumedAt instanceof Date);
        // 2nd update: users.status and emailVerifiedAt
        assert.strictEqual(updateCalls[1]?.table, users);
        assert.strictEqual(updateCalls[1]?.setValues?.status, "active");
        assert.ok(updateCalls[1]?.setValues?.emailVerifiedAt instanceof Date);
    });
});
