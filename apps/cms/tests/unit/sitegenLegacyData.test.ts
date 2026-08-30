import { describe, expect, it } from "vitest"
import {
  legacyPlainText,
  normalizeLegacySnapshot,
  normalizeLegacyStoredJson,
} from "@/migrations/sitegenLegacyData"

describe("Sitegen legacy data normalization", () => {
  it("preserves spaces between inline rich-text nodes", () => {
    expect(legacyPlainText({
      t: "root",
      variant: "inline",
      children: [
        { t: "text", v: "Jeugdzorg " },
        { t: "text", v: "met " },
        { t: "text", v: "hart en toewijding." },
      ],
    })).toBe("Jeugdzorg met hart en toewijding.")
  })

  it("maps a legacy hero to a first-party block without provider metadata", () => {
    expect(normalizeLegacyStoredJson({
      blockType: "hero",
      designVariant: "shadcnui-blocks.hero-minimal",
      headline: { t: "root", variant: "inline", children: [{ t: "text", v: "Een heldere boodschap" }] },
      subheadline: { t: "root", variant: "inline", children: [{ t: "text", v: "Met ruimte voor bewijs." }] },
      cta: { label: "Neem contact op", href: "#contact" },
    })).toEqual({
      blockType: "hero",
      variant: "hero-01",
      heading: "Een heldere boodschap",
      body: "Met ruimte voor bewijs.",
      primaryAction: { label: "Neem contact op", href: "#contact" },
    })
  })

  it("maps legacy feature content to services and excludes privacy pages from snapshots", () => {
    const normalized = normalizeLegacySnapshot({
      pages: [
        {
          slug: "home",
          blocks: [{
            blockType: "featureList",
            designVariant: "shadcnui-blocks.feature-list-01",
            title: "Diensten",
            features: [
              { title: "Advies", body: "Een duidelijke route." },
              { title: "Uitvoering", body: "Praktische begeleiding." },
            ],
          }],
        },
        { slug: "privacy-en-cookieverklaring", blocks: [] },
      ],
    }) as { pages: Array<{ slug: string; blocks: unknown[] }> }

    expect(normalized.pages).toHaveLength(1)
    expect(normalized.pages[0]?.blocks[0]).toEqual({
      blockType: "services",
      variant: "services-01",
      heading: "Diensten",
      items: [
        { title: "Advies", body: "Een duidelijke route." },
        { title: "Uitvoering", body: "Praktische begeleiding." },
      ],
    })
  })

  it("repairs the published snapshot envelope after the first-party cutover", () => {
    const normalized = normalizeLegacySnapshot({
      tenantId: 7,
      manifest: {
        tenantId: 7,
        version: 1,
        updatedAt: "2026-08-30T00:00:00.000Z",
        entries: [{ type: "page", key: "index", updatedAt: "2026-08-30T00:00:00.000Z" }],
      },
      settings: {
        navHeader: [{ label: "Home", href: "/", external: false }],
        navFooter: [{ label: "Contact", href: "#contact", external: false }],
        chrome: { announcement: { variant: "announcement-01", visible: false } },
        systemTemplates: { notFound: { variant: "not-found-01" } },
        maintenance: { variant: "maintenance-01", enabled: false },
      },
      blocks: [
        { slug: "hero", label: "Hero" },
        { slug: "featureList", label: "Services" },
      ],
      pages: [{ id: 9, slug: "index", title: "Home", blocks: [] }],
    }) as Record<string, unknown>

    const settings = normalized.settings as Record<string, unknown>
    const chrome = settings.chrome as Record<string, Record<string, unknown>>
    const systemTemplates = settings.systemTemplates as Record<string, Record<string, unknown>>
    const navigation = settings.navigation as Record<string, unknown[]>

    expect(normalized.tenantId).toBe("7")
    expect((normalized.manifest as Record<string, unknown>).tenantId).toBe("7")
    expect((normalized.pages as Array<Record<string, unknown>>)[0]?.id).toBe("9")
    expect(navigation.primary).toEqual([{ label: "Home", href: "/", external: false }])
    expect(navigation.footer).toEqual([{ label: "Contact", href: "#contact", external: false }])
    expect(settings.navHeader).toBeUndefined()
    expect(settings.navFooter).toBeUndefined()
    expect(chrome.announcement?.variant).toBeUndefined()
    expect(systemTemplates.notFound?.variant).toBeUndefined()
    expect((settings.maintenance as Record<string, unknown>).variant).toBeUndefined()
    expect(normalized.blocks).toEqual([
      { slug: "hero", label: "Hero" },
      { slug: "services", label: "Services" },
    ])
  })
})
