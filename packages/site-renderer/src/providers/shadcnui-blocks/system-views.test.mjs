import assert from "node:assert/strict"
import test from "node:test"
import * as React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { ShadcnUiNotFoundView } from "./system-views.tsx"

const settings = { siteName: "SIAB fixture", siteUrl: "https://fixture.invalid" }
globalThis.React = React

test("all eight imported not-found templates dispatch explicitly with distinct literal markup", () => {
  const output = new Set()
  for (let index = 1; index <= 8; index += 1) {
    const variant = `shadcnui-blocks.not-found-${String(index).padStart(2, "0")}`
    const html = renderToStaticMarkup(React.createElement(ShadcnUiNotFoundView, { variant, settings, pathname: "/missing" }))
    assert.match(html, new RegExp(`data-provider-variant="${variant}"`))
    assert.match(html, /Page not found|page doesn|found the void/i)
    output.add(html.replaceAll(variant, "variant"))
  }
  assert.equal(output.size, 8)
})

test("unknown not-found variants fail closed", () => {
  assert.throws(
    () => renderToStaticMarkup(React.createElement(ShadcnUiNotFoundView, { variant: "shadcnui-blocks.not-found-99", settings })),
    /Unresolved provider system template/,
  )
})
