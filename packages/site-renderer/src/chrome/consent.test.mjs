import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"
import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { ConsentRenderer } from "./Consent.tsx"
import { createPreviewConsentRuntime } from "./consent-behavior.ts"
import { SitePageRenderer } from "../SitePageRenderer.tsx"
import { v1FixturePage, v1FixtureSettings } from "../fixtures/v1.ts"

const consent = {
  variant: "consent-01",
  visible: true,
  title: "We gebruiken cookies",
  message: "Noodzakelijke cookies houden de website werkend.",
  acceptLabel: "Alles toestaan",
  allowSelectionLabel: "Selectie toestaan",
  rejectLabel: "Weigeren",
  necessaryLabel: "Noodzakelijk",
  preferencesLabel: "Voorkeuren",
  statisticsLabel: "Statistieken",
  marketingLabel: "Marketing",
  privacyLink: { label: "Lees meer", href: "/privacy-en-cookieverklaring" },
}

test("consent-01 renders a full-width settings-owned preferences rail", () => {
  const html = renderToStaticMarkup(React.createElement(ConsentRenderer, {
    settings: { ...v1FixtureSettings, consent },
    consentAvailable: true,
  }))

  assert.match(html, /data-siab-consent-frame="true"/)
  assert.match(html, /data-siab-consent-variant="consent-01"/)
  assert.match(html, /data-siab-cookie-consent="true"/)
  assert.match(html, /role="switch"/)
  assert.match(html, /data-siab-consent-category="necessary"/)
  assert.match(html, /data-siab-consent-category="preferences"/)
  assert.match(html, /data-siab-consent-category="analytics"/)
  assert.match(html, /data-siab-consent-category="marketing"/)
  assert.match(html, /data-siab-consent-action="all"/)
  assert.match(html, /data-siab-consent-action="selection"/)
  assert.match(html, /data-siab-consent-action="reject"/)
  assert.doesNotMatch(html, /data-siab-open-consent|site-consent-manage/)
  assert.match(html, /privacy-en-cookieverklaring/)

  const allowAllPosition = html.indexOf('data-siab-consent-action="all"')
  const selectionPosition = html.indexOf('data-siab-consent-action="selection"')
  const rejectPosition = html.indexOf('data-siab-consent-action="reject"')
  assert.ok(allowAllPosition < selectionPosition && selectionPosition < rejectPosition)
  assert.ok(
    html.indexOf('data-siab-consent-category="necessary"') < html.indexOf('data-siab-consent-category="preferences"') &&
    html.indexOf('data-siab-consent-category="preferences"') < html.indexOf('data-siab-consent-category="analytics"') &&
    html.indexOf('data-siab-consent-category="analytics"') < html.indexOf('data-siab-consent-category="marketing"'),
  )
})

test("consent is rendered only when public analytics has been approved", () => {
  const settings = { ...v1FixtureSettings, consent }
  assert.equal(renderToStaticMarkup(React.createElement(ConsentRenderer, { settings })), "")
  assert.equal(
    renderToStaticMarkup(React.createElement(ConsentRenderer, { settings, consentAvailable: false })),
    "",
  )
  assert.match(
    renderToStaticMarkup(React.createElement(ConsentRenderer, {
      settings: v1FixtureSettings,
      consentAvailable: true,
    })),
    /data-siab-consent-variant="consent-01"/,
    "approved analytics receives a usable default when no custom presentation is stored",
  )
  assert.match(
    renderToStaticMarkup(React.createElement(SitePageRenderer, {
      page: { ...v1FixturePage, blocks: [] },
      settings,
      consentAvailable: true,
    })),
    /data-siab-consent-variant="consent-01"/,
  )
})

test("consent-01 uses the shared renderer stylesheet and no client component dependency", async () => {
  const source = await readFile(new URL("../styles.css", import.meta.url), "utf8")
  const behavior = await readFile(new URL("./consent-behavior.ts", import.meta.url), "utf8")
  assert.match(source, /\.site-consent-frame\s*\{[\s\S]*position: fixed;/)
  assert.match(source, /\.site-consent-banner\s*\{[\s\S]*padding: 1rem 0/)
  assert.match(source, /\.site-consent-01-inner\s*\{[\s\S]*max-width: var\(--siab-content-max, 80rem\)[\s\S]*padding-inline: 1\.25rem/)
  assert.match(source, /@media \(min-width: 40rem\)\s*\{[\s\S]*\.site-consent-banner\s*\{[\s\S]*padding: 1\.5rem 0[\s\S]*\.site-consent-01-inner\s*\{[\s\S]*padding-inline: 2rem/)
  assert.match(source, /@media \(min-width: 64rem\)\s*\{[\s\S]*\.site-consent-01-inner\s*\{[\s\S]*padding-inline: 2\.5rem/)
  assert.match(source, /@media \(min-width: 80rem\)\s*\{[\s\S]*\.site-consent-01-inner\s*\{[\s\S]*column-gap: 1\.5rem/)
  assert.match(source, /\.site-consent-switch-control input:focus-visible \+ \.site-consent-switch-track/)
  assert.match(source, /background: color-mix\(in oklab, var\(--foreground\) 20%, var\(--background\)\)/)
  assert.match(source, /\.site-consent-switch-track\s*\{[\s\S]*inset: 0;[\s\S]*border: 0;/)
  assert.match(source, /\.site-consent-switch-thumb\s*\{[\s\S]*position: absolute;[\s\S]*transform: translateY\(-50%\)/)
  assert.match(source, /transition: background-color 200ms ease-in-out/)
  assert.match(source, /opacity: 0\.5/)
  assert.match(source, /grid-template-columns: repeat\(4, minmax\(0, 1fr\)\)/)
  assert.match(source, /grid-template-columns: repeat\(5, minmax\(0, 1fr\)/)
  assert.match(source, /@media \(prefers-reduced-motion: reduce\)/)
  assert.match(behavior, /api\.applyConsent\(\{ preferences: true, analytics: true, marketing: true \}\)/)
  assert.match(behavior, /api\.applyConsent\(\{ preferences: false, analytics: false, marketing: false \}\)/)
  assert.doesNotMatch(behavior, /localStorage|fetch\(|posthog/i)
  assert.doesNotMatch(behavior, /use client|@radix-ui|@siteinabox\/ui/)
})

test("preview consent runtime is in-memory and reload-scoped", () => {
  const runtime = createPreviewConsentRuntime()
  assert.deepEqual(runtime.getConsent(), {
    necessary: true,
    preferences: false,
    analytics: false,
    marketing: false,
    decided: false,
  })

  let updates = 0
  const unsubscribe = runtime.subscribe?.(() => { updates += 1 })
  runtime.applyConsent({ preferences: true, analytics: true, marketing: true })
  assert.deepEqual(runtime.getConsent(), {
    necessary: true,
    preferences: true,
    analytics: true,
    marketing: true,
    decided: true,
  })

  assert.equal(updates, 1)

  unsubscribe?.()
  runtime.applyConsent({ preferences: true, analytics: true, marketing: true })
  assert.equal(updates, 1)
})
