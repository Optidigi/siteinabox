import assert from "node:assert/strict"
import test from "node:test"
import * as React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import {
  integrations01CmsLike,
  integrationsFamilyCmsLike,
  integrationsFamilyEmptyItems,
  integrationsFamilyLong,
  integrationsFamilySparse,
} from "./typed/fixtures/integrations-family.ts"
import { Integrations01 } from "./variants/integrations-01/integrations.tsx"
import Integrations01View from "./variants/integrations-01/view.tsx"
import { Integrations03 } from "./variants/integrations-03/integrations.tsx"
import Integrations03View from "./variants/integrations-03/view.tsx"
import { Integrations05 } from "./variants/integrations-05/integrations.tsx"
import Integrations05View from "./variants/integrations-05/view.tsx"

globalThis.React = React

const mediaResolver = (media) => ({ src: media.url, alt: media.alt })

const integrationsFamily = [
  {
    id: "shadcnui-blocks.integrations-01",
    Component: Integrations01,
    View: Integrations01View,
    cmsLike: integrations01CmsLike,
    sparse: integrationsFamilySparse,
    long: integrationsFamilyLong,
    emptyItems: integrationsFamilyEmptyItems,
    distinctive: /shadow-xs\/3/,
    itemMatch: /PostHog|Mailchimp/,
  },
  {
    id: "shadcnui-blocks.integrations-03",
    Component: Integrations03,
    View: Integrations03View,
    cmsLike: integrationsFamilyCmsLike,
    sparse: integrationsFamilySparse,
    long: integrationsFamilyLong,
    emptyItems: integrationsFamilyEmptyItems,
    distinctive: /border-border\/85/,
    itemMatch: /PostHog/,
  },
  {
    id: "shadcnui-blocks.integrations-05",
    Component: Integrations05,
    View: Integrations05View,
    cmsLike: integrationsFamilyCmsLike,
    sparse: integrationsFamilySparse,
    long: integrationsFamilyLong,
    emptyItems: integrationsFamilyEmptyItems,
    distinctive: /border-dashed bg-muted\/30/,
    itemMatch: /PostHog/,
  },
]

for (const variant of integrationsFamily) {
  test(`${variant.id} public render outputs layout markup`, () => {
    const html = renderToStaticMarkup(React.createElement(variant.Component, {
      ...variant.cmsLike,
      blockIndex: 0,
      mediaResolver,
    }))
    assert.match(html, variant.distinctive)
    assert.match(html, variant.itemMatch)
  })

  test(`${variant.id} view maps block fields and provider attributes`, () => {
    const block = {
      blockType: "logoCloud",
      title: variant.cmsLike.title,
      intro: variant.cmsLike.intro,
      logos: variant.cmsLike.logos,
    }
    const html = renderToStaticMarkup(React.createElement(variant.View, {
      block,
      options: { index: 1, mediaResolver },
    }))
    assert.match(html, new RegExp(`data-provider-variant="${variant.id.replace(".", "\\.")}"`))
    assert.match(html, /PostHog/)
  })
}

test("integrations variants do not use LiteralProviderVariantView", async () => {
  const { readFile } = await import("node:fs/promises")
  for (const variant of integrationsFamily) {
    const upstream = variant.id.replace("shadcnui-blocks.", "")
    const source = await readFile(new URL(`./variants/${upstream}/view.tsx`, import.meta.url), "utf8")
    assert.doesNotMatch(source, /LiteralProviderVariantView/)
  }
})
