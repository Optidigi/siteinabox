import assert from "node:assert/strict"
import test from "node:test"
import * as React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import {
  cta01CmsLike,
  cta01Long,
  cta01Sparse,
} from "./typed/fixtures/cta-01.ts"
import { Cta01 } from "./variants/cta-01/cta.tsx"
import View from "./variants/cta-01/view.tsx"

globalThis.React = React

test("public render outputs rich text and primary link", () => {
  const html = renderToStaticMarkup(React.createElement(Cta01, {
    ...cta01CmsLike,
    blockIndex: 0,
  }))
  assert.match(html, />Start now</)
  assert.match(html, />We respond quickly\./)
  assert.match(html, /href="mailto:hello@example\.test"/)
  assert.match(html, />Email us</)
})

test("sparse content omits optional description and primary", () => {
  const html = renderToStaticMarkup(React.createElement(Cta01, {
    ...cta01Sparse,
    blockIndex: 0,
  }))
  assert.match(html, />Headline only</)
  assert.doesNotMatch(html, /text-muted-foreground/)
  assert.doesNotMatch(html, /<a /)
})

test("missing primary hides CTA button", () => {
  const html = renderToStaticMarkup(React.createElement(Cta01, {
    headline: cta01Sparse.headline,
    description: cta01CmsLike.description,
    primary: { label: "", href: "/nowhere" },
    blockIndex: 0,
  }))
  assert.doesNotMatch(html, /<a /)
  assert.doesNotMatch(html, /mt-8/)
})

test("long headline does not throw", () => {
  assert.doesNotThrow(() => renderToStaticMarkup(React.createElement(Cta01, {
    ...cta01Long,
    blockIndex: 0,
  })))
})

test("editSlots invoked for headline, description, and primary", () => {
  const called = []
  const html = renderToStaticMarkup(React.createElement(Cta01, {
    headline: cta01CmsLike.headline,
    description: cta01CmsLike.description,
    primary: { label: "Click", href: "/click" },
    blockIndex: 3,
    editSlots: {
      renderRichText: ({ elementPath }) => {
        called.push(`rich:${elementPath.field}`)
        return React.createElement("span", { "data-edit-rich": elementPath.field })
      },
      renderCta: ({ elementPath }) => {
        called.push(`cta:${elementPath.field}`)
        return React.createElement("a", { "data-edit-cta": elementPath.field, href: "#" }, "cta")
      },
    },
  }))
  assert.deepEqual(new Set(called), new Set(["rich:headline", "rich:description", "cta:primary"]))
  assert.match(html, /data-edit-rich="headline"/)
  assert.match(html, /data-edit-rich="description"/)
  assert.match(html, /data-edit-cta="primary"/)
})

test("view maps block to typed component with provider attributes", () => {
  const html = renderToStaticMarkup(React.createElement(View, {
    block: {
      blockType: "cta",
      headline: { t: "root", variant: "inline", children: [{ t: "text", v: "Ready to start?" }] },
      description: { t: "root", variant: "block", children: [{ t: "paragraph", children: [{ t: "text", v: "Send a message." }] }] },
      primary: { label: "Email", href: "mailto:hello@example.test" },
    },
    options: { index: 2 },
  }))
  assert.match(html, /data-provider-variant="shadcnui-blocks\.cta-01"/)
  assert.match(html, /data-block-index="2"/)
  assert.match(html, />Ready to start\?</)
  assert.match(html, />Send a message\./)
  assert.match(html, /href="mailto:hello@example\.test"/)
})
