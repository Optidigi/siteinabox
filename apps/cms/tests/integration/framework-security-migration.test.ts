import { beforeAll, describe, expect, it } from "vitest"
import type { PayloadRequest } from "payload"
import { down } from "@/migrations/20261020_181335_cms_framework_security"
import { migrations } from "@/migrations"
import { getTestPayload, resetTestData, seedFixture } from "./_helpers"

let payload: Awaited<ReturnType<typeof getTestPayload>>
beforeAll(async () => { payload = await getTestPayload() }, 30_000)

describe("CMS framework security migration", () => {
  it("adds nullable reset throttling on fresh migrations and preserves populated tenant/access/content on upgrade", async () => {
    await resetTestData(payload)
    const fixture = await seedFixture(payload)
    const page = await payload.create({
      collection: "pages", overrideAccess: true,
      data: { tenant: fixture.t1.id, title: "Sanitized Amicare representative", slug: "upgrade-fixture", status: "published" },
    })
    const beforeUser = await payload.findByID({ collection: "users", id: fixture.owner1.id, overrideAccess: true })
    const beforePage = await payload.findByID({ collection: "pages", id: page.id, overrideAccess: true })
    expect(beforeUser.resetPasswordRequestedAt).toBeUndefined()

    // Rehearse the prior schema on this explicitly owned disposable database.
    // Only the new nullable field and its real migration tracking row are removed.
    await down({ db: payload.db.drizzle, payload, req: {} as PayloadRequest })
    const removed = await payload.db.execute({ drizzle: payload.db.drizzle, raw:
      "DELETE FROM payload_migrations WHERE name = '20261020_181335_cms_framework_security' RETURNING name" })
    expect(removed.rows).toHaveLength(1)
    await payload.db.migrate({ migrations: migrations as unknown as NonNullable<Parameters<typeof payload.db.migrate>[0]>["migrations"] })

    const afterUser = await payload.findByID({ collection: "users", id: fixture.owner1.id, overrideAccess: true })
    expect(afterUser).toEqual(beforeUser)
    expect(await payload.findByID({ collection: "pages", id: page.id, overrideAccess: true })).toEqual(beforePage)
    await expect(payload.findByID({ collection: "pages", id: page.id, user: fixture.owner2, overrideAccess: false })).rejects.toThrow()
    expect((await payload.findByID({ collection: "pages", id: page.id, user: fixture.owner1, overrideAccess: false })).id).toBe(page.id)

    const requestedAt = "2026-10-20T10:00:00.000Z"
    await payload.update({ collection: "users", id: fixture.owner1.id, overrideAccess: true,
      data: { resetPasswordRequestedAt: requestedAt } })
    const persisted = await payload.db.execute({ drizzle: payload.db.drizzle, raw:
      `SELECT reset_password_requested_at FROM users WHERE id = ${fixture.owner1.id}` })
    expect(new Date(String(persisted.rows[0]?.reset_password_requested_at)).toISOString()).toBe(requestedAt)
    // The production adapter/index path is idempotent once tracked.
    await payload.db.migrate({ migrations: migrations as unknown as NonNullable<Parameters<typeof payload.db.migrate>[0]>["migrations"] })
    expect((await payload.findByID({ collection: "users", id: fixture.owner1.id, overrideAccess: true, showHiddenFields: true })).resetPasswordRequestedAt).toBe(requestedAt)
  }, 30_000)
})
