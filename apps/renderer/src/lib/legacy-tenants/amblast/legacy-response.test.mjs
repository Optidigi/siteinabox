import assert from "node:assert/strict"
import { mkdir, mkdtemp, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"

import {
  createAmblastLegacyNotFoundResponse,
  createAmblastLegacyResponse,
  isAmblastLegacyHost,
  resolveAmblastLegacyFile,
} from "./legacy-response.js"

test("matches only configured Amblast legacy hosts", () => {
  delete process.env.AMBLAST_LEGACY_HOSTS

  assert.equal(isAmblastLegacyHost("amblast.optidigi.nl"), true)
  assert.equal(isAmblastLegacyHost("amblast.nl"), false)
  assert.equal(isAmblastLegacyHost("example.test"), false)
})

test("serves captured live WordPress pages for current Amblast routes", async () => {
  const routes = [
    ["/", "Home - Amblast | Facility Services", 'action="https://amblast.nl/#wpcf7-f1454-p845-o1"'],
    ["/over-ons/", "Over ons - Amblast | Facility Services", 'action="https://amblast.nl/over-ons/#wpcf7-f1454-p880-o1"'],
    ["/diensten", "Diensten - Amblast | Facility Services", 'action="https://amblast.nl/diensten/#wpcf7-f1454-p883-o1"'],
    ["/portfolio-1/", "Portfolio - Amblast | Facility Services", 'action="https://amblast.nl/portfolio-1/#wpcf7-f1454-p886-o1"'],
    ["/contact-pagina", "Contact - Amblast | Facility Services", 'action="https://amblast.nl/contact-pagina/#wpcf7-f7-p901-o1"'],
  ]

  for (const [route, title, expectedAction] of routes) {
    const response = await createAmblastLegacyResponse(route)
    assert.equal(response?.status, 200)
    assert.equal(response?.headers.get("content-type"), "text/html; charset=utf-8")

    const html = await response?.text()
    assert.match(html, new RegExp(`<title>${title}</title>`))
    assert.match(html, /wp-theme-cleanco/)
    assert.match(html, /elementor/)
    assert.match(html, /https:\/\/amblast\.nl\/wp-content\//)
    assert.match(html, /https:\/\/amblast\.nl\/wp-json\//)
    assert.match(html, /data-siab-amblast-fontawesome/)
    assert.match(
      html,
      /\/wp-content\/plugins\/elementor\/assets\/lib\/font-awesome\/webfonts\/fa-regular-400\.woff2/,
    )
    assert.match(html, new RegExp(expectedAction.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))
  }
})

test("keeps legacy aliases served instead of redirecting away", async () => {
  const aliases = [
    ["/portfolio", "Portfolio - Amblast | Facility Services"],
    ["/portfolio-1", "Portfolio - Amblast | Facility Services"],
    ["/contact", "Contact - Amblast | Facility Services"],
    ["/contact-pagina", "Contact - Amblast | Facility Services"],
  ]

  for (const [source, title] of aliases) {
    const response = await createAmblastLegacyResponse(source)
    assert.equal(response?.status, 200)
    assert.equal(response?.headers.get("location"), null)
    assert.match(await response?.text(), new RegExp(`<title>${title}</title>`))
  }
})

test("serves the live Amblast robots response", async () => {
  const response = await createAmblastLegacyResponse("/robots.txt")

  assert.equal(response?.status, 200)
  assert.equal(response?.headers.get("content-type"), "text/plain; charset=utf-8")
  assert.equal(await response?.text(), "User-agent: *\nCrawl-delay: 10\n")
})

test("maps Elementor Font Awesome webfont URLs to bundled local files", async () => {
  const previousDistDir = process.env.AMBLAST_LEGACY_DIST_DIR
  const previousOrigin = process.env.AMBLAST_LEGACY_ORIGIN
  const distDir = await mkdtemp(join(tmpdir(), "amblast-legacy-fonts-"))
  process.env.AMBLAST_LEGACY_DIST_DIR = distDir
  delete process.env.AMBLAST_LEGACY_ORIGIN
  await mkdir(join(distDir, "webfonts"), { recursive: true })
  await writeFile(join(distDir, "webfonts", "fa-regular-400.woff2"), Uint8Array.from([1, 2, 3]))

  const originalFetch = globalThis.fetch
  globalThis.fetch = async () => {
    throw new Error("Font Awesome webfont should be served locally during live cutover")
  }

  try {
    const response = await createAmblastLegacyResponse(
      "/wp-content/plugins/elementor/assets/lib/font-awesome/webfonts/fa-regular-400.woff2",
    )

    assert.equal(response?.status, 200)
    assert.equal(response?.headers.get("content-type"), "font/woff2")
    assert.equal(response?.headers.get("cache-control"), "public, max-age=31536000, immutable")
    assert.deepEqual([...new Uint8Array(await response?.arrayBuffer())], [1, 2, 3])
  } finally {
    globalThis.fetch = originalFetch
    if (previousDistDir == null) delete process.env.AMBLAST_LEGACY_DIST_DIR
    else process.env.AMBLAST_LEGACY_DIST_DIR = previousDistDir
    if (previousOrigin == null) delete process.env.AMBLAST_LEGACY_ORIGIN
    else process.env.AMBLAST_LEGACY_ORIGIN = previousOrigin
  }
})

test("serves legacy static asset files and rejects traversal", async () => {
  const distDir = await mkdtemp(join(tmpdir(), "amblast-legacy-"))
  process.env.AMBLAST_LEGACY_DIST_DIR = distDir

  await mkdir(join(distDir, "_astro"), { recursive: true })
  await writeFile(join(distDir, "_astro/app.js"), "console.log('asset')")

  const file = await resolveAmblastLegacyFile("/_astro/app.js")
  assert.equal(file, join(distDir, "_astro/app.js"))

  const response = await createAmblastLegacyResponse("/_astro/app.js")
  assert.equal(response?.headers.get("content-type"), "text/javascript; charset=utf-8")
  assert.equal(await response?.text(), "console.log('asset')")

  assert.equal(await resolveAmblastLegacyFile("/../package.json"), null)
  assert.equal(await resolveAmblastLegacyFile("/%E0%A4%A"), null)
})

test("preserves remaining legacy WordPress redirects", async () => {
  const redirects = [
    ["/our-team", "/over-ons"],
    ["/our-team/", "/over-ons"],
  ]

  for (const [source, destination] of redirects) {
    const response = await createAmblastLegacyResponse(source)
    assert.equal(response?.status, 301)
    assert.equal(response?.headers.get("location"), destination)
  }
})

test("returns the captured WordPress 404 without falling through to the generic renderer", async () => {
  const response = await createAmblastLegacyNotFoundResponse()
  assert.equal(response.status, 404)
  assert.equal(response.headers.get("content-type"), "text/html; charset=utf-8")

  const html = await response.text()
  assert.match(html, /<title>Pagina niet gevonden - Amblast \| Facility Services<\/title>/)
  assert.match(html, /error404/)
  assert.match(html, /https:\/\/amblast\.nl\/wp-content\//)
})
