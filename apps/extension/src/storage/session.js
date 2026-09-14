/**
 * Chapter 9A: Isolated Session Storage Module
 * Utilizes memory-isolated chrome.storage.session to insulate B2B auth fingerprints
 * from host memory snooping, XSS extraction, or standard local storage leakage.
 */
export class SessionStorageManager {
    /**
     * Securely caches the auth token in ephemeral browser memory.
     */
    static async setAuthToken(token, tenantId) {
        // Requires manifest permission "storage"
        // Using session storage physically bounds the token to the browser's active memory session.
        await chrome.storage.session.set({
            __freelanceos_auth_token: token,
            __freelanceos_tenant_id: tenantId,
            __freelanceos_timestamp: Date.now()
        });
    }
    /**
     * Retrieves the token without persisting it to the local disk.
     */
    static async getAuthSession() {
        const data = await chrome.storage.session.get([
            "__freelanceos_auth_token",
            "__freelanceos_tenant_id"
        ]);
        return {
            token: data.__freelanceos_auth_token || null,
            tenantId: data.__freelanceos_tenant_id || null
        };
    }
    /**
     * Purges the session fingerprint instantly.
     */
    static async clearAuthSession() {
        await chrome.storage.session.remove([
            "__freelanceos_auth_token",
            "__freelanceos_tenant_id",
            "__freelanceos_timestamp"
        ]);
    }
}
