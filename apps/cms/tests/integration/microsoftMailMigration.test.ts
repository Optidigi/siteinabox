import { afterAll, beforeAll, expect, it } from "vitest"
import type { Payload } from "payload"
import { sql } from "@payloadcms/db-postgres"
import { getTestPayload } from "./_helpers"
import { migrations } from "@/migrations"

let payload: Payload
beforeAll(async () => { payload = await getTestPayload() })
afterAll(async () => { await payload?.destroy() })

it("upgrades an existing website customer without adding email or losing its content metadata", async () => {
  const split = migrations.findIndex(value => value.name === "20261026_185822_microsoft_mail_paid_orders")
  expect(split).toBeGreaterThan(0)
  type DropArgs = Parameters<typeof payload.db.dropDatabase>[0]
  type MigrateArgs = NonNullable<Parameters<typeof payload.db.migrate>[0]>
  await payload.db.dropDatabase({ adapter: payload.db as DropArgs["adapter"] })
  await payload.db.migrate({ migrations: migrations.slice(0,split) as unknown as MigrateArgs["migrations"] })
  await payload.db.drizzle.execute(sql`INSERT INTO tenants (name, slug, domain, status, notes)
    VALUES ('Existing website fixture', 'existing-website-fixture', 'existing-website.fixture.test', 'active', 'Preserve this metadata')`)
  await payload.db.migrate({ migrations: migrations as unknown as MigrateArgs["migrations"] })
  const tenants = await payload.find({ collection: "tenants", where: { slug: { equals: "existing-website-fixture" } }, depth: 0, overrideAccess: true })
  expect(tenants.docs).toHaveLength(1)
  expect(tenants.docs[0]?.enabledServices).toEqual(["website"])
  expect(tenants.docs[0]?.domain).toBe("existing-website.fixture.test")
  expect(tenants.docs[0]?.notes).toBe("Preserve this metadata")
  expect(tenants.docs[0]?.platformPricing?.mode).toBe("standard")
  const { up } = await import("@/migrations/20261026_190140_mail_workspace_defaults")
  type BackfillArgs = Parameters<typeof up>[0]
  await up({ db: payload.db.drizzle, payload, req: {} } as BackfillArgs)
  const grants = await payload.db.drizzle.execute(sql`SELECT value FROM tenants_enabled_services WHERE parent_id = ${tenants.docs[0]!.id}`)
  expect(grants.rows).toHaveLength(1)
})
