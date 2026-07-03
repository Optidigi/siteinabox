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

/** Pull the first `className="..."` / template literal on a `<section` in a function body. */
function extractSectionClass(source: string, functionName: string): string | null {
  const fnStart = source.indexOf(`function ${functionName}`)
  if (fnStart < 0) return null
  const sectionIdx = source.indexOf("<section", fnStart)
  if (sectionIdx < 0) return null
  const classMatch = source.slice(sectionIdx).match(/className=(?:"([^"]+)"|\{`([^`]+)`\}|\{([^}]+)\})/)
  if (!classMatch) return null
  return classMatch[1] ?? classMatch[2] ?? classMatch[3] ?? null
}

function extractMergedSectionPropsSource(source: string): string {
  const start = source.indexOf("const sectionProps = mergeCanvasSectionProps(")
  expect(start, "sectionProps merge call").toBeGreaterThanOrEqual(0)
  const sectionIdx = source.indexOf("<section {...sectionProps}>", start)
  expect(sectionIdx, "section uses merged props").toBeGreaterThan(start)
  return source.slice(start, sectionIdx)
}

function extractMergedSectionClass(source: string): string | null {
  const propsSource = extractMergedSectionPropsSource(source)
  const classMatch = propsSource.match(/className:\s*(?:"([^"]+)"|`([^`]+)`|([^,\n]+))/)
  return classMatch?.[1] ?? classMatch?.[2] ?? classMatch?.[3]?.trim() ?? null
}

function expectMergedSectionId(source: string, expectedExpression: string) {
  const propsSource = extractMergedSectionPropsSource(source)
  expect(propsSource).toContain(`id: ${expectedExpression}`)
}

/** Normalize class strings for comparison — order-independent token sets. */
function classTokens(value: string): Set<string> {
  return new Set(
    value
      .replace(/\$\{[^}]+\}/g, " ")
      .split(/\s+/)
      .map((token) => token.trim())
      .filter(Boolean),
  )
}

function expectClassParity(label: string, canvasClass: string, rendererClass: string, required: string[]) {
  const canvas = classTokens(canvasClass)
  const renderer = classTokens(rendererClass)
  for (const token of required) {
    expect(canvas.has(token), `${label}: canvas missing ${token}`).toBe(true)
    expect(renderer.has(token), `${label}: renderer missing ${token}`).toBe(true)
  }
}

describe("canvas ↔ renderer block parity contract", () => {
  const amicareSource = read("packages/site-renderer/src/legacy-tenants/amicare/AmicarePage.tsx")
  const canvasSurface = read("apps/cms/src/components/editor/canvas/CanvasSurface.tsx")

  it("routes customer preview through native renderer blocks, not CanvasBlockRenderer", () => {
    expect(canvasSurface).toContain("renderBlocks={isCustomerPreviewView(view)")
    expect(canvasSurface).toMatch(/renderBlocks=\{isCustomerPreviewView\(view\)\s*\?\s*undefined/)
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

  describe("Amicare legacy anchor fallbacks", () => {
    const cases: Array<{
      label: string
      amicareFn: string
      canvasFile: string
    }> = [
      {
        label: "hero",
        amicareFn: "AmicareHero",
        canvasFile: "apps/cms/src/components/editor/canvas/blocks/Hero.tsx",
      },
      {
        label: "featureList",
        amicareFn: "AmicareFeatureList",
        canvasFile: "apps/cms/src/components/editor/canvas/blocks/FeatureList.tsx",
      },
      {
        label: "richText",
        amicareFn: "AmicareRichText",
        canvasFile: "apps/cms/src/components/editor/canvas/blocks/RichText.tsx",
      },
      {
        label: "cta quote",
        amicareFn: "AmicareCTA",
        canvasFile: "apps/cms/src/components/editor/canvas/blocks/CTA.tsx",
      },
    ]

    for (const { label, amicareFn, canvasFile } of cases) {
      it(`aligns ${label} default anchor between canvas and Amicare renderer`, () => {
        const amicareBody = amicareSource.slice(amicareSource.indexOf(`function ${amicareFn}`))
        expect(amicareBody).toContain('resolveBlockAnchor(block, { legacyTenant: "amicare", surface: "live" })')

        const canvasSource = read(canvasFile)
        expect(canvasSource).toContain('resolveBlockAnchor(block, { legacyTenant, surface: "canvas" })')
      })
    }
  })

  describe("Amicare outer section class parity", () => {
    const pairs: Array<{
      label: string
      amicareFn: string
      canvasFile: string
      required: string[]
    }> = [
      {
        label: "hero",
        amicareFn: "AmicareHero",
        canvasFile: "apps/cms/src/components/editor/canvas/blocks/Hero.tsx",
        required: [
          "cms-block",
          "cms-block--hero",
          "relative",
          "flex",
          "min-h-[90vh]",
          "@min-[48rem]/site-frame:flex-row",
        ],
      },
      {
        label: "featureList",
        amicareFn: "AmicareFeatureList",
        canvasFile: "apps/cms/src/components/editor/canvas/blocks/FeatureList.tsx",
        required: [
          "cms-block",
          "cms-block--featurelist",
          "bg-card/50",
          "@min-[64rem]/site-frame:px-24",
        ],
      },
      {
        label: "richText",
        amicareFn: "AmicareRichText",
        canvasFile: "apps/cms/src/components/editor/canvas/blocks/RichText.tsx",
        required: [
          "cms-block",
          "cms-block--richtext",
          "@min-[48rem]/site-frame:py-24",
        ],
      },
      {
        label: "faq",
        amicareFn: "AmicareFAQ",
        canvasFile: "apps/cms/src/components/editor/canvas/blocks/FAQ.tsx",
        required: ["cms-block", "cms-block--faq", "@min-[64rem]/site-frame:px-24"],
      },
      {
        label: "testimonials",
        amicareFn: "AmicareTestimonials",
        canvasFile: "apps/cms/src/components/editor/canvas/blocks/Testimonials.tsx",
        required: ["cms-block", "cms-block--testimonials", "bg-secondary/40"],
      },
    ]

    for (const { label, amicareFn, canvasFile, required } of pairs) {
      it(`keeps ${label} section classes aligned with AmicarePage`, () => {
        const rendererClass = extractSectionClass(amicareSource, amicareFn)
        expect(rendererClass, `${amicareFn} section class`).toBeTruthy()

        const canvasSource = read(canvasFile)
        const canvasClass = extractMergedSectionClass(canvasSource)
        expect(canvasClass, `${canvasFile} section class`).toBeTruthy()

        expectClassParity(label, canvasClass!, rendererClass!, required)
      })
    }
  })

  it("keeps Amicare CTA contact detection aligned with the live renderer", () => {
    const rendererBody = amicareSource.slice(amicareSource.indexOf("function AmicareCTA"))
    const canvasSource = read("apps/cms/src/components/editor/canvas/blocks/CTA.tsx")

    expect(rendererBody).toContain('const primaryHref = block.primary?.href?.trim()')
    expect(rendererBody).toContain('primaryHref?.startsWith("mailto:") || primaryHref?.startsWith("tel:")')
    expect(canvasSource).toContain('const primaryHref: string | null | undefined = block.primary?.href?.trim()')
    expect(canvasSource).toContain('primaryHref?.startsWith("mailto:") || primaryHref?.startsWith("tel:")')
    expect(canvasSource).not.toContain("const contactCta = block.primary?.href?.trim() ? block.primary : block.secondary")
  })

  it("keeps Amicare source variant identity without applying native source classes to legacy editable sections", () => {
    const cases: Array<{ file: string; variantClass: string; variant: string }> = [
      { file: "Hero.tsx", variantClass: "cms-block--source-amicare-zen-hero", variant: "amicareZenHero" },
      { file: "FeatureList.tsx", variantClass: "cms-block--source-amicare-care-cards", variant: "amicareCareCards" },
      { file: "RichText.tsx", variantClass: "cms-block--source-amicare-editorial", variant: "amicareEditorial" },
      { file: "CTA.tsx", variantClass: "cms-block--source-amicare-quote-contact", variant: "amicareQuoteContact" },
      { file: "ContactSection.tsx", variantClass: "cms-block--source-amicare-contact-form", variant: "amicareContactForm" },
      { file: "FAQ.tsx", variantClass: "cms-block--source-amicare-warm-accordion", variant: "amicareWarmAccordion" },
      { file: "Testimonials.tsx", variantClass: "cms-block--source-amicare-story-cards", variant: "amicareStoryCards" },
    ]

    for (const { file, variantClass, variant } of cases) {
      const canvasSource = read(`apps/cms/src/components/editor/canvas/blocks/${file}`)
      const propsSource = extractMergedSectionPropsSource(canvasSource)
      expect(propsSource).toContain("canvasSourceVariantClassName(block, legacyTenant,")
      expect(propsSource).toContain("canvasSourceVariantDataAttribute(block, legacyTenant)")
      expect(propsSource).toContain('rendererDom: "legacy"')

      const catalog = read("packages/contracts/src/block-catalog.ts")
      expect(catalog).toContain(`variant: "${variant}"`)
      expect(catalog).toContain(`rendererClassName: "${variantClass}"`)
    }
  })

  it("stamps Amicare source variant identity on live legacy renderer sections", () => {
    expect(amicareSource).toContain('import { runtimeVariantDataAttribute } from "../../blocks/variants"')
    expect(amicareSource).toContain('runtimeVariantDataAttribute(block, { legacyTenant: "amicare" })')
    expect(amicareSource).toContain("data-source-variant={sourceVariant}")
    expect(amicareSource).not.toContain("rendererVariantClassName(block")
  })

  it("keeps Amicare contact form and split rich-text conditional markup aligned", () => {
    const rendererContactBody = amicareSource.slice(amicareSource.indexOf("function AmicareContactSection"))
    const contactCanvas = read("apps/cms/src/components/editor/canvas/blocks/ContactSection.tsx")
    const rendererRichTextBody = amicareSource.slice(amicareSource.indexOf("function AmicareRichText"))
    const richTextCanvas = read("apps/cms/src/components/editor/canvas/blocks/RichText.tsx")

    expect(rendererContactBody).toContain("amicare-button-primary rounded-md bg-accent")
    expect(contactCanvas).toContain('isAmicareLegacy ? "amicare-button-primary" : "text-bg"')
    expect(rendererRichTextBody).toContain("splitBody.body.children.length > 0")
    expect(richTextCanvas).toContain("splitBody.body.children.length > 0")
  })

  it("documents renderer-native migration in canvas-renderer-parity runbook", () => {
    const runbook = read("apps/cms/docs/runbooks/canvas-renderer-parity.md")
    expect(runbook).toContain("Renderer-native editable blocks")
    expect(runbook).toContain("BlockRenderOptions")
    expect(runbook).toContain("Not safe for a broad swap")
  })

  it("requires canvas section ids to flow through merged section props (no silent drift)", () => {
    const cases: Array<{ file: string; idExpression: string }> = [
      { file: "Hero.tsx", idExpression: 'resolveBlockAnchor(block, { legacyTenant, surface: "canvas" })' },
      { file: "FeatureList.tsx", idExpression: 'resolveBlockAnchor(block, { legacyTenant, surface: "canvas" })' },
      { file: "RichText.tsx", idExpression: 'resolveBlockAnchor(block, { legacyTenant, surface: "canvas" })' },
      { file: "CTA.tsx", idExpression: "sectionId" },
      { file: "FAQ.tsx", idExpression: "block.anchor || undefined" },
      { file: "Testimonials.tsx", idExpression: "block.anchor || undefined" },
    ]
    for (const { file, idExpression } of cases) {
      const source = read(`apps/cms/src/components/editor/canvas/blocks/${file}`)
      expectMergedSectionId(source, idExpression)
    }
  })
})
