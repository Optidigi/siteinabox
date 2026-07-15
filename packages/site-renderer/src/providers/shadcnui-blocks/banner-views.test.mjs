import assert from "node:assert/strict"
import test from "node:test"
import * as React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { ShadcnUiBannerView } from "./banner-views.tsx"

globalThis.React = React

const settings = {
  siteName: "Fixture",
  siteUrl: "https://fixture.invalid",
  analyticsConsent: { enabled: true },
  chrome: { banner: { visible: true, title: "Privacy", message: "Structured consent copy", dismissible: true } },
}

test("all four banner variants dispatch explicitly from structured chrome data", () => {
  for (let index = 1; index <= 4; index += 1) {
    const variant = `shadcnui-blocks.banner-${String(index).padStart(2, "0")}`
    const html = renderToStaticMarkup(React.createElement(ShadcnUiBannerView, { variant, settings }))
    assert.match(html, /Structured consent copy/)
    assert.match(html, new RegExp(`data-provider-variant="${variant}"`))
  }
})

test("approved banner-04 exposes accept and reject consent actions", () => {
  const html = renderToStaticMarkup(React.createElement(ShadcnUiBannerView, { variant: "shadcnui-blocks.banner-04", settings }))
  assert.match(html, /data-siab-cookie-consent="true"/)
  assert.match(html, /data-consent-action="accept"/)
  assert.match(html, /data-consent-action="reject"/)
})
