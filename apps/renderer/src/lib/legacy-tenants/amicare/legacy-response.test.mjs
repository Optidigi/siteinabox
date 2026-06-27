import assert from "node:assert/strict"
import { mkdir, mkdtemp, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"

import {
  createAmicareLegacyNotFoundResponse,
  createAmicareLegacyResponse,
  isAmicareLegacyHost,
} from "./legacy-response.ts"

test("matches only configured Amicare legacy hosts", () => {
  delete process.env.AMICARE_LEGACY_HOSTS

  assert.equal(isAmicareLegacyHost("amicare.optidigi.nl"), true)
  assert.equal(isAmicareLegacyHost("ami-care.nl"), false)
  assert.equal(isAmicareLegacyHost("example.test"), false)
})

test("serves the captured legacy homepage document", async () => {
  const response = await createAmicareLegacyResponse("/")

  assert.equal(response?.status, 200)
  assert.equal(response?.headers.get("content-type"), "text/html; charset=utf-8")
  const html = await response.text()
  assert.match(html, /<title>Ami Care \| Amicare-Zorg<\/title>/)
  assert.match(html, /Voor jongeren en gezinnen/)
  assert.match(html, /href="mailto:info@ami-care\.nl"/)
  assert.match(html, /<style data-tenant-theme>/)
  assert.doesNotMatch(html, /Ervaringen/)
  assert.doesNotMatch(html, /Veelgestelde vragen/)
  assert.doesNotMatch(html, /<form/)
})

test("serves the legacy robots response", async () => {
  const response = await createAmicareLegacyResponse("/robots.txt")

  assert.equal(response?.status, 200)
  assert.equal(response?.headers.get("content-type"), "text/plain; charset=utf-8")
  assert.equal(await response?.text(), "User-agent: *\nAllow: /\n\nSitemap: https://ami-care.nl/sitemap-index.xml\n")
})

test("serves legacy client and media assets and rejects traversal", async () => {
  const clientDir = await mkdtemp(join(tmpdir(), "amicare-client-"))
  const mediaDir = await mkdtemp(join(tmpdir(), "amicare-media-"))
  process.env.AMICARE_LEGACY_CLIENT_DIR = clientDir
  process.env.AMICARE_LEGACY_MEDIA_DIR = mediaDir

  await mkdir(join(clientDir, "_astro"), { recursive: true })
  await writeFile(join(clientDir, "_astro/global.css"), "body{color:red}")
  await writeFile(join(mediaDir, "bedroom.jpg"), "jpg")

  const cssResponse = await createAmicareLegacyResponse("/_astro/global.css")
  assert.equal(cssResponse?.headers.get("content-type"), "text/css; charset=utf-8")
  assert.equal(await cssResponse?.text(), "body{color:red}")

  const mediaResponse = await createAmicareLegacyResponse("/media/bedroom.jpg")
  assert.equal(mediaResponse?.headers.get("content-type"), "image/jpeg")
  assert.equal(await mediaResponse?.text(), "jpg")

  const tenantMediaResponse = await createAmicareLegacyResponse("/api/tenant-media/7/bedroom.jpg")
  assert.equal(tenantMediaResponse?.headers.get("content-type"), "image/jpeg")
  assert.equal(await tenantMediaResponse?.text(), "jpg")

  assert.equal(await createAmicareLegacyResponse("/../package.json"), null)
  assert.equal(await createAmicareLegacyResponse("/%E0%A4%A"), null)
})

test("returns the captured Amicare 404 document", async () => {
  const response = createAmicareLegacyNotFoundResponse()

  assert.equal(response.status, 404)
  assert.equal(response.headers.get("content-type"), "text/html; charset=utf-8")
  const html = await response.text()
  assert.match(html, /Pagina niet gevonden/)
  assert.match(html, /<style data-tenant-theme>/)
  assert.doesNotMatch(html, /Ervaringen/)
  assert.doesNotMatch(html, /Veelgestelde vragen/)
  assert.doesNotMatch(html, /<form/)
})
