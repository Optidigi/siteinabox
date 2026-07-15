import { defineConfig } from "vitest/config"
import react from "@vitejs/plugin-react"
import path from "path"

export default defineConfig({
  // tsconfig sets `jsx: "preserve"` for Next.js' SWC pipeline. Vitest's
  // built-in transformer doesn't compile preserved JSX, so we wire the
  // standard React plugin for the test pipeline. Test-runtime only — the
  // Next.js build is unaffected.
  plugins: [react()],
  test: {
    environment: "node",
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    exclude: ["tests/e2e/**"],
    globals: true,
    pool: "forks",
    // Integration tests share a single Postgres test DB; running them in
    // parallel forks creates slug collisions and visibility races. `maxWorkers:
    // 1` (Vitest 4 replacement for the removed `poolOptions.forks.singleFork`)
    // pins to a single worker; `fileParallelism: false` keeps test files
    // strictly sequential on top of that.
    maxWorkers: 1,
    fileParallelism: false,
    testTimeout: 30000
  },
  resolve: {
    // Shared workspace packages render through the CMS React runtime. Keep
    // Radix/provider hooks on that same instance even after tests which reset
    // Vitest's module registry; otherwise full-suite ordering can load a
    // second React instance and fail SSR with an invalid hook dispatcher.
    dedupe: ["react", "react-dom"],
    alias: {
      "@": path.resolve(__dirname, "src"),
      // Stub Next.js' `server-only` marker — not installed in this repo
      // (Next bundles it implicitly), so vitest fails to resolve it
      // when a unit test imports a module guarded by `import "server-only"`.
      "server-only": path.resolve(__dirname, "tests/__mocks__/server-only.ts"),
    }
  }
})
