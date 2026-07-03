import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"
import {
  SITE_BLOCK_CATALOG,
  SITE_BLOCK_CATALOG_BY_SLUG,
} from "@siteinabox/contracts/block-catalog"
import { SITE_BLOCK_SLUGS } from "@siteinabox/contracts/site"

const repoRoot = path.resolve(process.cwd(), process.cwd().endsWith(`${path.sep}apps${path.sep}cms`) ? "../.." : ".")

function read(relativePath: string) {
  return readFileSync(path.join(repoRoot, relativePath), "utf8")
}

describe("canvas ↔ renderer block parity contract", () => {
  const canvasBlockRenderer = read("apps/cms/src/components/editor/canvas/CanvasBlockRenderer.tsx")
  const canvasSurface = read("apps/cms/src/components/editor/canvas/CanvasSurface.tsx")
  const sitePageRenderer = read("packages/site-renderer/src/SitePageRenderer.tsx")
  const amicareProfile = read("packages/site-renderer/src/profiles/amicare.tsx")
  const rendererStyles = read("packages/site-renderer/src/styles.css")

  it("routes customer preview through native renderer blocks, not CanvasBlockRenderer", () => {
    expect(canvasSurface).toContain("renderBlocks={isCustomerPreviewView(view)")
    expect(canvasSurface).toMatch(/renderBlocks=\{isCustomerPreviewView\(view\)\s*\?\s*undefined/)
  })

  it("renders editable canvas blocks through package renderers", () => {
    for (const renderer of [
      "HeroBlockRenderer",
      "FeatureListBlockRenderer",
      "CTABlockRenderer",
      "RichTextBlockRenderer",
      "ContactSectionBlockRenderer",
      "FAQBlockRenderer",
      "TestimonialsBlockRenderer",
      "PricingBlockRenderer",
      "StatsBlockRenderer",
      "LogoCloudBlockRenderer",
      "GalleryBlockRenderer",
      "TeamBlockRenderer",
      "BlogCardsBlockRenderer",
      "ProcessStepsBlockRenderer",
      "ComparisonBlockRenderer",
    ]) {
      expect(canvasBlockRenderer).toContain(renderer)
    }

    expect(canvasBlockRenderer).toContain('from "@siteinabox/site-renderer"')
    expect(canvasBlockRenderer).not.toContain('from "@/components/editor/canvas/blocks/')
    expect(canvasBlockRenderer).toContain('surface: "canvas"')
    expect(canvasBlockRenderer).toContain("slots: { render:")
  })

  it("keeps visible generated-block fields on renderer-native editable slots", () => {
    for (const source of [
      "packages/site-renderer/src/blocks/Stats.tsx",
      "packages/site-renderer/src/blocks/Pricing.tsx",
      "packages/site-renderer/src/blocks/Team.tsx",
      "packages/site-renderer/src/blocks/ProcessSteps.tsx",
      "packages/site-renderer/src/blocks/Comparison.tsx",
      "packages/site-renderer/src/blocks/ContactSection.tsx",
    ].map(read)) {
      expect(source).toContain("renderSlot")
    }

    expect(read("packages/site-renderer/src/blocks/Stats.tsx")).toContain('subField: "value"')
    expect(read("packages/site-renderer/src/blocks/Pricing.tsx")).toContain('subField: "price"')
    expect(read("packages/site-renderer/src/blocks/Team.tsx")).toContain('subField: "name"')
    expect(read("packages/site-renderer/src/blocks/ProcessSteps.tsx")).toContain('subField: "cta"')
    expect(read("packages/site-renderer/src/blocks/Comparison.tsx")).toContain('subField: "values"')
    expect(read("packages/site-renderer/src/blocks/ContactSection.tsx")).toContain('field: "submitLabel"')
  })

  it("keeps block catalog renderer metadata for every supported slug", () => {
    expect(SITE_BLOCK_CATALOG).toHaveLength(SITE_BLOCK_SLUGS.length)
    for (const slug of SITE_BLOCK_SLUGS) {
      const entry = SITE_BLOCK_CATALOG_BY_SLUG[slug]
      expect(entry.renderer.package).toBe("@siteinabox/site-renderer")
      expect(entry.renderer.component).toMatch(/Renderer$/)
      expect(entry.themeBehavior.length).toBeGreaterThan(0)
      expect(entry.fixtureCoverage.length).toBeGreaterThan(0)
    }
  })

  it("keeps Ami-care on the generic SitePageRenderer block path", () => {
    expect(sitePageRenderer).not.toContain("<AmicarePageRenderer")
    expect(sitePageRenderer).toContain("<BlockRenderer")
    expect(sitePageRenderer).toContain('variantContext, surface: "live"')
    expect(sitePageRenderer).toContain('data-renderer-profile={isAmicareProfile ? "amicare" : undefined}')
    expect(sitePageRenderer).toContain("<AmicareNav")
    expect(sitePageRenderer).toContain("<AmicareFooter")
  })

  it("does not keep a tenant-specific Ami-care block renderer path", () => {
    expect(amicareProfile).not.toContain("function AmicareBlock")
    expect(amicareProfile).not.toContain("function AmicareHero")
    expect(amicareProfile).not.toContain("export function AmicarePageRenderer")
    expect(amicareProfile).toContain("export function AmicareNav")
    expect(amicareProfile).toContain("export function AmicareFooter")
  })

  it("preserves Ami-care generic-DOM profile styling for the observed visual deltas", () => {
    expect(rendererStyles).toContain('.site-renderer[data-legacy-tenant="amicare"] .cms-block--source-amicare-care-cards .cms-block__features')
    expect(rendererStyles).toContain("display: grid;")
    expect(rendererStyles).toContain("background: var(--color-card);")
    expect(rendererStyles).toContain('.site-renderer[data-legacy-tenant="amicare"] .cms-block--source-amicare-editorial .rt-h')
    expect(rendererStyles).toContain("color: var(--color-ink);")
    expect(rendererStyles).toContain(".cms-block--cta-contact")
  })
})
