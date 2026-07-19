import { describe, expect, it, vi } from "vitest"

import { asMockDoc } from "../_helpers/cast"
import { asPayload, type MockCreateArgs, type MockDoc, type MockFindArgs, type MockFindByIdArgs, type MockUpdateArgs } from "../_helpers/mockPayload"
import { rebuildAmicare } from "@/migrations/20260718_230256"

const filenames = ["toys.jpg", "bedroom.jpg", "og-default.png", "favicon.svg", "favicon.ico", "apple-touch-icon.png"]

function payloadFixture({
  tenants = [{ id: 7, slug: "ami-care", domain: "ami-care.nl", theme: {} }],
  media = filenames.map((filename, index) => ({ id: index + 10, filename })),
}: {
  tenants?: Array<Record<string, unknown>>
  media?: Array<Record<string, unknown>>
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
  const docsByCollection: Record<string, Array<Record<string, unknown>>> = {
    tenants,
    media,
    pages,
    "site-settings": settings,
    "published-site-snapshots": snapshots,
  }
  const findByID = vi.fn(async ({ collection, id }: MockFindByIdArgs) => {
    const doc = (docsByCollection[collection] ?? []).find((entry) => String(entry.id) === String(id))
    if (!doc) throw new Error(`Missing ${collection} ${id}`)
    return doc
  })
  const find = vi.fn(async ({ collection }: { collection: string }) => ({ docs: docsByCollection[collection] ?? [] }))
  const update = vi.fn(async ({ collection, id, data }: MockUpdateArgs) => {
    const source = (docsByCollection[collection] ?? []).find((doc) => doc.id === id) ?? { id }
    return { ...source, ...data }
  })
  const create = vi.fn(async ({ data }: MockCreateArgs) => ({ id: 51, ...data }))
  return { find, findByID, update, create }
}

describe("Ami Care provider rebuild migration", () => {
  it("is a no-op when Ami Care is not installed", async () => {
    const payload = payloadFixture({ tenants: [] })
    await expect(rebuildAmicare(asPayload(payload))).resolves.toBeUndefined()
    expect(payload.update).not.toHaveBeenCalled()
    expect(payload.create).not.toHaveBeenCalled()
  })

  it("fails closed for ambiguous tenants or missing required media", async () => {
    await expect(rebuildAmicare(asPayload(payloadFixture({ tenants: [{ id: 1 }, { id: 2 }] })))).rejects.toThrow(/exactly one/)
    await expect(rebuildAmicare(asPayload(payloadFixture({ media: [] })))).rejects.toThrow(/missing required tenant media/)
  })

  it("rebuilds CMS state and activates a canonical provider snapshot", async () => {
    const payload = payloadFixture()
    await rebuildAmicare(asPayload(payload))

    const pageUpdate = payload.update.mock.calls.find(([args]) => args.collection === "pages" && args.id === 21)![0]!
    const tenantManifestUpdateIndex = payload.update.mock.calls.findIndex(([args]) =>
      args.collection === "tenants" && args.data.siteManifest,
    )
    const indexPageUpdateIndex = payload.update.mock.calls.findIndex(([args]) =>
      args.collection === "pages" && args.id === 21,
    )
    expect(tenantManifestUpdateIndex).toBeGreaterThanOrEqual(0)
    expect(tenantManifestUpdateIndex).toBeLessThan(indexPageUpdateIndex)
    expect((asMockDoc(pageUpdate.data).blocks as MockDoc[]).map((block) => block.designVariant)).toEqual([
      "shadcnui-blocks.hero-02",
      "shadcnui-blocks.features-01",
      "shadcnui-blocks.cta-03",
      "shadcnui-blocks.cta-02",
      "shadcnui-blocks.contact-01",
    ])
    const settingsUpdate = payload.update.mock.calls.find(([args]) => args.collection === "site-settings")![0]!
    expect(asMockDoc(settingsUpdate.data).chrome).toMatchObject({
      header: { variant: "shadcnui-blocks.navbar-03" },
      footer: { variant: "shadcnui-blocks.footer-07" },
      banner: { variant: "shadcnui-blocks.banner-04" },
    })
    const create = payload.create.mock.calls[0]![0]!
    expect(asMockDoc(create.data).snapshot).toMatchObject({
      tenantSlug: "ami-care",
      theme: { colors: { schemeId: "terracotta-warm" } },
    })
    expect(JSON.stringify(asMockDoc(create.data).snapshot)).not.toContain("amicareZen")
    expect(asMockDoc(asMockDoc((asMockDoc(asMockDoc(create.data).snapshot).pages as MockDoc[])[1]).blocks)[0]).toMatchObject({
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
