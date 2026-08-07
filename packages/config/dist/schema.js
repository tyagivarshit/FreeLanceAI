import { z } from "zod";
export const environmentSchema = z.object({
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    API_PORT: z.coerce.number().default(4000),
    DATABASE_URL: z.string().url("DATABASE_URL must be a valid connection string"),
    REDIS_URL: z.string().url("REDIS_URL must be a valid connection string"),
    // Signed Access Token Strategy config
    JWT_SECRET: z.string().default("default-dev-secret-key-change-in-production"),
    ACCESS_TOKEN_LIFETIME_SEC: z.coerce.number().default(900), // 15 minutes default
    // Refresh Token and Session lifecycles
    REFRESH_TOKEN_LIFETIME_SEC: z.coerce.number().default(604800), // 7 days default
    ROTATION_GRACE_PERIOD_SEC: z.coerce.number().default(10), // 10 seconds default
    // Session Cookie Configuration
    SESSION_COOKIE_NAME: z.string().default("__Host-refresh_token"),
    SESSION_COOKIE_SAMESITE: z.enum(["lax", "strict", "none"]).default("lax"),
    SESSION_COOKIE_SECURE: z.coerce.boolean().default(true),
    SESSION_COOKIE_HTTPONLY: z.coerce.boolean().default(true),
    SESSION_COOKIE_PATH: z.string().default("/"),
    SESSION_COOKIE_DOMAIN: z.string().optional(),
    // Signup Password Policies
    CONFIG_PASSWORD_MIN_LENGTH: z.coerce.number().default(12),
    CONFIG_PASSWORD_MAX_LENGTH: z.coerce.number().default(128),
    CONFIG_PASSWORD_COMPLEXITY_REQUIRED: z.coerce.boolean().default(true),
    // Signup Hashing Policies
    CONFIG_PASSWORD_HASH_ALGORITHM: z.enum(["pbkdf2", "scrypt"]).default("scrypt"),
    CONFIG_PASSWORD_HASH_ROUNDS: z.coerce.number().default(10), // Salt rounds/parameters
    // Signup Email Normalization Policies
    CONFIG_EMAIL_STRIP_SUBADDRESS: z.coerce.boolean().default(true),
    CONFIG_EMAIL_STRIP_DOTS: z.coerce.boolean().default(true),
    // Signup General Policies
    CONFIG_SIGNUP_ANTI_ENUMERATION_ENABLED: z.coerce.boolean().default(false),
    CONFIG_REQUIRE_VERIFICATION_FOR_SESSION: z.coerce.boolean().default(false),
    CONFIG_EMAIL_VERIFICATION_LIFETIME_SEC: z.coerce.number().default(86400),
});
//# sourceMappingURL=schema.js.map