import assert from "node:assert/strict"
import test from "node:test"
import * as React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import {
  contact01CmsLike,
  contact03CmsLike,
  contactFamilyEmptyItems,
  contactFamilySparse,
} from "./typed/fixtures/contact-family.ts"
import { Contact01 } from "./variants/contact-01/contact.tsx"
import Contact01View from "./variants/contact-01/view.tsx"
import { Contact03 } from "./variants/contact-03/contact.tsx"
import Contact03View from "./variants/contact-03/view.tsx"

globalThis.React = React

const contactFamily = [
  {
    id: "shadcnui-blocks.contact-01",
    Component: Contact01,
    View: Contact01View,
    cmsLike: contact01CmsLike,
    sparse: contactFamilySparse,
    emptyItems: contactFamilyEmptyItems,
    distinctive: /min-h-screen/,
    itemMatch: /Email|Office|Phone/,
  },
  {
    id: "shadcnui-blocks.contact-03",
    Component: Contact03,
    View: Contact03View,
    cmsLike: contact03CmsLike,
    sparse: contactFamilySparse,
    emptyItems: contactFamilyEmptyItems,
    distinctive: /border-dashed bg-muted\/20/,
    itemMatch: /Email|Live chat|Office/,
  },
]

for (const variant of contactFamily) {
  test(`${variant.id} public render outputs layout markup`, () => {
    const html = renderToStaticMarkup(React.createElement(variant.Component, {
      ...variant.cmsLike,
      blockIndex: 0,
    }))
    assert.match(html, variant.distinctive)
    assert.match(html, variant.itemMatch)
  })

  test(`${variant.id} view maps block fields and provider attributes`, () => {
    const block = { blockType: "contactDetails", ...variant.cmsLike }
    const html = renderToStaticMarkup(React.createElement(variant.View, {
      block,
      options: { index: 1 },
    }))
    assert.match(html, new RegExp(`data-provider-variant="${variant.id.replace(".", "\\.")}"`))
  })
}

test("contact variants do not use LiteralProviderVariantView", async () => {
  const { readFile } = await import("node:fs/promises")
  for (const variant of contactFamily) {
    const upstream = variant.id.replace("shadcnui-blocks.", "")
    const source = await readFile(new URL(`./variants/${upstream}/view.tsx`, import.meta.url), "utf8")
    assert.doesNotMatch(source, /LiteralProviderVariantView/)
  }
})
