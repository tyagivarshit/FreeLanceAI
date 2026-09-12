const fs = require("fs");
let content = fs.readFileSync("packages/core/src/index.ts", "utf8");

// Remove old PromptBuilder exports
content = content.replace(/export \{[\s\S]*?\} from "\.\/prompt-builder\.js";/g, "");

// Export new Engine
content += `\nexport { PromptBuilderEngine } from "./prompt-builder.js";\n`;
content += `export type { PipelineLayout, CompositionBlock, IPromptRegistryFetcher } from "./prompt-builder.js";\n`;

fs.writeFileSync("packages/core/src/index.ts", content);
