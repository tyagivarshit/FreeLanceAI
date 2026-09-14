import { db, users, userMfaSettings } from "@freelanceos/db";
import { eq } from "drizzle-orm";
import { sessionService } from "./session-service.js";
import { eventDispatcher } from "./dispatcher.js";
import { RedisCacheStore } from "@freelanceos/redis";
import { verifyTotpCode } from "./totp.js";
import { LoginError, AuthenticationFailureError } from "./login.js";
import { deviceRecognitionService } from "./device-recognition-service.js";
export class MfaTokenExpiredError extends LoginError {
    constructor(message = "MFA session expired. Please log in again.") {
        super(message, "MFA_TOKEN_EXPIRED");
        this.name = "MfaTokenExpiredError";
    }
}
export async function verifyMfaLogin(input) {
    const { mfaToken, code, sessionMetadata } = input;
    const ipAddress = sessionMetadata.ipAddress || "unknown";
    const cache = new RedisCacheStore();
    const mfaKey = `mfa:pending:${mfaToken}`;
    const userId = await cache.get(mfaKey);
    if (!userId) {
        throw new MfaTokenExpiredError();
    }
    // Rate limit MFA guesses (prevent brute forcing TOTP)
    const attemptKey = `mfa:attempts:${userId}`;
    const attempts = await cache.increment(attemptKey, 300); // 5 mins
    if (attempts > 5) {
        await cache.delete(mfaKey); // invalidate session
        throw new LoginError("Too many incorrect MFA attempts. Please log in again.", "MFA_LOCKED");
    }
    // Load MFA Settings
    const settingsRecords = await db
        .select()
        .from(userMfaSettings)
        .where(eq(userMfaSettings.userId, userId))
        .limit(1);
    const settings = settingsRecords[0];
    if (!settings || !settings.enabled || !settings.totpSecret) {
        // Edge case: MFA was disabled during the pending period
        throw new AuthenticationFailureError("MFA settings invalid.");
    }
    const isValid = verifyTotpCode(code, settings.totpSecret);
    if (!isValid) {
        throw new AuthenticationFailureError("Invalid authentication code.");
    }
    // Success! Clear caches.
    await cache.delete(mfaKey);
    await cache.delete(attemptKey);
    // Fetch User
    const userRecords = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    const user = userRecords[0];
    if (!user) {
        throw new AuthenticationFailureError("User not found.");
    }
    // Invoke Device Recognition
    const deviceMetadata = await deviceRecognitionService.evaluateDevice(user.id, {
        userAgent: sessionMetadata.userAgent,
        ipAddress,
    });
    // Establish Session
    const sessionResult = await sessionService.establishSession(user.id, deviceMetadata);
    // Audit
    await eventDispatcher.publish("LOGIN_SUCCEEDED", {
        userId: user.id,
        ipAddress,
        deviceName: deviceMetadata.deviceName || "unknown",
    });
    return {
        user: {
            id: user.id,
            email: user.email,
            status: user.status,
            createdAt: user.createdAt,
        },
        tokens: {
            signedAccessToken: sessionResult.signedAccessToken,
            refreshToken: sessionResult.rawRefreshToken,
        },
        verificationTriggered: false,
    };
}
