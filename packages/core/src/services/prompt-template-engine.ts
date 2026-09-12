export class MissingTemplateVariableError extends Error {
  constructor(variableName: string) {
    super(`Missing required template variable: ${variableName}`);
    this.name = "MissingTemplateVariableError";
  }
}

export class PromptInjectionError extends Error {
  constructor() {
    super(`Potential prompt injection detected. Template characters '{' or '}' are not allowed in variables.`);
    this.name = "PromptInjectionError";
  }
}

export class PromptTemplateEngine {
  /**
   * Securely injects variables into a prompt template.
   * Prevents nested templating injections by sanitizing input.
   * 
   * @param template The raw prompt text containing {{variable}} tags
   * @param variables The dictionary of values to inject
   * @returns The final safe string
   */
  public static compile(template: string, variables: Record<string, string>): string {
    const templateRegex = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

    return template.replace(templateRegex, (_match, varName) => {
      const rawValue = variables[varName];

      if (rawValue === undefined || rawValue === null) {
        throw new MissingTemplateVariableError(varName);
      }

      const stringValue = String(rawValue);

      // Security Check: Prevent Prompt Injection (Nested Templates)
      if (stringValue.includes("{") || stringValue.includes("}")) {
        // Strip out the curly braces to disarm the injection
        const safeValue = stringValue.replace(/[{}]/g, "");
        console.warn(`[Security] Sanitized potential prompt injection in variable: ${varName}`);
        return safeValue;
      }

      return stringValue;
    });
  }

  /**
   * Extracts expected variable names from a template
   */
  public static extractVariables(template: string): string[] {
    const templateRegex = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;
    const matches = [...template.matchAll(templateRegex)];
    return [...new Set(matches.map(m => m[1] as string))]; // Return unique variable names
  }
}
