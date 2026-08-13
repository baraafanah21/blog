import js from "@eslint/js";
import tseslint from "typescript-eslint";
import globals from "globals";

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  { ignores: ["dist/", "node_modules/", "coverage/"] },
  {
    languageOptions: { globals: { ...globals.node } },
  },
  {
    files: ["**/*.test.ts"],
    languageOptions: { globals: { ...globals.jest } },
  },
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
);
