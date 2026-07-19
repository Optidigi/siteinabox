import { describe, expect, it, vi } from "vitest"

import { asMockDoc } from "../_helpers/cast"
import { asPayload, type MockCreateArgs, type MockDoc, type MockFindArgs, type MockUpdateArgs } from "../_helpers/mockPayload"
import { ensureAmicarePrivacyPage } from "@/migrations/20260719_103000_ensure_amicare_privacy_page"

function payloadFixture({ tenants = [{ id: 1, slug: "ami-care", domain: "ami-care.nl", siteManifest: { blockTypes: { paragraph: true } } }], privacy = false } = {}) {
  const pages = [{ id: 10, slug: "index", title: "Home", status: "published", blocks: [] }]
  if (privacy) pages.push({ id: 11, slug: "privacy-en-cookieverklaring", title: "Privacy- en cookieverklaring", status: "published", blocks: [] })
  const settings = [{ id: 20, chrome: { footer: privacy ? { legalLinks: [{ label: "Privacy", href: "/privacy-en-cookieverklaring" }] } : {} } }]
  const snapshots = [{
    id: 30,
    version: 4,
    status: "active",
    snapshot: {
      tenantId: "1",
      tenantSlug: "ami-care",
      domain: "ami-care.nl",
      manifest: { tenantId: "1", version: 4, updatedAt: "2026-07-18T00:00:00.000Z", entries: [{ type: "page", key: "index" }] },
      settings: { chrome: { footer: privacy ? { legalLinks: [{ label: "Privacy", href: "/privacy-en-cookieverklaring" }] } : {} } },
      pages: privacy ? [...pages] : [...pages],
    },
  }]
  const docs: Record<string, Array<Record<string, unknown>>> = { tenants, pages, "site-settings": settings, "published-site-snapshots": snapshots }
  const events: string[] = []
  const find = vi.fn(async ({ collection }: MockFindArgs) => ({ docs: docs[collection] ?? [] }))
  const update = vi.fn(async ({ collection, id, data }: MockUpdateArgs) => {
    events.push(`update:${collection}`)
    return { ...(docs[collection]?.find((item) => item.id === id) ?? { id }), ...data }
  })
  const create = vi.fn(async ({ collection, data }: MockCreateArgs) => {
    events.push(`create:${collection}`)
    return { id: collection === "pages" ? 11 : 31, ...data }
  })
  return { find, update, create, events }
}

describe("Ami Care privacy page migration", () => {
  it("does nothing when Ami Care is not installed", async () => {
    const payload = payloadFixture({ tenants: [] })
    await ensureAmicarePrivacyPage(asPayload(payload))
    expect(payload.create).not.toHaveBeenCalled()
  })

  it("materializes legal content and activates a replacement snapshot", async () => {
    const payload = payloadFixture()
    await ensureAmicarePrivacyPage(asPayload(payload))

    const pageCreate = payload.create.mock.calls.find(([args]) => args.collection === "pages")![0]!
    const manifestUpdate = payload.update.mock.calls.find(([args]) =>
      args.collection === "tenants" && args.data.siteManifest,
    )![0]!
    expect(asMockDoc(asMockDoc(manifestUpdate.data).siteManifest).blockTypes).toMatchObject({
      paragraph: true,
      bulletList: true,
    })
    expect(payload.events.indexOf("update:tenants")).toBeLessThan(payload.events.indexOf("create:pages"))
    expect(pageCreate.data).toMatchObject({ slug: "privacy-en-cookieverklaring", status: "published" })
    expect((asMockDoc(pageCreate.data).blocks as MockDoc[]).map((block) => block.designVariant)).toEqual([
      "shadcnui-blocks.hero-01",
      "shadcnui-blocks.legal-content-01",
    ])
    const snapshotCreate = payload.create.mock.calls.find(([args]) => args.collection === "published-site-snapshots")![0]!
    const snapshot = asMockDoc(snapshotCreate.data).snapshot as MockDoc
    expect((snapshot.pages as MockDoc[]).map((page) => page.slug)).toContain("privacy-en-cookieverklaring")
    expect(asMockDoc(asMockDoc(asMockDoc(snapshot.settings).chrome).footer).legalLinks).toContainEqual({
      label: "Privacy en cookies",
      href: "/privacy-en-cookieverklaring",
    })
    expect(payload.update).toHaveBeenCalledWith(expect.objectContaining({
      collection: "published-site-snapshots",
      id: 31,
      data: expect.objectContaining({ status: "active" }),
    }))
  })

  it("is idempotent when the page, snapshot, and footer link already exist", async () => {
    const payload = payloadFixture({ privacy: true })
    await ensureAmicarePrivacyPage(asPayload(payload))
    expect(payload.create).not.toHaveBeenCalled()
    expect(payload.update).not.toHaveBeenCalled()
  })
})
