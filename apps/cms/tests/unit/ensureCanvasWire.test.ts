import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  CanvasPageSchema,
  PageSchema,
  SITE_BLOCK_SLUGS,
  SITE_SELF_SERVE_SOURCE_BACKED_BLOCK_VARIANTS,
  SiteSettingsSchema,
} from "@siteinabox/contracts"
import {
  ensureCanvasWirePage,
  ensureCanvasWireSettings,
} from "@/lib/projection/ensureCanvasWire"

const inlineText = (value: string) => ({
  t: "root",
  variant: "inline",
  children: [{ t: "text", v: value }],
})

const validHero = (id: string, value: string) => ({
  id,
  blockType: "hero",
  designVariant: "shadcnui-blocks.hero-01",
  headline: inlineText(value),
})

const pageDraft = (blocks: unknown[]) => ({
  title: "Home",
  slug: "home",
  updatedAt: "2026-01-01T00:00:00.000Z",
  blocks,
})

describe("ensureCanvasWireSettings", () => {
  beforeEach(() => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("fills required language when the UI contract omitted it", () => {
    const settings = ensureCanvasWireSettings({
      siteName: "Demo",
      siteUrl: "https://demo.example",
      chrome: {
        header: { variant: "shadcnui-blocks.navbar-01" },
        footer: { variant: "shadcnui-blocks.footer-01" },
      },
    } as never)
    expect(settings.language).toBe("nl")
    expect(SiteSettingsSchema.safeParse(settings).success).toBe(true)
  })

  it("drops banner objects that lack a message so SiteSettingsSchema passes", () => {
    const settings = ensureCanvasWireSettings({
      siteName: "Demo",
      siteUrl: "https://demo.example",
      language: "en",
      chrome: {
        header: { variant: "shadcnui-blocks.navbar-01" },
        footer: { variant: "shadcnui-blocks.footer-01" },
        banner: {
          variant: "shadcnui-blocks.banner-03",
          visible: false,
          message: "",
        },
      },
    } as never)
    expect(settings.chrome?.banner).toBeUndefined()
    expect(SiteSettingsSchema.safeParse(settings).success).toBe(true)
  })

  it("returns a parsed renderer-safe fallback when an allowed chrome edit is temporarily invalid", () => {
    const settings = ensureCanvasWireSettings({
      siteName: "Demo",
      siteUrl: "https://demo.example",
      language: "en",
      navHeader: [
        { label: "One", href: "/one" },
        { label: "Two", href: "/two" },
      ],
      chrome: {
        header: { variant: "shadcnui-blocks.navbar-05" },
      },
    } as never)

    expect(SiteSettingsSchema.safeParse(settings).success).toBe(true)
    expect(console.warn).toHaveBeenCalled()
  })
})

describe("ensureCanvasWirePage", () => {
  beforeEach(() => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  const heroBase = {
    id: "b1",
    blockType: "hero",
    designVariant: "shadcnui-blocks.hero-02",
    headline: { t: "root", variant: "inline", children: [{ t: "text", v: "Hi" }] },
    analytics: {
      sectionId: "home:0:hero",
      sectionType: "hero",
      sectionPosition: 0,
      sectionAnchor: null,
      providerVariant: "shadcnui-blocks.hero-02",
      blockPresetId: null,
      contentSignature: "abc",
      extraJunk: true,
    },
    blockName: "Hero",
    pills: [{ label: "A", id: null }],
  }

  it("fills updatedAt / title / slug so PageSchema accepts editor drafts", () => {
    const page = ensureCanvasWirePage({
      title: "",
      slug: "",
      blocks: [{
        blockType: "hero",
        designVariant: "shadcnui-blocks.hero-01",
        headline: { t: "root", variant: "inline", children: [{ t: "text", v: "Hi" }] },
      }],
    } as never)
    expect(page.title).toBe("—")
    expect(page.slug).toBe("draft")
    expect(typeof page.updatedAt).toBe("string")
    expect(PageSchema.safeParse(page).success).toBe(true)
  })

  it("strips blockName, analytics extras, and inactive slots for PageSchema", () => {
    const page = ensureCanvasWirePage({
      title: "Home",
      slug: "home",
      updatedAt: "2026-01-01T00:00:00.000Z",
      blocks: [heroBase],
    } as never)
    const block = page.blocks[0] as Record<string, unknown>
    expect(block.blockName).toBeUndefined()
    expect(block.pills).toBeUndefined()
    expect((block.analytics as Record<string, unknown>).extraJunk).toBeUndefined()
    expect(PageSchema.safeParse(page).success).toBe(true)
  })

  it("keeps ordinary required text live character by character", () => {
    for (const value of ["H", "He", "Hel", "Hell", "Hello"]) {
      const page = ensureCanvasWirePage(pageDraft([validHero("hero-1", value)]))
      expect(CanvasPageSchema.safeParse(page).success).toBe(true)
      expect(page.blocks[0]).toMatchObject({
        id: "hero-1",
        blockType: "hero",
        headline: inlineText(value),
      })
    }
  })

  it("keeps a newly added incomplete block at the same index and stable id", () => {
    const page = ensureCanvasWirePage(pageDraft([
      validHero("hero-1", "First"),
      { id: "faq-new", blockType: "faq" },
    ]))

    expect(CanvasPageSchema.safeParse(page).success).toBe(true)
    expect(page.blocks).toHaveLength(2)
    expect(page.blocks[1]).toMatchObject({ id: "faq-new", blockType: "faq" })
    expect(console.warn).toHaveBeenCalled()
  })

  it("keeps stable ids and indexes for every recognized editor block type", () => {
    const page = ensureCanvasWirePage(pageDraft(
      SITE_BLOCK_SLUGS.map((blockType, index) => ({ id: `new-${index}`, blockType })),
    ))

    expect(CanvasPageSchema.safeParse(page).success).toBe(true)
    expect(page.blocks).toHaveLength(SITE_BLOCK_SLUGS.length)
    page.blocks.forEach((block, index) => {
      expect(block).toMatchObject({ id: `new-${index}` })
    })
  })

  it("has a same-type incomplete preview for every block offered by the editor", () => {
    const blockTypes = [...new Set(
      SITE_SELF_SERVE_SOURCE_BACKED_BLOCK_VARIANTS.map((variant) => variant.slug),
    )]
    const page = ensureCanvasWirePage(pageDraft(
      blockTypes.map((blockType, index) => ({ id: `active-${index}`, blockType })),
    ))

    expect(CanvasPageSchema.safeParse(page).success).toBe(true)
    page.blocks.forEach((block, index) => {
      expect(block).toMatchObject({
        id: `active-${index}`,
        blockType: blockTypes[index],
      })
    })
  })

  it("renders an explicit empty canvas page without weakening published PageSchema", () => {
    const page = ensureCanvasWirePage(pageDraft([]))

    expect(page.blocks).toEqual([])
    expect(CanvasPageSchema.safeParse(page).success).toBe(true)
    expect(PageSchema.safeParse(page).success).toBe(false)
  })

  it("uses a stable per-block preview when a required field is temporarily empty", () => {
    const page = ensureCanvasWirePage(pageDraft([{
      id: "contact-1",
      blockType: "contactSection",
      designVariant: "shadcnui-blocks.contact-02",
      formName: "",
      fields: [{ name: "name", label: "Name", type: "text" }],
    }]))

    expect(CanvasPageSchema.safeParse(page).success).toBe(true)
    expect(page.blocks[0]).toMatchObject({ id: "contact-1", blockType: "contactSection" })
    expect((page.blocks[0] as { formName?: string }).formName).not.toBe("")
  })

  it("uses a stable per-block preview when a provider-required slot is missing", () => {
    const page = ensureCanvasWirePage(pageDraft([{
      id: "faq-1",
      blockType: "faq",
      designVariant: "shadcnui-blocks.faq-01",
      items: [],
    }]))

    expect(CanvasPageSchema.safeParse(page).success).toBe(true)
    expect(page.blocks[0]).toMatchObject({ id: "faq-1", blockType: "faq" })
    expect((page.blocks[0] as { items?: unknown[] }).items?.length).toBeGreaterThan(0)
  })

  it("lets another valid block update while one block remains invalid", () => {
    const page = ensureCanvasWirePage(pageDraft([
      { id: "faq-1", blockType: "faq" },
      validHero("hero-2", "Changed independently"),
    ]))

    expect(CanvasPageSchema.safeParse(page).success).toBe(true)
    expect(page.blocks).toHaveLength(2)
    expect(page.blocks[0]).toMatchObject({ id: "faq-1", blockType: "faq" })
    expect(page.blocks[1]).toMatchObject({
      id: "hero-2",
      headline: inlineText("Changed independently"),
    })
  })

  it("recovers the real block after an invalid draft becomes valid again", () => {
    const invalid = ensureCanvasWirePage(pageDraft([
      { id: "hero-1", blockType: "hero", designVariant: "shadcnui-blocks.hero-01" },
    ]))
    const recovered = ensureCanvasWirePage(pageDraft([
      validHero("hero-1", "Recovered"),
    ]))

    expect(CanvasPageSchema.safeParse(invalid).success).toBe(true)
    expect(recovered.blocks[0]).toMatchObject({
      id: "hero-1",
      blockType: "hero",
      headline: inlineText("Recovered"),
    })
    expect(CanvasPageSchema.safeParse(recovered).success).toBe(true)
  })
})
