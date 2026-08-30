import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"
import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { FooterRenderer } from "./Footer.tsx"
import { SitePageRenderer } from "../SitePageRenderer.tsx"
import { v1FixturePage, v1FixtureSettings } from "../fixtures/v1.ts"

test("footer-01 renders the shared settings footer with navigation", () => {
  const html = renderToStaticMarkup(React.createElement(FooterRenderer, {
    settings: v1FixtureSettings,
  }))

  assert.match(html, /data-siab-footer="true"/)
  assert.match(html, /data-footer-variant="footer-01"/)
  assert.match(html, /site-footer-01-layout/)
  assert.match(html, /class="site-footer site-footer-01"/)
  assert.doesNotMatch(html, /site-footer-01-card/)
  assert.match(html, /Atelier Noord/)
  assert.match(html, /Atelier Noord home/)
  assert.match(html, /Footer navigation/)
  assert.match(html, /Diensten/)
  assert.match(html, /Contact/)
  assert.match(html, /© Atelier Noord/)
})

test("footer-01 falls back to the site wordmark and copyright", () => {
  const html = renderToStaticMarkup(React.createElement(FooterRenderer, {
    settings: {
      ...v1FixtureSettings,
      chrome: { footer: { variant: "footer-01" } },
      navigation: { footer: [] },
    },
  }))

  assert.match(html, /site-footer-01-wordmark/)
  assert.match(html, /© Atelier Noord/)
  assert.doesNotMatch(html, /site-footer-01-navigation/)
})

test("footer is part of the shared page renderer and can be disabled", () => {
  const withFooter = renderToStaticMarkup(React.createElement(SitePageRenderer, {
    page: { ...v1FixturePage, blocks: [] },
    settings: v1FixtureSettings,
  }))
  const withoutFooter = renderToStaticMarkup(React.createElement(SitePageRenderer, {
    page: { ...v1FixturePage, blocks: [] },
    settings: {
      ...v1FixtureSettings,
      chrome: { ...v1FixtureSettings.chrome, footer: null },
    },
  }))

  assert.match(withFooter, /data-siab-footer="true"/)
  assert.doesNotMatch(withoutFooter, /data-siab-footer="true"/)
})

test("footer-01 uses a resilient responsive link grid and shared content track", async () => {
  const styles = await readFile(new URL("../styles.css", import.meta.url), "utf8")
  const start = styles.indexOf(".site-footer-01-inner")
  const end = styles.indexOf("/* Consent 01", start)
  assert.ok(start >= 0 && end > start)
  const footerStyles = styles.slice(start, end)

  assert.match(footerStyles, /max-width: var\(--siab-content-max, 80rem\)/)
  assert.match(styles, /\.site-footer \{[\s\S]*background: var\(--background\)/)
  assert.match(footerStyles, /\.site-footer-01-layout\s*\{[\s\S]*align-items: center/)
  assert.match(footerStyles, /grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/)
  assert.match(footerStyles, /@media \(min-width: 40rem\)[\s\S]*grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/)
  assert.match(footerStyles, /@media \(min-width: 48rem\)[\s\S]*\.site-footer-01-navigation\s*\{[\s\S]*width: 100%/)
  assert.match(footerStyles, /@media \(min-width: 64rem\)[\s\S]*\.site-footer-01-links\s*\{[\s\S]*display: flex;[\s\S]*flex-wrap: wrap;[\s\S]*justify-content: center;/)
  assert.match(footerStyles, /@media \(min-width: 64rem\)[\s\S]*\.site-footer-01-inner\s*\{[\s\S]*padding-inline: 2rem/)
  assert.match(footerStyles, /\.site-footer-01-links\s*\{[\s\S]*justify-items: center/)
  assert.match(footerStyles, /\.site-footer-01-copyright\s*\{[\s\S]*text-align: center/)
  assert.match(footerStyles, /@media \(min-width: 64rem\)[\s\S]*\.site-footer-01-copyright\s*\{[\s\S]*text-align: right/)
  assert.match(footerStyles, /min-height: 1\.5rem/)
  assert.doesNotMatch(footerStyles, /site-footer-01-card/)
  assert.doesNotMatch(footerStyles, /box-shadow:/)
  assert.doesNotMatch(footerStyles, /border:/)
  assert.match(footerStyles, /overflow-wrap: anywhere/)
})
