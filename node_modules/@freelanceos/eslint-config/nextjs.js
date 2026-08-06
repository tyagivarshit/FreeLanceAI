import baseConfig from "./base.js";

export default [
  ...baseConfig,
  {
    languageOptions: {
      globals: {
        window: "readonly",
        document: "readonly",
        navigator: "readonly",
        fetch: "readonly",
        console: "readonly",
      },
    },
  },
];
