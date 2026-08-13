import baseConfig from "./packages/eslint-config/base.js";

export default [
  ...baseConfig,
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/build/**",
      "**/.next/**",
      "**/.turbo/**",
      "**/migrations/**",
      "apps/web/server.js",
    ],
  },
];
