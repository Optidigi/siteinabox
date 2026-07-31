import { describe, expect, it } from "vitest"
import { SHADCNUI_BLOCK_VARIANTS, SHADCNUI_CHROME_VARIANTS, SHADCNUI_SYSTEM_TEMPLATES } from "./generated/shadcnui-blocks"
import { SITE_SETTING_DISPOSITIONS } from "./settings-capabilities"
import { NavLinkSchema, SiteSettingsSchema } from "./runtime"
import { validateSiteChromeCapabilities } from "./block-catalog"
import type { SiteFooterChromeVariant, SiteHeaderChromeVariant, SiteSettings } from "./site"

const base = (header: SiteHeaderChromeVariant, footer: SiteFooterChromeVariant = "shadcnui-blocks.footer-01"): SiteSettings => ({
  siteName: "Capability fixture",
  siteUrl: "https://fixture.invalid",
  language: "nl",
  chrome: { header: { variant: header }, footer: { variant: footer } },
})

describe("canonical settings and provider capabilities", () => {
  it("accounts for every public settings domain exactly once", () => {
    const paths = SITE_SETTING_DISPOSITIONS.map((entry) => entry.path)
    expect(new Set(paths).size).toBe(paths.length)
    expect(paths).toEqual(expect.arrayContaining(["navHeader", "navFooter", "chrome.header.search", "chrome.footer.newsletter", "systemTemplates.notFound.variant", "analyticsConsent", "privacyDisclosure", "seoJsonLd"]))
    expect(SITE_SETTING_DISPOSITIONS.every((entry) => entry.consumer.trim().length > 4)).toBe(true)
  })

  it("gives every imported chrome feature a sparse runtime disposition", () => {
    expect(SHADCNUI_CHROME_VARIANTS).toHaveLength(16)
    for (const variant of SHADCNUI_CHROME_VARIANTS) {
      expect(new Set([...Object.keys(variant.activeSlots), ...variant.forbiddenFields]).size).toBe(
        Object.keys(variant.activeSlots).length + variant.forbiddenFields.length,
      )
    }
  })

  it("publishes every imported variant with disjoint active and forbidden fields", () => {
    const variants = [...SHADCNUI_BLOCK_VARIANTS, ...SHADCNUI_CHROME_VARIANTS, ...SHADCNUI_SYSTEM_TEMPLATES]
    expect(variants).toHaveLength(156)
    for (const variant of variants) {
      expect(Object.keys(variant.activeSlots).every((name) => !(variant.forbiddenFields as readonly string[]).includes(name))).toBe(true)
    }
  })

  it("validates hierarchical navigation structurally and by selected variant", () => {
    const group = { label: "Services", children: [{ label: "Care", href: "/care", description: "Personal care", icon: "smile" as const }] }
    expect(NavLinkSchema.parse(group)).toEqual(group)
    expect(NavLinkSchema.safeParse({ label: "Broken" }).success).toBe(false)
    expect(validateSiteChromeCapabilities({ ...base("shadcnui-blocks.navbar-01"), navHeader: [group] }).map((issue) => issue.path)).toContain("navHeader")
    expect(validateSiteChromeCapabilities({ ...base("shadcnui-blocks.navbar-03"), navHeader: [group] })).toEqual([])
    expect(validateSiteChromeCapabilities({ ...base("shadcnui-blocks.navbar-05"), navHeader: [{ label: "Home", href: "/" }] }).map((issue) => issue.path)).toContain("navHeader")
  })

  it("gates search and newsletter only to variants with matching literal regions", () => {
    expect(validateSiteChromeCapabilities({ ...base("shadcnui-blocks.navbar-01"), chrome: { header: { variant: "shadcnui-blocks.navbar-01", search: { enabled: true, action: "/search" } }, footer: { variant: "shadcnui-blocks.footer-01" } } }).map((issue) => issue.path)).toContain("chrome.header.search")
    const supported = { ...base("shadcnui-blocks.navbar-05", "shadcnui-blocks.footer-03"), chrome: { header: { variant: "shadcnui-blocks.navbar-05", search: { enabled: true, action: "/search" } }, footer: { variant: "shadcnui-blocks.footer-03", newsletter: { action: "/subscribe", method: "POST" as const } } } } satisfies SiteSettings
    expect(validateSiteChromeCapabilities(supported)).toEqual([])
    expect(SiteSettingsSchema.safeParse(supported).success).toBe(true)
  })

  it("accepts only imported system and maintenance variants", () => {
    expect(SiteSettingsSchema.safeParse({ ...base("shadcnui-blocks.navbar-01"), systemTemplates: { notFound: { variant: "shadcnui-blocks.not-found-08" } }, maintenance: { enabled: true, message: "Planned maintenance", variant: "shadcnui-blocks.banner-02" } }).success).toBe(true)
    expect(SiteSettingsSchema.safeParse({ ...base("shadcnui-blocks.navbar-01"), systemTemplates: { notFound: { variant: "shadcnui-blocks.not-found-99" } } }).success).toBe(false)
    expect(SiteSettingsSchema.safeParse({ ...base("shadcnui-blocks.navbar-01"), maintenance: { enabled: true, message: "Planned maintenance", variant: "shadcnui-blocks.hero-01" } }).success).toBe(false)
  })
})
