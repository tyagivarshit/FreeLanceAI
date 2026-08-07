import { db, users, userPasswordHashes, emailVerifications } from "@freelanceos/db";
import { eq } from "drizzle-orm";
import crypto from "crypto";
import { runtimeConfig } from "@freelanceos/config";
import { logger } from "@freelanceos/logger";
import { normalizeEmailAddress, validatePasswordStrength } from "@freelanceos/core";
import { hashPassword } from "./hash.js";
import { createSession } from "./session.js";
import { eventDispatcher, backgroundTaskDispatcher } from "./dispatcher.js";
export class SignupError extends Error {
    code;
    constructor(message, code) {
        super(message);
        this.code = code;
        this.name = "SignupError";
    }
}
export class DuplicateEmailError extends SignupError {
    constructor() {
        super("An account with this email address already exists.", "DUPLICATE_EMAIL");
        this.name = "DuplicateEmailError";
    }
}
export class ValidationError extends SignupError {
    errors;
    constructor(errors) {
        super(`Validation failed: ${errors.join("; ")}`, "VALIDATION_FAILED");
        this.errors = errors;
        this.name = "ValidationError";
    }
}
export class UserCreationError extends SignupError {
    constructor(message) {
        super(message, "USER_CREATION_FAILED");
        this.name = "UserCreationError";
    }
}
export class CredentialCreationError extends SignupError {
    constructor(message) {
        super(message, "CREDENTIAL_CREATION_FAILED");
        this.name = "CredentialCreationError";
    }
}
export class VerificationCreationError extends SignupError {
    constructor(message) {
        super(message, "VERIFICATION_CREATION_FAILED");
        this.name = "VerificationCreationError";
    }
}
export class SignupTransactionError extends SignupError {
    constructor(message) {
        super(message, "SIGNUP_TRANSACTION_FAILED");
        this.name = "SignupTransactionError";
    }
}
/**
 * Orchestrates user registration according to the frozen Signup blueprint.
 */
export async function signupUser(input) {
    const { email, password, sessionMetadata } = input;
    // 1. Normalize email
    const normalized = normalizeEmailAddress(email, {
        stripSubaddress: runtimeConfig.CONFIG_EMAIL_STRIP_SUBADDRESS,
        stripDots: runtimeConfig.CONFIG_EMAIL_STRIP_DOTS,
    });
    // 2. Validate password strength
    const passwordCheck = validatePasswordStrength(password, {
        minLength: runtimeConfig.CONFIG_PASSWORD_MIN_LENGTH,
        maxLength: runtimeConfig.CONFIG_PASSWORD_MAX_LENGTH,
        complexityRequired: runtimeConfig.CONFIG_PASSWORD_COMPLEXITY_REQUIRED,
    });
    if (!passwordCheck.isValid) {
        throw new ValidationError(passwordCheck.errors);
    }
    // 3. Check for duplicates
    const existingUsers = await db
        .select()
        .from(users)
        .where(eq(users.normalizedEmail, normalized))
        .limit(1);
    const existingUser = existingUsers[0];
    if (existingUser) {
        if (runtimeConfig.CONFIG_SIGNUP_ANTI_ENUMERATION_ENABLED) {
            logger.info({
                message: `Anti-enumeration triggered for email: ${normalized}. Simulating successful signup.`,
            });
            // Dispatch alert to original owner out-of-band
            await eventDispatcher.publish("REGISTRATION_ATTEMPT_ON_EXISTING_EMAIL", {
                email: normalized,
                userId: existingUser.id,
            });
            // Simulate a successful registration response structure, returning mock data without writing to DB
            return {
                user: {
                    id: existingUser.id,
                    email: existingUser.email,
                    status: existingUser.status,
                    createdAt: existingUser.createdAt,
                },
                verificationTriggered: true,
            };
        }
        else {
            throw new DuplicateEmailError();
        }
    }
    // 4. Generate verification token details beforehand
    const rawVerificationToken = crypto.randomBytes(32).toString("hex");
    const verificationTokenHash = crypto
        .createHash("sha256")
        .update(rawVerificationToken)
        .digest("hex");
    const verificationLifespanMs = runtimeConfig.CONFIG_EMAIL_VERIFICATION_LIFETIME_SEC * 1000;
    const verificationExpiresAt = new Date(Date.now() + verificationLifespanMs);
    // 5. Generate password hash
    const { passwordHash, algorithm, hashVersion } = await hashPassword(password);
    // 6. Execute atomic database transaction
    let registrationData;
    try {
        registrationData = await db.transaction(async (tx) => {
            // 6.1 Create user record
            const userInserted = await tx
                .insert(users)
                .values({
                email,
                normalizedEmail: normalized,
                status: "pending",
            })
                .returning({
                id: users.id,
                email: users.email,
                status: users.status,
                createdAt: users.createdAt,
            });
            const newUser = userInserted[0];
            if (!newUser) {
                throw new UserCreationError("Failed to create user record during transaction");
            }
            // 6.2 Create password hash record
            try {
                await tx.insert(userPasswordHashes).values({
                    userId: newUser.id,
                    passwordHash,
                    algorithm,
                    hashVersion,
                    passwordChangedAt: new Date(),
                    credentialVersion: 1,
                });
            }
            catch (err) {
                throw new CredentialCreationError(err instanceof Error ? err.message : String(err));
            }
            // 6.3 Create email verification token record
            try {
                await tx.insert(emailVerifications).values({
                    userId: newUser.id,
                    tokenHash: verificationTokenHash,
                    expiresAt: verificationExpiresAt,
                    attemptCount: 0,
                });
            }
            catch (err) {
                throw new VerificationCreationError(err instanceof Error ? err.message : String(err));
            }
            return newUser;
        });
    }
    catch (err) {
        if (err instanceof SignupError) {
            throw err;
        }
        throw new SignupTransactionError(err instanceof Error ? err.message : String(err));
    }
    // 7. Initial session generation decision (outside db transaction)
    let sessionTokens;
    if (!runtimeConfig.CONFIG_REQUIRE_VERIFICATION_FOR_SESSION) {
        if (!sessionMetadata) {
            throw new SignupError("Session metadata is required to initialize a session when auto-login is active.", "MISSING_METADATA");
        }
        const sessionResult = await createSession(registrationData.id, sessionMetadata);
        sessionTokens = {
            signedAccessToken: sessionResult.signedAccessToken,
            refreshToken: sessionResult.rawRefreshToken,
        };
    }
    // 8. Publish post-registration events and dispatch background tasks
    try {
        // 8.1 Publish IDENTITY_REGISTERED event
        await eventDispatcher.publish("IDENTITY_REGISTERED", {
            userId: registrationData.id,
            normalizedEmail: normalized,
            registeredAt: registrationData.createdAt.toISOString(),
        });
        // 8.2 Dispatch verification email task
        await backgroundTaskDispatcher.dispatch("SEND_VERIFICATION_EMAIL", {
            userId: registrationData.id,
            email: registrationData.email,
            token: rawVerificationToken,
        });
    }
    catch (error) {
        logger.warn({
            message: "Post-registration dispatch failed, but signup transaction succeeded.",
            error: error instanceof Error ? error : new Error(String(error)),
            userId: registrationData.id,
        });
    }
    const result = {
        user: registrationData,
        verificationTriggered: true,
    };
    if (sessionTokens) {
        result.tokens = sessionTokens;
    }
    return result;
}
//# sourceMappingURL=signup.js.map