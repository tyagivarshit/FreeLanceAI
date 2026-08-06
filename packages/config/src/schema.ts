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
});

export type Environment = z.infer<typeof environmentSchema>;
