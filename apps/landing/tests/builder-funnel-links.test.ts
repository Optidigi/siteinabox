import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const read = (relative: string) => readFileSync(new URL(relative, import.meta.url), "utf8")

describe("public builder funnel links", () => {
  it("sends production Start gratis and Inloggen to preview.siteinabox.nl, not localhost", () => {
    const site = read("../src/content/site.ts")
    const header = read("../src/components/siab/Header.astro")
    const chrome = read("../src/components/siab/SiteHeader.tsx")

    expect(site).toContain("https://preview.siteinabox.nl/builder?intent=register")
    expect(site).toContain("https://preview.siteinabox.nl/builder?intent=login")
    expect(site).toContain("import.meta.env.PROD")
    expect(site).not.toContain("import.meta.env.DEV")
    expect(site).toContain("beheer: '/beheer/'")
    expect(site).not.toMatch(/builder:\s*'http:\/\/localhost/)
    expect(header).toContain("intakeHref={site.links.intake}")
    expect(header).toContain("loginHref={site.links.login}")
    expect(header).toContain("liveSiteHref={site.links.beheer}")
    expect(chrome).toContain("Start gratis")
    expect(chrome).toContain("href={intakeHref}")
    expect(chrome).toContain("href={loginHref}")
    expect(chrome).toContain("Beheer je live site")
  })
})
