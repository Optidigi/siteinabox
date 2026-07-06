import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import pixelmatch from "pixelmatch"
import { chromium } from "playwright"
import { PNG } from "pngjs"
import * as React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import {
  providerBlockDefinitions,
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
} from "../source-blocks/index.ts"
import { providerChromeDefinitions } from "../source-chrome/index.ts"
import { providerSystemTemplateDefinitions } from "../source-templates/index.ts"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, "../../../..")
const rendererDist = path.join(repoRoot, "apps/renderer/dist/client")
const artifactRoot = path.join(repoRoot, "packages/site-renderer/.visual-parity-artifacts")

const viewports = [
  { name: "desktop", width: 1280, height: 900 },
  { name: "mobile", width: 390, height: 900 },
]

const maxMismatchRatio = 0.01
const pixelmatchThreshold = 0.1

const blockCases = [
  {
    id: "tailwindplus.marketing.hero.simple-centered",
    folder: "source-blocks/tailwindplus/marketing/hero/simple-centered",
    block: tailwindPlusMarketingHeroSimpleCenteredDemoSlots,
  },
  {
    id: "tailwindplus.marketing.hero.with-stats",
    folder: "source-blocks/tailwindplus/marketing/hero/with-stats",
    block: tailwindPlusMarketingHeroWithStatsDemoSlots,
    sourceTransform: (html) => html
      .replace(/\s*<a href="#">Internship program <span aria-hidden="true">&rarr;<\/span><\/a>/, "")
      .replace(/\s*<a href="#">Meet our leadership <span aria-hidden="true">&rarr;<\/span><\/a>/, ""),
  },
  {
    id: "tailwindplus.marketing.feature.with-product-screenshot",
    folder: "source-blocks/tailwindplus/marketing/feature/with-product-screenshot",
    block: tailwindPlusMarketingFeatureWithProductScreenshotDemoSlots,
  },
  {
    id: "tailwindplus.marketing.feature.centered-2x2-grid",
    folder: "source-blocks/tailwindplus/marketing/feature/centered-2x2-grid",
    block: tailwindPlusMarketingFeatureCentered2x2GridDemoSlots,
  },
  {
    id: "tailwindplus.marketing.cta.dark-panel-with-app-screenshot",
    folder: "source-blocks/tailwindplus/marketing/cta/dark-panel-with-app-screenshot",
    block: tailwindPlusMarketingCtaDarkPanelWithAppScreenshotDemoSlots,
  },
  {
    id: "tailwindplus.marketing.content.sticky-product-screenshot",
    folder: "source-blocks/tailwindplus/marketing/content/sticky-product-screenshot",
    block: tailwindPlusMarketingContentStickyProductScreenshotDemoSlots,
    sourceTransform: (html) => html.replace(
      /\s*<p class="mt-8">Et vitae blandit facilisi magna lacus commodo\. Vitae sapien duis odio id et\. Id blandit molestie auctor fermentum dignissim\. Lacus diam tincidunt ac cursus in vel\. Mauris varius vulputate et ultrices hac adipiscing egestas\. Iaculis convallis ac tempor et ut\. Ac lorem vel integer orci\.<\/p>/,
      "",
    ),
  },
  {
    id: "tailwindplus.marketing.contact.centered",
    folder: "source-blocks/tailwindplus/marketing/contact/centered",
    block: tailwindPlusMarketingContactCenteredDemoSlots,
  },
  {
    id: "tailwindplus.marketing.testimonial.simple-centered",
    folder: "source-blocks/tailwindplus/marketing/testimonial/simple-centered",
    block: tailwindPlusMarketingTestimonialSimpleCenteredDemoSlots,
  },
  {
    id: "tailwindplus.marketing.stats.simple",
    folder: "source-blocks/tailwindplus/marketing/stats/simple",
    block: tailwindPlusMarketingStatsSimpleDemoSlots,
  },
  {
    id: "tailwindplus.marketing.logo-cloud.simple-with-heading",
    folder: "source-blocks/tailwindplus/marketing/logo-cloud/simple-with-heading",
    block: tailwindPlusMarketingLogoCloudSimpleWithHeadingDemoSlots,
  },
  {
    id: "tailwindplus.marketing.pricing.two-tiers-with-emphasized-right-tier",
    folder: "source-blocks/tailwindplus/marketing/pricing/two-tiers-with-emphasized-right-tier",
    block: tailwindPlusMarketingPricingTwoTiersWithEmphasizedRightTierDemoSlots,
  },
  {
    id: "tailwindplus.marketing.team.with-small-images",
    folder: "source-blocks/tailwindplus/marketing/team/with-small-images",
    block: tailwindPlusMarketingTeamWithSmallImagesDemoSlots,
  },
  {
    id: "tailwindplus.marketing.newsletter.side-by-side-with-details",
    folder: "source-blocks/tailwindplus/marketing/newsletter/side-by-side-with-details",
    block: tailwindPlusMarketingNewsletterSideBySideWithDetailsDemoSlots,
  },
  {
    id: "tailwindplus.marketing.blog.three-column",
    folder: "source-blocks/tailwindplus/marketing/blog/three-column",
    block: tailwindPlusMarketingBlogThreeColumnDemoSlots,
  },
  {
    id: "tailwindplus.marketing.bento.three-column-bento-grid",
    folder: "source-blocks/tailwindplus/marketing/bento/three-column-bento-grid",
    block: tailwindPlusMarketingBentoThreeColumnBentoGridDemoSlots,
  },
]

const chromeSettings = {
  siteName: "Your Company",
  contactEmail: null,
  navHeader: [
    { label: "Product", href: "#" },
    { label: "Features", href: "#" },
    { label: "Marketplace", href: "#" },
    { label: "Company", href: "#" },
  ],
  navFooter: [],
  branding: {},
  chrome: {
    header: {
      variant: "tailwindplus.marketing.header.with-stacked-flyout-menu",
      logo: {
        url: "https://tailwindcss.com/plus-assets/img/logos/mark.svg?color=indigo&shade=600",
        alt: "",
      },
      cta: { label: "Log in", href: "#" },
    },
    banner: {
      visible: true,
      variant: "tailwindplus.marketing.banner.with-button",
      title: "GeneriCon 2023",
      message: "Join us in Denver from June 7 \u2013 9 to see what\u2019s coming next.",
      link: { label: "Register now", href: "#" },
      dismissible: true,
    },
  },
}

const chromeCases = [
  {
    id: "tailwindplus.marketing.header.with-stacked-flyout-menu",
    folder: "source-chrome/tailwindplus/marketing/header/with-stacked-flyout-menu",
    area: "header",
  },
  {
    id: "tailwindplus.marketing.banner.with-button",
    folder: "source-chrome/tailwindplus/marketing/banner/with-button",
    area: "banner",
  },
]

const systemTemplateCases = [
  {
    id: "tailwindplus.marketing.feedback.404-simple",
    folder: "visual-parity/fixtures/tailwindplus/marketing/feedback/404-simple",
    kind: "notFound",
  },
]

function walkFiles(directory, predicate) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const filePath = path.join(directory, entry.name)
    if (entry.isDirectory()) return walkFiles(filePath, predicate)
    return predicate(filePath) ? [filePath] : []
  })
}

function rendererCss() {
  const cssFiles = walkFiles(rendererDist, (filePath) => filePath.endsWith(".css"))
  if (!cssFiles.length) {
    throw new Error(`No renderer CSS found in ${rendererDist}. Run "pnpm renderer:build" first.`)
  }
  return cssFiles.map((filePath) => readFileSync(filePath, "utf8")).join("\n")
}

async function sourceHtmlFor(folder) {
  const folderPath = path.join(repoRoot, "packages/site-renderer/src", folder)
  const reactFixture = path.join(folderPath, "upstream.react.tsx")
  if (statExists(reactFixture)) {
    const fixture = await import(`${pathToFileURL(reactFixture).href}?visual=${Date.now()}`)
    return renderToStaticMarkup(React.createElement(fixture.default))
  }
  const htmlFixture = path.join(folderPath, "upstream.html")
  if (!statExists(htmlFixture)) {
    throw new Error(`Missing upstream visual fixture for ${folder}`)
  }
  return readFileSync(htmlFixture, "utf8")
}

function statExists(filePath) {
  try {
    statSync(filePath)
    return true
  } catch {
    return false
  }
}

function renderBlock({ id, block }) {
  const definition = providerBlockDefinitions.find((candidate) => candidate.id === id)
  if (!definition?.renderer) throw new Error(`Missing provider block renderer for ${id}`)
  return renderToStaticMarkup(
    React.createElement(definition.renderer, {
      block,
      options: { index: 0 },
    }),
  )
}

function renderChrome({ id, area }) {
  const definition = providerChromeDefinitions.find((candidate) => candidate.id === id && candidate.area === area)
  if (!definition?.renderer) throw new Error(`Missing provider chrome renderer for ${id}`)
  return renderToStaticMarkup(
    React.createElement(React.Fragment, null, definition.renderer({
      settings: chromeSettings,
      currentSlug: "visual-parity",
    })),
  )
}

function renderSystemTemplate({ id, kind }) {
  const definition = providerSystemTemplateDefinitions.find((candidate) => candidate.id === id && candidate.kind === kind)
  if (!definition?.renderer) throw new Error(`Missing provider system template renderer for ${id}`)
  return renderToStaticMarkup(
    React.createElement(React.Fragment, null, definition.renderer({
      settings: { siteName: "this site", contactEmail: null, navHeader: [], navFooter: [], branding: {} },
      theme: null,
      tenantSlug: "visual-parity",
      pathname: "/missing",
    })),
  )
}

function htmlPage(css, bodyHtml) {
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>${css}</style>
    <style>
      html, body { margin: 0; min-height: 100%; background: white; }
      body { font-family: Inter, ui-sans-serif, system-ui, sans-serif; }
      [data-visual-root] { display: flow-root; background: white; }
    </style>
  </head>
  <body>
    <div data-visual-root>${bodyHtml}</div>
  </body>
</html>`
}

async function screenshot(page, css, html, viewport) {
  await page.setViewportSize({ width: viewport.width, height: viewport.height })
  await page.setContent(htmlPage(css, html), { waitUntil: "networkidle" })
  await page.evaluate(async () => {
    await Promise.all(Array.from(document.images).map((image) => {
      if (image.complete) return Promise.resolve()
      return new Promise((resolve) => {
        image.addEventListener("load", resolve, { once: true })
        image.addEventListener("error", resolve, { once: true })
      })
    }))
    if ("fonts" in document) await document.fonts.ready
  })
  return page.locator("[data-visual-root]").screenshot({ animations: "disabled", scale: "css" })
}

function comparePngs(caseId, viewportName, sourceBuffer, renderedBuffer) {
  const source = PNG.sync.read(sourceBuffer)
  const rendered = PNG.sync.read(renderedBuffer)
  const safeId = caseId.replace(/[^a-z0-9.-]/gi, "_")
  const artifactDir = path.join(artifactRoot, safeId, viewportName)

  if (source.width !== rendered.width || source.height !== rendered.height) {
    mkdirSync(artifactDir, { recursive: true })
    writeFileSync(path.join(artifactDir, "source.png"), sourceBuffer)
    writeFileSync(path.join(artifactDir, "rendered.png"), renderedBuffer)
    throw new Error(
      `${caseId} (${viewportName}) screenshot dimensions differ: source ${source.width}x${source.height}, renderer ${rendered.width}x${rendered.height}`,
    )
  }

  const diff = new PNG({ width: source.width, height: source.height })
  const mismatchedPixels = pixelmatch(
    source.data,
    rendered.data,
    diff.data,
    source.width,
    source.height,
    { threshold: pixelmatchThreshold },
  )
  const mismatchRatio = mismatchedPixels / (source.width * source.height)
  if (mismatchRatio > maxMismatchRatio) {
    mkdirSync(artifactDir, { recursive: true })
    writeFileSync(path.join(artifactDir, "source.png"), sourceBuffer)
    writeFileSync(path.join(artifactDir, "rendered.png"), renderedBuffer)
    writeFileSync(path.join(artifactDir, "diff.png"), PNG.sync.write(diff))
    throw new Error(
      `${caseId} (${viewportName}) visual delta ${(mismatchRatio * 100).toFixed(2)}% exceeds ${(maxMismatchRatio * 100).toFixed(2)}%`,
    )
  }
  return mismatchRatio
}

function assertCompleteCoverage() {
  assertSameIds("block", providerBlockDefinitions.map((definition) => definition.id), blockCases.map((testCase) => testCase.id))
  assertSameIds("chrome", providerChromeDefinitions.map((definition) => definition.id), chromeCases.map((testCase) => testCase.id))
  assertSameIds(
    "system template",
    providerSystemTemplateDefinitions.map((definition) => definition.id),
    systemTemplateCases.map((testCase) => testCase.id),
  )
}

function assertSameIds(kind, activeIds, testIds) {
  const missing = activeIds.filter((id) => !testIds.includes(id))
  const stale = testIds.filter((id) => !activeIds.includes(id))
  if (missing.length || stale.length) {
    throw new Error(
      `Incomplete ${kind} visual parity coverage. Missing: ${missing.join(", ") || "none"}. Stale: ${stale.join(", ") || "none"}.`,
    )
  }
}

async function main() {
  assertCompleteCoverage()
  const css = rendererCss()
  const browser = await chromium.launch()
  const page = await browser.newPage({ deviceScaleFactor: 1 })
  const results = []
  const failures = []

  const cases = [
    ...blockCases.map((testCase) => ({
      ...testCase,
      kind: "block",
      renderedHtml: () => renderBlock(testCase),
    })),
    ...chromeCases.map((testCase) => ({
      ...testCase,
      kind: "chrome",
      renderedHtml: () => renderChrome(testCase),
    })),
    ...systemTemplateCases.map((testCase) => ({
      ...testCase,
      kind: "system-template",
      renderedHtml: () => renderSystemTemplate(testCase),
    })),
  ]

  try {
    for (const testCase of cases) {
      const sourceHtml = testCase.sourceTransform
        ? testCase.sourceTransform(await sourceHtmlFor(testCase.folder))
        : await sourceHtmlFor(testCase.folder)
      const renderedHtml = testCase.renderedHtml()
      for (const viewport of viewports) {
        try {
          const sourceBuffer = await screenshot(page, css, sourceHtml, viewport)
          const renderedBuffer = await screenshot(page, css, renderedHtml, viewport)
          const mismatchRatio = comparePngs(testCase.id, viewport.name, sourceBuffer, renderedBuffer)
          results.push({ id: testCase.id, viewport: viewport.name, mismatchRatio })
        } catch (error) {
          failures.push(error instanceof Error ? error.message : String(error))
        }
      }
    }
  } finally {
    await browser.close()
  }

  if (failures.length) {
    console.error("Tailwind Plus visual parity failed:")
    for (const failure of failures) console.error(`- ${failure}`)
    console.error(`Artifacts written under ${artifactRoot}`)
    process.exitCode = 1
    return
  }

  for (const result of results) {
    console.log(`${result.id} ${result.viewport}: ${(result.mismatchRatio * 100).toFixed(3)}% delta`)
  }
  console.log(`Tailwind Plus visual parity passed for ${cases.length} active provider variants across ${viewports.length} viewports.`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
