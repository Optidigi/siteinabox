import tsParser from "@typescript-eslint/parser"
import tsPlugin from "@typescript-eslint/eslint-plugin"
import * as astroParser from "astro-eslint-parser"
import astroPlugin from "eslint-plugin-astro"
import * as astroClientParser from "./scripts/type-safety/astro-client-parser.mjs"

const unsafeRules = {
  "@typescript-eslint/no-unsafe-assignment": "error",
  "@typescript-eslint/no-unsafe-call": "error",
  "@typescript-eslint/no-unsafe-member-access": "error",
  "@typescript-eslint/no-unsafe-return": "error",
  "@typescript-eslint/no-unsafe-argument": "error",
}

// Syntax escape policy is checked separately across all source formats and fixtures.
// Typed rules cover runtime consumers of JSON and library values, including operations.
export default [
  { linterOptions: { noInlineConfig: true } },
  { ignores: ["**/node_modules/**", "**/.next/**", "**/dist/**", "**/.astro/**", "**/artifacts/**"] },
  {
    files: ["apps/cms/src/**/*.{ts,tsx}", "apps/cms/scripts/**/*.ts", "apps/renderer/src/**/*.{ts,tsx}", "apps/landing/src/**/*.{ts,tsx}", "packages/*/src/**/*.{ts,tsx}"],
    ignores: ["**/*.test.ts", "**/*.test.tsx", "**/*.d.ts", "apps/cms/src/payload-types.ts"],
    languageOptions: {
      parser: tsParser,
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    plugins: { "@typescript-eslint": tsPlugin },
    rules: unsafeRules,
  },
  {
    files: ["packages/legal-content/src/*.js", "apps/renderer/src/lib/analytics-config.js", "apps/renderer/src/lib/pathname.js", "scripts/type-safety/*.mjs"],
    languageOptions: { parser: tsParser, parserOptions: { project: "./tsconfig.javascript.json", tsconfigRootDir: import.meta.dirname } },
    plugins: { "@typescript-eslint": tsPlugin },
    rules: unsafeRules,
  },
  {
    files: ["apps/{landing,renderer}/src/**/*.astro"],
    languageOptions: { parser: astroParser, parserOptions: { parser: tsParser, project: true, projectService: false, extraFileExtensions: [".astro"], tsconfigRootDir: import.meta.dirname } },
    plugins: { "@typescript-eslint": tsPlugin, astro: astroPlugin },
    processor: "astro/client-side-ts",
    rules: unsafeRules,
  },
  {
    files: ["apps/{landing,renderer}/src/**/*.astro/*.ts"],
    languageOptions: { parser: astroClientParser, parserOptions: { project: null, projectService: false, tsconfigRootDir: import.meta.dirname } },
    plugins: { "@typescript-eslint": tsPlugin },
    rules: unsafeRules,
  },
]
