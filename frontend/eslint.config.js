// ESLint 9 flat config for the frontend workspace.
//
// `npm run lint` (CI: `frontend` job) runs `eslint "src/.../*.{ts,tsx}"` with
// cwd = frontend/, so this file lives next to the linted sources.
//
// Rule set:
//  - ESLint recommended (core)
//  - typescript-eslint recommended (non-type-aware; the core `no-undef` /
//    `no-unused-vars` checks are superseded by the TS-aware equivalents)
//  - react-hooks recommended + react-refresh (only-export-components stays a
//    warning, not a failure — constants may be exported freely)

import js from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist", "coverage"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],
    },
  },
);
