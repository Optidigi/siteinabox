import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import path from "node:path"
import type { SiteSettings } from "@siteinabox/contracts"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import {
  assertProviderSystemTemplateRenderer,
  DEFAULT_PROVIDER_NOT_FOUND_TEMPLATE_ID,
  getProviderSystemTemplateDefinition,
  getProviderSystemTemplateRenderer,
  providerSystemTemplateDefinitions,
} from "@siteinabox/site-renderer"

const repoRoot = path.resolve(process.cwd(), process.cwd().endsWith(`${path.sep}apps${path.sep}cms`) ? "../.." : ".")
const fromRepoRoot = (relativePath: string) => path.join(repoRoot, relativePath)

const fixturePath =
  "packages/site-renderer/src/source-templates/tailwindplus/marketing/feedback/404-simple/upstream.react.tsx"
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
  contactEmail: "support@example.com",
} satisfies SiteSettings

describe("provider system template runtime", () => {
  it("registers the Tailwind Plus simple 404 template with source metadata", () => {
    expect(providerSystemTemplateDefinitions).toHaveLength(1)

    const definition = getProviderSystemTemplateDefinition("notFound", DEFAULT_PROVIDER_NOT_FOUND_TEMPLATE_ID)
    expect(definition?.id).toBe(DEFAULT_PROVIDER_NOT_FOUND_TEMPLATE_ID)
    expect(definition?.renderer).toBeTypeOf("function")
    expect(definition?.rendererClassName).toBe("renderer-not-found--source-tailwindplus-404-simple")
    expect(definition?.source.sourceHash).toMatch(/^sha256:[a-f0-9]{64}$/)

    const source = readFileSync(fromRepoRoot(fixturePath), "utf8")
    const hash = `sha256:${createHash("sha256").update(normalizeSource(source)).digest("hex")}`
    expect(definition?.source.sourceHash).toBe(hash)
  })

  it("renders source-backed 404 fallback with root markers and upstream utility class parity", () => {
    const TemplateRenderer = getProviderSystemTemplateRenderer("notFound", DEFAULT_PROVIDER_NOT_FOUND_TEMPLATE_ID)
    expect(TemplateRenderer).toBeTypeOf("function")
    if (!TemplateRenderer) throw new Error("Expected provider 404 renderer")

    const html = renderToStaticMarkup(
      <TemplateRenderer
        settings={settings}
        theme={{
          version: 2,
          appearance: { mode: "light" },
          colors: { schemeId: "tailwind-default" },
          fonts: { schemeId: "clear-modern" },
          shape: { schemeId: "soft" },
          density: { schemeId: "tailwind-default" },
        }}
        tenantSlug="acme"
        domain="example.com"
        pathname="/missing"
      />,
    )
    const upstream = readFileSync(fromRepoRoot(fixturePath), "utf8")

    expect(html).toContain('data-provider-template="tailwindplus"')
    expect(html).toContain(`data-provider-variant="${DEFAULT_PROVIDER_NOT_FOUND_TEMPLATE_ID}"`)
    expect(html).toContain(`data-system-template="${DEFAULT_PROVIDER_NOT_FOUND_TEMPLATE_ID}"`)
    expect(html).toContain('data-system-template-kind="not-found"')
    expect(html).toContain('data-source-backed-template="true"')
    expect(html).toContain(`data-source-variant="${DEFAULT_PROVIDER_NOT_FOUND_TEMPLATE_ID}"`)
    expect(html).toContain('data-tenant-slug="acme"')
    expect(html).toContain('data-domain="example.com"')
    expect(html).toContain('data-rt-mode="light"')
    expect(html).toContain("Sorry, we couldn&#x27;t find that page on Acme.")

    for (const className of extractFixtureClassNames(upstream)) {
      expect(html, `404 render missing upstream className: ${className}`).toContain(className)
    }
  })

  it("fails closed for unresolved provider system templates", () => {
    expect(() =>
      assertProviderSystemTemplateRenderer("notFound", "tailwindplus.marketing.feedback.missing"),
    ).toThrow('Unresolved provider system template "tailwindplus.marketing.feedback.missing"')
  })

  it("does not route generic fallback CSS through provider template markers", () => {
    const css = readFileSync(fromRepoRoot(stylesPath), "utf8")

    expect(css).not.toContain("[data-provider-template] .renderer-not-found")
    expect(selectorsFor(css, ".renderer-not-found--source-tailwindplus-404-simple")).toEqual([])
  })
})
