import assert from "node:assert/strict"
import test from "node:test"
import * as React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import {
  faq01CmsLike,
  faq01EmptyItems,
  faq01Long,
  faq01Sparse,
  faqItem,
} from "./typed/fixtures/faq-01.ts"
import { Faq01 } from "./variants/faq-01/faq.tsx"
import View from "./variants/faq-01/view.tsx"

globalThis.React = React

test("public render outputs accordion markup with rich text", () => {
  const html = renderToStaticMarkup(React.createElement(Faq01, {
    ...faq01CmsLike,
    blockIndex: 0,
  }))
  assert.match(html, /data-slot="accordion"/)
  assert.match(html, /data-slot="accordion-item"/)
  assert.match(html, /data-slot="accordion-trigger"/)
  assert.match(html, /data-slot="accordion-content"/)
  assert.match(html, />Questions &amp; Answers</)
  assert.match(html, />What is your return policy\?</)
  assert.match(html, />You can return unused items within 30 days\./)
  assert.match(html, />How do I track my order\?</)
})

test("sparse content omits optional title", () => {
  const html = renderToStaticMarkup(React.createElement(Faq01, {
    ...faq01Sparse,
    blockIndex: 0,
  }))
  assert.doesNotMatch(html, /<h2/)
  assert.match(html, />Only question\?</)
  assert.match(html, />Only answer\./)
})

test("empty items renders accordion shell without items", () => {
  const html = renderToStaticMarkup(React.createElement(Faq01, {
    ...faq01EmptyItems,
    blockIndex: 0,
  }))
  assert.match(html, /data-slot="accordion"/)
  assert.doesNotMatch(html, /data-slot="accordion-item"/)
})

test("long question and answer does not throw", () => {
  assert.doesNotThrow(() => renderToStaticMarkup(React.createElement(Faq01, {
    ...faq01Long,
    blockIndex: 0,
  })))
})

test("editSlots use itemIndex for nested question and answer", () => {
  const called = []
  const html = renderToStaticMarkup(React.createElement(Faq01, {
    title: faq01CmsLike.title,
    items: faq01CmsLike.items,
    blockIndex: 3,
    editSlots: {
      renderRichText: ({ elementPath, name }) => {
        const suffix = elementPath.subField
          ? `${elementPath.field}:${elementPath.itemIndex}:${elementPath.subField}`
          : elementPath.field
        called.push(`${name}:${suffix}`)
        return React.createElement("span", { "data-edit-rich": suffix })
      },
    },
  }))
  assert.deepEqual(
    new Set(called),
    new Set([
      "faq.title:title",
      "faq.items.question:items:0:question",
      "faq.items.answer:items:0:answer",
      "faq.items.question:items:1:question",
      "faq.items.answer:items:1:answer",
    ]),
  )
  assert.match(html, /data-edit-rich="title"/)
  assert.match(html, /data-edit-rich="items:0:question"/)
  assert.match(html, /data-edit-rich="items:0:answer"/)
  assert.match(html, /data-edit-rich="items:1:question"/)
})

test("accordion defaults to opening the first item", () => {
  const html = renderToStaticMarkup(React.createElement(Faq01, {
    items: faq01CmsLike.items,
    blockIndex: 0,
  }))
  const items = [...html.matchAll(/data-slot="accordion-item"/g)]
  assert.equal(items.length, 2)
  const firstItem = html.slice(items[0].index, items[1].index)
  const secondItem = html.slice(items[1].index)
  assert.match(firstItem, /data-state="open"/)
  assert.match(secondItem, /data-state="closed"/)
  assert.match(html, /aria-expanded="true"/)
  assert.match(html, /role="region"/)
})

test("view maps block to typed component with provider attributes", () => {
  const html = renderToStaticMarkup(React.createElement(View, {
    block: {
      blockType: "faq",
      title: { t: "root", variant: "inline", children: [{ t: "text", v: "Help center" }] },
      items: [faqItem("Shipping?", "We ship worldwide.")],
    },
    options: { index: 2 },
  }))
  assert.match(html, /data-provider-variant="shadcnui-blocks\.faq-01"/)
  assert.match(html, /data-block-index="2"/)
  assert.match(html, />Help center</)
  assert.match(html, />Shipping\?</)
  assert.match(html, />We ship worldwide\./)
})
