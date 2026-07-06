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
import { PUBLIC_RENDERER_THEME_SCOPE, themeToCssVars } from "../theme/css-vars.ts"

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

const darkTheme = {
  mode: "dark",
  colors: {
    accent: "#4f46e5",
    onAccent: "#ffffff",
    bg: "#ffffff",
    ink: "#111827",
    muted: "#4b5563",
    card: "#ffffff",
    secondary: "#f3f4f6",
    rule: "rgba(17, 24, 39, 0.12)",
  },
  darkColors: {
    accent: "#818cf8",
    bg: "#09090b",
    ink: "#fafafa",
    muted: "#a1a1aa",
    card: "#18181b",
    secondary: "#27272a",
    rule: "rgba(255, 255, 255, 0.12)",
  },
  fonts: {
    title: "Inter Variable",
    heading: "Inter Variable",
    text: "Inter Variable",
    script: "Inter Variable",
  },
  radius: "0.75rem",
  density: "comfortable",
}

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

function htmlPage(css, bodyHtml, options = {}) {
  const themeCss = options.theme ? themeToCssVars(options.theme, PUBLIC_RENDERER_THEME_SCOPE) : ""
  const visualRoot = options.theme
    ? `<div class="site-renderer" data-siab-site-renderer><div class="rt-canvas" data-rt-mode="${options.theme.mode === "dark" ? "dark" : "light"}" data-visual-root>${bodyHtml}</div></div>`
    : `<div data-visual-root>${bodyHtml}</div>`
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>${css}</style>
    <style>${themeCss}</style>
    <style>
      html, body { margin: 0; min-height: 100%; background: white; }
      body { font-family: Inter, ui-sans-serif, system-ui, sans-serif; }
      [data-visual-root] { display: flow-root; background: white; }
    </style>
  </head>
  <body>
    ${visualRoot}
  </body>
</html>`
}

async function waitForVisualReady(page) {
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
}

async function screenshot(page, css, html, viewport) {
  await page.setViewportSize({ width: viewport.width, height: viewport.height })
  await page.setContent(htmlPage(css, html), { waitUntil: "networkidle" })
  await waitForVisualReady(page)
  return page.locator("[data-visual-root]").screenshot({ animations: "disabled", scale: "css" })
}

async function assertDarkThemeSmoke(page, css, testCase, html, viewport) {
  await page.setViewportSize({ width: viewport.width, height: viewport.height })
  await page.setContent(htmlPage(css, html, { theme: darkTheme }), { waitUntil: "networkidle" })
  await waitForVisualReady(page)
  const issues = await page.evaluate(({ id }) => {
    const providerSelector = "[data-provider-block='tailwindplus'],[data-provider-chrome='tailwindplus'],[data-provider-template='tailwindplus']"
    const providerRoots = Array.from(document.querySelectorAll(providerSelector))
    const failures = []
    if (!providerRoots.length) failures.push(`${id} rendered no Tailwind Plus provider root`)

    function parseRgb(value) {
      const match = value.match(/rgba?\(([^)]+)\)/)
      if (!match) return parseOklch(value)
      const parts = match[1].split(",").map((part) => Number.parseFloat(part.trim()))
      if (parts.length < 3 || parts.some((part) => Number.isNaN(part))) return null
      return { r: parts[0], g: parts[1], b: parts[2], a: parts[3] ?? 1 }
    }
    function parseOklch(value) {
      const match = value.match(/oklch\(([^)]+)\)/)
      if (!match) return null
      const parts = match[1].trim().split(/\s+/)
      if (parts.length < 3) return null
      const l = parts[0].endsWith("%") ? Number.parseFloat(parts[0]) / 100 : Number.parseFloat(parts[0])
      const c = Number.parseFloat(parts[1])
      const h = Number.parseFloat(parts[2]) * Math.PI / 180
      if ([l, c, h].some((part) => Number.isNaN(part))) return null
      const a = c * Math.cos(h)
      const b = c * Math.sin(h)
      const lPrime = l + 0.3963377774 * a + 0.2158037573 * b
      const mPrime = l - 0.1055613458 * a - 0.0638541728 * b
      const sPrime = l - 0.0894841775 * a - 1.2914855480 * b
      const l3 = lPrime ** 3
      const m3 = mPrime ** 3
      const s3 = sPrime ** 3
      const linear = {
        r: 4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3,
        g: -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3,
        b: -0.0041960863 * l3 - 0.7034186147 * m3 + 1.7076147010 * s3,
      }
      const toSrgb = (channelValue) => {
        const value = channelValue <= 0.0031308
          ? 12.92 * channelValue
          : 1.055 * (channelValue ** (1 / 2.4)) - 0.055
        return Math.max(0, Math.min(255, value * 255))
      }
      return { r: toSrgb(linear.r), g: toSrgb(linear.g), b: toSrgb(linear.b), a: 1 }
    }
    function channel(value) {
      const srgb = value / 255
      return srgb <= 0.03928 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4
    }
    function luminance(color) {
      return 0.2126 * channel(color.r) + 0.7152 * channel(color.g) + 0.0722 * channel(color.b)
    }
    function contrast(foreground, background) {
      const lighter = Math.max(luminance(foreground), luminance(background))
      const darker = Math.min(luminance(foreground), luminance(background))
      return (lighter + 0.05) / (darker + 0.05)
    }
    function visible(element) {
      const style = getComputedStyle(element)
      if (style.display === "none" || style.visibility === "hidden" || Number.parseFloat(style.opacity) === 0) return false
      const rect = element.getBoundingClientRect()
      return rect.width > 0 && rect.height > 0
    }
    function backgroundFor(element) {
      let current = element
      while (current) {
        const color = parseRgb(getComputedStyle(current).backgroundColor)
        if (color && color.a > 0.1) return color
        current = current.parentElement
      }
      return { r: 9, g: 9, b: 11, a: 1 }
    }

    const textSelector = "h1,h2,h3,h4,p,a,button,label,input,select,textarea,dt,dd,li,strong,span,time,code,pre"
    for (const root of providerRoots) {
      for (const element of Array.from(root.querySelectorAll(textSelector))) {
        if (!visible(element) || element.closest(".sr-only,[aria-hidden='true']")) continue
        const text = element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement
          ? (element.value || element.placeholder || element.getAttribute("aria-label") || "")
          : (element.textContent || "")
        if (!text.trim()) continue
        const style = getComputedStyle(element)
        const color = parseRgb(style.color)
        if (!color || color.a <= 0.1) continue
        const ratio = contrast(color, backgroundFor(element))
        const fontSize = Number.parseFloat(style.fontSize)
        const fontWeight = Number.parseInt(style.fontWeight, 10)
        const largeText = fontSize >= 24 || (fontSize >= 18.66 && fontWeight >= 600)
        const minimum = largeText ? 3 : 4.5
        if (ratio < minimum) {
          const label = text.trim().replace(/\s+/g, " ").slice(0, 60)
          failures.push(`${id} low dark contrast ${ratio.toFixed(2)} for "${label}"`)
        }
      }
    }

    const grayLogoImages = Array.from(document.querySelectorAll(
      '[data-provider-variant="tailwindplus.marketing.logo-cloud.simple-with-heading"] img[src*="-logo-gray-900.svg"]',
    ))
    for (const image of grayLogoImages) {
      const filter = getComputedStyle(image).filter
      if (!filter || filter === "none") failures.push(`${id} gray logo image has no dark-mode filter`)
    }
    return failures
  }, { id: testCase.id })
  if (issues.length) {
    throw new Error(`${testCase.id} (${viewport.name}) dark-theme smoke failed: ${issues.join("; ")}`)
  }
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
      const sourceHtml = await sourceHtmlFor(testCase.folder)
      const renderedHtml = testCase.renderedHtml()
      for (const viewport of viewports) {
        try {
          const sourceBuffer = await screenshot(page, css, sourceHtml, viewport)
          const renderedBuffer = await screenshot(page, css, renderedHtml, viewport)
          const mismatchRatio = comparePngs(testCase.id, viewport.name, sourceBuffer, renderedBuffer)
          await assertDarkThemeSmoke(page, css, testCase, renderedHtml, viewport)
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
