import { test, describe } from "node:test";
import assert from "node:assert";
import { normalizeEmailAddress, validatePasswordStrength } from "./validation.js";
describe("Email Normalization", () => {
    test("should trim and lowercase standard emails", () => {
        const email = "  TestUser@Example.COM  ";
        const result = normalizeEmailAddress(email);
        assert.strictEqual(result, "testuser@example.com");
    });
    test("should strip sub-addresses for gmail domain by default", () => {
        const email = "test.user+spam@gmail.com";
        const result = normalizeEmailAddress(email, { stripSubaddress: true });
        assert.strictEqual(result, "testuser@gmail.com");
    });
    test("should strip dots for gmail domain by default", () => {
        const email = "t.e.s.t.u.s.e.r@gmail.com";
        const result = normalizeEmailAddress(email, { stripDots: true });
        assert.strictEqual(result, "testuser@gmail.com");
    });
    test("should not strip sub-addresses or dots for non-gmail domains", () => {
        const email = "test.user+spam@example.com";
        const result = normalizeEmailAddress(email, { stripSubaddress: true, stripDots: true });
        assert.strictEqual(result, "test.user+spam@example.com");
    });
});
describe("Password Strength Validation", () => {
    const options = {
        minLength: 12,
        maxLength: 128,
        complexityRequired: true,
    };
    test("should pass a valid complex password", () => {
        const result = validatePasswordStrength("ComplexPass123!", options);
        assert.strictEqual(result.isValid, true);
        assert.strictEqual(result.errors.length, 0);
    });
    test("should fail on short passwords", () => {
        const result = validatePasswordStrength("Short1!", options);
        assert.strictEqual(result.isValid, false);
        assert.ok(result.errors.some((err) => err.includes("at least 12 characters")));
    });
    test("should fail on missing uppercase letters", () => {
        const result = validatePasswordStrength("lowercase123!", options);
        assert.strictEqual(result.isValid, false);
        assert.ok(result.errors.some((err) => err.includes("uppercase letter")));
    });
    test("should fail on missing lowercase letters", () => {
        const result = validatePasswordStrength("UPPERCASE123!", options);
        assert.strictEqual(result.isValid, false);
        assert.ok(result.errors.some((err) => err.includes("lowercase letter")));
    });
    test("should fail on missing numbers", () => {
        const result = validatePasswordStrength("NoNumbersHere!", options);
        assert.strictEqual(result.isValid, false);
        assert.ok(result.errors.some((err) => err.includes("number")));
    });
    test("should fail on missing special characters", () => {
        const result = validatePasswordStrength("NoSpecialChar123", options);
        assert.strictEqual(result.isValid, false);
        assert.ok(result.errors.some((err) => err.includes("special character")));
    });
});
//# sourceMappingURL=validation.test.js.map