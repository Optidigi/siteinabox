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

/** Pull `id={...}` expression from the first `<section` in a canvas component export. */
function extractCanvasSectionId(source: string): string | null {
  const sectionIdx = source.indexOf("<section")
  if (sectionIdx < 0) return null
  const slice = source.slice(sectionIdx, sectionIdx + 400)
  const idMatch = slice.match(/id=\{([^}]+)\}/)
  return idMatch?.[1]?.trim() ?? null
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
      amicareFallback: string
      canvasExpr: string
    }> = [
      {
        label: "hero",
        amicareFn: "AmicareHero",
        canvasFile: "apps/cms/src/components/editor/canvas/blocks/Hero.tsx",
        amicareFallback: '"top"',
        canvasExpr: 'block.anchor || "top"',
      },
      {
        label: "featureList",
        amicareFn: "AmicareFeatureList",
        canvasFile: "apps/cms/src/components/editor/canvas/blocks/FeatureList.tsx",
        amicareFallback: '"werkwijze"',
        canvasExpr: 'block.anchor || (isAmicareLegacy ? "werkwijze" : "features")',
      },
      {
        label: "richText",
        amicareFn: "AmicareRichText",
        canvasFile: "apps/cms/src/components/editor/canvas/blocks/RichText.tsx",
        amicareFallback: '"over"',
        canvasExpr: 'block.anchor || (legacyTenant === "amicare" ? "over" : undefined)',
      },
      {
        label: "cta quote",
        amicareFn: "AmicareCTA",
        canvasFile: "apps/cms/src/components/editor/canvas/blocks/CTA.tsx",
        amicareFallback: '(isContact ? "contact" : "wat-telt")',
        canvasExpr: 'isContact ? "contact" : isAmicareLegacy ? "wat-telt" : "cta"',
      },
    ]

    for (const { label, amicareFn, canvasFile, amicareFallback, canvasExpr } of cases) {
      it(`aligns ${label} default anchor between canvas and Amicare renderer`, () => {
        const amicareBody = amicareSource.slice(amicareSource.indexOf(`function ${amicareFn}`))
        expect(amicareBody).toContain(`block.anchor || ${amicareFallback}`)

        const canvasSource = read(canvasFile)
        expect(canvasSource).toContain(canvasExpr)
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
        const canvasMatch = canvasSource.match(/<section[\s\S]*?className="([^"]+)"/)
        expect(canvasMatch?.[1], `${canvasFile} section class`).toBeTruthy()

        expectClassParity(label, canvasMatch![1]!, rendererClass!, required)
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

  it("requires canvas section ids to be explicit expressions (no silent drift)", () => {
    const cases: Array<{ file: string; mustInclude: string }> = [
      { file: "Hero.tsx", mustInclude: "block.anchor" },
      { file: "FeatureList.tsx", mustInclude: "block.anchor" },
      { file: "RichText.tsx", mustInclude: "block.anchor" },
      { file: "CTA.tsx", mustInclude: "sectionId" },
      { file: "FAQ.tsx", mustInclude: "block.anchor" },
      { file: "Testimonials.tsx", mustInclude: "block.anchor" },
    ]
    for (const { file, mustInclude } of cases) {
      const source = read(`apps/cms/src/components/editor/canvas/blocks/${file}`)
      const idExpr = extractCanvasSectionId(source)
      expect(idExpr, `${file} section id`).toBeTruthy()
      expect(source).toContain(mustInclude)
    }
  })
})
