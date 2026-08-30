import { describe, expect, it } from "vitest"
import { CTA_VARIANTS, HERO_VARIANTS, SERVICES_VARIANTS } from "@siteinabox/contracts"
import { SITEGEN_FOOTERS, SITEGEN_NAVBARS, SITEGEN_SECTIONS } from "@/lib/sitegen/catalog"
import { eligibleSitegenSections } from "@/lib/sitegen/eligibility"

describe("sitegen catalog eligibility", () => {
  it("keeps one catalog entry per enabled semantic family and one description per variant", () => {
    expect(SITEGEN_SECTIONS).toHaveLength(3)
    expect(SITEGEN_SECTIONS.map((section) => section.blockType)).toEqual(["hero", "services", "cta"])
    expect(SITEGEN_SECTIONS[0]?.variants.map((variant) => variant.id)).toEqual([...HERO_VARIANTS])
    expect(SITEGEN_SECTIONS[1]?.variants.map((variant) => variant.id)).toEqual([...SERVICES_VARIANTS])
    expect(SITEGEN_SECTIONS[2]?.variants.map((variant) => variant.id)).toEqual([...CTA_VARIANTS])
    expect(new Set(SITEGEN_SECTIONS.flatMap((section) => section.variants.map((variant) => variant.id))).size).toBe(HERO_VARIANTS.length + SERVICES_VARIANTS.length + CTA_VARIANTS.length)
  })

  it("keeps the three numbered navbar choices separate from page sections", () => {
    expect(SITEGEN_NAVBARS.map((navbar) => navbar.id)).toEqual(["navbar-01", "navbar-02", "navbar-03"])
    expect(SITEGEN_NAVBARS.every((navbar) => navbar.placements.length === 2)).toBe(true)
    expect(new Set(SITEGEN_NAVBARS.map((navbar) => navbar.id)).size).toBe(3)
  })

  it("keeps the first-party footer choice separate from page sections", () => {
    expect(SITEGEN_FOOTERS.map((footer) => footer.id)).toEqual(["footer-01"])
    expect(new Set(SITEGEN_FOOTERS.map((footer) => footer.id)).size).toBe(SITEGEN_FOOTERS.length)
  })

  it("keeps hero sections deterministic for supplied media facts", () => {
    const ids = (input: Parameters<typeof eligibleSitegenSections>[0]) => eligibleSitegenSections(input).map((entry) => `${entry.blockType}:${entry.variant ?? ""}`)
    expect(ids({ hasImage: false })).toEqual(["hero:hero-01", "cta:cta-01", "cta:cta-02"])
    expect(ids({ hasImage: true })).toEqual(["hero:hero-01", "hero:hero-03", "hero:hero-04", "hero:hero-05", "cta:cta-01", "cta:cta-02"])
    expect(ids({ hasImage: true, hasWideImage: true })).toEqual(["hero:hero-01", "hero:hero-03", "hero:hero-04", "hero:hero-05", "cta:cta-01", "cta:cta-02"])
    expect(ids({ hasImage: true, hasWideImage: true, serviceImageCount: 2 })).toEqual(["hero:hero-01", "hero:hero-02", "hero:hero-03", "hero:hero-04", "hero:hero-05", "cta:cta-01", "cta:cta-02"])
    expect(ids({ hasImage: true, hasWideImage: true, serviceImageCount: 2, serviceCount: 2 })).toEqual(["hero:hero-01", "hero:hero-02", "hero:hero-03", "hero:hero-04", "hero:hero-05", "services:services-01", "services:services-02", "cta:cta-01", "cta:cta-02"])
    expect(ids({ serviceCount: 2 })).toEqual(["hero:hero-01", "services:services-01", "services:services-02", "cta:cta-01", "cta:cta-02"])
  })

  it("keeps both services variants unavailable until two supplied services exist", () => {
    expect(eligibleSitegenSections({ serviceCount: 1 }).some((entry) => entry.blockType === "services")).toBe(false)
    expect(eligibleSitegenSections({ serviceCount: 2 }).filter((entry) => entry.blockType === "services").map((entry) => entry.variant)).toEqual([...SERVICES_VARIANTS])
    expect(eligibleSitegenSections({ serviceCount: 2 }).filter((entry) => entry.blockType === "services").every((entry) => entry.requires.join() === "services")).toBe(true)
  })
})
