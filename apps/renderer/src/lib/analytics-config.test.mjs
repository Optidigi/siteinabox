import assert from "node:assert/strict"
import test from "node:test"

import { analyticsConfigJson, buildAnalyticsConfig } from "./analytics-config.js"

const baseSnapshot = {
  schemaVersion: 1,
  tenantId: "tenant-1",
  tenantSlug: "fixture",
  domain: "fixture.example",
  siteUrl: "https://fixture.example",
  settings: {
    siteUrl: "https://fixture.example",
    analytics: {
      provider: "posthog",
      token: "phc_public",
      apiHost: "https://eu.posthog.com/<script>",
      captureSections: true,
      unsafe: "<script>alert(1)</script>",
    },
    analyticsConsent: {
      enabled: true,
      provider: "posthog",
      consentStorageKey: "siab_cookie_consent_v1",
      consentVersion: "2026-06",
      captureActions: true,
      captureForms: false,
    },
  },
}

const page = {
  slug: "index",
  title: "Home",
}

test("builds a sanitized PostHog analytics config from snapshot settings", () => {
  const config = buildAnalyticsConfig({ snapshot: baseSnapshot, page, pathname: "/" })

  assert.equal(config.provider, "posthog")
  assert.equal(config.posthogProjectToken, "phc_public")
  assert.equal(config.posthogHost, "https://eu.posthog.com/<script>")
  assert.equal(config.consentMode, "required")
  assert.equal(config.consentStorageKey, "siab_cookie_consent_v1")
  assert.equal(config.tenantSlug, "fixture")
  assert.equal(config.pageSlug, "index")
  assert.equal(config.unsafe, undefined)
})

test("escapes JSON for safe inline script embedding", () => {
  const json = analyticsConfigJson(buildAnalyticsConfig({ snapshot: baseSnapshot, page, pathname: "/" }))

  assert.equal(json.includes("<script>"), false)
  assert.match(json, /\\u003cscript>/)
})

test("omits analytics config when snapshot settings have no analytics block", () => {
  const config = buildAnalyticsConfig({
    snapshot: { ...baseSnapshot, settings: { ...baseSnapshot.settings, analytics: null } },
    page,
    pathname: "/",
  })

  assert.equal(config, null)
  assert.equal(analyticsConfigJson(config), null)
})

test("omits unsupported analytics providers", () => {
  const config = buildAnalyticsConfig({
    snapshot: {
      ...baseSnapshot,
      settings: {
        ...baseSnapshot.settings,
        analytics: { provider: "arbitrary", token: "unused" },
      },
    },
    page,
    pathname: "/",
  })

  assert.equal(config, null)
})
