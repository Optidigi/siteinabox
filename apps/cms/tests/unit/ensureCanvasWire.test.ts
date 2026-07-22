import { describe, expect, it } from "vitest"
import { PageSchema, SiteSettingsSchema } from "@siteinabox/contracts"
import {
  ensureCanvasWirePage,
  ensureCanvasWireSettings,
  sanitizeCanvasWireBlock,
} from "@/lib/projection/ensureCanvasWire"

describe("ensureCanvasWireSettings", () => {
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
})

describe("ensureCanvasWirePage", () => {
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
})

describe("sanitizeCanvasWireBlock", () => {
  it("returns null for non-objects", () => {
    expect(sanitizeCanvasWireBlock(null)).toBeNull()
    expect(sanitizeCanvasWireBlock("x")).toBeNull()
  })
})
