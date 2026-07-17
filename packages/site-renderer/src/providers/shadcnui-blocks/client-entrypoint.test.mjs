import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"
import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { SitePageRenderer } from "../../SitePageRenderer.tsx"

test("client renderer loads active variants without importing the eager block registry", async () => {
  const source = await readFile(new URL("../../ClientSitePageRenderer.tsx", import.meta.url), "utf8")
  assert.match(source, /loadShadcnUiExplicitBlockView/)
  assert.doesNotMatch(source, /block-views\.generated/)
  assert.doesNotMatch(source, /ShadcnUiBlockView/)
})

test("explicit null chrome overrides render no optional chrome", () => {
  const html = renderToStaticMarkup(React.createElement(SitePageRenderer, {
    page: { id: "test", title: "Test", slug: "index", blocks: [] },
    settings: { siteName: "Test", navHeader: [], navFooter: [], chrome: {} },
    header: null,
    banner: null,
    footer: null,
    includeBehaviorScripts: false,
  }))
  assert.doesNotMatch(html, /data-site-chrome=/)
  assert.doesNotMatch(html, /data-siab-site-header/)
  assert.doesNotMatch(html, /data-siab-site-footer/)
})
