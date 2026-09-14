import { db, userMfaSettings } from "@freelanceos/db";
import { eq } from "drizzle-orm";
import { generateTotpSecret, generateOtpAuthUri, verifyTotpCode } from "./totp.js";
import { runtimeConfig } from "@freelanceos/config";
/**
 * Initiates MFA setup by generating a secret and returning the QR code URI.
 * This does NOT enable MFA until verified.
 */
export async function generateMfaSetup(userId, email) {
    const secret = generateTotpSecret();
    const appName = runtimeConfig.APP_URL ? new URL(runtimeConfig.APP_URL).hostname : "FreelanceOS";
    const uri = generateOtpAuthUri(email, appName, secret);
    // Upsert the secret into the database but keep enabled = false
    const existing = await db.select().from(userMfaSettings).where(eq(userMfaSettings.userId, userId)).limit(1);
    if (existing.length > 0) {
        await db.update(userMfaSettings)
            .set({ totpSecret: secret, enabled: false })
            .where(eq(userMfaSettings.userId, userId));
    }
    else {
        await db.insert(userMfaSettings)
            .values({ userId, totpSecret: secret, enabled: false });
    }
    return { secret, uri };
}
/**
 * Verifies a code against the pending secret to permanently enable MFA.
 */
export async function verifyAndEnableMfa(userId, code) {
    const settings = await db.select().from(userMfaSettings).where(eq(userMfaSettings.userId, userId)).limit(1);
    const mfa = settings[0];
    if (!mfa || !mfa.totpSecret) {
        throw new Error("MFA setup not initiated.");
    }
    const isValid = verifyTotpCode(code, mfa.totpSecret);
    if (isValid) {
        await db.update(userMfaSettings)
            .set({ enabled: true })
            .where(eq(userMfaSettings.userId, userId));
        return true;
    }
    return false;
}
/**
 * Disables MFA for a user.
 */
export async function disableMfa(userId) {
    await db.update(userMfaSettings)
        .set({ enabled: false, totpSecret: null })
        .where(eq(userMfaSettings.userId, userId));
}
