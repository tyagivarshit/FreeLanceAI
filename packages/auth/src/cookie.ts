import { runtimeConfig } from "@freelanceos/config";

export interface CookieOptions {
  name: string;
  value: string;
  httpOnly: boolean;
  secure: boolean;
  sameSite: "lax" | "strict" | "none";
  path: string;
  maxAge?: number;
  domain?: string | undefined;
  expires?: Date | undefined;
}

/**
 * Builds the session cookie options configuration based on runtime settings.
 */
export function getSessionCookieConfig(token: string): CookieOptions {
  return {
    name: runtimeConfig.SESSION_COOKIE_NAME,
    value: token,
    httpOnly: runtimeConfig.SESSION_COOKIE_HTTPONLY,
    secure: runtimeConfig.SESSION_COOKIE_SECURE,
    sameSite: runtimeConfig.SESSION_COOKIE_SAMESITE as "lax" | "strict" | "none",
    path: runtimeConfig.SESSION_COOKIE_PATH,
    maxAge: runtimeConfig.REFRESH_TOKEN_LIFETIME_SEC,
    domain: runtimeConfig.SESSION_COOKIE_DOMAIN,
  };
}

/**
 * Serializes cookie options into a standard HTTP Set-Cookie header value string.
 */
export function serializeCookie(options: CookieOptions): string {
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
export function getSessionCookieClearConfig(): CookieOptions {
  return {
    name: runtimeConfig.SESSION_COOKIE_NAME,
    value: "",
    httpOnly: runtimeConfig.SESSION_COOKIE_HTTPONLY,
    secure: runtimeConfig.SESSION_COOKIE_SECURE,
    sameSite: runtimeConfig.SESSION_COOKIE_SAMESITE as "lax" | "strict" | "none",
    path: runtimeConfig.SESSION_COOKIE_PATH,
    maxAge: 0,
    expires: new Date(0),
    domain: runtimeConfig.SESSION_COOKIE_DOMAIN,
  };
}

/**
 * Creates a pre-serialized session cookie header string using configured policy options.
 */
export function issueSessionCookie(token: string): string {
  return serializeCookie(getSessionCookieConfig(token));
}

/**
 * Creates a pre-serialized session cookie header string to clear client cookies.
 */
export function issueClearSessionCookie(): string {
  return serializeCookie(getSessionCookieClearConfig());
}
