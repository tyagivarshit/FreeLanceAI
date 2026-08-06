export declare function loadRuntimeConfig(): Readonly<{
    NODE_ENV: "development" | "production" | "test";
    API_PORT: number;
    DATABASE_URL: string;
    REDIS_URL: string;
    JWT_SECRET: string;
    ACCESS_TOKEN_LIFETIME_SEC: number;
    REFRESH_TOKEN_LIFETIME_SEC: number;
    ROTATION_GRACE_PERIOD_SEC: number;
    SESSION_COOKIE_NAME: string;
    SESSION_COOKIE_SAMESITE: "lax" | "strict" | "none";
    SESSION_COOKIE_SECURE: boolean;
    SESSION_COOKIE_HTTPONLY: boolean;
    SESSION_COOKIE_PATH: string;
    SESSION_COOKIE_DOMAIN?: string | undefined;
}>;
export declare const runtimeConfig: Readonly<{
    NODE_ENV: "development" | "production" | "test";
    API_PORT: number;
    DATABASE_URL: string;
    REDIS_URL: string;
    JWT_SECRET: string;
    ACCESS_TOKEN_LIFETIME_SEC: number;
    REFRESH_TOKEN_LIFETIME_SEC: number;
    ROTATION_GRACE_PERIOD_SEC: number;
    SESSION_COOKIE_NAME: string;
    SESSION_COOKIE_SAMESITE: "lax" | "strict" | "none";
    SESSION_COOKIE_SECURE: boolean;
    SESSION_COOKIE_HTTPONLY: boolean;
    SESSION_COOKIE_PATH: string;
    SESSION_COOKIE_DOMAIN?: string | undefined;
}>;
//# sourceMappingURL=config.d.ts.map