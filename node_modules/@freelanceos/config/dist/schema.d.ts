import { z } from "zod";
export declare const environmentSchema: z.ZodObject<{
    NODE_ENV: z.ZodDefault<z.ZodEnum<["development", "production", "test"]>>;
    API_PORT: z.ZodDefault<z.ZodNumber>;
    DATABASE_URL: z.ZodString;
    REDIS_URL: z.ZodString;
}, "strip", z.ZodTypeAny, {
    NODE_ENV: "development" | "production" | "test";
    API_PORT: number;
    DATABASE_URL: string;
    REDIS_URL: string;
}, {
    DATABASE_URL: string;
    REDIS_URL: string;
    NODE_ENV?: "development" | "production" | "test" | undefined;
    API_PORT?: number | undefined;
}>;
export type Environment = z.infer<typeof environmentSchema>;
//# sourceMappingURL=schema.d.ts.map