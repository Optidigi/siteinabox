import { readFileSync } from "node:fs"
import { resolve } from "node:path"

import { describe, expect, it } from "vitest"

const root = process.cwd()
const read = (path: string) => readFileSync(resolve(root, path), "utf8")

describe("generic CMS canvas defaults", () => {
  it("does not ship tenant-specific hero defaults in shared CMS blocks", () => {
    expect(read("src/blocks/Hero.ts")).not.toMatch(/Roermond|Limburg-Noord|Persoonlijke|Écht verschil/)
  })

  it("gates the Amicare live hero badges to official Amicare heroes with media", () => {
    const source = read("src/components/editor/canvas/blocks/Hero.tsx")

    expect(source).toContain('const isAmicareLegacy = legacyTenant === "amicare"')
    expect(source).toContain("const showAmicareBadges = isAmicareLegacy && Boolean(block.image)")
    expect(source).toContain("Écht verschil maken voor jongeren en gezinnen.")
    expect(source).toContain("Roermond e.o.")
    expect(source).toContain("Limburg-Noord")
  })

  it("uses generic canvas anchor fallbacks except for official Amicare CTA parity", () => {
    const source =
      read("src/components/editor/canvas/blocks/CTA.tsx") +
      read("src/components/editor/canvas/blocks/FeatureList.tsx")

    expect(source).not.toContain('block.anchor || "werkwijze"')
    expect(source).toContain('block.anchor || "features"')
    expect(source).toContain('block.anchor || (isContact ? "contact" : isAmicareLegacy ? "wat-telt" : "cta")')
  })

  it("resolves filename-only inline images through tenant media when a canvas tenant is known", () => {
    const inlineImage = read("src/components/editor/canvas/inline/InlineImage.tsx")
    const canvasSurface = read("src/components/editor/canvas/CanvasSurface.tsx")
    const hero = read("src/components/editor/canvas/blocks/Hero.tsx")
    const cta = read("src/components/editor/canvas/blocks/CTA.tsx")

    expect(inlineImage).toContain('mediaPathFromValue, publicRendererMediaPath')
    expect(inlineImage).toContain("publicRendererMediaPath(String(tenantId), mediaPath)")
    expect(canvasSurface).toContain("tenantId={tenantId}")
    expect(hero).toContain("tenantId={tenantId ?? undefined}")
    expect(cta).toContain("tenantId={tenantId ?? undefined}")
  })

  it("does not duplicate plus signs in icon-led add CTA controls", () => {
    const source =
      read("src/components/editor/canvas/blocks/CTA.tsx") +
      read("src/components/editor/canvas/blocks/Hero.tsx")

    expect(source).not.toContain('emptyLabel={`+ ${t("addCtaButton")}`}')
    expect(source).not.toContain('emptyLabel={`+ ${t("addContactLink")}`}')
  })
})
