import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import { db, users, userPasswordHashes, emailVerifications } from "@freelanceos/db";
import { runtimeConfig } from "@freelanceos/config";
import { signupUser, ValidationError, DuplicateEmailError } from "./signup.js";
// Keep references to original db methods to restore them after tests
const originalSelect = db.select;
const originalTransaction = db.transaction;
describe("Signup Use Case Validation & Mock Flow Tests", () => {
    let selectMockResult = [];
    let transactionCalled = false;
    let insertedRecords = [];
    beforeEach(() => {
        selectMockResult = [];
        transactionCalled = false;
        insertedRecords = [];
        // Override db.select to mock database presence checks
        // @ts-expect-error db.select is read-only
        db.select = function () {
            return {
                from: () => ({
                    where: () => ({
                        limit: () => Promise.resolve(selectMockResult),
                    }),
                }),
            };
        };
        // Override db.transaction to mock transactional insertions
        db.transaction = async function (callback) {
            transactionCalled = true;
            const mockTx = {
                insert: (table) => ({
                    values: (values) => {
                        insertedRecords.push({ table, values });
                        const promiseResult = Promise.resolve([{ id: "mock-id" }]);
                        // Add returning function to the promise so it can be chained
                        // @ts-expect-error returning is not typed on native Promise
                        promiseResult.returning = () => {
                            if (table === users) {
                                return Promise.resolve([
                                    {
                                        id: "mock-user-uuid",
                                        email: values.email,
                                        status: values.status,
                                        createdAt: new Date(),
                                    },
                                ]);
                            }
                            return promiseResult;
                        };
                        return promiseResult;
                    },
                }),
            };
            return await callback(mockTx);
        };
    });
    afterEach(() => {
        // Restore db methods
        db.select = originalSelect;
        db.transaction = originalTransaction;
    });
    test("should throw ValidationError if password is too short", async () => {
        // Force configuration thresholds for validation
        // @ts-expect-error runtimeConfig properties are read-only
        runtimeConfig.CONFIG_PASSWORD_MIN_LENGTH = 12;
        await assert.rejects(signupUser({
            email: "valid@example.com",
            password: "short",
        }), (err) => {
            assert.ok(err instanceof ValidationError);
            assert.ok(err.errors.some((e) => e.includes("at least 12 characters")));
            return true;
        });
    });
    test("should throw DuplicateEmailError if user exists and anti-enumeration is disabled", async () => {
        // Mock that a user already exists with this email
        selectMockResult = [
            {
                id: "existing-uuid",
                email: "existing@example.com",
                normalizedEmail: "existing@example.com",
                status: "active",
                createdAt: new Date(),
            },
        ];
        // Ensure anti-enumeration is disabled
        // @ts-expect-error runtimeConfig properties are read-only
        runtimeConfig.CONFIG_SIGNUP_ANTI_ENUMERATION_ENABLED = false;
        await assert.rejects(signupUser({
            email: "existing@example.com",
            password: "ComplexPass123!",
        }), (err) => {
            assert.ok(err instanceof DuplicateEmailError);
            return true;
        });
    });
    test("should return success and not write to DB if user exists and anti-enumeration is enabled", async () => {
        selectMockResult = [
            {
                id: "existing-uuid",
                email: "existing@example.com",
                normalizedEmail: "existing@example.com",
                status: "active",
                createdAt: new Date(),
            },
        ];
        // Enable anti-enumeration
        // @ts-expect-error runtimeConfig properties are read-only
        runtimeConfig.CONFIG_SIGNUP_ANTI_ENUMERATION_ENABLED = true;
        const result = await signupUser({
            email: "existing@example.com",
            password: "ComplexPass123!",
        });
        assert.strictEqual(result.user.id, "existing-uuid");
        assert.strictEqual(result.verificationTriggered, true);
        // Verify that transaction was NOT called since we simulated success
        assert.strictEqual(transactionCalled, false);
    });
    test("should execute transaction and insert records on successful new registration", async () => {
        selectMockResult = []; // No existing user
        // Disable auto-login to avoid needing session metadata in this test
        // @ts-expect-error runtimeConfig properties are read-only
        runtimeConfig.CONFIG_REQUIRE_VERIFICATION_FOR_SESSION = true;
        const result = await signupUser({
            email: "newuser@gmail.com",
            password: "ComplexPass123!",
        });
        assert.strictEqual(result.user.id, "mock-user-uuid");
        assert.strictEqual(result.user.email, "newuser@gmail.com");
        assert.strictEqual(result.verificationTriggered, true);
        assert.strictEqual(transactionCalled, true);
        // Verify user, credentials, and verification tokens were inserted
        assert.strictEqual(insertedRecords.length, 3);
        assert.ok(insertedRecords.some((rec) => rec.table === users));
        assert.ok(insertedRecords.some((rec) => rec.table === userPasswordHashes));
        assert.ok(insertedRecords.some((rec) => rec.table === emailVerifications));
    });
    test("should execute transaction and return signedAccessToken if auto-login is active", async () => {
        // Reset configuration flags to avoid leakage from prior tests
        // @ts-expect-error runtimeConfig properties are read-only
        runtimeConfig.CONFIG_SIGNUP_ANTI_ENUMERATION_ENABLED = false;
        // @ts-expect-error runtimeConfig properties are read-only
        runtimeConfig.CONFIG_REQUIRE_VERIFICATION_FOR_SESSION = false;
        selectMockResult = [];
        const originalDbSelect = db.select;
        const originalDbInsert = db.insert;
        // Mock select globally to isolate users and userPasswordHashes queries
        // @ts-expect-error db.select is read-only
        db.select = function () {
            return {
                from: (table) => ({
                    where: () => ({
                        limit: () => {
                            if (table === users) {
                                return Promise.resolve([]); // User does not exist, can register
                            }
                            if (table === userPasswordHashes) {
                                return Promise.resolve([{ credentialVersion: 1 }]); // Credential version exists
                            }
                            return Promise.resolve([]);
                        },
                    }),
                }),
            };
        };
        // Mock insert globally
        // @ts-expect-error db.insert is read-only
        db.insert = function () {
            return {
                values: () => ({
                    returning: () => Promise.resolve([{ id: "mock-session-uuid" }]),
                }),
            };
        };
        const result = await signupUser({
            email: "autosession@gmail.com",
            password: "ComplexPass123!",
            sessionMetadata: {
                userAgent: "test-agent",
                ipAddress: "127.0.0.1",
            },
        });
        // Restore select & insert
        db.select = originalDbSelect;
        db.insert = originalDbInsert;
        assert.ok(result.tokens);
        assert.ok(result.tokens.signedAccessToken);
        assert.ok(result.tokens.refreshToken);
    });
});
//# sourceMappingURL=signup.test.js.map