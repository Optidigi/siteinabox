import assert from "node:assert/strict"
import test from "node:test"

import { analyticsConfigJson, buildAnalyticsConfig } from "./analytics-config.js"
import {
  matchesApprovedPublicAnalyticsConsent,
  publicAnalyticsConsentApproval,
} from "@siteinabox/legal-content/consent-approval"

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

test("omits analytics until a public analytics consent version is legally approved", () => {
  const config = buildAnalyticsConfig({ snapshot: baseSnapshot, page, pathname: "/" })

  assert.equal(publicAnalyticsConsentApproval.consentVersion, null)
  assert.equal(config, null)
})

test("escapes JSON for safe inline script embedding", () => {
  const json = analyticsConfigJson({ posthogHost: "https://eu.posthog.com/<script>" })

  assert.equal(json.includes("<script>"), false)
  assert.match(json, /\\u003cscript>/)
})

test("requires enabled PostHog consent with storage and the exact approved version", () => {
  const consent = baseSnapshot.settings.analyticsConsent

  assert.equal(matchesApprovedPublicAnalyticsConsent(consent, "2026-06"), true)
  assert.equal(matchesApprovedPublicAnalyticsConsent({ ...consent, enabled: false }, "2026-06"), false)
  assert.equal(matchesApprovedPublicAnalyticsConsent({ ...consent, provider: "custom" }, "2026-06"), false)
  assert.equal(matchesApprovedPublicAnalyticsConsent({ ...consent, consentStorageKey: "" }, "2026-06"), false)
  assert.equal(matchesApprovedPublicAnalyticsConsent({ ...consent, consentVersion: "stale" }, "2026-06"), false)
  assert.equal(matchesApprovedPublicAnalyticsConsent(consent, null), false)
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

test("does not bypass legal consent approval when public token fields exist", () => {
  const config = buildAnalyticsConfig({
    snapshot: {
      ...baseSnapshot,
      settings: {
        ...baseSnapshot.settings,
        analytics: {
          ...baseSnapshot.settings.analytics,
          token: "phc_public",
          apiKey: "private_api_key",
          projectApiKey: "private_project_api_key",
        },
      },
    },
    page,
    pathname: "/",
  })

  assert.equal(config, null)
})

test("omits analytics config when only private-looking PostHog token aliases exist", () => {
  const config = buildAnalyticsConfig({
    snapshot: {
      ...baseSnapshot,
      settings: {
        ...baseSnapshot.settings,
        analytics: {
          provider: "posthog",
          apiHost: "https://eu.posthog.com",
          apiKey: "private_api_key",
          projectApiKey: "private_project_api_key",
        },
      },
    },
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
