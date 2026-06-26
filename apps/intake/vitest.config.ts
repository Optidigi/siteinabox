import { defineConfig } from "vitest/config"

// Local vitest config — isolates the template's tests from any parent
// monorepo vitest config that may exist in deploy-siab-payload (which
// has its own `tests/setup.ts` for the admin/CMS integration tests).
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    globals: false,
  },
})
