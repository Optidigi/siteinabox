#!/usr/bin/env node
/**
 * Visual parity audit for the Amicare CMS canvas.
 *
 * Prerequisites:
 * - CMS dev server, configurable with CMS_BASE (default http://localhost:3000)
 * - Generic renderer dev server, configurable with RENDERER_BASE (default http://localhost:4321)
 * - Renderer host resolution through RENDERER_HOST (default ami-care.nl)
 * - local seed account from scripts/seed-super-admin.ts
 *
 * The audit screenshots the CMS tenant frame in sidebar/read-only mode and the
 * generic renderer runtime at the same effective frame width. It writes pairs,
 * montages, and ImageMagick diffs to tmp/canvas-parity/.
 */

import fs from "node:fs"
import path from "node:path"
import { execFileSync } from "node:child_process"
import { fileURLToPath } from "node:url"
import { chromium } from "@playwright/test"

const env = process.env

const CMS_BASE = cleanBaseUrl(env.CMS_BASE ?? "http://localhost:3000", "CMS_BASE")
const RENDERER_BASE = cleanBaseUrl(env.RENDERER_BASE ?? "http://localhost:4321", "RENDERER_BASE")
const RENDERER_HOST = cleanHost(env.RENDERER_HOST ?? "ami-care.nl", "RENDERER_HOST")
const CMS_SITE_SLUG = (env.CMS_SITE_SLUG ?? "ami-care").trim()
const CMS_SITE_SLUG_FALLBACKS = (env.CMS_SITE_SLUG_FALLBACKS ?? "amicare-zorg")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean)
const LOCAL_EMAIL = env.LOCAL_EMAIL ?? env.CMS_EMAIL ?? "admin@local.test"
const LOCAL_PASSWORD = env.LOCAL_PASSWORD ?? env.CMS_PASSWORD ?? "LocalTest!1234"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUT_DIR = path.resolve(__dirname, "..", "tmp", "canvas-parity")
fs.rmSync(OUT_DIR, { recursive: true, force: true })
fs.mkdirSync(OUT_DIR, { recursive: true })

const widths = [
  { name: "desktop", width: 1440, height: 1400 },
  { name: "compact-desktop", width: 1320, height: 1400 },
  { name: "minimum-desktop", width: 1280, height: 1400 },
]

const targets = [
  { name: "frame", canvas: ".rt-canvas .site-frame-root", site: ".site-frame-root" },
  { name: "header", canvas: ".rt-canvas nav[aria-label='Hoofdnavigatie']", site: "nav[aria-label='Hoofdnavigatie']" },
  { name: "hero", canvas: ".rt-canvas .cms-block--hero", site: ".cms-block--hero" },
  { name: "feature-list", canvas: ".rt-canvas .cms-block--featurelist", site: ".cms-block--featurelist" },
  { name: "testimonials", canvas: ".rt-canvas .cms-block--testimonials", site: ".cms-block--testimonials" },
  { name: "faq", canvas: ".rt-canvas .cms-block--faq", site: ".cms-block--faq" },
  { name: "cta", canvas: ".rt-canvas .cms-block--cta", site: ".cms-block--cta" },
  { name: "contact", canvas: ".rt-canvas .cms-block--contact", site: ".cms-block--contact" },
  { name: "footer", canvas: ".rt-canvas footer", site: "footer" },
]

const RMSE_NORMALIZED_TOLERANCE = Number(env.RMSE_NORMALIZED_TOLERANCE ?? "0.07")
const FRAME_DIMENSION_TOLERANCE_PX = Number(env.FRAME_DIMENSION_TOLERANCE_PX ?? "96")

const logLines = []

function cleanBaseUrl(value, name) {
  let parsed
  try {
    parsed = new URL(value)
  } catch {
    throw new Error(`${name} must be an absolute URL, received "${value}"`)
  }
  parsed.pathname = parsed.pathname.replace(/\/+$/, "")
  parsed.search = ""
  parsed.hash = ""
  return parsed.toString().replace(/\/$/, "")
}

function cleanHost(value, name) {
  const host = value.trim().toLowerCase().replace(/\/+$/, "")
  if (!host) throw new Error(`${name} must not be empty`)
  if (/^https?:\/\//.test(host)) return new URL(host).host.toLowerCase()
  if (host.includes("/")) throw new Error(`${name} must be a host, not a URL/path`)
  return host
}

function log(line) {
  console.log(line)
  logLines.push(line)
}

function writeLog() {
  fs.writeFileSync(path.join(OUT_DIR, "report.txt"), logLines.join("\n") + "\n", "utf8")
}

async function probe(url, headers = {}) {
  const response = await fetch(url, { headers, signal: AbortSignal.timeout(20_000) })
  if (!response.ok) throw new Error(`${url} returned HTTP ${response.status}`)
}

async function loginLocal(page) {
  const response = await page.request.post(`${CMS_BASE}/api/users/login`, {
    data: { email: LOCAL_EMAIL, password: LOCAL_PASSWORD },
    headers: { "content-type": "application/json" },
    timeout: 45_000,
  })
  if (!response.ok()) throw new Error(`CMS login failed with HTTP ${response.status()}`)
  await page.goto(`${CMS_BASE}/sites`, { timeout: 30_000, waitUntil: "networkidle" })
}

async function openAmicareEditor(page) {
  const tenantsResponse = await page.request.get(`${CMS_BASE}/api/tenants?limit=100&depth=0`, {
    timeout: 30_000,
  })
  if (!tenantsResponse.ok()) throw new Error(`Tenant lookup failed with HTTP ${tenantsResponse.status()}`)
  const tenants = await tenantsResponse.json()
  const acceptedSlugs = new Set([CMS_SITE_SLUG, ...CMS_SITE_SLUG_FALLBACKS])
  const tenant =
    tenants.docs?.find((doc) => doc.slug === CMS_SITE_SLUG || doc.domain === RENDERER_HOST) ??
    tenants.docs?.find((doc) => acceptedSlugs.has(doc.slug))
  if (!tenant?.id || !tenant.slug) throw new Error(`No CMS tenant found for ${CMS_SITE_SLUG}/${RENDERER_HOST}`)

  const pagesResponse = await page.request.get(`${CMS_BASE}/api/pages?limit=100&depth=0`, {
    timeout: 30_000,
  })
  if (!pagesResponse.ok()) throw new Error(`Page lookup failed with HTTP ${pagesResponse.status()}`)
  const pages = await pagesResponse.json()
  const pageDoc = pages.docs?.find((doc) => {
    const tenantId = typeof doc.tenant === "object" && doc.tenant ? doc.tenant.id : doc.tenant
    return String(tenantId) === String(tenant.id) && (doc.slug === "index" || doc.slug === "home")
  }) ?? pages.docs?.find((doc) => {
    const tenantId = typeof doc.tenant === "object" && doc.tenant ? doc.tenant.id : doc.tenant
    return String(tenantId) === String(tenant.id)
  })
  if (!pageDoc?.id) throw new Error(`No CMS page found for tenant ${tenant.slug}`)

  await page.goto(`${CMS_BASE}/sites/${tenant.slug}/pages/${pageDoc.id}`, { timeout: 45_000, waitUntil: "networkidle" })
}

async function ensureEditorMode(page, mode) {
  await page.locator(".rt-canvas").first().waitFor({ timeout: 30_000 })
  const current = await page.locator(".rt-canvas").first().getAttribute("data-rt-view")
  if (current === mode) return

  const group = page.getByRole("group", { name: /editor view|editor mode/i })
  await group.waitFor({ timeout: 15_000 })
  await group.getByRole("button", { name: new RegExp(`${mode} view|^${mode}$`, "i") }).click({ force: true })
  await page.waitForFunction(
    (expectedMode) => document.querySelector(".rt-canvas")?.getAttribute("data-rt-view") === expectedMode,
    mode,
    { timeout: 20_000 },
  )
}

async function quietCanvasAffordances(page) {
  await page.addStyleTag({
    content: `
      .rt-canvas *,
      .rt-canvas *::before,
      .rt-canvas *::after {
        animation: none !important;
        transition: none !important;
      }
      .rt-canvas [data-rt-selected],
      .rt-canvas .rt-slot,
      .rt-canvas .rt-click-edit,
      .rt-canvas [data-inline-editable],
      .rt-canvas [data-active] {
        outline: 0 !important;
        box-shadow: none !important;
      }
      .rt-canvas .group\\/gap {
        display: none !important;
      }
      [data-siab-canvas-chrome],
      [data-site-chrome],
      [data-site-chrome-wrapper],
      [data-site-chrome-menu-trigger],
      [class*="mode-bar-position"],
      body > header,
      [class*="sticky top-12"],
      nextjs-portal,
      [data-nextjs-toast],
      [data-nextjs-dialog-overlay],
      [data-nextjs-dev-overlay],
      .__next-dev-overlay,
      #cookie-consent-banner,
      #cookie-consent-preferences,
      #renderer-cookie-consent-banner,
      #renderer-cookie-consent-preferences,
      [data-cookie-consent-accept],
      [data-cookie-consent-decline] {
        display: none !important;
        visibility: hidden !important;
      }
    `,
  })
}

async function quietSiteMotion(page) {
  await page.addStyleTag({
    content: `
      *,
      *::before,
      *::after {
        animation: none !important;
        transition: none !important;
      }
      #cookie-consent-banner,
      #cookie-consent-preferences,
      #renderer-cookie-consent-banner,
      #renderer-cookie-consent-preferences,
      [data-cookie-consent-accept],
      [data-cookie-consent-decline] {
        display: none !important;
        visibility: hidden !important;
      }
    `,
  })
}

async function waitForRenderSurface(page, rootSelector) {
  await page.waitForFunction(
    async (selector) => {
      const root = document.querySelector(selector)
      if (!root) return false
      if ("fonts" in document) await document.fonts.ready

      const heroHeading = root.querySelector(".cms-block--hero h1")
      const heroImage = root.querySelector(".cms-block--hero img")
      const headingFont = heroHeading ? getComputedStyle(heroHeading).fontFamily : ""
      const headingReady = !heroHeading || /Fraunces|Georgia|serif/i.test(headingFont)
      const imageReady = !heroImage || (heroImage.complete && heroImage.naturalWidth > 0)

      return headingReady && imageReady
    },
    rootSelector,
    { timeout: 30_000 },
  )
}

async function screenshotIfPresent(page, selector, filePath) {
  const locator = page.locator(selector).first()
  const count = await locator.count()
  if (!count) return { status: "missing" }
  if (selector.includes("nav[aria-label")) await page.evaluate(() => window.scrollTo(0, 0))
  await locator.scrollIntoViewIfNeeded({ timeout: 10_000 })
  await page.waitForTimeout(250)
  await locator.screenshot({ path: filePath, animations: "disabled", timeout: 20_000 })
  const box = await locator.boundingBox()
  return { status: "ok", box }
}

function imageSize(filePath) {
  const output = execFileSync("magick", ["identify", "-format", "%w %h", filePath], { encoding: "utf8" }).trim()
  const [width, height] = output.split(/\s+/).map(Number)
  return { width, height }
}

function comparePair(canvasPath, sitePath, diffPath, montagePath, options = {}) {
  const canvasSize = imageSize(canvasPath)
  const siteSize = imageSize(sitePath)

  execFileSync("magick", [
    canvasPath,
    sitePath,
    "+append",
    montagePath,
  ])

  const widthDelta = Math.abs(canvasSize.width - siteSize.width)
  const heightDelta = Math.abs(canvasSize.height - siteSize.height)
  const dimensionTolerance = options.dimensionTolerance ?? 0
  if (widthDelta > dimensionTolerance || heightDelta > dimensionTolerance) {
    return { compared: false, canvasSize, siteSize, reason: "dimension mismatch" }
  }

  let metric = "0"
  try {
    execFileSync("magick", [
      "compare",
      "-metric",
      "RMSE",
      canvasPath,
      sitePath,
      diffPath,
    ], { encoding: "utf8", stdio: ["ignore", "ignore", "pipe"] })
  } catch (err) {
    metric = String(err.stderr || "").trim()
  }
  return { compared: true, canvasSize, siteSize, metric }
}

function normalizedRmse(metric) {
  const normalized = /\(([^)]+)\)/.exec(metric)?.[1]
  const value = Number(normalized ?? metric)
  return Number.isFinite(value) ? value : Number.POSITIVE_INFINITY
}

async function main() {
  log(`[info] visual-canvas-parity starting - ${new Date().toISOString()}`)
  log(`[info] output: ${OUT_DIR}`)
  log(`[info] CMS_BASE=${CMS_BASE}`)
  log(`[info] RENDERER_BASE=${RENDERER_BASE}`)
  log(`[info] RENDERER_HOST=${RENDERER_HOST}`)
  log(`[info] CMS_SITE_SLUG=${CMS_SITE_SLUG}`)
  log(`[info] RMSE normalized tolerance=${RMSE_NORMALIZED_TOLERANCE}`)
  log(`[info] frame dimension tolerance=${FRAME_DIMENSION_TOLERANCE_PX}px`)

  await probe(`${CMS_BASE}/login`)
  await probe(RENDERER_BASE, { "x-forwarded-host": RENDERER_HOST })

  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({ viewport: widths[0] })
  const cms = await context.newPage()
  const site = await context.newPage()

  cms.on("pageerror", (err) => log(`[cms pageerror] ${err.message}`))
  site.on("pageerror", (err) => log(`[site pageerror] ${err.message}`))

  const mismatches = []

  try {
    await loginLocal(cms)

    for (const size of widths) {
      log(`\n[case] ${size.name} admin viewport ${size.width}x${size.height}`)
      await cms.setViewportSize({ width: size.width, height: size.height })
      await openAmicareEditor(cms)
      await ensureEditorMode(cms, "canvas")
      await quietCanvasAffordances(cms)
      await cms.locator(".rt-canvas .site-frame-root").first().waitFor({ timeout: 30_000 })
      await waitForRenderSurface(cms, ".rt-canvas")

      const frameBox = await cms.locator(".rt-canvas").first().boundingBox()
      const frameWidth = Math.max(320, Math.round(frameBox?.width ?? size.width))
      log(`[info] effective canvas width: ${frameWidth}px`)

      await site.setViewportSize({ width: frameWidth, height: size.height })
      await site.setExtraHTTPHeaders({ "x-forwarded-host": RENDERER_HOST })
      await site.goto(RENDERER_BASE, { timeout: 45_000, waitUntil: "networkidle" })
      await quietSiteMotion(site)
      await site.locator(".site-frame-root").first().waitFor({ timeout: 30_000 })
      await waitForRenderSurface(site, ".site-frame-root")

      for (const target of targets) {
        const prefix = `${size.name}-${target.name}`
        const canvasPath = path.join(OUT_DIR, `${prefix}-canvas.png`)
        const sitePath = path.join(OUT_DIR, `${prefix}-site.png`)
        const diffPath = path.join(OUT_DIR, `${prefix}-diff.png`)
        const montagePath = path.join(OUT_DIR, `${prefix}-montage.png`)

        const canvasShot = await screenshotIfPresent(cms, target.canvas, canvasPath)
        const siteShot = await screenshotIfPresent(site, target.site, sitePath)
        if (canvasShot.status === "missing" && siteShot.status === "missing") {
          log(`[${prefix}] both targets missing`)
          continue
        }
        if (canvasShot.status !== "ok" || siteShot.status !== "ok") {
          const line = `[${prefix}] missing canvas=${canvasShot.status} site=${siteShot.status}`
          log(line)
          mismatches.push(line)
          continue
        }

        const result = comparePair(canvasPath, sitePath, diffPath, montagePath, {
          dimensionTolerance: target.name === "frame" ? FRAME_DIMENSION_TOLERANCE_PX : 0,
        })
        if (!result.compared) {
          const line = `[${prefix}] ${result.reason}: canvas ${result.canvasSize.width}x${result.canvasSize.height}, site ${result.siteSize.width}x${result.siteSize.height}`
          log(line)
          mismatches.push(line)
        } else {
          const value = normalizedRmse(result.metric)
          const line = `[${prefix}] RMSE ${result.metric}`
          log(line)
          if (target.name !== "frame" && value > RMSE_NORMALIZED_TOLERANCE) {
            mismatches.push(`${line} > normalized tolerance ${RMSE_NORMALIZED_TOLERANCE}`)
          }
        }
      }
    }

    if (mismatches.length > 0) {
      log(`\n[fail] ${mismatches.length} visual parity mismatch(es) above tolerance:`)
      for (const mismatch of mismatches) log(`[fail] ${mismatch}`)
      process.exitCode = 1
    } else {
      log("\n[pass] visual parity audit matched within tolerance")
    }
  } finally {
    await browser.close()
    writeLog()
  }
}

main().catch((err) => {
  log(`[error] ${err.stack || err.message}`)
  writeLog()
  process.exit(1)
})
