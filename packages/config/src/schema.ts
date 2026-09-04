import { z } from "zod";

const booleanEnv = z.preprocess((val) => {
  if (typeof val === "boolean") return val;
  if (typeof val === "string") {
    const lower = val.trim().toLowerCase();
    if (lower === "true" || lower === "1" || lower === "yes") return true;
    if (lower === "false" || lower === "0" || lower === "no" || lower === "") return false;
  }
  return val;
}, z.boolean());

export const environmentSchema = z
  .object({
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    API_PORT: z.coerce.number().default(4000),
    DATABASE_URL: z.string().url("DATABASE_URL must be a valid connection string"),
    REDIS_URL: z.string().url("REDIS_URL must be a valid connection string"),

    // Signed Access Token Strategy config
    // No default: missing or short JWT_SECRET causes startup crash in all environments.
    // min(32) enforces a cryptographic minimum — anything shorter is trivially brute-forceable.
    JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
    ACCESS_TOKEN_LIFETIME_SEC: z.coerce.number().default(900), // 15 minutes default

    // Refresh Token and Session lifecycles
    REFRESH_TOKEN_LIFETIME_SEC: z.coerce.number().default(604800), // 7 days default
    ROTATION_GRACE_PERIOD_SEC: z.coerce.number().default(10), // 10 seconds default

    // Session Cookie Configuration
    SESSION_COOKIE_NAME: z.string().default("__Host-refresh_token"),
    SESSION_COOKIE_SAMESITE: z.enum(["lax", "strict", "none"]).default("lax"),
    SESSION_COOKIE_SECURE: booleanEnv.default(true),
    SESSION_COOKIE_HTTPONLY: booleanEnv.default(true),
    SESSION_COOKIE_PATH: z.string().default("/"),
    SESSION_COOKIE_DOMAIN: z.string().optional(),

    // Signup Password Policies
    CONFIG_PASSWORD_MIN_LENGTH: z.coerce.number().default(12),
    CONFIG_PASSWORD_MAX_LENGTH: z.coerce.number().default(128),
    CONFIG_PASSWORD_COMPLEXITY_REQUIRED: booleanEnv.default(true),

    // Signup Hashing Policies
    CONFIG_PASSWORD_HASH_ALGORITHM: z.enum(["pbkdf2", "scrypt"]).default("scrypt"),
    CONFIG_PASSWORD_HASH_ROUNDS: z.coerce.number().default(10), // Salt rounds/parameters

    // Signup Email Normalization Policies
    CONFIG_EMAIL_STRIP_SUBADDRESS: booleanEnv.default(true),
    CONFIG_EMAIL_STRIP_DOTS: booleanEnv.default(true),

    // Signup General Policies
    CONFIG_SIGNUP_ANTI_ENUMERATION_ENABLED: booleanEnv.default(false),
    CONFIG_REQUIRE_VERIFICATION_FOR_SESSION: booleanEnv.default(false),
    CONFIG_EMAIL_VERIFICATION_LIFETIME_SEC: z.coerce.number().default(86400),

    // Login Security and Lockout Policies
    CONFIG_MAX_LOGIN_ATTEMPTS: z.coerce.number().default(5),
    CONFIG_LOCKOUT_DURATION_SEC: z.coerce.number().default(900),

    // Session Capacity Policies
    CONFIG_MAX_CONCURRENT_SESSIONS: z.coerce.number().default(5),
    CONFIG_CONCURRENT_SESSION_STRATEGY: z
      .enum(["revoke_oldest", "deny_access"])
      .default("revoke_oldest"),

    // Stripe Configuration
    STRIPE_SECRET_KEY: z.string().optional(),
    STRIPE_PUBLISHABLE_KEY: z.string().optional(),
    STRIPE_WEBHOOK_SECRET: z.string().optional(),
    STRIPE_API_VERSION: z.string().default("2023-10-16"),
    STRIPE_TIMEOUT_MS: z.coerce.number().default(10000),

    // CORS allowlist: comma-separated list of permitted request origins.
    // Required in production. In development/test, defaults to localhost only.
    // Example: "https://freelanceos.com,https://staging.freelanceos.com"
    ALLOWED_ORIGINS: z.string().optional(),

    // Application URL / Base URL for verification and action links
    APP_URL: z.string().url("APP_URL must be a valid URL").default("http://localhost:4000"),

    // Email & SMTP Configuration
    EMAIL_FROM: z.string().default("FreelanceOS <noreply@freelanceos.com>"),
    SMTP_HOST: z.string().optional(),
    SMTP_PORT: z.coerce.number().default(587),
    SMTP_SECURE: booleanEnv.optional(),
    SMTP_USER: z.string().optional(),
    SMTP_PASS: z.string().optional(),
    RESEND_API_KEY: z.string().optional(),

    // AI Gateway Configuration
    AI_GATEWAY_URL: z.string().url("AI_GATEWAY_URL must be a valid URL"),
    // Maximum active sessions a user can have across devices
    MAX_CONCURRENT_SESSIONS: z.coerce.number().min(1).default(5),
  })
  .refine(
    (data) => {
      if (data.NODE_ENV === "production") {
        if (!data.STRIPE_SECRET_KEY || data.STRIPE_SECRET_KEY.trim() === "") {
          return false;
        }
        if (data.STRIPE_SECRET_KEY.startsWith("sk_test_")) {
          return false;
        }
      }
      return true;
    },
    {
      message:
        "Production Stripe configuration requires a valid production secret key (must not start with sk_test_).",
      path: ["STRIPE_SECRET_KEY"],
    },
  )
  .refine(
    (data) => {
      if (data.NODE_ENV === "production") {
        if (!data.STRIPE_WEBHOOK_SECRET || data.STRIPE_WEBHOOK_SECRET.trim() === "") {
          return false;
        }
      }
      return true;
    },
    {
      message: "Production Stripe configuration requires STRIPE_WEBHOOK_SECRET to be set.",
      path: ["STRIPE_WEBHOOK_SECRET"],
    },
  )
  .refine(
    (data) => {
      if (data.NODE_ENV === "production") {
        if (!data.ALLOWED_ORIGINS || data.ALLOWED_ORIGINS.trim() === "") {
          return false;
        }
      }
      return true;
    },
    {
      message:
        "Production configuration requires ALLOWED_ORIGINS to be set (comma-separated list of permitted request origins).",
      path: ["ALLOWED_ORIGINS"],
    },
  );

export type Environment = z.infer<typeof environmentSchema>;
