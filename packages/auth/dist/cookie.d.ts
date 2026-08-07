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
export declare function getSessionCookieConfig(token: string): CookieOptions;
/**
 * Serializes cookie options into a standard HTTP Set-Cookie header value string.
 */
export declare function serializeCookie(options: CookieOptions): string;
/**
 * Builds the clear session cookie options to remove the client cookie.
 */
export declare function getSessionCookieClearConfig(): CookieOptions;
/**
 * Creates a pre-serialized session cookie header string using configured policy options.
 */
export declare function issueSessionCookie(token: string): string;
/**
 * Creates a pre-serialized session cookie header string to clear client cookies.
 */
export declare function issueClearSessionCookie(): string;
//# sourceMappingURL=cookie.d.ts.map