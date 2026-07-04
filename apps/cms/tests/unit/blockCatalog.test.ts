import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"
import type { SiteBlockCatalogVariant } from "@siteinabox/contracts/block-catalog"
import {
  APPROVED_V1_MARKETING_CAPABILITY_COVERAGE,
  DEFERRED_SOURCE_BLOCK_CANDIDATES,
  DEFERRED_V1_MARKETING_BLOCKS,
  DEFERRED_V1_MARKETING_RENDERER_BLOCKS,
  isApprovedSourceBackedVariant,
  REQUIRED_V1_MARKETING_BLOCKS,
  SITE_BLOCK_CATALOG,
  SITE_BLOCK_CATALOG_BY_SLUG,
  SITE_BLOCK_REFERENCE_SOURCES,
  SITE_CHROME_CATALOG,
  SITE_GENERATION_BLOCK_CATALOG,
  SITE_SELF_SERVE_CHROME_VARIANTS,
  SITE_SELF_SERVE_SOURCE_BACKED_BLOCK_VARIANTS,
  SITE_SOURCE_BACKED_BLOCK_VARIANTS,
  SITE_SOURCE_BACKED_CHROME_VARIANTS,
} from "@siteinabox/contracts/block-catalog"
import {
  GeneratedBlockSpecSchema,
  GeneratedSiteSettingsSchema,
} from "@siteinabox/contracts/generation"
import type { GeneratedBlockSpec } from "@siteinabox/contracts/generation"
import { tenantSiteGenerationSpecs } from "@siteinabox/contracts/fixtures/tenants"
import { SITE_BLOCK_SLUGS, SITE_GENERATION_BLOCK_SLUGS } from "@siteinabox/contracts/site"
import { v1FixturePage } from "@siteinabox/site-renderer"
import { v1FixtureSettings } from "@siteinabox/site-renderer"

const inlineRoot = (text: string) => ({
  t: "root" as const,
  variant: "inline" as const,
  children: [{ t: "text" as const, v: text }],
})

const blockRoot = (text: string) => ({
  t: "root" as const,
  variant: "block" as const,
  children: [{ t: "paragraph" as const, children: [{ t: "text" as const, v: text }] }],
})

const repoRoot = path.resolve(process.cwd(), process.cwd().endsWith(`${path.sep}apps${path.sep}cms`) ? "../.." : ".")
const fromRepoRoot = (relativePath: string) => path.join(repoRoot, relativePath)

type PackageManifest = {
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
}

const readPackageManifest = (relativePath: string): PackageManifest =>
  JSON.parse(readFileSync(fromRepoRoot(relativePath), "utf8")) as PackageManifest

const hasPackageDependency = (manifest: PackageManifest, packageName: string) =>
  Boolean(manifest.dependencies?.[packageName] ?? manifest.devDependencies?.[packageName])

describe("renderer block catalog", () => {
  it("catalogs every currently supported renderer block", () => {
    expect(SITE_BLOCK_CATALOG.map((entry) => entry.slug)).toEqual(expect.arrayContaining([...SITE_BLOCK_SLUGS]))
    expect(SITE_BLOCK_CATALOG).toHaveLength(SITE_BLOCK_SLUGS.length)

    for (const slug of SITE_BLOCK_SLUGS) {
      const entry = SITE_BLOCK_CATALOG_BY_SLUG[slug]
      expect(entry.slug).toBe(slug)
      expect(entry.status).toBe("approved")
      expect(entry.contractType).toMatch(/Block$/)
      expect(entry.runtimeValidationTarget).toContain("validateSiteGenerationSpecForCms")
      expect(entry.cmsEditableFields.length).toBeGreaterThan(0)
      expect(entry.renderer.package).toBe("@siteinabox/site-renderer")
      expect(entry.renderer.component).toMatch(/Renderer$/)
      expect(entry.themeBehavior.length).toBeGreaterThan(0)
      expect(entry.fixtureCoverage.length).toBeGreaterThan(0)
      expect(entry.variants.every((variant) => variant.provenance)).toBe(true)
      expect(entry.variants.every((variant) => variant.variant && !variant.variant.includes(":"))).toBe(true)
      expect(entry.variants.every((variant) => variant.rendererSupportStatus === "supported")).toBe(true)
    }

    const globalPageBlockVariantSources = SITE_BLOCK_CATALOG.flatMap((entry) =>
      entry.variants.filter((variant) => variant.scope.kind === "global").map((variant) => variant.provenance.sourceName),
    )
    expect(globalPageBlockVariantSources).not.toContain("SIAB")
  })

  it("accepts new structured marketing contracts and rejects unsupported variants or raw code", () => {
    const pricingBlock: GeneratedBlockSpec = {
      blockType: "pricing",
      designVariant: "tailwindPlusSimpleTiers",
      title: inlineRoot("Pakketten"),
      intro: blockRoot("Kies een passend pakket."),
      plans: [
        {
          title: inlineRoot("Basis"),
          description: blockRoot("Voor starters."),
          price: "€499",
          period: "eenmalig",
          features: [{ label: inlineRoot("Een pagina"), included: true }],
          cta: { label: "Start", href: "/intake" },
        },
      ],
    }

    const statsBlock: GeneratedBlockSpec = {
      blockType: "stats",
      designVariant: "tailwindPlusSimple",
      title: inlineRoot("Resultaten"),
      items: [{ value: "24", label: "Projecten", description: blockRoot("Opgeleverd dit jaar.") }],
    }

    const logoCloudBlock: GeneratedBlockSpec = {
      blockType: "logoCloud",
      designVariant: "tailwindPlusSimple",
      title: inlineRoot("Partners"),
      logos: [{ name: "Partner", image: { url: "/uploads/partner.svg" }, href: "https://example.com" }],
    }

    const teamBlock: GeneratedBlockSpec = {
      blockType: "team",
      designVariant: "tailwindPlusGrid",
      title: inlineRoot("Team"),
      members: [{ name: "Alex", role: "Founder", bio: blockRoot("Helpt klanten online groeien.") }],
    }

    const blogCardsBlock: GeneratedBlockSpec = {
      blockType: "blogCards",
      designVariant: "tailwindPlusThreeColumn",
      title: inlineRoot("Updates"),
      posts: [{ title: inlineRoot("Nieuwe site"), excerpt: blockRoot("Wat er verbeterde."), href: "/blog/nieuwe-site" }],
    }

    for (const block of [
      pricingBlock,
      statsBlock,
      logoCloudBlock,
      teamBlock,
      blogCardsBlock,
    ]) {
      expect(GeneratedBlockSpecSchema.safeParse(block).success, block.blockType).toBe(true)
    }

    expect(GeneratedBlockSpecSchema.safeParse({ ...pricingBlock, designVariant: "unsupportedProviderSteps" }).success).toBe(false)
    expect(GeneratedBlockSpecSchema.safeParse({ blockType: "processSteps", title: inlineRoot("Proces"), steps: [] }).success).toBe(false)
    expect(GeneratedBlockSpecSchema.safeParse({ blockType: "comparison", title: inlineRoot("Vergelijking"), columns: [], rows: [] }).success).toBe(false)
    expect(GeneratedBlockSpecSchema.safeParse({ ...teamBlock, html: "<section></section>" }).success).toBe(false)
    expect(GeneratedBlockSpecSchema.safeParse({
      ...pricingBlock,
      title: {
        t: "root",
        variant: "inline",
        children: [{ t: "text", v: "Styled", style: "color:red", color: "#f00", font: "Comic Sans MS" }],
      },
    }).success).toBe(false)
  })

  it("records vetted source status and keeps unavailable sources blocked", () => {
    expect(SITE_BLOCK_REFERENCE_SOURCES.tailwindPlusMarketing.availability).toBe("mixed")
    expect(SITE_BLOCK_REFERENCE_SOURCES.tailwindPlusMarketing.licenseStatus).toContain("Operator approval")
    expect(SITE_BLOCK_REFERENCE_SOURCES.tailblocks.availability).toBe("free")
    expect(SITE_BLOCK_REFERENCE_SOURCES.preline.availability).toBe("mixed")
    expect(SITE_BLOCK_REFERENCE_SOURCES.preline.notes).toContain("Free")
    expect(SITE_BLOCK_REFERENCE_SOURCES.preline.notes).toContain("Pro")
    expect(SITE_BLOCK_REFERENCE_SOURCES.tailgrids.availability).toBe("unavailable")
    expect(SITE_BLOCK_REFERENCE_SOURCES.tailgrids.notes).toContain("Not approved")
    expect(Object.keys(SITE_BLOCK_REFERENCE_SOURCES).sort()).toEqual([
      "preline",
      "tailblocks",
      "tailgrids",
      "tailwindPlusMarketing",
      "tenantRendererSnapshots",
    ])
  })

  it("separates first-catalog contract coverage from deferred renderer work", () => {
    expect(REQUIRED_V1_MARKETING_BLOCKS).toEqual(expect.arrayContaining([...SITE_BLOCK_SLUGS]))
    expect(APPROVED_V1_MARKETING_CAPABILITY_COVERAGE).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          capability: "newsletter",
          blockSlug: "contactSection",
          variantId: "contactSection:tailwindPlusNewsletterDetails",
        }),
      ]),
    )
    expect(DEFERRED_V1_MARKETING_BLOCKS).toEqual([])
    expect(DEFERRED_V1_MARKETING_RENDERER_BLOCKS).toEqual([])
    expect(DEFERRED_V1_MARKETING_RENDERER_BLOCKS).not.toContain("newsletter")
  })

  it("has compact exact-source provenance for implemented source-backed variants", () => {
    const providerBackedSlugs = [
      "hero",
      "featureList",
      "richText",
      "cta",
      "contactSection",
      "pricing",
      "stats",
      "logoCloud",
      "gallery",
      "team",
      "blogCards",
    ]
    expect(SITE_SOURCE_BACKED_BLOCK_VARIANTS.map((variant) => variant.slug)).toEqual(expect.arrayContaining(providerBackedSlugs))

    for (const variant of SITE_SOURCE_BACKED_BLOCK_VARIANTS) {
      expect(variant.variant, `${variant.variantId} missing runtime variant`).toBeTruthy()
      expect(variant.variant, `${variant.variantId} runtime variant should be scoped by blockType, not duplicated in the value`).not.toContain(":")
      expect(variant.rendererClassName, `${variant.variantId} missing rendererClassName`).toMatch(/^cms-block--source-/)
      expect(variant.provenance.url, `${variant.variantId} missing source URL`).toMatch(/^https:\/\//)
      expect(variant.provenance.upstreamBlockName, `${variant.variantId} missing upstream block name`).toBeTruthy()
      expect(variant.provenance.sourceAccessType, `${variant.variantId} missing source access type`).toMatch(
        /^(public-page-payload|public-page-copy|public-github-source)$/,
      )
      expect(variant.provenance.sourceAccess, `${variant.variantId} missing source access`).toBeTruthy()
      expect(["exact-source", "adapted-exact-style"]).toContain(variant.provenance.implementation)
      expect("localSourcePath" in variant.provenance, `${variant.variantId} should not point at raw local provider HTML`).toBe(
        false,
      )
      expect(variant.provenance.approvalStatus, `${variant.variantId} is not approved`).toBe("approved")
      expect(variant.provenance.sourceAvailability, `${variant.variantId} is not free/public`).toBe("free-public")
      expect(variant.provenance.licenseCompatibility, `${variant.variantId} is not license-compatible`).toBe("compatible")
      expect(variant.provenance.licenseStatus).not.toContain("disallows")
      expect(variant.provenance.retrieval, `${variant.variantId} missing retrieval process`).toBeTruthy()
      expect(variant.provenance.verifiedAt, `${variant.variantId} missing verification date`).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(variant.provenance.visualExactnessStatus, `${variant.variantId} missing visual exactness status`).toMatch(
        /^reviewed-(adapted-exact-style|exact-source)$/,
      )
      expect(variant.provenance.visualSourceNotes, `${variant.variantId} missing visual source notes`).toBeTruthy()
      expect(
        ["copy-paste-tailwind", "provider-derived-package-css", "preline-ui", "tailwind-plus-elements"],
        `${variant.variantId} uses an unsupported source integration kind`,
      ).toContain(variant.provenance.runtime.kind)
      expect(variant.provenance.runtime.supportedAstroPath, `${variant.variantId} missing Astro integration path`).toBeTruthy()
      expect(variant.provenance.runtime.docs.length, `${variant.variantId} missing provider docs`).toBeGreaterThan(0)
      expect(variant.provenance.runtime.notes, `${variant.variantId} missing runtime notes`).toBeTruthy()
    }

    expect(SITE_SOURCE_BACKED_BLOCK_VARIANTS.some((variant) => variant.provenance.sourceName === "Tailwind Plus")).toBe(true)
    expect(SITE_SOURCE_BACKED_BLOCK_VARIANTS.some((variant) => variant.provenance.sourceName === "Tailblocks")).toBe(true)
    expect(SITE_SOURCE_BACKED_BLOCK_VARIANTS.some((variant) => variant.provenance.sourceName === "Preline UI")).toBe(true)
    expect(SITE_SELF_SERVE_SOURCE_BACKED_BLOCK_VARIANTS.map((variant) => variant.provenance.sourceName)).toEqual(
      expect.arrayContaining(["Tailwind Plus"]),
    )
    expect(new Set(SITE_SELF_SERVE_SOURCE_BACKED_BLOCK_VARIANTS.map((variant) => variant.provenance.sourceName))).toEqual(
      new Set(["Tailwind Plus"]),
    )
    expect(DEFERRED_SOURCE_BLOCK_CANDIDATES).toHaveLength(0)
  })

  it("does not require or expose raw provider source archives", () => {
    expect(JSON.stringify(SITE_BLOCK_CATALOG)).not.toContain("packages/contracts/block-sources")
    expect(JSON.stringify(SITE_CHROME_CATALOG)).not.toContain("packages/contracts/block-sources")

    for (const variant of [...SITE_SOURCE_BACKED_BLOCK_VARIANTS, ...SITE_SOURCE_BACKED_CHROME_VARIANTS]) {
      expect("localSourcePath" in variant.provenance, `${variant.variantId} has obsolete local archive provenance`).toBe(
        false,
      )
    }
  })

  it("records the current native integration route for source-backed variants", () => {
    const byId = new Map(SITE_SOURCE_BACKED_BLOCK_VARIANTS.map((variant) => [variant.variantId, variant]))

    for (const variantId of [
      "hero:tailwindPlusSimpleCentered",
      "featureList:tailwindPlusCentered2x2",
      "contactSection:tailwindPlusNewsletterDetails",
      "pricing:tailwindPlusSimpleTiers",
      "stats:tailwindPlusSimple",
      "logoCloud:tailwindPlusSimple",
      "team:tailwindPlusGrid",
      "blogCards:tailwindPlusThreeColumn",
    ]) {
      const runtime = byId.get(variantId)?.provenance.runtime
      expect(runtime?.kind, variantId).toBe("copy-paste-tailwind")
      expect(runtime?.interactive, variantId).toBe(false)
      expect(runtime?.packages, variantId).toBeUndefined()
      expect(runtime?.cssImports, variantId).toBeUndefined()
      expect(runtime?.jsImports, variantId).toBeUndefined()
    }

    expect(byId.has("comparison:matrix")).toBe(false)
  })

  it("catalogs chrome variants without turning chrome into page blocks or generation providers", () => {
    expect(SITE_CHROME_CATALOG.map((entry) => entry.id)).toEqual(
      expect.arrayContaining([
        "header:default",
        "header:amicareZen",
        "footer:default",
        "footer:amicareZen",
        "banner:default",
      ]),
    )
    expect(SITE_BLOCK_CATALOG.map((entry) => entry.slug)).not.toEqual(
      expect.arrayContaining(["header", "footer", "banner"]),
    )

    expect(SITE_CHROME_CATALOG.some((entry) => entry.area === "banner" && String(entry.variant) === "amicareZen")).toBe(false)
    expect(SITE_SOURCE_BACKED_CHROME_VARIANTS).toEqual([])

    expect(SITE_SELF_SERVE_CHROME_VARIANTS.map((variant) => variant.id)).toEqual([
      "header:default",
      "footer:default",
      "banner:default",
    ])
  })

  it("validates structured chrome settings and rejects code-like chrome fields", () => {
    const selfServeFixtureSettings = {
      ...v1FixtureSettings,
      chrome: {
        ...v1FixtureSettings.chrome,
        header: { ...v1FixtureSettings.chrome?.header, variant: "default" as const },
        footer: { ...v1FixtureSettings.chrome?.footer, variant: "default" as const },
        banner: { ...v1FixtureSettings.chrome?.banner, variant: "default" as const },
      },
    }

    expect(GeneratedSiteSettingsSchema.safeParse(selfServeFixtureSettings).success).toBe(true)
    expect(v1FixtureSettings.chrome?.header?.variant).toBe("default")
    expect(v1FixtureSettings.chrome?.footer?.variant).toBe("default")
    expect(v1FixtureSettings.chrome?.banner?.variant).toBe("default")
    expect(GeneratedSiteSettingsSchema.safeParse(v1FixtureSettings).success).toBe(true)

    expect(
      GeneratedSiteSettingsSchema.safeParse({
        ...selfServeFixtureSettings,
        chrome: {
          ...selfServeFixtureSettings.chrome,
          header: { ...selfServeFixtureSettings.chrome?.header, component: "GeneratedHeader" },
        },
      }).success,
    ).toBe(false)
    expect(
      GeneratedSiteSettingsSchema.safeParse({
        ...selfServeFixtureSettings,
        chrome: {
          ...selfServeFixtureSettings.chrome,
          footer: { ...selfServeFixtureSettings.chrome?.footer, rawHtml: "<footer />" },
        },
      }).success,
    ).toBe(false)
    expect(
      GeneratedSiteSettingsSchema.safeParse({
        ...selfServeFixtureSettings,
        chrome: {
          ...selfServeFixtureSettings.chrome,
          banner: { ...selfServeFixtureSettings.chrome?.banner, sourceCode: "export default function Banner() {}" },
        },
      }).success,
    ).toBe(false)
  })

  it("keeps renderer and preview stylesheet/runtime claims aligned", () => {
    const rendererPage = readFileSync(fromRepoRoot("apps/renderer/src/pages/[...path].astro"), "utf8")
    const rendererCss = readFileSync(fromRepoRoot("apps/renderer/src/styles/site.css"), "utf8")
    const cmsFrontendLayout = readFileSync(fromRepoRoot("apps/cms/src/app/(frontend)/layout.tsx"), "utf8")
    const cmsPreviewLayout = readFileSync(fromRepoRoot("apps/cms/src/app/(frontend)/(site-preview)/layout.tsx"), "utf8")
    const cmsAdminLayout = readFileSync(fromRepoRoot("apps/cms/src/app/(frontend)/(admin)/layout.tsx"), "utf8")
    const cmsEditorFrameLayout = readFileSync(fromRepoRoot("apps/cms/src/app/(editor-frame)/layout.tsx"), "utf8")
    const cmsPreviewCanvasCss = readFileSync(fromRepoRoot("apps/cms/src/styles/site-renderer-canvas.css"), "utf8")
    const rendererPackage = readPackageManifest("apps/renderer/package.json")
    const cmsPackage = readPackageManifest("apps/cms/package.json")

    expect(rendererPage).toContain('import "../styles/site.css"')
    expect(rendererCss).toContain('@import "tailwindcss" source(none);')
    expect(rendererCss).toContain('@import "@siteinabox/site-renderer/styles.css";')
    expect(rendererCss).toContain('@source "../../../../packages/site-renderer/src";')
    expect(rendererCss).not.toContain("preline")
    expect(rendererCss).not.toContain("packages/contracts/block-sources")
    expect(cmsFrontendLayout).not.toContain("site-renderer-preview.css")
    expect(cmsAdminLayout).not.toContain("site-renderer-preview.css")
    expect(cmsPreviewLayout.includes('import "@siteinabox/site-renderer/styles.css"')).toBe(false)
    expect(cmsPreviewLayout.includes('import "@/styles/site-renderer-canvas.css"')).toBe(false)
    expect(cmsEditorFrameLayout).toContain('import "@/styles/shadcn.css"')
    expect(cmsPreviewCanvasCss).toContain('@import "@siteinabox/site-renderer/canvas.css";')
    expect(cmsPreviewCanvasCss).not.toContain("[data-siab-editor-ui]")
    expect(cmsPreviewCanvasCss).not.toContain("preline")
    expect(cmsPreviewCanvasCss).not.toContain("packages/contracts/block-sources")
    expect(hasPackageDependency(rendererPackage, "@tailwindcss/vite")).toBe(true)

    for (const variant of SITE_SOURCE_BACKED_BLOCK_VARIANTS) {
      const runtime = variant.provenance.runtime
      const declaredPackages = runtime.packages ?? []

      for (const packageName of declaredPackages) {
        expect(
          hasPackageDependency(rendererPackage, packageName),
          `${variant.variantId} declares renderer runtime package ${packageName} that apps/renderer has not installed`,
        ).toBe(true)
        expect(
          hasPackageDependency(cmsPackage, packageName),
          `${variant.variantId} declares preview runtime package ${packageName} that apps/cms has not installed`,
        ).toBe(true)
      }

      if (runtime.interactive) {
        expect(
          [...declaredPackages, ...(runtime.jsImports ?? [])],
          `${variant.variantId} declares interactive runtime without a package or JS import`,
        ).not.toHaveLength(0)
      }
    }
  })

  it("blocks paid, locked, unavailable, license-incompatible, and visually unaudited source variants", () => {
    const catalogVariants = SITE_BLOCK_CATALOG.flatMap((entry) => [...entry.variants]) as SiteBlockCatalogVariant[]
    const approved = catalogVariants.find(isApprovedSourceBackedVariant)
    expect(approved).toBeTruthy()

    const blockedCases = [
      { sourceAvailability: "paid" as const },
      { sourceAvailability: "locked" as const },
      { sourceAvailability: "unavailable" as const },
      { sourceAvailability: "operator-archive-required" as const },
      { sourceAvailability: "license-incompatible" as const },
      { licenseCompatibility: "incompatible" as const },
      { approvalStatus: "blocked" as const },
      { approvalStatus: "deferred" as const },
      { sourceAccessType: "operator-provided-archive" as const },
      { sourceAccessType: "deferred" as const },
      { visualExactnessStatus: "needs-browser-comparison" as const },
      { visualExactnessStatus: "blocked" as const },
      { rendererSupportStatus: "deferred" as const },
      { rendererSupportStatus: "unsupported" as const },
      { retrieval: "" },
      { visualSourceNotes: "" },
      {
        runtime: {
          ...approved!.provenance.runtime,
          kind: "deferred" as const,
        },
      },
    ]

    for (const patch of blockedCases) {
      const candidate = {
        ...approved!,
        ...("rendererSupportStatus" in patch ? { rendererSupportStatus: patch.rendererSupportStatus } : {}),
        provenance: {
          ...approved!.provenance,
          ...patch,
        },
      }
      expect(isApprovedSourceBackedVariant(candidate), JSON.stringify(patch)).toBe(false)
    }
  })

  it("has fixture coverage for every catalog entry", () => {
    const fixtureBlockTypes = new Set([
      ...v1FixturePage.blocks.map((block) => block.blockType),
      ...tenantSiteGenerationSpecs.flatMap((spec) =>
        spec.pages.flatMap((page) => page.blocks.map((block) => block.blockType)),
      ),
    ])

    for (const entry of SITE_BLOCK_CATALOG) {
      expect(fixtureBlockTypes.has(entry.slug), `${entry.slug} missing fixture coverage`).toBe(true)
    }
  })

  it("exercises every source-backed renderer variant in the renderer fixture", () => {
    const fixtureVariants = new Set(
      v1FixturePage.blocks
        .map((block) => block.designVariant)
        .filter((variant): variant is string => typeof variant === "string"),
    )

    for (const variant of SITE_SOURCE_BACKED_BLOCK_VARIANTS) {
      expect(fixtureVariants.has(variant.variant), `${variant.variantId} missing fixture coverage`).toBe(true)
    }
  })
})
