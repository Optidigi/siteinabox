import { createHash } from "node:crypto"
import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import type { Block } from "@siteinabox/contracts"
import { SITE_SELF_SERVE_SOURCE_BACKED_BLOCK_VARIANTS } from "@siteinabox/contracts/block-catalog"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { BlockRenderer } from "@siteinabox/site-renderer"
import { themeToCssVars } from "@siteinabox/site-renderer/theme/css-vars"
import {
  getProviderBlockDefinition,
  getSourceBackedVariantRenderer,
  providerBlockDefinitions,
  tailwindPlusMarketingBlogThreeColumnDemoSlots,
  tailwindPlusMarketingContactCenteredDemoSlots,
  tailwindPlusMarketingCtaDarkPanelWithAppScreenshotDemoSlots,
  tailwindPlusMarketingFeatureCentered2x2GridDemoSlots,
  tailwindPlusMarketingFeatureWithProductScreenshotDemoSlots,
  tailwindPlusMarketingHeroSimpleCenteredDemoSlots,
  tailwindPlusMarketingLogoCloudSimpleWithHeadingDemoSlots,
  tailwindPlusMarketingPricingTwoTiersWithEmphasizedRightTierDemoSlots,
  tailwindPlusMarketingStatsSimpleDemoSlots,
  tailwindPlusMarketingTeamWithSmallImagesDemoSlots,
  tailwindPlusMarketingTestimonialSimpleCenteredDemoSlots,
  validateProviderBlockInstance,
} from "@siteinabox/site-renderer/source-blocks"

const repoRoot = path.resolve(process.cwd(), process.cwd().endsWith(`${path.sep}apps${path.sep}cms`) ? "../.." : ".")
const fromRepoRoot = (relativePath: string) => path.join(repoRoot, relativePath)

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

const normalizeSource = (source: string) =>
  source.replace(/\r\n/g, "\n").replace(/[ \t]+$/gm, "").trim()

const extractFixtureClassNames = (source: string) => [
  ...source.matchAll(/\bclass(?:Name)?=["']([^"']+)["']/g),
].map((match) => match[1]!.trim())

const selectorsFor = (css: string) =>
  [...css.matchAll(/([^{}]+)\{/g)]
    .flatMap((match) => match[1]!.split(","))
    .map((selector) => selector.trim())
    .filter(Boolean)

const providerCases = [
  {
    id: "tailwindplus.marketing.hero.simple-centered",
    folder: "packages/site-renderer/src/source-blocks/tailwindplus/marketing/hero/simple-centered",
    block: tailwindPlusMarketingHeroSimpleCenteredDemoSlots,
    classes: [
      "relative isolate px-6 pt-14 lg:px-8",
      "mx-auto max-w-2xl py-32 sm:py-48 lg:py-56",
      "text-5xl font-semibold tracking-tight text-balance text-gray-900 sm:text-7xl",
      "rounded-md bg-indigo-600 px-3.5 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-indigo-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600",
    ],
    allowedSlotClassDeltas: ["font-semibold text-indigo-600", "absolute inset-0"],
  },
  {
    id: "tailwindplus.marketing.feature.with-product-screenshot",
    folder: "packages/site-renderer/src/source-blocks/tailwindplus/marketing/feature/with-product-screenshot",
    block: tailwindPlusMarketingFeatureWithProductScreenshotDemoSlots,
    classes: [
      "overflow-hidden bg-white py-24 sm:py-32",
      "mx-auto grid max-w-2xl grid-cols-1 gap-x-8 gap-y-16 sm:gap-y-20 lg:mx-0 lg:max-w-none lg:grid-cols-2",
      "w-3xl max-w-none rounded-xl shadow-xl ring-1 ring-gray-400/10 sm:w-228 md:-ml-4 lg:ml-0",
    ],
  },
  {
    id: "tailwindplus.marketing.feature.centered-2x2-grid",
    folder: "packages/site-renderer/src/source-blocks/tailwindplus/marketing/feature/centered-2x2-grid",
    block: tailwindPlusMarketingFeatureCentered2x2GridDemoSlots,
    classes: [
      "bg-white py-24 sm:py-32",
      "mx-auto max-w-2xl lg:text-center",
      "grid max-w-xl grid-cols-1 gap-x-8 gap-y-10 lg:max-w-none lg:grid-cols-2 lg:gap-y-16",
    ],
  },
  {
    id: "tailwindplus.marketing.cta.dark-panel-with-app-screenshot",
    folder: "packages/site-renderer/src/source-blocks/tailwindplus/marketing/cta/dark-panel-with-app-screenshot",
    block: tailwindPlusMarketingCtaDarkPanelWithAppScreenshotDemoSlots,
    classes: [
      "relative isolate overflow-hidden bg-gray-900 px-6 pt-16 shadow-2xl sm:rounded-3xl sm:px-16 md:pt-24 lg:flex lg:gap-x-20 lg:px-24 lg:pt-0",
      "mx-auto max-w-md text-center lg:mx-0 lg:flex-auto lg:py-32 lg:text-left",
      "absolute top-0 left-0 w-228 max-w-none rounded-md bg-white/5 ring-1 ring-white/10",
    ],
  },
  {
    id: "tailwindplus.marketing.contact.centered",
    folder: "packages/site-renderer/src/source-blocks/tailwindplus/marketing/contact/centered",
    block: tailwindPlusMarketingContactCenteredDemoSlots,
    classes: [
      "isolate bg-white px-6 py-24 sm:py-32 lg:px-8",
      "mx-auto mt-16 max-w-xl sm:mt-20",
      "grid grid-cols-1 gap-x-8 gap-y-6 sm:grid-cols-2",
    ],
  },
  {
    id: "tailwindplus.marketing.testimonial.simple-centered",
    folder: "packages/site-renderer/src/source-blocks/tailwindplus/marketing/testimonial/simple-centered",
    block: tailwindPlusMarketingTestimonialSimpleCenteredDemoSlots,
    classes: [
      "relative isolate overflow-hidden bg-white px-6 py-24 sm:py-32 lg:px-8",
      "text-center text-xl/8 font-semibold text-gray-900 sm:text-2xl/9",
      "mt-4 flex items-center justify-center space-x-3 text-base",
    ],
  },
  {
    id: "tailwindplus.marketing.stats.simple",
    folder: "packages/site-renderer/src/source-blocks/tailwindplus/marketing/stats/simple",
    block: tailwindPlusMarketingStatsSimpleDemoSlots,
    classes: [
      "bg-white py-24 sm:py-32",
      "grid grid-cols-1 gap-x-8 gap-y-16 text-center lg:grid-cols-3",
      "order-first text-3xl font-semibold tracking-tight text-gray-900 sm:text-5xl",
    ],
  },
  {
    id: "tailwindplus.marketing.logo-cloud.simple-with-heading",
    folder: "packages/site-renderer/src/source-blocks/tailwindplus/marketing/logo-cloud/simple-with-heading",
    block: tailwindPlusMarketingLogoCloudSimpleWithHeadingDemoSlots,
    classes: [
      "bg-white py-24 sm:py-32",
      "text-center text-lg/8 font-semibold text-gray-900",
      "mx-auto mt-10 grid max-w-lg grid-cols-4 items-center gap-x-8 gap-y-10 sm:max-w-xl sm:grid-cols-6 sm:gap-x-10 lg:mx-0 lg:max-w-none lg:grid-cols-5",
    ],
  },
  {
    id: "tailwindplus.marketing.pricing.two-tiers-with-emphasized-right-tier",
    folder: "packages/site-renderer/src/source-blocks/tailwindplus/marketing/pricing/two-tiers-with-emphasized-right-tier",
    block: tailwindPlusMarketingPricingTwoTiersWithEmphasizedRightTierDemoSlots,
    classes: [
      "relative isolate bg-white px-6 py-24 sm:py-32 lg:px-8",
      "mx-auto mt-16 grid max-w-lg grid-cols-1 items-center gap-y-6 sm:mt-20 sm:gap-y-0 lg:max-w-4xl lg:grid-cols-2",
      "relative rounded-3xl bg-gray-900 p-8 shadow-2xl ring-1 ring-gray-900/10 sm:p-10",
      "mt-8 block rounded-md bg-indigo-500 px-3.5 py-2.5 text-center text-sm font-semibold text-white shadow-xs hover:bg-indigo-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 sm:mt-10",
    ],
  },
  {
    id: "tailwindplus.marketing.team.with-small-images",
    folder: "packages/site-renderer/src/source-blocks/tailwindplus/marketing/team/with-small-images",
    block: tailwindPlusMarketingTeamWithSmallImagesDemoSlots,
    classes: [
      "bg-white py-24 sm:py-32",
      "mx-auto grid max-w-7xl gap-20 px-6 lg:px-8 xl:grid-cols-3",
      "grid gap-x-8 gap-y-12 sm:grid-cols-2 sm:gap-y-16 xl:col-span-2",
      "size-16 rounded-full outline-1 -outline-offset-1 outline-black/5",
    ],
  },
  {
    id: "tailwindplus.marketing.blog.three-column",
    folder: "packages/site-renderer/src/source-blocks/tailwindplus/marketing/blog/three-column",
    block: tailwindPlusMarketingBlogThreeColumnDemoSlots,
    classes: [
      "bg-white py-24 sm:py-32",
      "mx-auto mt-10 grid max-w-2xl grid-cols-1 gap-x-8 gap-y-16 border-t border-gray-200 pt-10 sm:mt-16 sm:pt-16 lg:mx-0 lg:max-w-none lg:grid-cols-3",
      "flex max-w-xl flex-col items-start justify-between",
      "relative z-10 rounded-full bg-gray-50 px-3 py-1.5 font-medium text-gray-600 hover:bg-gray-100",
    ],
    allowedSlotClassDeltas: ["absolute inset-0"],
  },
] satisfies Array<{
  id: string
  folder: string
  block: Block
  classes: string[]
  allowedSlotClassDeltas?: string[]
}>

const fixtureTextFor = (folder: string) =>
  ["upstream.react.tsx", "upstream.html"]
    .map((file) => fromRepoRoot(`${folder}/${file}`))
    .filter((filePath) => existsSync(filePath))
    .map((filePath) => readFileSync(filePath, "utf8"))

const fixtureTextForHash = (folder: string, sourceHash: string) => {
  const source = fixtureTextFor(folder).find((candidate) =>
    `sha256:${createHash("sha256").update(normalizeSource(candidate)).digest("hex")}` === sourceHash,
  )
  if (!source) throw new Error(`No fixture in ${folder} matches ${sourceHash}`)
  return source
}

const rendererParityFixtureFor = (folder: string) => {
  const reactFixture = fromRepoRoot(`${folder}/upstream.react.tsx`)
  if (existsSync(reactFixture)) return readFileSync(reactFixture, "utf8")
  return fixtureTextForHash(
    folder,
    providerCases.find((testCase) => testCase.folder === folder)
      ? getProviderBlockDefinition(providerCases.find((testCase) => testCase.folder === folder)!.block)?.source.sourceHash ?? ""
      : "",
  )
}

describe("provider block runtime", () => {
  it("has complete active provider definitions with renderers, slots, metadata, and source hashes", () => {
    expect(providerBlockDefinitions).toHaveLength(providerCases.length)

    for (const testCase of providerCases) {
      const definition = providerBlockDefinitions.find((candidate) => candidate.id === testCase.id)
      expect(definition, testCase.id).toBeTruthy()
      expect(definition?.renderer, testCase.id).toBe(getSourceBackedVariantRenderer(testCase.block))
      expect(Object.keys(definition?.slots ?? {}).length, testCase.id).toBeGreaterThan(0)
      expect(definition?.source.sourceHash, testCase.id).toMatch(/^sha256:[a-f0-9]{64}$/)
      expect(definition?.source.capturedAt, testCase.id).toMatch(/^\d{4}-\d{2}-\d{2}$/)

      const hashes = fixtureTextFor(testCase.folder).map((source) =>
        `sha256:${createHash("sha256").update(normalizeSource(source)).digest("hex")}`,
      )
      expect(hashes, testCase.id).toContain(definition?.source.sourceHash)
    }
  })

  it("fails closed for unresolved provider variants instead of falling back to generic renderers", () => {
    const html = renderToStaticMarkup(
      <BlockRenderer
        block={{ ...tailwindPlusMarketingHeroSimpleCenteredDemoSlots, designVariant: "tailwindPlusMissingVariant" }}
        index={0}
      />,
    )

    expect(html).toContain("cms-block--provider-error")
    expect(html).toContain("Unresolved provider block variant")
    expect(html).not.toContain("cms-block__title")
  })

  it("rejects inactive slots and exact provider repeater violations", () => {
    const issues = [
      ...validateProviderBlockInstance({
        ...tailwindPlusMarketingHeroSimpleCenteredDemoSlots,
        pills: [{ label: "Not in this provider source" }],
        image: { url: "/demo.png", alt: "Demo" },
      }),
      ...validateProviderBlockInstance({
        ...tailwindPlusMarketingStatsSimpleDemoSlots,
        title: inlineRoot("Inactive title"),
        intro: blockRoot("Inactive intro."),
        items: [
          { value: "24", label: "Projects", description: blockRoot("Inactive description.") },
          { value: "7", label: "Days" },
        ],
      }),
      ...validateProviderBlockInstance({
        ...tailwindPlusMarketingFeatureCentered2x2GridDemoSlots,
        image: { url: "/inactive.png", alt: "Inactive image" },
        features: tailwindPlusMarketingFeatureCentered2x2GridDemoSlots.features.slice(0, 3),
      }),
      ...validateProviderBlockInstance({
        ...tailwindPlusMarketingLogoCloudSimpleWithHeadingDemoSlots,
        intro: blockRoot("Inactive intro."),
        logos: tailwindPlusMarketingLogoCloudSimpleWithHeadingDemoSlots.logos.slice(0, 4),
      }),
      ...validateProviderBlockInstance({
        ...tailwindPlusMarketingPricingTwoTiersWithEmphasizedRightTierDemoSlots,
        plans: [
          {
            ...tailwindPlusMarketingPricingTwoTiersWithEmphasizedRightTierDemoSlots.plans[0]!,
            badge: "Unsupported badge",
          },
        ],
      }),
      ...validateProviderBlockInstance({
        ...tailwindPlusMarketingTeamWithSmallImagesDemoSlots,
        members: tailwindPlusMarketingTeamWithSmallImagesDemoSlots.members.slice(0, 1),
      }),
      ...validateProviderBlockInstance({
        ...tailwindPlusMarketingBlogThreeColumnDemoSlots,
        posts: tailwindPlusMarketingBlogThreeColumnDemoSlots.posts.slice(0, 2),
      }),
    ]

    expect(issues.map((issue) => issue.code)).toEqual(expect.arrayContaining([
      "inactive_slot_value",
      "slot_count_out_of_range",
    ]))
    expect(issues.map((issue) => issue.path.join("."))).toEqual(expect.arrayContaining([
      "image",
      "pills",
      "title",
      "intro",
      "items.0.description",
      "items",
      "features",
      "logos",
      "plans.0.badge",
      "plans",
      "members",
      "posts",
    ]))
  })

  it("renders every active provider component with upstream Tailwind class parity", () => {
    for (const testCase of providerCases) {
      const html = renderToStaticMarkup(<BlockRenderer block={testCase.block} index={0} />)
      const upstream = rendererParityFixtureFor(testCase.folder)

      expect(html, testCase.id).toContain(`data-source-variant="${testCase.id}"`)
      expect(html, testCase.id).toContain('data-provider-block="tailwindplus"')
      expect(html, testCase.id).toContain(`data-provider-variant="${testCase.id}"`)
      expect(html, testCase.id).toContain('data-source-backed-block="true"')
      const allowedSlotClassDeltas = new Set(testCase.allowedSlotClassDeltas ?? [])
      for (const className of extractFixtureClassNames(upstream).filter((className) => !allowedSlotClassDeltas.has(className))) {
        expect(html, `${testCase.id} render missing upstream className: ${className}`).toContain(className)
      }
      for (const className of testCase.classes) {
        expect(upstream, `${testCase.id} upstream missing ${className}`).toContain(className)
        expect(html, `${testCase.id} render missing ${className}`).toContain(className)
      }
    }
  })

  it("resolves the same provider definition for canonical provider IDs and stored legacy designVariant values", () => {
    for (const testCase of providerCases) {
      expect(getProviderBlockDefinition(testCase.block)?.id).toBe(testCase.id)
      const legacyDesignVariant = getProviderBlockDefinition(testCase.block)?.legacyDesignVariant
      expect(legacyDesignVariant, testCase.id).toBeTruthy()
      expect(getProviderBlockDefinition({
        ...testCase.block,
        designVariant: legacyDesignVariant,
      })?.id).toBe(testCase.id)
    }
  })

  it("keeps self-serve catalog projection in lockstep with executable provider definitions", () => {
    expect(SITE_SELF_SERVE_SOURCE_BACKED_BLOCK_VARIANTS).toHaveLength(providerBlockDefinitions.length)

    for (const variant of SITE_SELF_SERVE_SOURCE_BACKED_BLOCK_VARIANTS) {
      const definition = providerBlockDefinitions.find((candidate) =>
        candidate.blockType === variant.slug &&
        candidate.id === variant.providerVariantId &&
        candidate.legacyDesignVariant === variant.legacyDesignVariant
      )
      expect(definition, variant.variantId).toBeTruthy()
      expect(variant.variant, variant.variantId).toBe(definition?.id)
      expect(variant.designVariant, variant.variantId).toBe(definition?.id)
      expect(variant.rendererClassName, variant.variantId).toBe(definition?.rendererClassName)
    }
  })

  it("keeps generic renderer CSS scoped away from provider block roots", () => {
    const rendererCss = readFileSync(fromRepoRoot("packages/site-renderer/src/styles.css"), "utf8")
    const rendererShellCss = readFileSync(fromRepoRoot("apps/renderer/src/styles/site.css"), "utf8")
    const cmsRendererShellCss = readFileSync(fromRepoRoot("apps/cms/src/styles/generated-site-renderer.css"), "utf8")

    const unsafeSelectors = selectorsFor(rendererCss).filter((selector) =>
      selector.includes(".site-renderer:not([data-tenant-renderer])") &&
      selector.includes(".cms-block") &&
      !selector.includes(":not([data-provider-block])"),
    )

    expect(unsafeSelectors).toEqual([])
    expect(rendererShellCss).toContain('@import "tailwindcss" source(none);')
    expect(rendererShellCss).toContain('@source "../../../../packages/site-renderer/src";')
    expect(cmsRendererShellCss).toContain('@import "tailwindcss" source(none);')
    expect(cmsRendererShellCss).toContain('@source "../../../../packages/site-renderer/src";')
  })

  it("maps SiaB theme tokens onto static Tailwind provider utility variables", () => {
    const css = themeToCssVars({
      colors: {
        accent: "#2563eb",
        bg: "#ffffff",
        ink: "#111827",
        muted: "#6b7280",
        card: "#f9fafb",
        rule: "rgba(17, 24, 39, 0.1)",
      },
      fonts: { heading: "Inter", text: "Inter" },
      radius: "0.375rem",
      mode: "light",
    })

    expect(css).toContain("--color-indigo-600:#2563eb")
    expect(css).toContain("--color-indigo-500:#2563eb")
    expect(css).toContain("--color-gray-900:#111827")
    expect(css).toContain("--color-gray-500:#6b7280")
    expect(css).toContain("--font-sans:Inter")
    expect(css).toContain("--radius-md:0.375rem")
  })
})
