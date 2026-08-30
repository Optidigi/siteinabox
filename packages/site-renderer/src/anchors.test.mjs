import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"
import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { v1FixturePage, v1FixtureSettings } from "./fixtures/v1.ts"
import { ClientSitePageRenderer } from "./ClientSitePageRenderer.tsx"
import { SitePageRenderer } from "./SitePageRenderer.tsx"

const anchoredPage = {
  ...v1FixturePage,
  blocks: [
    { ...v1FixturePage.blocks[0], anchor: "start" },
    { ...v1FixturePage.blocks.find((block) => block.blockType === "services"), anchor: "werkwijze" },
    { ...v1FixturePage.blocks.find((block) => block.blockType === "cta"), anchor: "contact" },
  ],
}

function renderServerPage() {
  return renderToStaticMarkup(React.createElement(SitePageRenderer, {
    page: anchoredPage,
    settings: v1FixtureSettings,
  }))
}

function renderClientPage() {
  return renderToStaticMarkup(React.createElement(ClientSitePageRenderer, {
    prepared: { kind: "first-party" },
    page: anchoredPage,
    settings: v1FixtureSettings,
  }))
}

for (const [renderer, render] of [["server", renderServerPage], ["client", renderClientPage]]) {
  test(`${renderer} page renderer emits authored section anchors as native fragment targets`, () => {
    const html = render()

    assert.match(html, /id="start"[^>]*data-block-type="hero"/)
    assert.match(html, /id="werkwijze"[^>]*data-block-type="services"/)
    assert.match(html, /id="contact"[^>]*data-block-type="cta"/)
    assert.match(html, /data-siab-section-anchor="werkwijze"/)
  })
}

test("sticky anchored sections reserve room below the navbar", async () => {
  const styles = await readFile(new URL("./styles.css", import.meta.url), "utf8")

  assert.match(styles, /\.site-frame-root-navbar-sticky > main > \[data-siab-section-anchor\]:not\(\[data-siab-section-anchor=""\]\)/)
  assert.match(styles, /scroll-margin-block-start: calc\(var\(--siab-navbar-visual-height\) \+ 1rem\)/)
})
