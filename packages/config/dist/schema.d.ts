import { z } from "zod";
export declare const environmentSchema: z.ZodObject<{
    NODE_ENV: z.ZodDefault<z.ZodEnum<["development", "production", "test"]>>;
    API_PORT: z.ZodDefault<z.ZodNumber>;
    DATABASE_URL: z.ZodString;
    REDIS_URL: z.ZodString;
    JWT_SECRET: z.ZodDefault<z.ZodString>;
    ACCESS_TOKEN_LIFETIME_SEC: z.ZodDefault<z.ZodNumber>;
    REFRESH_TOKEN_LIFETIME_SEC: z.ZodDefault<z.ZodNumber>;
    ROTATION_GRACE_PERIOD_SEC: z.ZodDefault<z.ZodNumber>;
    SESSION_COOKIE_NAME: z.ZodDefault<z.ZodString>;
    SESSION_COOKIE_SAMESITE: z.ZodDefault<z.ZodEnum<["lax", "strict", "none"]>>;
    SESSION_COOKIE_SECURE: z.ZodDefault<z.ZodBoolean>;
    SESSION_COOKIE_HTTPONLY: z.ZodDefault<z.ZodBoolean>;
    SESSION_COOKIE_PATH: z.ZodDefault<z.ZodString>;
    SESSION_COOKIE_DOMAIN: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
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
}, {
    DATABASE_URL: string;
    REDIS_URL: string;
    NODE_ENV?: "development" | "production" | "test" | undefined;
    API_PORT?: number | undefined;
    JWT_SECRET?: string | undefined;
    ACCESS_TOKEN_LIFETIME_SEC?: number | undefined;
    REFRESH_TOKEN_LIFETIME_SEC?: number | undefined;
    ROTATION_GRACE_PERIOD_SEC?: number | undefined;
    SESSION_COOKIE_NAME?: string | undefined;
    SESSION_COOKIE_SAMESITE?: "lax" | "strict" | "none" | undefined;
    SESSION_COOKIE_SECURE?: boolean | undefined;
    SESSION_COOKIE_HTTPONLY?: boolean | undefined;
    SESSION_COOKIE_PATH?: string | undefined;
    SESSION_COOKIE_DOMAIN?: string | undefined;
}>;
export type Environment = z.infer<typeof environmentSchema>;
//# sourceMappingURL=schema.d.ts.map