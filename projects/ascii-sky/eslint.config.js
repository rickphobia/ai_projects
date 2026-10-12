// @ts-check
import js from "@eslint/js";
import prettier from "eslint-config-prettier";
import { defineConfig } from "eslint/config";
import globals from "globals";
import tseslint from "typescript-eslint";

export default defineConfig(
  { ignores: ["dist", "node_modules"] },
  js.configs.recommended,
  tseslint.configs.strictTypeChecked,
  tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      globals: globals.browser,
      parserOptions: {
        projectService: { allowDefaultProject: ["eslint.config.js"] },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "no-console": "error",
    },
  },
  {
    // This file runs in Node, outside the browser tsconfig, so type-aware rules don't apply.
    files: ["eslint.config.js"],
    extends: [tseslint.configs.disableTypeChecked],
  },
  {
    // The logger is the one place allowed to write to the console.
    files: ["src/logger.ts"],
    rules: { "no-console": "off" },
  },
  prettier,
);
