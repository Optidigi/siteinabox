import assert from "node:assert/strict"
import { once } from "node:events"
import { request as createHttpRequest, createServer as createHttpServer } from "node:http"
import { createServer as createNetServer } from "node:net"

import {
  amicarePublishedSiteSnapshot,
} from "@siteinabox/contracts/fixtures/tenants"

export const TEST_RENDERER_ORIGIN_SECRET = "renderer-origin-smoke-secret-00000001"

export async function getOpenPort() {
  const server = createNetServer()
  server.listen(0, "127.0.0.1")
  await once(server, "listening")
  const address = server.address()
  server.close()
  await once(server, "close")
  assert.equal(typeof address, "object")
  return address.port
}

export async function closeServer(server) {
  if (!server.listening) return
  server.close()
  await once(server, "close")
}

export async function startStubCms({ listenHost = "127.0.0.1", publicHost = listenHost } = {}) {
  const port = await getOpenPort()
  const amicareSnapshot = publishedSnapshotForHost("ami-care.nl", {
    tenantId: "tenant-ami-care",
    tenantSlug: "ami-care",
    siteName: "Amicare-Zorg",
  })
  const studioSnapshot = publishedSnapshotForHost("studio-example.be", {
    tenantId: "tenant-studio-example",
    tenantSlug: "studio-example",
    siteName: "Studio Example",
  })
  const snapshotsByHost = new Map([
    ["ami-care.nl", snapshotEnvelope("ami-care.nl", amicareSnapshot, ["ami-care.nl", "www.ami-care.nl"])],
    ["www.ami-care.nl", snapshotEnvelope("www.ami-care.nl", amicareSnapshot, ["ami-care.nl", "www.ami-care.nl"])],
    ["studio-example.be", snapshotEnvelope("studio-example.be", studioSnapshot, ["studio-example.be", "www.studio-example.be"])],
    ["www.studio-example.be", snapshotEnvelope("www.studio-example.be", studioSnapshot, ["studio-example.be", "www.studio-example.be"])],
  ])
  const server = createHttpServer((request, response) => {
    const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "127.0.0.1"}`)
    if (url.pathname !== "/api/renderer/snapshot") {
      response.writeHead(404, { "content-type": "application/json; charset=utf-8" })
      response.end(JSON.stringify({ error: "not_found" }))
      return
    }

    const host = url.searchParams.get("host") ?? ""
    const envelope = snapshotsByHost.get(host)
    if (!envelope) {
      response.writeHead(404, { "content-type": "application/json; charset=utf-8" })
      response.end(JSON.stringify({ error: "unknown_host" }))
      return
    }

    response.writeHead(200, { "content-type": "application/json; charset=utf-8" })
    response.end(JSON.stringify(envelope))
  })
  server.listen(port, listenHost)
  await once(server, "listening")
  return { server, snapshotsByHost, url: `http://${publicHost}:${port}`, localUrl: `http://127.0.0.1:${port}` }
}

function publishedSnapshotForHost(host, { tenantId, tenantSlug, siteName }) {
  const productionOrigin = `https://${host}`
  const source = amicarePublishedSiteSnapshot
  const snapshot = structuredClone(source)
  const retargeted = rewriteSnapshotStrings(snapshot, [
    [source.siteUrl, productionOrigin],
    [source.settings?.siteUrl, productionOrigin],
    [source.domain, host],
  ])

  return {
    ...retargeted,
    tenantId,
    tenantSlug,
    domain: host,
    siteUrl: productionOrigin,
    manifest: {
      ...retargeted.manifest,
      tenantId,
    },
    settings: {
      ...retargeted.settings,
      siteUrl: productionOrigin,
      siteName,
      chrome: {
        ...retargeted.settings.chrome,
        footer: {
          ...retargeted.settings.chrome?.footer,
          legalLinks: [{ label: "Privacy en cookies", href: "/privacy-en-cookieverklaring" }],
        },
      },
      analytics: {
        ...retargeted.settings.analytics,
        provider: "posthog",
        token: `phc_${tenantSlug.replaceAll("-", "_")}_smoke`,
        posthogHost: "https://eu.posthog.com",
      },
    },
    pages: [
      ...retargeted.pages,
      {
        id: "amicare-privacy",
        slug: "privacy-en-cookieverklaring",
        title: "Privacy- en cookieverklaring",
        status: "published",
        updatedAt: "2026-07-10T00:00:00.000Z",
        blocks: [{
          blockType: "contentSection",
          designVariant: "shadcnui-blocks.legal-content-01",
          body: {
            t: "root",
            variant: "block",
            children: [
              { t: "heading", level: 2, children: [{ t: "text", v: "Privacy- en cookieverklaring" }] },
              { t: "paragraph", children: [{ t: "text", v: "AMICARE ZORG is verantwoordelijk voor deze website." }] },
              { t: "paragraph", children: [{ t: "text", v: "Optidigi, handelend onder de naam Site in a Box, levert de technische omgeving." }] },
            ],
          },
        }],
      },
    ],
  }
}

function snapshotEnvelope(requestedHost, snapshot, activeHosts) {
  return {
    routing: {
      version: 1,
      requestedHost,
      canonicalHost: snapshot.domain,
      activeHosts,
    },
    tenant: {
      id: snapshot.tenantId,
      slug: snapshot.tenantSlug,
      domain: snapshot.domain,
      status: "active",
    },
    snapshotId: `snapshot-${snapshot.tenantId}`,
    snapshot,
  }
}

function rewriteSnapshotStrings(value, replacements) {
  if (typeof value === "string") {
    return replacements.reduce((next, [from, to]) => (from && from !== to ? next.split(from).join(to) : next), value)
  }
  if (Array.isArray(value)) return value.map((item) => rewriteSnapshotStrings(item, replacements))
  if (!value || typeof value !== "object") return value

  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [key, rewriteSnapshotStrings(entry, replacements)]),
  )
}

export async function waitForRenderer(baseUrl, getFailureContext = () => "") {
  let lastError
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/healthz`)
      if (response.ok) return
    } catch (error) {
      lastError = error
    }
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  const failureContext = await Promise.resolve(getFailureContext())
  throw new Error(`Renderer did not become healthy: ${lastError?.message ?? "timeout"}\n${failureContext}`)
}

export async function fetchWithHost(baseUrl, host, pathname, {
  forwardedHost = host,
  forwardedProto = "https",
  includeOriginSecret = true,
  originSecret = TEST_RENDERER_ORIGIN_SECRET,
} = {}) {
  const url = new URL(pathname, baseUrl)
  const headers = {
    host,
    "x-forwarded-host": forwardedHost,
    "x-forwarded-proto": forwardedProto,
    ...(includeOriginSecret ? { "x-siab-origin-verify": originSecret } : {}),
  }
  return new Promise((resolve, reject) => {
    const request = createHttpRequest(url, { headers }, (response) => {
      const chunks = []
      response.on("data", (chunk) => chunks.push(chunk))
      response.on("end", () => {
        resolve(new Response(Buffer.concat(chunks), {
          status: response.statusCode ?? 500,
          headers: response.headers,
        }))
      })
    })
    request.on("error", reject)
    request.end()
  })
}

export async function assertStubCmsSnapshots(cms) {
  const expected = [
    ["ami-care.nl", "ami-care.nl", "ami-care", "terracotta-warm"],
    ["www.ami-care.nl", "ami-care.nl", "ami-care", "terracotta-warm"],
    ["studio-example.be", "studio-example.be", "studio-example", "terracotta-warm"],
    ["www.studio-example.be", "studio-example.be", "studio-example", "terracotta-warm"],
  ]

  for (const [host, canonicalHost, tenantSlug, colorSchemeId] of expected) {
    const response = await fetch(`${cms.url}/api/renderer/snapshot?host=${encodeURIComponent(host)}`)
    const body = await response.text()
    assert.equal(response.status, 200, `${host} snapshot route status\n${body}`)
    const { routing, snapshot } = JSON.parse(body)
    assert.equal(snapshot.tenantSlug, tenantSlug, `${host} snapshot tenant slug`)
    assert.equal(snapshot.domain, canonicalHost, `${host} snapshot domain`)
    assert.equal(snapshot.siteUrl, `https://${canonicalHost}`, `${host} snapshot site URL`)
    assert.equal(snapshot.settings.siteUrl, `https://${canonicalHost}`, `${host} snapshot settings site URL`)
    assert.equal(snapshot.theme?.version, 3, `${host} snapshot theme version`)
    assert.equal(snapshot.theme?.colors?.schemeId, colorSchemeId, `${host} snapshot theme color scheme`)
    assert.equal(snapshot.manifest?.tenantId, snapshot.tenantId, `${host} snapshot manifest tenant id`)
    assert.equal(routing.requestedHost, host, `${host} requested routing host`)
    assert.equal(routing.canonicalHost, canonicalHost, `${host} canonical routing host`)
    assert.ok(routing.activeHosts.includes(host), `${host} explicit active host`)
    assert.equal(cms.snapshotsByHost.get(host)?.snapshot.tenantSlug, tenantSlug, `${host} active stub snapshot map`)
  }
}

async function failureContextText(failureContext) {
  await new Promise((resolve) => setTimeout(resolve, 250))
  return typeof failureContext === "function" ? await failureContext() : failureContext
}

async function assertStatus(response, expectedStatus, label, body, failureContext) {
  if (response.status === expectedStatus) return
  assert.equal(response.status, expectedStatus, `${label}\n${body}\n${await failureContextText(failureContext)}`)
}

async function assertStatusIn(response, expectedStatuses, label, body, failureContext) {
  if (expectedStatuses.includes(response.status)) return
  assert.fail(
    `${label}: expected one of ${expectedStatuses.join(", ")}, got ${response.status}\n${body}\n${await failureContextText(
      failureContext,
    )}`,
  )
}

function assertNoAnalyticsLeakage(html) {
  assert.doesNotMatch(html, /id="siab-analytics-config"/)
}

export async function assertHostRouting(baseUrl, failureContext = "", { includeMalformedEncodedPath = true } = {}) {
  const amicareHome = await fetchWithHost(baseUrl, "ami-care.nl", "/")
  const amicareHtml = await amicareHome.text()
  await assertStatus(amicareHome, 200, "ami-care.nl homepage status", amicareHtml, failureContext)
  assert.doesNotMatch(amicareHtml, /data-tenant-renderer=/)
  assert.match(amicareHtml, /data-provider-variant="shadcnui-blocks\.hero-02"/)
  assert.match(amicareHtml, /data-provider-variant="shadcnui-blocks\.features-01"/)
  assert.match(amicareHtml, /data-provider-variant="shadcnui-blocks\.contact-01"/)
  assert.match(amicareHtml, /data-siab-theme-mode="light"/)
  assert.match(amicareHtml, /data-siab-color-mode="light"/)
  assert.match(amicareHtml, /localStorage\.getItem\("siab-color-mode"\)/)
  assert.match(amicareHtml, /name="color-scheme" content="light dark"/)
  assert.doesNotMatch(amicareHtml, /data-siab-theme-overrides/)
  assert.match(amicareHtml, /data-theme-color="terracotta-warm"/)
  assert.match(amicareHtml, /data-theme-font="classic-editorial"/)
  assert.match(amicareHtml, /data-theme-shape="soft"/)
  assert.doesNotMatch(amicareHtml, /--site-style-preset:/)
  assert.match(amicareHtml, /id="siab-analytics-config"/)
  assert.match(amicareHtml, /data-siab-cookie-consent="true"/)
  assert.match(amicareHtml, /"consentVersion":"2026-07-07\.1"/)
  assert.match(amicareHtml, /<link rel="icon" href="\/siab-media\/tenant-ami-care\/favicon\.svg"\/?>/)
  assert.match(amicareHtml, /\/siab-media\/tenant-ami-care\/bedroom\.jpg/)
  assert.match(amicareHtml, /Jeugdzorg/)
  assert.match(amicareHtml, /Aandacht/)
  assert.match(amicareHtml, /Vertrouwen/)
  assert.match(amicareHtml, /href="\/privacy-en-cookieverklaring"/)

  const amicareWww = await fetchWithHost(baseUrl, "www.ami-care.nl", "/")
  const amicareWwwHtml = await amicareWww.text()
  await assertStatus(amicareWww, 200, "www.ami-care.nl homepage status", amicareWwwHtml, failureContext)
  assert.match(amicareWwwHtml, /data-tenant-slug="ami-care"/)

  const studioHome = await fetchWithHost(baseUrl, "studio-example.be", "/")
  const studioHtml = await studioHome.text()
  await assertStatus(studioHome, 200, "studio-example.be homepage status", studioHtml, failureContext)
  assert.match(studioHtml, /data-tenant-slug="studio-example"/)
  assert.match(studioHtml, /Studio Example/)

  const studioWww = await fetchWithHost(baseUrl, "www.studio-example.be", "/")
  const studioWwwHtml = await studioWww.text()
  await assertStatus(studioWww, 200, "www.studio-example.be homepage status", studioWwwHtml, failureContext)
  assert.match(studioWwwHtml, /data-tenant-slug="studio-example"/)

  const amicarePrivacy = await fetchWithHost(baseUrl, "ami-care.nl", "/privacy-en-cookieverklaring")
  const amicarePrivacyHtml = await amicarePrivacy.text()
  await assertStatus(amicarePrivacy, 200, "ami-care.nl privacy status", amicarePrivacyHtml, failureContext)
  assert.match(amicarePrivacyHtml, /data-provider-variant="shadcnui-blocks\.legal-content-01"/)
  assert.match(amicarePrivacyHtml, /AMICARE ZORG/)
  assert.match(amicarePrivacyHtml, /Optidigi, handelend onder de naam Site in a Box/)

  const amicarePrivacyAlias = await fetchWithHost(baseUrl, "ami-care.nl", "/privacy")
  assert.equal(amicarePrivacyAlias.status, 404)

  const amicareMedia = await fetchWithHost(baseUrl, "ami-care.nl", "/siab-media/tenant-ami-care/bedroom.jpg")
  assert.equal(amicareMedia.status, 200)
  assert.equal(amicareMedia.headers.get("content-type"), "image/jpeg")
  assert.equal(await amicareMedia.text(), "stub media")

  const traversalMedia = await fetchWithHost(baseUrl, "ami-care.nl", "/siab-media/tenant-ami-care/%2E%2E/bedroom.jpg")
  assert.equal(traversalMedia.status, 404)

  const crossTenantMedia = await fetchWithHost(
    baseUrl,
    "studio-example.be",
    "/siab-media/tenant-ami-care/bedroom.jpg",
  )
  assert.equal(crossTenantMedia.status, 404)

  const directOrigin = await fetchWithHost(baseUrl, "ami-care.nl", "/", { includeOriginSecret: false })
  const directOriginBody = await directOrigin.text()
  assert.equal(directOrigin.status, 404)
  assert.equal(directOriginBody, "Page not found")
  assertNoAnalyticsLeakage(directOriginBody)

  const spoofedOrigin = await fetchWithHost(baseUrl, "ami-care.nl", "/", {
    originSecret: "guessed-origin-secret-000000000000000",
  })
  const spoofedOriginBody = await spoofedOrigin.text()
  assert.equal(spoofedOrigin.status, 404)
  assert.equal(spoofedOriginBody, "Page not found")
  assertNoAnalyticsLeakage(spoofedOriginBody)

  const nonHttpsEdge = await fetchWithHost(baseUrl, "ami-care.nl", "/", { forwardedProto: "http" })
  assert.equal(nonHttpsEdge.status, 404)

  const crossHostHeader = await fetchWithHost(baseUrl, "ami-care.nl", "/", {
    forwardedHost: "studio-example.be",
  })
  const crossHostHeaderBody = await crossHostHeader.text()
  assert.equal(crossHostHeader.status, 404)
  assert.doesNotMatch(crossHostHeaderBody, /data-tenant-slug=/)

  const unknownHostNotFound = await fetchWithHost(baseUrl, "unknown.example", "/")
  const unknownHostHtml = await unknownHostNotFound.text()
  await assertStatus(unknownHostNotFound, 404, "unknown.example/ status", unknownHostHtml, failureContext)
  assert.match(unknownHostHtml, /Page not found/)
  assert.doesNotMatch(unknownHostHtml, /data-system-template="shadcnui-blocks\.not-found-/)
  assertNoAnalyticsLeakage(unknownHostHtml)

  const tenantNotFoundChecks = [
    ["ami-care.nl", "/missing-page"],
    ["ami-care.nl", "/robots.txt"],
    ["ami-care.nl", "/manifest.json"],
  ]

  for (const [host, pathname] of tenantNotFoundChecks) {
    const response = await fetchWithHost(baseUrl, host, pathname)
    const html = await response.text()
    await assertStatus(response, 404, `${host}${pathname} status`, html, failureContext)
    assert.match(html, /Page not found/)
    assert.match(html, /data-system-template="shadcnui-blocks\.not-found-01"/)
    assert.match(html, /data-system-template-kind="not-found"/)
    assert.match(html, /data-siab-theme-mode="light"/)
    assert.match(html, /localStorage\.getItem\("siab-color-mode"\)/)
    assert.match(html, /data-siab-theme-overrides/)
    assert.match(html, /data-provider-token-mode="theme"/)
    assert.doesNotMatch(html, /data-system-template="shadcnui-blocks\.not-found-01"[^>]*style=/)
    assertNoAnalyticsLeakage(html)
  }

  if (includeMalformedEncodedPath) {
    const host = "ami-care.nl"
    const pathname = "/%E0%A4%A"
    const response = await fetchWithHost(baseUrl, host, pathname)
    const html = await response.text()
    await assertStatusIn(response, [400, 404], `${host}${pathname} status`, html, failureContext)
    if (response.status === 404) assert.match(html, /Page not found/)
    if (response.status === 400) assert.doesNotMatch(html, /Page not found/)
    assertNoAnalyticsLeakage(html)
  }
}
