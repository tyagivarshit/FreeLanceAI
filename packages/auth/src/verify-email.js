import { db, users, emailVerifications } from "@freelanceos/db";
import { eq } from "drizzle-orm";
import crypto from "crypto";
import { logger } from "@freelanceos/logger";
import { eventDispatcher } from "./dispatcher.js";
export class VerificationError extends Error {
    code;
    constructor(message, code) {
        super(message);
        this.code = code;
        this.name = "VerificationError";
    }
}
export class InvalidVerificationTokenError extends VerificationError {
    constructor(message = "Invalid or unknown verification token.") {
        super(message, "INVALID_TOKEN");
        this.name = "InvalidVerificationTokenError";
    }
}
export class VerificationTokenExpiredError extends VerificationError {
    constructor(message = "Verification link has expired. Please register again or request a new verification link.") {
        super(message, "TOKEN_EXPIRED");
        this.name = "VerificationTokenExpiredError";
    }
}
export class VerificationTokenAlreadyConsumedError extends VerificationError {
    constructor(message = "This verification link has already been used.") {
        super(message, "TOKEN_ALREADY_USED");
        this.name = "VerificationTokenAlreadyConsumedError";
    }
}
export class UserNotFoundError extends VerificationError {
    constructor(message = "Associated user account not found.") {
        super(message, "USER_NOT_FOUND");
        this.name = "UserNotFoundError";
    }
}
/**
 * Validates and consumes an email verification token, activating the user account.
 */
export async function verifyEmailToken(rawToken) {
    if (!rawToken || typeof rawToken !== "string" || rawToken.trim() === "") {
        throw new InvalidVerificationTokenError("Verification token is missing or invalid.");
    }
    const tokenHash = crypto.createHash("sha256").update(rawToken.trim()).digest("hex");
    // Query verification record
    const records = await db
        .select()
        .from(emailVerifications)
        .where(eq(emailVerifications.tokenHash, tokenHash))
        .limit(1);
    const verificationRecord = records[0];
    if (!verificationRecord) {
        throw new InvalidVerificationTokenError("Invalid or unknown verification token.");
    }
    if (verificationRecord.consumedAt !== null) {
        throw new VerificationTokenAlreadyConsumedError("This verification link has already been used.");
    }
    if (verificationRecord.expiresAt < new Date()) {
        throw new VerificationTokenExpiredError("Verification link has expired. Please register again or request a new verification link.");
    }
    // Find user
    const foundUsers = await db
        .select()
        .from(users)
        .where(eq(users.id, verificationRecord.userId))
        .limit(1);
    const user = foundUsers[0];
    if (!user) {
        throw new UserNotFoundError("Associated user account not found.");
    }
    const now = new Date();
    // Execute atomic update
    await db.transaction(async (tx) => {
        // 1. Mark verification token consumed
        await tx
            .update(emailVerifications)
            .set({
            consumedAt: now,
        })
            .where(eq(emailVerifications.id, verificationRecord.id));
        // 2. Activate user account and record verification timestamp
        await tx
            .update(users)
            .set({
            status: user.status === "pending" ? "active" : user.status,
            emailVerifiedAt: now,
        })
            .where(eq(users.id, user.id));
    });
    // Publish audit event
    await eventDispatcher.publish("EMAIL_VERIFIED", {
        userId: user.id,
        email: user.email,
        verifiedAt: now.toISOString(),
    });
    logger.info({
        message: `[Email Verification] Successfully verified email for user ${user.id} (${user.email})`,
        userId: user.id,
    });
    return {
        success: true,
        userId: user.id,
        email: user.email,
    };
}
