import { describe, it, expect, beforeAll, beforeEach } from "vitest"
import { errLike } from "../_helpers/cast"
import { getTestPayload, resetTestData, seedFixture } from "./_helpers"
import type { Payload } from "payload"

let payload: Payload
let fx: Awaited<ReturnType<typeof seedFixture>>

beforeAll(async () => { payload = await getTestPayload() }, 30000)

beforeEach(async () => {
  await resetTestData(payload)
  fx = await seedFixture(payload)
  // Add content to t1 and t2 so the isolation queries have something to find/miss.
  await payload.create({
    collection: "pages", overrideAccess: true,
    data: { tenant: fx.t1.id, title: "T1 page", slug: "t1-page", status: "published" }
  })
  await payload.create({
    collection: "pages", overrideAccess: true,
    data: { tenant: fx.t2.id, title: "T2 page", slug: "t2-page", status: "published" }
  })
}, 30000)

const scopedCollections = ["pages", "media", "site-settings", "forms"] as const

// Helper: assert that a Payload local-API call performed with `overrideAccess: false`
// either rejects (Forbidden) OR returns zero docs. Both indicate the caller
// could not see the data — i.e. tenant isolation is enforced.
async function expectNoCrossTenantRead(promise: Promise<{ docs: unknown[] }>) {
  try {
    const res = await promise
    expect(res.docs.length).toBe(0)
  } catch (e: unknown) {
    // Forbidden / access denied — also acceptable, even stronger.
    expect(String(errLike(e).message ?? e)).toMatch(/forbidden|not allowed|access/i)
  }
}

describe("tenant isolation — scoped collections", () => {
  for (const slug of scopedCollections) {
    describe(`collection: ${slug}`, () => {
      it("editor in t1 cannot read t2 docs by explicit filter", async () => {
        await expectNoCrossTenantRead(payload.find({
          collection: slug,
          user: fx.editor1,
          overrideAccess: false,
          where: { tenant: { equals: fx.t2.id } },
          limit: 100
        }))
      })

      it("editor in t1 only sees own-tenant docs in unfiltered list", async () => {
        // With the multi-tenant plugin's withTenantAccess wrapper and the
        // tenants[] array on the user, the plugin scopes reads to the user's
        // tenant. We expect every returned doc to be in t1.
        const res = await payload.find({
          collection: slug, user: fx.editor1, overrideAccess: false, limit: 100
        })
        for (const d of res.docs) {
          const tenantId = typeof d.tenant === "object" && d.tenant ? d.tenant.id : d.tenant
          if (tenantId != null) expect(tenantId).toBe(fx.t1.id)
        }
      })
    })
  }
})

describe("tenant isolation — write attempts", () => {
  it("editor in t1 cannot update a t2 page", async () => {
    const t2Page = (await payload.find({
      collection: "pages", overrideAccess: true,
      where: { tenant: { equals: fx.t2.id } }, limit: 1
    })).docs[0]!
    expect(t2Page).toBeTruthy()
    await expect(
      payload.update({ collection: "pages", id: t2Page.id, user: fx.editor1, overrideAccess: false, data: { title: "hacked" } })
    ).rejects.toThrow()
  })

  it("editor in t1 cannot delete a t2 page", async () => {
    const t2Page = (await payload.find({
      collection: "pages", overrideAccess: true,
      where: { tenant: { equals: fx.t2.id } }, limit: 1
    })).docs[0]!
    await expect(
      payload.delete({ collection: "pages", id: t2Page.id, user: fx.editor1, overrideAccess: false })
    ).rejects.toThrow()
  })

  it("editor in t1 cannot create a page in t2", async () => {
    await expect(
      payload.create({
        collection: "pages", user: fx.editor1, overrideAccess: false,
        data: { tenant: fx.t2.id, title: "leak", slug: "leak", status: "draft" }
      })
    ).rejects.toThrow()
  })

  it("viewer in t1 cannot create in own tenant", async () => {
    await expect(
      payload.create({
        collection: "pages", user: fx.viewer1, overrideAccess: false,
        data: { tenant: fx.t1.id, title: "v", slug: "v", status: "draft" }
      })
    ).rejects.toThrow()
  })
})

describe("tenant isolation — super-admin and user mgmt", () => {
  it("super-admin sees all tenants' pages", async () => {
    const res = await payload.find({ collection: "pages", user: fx.sa, overrideAccess: false, limit: 100 })
    expect(res.docs.length).toBeGreaterThanOrEqual(2)
  })

  it("owner in t1 cannot delete users in t2", async () => {
    const t2User = await payload.create({
      collection: "users", overrideAccess: true,
      data: { email: "edit2@test.local", password: "test1234", name: "E2", role: "editor", tenants: [{ tenant: fx.t2.id }] }
    })
    await expect(
      payload.delete({ collection: "users", id: t2User.id, user: fx.owner1, overrideAccess: false })
    ).rejects.toThrow()
  })

  it("owner in t1 can manage users in own tenant", async () => {
    const created = await payload.create({
      collection: "users", user: fx.owner1, overrideAccess: false,
      data: { email: "new@test.local", password: "test1234", name: "N", role: "editor", tenants: [{ tenant: fx.t1.id }] }
    })
    expect(created.id).toBeTruthy()
  })
})
