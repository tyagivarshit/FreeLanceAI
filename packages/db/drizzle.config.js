import { defineConfig } from "drizzle-kit";
import { runtimeConfig } from "@freelanceos/config";
export default defineConfig({
    schema: "./dist/schema/**/*.js",
    out: "./migrations",
    dialect: "postgresql",
    dbCredentials: {
        url: runtimeConfig.DATABASE_URL,
    },
    verbose: true,
    strict: true,
});
