import { describe, expect, it } from "vitest"
import { PageSchema, SiteSettingsSchema } from "@siteinabox/contracts"
import {
  ensureCanvasWirePage,
  ensureCanvasWireSettings,
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
})
