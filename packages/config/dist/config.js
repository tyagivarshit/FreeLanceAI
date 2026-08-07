import { environmentSchema } from "./schema.js";
export function loadRuntimeConfig() {
    const result = environmentSchema.safeParse(process.env);
    if (!result.success) {
        const errorDetails = result.error.errors
            .map((err) => `  - ${err.path.join(".")}: ${err.message}`)
            .join("\n");
        throw new Error(`[Config Error] Runtime configuration validation failed:\n${errorDetails}\n`);
    }
    // Freeze the configuration object to enforce immutability
    if (process.env.NODE_ENV === "test") {
        return result.data;
    }
    return Object.freeze(result.data);
}
// Global cached config instance loaded on import
export const runtimeConfig = loadRuntimeConfig();
//# sourceMappingURL=config.js.map