import { describe, expect, it, vi } from "vitest"

import { ensureAmicarePrivacyPage } from "@/migrations/20260719_103000_ensure_amicare_privacy_page"

function payloadFixture({ tenants = [{ id: 1, slug: "ami-care", domain: "ami-care.nl" }], privacy = false } = {}) {
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
  const docs: Record<string, any[]> = { tenants, pages, "site-settings": settings, "published-site-snapshots": snapshots }
  const find = vi.fn(async ({ collection }: any) => ({ docs: docs[collection] ?? [] }))
  const update = vi.fn(async ({ collection, id, data }: any) => ({ ...(docs[collection]?.find((item) => item.id === id) ?? { id }), ...data }))
  const create = vi.fn(async ({ collection, data }: any) => ({ id: collection === "pages" ? 11 : 31, ...data }))
  return { find, update, create }
}

describe("Ami Care privacy page migration", () => {
  it("does nothing when Ami Care is not installed", async () => {
    const payload = payloadFixture({ tenants: [] })
    await ensureAmicarePrivacyPage(payload as any)
    expect(payload.create).not.toHaveBeenCalled()
  })

  it("materializes legal content and activates a replacement snapshot", async () => {
    const payload = payloadFixture()
    await ensureAmicarePrivacyPage(payload as any)

    const pageCreate = payload.create.mock.calls.find(([args]) => args.collection === "pages")?.[0]
    expect(pageCreate.data).toMatchObject({ slug: "privacy-en-cookieverklaring", status: "published" })
    expect(pageCreate.data.blocks.map((block: any) => block.designVariant)).toEqual([
      "shadcnui-blocks.hero-01",
      "shadcnui-blocks.legal-content-01",
    ])
    const snapshotCreate = payload.create.mock.calls.find(([args]) => args.collection === "published-site-snapshots")?.[0]
    expect(snapshotCreate.data.snapshot.pages.map((page: any) => page.slug)).toContain("privacy-en-cookieverklaring")
    expect(snapshotCreate.data.snapshot.settings.chrome.footer.legalLinks).toContainEqual({
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
    await ensureAmicarePrivacyPage(payload as any)
    expect(payload.create).not.toHaveBeenCalled()
    expect(payload.update).not.toHaveBeenCalled()
  })
})
