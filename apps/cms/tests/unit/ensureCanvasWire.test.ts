import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  CanvasPageSchema,
  PageSchema,
  SiteSettingsSchema,
} from "@siteinabox/contracts"
import {
  ensureCanvasWirePage,
  ensureCanvasWireSettings,
} from "@/lib/projection/ensureCanvasWire"

const hero = (id: string, heading: string) => ({
  id,
  blockType: "hero" as const,
  variant: "hero-01" as const,
  heading,
  body: "Heldere hulp voor een concrete vraag.",
  primaryAction: { label: "Neem contact op", href: "#contact" },
  secondaryAction: null,
  image: null,
})

describe("ensureCanvasWireSettings", () => {
  beforeEach(() => vi.spyOn(console, "warn").mockImplementation(() => undefined))
  afterEach(() => vi.restoreAllMocks())

  it("fills the default language and preserves canonical site presentation", () => {
    const settings = ensureCanvasWireSettings({
      siteName: "Demo",
      siteUrl: "https://demo.example",
      chrome: {
        navbar: {},
        footer: {},
        announcement: { visible: false, message: "Announcement" },
      },
      systemTemplates: { notFound: {} },
      maintenance: { enabled: true, message: "Maintenance" },
      navigation: { primary: [{ label: "Home", href: "/" }], footer: [{ label: "Home", href: "/" }] },
    })
    expect(settings.language).toBe("nl")
    expect(settings.chrome?.navbar).toEqual({ variant: "navbar-01", placement: "sticky" })
    expect(settings.chrome?.footer).toEqual({ variant: "footer-01" })
    expect(settings.chrome?.announcement).toMatchObject({ visible: false })
    expect(settings.systemTemplates?.notFound).toEqual({})
    expect(settings.maintenance).toMatchObject({ enabled: true })
    expect(settings.navigation?.primary).toEqual([{ label: "Home", href: "/" }])
    expect(settings.navigation?.footer).toEqual([{ label: "Home", href: "/" }])
    expect(SiteSettingsSchema.safeParse(settings).success).toBe(true)
  })

  it("returns a parsed minimal fallback for invalid settings", () => {
    const settings = ensureCanvasWireSettings({ siteName: "Demo", siteUrl: "not-a-url" })
    expect(settings.siteName).toBe("Demo")
    expect(settings.siteUrl).toBe("https://preview.invalid")
    expect(SiteSettingsSchema.safeParse(settings).success).toBe(true)
    expect(console.warn).toHaveBeenCalled()
  })
})

describe("ensureCanvasWirePage", () => {
  beforeEach(() => vi.spyOn(console, "warn").mockImplementation(() => undefined))
  afterEach(() => vi.restoreAllMocks())

  it("fills page identity and preserves valid canonical blocks", () => {
    const page = ensureCanvasWirePage({
      title: "Home",
      slug: "home",
      updatedAt: "2026-01-01T00:00:00.000Z",
      blocks: [hero("hero-1", "Welkom")],
    })
    expect(page.blocks[0]).toMatchObject({ id: "hero-1", blockType: "hero", heading: "Welkom" })
    expect(CanvasPageSchema.safeParse(page).success).toBe(true)
    expect(PageSchema.safeParse(page).success).toBe(true)
  })

  it("uses an owned preview fixture when a draft block is incomplete", () => {
    const page = ensureCanvasWirePage({
      title: "",
      slug: "",
      blocks: [{ id: "draft-1", blockType: "faq" }],
    })
    expect(page.title).toBe("—")
    expect(page.slug).toBe("draft")
    expect(page.blocks[0]).toMatchObject({ id: "draft-1", blockType: "faq" })
    expect(CanvasPageSchema.safeParse(page).success).toBe(true)
    expect(console.warn).toHaveBeenCalled()
  })

  it("replaces unknown blocks with a safe owned hero fixture", () => {
    const page = ensureCanvasWirePage({
      title: "Home",
      slug: "home",
      blocks: [{ id: "unknown-1", blockType: "not-a-block" }],
    })
    expect(page.blocks[0]).toMatchObject({ id: "unknown-1", blockType: "hero" })
    expect(CanvasPageSchema.safeParse(page).success).toBe(true)
  })
})
