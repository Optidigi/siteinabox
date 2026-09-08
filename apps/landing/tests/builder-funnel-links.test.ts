import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const read = (relative: string) => readFileSync(new URL(relative, import.meta.url), "utf8")

describe("public builder funnel links", () => {
  it("sends production Start gratis and Inloggen to admin.siteinabox.nl/login, not localhost", () => {
    const site = read("../src/content/site.ts")
    const header = read("../src/components/siab/Header.astro")
    const chrome = read("../src/components/siab/SiteHeader.tsx")
    const footer = read("../src/components/siab/Footer.astro")
    const config = read("../astro.config.mjs")

    expect(site).toContain("https://admin.siteinabox.nl/login?intent=register")
    expect(site).toContain("https://admin.siteinabox.nl/login")
    expect(site).toContain("import.meta.env.PROD")
    expect(site).not.toContain("import.meta.env.DEV")
    expect(site).not.toContain("beheer:")
    expect(site).not.toContain("label: 'Bouwen'")
    expect(site).not.toMatch(/builder:\s*'http:\/\/localhost/)
    expect(header).toContain("signupHref={site.links.signup}")
    expect(header).toContain("loginHref={site.links.login}")
    expect(header).not.toContain("liveSiteHref")
    expect(chrome).toContain("Start gratis")
    expect(chrome).toContain("href={signupHref}")
    expect(chrome).toContain("href={loginHref}")
    expect(chrome).not.toContain("Beheer je live site")
    expect(chrome).not.toContain("Bouwen")
    expect(footer).not.toContain(">Bouwen<")
    expect(config).not.toContain("/intake")
    expect(config).not.toContain("/beheer")
  })
})
