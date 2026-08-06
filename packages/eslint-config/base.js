import tsLint from "typescript-eslint";
import prettierConfig from "eslint-config-prettier";

export default tsLint.config(...tsLint.configs.recommended, prettierConfig, {
  languageOptions: {
    parser: tsLint.parser,
    parserOptions: {
      project: true,
    },
  },
  rules: {
    // 1. Strict typing guidelines (Commandment 8)
    "@typescript-eslint/no-explicit-any": "error",
    "@typescript-eslint/explicit-function-return-type": "off",
    "@typescript-eslint/explicit-module-boundary-types": "off",

    // 2. Dead code elimination
    "@typescript-eslint/no-unused-vars": [
      "error",
      {
        args: "after-used",
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
      },
    ],

    // 3. Code consistency
    "no-console": ["warn", { allow: ["warn", "error", "info"] }],
    eqeqeq: ["error", "always", { null: "ignore" }],
    curly: ["error", "all"],
    "no-implicit-coercion": "error",
    "no-var": "error",
    "prefer-const": "error",
  },
});
