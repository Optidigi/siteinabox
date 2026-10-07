/**
 * Bundle entry-point for `dist-runtime/migrate-on-boot.bundled.mjs`.
 *
 * This is the file esbuild ingests in `scripts/build-runtime-bundle.mjs`.
 * It statically imports the Payload config AND the migrations array, so the
 * bundler can inline everything — payload, db-postgres, drizzle, pg, the
 * config, every migration's up/down — into a single self-contained `.mjs`
 * that runs in the Next.js standalone runner image (which does NOT preserve
 * `node_modules/payload` as an importable package).
 *
 * The unbundled twin at `scripts/migrate-on-boot.mjs` exists only as the
 * test harness's source-of-truth (imported by `tests/unit/migrate-on-boot.test.ts`
 * which patches `await import("payload")` with a stub). The two scripts
 * share the same control flow: read migration count, run, diff, exit.
 *
 * Why pass `migrations` directly to `payload.db.migrate()` instead of
 * `migrationDir`: the directory route forces Payload's `readMigrationFiles`
 * to `readdirSync()` + dynamic-`import()` each migration file at runtime,
 * which esbuild cannot bundle. Drizzle's adapter accepts an explicit
 * `migrations` arg on `migrate({ migrations })`, sidestepping the FS.
 */
import { getPayload, type Payload } from "payload"

import { migrations } from "@/migrations"
import config from "@/payload.config"

// Suppress admin-only initialisation paths; we only need the DB adapter.
process.env.PAYLOAD_DISABLE_ADMIN = "true"

// Drizzle's migrate() will prompt on stdin via the `prompts` package if it
// finds a `payload_migrations` row with `batch === -1` (the marker
// `payload db:push` leaves behind from dev-mode schema-push bootstraps). In
// a Docker entrypoint there is no TTY; the prompt hangs forever — Docker's
// `restart: unless-stopped` doesn't catch a zero-progress process. The
// `process.stdin.destroy()` call below is belt-and-braces but does NOT
// short-circuit the prompt's render loop — empirically observed on the first
// prod deploy with a leftover `dev`/`batch:-1` row from Phase 17 push:true
// bootstrap. The real fix lives in `purgeDevMigrationMarker` below: we
// surgically delete the `batch === -1` row inside our wrapper BEFORE invoking
// drizzle's migrate(), so the prompt never fires. See I-1 in the wave 2-3 review.
process.stdin.destroy()

/**
 * Return the count of rows in `payload_migrations`, or 0 if the table doesn't
 * exist yet (i.e. fresh DB before the first migration ever ran). We can't use
 * `payload.count({ collection: "payload-migrations" })` directly because it
 * unconditionally issues a `select count(*) from "payload_migrations"` which
 * fails with Postgres error 42P01 against an empty schema.
 */
async function safeMigrationCount(payload: Pick<Payload, "db" | "count">): Promise<number> {
  const db = payload.db as {
    execute?: (args: { drizzle?: unknown; raw: string }) => Promise<{ rows: Array<Record<string, unknown>> }>
    drizzle?: unknown
    schemaName?: string
  }
  if (typeof db.execute === "function") {
    const prependSchema = db.schemaName ? `"${db.schemaName}".` : ""
    const res = await db.execute({
      drizzle: db.drizzle,
      raw: `SELECT to_regclass('${prependSchema}"payload_migrations"') AS exists;`
    })
    const [row] = res.rows
    const exists = row && typeof row === "object" && "exists" in row && !!row.exists
    if (!exists) return 0
  }
  const { totalDocs } = await payload.count({
    collection: "payload-migrations",
    overrideAccess: true
  })
  return totalDocs
}

/**
 * Remove any `batch === -1` rows from `payload_migrations`. Drizzle's migrate()
 * treats those as "dev-pushed schema, prompt for confirmation before running
 * real migrations" — which hangs forever in a Docker entrypoint. The row is a
 * Payload-bootstrap artifact from `push:true` runs; once we have real
 * migrations, the row is meaningless. Idempotent: no-op if no such row exists.
 */
async function purgeDevMigrationMarker(payload: { db: unknown }): Promise<void> {
  const db = payload.db as {
    execute?: (args: { drizzle?: unknown; raw: string }) => Promise<{ rows: Array<Record<string, unknown>> }>
    drizzle?: unknown
    schemaName?: string
  }
  if (typeof db.execute !== "function") return
  // Only attempt the DELETE if the table exists; on a totally fresh DB it
  // doesn't, and we'd crash with 42P01 the same way safeMigrationCount avoids.
  const prependSchema = db.schemaName ? `"${db.schemaName}".` : ""
  const probe = await db.execute({
    drizzle: db.drizzle,
    raw: `SELECT to_regclass('${prependSchema}"payload_migrations"') AS exists;`
  })
  const [row] = probe.rows
  const exists = row && typeof row === "object" && "exists" in row && !!row.exists
  if (!exists) return
  const res = await db.execute({
    drizzle: db.drizzle,
    raw: `DELETE FROM ${prependSchema}"payload_migrations" WHERE batch = -1;`
  })
  // drizzle's `execute` doesn't return a rowCount on the postgres adapter,
  // so we just log unconditionally on the first boot after dev-bootstrap.
  // No-op deletes are silent.
  void res
}

const start = Date.now()

try {
  const payload = await getPayload({ config })

  // BEFORE invoking drizzle's migrate(), purge any `batch === -1` row from
  // payload_migrations. Such rows are dev-mode bootstrap markers; their mere
  // presence makes drizzle prompt on stdin ("schema was push-applied, are you
  // sure?"), which deadlocks in a TTY-less container. See I-1.
  await purgeDevMigrationMarker(payload)

  // Diff `payload-migrations` rows before/after to count what was applied,
  // since adapter.migrate() doesn't return a count. On a fresh DB the table
  // doesn't exist yet, so any `payload.count` call would explode with
  // `relation "payload_migrations" does not exist` (Postgres 42P01). Probe
  // first via the same `to_regclass` trick `@payloadcms/drizzle` uses
  // internally — see node_modules/@payloadcms/drizzle/dist/utilities/migrationTableExists.js.
  const beforeCount = await safeMigrationCount(payload)

  // Pass the bundled migrations array explicitly — Drizzle's `migrate`
  // accepts `args.migrations` and uses it instead of scanning the
  // configured migrationDir. Cast: types/runtime mismatch (Payload's public
  // BaseDatabaseAdapter.migrate is loosely typed), runtime contract verified
  // in @payloadcms/drizzle/dist/migrate.js.
  await (payload.db.migrate as (args?: { migrations?: typeof migrations }) => Promise<void>)({
    migrations
  })

  // After migrate() runs, the table is guaranteed to exist (drizzle's
  // migration runner creates it as part of applying any migration).
  const after = await payload.count({
    collection: "payload-migrations",
    overrideAccess: true
  })

  const applied = Math.max(0, after.totalDocs - beforeCount)
  const ms = Date.now() - start
  if (applied === 0) {
    console.log(`[migrate-on-boot] no pending migrations (${ms}ms)`)
  } else {
    console.log(`[migrate-on-boot] ${applied} migration(s) applied (${ms}ms)`)
  }

  // Payload keeps the pg pool alive; close it so the script exits promptly.
  await payload.db.destroy?.()
  process.exit(0)
} catch (err) {
  console.error("[migrate-on-boot] FAILED:", err)
  process.exit(1)
}
