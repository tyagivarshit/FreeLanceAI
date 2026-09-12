export interface CompositionBlock {
  type: "system_prompt" | "user_prompt" | "memory" | "rag_context";
  role?: "system" | "user" | "assistant";
  promptKey?: string; // Reference to a template in the Prompt Registry (3B)
  staticText?: string; // Hardcoded fallback text
  metadata?: Record<string, any>; // Extra config for future blocks (e.g., memory limits)
}

export interface PipelineLayout {
  blocks: CompositionBlock[];
}

export interface PromptRegistryService {
  getActivePromptTemplate(tenantId: string, promptKey: string): Promise<string | null>;
}

export class PromptBuilderEngine {
  constructor(private registry: PromptRegistryService) {}

  public async buildPayload(
    tenantId: string,
    layout: PipelineLayout,
    variables: Record<string, string>,
    history: Array<{ role: string; content: string }> = []
  ): Promise<Array<{ role: string; content: string }>> {
    const messages: Array<{ role: string; content: string }> = [];

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
      } else if (block.type === "memory") {
        const limit = block.metadata?.memoryLimit || 10;
        const slicedHistory = history.slice(-limit);
        for (const msg of slicedHistory) {
          messages.push(msg);
        }
      } else if (block.type === "rag_context") {
        if (block.staticText) {
          messages.push({ role: block.role || "system", content: block.staticText });
        }
      }
    }

    return messages;
  }
}
