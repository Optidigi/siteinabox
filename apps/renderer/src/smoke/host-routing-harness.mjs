import assert from "node:assert/strict"
import { once } from "node:events"
import { createServer as createHttpServer } from "node:http"
import { createServer as createNetServer } from "node:net"

import { getRendererDeployTargetByHost } from "@siteinabox/contracts/deploy-targets"
import {
  amicarePublishedSiteSnapshot,
} from "@siteinabox/contracts/fixtures/tenants"

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
  const snapshotsByHost = new Map([
    ["ami-care.nl", publishedSnapshotForHost("ami-care.nl")],
  ])
  const server = createHttpServer((request, response) => {
    const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "127.0.0.1"}`)
    if (url.pathname !== "/api/renderer/snapshot") {
      response.writeHead(404, { "content-type": "application/json; charset=utf-8" })
      response.end(JSON.stringify({ error: "not_found" }))
      return
    }

    const host = url.searchParams.get("host") ?? ""
    const snapshot = snapshotsByHost.get(host)
    if (!snapshot) {
      response.writeHead(404, { "content-type": "application/json; charset=utf-8" })
      response.end(JSON.stringify({ error: "unknown_host" }))
      return
    }

    response.writeHead(200, { "content-type": "application/json; charset=utf-8" })
    response.end(JSON.stringify({ snapshot }))
  })
  server.listen(port, listenHost)
  await once(server, "listening")
  return { server, snapshotsByHost, url: `http://${publicHost}:${port}`, localUrl: `http://127.0.0.1:${port}` }
}

function publishedSnapshotForHost(host) {
  const target = getRendererDeployTargetByHost(host)
  assert.ok(target, `missing renderer deploy target for ${host}`)
  const tenantId = `tenant-${target.id}`
  const source = amicarePublishedSiteSnapshot
  const snapshot = structuredClone(source)
  const retargeted = rewriteSnapshotStrings(snapshot, [
    [source.siteUrl, target.productionOrigin],
    [source.settings?.siteUrl, target.productionOrigin],
    [source.domain, target.productionHost],
  ])

  return {
    ...retargeted,
    tenantId,
    tenantSlug: target.tenantSlug,
    domain: target.productionHost,
    siteUrl: target.productionOrigin,
    manifest: {
      ...retargeted.manifest,
      tenantId,
    },
    settings: {
      ...retargeted.settings,
      siteUrl: target.productionOrigin,
      siteName: "Amicare-Zorg",
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
        token: `phc_${target.id.replace("-", "_")}_smoke`,
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
          blockType: "richText",
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

export async function fetchWithHost(baseUrl, host, pathname) {
  return fetch(`${baseUrl}${pathname}`, {
    headers: {
      host,
      "x-forwarded-host": host,
    },
  })
}

export async function assertStubCmsSnapshots(cms) {
  const expected = [
    ["ami-care.nl", "ami-care", "amber-warm"],
  ]

  for (const [host, tenantSlug, colorSchemeId] of expected) {
    const response = await fetch(`${cms.url}/api/renderer/snapshot?host=${encodeURIComponent(host)}`)
    const body = await response.text()
    assert.equal(response.status, 200, `${host} snapshot route status\n${body}`)
    const { snapshot } = JSON.parse(body)
    assert.equal(snapshot.tenantSlug, tenantSlug, `${host} snapshot tenant slug`)
    assert.equal(snapshot.domain, host, `${host} snapshot domain`)
    assert.equal(snapshot.siteUrl, `https://${host}`, `${host} snapshot site URL`)
    assert.equal(snapshot.settings.siteUrl, `https://${host}`, `${host} snapshot settings site URL`)
    assert.equal(snapshot.theme?.version, 2, `${host} snapshot theme version`)
    assert.equal(snapshot.theme?.colors?.schemeId, colorSchemeId, `${host} snapshot theme color scheme`)
    assert.equal(snapshot.manifest?.tenantId, snapshot.tenantId, `${host} snapshot manifest tenant id`)
    assert.equal(cms.snapshotsByHost.get(host)?.tenantSlug, tenantSlug, `${host} active stub snapshot map`)
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
  assert.match(amicareHtml, /data-tenant-renderer="amicare"/)
  assert.match(amicareHtml, /data-siab-theme-overrides/)
  assert.match(amicareHtml, /\.site-renderer\[data-siab-site-renderer\] \.rt-canvas/)
  assert.match(amicareHtml, /--color-accent:#d97706/)
  assert.match(amicareHtml, /--font-title:Fraunces Variable, ui-serif, Georgia, Cambria, "Times New Roman", Times, serif/)
  assert.doesNotMatch(amicareHtml, /--site-style-preset:/)
  assert.doesNotMatch(amicareHtml, /id="siab-analytics-config"/)
  assert.match(amicareHtml, /<link rel="icon" href="\/siab-media\/tenant-ami-care\/favicon\.svg"\/?>/)
  assert.match(amicareHtml, /\/siab-media\/tenant-ami-care\/bedroom\.jpg/)
  assert.match(amicareHtml, /Jeugdzorg/)
  assert.match(amicareHtml, /Begeleiding/)
  assert.match(amicareHtml, /Vertrouwen/)
  assert.match(amicareHtml, /href="\/privacy-en-cookieverklaring"/)

  const amicarePrivacy = await fetchWithHost(baseUrl, "ami-care.nl", "/privacy-en-cookieverklaring")
  const amicarePrivacyHtml = await amicarePrivacy.text()
  await assertStatus(amicarePrivacy, 200, "ami-care.nl privacy status", amicarePrivacyHtml, failureContext)
  assert.doesNotMatch(amicarePrivacyHtml, /data-system-page="tenant-privacy"/)
  assert.match(amicarePrivacyHtml, /cms-block--richtext/)
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

  const unknownHostNotFound = await fetchWithHost(baseUrl, "unknown.example", "/")
  const unknownHostHtml = await unknownHostNotFound.text()
  await assertStatus(unknownHostNotFound, 404, "unknown.example/ status", unknownHostHtml, failureContext)
  assert.match(unknownHostHtml, /Page not found/)
  assert.doesNotMatch(unknownHostHtml, /data-system-template="tailwindplus\.marketing\.feedback\.404-simple"/)
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
    assert.match(html, /data-system-template="tailwindplus\.marketing\.feedback\.404-simple"/)
    assert.match(html, /data-system-template-kind="not-found"/)
    assert.match(html, /data-siab-theme-overrides/)
    assert.match(html, /--color-accent:#d97706/)
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
