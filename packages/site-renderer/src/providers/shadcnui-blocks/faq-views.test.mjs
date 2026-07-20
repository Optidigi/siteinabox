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
import {
  faqFamilyCmsLike,
  faqFamilyEmptyItems,
  faqFamilyLong,
  faqFamilySparse,
} from "./typed/fixtures/faq-family.ts"
import { Faq01 } from "./variants/faq-01/faq.tsx"
import Faq01View from "./variants/faq-01/view.tsx"
import { Faq02 } from "./variants/faq-02/faq.tsx"
import Faq02View from "./variants/faq-02/view.tsx"
import { Faq03 } from "./variants/faq-03/faq.tsx"
import Faq03View from "./variants/faq-03/view.tsx"
import { Faq04 } from "./variants/faq-04/faq.tsx"
import Faq04View from "./variants/faq-04/view.tsx"
import { Faq05 } from "./variants/faq-05/faq.tsx"
import Faq05View from "./variants/faq-05/view.tsx"
import { Faq06 } from "./variants/faq-06/faq.tsx"
import Faq06View from "./variants/faq-06/view.tsx"
import { Faq07 } from "./variants/faq-07/faq.tsx"
import Faq07View from "./variants/faq-07/view.tsx"
import { Faq08 } from "./variants/faq-08/faq.tsx"
import Faq08View from "./variants/faq-08/view.tsx"
import { Faq09 } from "./variants/faq-09/faq.tsx"
import Faq09View from "./variants/faq-09/view.tsx"
import { Faq10 } from "./variants/faq-10/faq.tsx"
import Faq10View from "./variants/faq-10/view.tsx"
import { Faq11 } from "./variants/faq-11/faq.tsx"
import Faq11View from "./variants/faq-11/view.tsx"
import { Faq12 } from "./variants/faq-12/faq.tsx"
import Faq12View from "./variants/faq-12/view.tsx"
import { Faq13 } from "./variants/faq-13/faq.tsx"
import Faq13View from "./variants/faq-13/view.tsx"
import { Faq14 } from "./variants/faq-14/faq.tsx"
import Faq14View from "./variants/faq-14/view.tsx"

globalThis.React = React

const faqFamily = [
  {
    id: "shadcnui-blocks.faq-01",
    Component: Faq01,
    View: Faq01View,
    cmsLike: faq01CmsLike,
    sparse: faq01Sparse,
    long: faq01Long,
    emptyItems: faq01EmptyItems,
    distinctive: { markup: /max-w-xl/, accordionDefault: true },
    showsAnswersInSsr: true,
  },
  {
    id: "shadcnui-blocks.faq-02",
    Component: Faq02,
    View: Faq02View,
    cmsLike: faqFamilyCmsLike,
    sparse: faqFamilySparse,
    long: faqFamilyLong,
    emptyItems: faqFamilyEmptyItems,
    distinctive: { markup: /md:flex-row/, accordionDefault: true },
    showsAnswersInSsr: true,
  },
  {
    id: "shadcnui-blocks.faq-03",
    Component: Faq03,
    View: Faq03View,
    cmsLike: faqFamilyCmsLike,
    sparse: faqFamilySparse,
    long: faqFamilyLong,
    emptyItems: faqFamilyEmptyItems,
    distinctive: { markup: /md:grid-cols-2/ },
    showsAnswersInSsr: false,
  },
  {
    id: "shadcnui-blocks.faq-04",
    Component: Faq04,
    View: Faq04View,
    cmsLike: faqFamilyCmsLike,
    sparse: faqFamilySparse,
    long: faqFamilyLong,
    emptyItems: faqFamilyEmptyItems,
    distinctive: { markup: /min-h-screen/ },
    showsAnswersInSsr: true,
  },
  {
    id: "shadcnui-blocks.faq-05",
    Component: Faq05,
    View: Faq05View,
    cmsLike: faqFamilyCmsLike,
    sparse: faqFamilySparse,
    long: faqFamilyLong,
    emptyItems: faqFamilyEmptyItems,
    distinctive: { markup: /gap-px overflow-hidden/ },
    showsAnswersInSsr: true,
  },
  {
    id: "shadcnui-blocks.faq-06",
    Component: Faq06,
    View: Faq06View,
    cmsLike: faqFamilyCmsLike,
    sparse: faqFamilySparse,
    long: faqFamilyLong,
    emptyItems: faqFamilyEmptyItems,
    distinctive: { markup: /rounded-xl border border-border\/65 bg-muted p-1/, accordionDefault: true },
    showsAnswersInSsr: true,
  },
  {
    id: "shadcnui-blocks.faq-07",
    Component: Faq07,
    View: Faq07View,
    cmsLike: faqFamilyCmsLike,
    sparse: faqFamilySparse,
    long: faqFamilyLong,
    emptyItems: faqFamilyEmptyItems,
    distinctive: { markup: /space-y-4 sm:mt-10/, accordionDefault: true },
    showsAnswersInSsr: true,
  },
  {
    id: "shadcnui-blocks.faq-08",
    Component: Faq08,
    View: Faq08View,
    cmsLike: faqFamilyCmsLike,
    sparse: faqFamilySparse,
    long: faqFamilyLong,
    emptyItems: faqFamilyEmptyItems,
    distinctive: { markup: /hidden sm:inline-block/ },
    showsAnswersInSsr: false,
  },
  {
    id: "shadcnui-blocks.faq-09",
    Component: Faq09,
    View: Faq09View,
    cmsLike: faqFamilyCmsLike,
    sparse: faqFamilySparse,
    long: faqFamilyLong,
    emptyItems: faqFamilyEmptyItems,
    distinctive: { markup: /lucide-package/ },
    showsAnswersInSsr: false,
  },
  {
    id: "shadcnui-blocks.faq-10",
    Component: Faq10,
    View: Faq10View,
    cmsLike: faqFamilyCmsLike,
    sparse: faqFamilySparse,
    long: faqFamilyLong,
    emptyItems: faqFamilyEmptyItems,
    distinctive: { markup: /border-primary\/20 bg-primary\/10/ },
    showsAnswersInSsr: false,
  },
  {
    id: "shadcnui-blocks.faq-11",
    Component: Faq11,
    View: Faq11View,
    cmsLike: faqFamilyCmsLike,
    sparse: faqFamilySparse,
    long: faqFamilyLong,
    emptyItems: faqFamilyEmptyItems,
    distinctive: { markup: /Orders &amp; Shipping/ },
    showsAnswersInSsr: false,
  },
  {
    id: "shadcnui-blocks.faq-12",
    Component: Faq12,
    View: Faq12View,
    cmsLike: faqFamilyCmsLike,
    sparse: faqFamilySparse,
    long: faqFamilyLong,
    emptyItems: faqFamilyEmptyItems,
    distinctive: { markup: /text-primary/ },
    showsAnswersInSsr: true,
  },
  {
    id: "shadcnui-blocks.faq-13",
    Component: Faq13,
    View: Faq13View,
    cmsLike: faqFamilyCmsLike,
    sparse: faqFamilySparse,
    long: faqFamilyLong,
    emptyItems: faqFamilyEmptyItems,
    distinctive: { markup: /font-mono text-\[11px\]/ },
    showsAnswersInSsr: true,
  },
  {
    id: "shadcnui-blocks.faq-14",
    Component: Faq14,
    View: Faq14View,
    cmsLike: faqFamilyCmsLike,
    sparse: faqFamilySparse,
    long: faqFamilyLong,
    emptyItems: faqFamilyEmptyItems,
    distinctive: { markup: /bg-muted\/35/, accordionDefault: true },
    showsAnswersInSsr: true,
  },
]

for (const variant of faqFamily) {
  test(`${variant.id} public render outputs accordion or layout markup with rich text`, () => {
    const html = renderToStaticMarkup(React.createElement(variant.Component, {
      ...variant.cmsLike,
      blockIndex: 0,
    }))
    assert.match(html, variant.distinctive.markup)
    if (variant.id === "shadcnui-blocks.faq-01") {
      assert.match(html, />Questions &amp; Answers</)
    } else {
      assert.match(html, />Frequently Asked Questions</)
    }
    assert.match(html, /What is your return policy\?|Only question\?|Shipping\?/)
    if (variant.showsAnswersInSsr) {
      assert.match(html, /You can return unused items within 30 days\.|Only answer\.|We ship worldwide\./)
    }
    assert.match(html, /How do I track my order\?|Only question\?|Shipping\?/)
  })

  test(`${variant.id} sparse content omits optional title`, () => {
    const html = renderToStaticMarkup(React.createElement(variant.Component, {
      ...variant.sparse,
      blockIndex: 0,
    }))
    assert.doesNotMatch(html, /<h2/)
    assert.match(html, /Only question\?/)
    if (variant.showsAnswersInSsr) {
      assert.match(html, /Only answer\./)
    }
  })

  test(`${variant.id} empty items renders without item rows`, () => {
    const html = renderToStaticMarkup(React.createElement(variant.Component, {
      ...variant.emptyItems,
      blockIndex: 0,
    }))
    assert.doesNotMatch(html, /What is your return policy\?/)
  })

  test(`${variant.id} long question and answer does not throw`, () => {
    assert.doesNotThrow(() => renderToStaticMarkup(React.createElement(variant.Component, {
      ...variant.long,
      blockIndex: 0,
    })))
  })

  test(`${variant.id} view maps block to typed component with provider attributes`, () => {
    const block = {
      blockType: "faq",
      title: { t: "root", variant: "inline", children: [{ t: "text", v: "Help center" }] },
      ...(variant.cmsLike.intro ? {
        intro: { t: "root", variant: "inline", children: [{ t: "text", v: "Answers here." }] },
      } : {}),
      items: [faqItem("Shipping?", "We ship worldwide.")],
    }
    const html = renderToStaticMarkup(React.createElement(variant.View, {
      block,
      options: { index: 2 },
    }))
    assert.match(html, new RegExp(`data-provider-variant="${variant.id.replace(".", "\\.")}"`))
    assert.match(html, /data-block-index="2"/)
    assert.match(html, />Help center</)
    assert.match(html, /Shipping\?/)
    if (variant.showsAnswersInSsr) {
      assert.match(html, /We ship worldwide\./)
    }
  })

  if (variant.distinctive.accordionDefault) {
    test(`${variant.id} accordion defaults to opening the first item`, () => {
      const html = renderToStaticMarkup(React.createElement(variant.Component, {
        items: variant.cmsLike.items,
        blockIndex: 0,
      }))
      const items = [...html.matchAll(/data-slot="accordion-item"/g)]
      if (items.length < 2) return
      const firstItem = html.slice(items[0].index, items[1].index)
      const secondItem = html.slice(items[1].index)
      assert.match(firstItem, /data-state="open"/)
      assert.match(secondItem, /data-state="closed"/)
      assert.match(html, /aria-expanded="true"/)
      assert.match(html, /role="region"/)
    })
  }
}

test("faq-01 editSlots use itemIndex for nested question and answer", () => {
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

test("faq-04 editSlots use itemIndex for nested question and answer", () => {
  const called = []
  renderToStaticMarkup(React.createElement(Faq04, {
    title: faqFamilyCmsLike.title,
    intro: faqFamilyCmsLike.intro,
    items: faqFamilyCmsLike.items,
    blockIndex: 4,
    editSlots: {
      renderRichText: ({ elementPath, name }) => {
        const suffix = elementPath.subField
          ? `${elementPath.field}:${elementPath.itemIndex}:${elementPath.subField}`
          : elementPath.field
        called.push(`${name}:${suffix}`)
        return React.createElement("span", null, suffix)
      },
    },
  }))
  assert.deepEqual(
    new Set(called),
    new Set([
      "faq.title:title",
      "faq.intro:intro",
      "faq.items.question:items:0:question",
      "faq.items.answer:items:0:answer",
      "faq.items.question:items:1:question",
      "faq.items.answer:items:1:answer",
    ]),
  )
})
