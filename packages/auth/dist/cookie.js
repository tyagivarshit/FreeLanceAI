import { runtimeConfig } from "@freelanceos/config";
/**
 * Builds the session cookie options configuration based on runtime settings.
 */
export function getSessionCookieConfig(token) {
    return {
        name: runtimeConfig.SESSION_COOKIE_NAME,
        value: token,
        httpOnly: runtimeConfig.SESSION_COOKIE_HTTPONLY,
        secure: runtimeConfig.SESSION_COOKIE_SECURE,
        sameSite: runtimeConfig.SESSION_COOKIE_SAMESITE,
        path: runtimeConfig.SESSION_COOKIE_PATH,
        maxAge: runtimeConfig.REFRESH_TOKEN_LIFETIME_SEC,
        domain: runtimeConfig.SESSION_COOKIE_DOMAIN,
    };
}
/**
 * Serializes cookie options into a standard HTTP Set-Cookie header value string.
 */
export function serializeCookie(options) {
    const parts = [`${options.name}=${options.value}`];
    if (options.httpOnly) {
        parts.push("HttpOnly");
    }
    if (options.secure) {
        parts.push("Secure");
    }
    if (options.sameSite) {
        const casedSameSite = options.sameSite.charAt(0).toUpperCase() + options.sameSite.slice(1);
        parts.push(`SameSite=${casedSameSite}`);
    }
    if (options.path) {
        parts.push(`Path=${options.path}`);
    }
    if (options.maxAge !== undefined) {
        parts.push(`Max-Age=${options.maxAge}`);
    }
    if (options.domain) {
        parts.push(`Domain=${options.domain}`);
    }
    if (options.expires) {
        parts.push(`Expires=${options.expires.toUTCString()}`);
    }
    return parts.join("; ");
}
/**
 * Builds the clear session cookie options to remove the client cookie.
 */
export function getSessionCookieClearConfig() {
    return {
        name: runtimeConfig.SESSION_COOKIE_NAME,
        value: "",
        httpOnly: runtimeConfig.SESSION_COOKIE_HTTPONLY,
        secure: runtimeConfig.SESSION_COOKIE_SECURE,
        sameSite: runtimeConfig.SESSION_COOKIE_SAMESITE,
        path: runtimeConfig.SESSION_COOKIE_PATH,
        maxAge: 0,
        expires: new Date(0),
        domain: runtimeConfig.SESSION_COOKIE_DOMAIN,
    };
}
//# sourceMappingURL=cookie.js.map