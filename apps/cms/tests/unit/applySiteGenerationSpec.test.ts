import { describe, expect, it } from "vitest"
import type { SiteGenerationSpec } from "@siteinabox/contracts/generation"
import { applySiteGenerationSpec, validateSiteGenerationSpecForCms } from "@/lib/site-generation/applySiteGenerationSpec"
import { asPayload, matchesWhere, type MockDoc } from "../_helpers/mockPayload"

const fixtureSpec = (): SiteGenerationSpec => ({
  schemaVersion: 1,
  intake: {
    businessName: "Fixture Care",
    tenantSlug: "fixture-care",
    primaryDomain: "fixture-care.test",
    siteUrl: "https://fixture-care.test",
    language: "en",
    serviceArea: ["Amsterdam"],
    goals: ["contact"],
    requestedPages: [{ slug: "index", title: "Home", purpose: "Introduce the service" }],
  },
  tenant: { name: "Fixture Care", slug: "fixture-care", domain: "fixture-care.test", status: "provisioning" },
  theme: {
    version: 3,
    appearance: { mode: "light" },
    colors: { schemeId: "blue-professional" },
    fonts: { schemeId: "clear-modern" },
    shape: { schemeId: "soft" },
  },
  settings: {
    siteName: "Fixture Care",
    siteUrl: "https://fixture-care.test",
    description: "A reliable local service.",
    language: "en",
    navigation: {
      primary: [{ label: "Contact", href: "/#contact" }],
      footer: [{ label: "Contact", href: "/#contact" }],
    },
    contactEmail: "hello@fixture-care.test",
    serviceArea: [{ name: "Amsterdam" }],
    chrome: {
      navbar: { variant: "navbar-02", placement: "sticky", activeMode: "anchor", mobileMenu: "dropdown" },
      footer: { variant: "footer-01", copyright: "© Fixture Care" },
      announcement: { visible: false, message: "Announcement" },
    },
  },
  pages: [{
    slug: "index",
    title: "Home",
    status: "draft",
    blocks: [
      {
        blockType: "hero",
        variant: "hero-01",
        heading: "Practical help for busy homes",
        body: "Book a clear first step with Fixture Care.",
        primaryAction: { label: "Get in touch", href: "#contact" },
      },
      {
        blockType: "contact",
        anchor: "contact",
        heading: "Contact",
        body: "Tell us what you need.",
        contactMethods: [{ kind: "email", label: "Email", value: "hello@fixture-care.test", href: "mailto:hello@fixture-care.test" }],
      },
    ],
  }],
  blocks: [{ slug: "hero", label: "Hero" }, { slug: "contact", label: "Contact" }],
  generatedAt: "2026-08-13T00:00:00.000Z",
  generator: { name: "sitegen-owned", version: "1" },
})

type Collection = "tenants" | "pages" | "site-settings" | "media"

const payloadStub = () => {
  const store: Record<Collection, MockDoc[]> = { tenants: [], pages: [], "site-settings": [], media: [] }
  let nextId = 1
  const payload = {
    find: async ({ collection, where }: { collection: Collection; where?: Record<string, unknown> }) => ({
      docs: store[collection].filter((doc) => matchesWhere(doc, where)),
    }),
    create: async ({ collection, data }: { collection: Collection; data: Record<string, unknown> }) => {
      const doc = { ...data, id: nextId++ }
      store[collection].push(doc)
      return doc
    },
    update: async ({ collection, id, data }: { collection: Collection; id: string | number; data: Record<string, unknown> }) => {
      const index = store[collection].findIndex((doc) => String(doc.id) === String(id))
      if (index < 0) throw new Error(`Missing ${collection} ${id}`)
      store[collection][index] = { ...store[collection][index], ...data, id: store[collection][index]?.id }
      return store[collection][index]
    },
  }
  return { payload: asPayload(payload), store }
}

describe("owned Sitegen application", () => {
  it("validates and applies a canonical semantic spec", async () => {
    const spec = fixtureSpec()
    const validation = validateSiteGenerationSpecForCms(spec)
    expect(validation.valid).toBe(true)

    const { payload, store } = payloadStub()
    const result = await applySiteGenerationSpec(payload, spec)
    expect(result.ok).toBe(true)
    expect(result.tenantSlug).toBe("fixture-care")
    expect(store.pages[0]?.blocks).toEqual(expect.arrayContaining([
      expect.objectContaining({ blockType: "hero" }),
      expect.objectContaining({ blockType: "contact" }),
    ]))
  })

  it("retires unspecified published pages only in explicit replacement mode", async () => {
    const { payload, store } = payloadStub()
    store.pages.push({ id: 90, tenant: 1, slug: "legacy-page", title: "Legacy page", status: "published" })

    const result = await applySiteGenerationSpec(payload, fixtureSpec(), { retireUnspecifiedPages: true })

    expect(result.ok).toBe(true)
    expect(store.pages.find((page) => page.id === 90)?.status).toBe("draft")
    expect(result.operations?.retiredPages).toEqual([
      expect.objectContaining({ id: 90, slug: "legacy-page", status: "published" }),
    ])
  })

  it("rejects legacy fields and unsupported sections before writes", () => {
    const invalid = fixtureSpec() as unknown as Record<string, unknown>
    const pages = invalid.pages as Array<Record<string, unknown>>
    const firstPage = pages[0]!
    firstPage.blocks = [{ blockType: "hero", legacyVariant: "legacy.hero", heading: "x" }]
    expect(validateSiteGenerationSpecForCms(invalid as unknown as SiteGenerationSpec)).toMatchObject({ valid: false })
  })

  it("enforces homepage ordering, singleton sections, and final contact", () => {
    const invalid = fixtureSpec()
    invalid.pages[0]!.blocks = [
      invalid.pages[0]!.blocks[1]!,
      invalid.pages[0]!.blocks[0]!,
      invalid.pages[0]!.blocks[0]!,
    ]
    const result = validateSiteGenerationSpecForCms(invalid)
    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.issues.map((entry) => entry.code)).toEqual(expect.arrayContaining(["hero_not_first", "duplicate_singleton_section", "contact_not_last"]))
  })
})
