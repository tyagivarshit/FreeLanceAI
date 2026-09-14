export class PromptBuilderEngine {
    registry;
    constructor(registry) {
        this.registry = registry;
    }
    async buildPayload(tenantId, layout, variables, history = []) {
        const messages = [];
        if (!layout || !layout.blocks) {
            return messages;
        }
        for (const block of layout.blocks) {
            if (block.type === "system_prompt" || block.type === "user_prompt") {
                let rawText = block.staticText || "";
                // Dynamically fetch from Prompt Registry if a reference is provided
                if (block.promptKey) {
                    const registryText = await this.registry.getActivePromptTemplate(tenantId, block.promptKey);
                    if (registryText) {
                        rawText = registryText;
                    }
                }
                if (rawText) {
                    // Secure compileTemplate engine via Regex replacement: /\{\{\s*(\w+)\s*\}\}/g
                    const compiled = rawText.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key) => {
                        return variables[key] !== undefined ? variables[key] : match;
                    });
                    const role = block.role || (block.type === "system_prompt" ? "system" : "user");
                    messages.push({ role, content: compiled });
                }
            }
            else if (block.type === "memory") {
                const limit = block.metadata?.memoryLimit || 10;
                const slicedHistory = history.slice(-limit);
                for (const msg of slicedHistory) {
                    messages.push(msg);
                }
            }
            else if (block.type === "rag_context") {
                if (block.staticText) {
                    messages.push({ role: block.role || "system", content: block.staticText });
                }
            }
        }
        return messages;
    }
}
