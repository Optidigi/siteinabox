import assert from "node:assert/strict"
import test from "node:test"
import * as React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { ShadcnUiFooterView } from "./footer-views.tsx"
globalThis.React = React

const settings = {
  siteName: "Fixture",
  siteUrl: "https://fixture.invalid",
  navFooter: [{ label: "Contact", href: "/contact" }],
  contact: { social: [{ platform: "Mastodon", url: "https://social.invalid/fixture" }] },
  chrome: { footer: {
    variant: "shadcnui-blocks.footer-01",
    tagline: "Structured footer copy",
    copyright: "© Fixture",
    legalLinks: [{ label: "Privacy", href: "/privacy" }],
    columns: [{ items: [{ label: "Product", links: [{ label: "Features", href: "/features" }] }] }],
  } },
}

test("all seven footer variants dispatch explicitly and consume structured chrome data", () => {
  const structures = new Set()
  for (let index = 1; index <= 7; index += 1) {
    const variant = `shadcnui-blocks.footer-${String(index).padStart(2, "0")}`
    const html = renderToStaticMarkup(React.createElement(ShadcnUiFooterView, { variant, settings }))
    assert.match(html, /Fixture/)
    assert.match(html, /© Fixture/)
    assert.match(html, new RegExp(`data-provider-variant="${variant}"`))
    structures.add(html.replaceAll(variant, "variant"))
  }
  assert.equal(structures.size, 7)
})

test("absent optional footer renders nothing and unknown variants fail closed", () => {
  const empty = { siteName: "Fixture", siteUrl: "https://fixture.invalid" }
  assert.equal(renderToStaticMarkup(React.createElement(ShadcnUiFooterView, { variant: "shadcnui-blocks.footer-01", settings: empty })), "")
  assert.throws(() => renderToStaticMarkup(React.createElement(ShadcnUiFooterView, { variant: "shadcnui-blocks.footer-99", settings })), /Unresolved provider chrome variant/)
})

test("footer aggregation preserves every column item, external intent and capability-gated newsletter forms", () => {
  const rich = {
    ...settings,
    contactEmail: "hello@fixture.invalid",
    contact: { phone: "+31 20 123 4567", address: "Canal 1", social: [{ platform: "Mastodon", url: "https://social.invalid/fixture" }] },
    nap: { legalName: "Fixture BV", kvkNumber: "12345678", city: "Amsterdam" },
    hours: [{ day: "monday", open: "09:00", close: "17:00" }],
    serviceArea: [{ name: "Amsterdam" }],
    chrome: { footer: {
      variant: "shadcnui-blocks.footer-03",
      copyright: "© Fixture",
      columns: [{ items: [
        { type: "contact", label: "Reach us" },
        { type: "business", label: "Company" },
        { type: "links", label: "Partners", links: [{ label: "Partner", href: "https://partner.invalid", external: true }] },
      ] }],
      newsletter: { title: "Updates", placeholder: "Your email", submitLabel: "Join", action: "/subscribe", method: "POST" },
    } },
  }
  const html = renderToStaticMarkup(React.createElement(ShadcnUiFooterView, { variant: "shadcnui-blocks.footer-03", settings: rich }))
  for (const text of ["Reach us", "hello@fixture.invalid", "Company", "Fixture BV", "Partners", "Partner", "Your email", "Join"]) assert.match(html, new RegExp(text))
  assert.match(html, /action="\/subscribe"/)
  assert.match(html, /target="_blank"/)
  assert.throws(() => renderToStaticMarkup(React.createElement(ShadcnUiFooterView, { variant: "shadcnui-blocks.footer-01", settings: rich })), /no newsletter form region/)
})
