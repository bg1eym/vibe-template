import js from "@eslint/js";
import eslintConfigPrettier from "eslint-config-prettier";
import tseslint from "typescript-eslint";

export default [
  js.configs.recommended,
  ...tseslint.configs.recommended,
  eslintConfigPrettier,

  // Default TS rules for the repo (template-friendly)
  {
    files: ["**/*.ts"],
    rules: {
      // Template: allow "any" where it removes friction (Fastify handlers/tests).
      // Tighten later if needed.
      "@typescript-eslint/no-explicit-any": "off",

      // Keep unused vars strict, but allow underscore-prefixed names
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },

  // Tests can be even looser
  {
    files: ["tests/**/*.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },

  {
    ignores: ["dist/**", "node_modules/**", "coverage/**"],
  },
];
