import { z } from "zod";
export const environmentSchema = z.object({
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    API_PORT: z.coerce.number().default(4000),
    DATABASE_URL: z.string().url("DATABASE_URL must be a valid connection string"),
    REDIS_URL: z.string().url("REDIS_URL must be a valid connection string"),
});
//# sourceMappingURL=schema.js.map