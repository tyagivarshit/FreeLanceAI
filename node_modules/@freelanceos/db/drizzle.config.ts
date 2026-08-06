import { defineConfig } from "drizzle-kit";
import { runtimeConfig } from "@freelanceos/config";

export default defineConfig({
  schema: "./src/schema/**/*.ts",
  out: "./migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: runtimeConfig.DATABASE_URL,
  },
  verbose: true,
  strict: true,
});
