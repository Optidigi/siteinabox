import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import path from "node:path"
import type { SiteSettings } from "@siteinabox/contracts"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import {
  getProviderChromeDefinition,
  providerChromeDefinitions,
  SitePageRenderer,
  SiteBanner,
  SiteHeader,
} from "@siteinabox/site-renderer"
import {
  tailwindPlusMarketingHeroSimpleCenteredDemoSlots,
  tailwindPlusMarketingHeroWithStatsDemoSlots,
} from "@siteinabox/site-renderer/source-blocks"

const repoRoot = path.resolve(process.cwd(), process.cwd().endsWith(`${path.sep}apps${path.sep}cms`) ? "../.." : ".")
const fromRepoRoot = (relativePath: string) => path.join(repoRoot, relativePath)

const variant = "tailwindplus.marketing.header.with-stacked-flyout-menu" as const
const bannerVariant = "tailwindplus.marketing.banner.with-button" as const
const fixturePath =
  "packages/site-renderer/src/source-chrome/tailwindplus/marketing/header/with-stacked-flyout-menu/upstream.html"
const bannerFixturePath =
  "packages/site-renderer/src/source-chrome/tailwindplus/marketing/banner/with-button/upstream.html"
const stylesPath = "packages/site-renderer/src/styles.css"

const normalizeSource = (source: string) =>
  source.replace(/\r\n/g, "\n").replace(/[ \t]+$/gm, "").trim()

const extractFixtureClassNames = (source: string) => [
  ...source.matchAll(/\bclass(?:Name)?=["']([^"']+)["']/g),
].map((match) => match[1]!.trim())

const selectorsFor = (css: string, className: string) => {
  const escaped = className.replace(".", "\\.")
  const pattern = new RegExp(`(^|})\\s*([^{}]*${escaped}[^{}]*)\\s*\\{`, "g")
  return [...css.matchAll(pattern)].map((match) => match[2]!.trim())
}

const settings = {
  siteName: "Acme",
  siteUrl: "https://example.com",
  language: "en",
  branding: {
    logo: { url: "/logo.svg", alt: "Acme" },
  },
  navHeader: [
    { label: "Product", href: "/product" },
    { label: "Features", href: "/features" },
    { label: "Company", href: "/company" },
  ],
  chrome: {
    header: {
      variant,
      cta: { label: "Log in", href: "/login" },
    },
    banner: {
      variant: bannerVariant,
      visible: true,
      title: "GeneriCon 2026",
      message: "Join us in Amsterdam to see what is coming next.",
      link: { label: "Register now", href: "/register" },
      dismissible: true,
    },
  },
} satisfies SiteSettings

describe("provider chrome runtime", () => {
  it("registers active Tailwind Plus chrome with source metadata", () => {
    expect(providerChromeDefinitions).toHaveLength(2)

    const definition = getProviderChromeDefinition("header", variant)
    expect(definition?.id).toBe(variant)
    expect(definition?.renderer).toBeTypeOf("function")
    expect(definition?.rendererClassName).toBe("site-header--source-tailwindplus-marketing-stacked-flyout")
    expect(definition?.source.sourceHash).toMatch(/^sha256:[a-f0-9]{64}$/)

    const source = readFileSync(fromRepoRoot(fixturePath), "utf8")
    const hash = `sha256:${createHash("sha256").update(normalizeSource(source)).digest("hex")}`
    expect(definition?.source.sourceHash).toBe(hash)

    const bannerDefinition = getProviderChromeDefinition("banner", bannerVariant)
    expect(bannerDefinition?.id).toBe(bannerVariant)
    expect(bannerDefinition?.renderer).toBeTypeOf("function")
    expect(bannerDefinition?.rendererClassName).toBe("site-banner--source-tailwindplus-marketing-with-button")
    const bannerSource = readFileSync(fromRepoRoot(bannerFixturePath), "utf8")
    const bannerHash = `sha256:${createHash("sha256").update(normalizeSource(bannerSource)).digest("hex")}`
    expect(bannerDefinition?.source.sourceHash).toBe(bannerHash)
  })

  it("renders source-backed header chrome with root markers and upstream utility class parity", () => {
    const html = renderToStaticMarkup(<SiteHeader settings={settings} currentSlug="features" />)
    const upstream = readFileSync(fromRepoRoot(fixturePath), "utf8")

    expect(html).toContain('data-site-chrome="header"')
    expect(html).toContain("data-siab-site-header")
    expect(html).toContain('data-provider-chrome="tailwindplus"')
    expect(html).toContain(`data-provider-variant="${variant}"`)
    expect(html).toContain('data-source-backed-chrome="true"')
    expect(html).toContain(`data-source-variant="${variant}"`)

    for (const className of extractFixtureClassNames(upstream)) {
      expect(html, `header render missing upstream className: ${className}`).toContain(className)
    }
  })

  it("renders source-backed banner chrome with root markers and upstream utility class parity", () => {
    const html = renderToStaticMarkup(<SiteBanner settings={settings} currentSlug="features" />)
    const upstream = readFileSync(fromRepoRoot(bannerFixturePath), "utf8")

    expect(html).toContain('data-site-chrome="banner"')
    expect(html).toContain("data-siab-site-banner")
    expect(html).toContain('data-provider-chrome="tailwindplus"')
    expect(html).toContain(`data-provider-variant="${bannerVariant}"`)
    expect(html).toContain('data-source-backed-chrome="true"')
    expect(html).toContain(`data-source-variant="${bannerVariant}"`)

    for (const className of extractFixtureClassNames(upstream)) {
      expect(html, `banner render missing upstream className: ${className}`).toContain(className)
    }
  })

  it("anchors the Tailwind Plus marketing header to the compatible top hero without making banner a page block", () => {
    const html = renderToStaticMarkup(
      <SitePageRenderer
        page={{
          slug: "index",
          title: "Home",
          updatedAt: "2026-07-08T00:00:00.000Z",
          blocks: [tailwindPlusMarketingHeroSimpleCenteredDemoSlots],
        }}
        settings={settings}
        includeThemeStyle={false}
      />,
    )

    expect(html).toContain('data-siab-top-stack="tailwindplus.marketing.header-hero"')
    expect(html).toContain(`data-anchored-source-variant="tailwindplus.marketing.hero.simple-centered"`)
    expect(html).toContain('data-site-chrome="banner"')
    expect(html).toContain("site-top-stack--source-tailwindplus-marketing-header-hero bg-white")
    const stackClassName = html.match(
      /class="([^"]*site-top-stack--source-tailwindplus-marketing-header-hero[^"]*)"[^>]*data-siab-top-stack="tailwindplus\.marketing\.header-hero"/,
    )?.[1]
    expect(stackClassName).toBeDefined()
    expect(stackClassName).not.toMatch(/\b(?:m|p)[trblxy]?-/)

    const bannerIndex = html.indexOf('data-site-chrome="banner"')
    const stackIndex = html.indexOf('data-siab-top-stack="tailwindplus.marketing.header-hero"')
    const headerIndex = html.indexOf('data-site-chrome="header"', stackIndex)
    const heroIndex = html.indexOf('data-provider-variant="tailwindplus.marketing.hero.simple-centered"', stackIndex)

    expect(bannerIndex).toBeGreaterThanOrEqual(0)
    expect(stackIndex).toBeGreaterThan(bannerIndex)
    expect(headerIndex).toBeGreaterThan(stackIndex)
    expect(heroIndex).toBeGreaterThan(headerIndex)
  })

  it("does not anchor the marketing header to fixed-dark hero variants", () => {
    const html = renderToStaticMarkup(
      <SitePageRenderer
        page={{
          slug: "careers",
          title: "Careers",
          updatedAt: "2026-07-08T00:00:00.000Z",
          blocks: [tailwindPlusMarketingHeroWithStatsDemoSlots],
        }}
        settings={settings}
        includeThemeStyle={false}
      />,
    )

    expect(html).not.toContain("data-siab-top-stack")
    expect(html.indexOf('data-site-chrome="header"')).toBeLessThan(html.indexOf('data-site-chrome="banner"'))
    expect(html.indexOf('data-site-chrome="banner"')).toBeLessThan(
      html.indexOf('data-provider-variant="tailwindplus.marketing.hero.with-stats"'),
    )
  })

  it("fails closed for unresolved provider chrome variants", () => {
    const html = renderToStaticMarkup(
      <SiteHeader
        settings={{
          ...settings,
          chrome: { header: { variant: "tailwindplus.marketing.header.missing" as typeof variant } },
        }}
      />,
    )

    expect(html).toContain("cms-block--provider-error")
    expect(html).toContain("Unresolved provider chrome variant")
    expect(html).not.toContain("mx-auto flex max-w-7xl")
  })

  it("keeps generic site chrome CSS scoped away from provider chrome roots", () => {
    const css = readFileSync(fromRepoRoot(stylesPath), "utf8")
    const selectors = selectorsFor(css, ".site-chrome")

    expect(selectors.length).toBeGreaterThan(0)
    expect(selectors).toContain(".site-chrome:not([data-provider-chrome])")
    expect(selectors.every((selector) => !selector.includes(".site-chrome {"))).toBe(true)
  })
})
