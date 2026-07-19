import { describe, expect, it, vi } from "vitest"

import { rebuildAmicare } from "@/migrations/20260718_230256"

const filenames = ["toys.jpg", "bedroom.jpg", "og-default.png", "favicon.svg", "favicon.ico", "apple-touch-icon.png"]

function payloadFixture({
  tenants = [{ id: 7, slug: "ami-care", domain: "ami-care.nl", theme: {} }],
  media = filenames.map((filename, index) => ({ id: index + 10, filename })),
}: {
  tenants?: any[]
  media?: any[]
} = {}) {
  const pages = [
    { id: 21, slug: "index", title: "Home", status: "published", blocks: [] },
    {
      id: 22,
      slug: "privacy-en-cookieverklaring",
      title: "Privacy- en cookieverklaring",
      status: "published",
      blocks: [{ blockType: "richText", content: { t: "root", variant: "block", children: [] } }],
    },
  ]
  const settings = [{ id: 31, branding: {}, chrome: { banner: {} } }]
  const snapshots = [{
    id: 41,
    version: 3,
    status: "active",
    snapshot: {
      settings: { contact: { phone: null, address: null, social: [] }, nap: { legalName: "AMICARE ZORG", country: "NL" } },
    },
  }]
  const docsByCollection: Record<string, any[]> = {
    tenants,
    media,
    pages,
    "site-settings": settings,
    "published-site-snapshots": snapshots,
  }
  const find = vi.fn(async ({ collection }: { collection: string }) => ({ docs: docsByCollection[collection] ?? [] }))
  const update = vi.fn(async ({ collection, id, data }: any) => {
    const source = (docsByCollection[collection] ?? []).find((doc) => doc.id === id) ?? { id }
    return { ...source, ...data }
  })
  const create = vi.fn(async ({ data }: any) => ({ id: 51, ...data }))
  return { find, update, create }
}

describe("Ami Care provider rebuild migration", () => {
  it("is a no-op when Ami Care is not installed", async () => {
    const payload = payloadFixture({ tenants: [] })
    await expect(rebuildAmicare(payload as any)).resolves.toBeUndefined()
    expect(payload.update).not.toHaveBeenCalled()
    expect(payload.create).not.toHaveBeenCalled()
  })

  it("fails closed for ambiguous tenants or missing required media", async () => {
    await expect(rebuildAmicare(payloadFixture({ tenants: [{ id: 1 }, { id: 2 }] }) as any)).rejects.toThrow(/exactly one/)
    await expect(rebuildAmicare(payloadFixture({ media: [] }) as any)).rejects.toThrow(/missing required tenant media/)
  })

  it("rebuilds CMS state and activates a canonical provider snapshot", async () => {
    const payload = payloadFixture()
    await rebuildAmicare(payload as any)

    const pageUpdate = payload.update.mock.calls.find(([args]) => args.collection === "pages" && args.id === 21)?.[0]
    const tenantManifestUpdateIndex = payload.update.mock.calls.findIndex(([args]) =>
      args.collection === "tenants" && args.data.siteManifest,
    )
    const indexPageUpdateIndex = payload.update.mock.calls.findIndex(([args]) =>
      args.collection === "pages" && args.id === 21,
    )
    expect(tenantManifestUpdateIndex).toBeGreaterThanOrEqual(0)
    expect(tenantManifestUpdateIndex).toBeLessThan(indexPageUpdateIndex)
    expect(pageUpdate.data.blocks.map((block: any) => block.designVariant)).toEqual([
      "shadcnui-blocks.hero-02",
      "shadcnui-blocks.features-01",
      "shadcnui-blocks.cta-03",
      "shadcnui-blocks.cta-02",
      "shadcnui-blocks.contact-01",
    ])
    const settingsUpdate = payload.update.mock.calls.find(([args]) => args.collection === "site-settings")?.[0]
    expect(settingsUpdate.data.chrome).toMatchObject({
      header: { variant: "shadcnui-blocks.navbar-03" },
      footer: { variant: "shadcnui-blocks.footer-07" },
      banner: { variant: "shadcnui-blocks.banner-04" },
    })
    const create = payload.create.mock.calls[0]?.[0]
    expect(create.data.snapshot).toMatchObject({
      tenantSlug: "ami-care",
      theme: { colors: { schemeId: "terracotta-warm" } },
    })
    expect(JSON.stringify(create.data.snapshot)).not.toContain("amicareZen")
    expect(create.data.snapshot.pages[1].blocks[0]).toMatchObject({
      blockType: "contentSection",
      designVariant: "shadcnui-blocks.legal-content-01",
    })
    expect(payload.update).toHaveBeenCalledWith(expect.objectContaining({
      collection: "published-site-snapshots",
      id: 51,
      data: expect.objectContaining({ status: "active" }),
    }))
  })
})
