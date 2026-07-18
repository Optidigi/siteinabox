#!/usr/bin/env node
/**
 * Build runtime helper bundles under `dist-runtime/`.
 *
 * Why this exists: the production Docker image is built from Next.js's
 * `.next/standalone` output. Next's tracer inlines Payload's runtime code
 * into `server.js` and does NOT preserve `node_modules/payload`,
 * `@payloadcms/*`, `pg`, or `drizzle-orm` as importable packages — verified
 * empirically: only `graphql`, `next`, `react`, and `typescript` survive in
 * the runner image's `node_modules/`. Therefore any auxiliary script (like
 * the boot-time migration runner) that needs `import "payload"` must be
 * pre-bundled with payload + adapters inlined.
 *
 * The bundle is produced by esbuild from `scripts/migrate-on-boot-entry.ts`,
 * which statically imports the Payload config AND every migration's up/down
 * via `src/migrations/index.ts`. Calling `payload.db.migrate({ migrations })`
 * with the explicit array sidesteps Drizzle's `readMigrationFiles` directory
 * scan — esbuild can't bundle `readdirSync()` + dynamic `import()` of
 * runtime-discovered files, but it CAN inline a static import graph.
 *
 * Externalised:
 * - `pg-native`: optional libpq native bindings; `pg` falls back to its
 *   pure-JS socket implementation when absent. Bundling would force-resolve
 *   the native binary, breaking on alpine.
 * - `cloudflare:sockets`: referenced by `pg-cloudflare` (a transitive of
 *   `pg`'s edge-runtime variant). Not used on node; esbuild treats it as
 *   an unresolvable bare specifier without this hint.
 * - Node builtins: esbuild handles automatically with `platform: "node"`.
 *
 * Output: self-contained `.mjs` files the Dockerfile copies into
 * `/app/dist-runtime/` for boot-time and operator-run production tasks.
 */
import { build } from "esbuild"
import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const repoRoot = path.resolve(__dirname, "..")
const outDir = path.join(repoRoot, "dist-runtime")

await mkdir(outDir, { recursive: true })

const sharedBuildOpts = {
  bundle: true,
  format: "esm",
  platform: "node",
  target: "node22",
  // Resolve `@/...` like tsconfig + Next do so entries can import
  // `@/payload.config`, `@/migrations`, `@/lib/richText/*`, etc.
  alias: {
    "@": path.join(repoRoot, "src"),
    "server-only": path.join(repoRoot, "scripts/server-only-shim.ts")
  },
  loader: { ".ts": "ts" },
  external: [
    "pg-native",
    "cloudflare:sockets"
  ],
  // payload + a few transitives use top-level await; node22 supports it
  // natively and esbuild needs format=esm + a TLA-capable target.
  supported: { "top-level-await": true },
  // Bundling CJS deps (`ws`, `pg` internals, etc.) into an ESM output makes
  // esbuild emit `__require()` shims for builtins like `events`. In pure
  // ESM those shims fail with "Dynamic require of X is not supported"
  // because there's no `require` in scope. Inject a `createRequire`-based
  // shim at the top of the bundle so all CJS-style requires resolve.
  banner: {
    js: [
      "import { createRequire as __createSiabRequire } from 'node:module';",
      "import { fileURLToPath as __siabFileURLToPath } from 'node:url';",
      "const require = __createSiabRequire(import.meta.url);",
      "const __filename = __siabFileURLToPath(import.meta.url);",
      "const __dirname = __filename.slice(0, __filename.lastIndexOf('/'));"
    ].join("\n")
  },
  // Silence noisy "this dynamic import will not be analyzed" warnings —
  // they come from payload's adapter-loading code paths we don't exercise
  // at migration / repopulate time (admin UI, jobs runtime, richtext editor
  // server pieces). Any genuinely-needed dynamic import resolves at runtime
  // against the inlined module graph.
  logOverride: {
    "unsupported-dynamic-import": "silent"
  },
  logLevel: "info"
}

await build({
  ...sharedBuildOpts,
  entryPoints: [path.join(repoRoot, "scripts/migrate-on-boot-entry.ts")],
  outfile: path.join(outDir, "migrate-on-boot.bundled.mjs"),
})

await build({
  ...sharedBuildOpts,
  entryPoints: [path.join(repoRoot, "scripts/legal-sync-on-boot-entry.ts")],
  outfile: path.join(outDir, "legal-sync-on-boot.bundled.mjs"),
})

await build({
  ...sharedBuildOpts,
  entryPoints: [path.join(repoRoot, "scripts/retry-legal-notification.ts")],
  outfile: path.join(outDir, "retry-legal-notification.bundled.mjs"),
})

// One-off repopulation tool (rt-v2 post-migration recovery). See script
// header for invocation. Bundled here so it ships in the Docker image's
// /app/dist-runtime/ and can be invoked via `docker exec siteinabox-cms node
// /app/dist-runtime/repopulate-richtext-from-snapshot.bundled.mjs ...`.
await build({
  ...sharedBuildOpts,
  entryPoints: [path.join(repoRoot, "scripts/repopulate-richtext-from-snapshot-entry.ts")],
  outfile: path.join(outDir, "repopulate-richtext-from-snapshot.bundled.mjs"),
})

// Operator-run renderer staging bootstrap. This ships in the CMS runtime image
// so production seeding uses the same reviewed image artifact as the app,
// without depending on TS source files, pnpm, or dev dependencies in the
// container.
await build({
  ...sharedBuildOpts,
  entryPoints: [path.join(repoRoot, "scripts/seed-renderer-staging-tenants.ts")],
  outfile: path.join(outDir, "seed-renderer-staging-tenants.bundled.mjs"),
})

// Mark the directory as ESM so any `.js` peers parse as module syntax.
// Belt-and-braces: the bundled output is `.mjs`, but a sibling package.json
// keeps behaviour explicit and protects against future renames.
await writeFile(
  path.join(outDir, "package.json"),
  JSON.stringify({ type: "module" }, null, 2)
)

// eslint-disable-next-line no-console
console.log(
  `[build-runtime-bundle] wrote runtime bundles to ${outDir}`
)
