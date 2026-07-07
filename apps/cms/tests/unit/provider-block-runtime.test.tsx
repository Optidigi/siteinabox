import { createHash } from "node:crypto"
import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import type { Block } from "@siteinabox/contracts"
import { SITE_SELF_SERVE_SOURCE_BACKED_BLOCK_VARIANTS } from "@siteinabox/contracts/block-catalog"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { BlockRenderer } from "@siteinabox/site-renderer"
import type { BlockEditSlots } from "@siteinabox/site-renderer"
import { themeToCssVars } from "@siteinabox/site-renderer/theme/css-vars"
import {
  getProviderBlockDefinition,
  getSourceBackedVariantRenderer,
  providerBlockDefinitions,
  selfServeProviderBlockDefinitions,
  tailwindPlusMarketingBentoThreeColumnBentoGridDemoSlots,
  tailwindPlusMarketingBlogThreeColumnDemoSlots,
  tailwindPlusMarketingContactCenteredDemoSlots,
  tailwindPlusMarketingContentStickyProductScreenshotDemoSlots,
  tailwindPlusMarketingCtaDarkPanelWithAppScreenshotDemoSlots,
  tailwindPlusMarketingFeatureCentered2x2GridDemoSlots,
  tailwindPlusMarketingFeatureWithProductScreenshotDemoSlots,
  tailwindPlusMarketingHeroSimpleCenteredDemoSlots,
  tailwindPlusMarketingHeroWithStatsDemoSlots,
  tailwindPlusMarketingLogoCloudSimpleWithHeadingDemoSlots,
  tailwindPlusMarketingNewsletterSideBySideWithDetailsDemoSlots,
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
    id: "tailwindplus.marketing.hero.with-stats",
    folder: "packages/site-renderer/src/source-blocks/tailwindplus/marketing/hero/with-stats",
    block: tailwindPlusMarketingHeroWithStatsDemoSlots,
    classes: [
      "relative isolate overflow-hidden bg-gray-900 py-24 sm:py-32",
      "absolute inset-0 -z-10 size-full object-cover object-right md:object-center",
      "text-5xl font-semibold tracking-tight text-white sm:text-7xl",
      "mt-16 grid grid-cols-1 gap-8 sm:mt-20 sm:grid-cols-2 lg:grid-cols-4",
    ],
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
    id: "tailwindplus.marketing.bento.three-column-bento-grid",
    folder: "packages/site-renderer/src/source-blocks/tailwindplus/marketing/bento/three-column-bento-grid",
    block: tailwindPlusMarketingBentoThreeColumnBentoGridDemoSlots,
    classes: [
      "bg-gray-50 py-24 sm:py-32",
      "mt-10 grid gap-4 sm:mt-16 lg:grid-cols-3 lg:grid-rows-2",
      "relative lg:row-span-2",
      "relative flex h-full flex-col overflow-hidden rounded-[calc(var(--radius-lg)+1px)] lg:rounded-l-[calc(2rem+1px)]",
      "@container relative min-h-120 w-full grow max-lg:mx-auto max-lg:max-w-sm",
      "absolute top-10 right-0 bottom-0 left-10 overflow-hidden rounded-tl-xl bg-gray-900 shadow-2xl outline outline-white/10",
    ],
  },
  {
    id: "tailwindplus.marketing.content.sticky-product-screenshot",
    folder: "packages/site-renderer/src/source-blocks/tailwindplus/marketing/content/sticky-product-screenshot",
    block: tailwindPlusMarketingContentStickyProductScreenshotDemoSlots,
    classes: [
      "relative isolate overflow-hidden bg-white px-6 py-24 sm:py-32 lg:overflow-visible lg:px-0",
      "absolute top-0 left-[max(50%,25rem)] h-256 w-512 -translate-x-1/2 mask-[radial-gradient(64rem_64rem_at_top,white,transparent)] stroke-gray-200",
      "-mt-12 -ml-12 p-12 lg:sticky lg:top-4 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:overflow-hidden",
      "w-3xl max-w-none rounded-xl bg-gray-900 shadow-xl ring-1 ring-gray-400/10 sm:w-228",
      "mt-8 space-y-8 text-gray-600",
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
    id: "tailwindplus.marketing.newsletter.side-by-side-with-details",
    folder: "packages/site-renderer/src/source-blocks/tailwindplus/marketing/newsletter/side-by-side-with-details",
    block: tailwindPlusMarketingNewsletterSideBySideWithDetailsDemoSlots,
    classes: [
      "relative isolate overflow-hidden bg-gray-900 py-16 sm:py-24 lg:py-32",
      "mx-auto grid max-w-2xl grid-cols-1 gap-x-8 gap-y-16 lg:max-w-none lg:grid-cols-2",
      "min-w-0 flex-auto rounded-md bg-white/5 px-3.5 py-2 text-base text-white outline-1 -outline-offset-1 outline-white/10 placeholder:text-gray-500 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-500 sm:text-sm/6",
      "grid grid-cols-1 gap-x-8 gap-y-10 sm:grid-cols-2 lg:pt-2",
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
    expect(validateProviderBlockInstance({
      ...tailwindPlusMarketingHeroWithStatsDemoSlots,
      cta: {},
      secondary: { label: "", href: null },
    } as any)).toEqual([])

    const issues = [
      ...validateProviderBlockInstance({
        ...tailwindPlusMarketingHeroWithStatsDemoSlots,
        links: tailwindPlusMarketingHeroWithStatsDemoSlots.links?.slice(0, 3),
        cta: { label: "Hidden primary", href: "/hidden" },
        secondary: { label: "Hidden secondary", href: "/hidden-secondary" },
        pills: [{ label: "Not in this provider source" }],
      }),
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
            cta: null,
          },
        ],
      }),
      ...validateProviderBlockInstance({
        ...tailwindPlusMarketingTeamWithSmallImagesDemoSlots,
        members: tailwindPlusMarketingTeamWithSmallImagesDemoSlots.members.slice(0, 1),
      }),
      ...validateProviderBlockInstance({
        ...tailwindPlusMarketingBentoThreeColumnBentoGridDemoSlots,
        items: [
          {
            ...tailwindPlusMarketingBentoThreeColumnBentoGridDemoSlots.items[0]!,
            icon: "layout-grid",
            cta: { label: "Unsupported", href: "/unsupported" },
          },
          ...tailwindPlusMarketingBentoThreeColumnBentoGridDemoSlots.items.slice(1, 3),
        ],
      }),
      ...validateProviderBlockInstance({
        ...tailwindPlusMarketingContentStickyProductScreenshotDemoSlots,
        cta: { label: "Unsupported", href: "/unsupported" },
      }),
      ...validateProviderBlockInstance({
        ...tailwindPlusMarketingBlogThreeColumnDemoSlots,
        posts: tailwindPlusMarketingBlogThreeColumnDemoSlots.posts.slice(0, 2),
      }),
      ...validateProviderBlockInstance({
        ...tailwindPlusMarketingContactCenteredDemoSlots,
        fields: tailwindPlusMarketingContactCenteredDemoSlots.fields.slice(0, 5),
      }),
    ]

    expect(issues.map((issue) => issue.code)).toEqual(expect.arrayContaining([
      "inactive_slot_value",
      "slot_count_out_of_range",
      "invalid_source_slot",
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
      "plans.cta",
      "plans",
      "members",
      "items.0.icon",
      "items.0.cta",
      "items",
      "cta",
      "posts",
      "links",
      "cta",
      "secondary",
      "fields",
    ]))
  })

  it("keeps the Tailwind Plus contact layout tied to source field roles", () => {
    const sourceFixtureHtml = rendererParityFixtureFor("packages/site-renderer/src/source-blocks/tailwindplus/marketing/contact/centered")
    const shuffled = {
      ...tailwindPlusMarketingContactCenteredDemoSlots,
      fields: [
        tailwindPlusMarketingContactCenteredDemoSlots.fields[5]!,
        tailwindPlusMarketingContactCenteredDemoSlots.fields[2]!,
        tailwindPlusMarketingContactCenteredDemoSlots.fields[0]!,
        tailwindPlusMarketingContactCenteredDemoSlots.fields[4]!,
        tailwindPlusMarketingContactCenteredDemoSlots.fields[1]!,
        tailwindPlusMarketingContactCenteredDemoSlots.fields[3]!,
        {
          name: "unexpected",
          label: "Unexpected",
          type: "text" as const,
        },
      ],
      provider: {
        ...tailwindPlusMarketingContactCenteredDemoSlots.provider,
        hiddenFields: [{ name: "tenantId", value: "tenant-1" }],
        honeypotField: "company_website",
      },
    }

    const html = renderToStaticMarkup(<BlockRenderer block={shuffled} index={0} />)
    const exactSourceHtml = renderToStaticMarkup(<BlockRenderer block={tailwindPlusMarketingContactCenteredDemoSlots} index={0} />)

    expect(sourceFixtureHtml).toContain("group relative inline-flex w-8 shrink-0 rounded-full bg-gray-200")
    expect(sourceFixtureHtml).toContain("absolute inset-0 size-full appearance-none focus:outline-hidden")
    expect(validateProviderBlockInstance(shuffled).map((issue) => issue.path.join("."))).toContain("fields")
    expect(validateProviderBlockInstance({
      ...tailwindPlusMarketingContactCenteredDemoSlots,
      fields: tailwindPlusMarketingContactCenteredDemoSlots.fields.map((field, index) =>
        index === 3 ? { ...field, type: "text" as const } : field,
      ),
    }).map((issue) => issue.path.join("."))).toContain("fields.3.type")
    expect(validateProviderBlockInstance({
      ...tailwindPlusMarketingContactCenteredDemoSlots,
      provider: {
        ...tailwindPlusMarketingContactCenteredDemoSlots.provider,
        hiddenFields: [{ name: "email", value: "collision" }],
        honeypotField: "message",
      },
    }).map((issue) => issue.path.join("."))).toEqual(expect.arrayContaining([
      "provider.hiddenFields.0.name",
      "provider.honeypotField",
    ]))
    expect(html.indexOf('name="first-name"')).toBeLessThan(html.indexOf('name="last-name"'))
    expect(html.indexOf('name="last-name"')).toBeLessThan(html.indexOf('name="company"'))
    expect(html.indexOf('name="company"')).toBeLessThan(html.indexOf('name="email"'))
    expect(html.indexOf('name="email"')).toBeLessThan(html.indexOf('name="phone-number"'))
    expect(html.indexOf('name="phone-number"')).toBeLessThan(html.indexOf('name="message"'))
    expect(html).not.toContain('name="unexpected"')
    expect(html).toContain('type="hidden"')
    expect(html).toContain('name="tenantId"')
    expect(html).toContain('class="hidden"')
    expect(html).toContain('name="company_website"')
    expect(exactSourceHtml).toContain("group relative inline-flex w-8 shrink-0 rounded-full bg-gray-200")
    expect(exactSourceHtml).toContain('type="checkbox"')
    expect(exactSourceHtml).toContain('name="agree-to-policies"')
    expect(exactSourceHtml).toContain("absolute inset-0 size-full appearance-none focus:outline-hidden")
    expect(exactSourceHtml.match(/type="checkbox"/g)).toHaveLength(1)
    expect(exactSourceHtml).not.toContain("size-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-600")
  })

  it("keeps testimonial optional media and role absence visually honest", () => {
    const noMediaOrRole = {
      ...tailwindPlusMarketingTestimonialSimpleCenteredDemoSlots,
      logo: null,
      items: [{
        ...tailwindPlusMarketingTestimonialSimpleCenteredDemoSlots.items[0]!,
        role: "",
        avatar: null,
      }],
    }

    const mediaPresentHtml = renderToStaticMarkup(<BlockRenderer block={tailwindPlusMarketingTestimonialSimpleCenteredDemoSlots} index={0} />)
    const noMediaOrRoleHtml = renderToStaticMarkup(<BlockRenderer block={noMediaOrRole} index={0} />)

    expect(mediaPresentHtml).toContain('class="mx-auto h-12"')
    expect(mediaPresentHtml).toContain('class="mx-auto size-10 rounded-full"')
    expect(mediaPresentHtml).toContain('class="fill-gray-900"')
    expect(noMediaOrRoleHtml).not.toContain('class="mx-auto h-12"')
    expect(noMediaOrRoleHtml).not.toContain('class="mx-auto size-10 rounded-full"')
    expect(noMediaOrRoleHtml).not.toContain('class="fill-gray-900"')
    expect(noMediaOrRoleHtml).not.toContain('class="text-gray-600"></div>')
    expect(validateProviderBlockInstance(noMediaOrRole).map((issue) => issue.path.join("."))).toEqual(expect.arrayContaining([
      "logo",
      "items.0.avatar",
    ]))
    expect(validateProviderBlockInstance({
      ...tailwindPlusMarketingTestimonialSimpleCenteredDemoSlots,
      items: [{ ...tailwindPlusMarketingTestimonialSimpleCenteredDemoSlots.items[0]!, role: "" }],
    })).toEqual([])
  })

  it("keeps fixed Tailwind Plus content slots separate and complete", () => {
    const blogHtml = renderToStaticMarkup(<BlockRenderer block={tailwindPlusMarketingBlogThreeColumnDemoSlots} index={0} />)
    expect(blogHtml).toContain("Marketing")
    expect(blogHtml).toContain("Co-Founder / CTO")
    expect(blogHtml).toContain("Sales")
    expect(blogHtml).toContain("Front-end Developer")

    const heroHtml = renderToStaticMarkup(<BlockRenderer block={tailwindPlusMarketingHeroWithStatsDemoSlots} index={0} />)
    expect(heroHtml).toContain("Open roles")
    expect(heroHtml).toContain("Internship program")
    expect(heroHtml).toContain("Our values")
    expect(heroHtml).toContain("Meet our leadership")
    expect(validateProviderBlockInstance(tailwindPlusMarketingHeroWithStatsDemoSlots)).toEqual([])

    const contentHtml = renderToStaticMarkup(<BlockRenderer block={tailwindPlusMarketingContentStickyProductScreenshotDemoSlots} index={0} />)
    expect(contentHtml).toContain("Et vitae blandit facilisi magna lacus commodo")
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

  it("omits optional empty CTAs from live provider output while preserving editor add affordances", () => {
    const block = {
      ...tailwindPlusMarketingHeroSimpleCenteredDemoSlots,
      cta: null,
      secondary: null,
    }

    const liveHtml = renderToStaticMarkup(<BlockRenderer block={block} index={0} />)
    const editorHtml = renderToStaticMarkup(
      <BlockRenderer
        block={block}
        index={0}
        options={{
          editSlots: {
            renderCta: ({ value, className }) =>
              value?.label && value.href
                ? <a href={value.href} className={className}>{value.label}</a>
                : <button className={className} type="button">Add CTA</button>,
          },
        }}
      />,
    )

    expect(liveHtml).not.toContain("Add CTA")
    expect(liveHtml).not.toContain('data-siab-analytics-action="true"')
    expect(editorHtml).toContain("Add CTA")
  })

  it("exposes provider visual subfields through editor edit slots without changing live output", () => {
    const editSlots: BlockEditSlots = {
      renderRichText: ({ name, className }) => <span data-edit-slot={name} className={className}>{name}</span>,
      renderText: ({ name }) => <span data-edit-slot={name}>{name}</span>,
      renderImage: ({ name, className, alt }) => <img data-edit-slot={name} className={className} alt={alt ?? ""} />,
    }

    const bentoLive = renderToStaticMarkup(<BlockRenderer block={tailwindPlusMarketingBentoThreeColumnBentoGridDemoSlots} index={0} />)
    const bentoEditor = renderToStaticMarkup(<BlockRenderer block={tailwindPlusMarketingBentoThreeColumnBentoGridDemoSlots} index={0} options={{ editSlots }} />)
    expect(bentoLive).not.toContain("bentoGrid.itemTitle")
    expect(bentoEditor).toContain('data-edit-slot="bentoGrid.itemTitle"')
    expect(bentoEditor).toContain('data-edit-slot="bentoGrid.itemDescription"')
    expect(bentoEditor).toContain('class="contents"')

    const contentEditor = renderToStaticMarkup(<BlockRenderer block={tailwindPlusMarketingContentStickyProductScreenshotDemoSlots} index={0} options={{ editSlots }} />)
    expect(contentEditor).toContain('data-edit-slot="contentSection.featureTitle"')
    expect(contentEditor).toContain('data-edit-slot="contentSection.featureDescription"')

    const newsletterEditor = renderToStaticMarkup(<BlockRenderer block={tailwindPlusMarketingNewsletterSideBySideWithDetailsDemoSlots} index={0} options={{ editSlots }} />)
    expect(newsletterEditor).toContain('data-edit-slot="newsletter.benefitTitle"')
    expect(newsletterEditor).toContain('data-edit-slot="newsletter.benefitDescription"')
    expect(newsletterEditor).toContain('data-edit-slot="newsletter.submitLabel"')

    const heroEditor = renderToStaticMarkup(<BlockRenderer block={tailwindPlusMarketingHeroWithStatsDemoSlots} index={0} options={{ editSlots }} />)
    expect(heroEditor).toContain('data-edit-slot="hero.image"')
    expect(heroEditor).toContain('data-edit-slot="hero.linkLabel"')
    expect(heroEditor).toContain('data-edit-slot="hero.statLabel"')
    expect(heroEditor).toContain('data-edit-slot="hero.statValue"')

    const blogEditor = renderToStaticMarkup(<BlockRenderer block={tailwindPlusMarketingBlogThreeColumnDemoSlots} index={0} options={{ editSlots }} />)
    expect(blogEditor).toContain('data-edit-slot="blogCards.postTitle"')
    expect(blogEditor).toContain('data-edit-slot="blogCards.postDate"')
    expect(blogEditor).toContain('data-edit-slot="blogCards.postAuthor"')
    expect(blogEditor).toContain('data-edit-slot="blogCards.postAuthorRole"')

    const pricingEditor = renderToStaticMarkup(<BlockRenderer block={tailwindPlusMarketingPricingTwoTiersWithEmphasizedRightTierDemoSlots} index={0} options={{ editSlots }} />)
    expect(pricingEditor).toContain('data-edit-slot="pricing.planPrice"')
    expect(pricingEditor).toContain('data-edit-slot="pricing.planPeriod"')
  })

  it("emits provider variant analytics attributes when projected metadata includes them", () => {
    const variant = "tailwindplus.marketing.hero.simple-centered"
    const html = renderToStaticMarkup(
      <BlockRenderer
        block={{
          ...tailwindPlusMarketingHeroSimpleCenteredDemoSlots,
          analytics: {
            sectionId: "top",
            sectionType: "hero",
            sectionPosition: 0,
            sectionAnchor: "top",
            providerVariant: variant,
            blockPresetId: null,
            contentSignature: "abc123",
          },
        }}
        index={0}
      />,
    )

    expect(html).toContain(`data-siab-provider-variant="${variant}"`)
    expect(html).toContain(`data-ph-capture-attribute-provider_variant="${variant}"`)
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
    expect(SITE_SELF_SERVE_SOURCE_BACKED_BLOCK_VARIANTS).toHaveLength(selfServeProviderBlockDefinitions.length)

    for (const variant of SITE_SELF_SERVE_SOURCE_BACKED_BLOCK_VARIANTS) {
      const definition = selfServeProviderBlockDefinitions.find((candidate) =>
        candidate.blockType === variant.slug &&
        candidate.id === variant.providerVariantId &&
        candidate.legacyDesignVariant === variant.legacyDesignVariant
      )
      expect(definition, variant.variantId).toBeTruthy()
      expect(variant.variant, variant.variantId).toBe(definition?.id)
      expect(variant.designVariant, variant.variantId).toBe(definition?.id)
      expect(variant.rendererClassName, variant.variantId).toBe(definition?.rendererClassName)
      expect(definition?.source.sourceAvailability, variant.variantId).toBe("free-public")
      expect(definition?.source.licenseCompatibility, variant.variantId).toBe("compatible")
      expect(definition?.source.approvalStatus, variant.variantId).toBe("approved")
      expect(definition?.source.implementation, variant.variantId).toBe("exact-source")
      expect(definition?.source.visualExactnessStatus, variant.variantId).toBe("reviewed-exact-source")
    }
  })

  it("keeps generic renderer CSS scoped away from provider block roots", () => {
    const rendererCss = readFileSync(fromRepoRoot("packages/site-renderer/src/styles.css"), "utf8")
    const rendererShellCss = readFileSync(fromRepoRoot("apps/renderer/src/styles/site.css"), "utf8")
    const cmsRendererShellCss = readFileSync(fromRepoRoot("apps/cms/src/styles/generated-site-renderer.css"), "utf8")
    const editorAffordanceCss = readFileSync(fromRepoRoot("apps/cms/src/styles/editor-frame-canvas-affordances.css"), "utf8")

    const unsafeSelectors = selectorsFor(rendererCss).filter((selector) =>
      selector.includes(".site-renderer:not([data-tenant-renderer])") &&
      selector.includes(".cms-block") &&
      !selector.includes(":not([data-provider-block])"),
    )

    expect(unsafeSelectors).toEqual([])
    expect(editorAffordanceCss).toContain(".cms-block--hero:not([data-provider-block])")
    expect(editorAffordanceCss).toContain(".cms-block:not([data-provider-block])[data-active=\"true\"]")
    expect(editorAffordanceCss).toContain(".cms-block:not([data-provider-block]):not([data-active=\"true\"])")
    expect(rendererShellCss).toContain('@import "tailwindcss" source(none);')
    expect(rendererShellCss).toContain('@custom-variant dark (&:where([data-rt-mode="dark"], [data-rt-mode="dark"] *));')
    expect(rendererShellCss).toContain('@source "../../../../packages/site-renderer/src";')
    expect(cmsRendererShellCss).toContain('@import "tailwindcss" source(none);')
    expect(cmsRendererShellCss).toContain('@custom-variant dark (&:where([data-rt-mode="dark"], [data-rt-mode="dark"] *));')
    expect(cmsRendererShellCss).toContain('@source "../../../../packages/site-renderer/src";')
  })

  it("maps SiaB theme tokens onto static Tailwind provider accent variables and role bridges", () => {
    const css = themeToCssVars({
      version: 2,
      appearance: { mode: "light" },
      colors: { schemeId: "blue-professional" },
      fonts: { schemeId: "clear-modern" },
      shape: { schemeId: "soft" },
      density: { schemeId: "comfortable" },
    })

    expect(css).toContain("--color-indigo-600:#2563eb")
    expect(css).toContain("--color-indigo-500:#3b82f6")
    expect(css).toContain("--siab-accent-100:#dbeafe")
    expect(css).toContain("--color-tailwindplus-surface:#ffffff")
    expect(css).not.toContain("--color-white:")
    expect(css).toContain("--color-gray-900:#111827")
    expect(css).toContain("--color-gray-500:#6b7280")
    expect(css).toContain(".text-gray-900")
    expect(css).toContain("color:var(--siab-neutral-900,var(--color-ink,#111827))")
    expect(css).toContain(".text-gray-600")
    expect(css).toContain("color:var(--siab-neutral-600,var(--color-ink-muted,#4b5563))")
    expect(css).toContain(".bg-gray-50")
    expect(css).toContain("background-color:var(--color-tailwindplus-card,var(--color-card,var(--color-bg,#ffffff)))")
    expect(css).toContain("--font-sans:Inter Variable")
    expect(css).toContain("--radius-md:0.375rem")
    expect(css).toContain("--radius-3xl:1.5rem")
    expect(css).toContain("--radius-full:9999px")
  })

  it("bridges Tailwind Plus source surface classes without remapping text-white", () => {
    const css = themeToCssVars({
      version: 2,
      appearance: { mode: "dark" },
      colors: { schemeId: "amber-warm" },
      fonts: { schemeId: "clear-modern" },
      shape: { schemeId: "soft" },
      density: { schemeId: "comfortable" },
    })

    expect(css).not.toContain("--color-white:")
    expect(css).not.toContain("--color-white:#fffbeb")
    expect(css).toContain("--color-gray-900:#111827")
    expect(css).toContain(':where([data-provider-block="tailwindplus"].bg-white)')
    expect(css).toContain('background-color:var(--color-tailwindplus-surface,var(--color-bg,#ffffff))')
    expect(css).toContain(':where([data-provider-chrome="tailwindplus"]).bg-gray-50')
    expect(css).toContain('.rt-canvas[data-rt-mode="dark"]{')
    expect(css).toContain("--color-tailwindplus-surface:#030712")
    expect(css).toContain('data-theme-zone="fixed-dark"')
  })
})
