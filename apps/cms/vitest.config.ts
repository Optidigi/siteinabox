import { cmsTestInclude, cmsTestExclude, cmsTestPlan } from "./tests/_helpers/testPlan.mjs"
import { defineConfig } from "vitest/config"
import react from "@vitejs/plugin-react"
import path from "node:path"

const requestedPartition = process.env.SIAB_TEST_CMS_PARTITION
const selected = requestedPartition ? cmsTestPlan(import.meta.dirname).partitions[requestedPartition] : cmsTestInclude
if (!selected) throw new Error("Unknown canonical CMS test partition")

export default defineConfig({
  // tsconfig sets `jsx: "preserve"` for Next.js' SWC pipeline. Vitest's
  // built-in transformer doesn't compile preserved JSX, so we wire the
  // standard React plugin for the test pipeline. Test-runtime only — the
  // Next.js build is unaffected.
  plugins: [react()],
  test: {
    environment: "node",
    setupFiles: ["./tests/setup.ts"],
    include: selected,
    exclude: cmsTestExclude,
    globals: true,
    pool: "forks",
    // Each partition owns one database; serialize files within that partition.
    maxWorkers: 1,
    fileParallelism: false,
    testTimeout: 30000
  },
  resolve: {
    // Shared renderer/UI packages are workspace source dependencies. Force
    // their JSX and the CMS test renderer onto one React module identity.
    dedupe: ["react", "react-dom"],
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      // Stub Next.js' `server-only` marker — not installed in this repo
      // (Next bundles it implicitly), so vitest fails to resolve it
      // when a unit test imports a module guarded by `import "server-only"`.
      "server-only": path.resolve(import.meta.dirname, "tests/__mocks__/server-only.ts"),
    }
  }
})
