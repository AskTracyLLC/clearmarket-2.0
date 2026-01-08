import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
  // Prevent pages from importing layout/nav components (nav is handled by App.tsx)
  {
    files: ["src/pages/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@/components/AuthenticatedLayout",
              message: "Pages should not import AuthenticatedLayout. App.tsx wraps all authenticated routes.",
            },
            {
              name: "@/components/layout/AppShell",
              message: "Pages should not import AppShell. App.tsx wraps all authenticated routes.",
            },
            {
              name: "@/components/layout/TopNavRow",
              message: "Pages should not import TopNavRow. Navigation is handled globally by AuthenticatedLayout.",
            },
            {
              name: "@/components/layout/TopHeader",
              message: "Pages should not import TopHeader. Navigation is handled globally by AuthenticatedLayout.",
            },
            {
              name: "@/components/layout/LeftSidebar",
              message: "Pages should not import LeftSidebar. Navigation is handled globally by AuthenticatedLayout.",
            },
          ],
        },
      ],
    },
  },
);
