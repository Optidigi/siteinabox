import { describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))

import { AMICARE_PREVIEW_FIXTURE_CLIENT_SLUG, getPreviewFixtureData } from "@/lib/preview/previewFixture"

describe("sitegen review fixture page matrix", () => {
  it("exposes one hero per review page and keeps navbar overrides fixture-local", () => {
    const expectedPages = ["hero-01", "hero-02", "hero-03", "hero-04", "hero-05"]
    const data = getPreviewFixtureData()

    expect(data?.pages.map((page) => page.slug)).toEqual(expectedPages)
    expect(data?.currentPage.slug).toBe("hero-01")
    expect(data?.currentPage.blocks).toHaveLength(5)
    expect(data?.currentPage.blocks[0]).toMatchObject({ blockType: "hero", variant: "hero-01" })
    expect(data?.currentPage.blocks[1]).toMatchObject({ blockType: "services", variant: "services-01" })
    expect(data?.currentPage.blocks[2]).toMatchObject({ blockType: "cta", variant: "cta-02", anchor: "cta-02" })
    expect(data?.currentPage.blocks[3]).toMatchObject({ blockType: "cta", variant: "cta-01" })
    expect(data?.currentPage.blocks[4]).toMatchObject({ blockType: "services", variant: "services-02", anchor: "services-02" })
    expect(data?.settings.chrome?.navbar?.variant).toBe("navbar-01")
    expect(data?.settings.chrome?.navbar?.placement).toBe("sticky")
    expect(data?.consentAvailable).toBe(true)
  })

  it("uses the matching numbered navbar only on the first three pages", () => {
    for (const [slug, variant] of [
      ["hero-01", "navbar-01"],
      ["hero-02", "navbar-02"],
      ["hero-03", "navbar-03"],
    ] as const) {
      const data = getPreviewFixtureData(slug)
      expect(data?.currentPage.slug).toBe(slug)
      expect(data?.currentPage.blocks).toHaveLength(slug === "hero-01" ? 5 : 1)
      expect(data?.settings.chrome?.navbar?.variant).toBe(variant)
      expect(data?.settings.chrome?.navbar?.activeMode).toBe("path")
      expect(data?.settings.chrome?.navbar?.placement).toBe("sticky")
    }

    for (const slug of ["hero-04", "hero-05"]) {
      const data = getPreviewFixtureData(slug)
      expect(data?.currentPage.slug).toBe(slug)
      expect(data?.currentPage.blocks).toHaveLength(1)
      expect(data?.settings.chrome?.navbar).toBeNull()
      expect(data?.settings.navigation).toBeNull()
    }
  })

  it("gives the first three pages a shared hero review navigation with a fourth/fifth dropdown", () => {
    const data = getPreviewFixtureData("hero-02")
    const primary = data?.settings.navigation?.primary ?? []

    expect(primary.slice(0, 3).map((item) => [item.label, item.href])).toEqual([
      ["Hero 01", "/hero-01"],
      ["Hero 02", "/hero-02"],
      ["Hero 03", "/hero-03"],
    ])
    expect(primary[3]?.children?.map((item) => [item.label, item.href])).toEqual([
      ["Hero 04", "/hero-04"],
      ["Hero 05", "/hero-05"],
    ])
  })

  it("accepts the root and home aliases as the first hero page and rejects unknown pages", () => {
    expect(getPreviewFixtureData("index")?.currentPage.slug).toBe("hero-01")
    expect(getPreviewFixtureData("home")?.currentPage.slug).toBe("hero-01")
    expect(getPreviewFixtureData("unknown")).toBeNull()
  })

  it("exposes the canonical Amicare snapshot through the same preview shell", () => {
    const data = getPreviewFixtureData(undefined, AMICARE_PREVIEW_FIXTURE_CLIENT_SLUG)

    expect(data?.access.clientSlug).toBe(AMICARE_PREVIEW_FIXTURE_CLIENT_SLUG)
    expect(data?.tenant.slug).toBe("ami-care")
    expect(data?.pages).toEqual([{ id: "amicare-home", slug: "index", title: "Amicare-Zorg" }])
    expect(data?.currentPage.blocks.map((block) => [block.blockType, "variant" in block ? block.variant : null])).toEqual([
      ["hero", "hero-05"],
      ["services", "services-01"],
      ["cta", "cta-02"],
      ["cta", "cta-01"],
      ["services", "services-02"],
    ])
    expect(data?.settings.chrome?.navbar).toMatchObject({ variant: "navbar-01", placement: "sticky" })
    expect(data?.settings.chrome?.footer).toMatchObject({ variant: "footer-01" })
    expect(data?.settings.navigation).toMatchObject({
      primary: [
        { label: "Werkwijze", href: "#werkwijze" },
        { label: "Over Amicare", href: "#over" },
        { label: "Wat telt", href: "#wat-telt" },
        { label: "Contact", href: "#contact" },
      ],
      footer: [
        { label: "Werkwijze", href: "#werkwijze" },
        { label: "Over Amicare", href: "#over" },
        { label: "Wat telt", href: "#wat-telt" },
        { label: "Contact", href: "#contact" },
      ],
    })
    expect(data?.consentAvailable).toBe(true)
    expect(data?.settings.branding).toMatchObject({
      logo: { url: "/fixture-media/amicare-logo.svg" },
      favicon: { url: "/fixture-media/amicare-favicon.svg" },
    })

    const hero = data?.currentPage.blocks[0]
    const trustCta = data?.currentPage.blocks[3]
    expect(hero?.blockType === "hero" ? hero.image : null).toMatchObject({ url: "/fixture-media/amicare-toys.jpg" })
    expect(data?.currentPage.blocks[2]).toMatchObject({
      blockType: "cta",
      variant: "cta-02",
      anchor: "over",
      body: expect.stringContaining("Naast mijn werk ben ik moeder"),
    })
    expect(data?.currentPage.blocks[1]).toMatchObject({
      blockType: "services",
      variant: "services-01",
      intro: "Drie dingen",
    })
    expect(data?.currentPage.blocks[4]).toMatchObject({
      blockType: "services",
      variant: "services-02",
      anchor: "contact",
      heading: "Wilt u meer informatie of in contact komen?",
      items: [
        {
          title: "E-mail",
          body: "Neem rechtstreeks contact op.",
          action: { label: "info@ami-care.nl", href: "mailto:info@ami-care.nl" },
        },
        { title: "Werkgebied", body: "Jeugdzorg voor jongeren en gezinnen.\nNederland" },
        { title: "Bedrijfsgegevens", body: "KVK 99968347\nVestigingsnummer 000065004922" },
      ],
    })
    expect(trustCta).toMatchObject({
      blockType: "cta",
      variant: "cta-01",
      anchor: "wat-telt",
      heading: "Vertrouwen ontstaat in de tijd, niet in één gesprek.",
    })
    expect(trustCta?.blockType === "cta" ? trustCta.image : null).toMatchObject({ url: "/fixture-media/amicare-bedroom.jpg" })
  })
})
