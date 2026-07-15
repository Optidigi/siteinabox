import assert from "node:assert/strict"
import test from "node:test"
import * as React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { ShadcnUiNavbarView } from "./navbar-views.tsx"
globalThis.React = React

const settings = {
  siteName: "Fixture",
  siteUrl: "https://fixture.invalid",
  navHeader: [{ label: "Home", href: "/" }, { label: "Contact", href: "/contact" }],
  chrome: { header: { variant: "shadcnui-blocks.navbar-01", cta: { label: "Start", href: "/start" } } },
}

test("all five navbar variants dispatch explicitly and consume structured chrome data", () => {
  const structures = new Set()
  for (let index = 1; index <= 5; index += 1) {
    const variant = `shadcnui-blocks.navbar-${String(index).padStart(2, "0")}`
    const variantSettings = index === 5 ? { ...settings, navHeader: [], chrome: { header: { variant, search: { enabled: true, action: "/find", placeholder: "Find care" }, secondaryAction: { label: "Sign in", href: "/login", external: true }, cta: settings.chrome.header.cta } } } : settings
    const html = renderToStaticMarkup(React.createElement(ShadcnUiNavbarView, { variant, settings: variantSettings, currentSlug: "contact" }))
    assert.match(html, /Fixture/)
    if (index < 5) assert.match(html, /Contact/)
    else {
      assert.match(html, /action="\/find"/)
      assert.match(html, /Find care/)
      assert.match(html, /rel="noopener noreferrer"/)
    }
    assert.match(html, /Start/)
    assert.match(html, new RegExp(`data-provider-variant="${variant}"`))
    structures.add(html.replaceAll(variant, "variant"))
  }
  assert.equal(structures.size, 5)
})

test("flyouts, external links, active modes and capacity are explicit and lossless", () => {
  const grouped = {
    ...settings,
    navHeader: [
      { label: "Home", href: "/" },
      { label: "Care", children: [
        { label: "Nursing", href: "/nursing", description: "Care at home", icon: "smile" },
        { label: "Partner", href: "https://partner.invalid", external: true },
      ] },
    ],
    chrome: { header: { variant: "shadcnui-blocks.navbar-03", behavior: "sticky", activeMode: "path", mobileMenu: "drawer", cta: { label: "Start", href: "/start" } } },
  }
  const html = renderToStaticMarkup(React.createElement(ShadcnUiNavbarView, { variant: "shadcnui-blocks.navbar-03", settings: grouped }))
  assert.match(html, /Care at home/)
  assert.match(html, /Partner/)
  assert.match(html, /target="_blank"/)
  assert.match(html, /data-header-behavior="sticky"/)
  assert.match(html, /data-mobile-menu="drawer"/)
  assert.throws(() => renderToStaticMarkup(React.createElement(ShadcnUiNavbarView, { variant: "shadcnui-blocks.navbar-01", settings: grouped })), /does not support flyout|supports flat links/)
})

test("absent optional header renders nothing and unknown variants fail closed", () => {
  const empty = { siteName: "Fixture", siteUrl: "https://fixture.invalid" }
  assert.equal(renderToStaticMarkup(React.createElement(ShadcnUiNavbarView, { variant: "shadcnui-blocks.navbar-01", settings: empty })), "")
  assert.throws(() => renderToStaticMarkup(React.createElement(ShadcnUiNavbarView, { variant: "shadcnui-blocks.navbar-99", settings })), /Unresolved provider chrome variant/)
})
