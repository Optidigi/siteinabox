import { getPayload, type Payload } from "payload"
import config from "@/payload.config"

let cachedPayload: Payload | null = null

// OBS-66 — bring the test database to a known, migration-tracked state
// before any integration test runs. Without this, Payload's dev-mode
// push auto-syncs the schema and the `payload_migrations` table holds
// only a placeholder "dev" row. That works for queries but means:
//   1. `payload migrate:status` against payload_test is meaningless.
//   2. Schema-shaped bugs that only surface after a real migration
//      runs (enum value drift, FK-cascade behaviour, etc.) are masked.
//   3. CI Postgres starts empty, so the production behaviour (migrations
//      define the schema) and the local-test behaviour diverge silently.
//
// migrateFresh drops everything and reapplies all committed migrations.
// Equivalent to a fresh-DB `migrate()` in CI, and forces local devs onto
// the same code path. Cached behind `cachedPayload`, runs once per process
// (vitest.config.ts pins maxWorkers: 1 so this is one run per `pnpm test`).
//
// resetTestData() still wipes data between tests for isolation — it works
// on tables, not schema, so the two concerns layer cleanly.
export async function getTestPayload(): Promise<Payload> {
  if (cachedPayload) return cachedPayload
  const payload = await getPayload({ config })
  // `forceAcceptWarning: true` skips the interactive prompt that the
  // postgres adapter's migrateFresh() shows when run from a TTY (see
  // node_modules/@payloadcms/drizzle/dist/migrateFresh.js:9-23).
  await payload.db.migrateFresh({ forceAcceptWarning: true })
  cachedPayload = payload
  return cachedPayload
}

export async function resetTestData(payload: Payload) {
  // Wipe collections in dependency order to satisfy FKs.
  // Forms first (FK to tenant), then pages, media, site-settings, then users
  // (which can reference tenant), then tenants last.
  for (const slug of ["forms", "pages", "media", "site-settings", "users", "tenants"] as const) {
    const docs = await payload.find({ collection: slug, limit: 1000, overrideAccess: true })
    for (const d of docs.docs) {
      await payload.delete({
        collection: slug,
        id: d.id,
        overrideAccess: true,
        context: { allowUnsafeUserDelete: true },
      })
    }
  }
}

export async function seedFixture(payload: Payload) {
  const t1 = await payload.create({
    collection: "tenants",
    data: { name: "Tenant 1", slug: "t1", domain: "t1.test", status: "active" },
    overrideAccess: true
  })
  const t2 = await payload.create({
    collection: "tenants",
    data: { name: "Tenant 2", slug: "t2", domain: "t2.test", status: "active" },
    overrideAccess: true
  })

  const sa = await payload.create({
    collection: "users",
    data: { email: "sa@test.local", password: "test1234", name: "SA", role: "super-admin" },
    overrideAccess: true
  })
  const owner1 = await payload.create({
    collection: "users",
    data: { email: "owner1@test.local", password: "test1234", name: "Owner1", role: "owner", tenants: [{ tenant: t1.id }] },
    overrideAccess: true
  })
  const editor1 = await payload.create({
    collection: "users",
    data: { email: "editor1@test.local", password: "test1234", name: "Editor1", role: "editor", tenants: [{ tenant: t1.id }] },
    overrideAccess: true
  })
  const viewer1 = await payload.create({
    collection: "users",
    data: { email: "viewer1@test.local", password: "test1234", name: "Viewer1", role: "viewer", tenants: [{ tenant: t1.id }] },
    overrideAccess: true
  })
  const owner2 = await payload.create({
    collection: "users",
    data: { email: "owner2@test.local", password: "test1234", name: "Owner2", role: "owner", tenants: [{ tenant: t2.id }] },
    overrideAccess: true
  })

  return { t1, t2, sa, owner1, editor1, viewer1, owner2 }
}
