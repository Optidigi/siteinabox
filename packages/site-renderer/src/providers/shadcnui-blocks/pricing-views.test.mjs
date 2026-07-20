import assert from "node:assert/strict"
import test from "node:test"
import * as React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import {
  pricing01CmsLike,
  pricing01EmptyPlans,
  pricing01Long,
  pricing01Sparse,
} from "./typed/fixtures/pricing-01.ts"
import {
  pricing03FamilyCmsLike,
  pricing07FamilyCmsLike,
  pricing08FamilyCmsLike,
  pricing09FamilyCmsLike,
  pricing10FamilyCmsLike,
  pricingFamilyCmsLike,
  pricingFamilyEmptyPlans,
  pricingFamilyLong,
  pricingFamilySparse,
} from "./typed/fixtures/pricing-family.ts"
import { Pricing01 } from "./variants/pricing-01/pricing.tsx"
import Pricing01View from "./variants/pricing-01/view.tsx"
import { Pricing02 } from "./variants/pricing-02/pricing.tsx"
import Pricing02View from "./variants/pricing-02/view.tsx"
import { Pricing03 } from "./variants/pricing-03/pricing.tsx"
import Pricing03View from "./variants/pricing-03/view.tsx"
import { Pricing04 } from "./variants/pricing-04/pricing.tsx"
import Pricing04View from "./variants/pricing-04/view.tsx"
import { Pricing05 } from "./variants/pricing-05/pricing.tsx"
import Pricing05View from "./variants/pricing-05/view.tsx"
import { Pricing06 } from "./variants/pricing-06/pricing.tsx"
import Pricing06View from "./variants/pricing-06/view.tsx"
import { Pricing07 } from "./variants/pricing-07/pricing.tsx"
import Pricing07View from "./variants/pricing-07/view.tsx"
import { Pricing08 } from "./variants/pricing-08/pricing.tsx"
import Pricing08View from "./variants/pricing-08/view.tsx"
import { Pricing09 } from "./variants/pricing-09/pricing.tsx"
import Pricing09View from "./variants/pricing-09/view.tsx"
import { Pricing10 } from "./variants/pricing-10/pricing.tsx"
import Pricing10View from "./variants/pricing-10/view.tsx"

globalThis.React = React

const pricingFamily = [
  {
    id: "shadcnui-blocks.pricing-01",
    Component: Pricing01,
    View: Pricing01View,
    cmsLike: pricing01CmsLike,
    sparse: pricing01Sparse,
    long: pricing01Long,
    emptyItems: pricing01EmptyPlans,
    maxItems: 3,
    distinctive: /max-w-\(--breakpoint-lg\)/,
  },
  {
    id: "shadcnui-blocks.pricing-02",
    Component: Pricing02,
    View: Pricing02View,
    cmsLike: pricingFamilyCmsLike,
    sparse: pricingFamilySparse,
    long: pricingFamilyLong,
    emptyItems: pricingFamilyEmptyPlans,
    maxItems: 3,
    distinctive: /border-2 border-primary py-10/,
  },
  {
    id: "shadcnui-blocks.pricing-03",
    Component: Pricing03,
    View: Pricing03View,
    cmsLike: pricing03FamilyCmsLike,
    sparse: pricingFamilySparse,
    long: pricingFamilyLong,
    emptyItems: pricingFamilyEmptyPlans,
    maxItems: 3,
    distinctive: /Yearly \(Save 20%\)/,
  },
  {
    id: "shadcnui-blocks.pricing-04",
    Component: Pricing04,
    View: Pricing04View,
    cmsLike: pricing03FamilyCmsLike,
    sparse: pricingFamilySparse,
    long: pricingFamilyLong,
    emptyItems: pricingFamilyEmptyPlans,
    maxItems: 3,
    distinctive: /rounded-full text-base/,
  },
  {
    id: "shadcnui-blocks.pricing-05",
    Component: Pricing05,
    View: Pricing05View,
    cmsLike: pricingFamilyCmsLike,
    sparse: pricingFamilySparse,
    long: pricingFamilyLong,
    emptyItems: pricingFamilyEmptyPlans,
    maxItems: 3,
    distinctive: /ring-1 ring-primary ring-inset/,
  },
  {
    id: "shadcnui-blocks.pricing-06",
    Component: Pricing06,
    View: Pricing06View,
    cmsLike: pricingFamilyCmsLike,
    sparse: pricingFamilySparse,
    long: pricingFamilyLong,
    emptyItems: pricingFamilyEmptyPlans,
    maxItems: 3,
    distinctive: /rounded-xl! border-2 border-primary/,
  },
  {
    id: "shadcnui-blocks.pricing-07",
    Component: Pricing07,
    View: Pricing07View,
    cmsLike: pricing07FamilyCmsLike,
    sparse: pricingFamilySparse,
    long: pricingFamilyLong,
    emptyItems: pricingFamilyEmptyPlans,
    maxItems: 3,
    distinctive: /max-w-6xl flex-col gap-12/,
  },
  {
    id: "shadcnui-blocks.pricing-08",
    Component: Pricing08,
    View: Pricing08View,
    cmsLike: pricing08FamilyCmsLike,
    sparse: pricingFamilySparse,
    long: pricingFamilyLong,
    emptyItems: pricingFamilyEmptyPlans,
    maxItems: 3,
    distinctive: /one-time payment/,
  },
  {
    id: "shadcnui-blocks.pricing-09",
    Component: Pricing09,
    View: Pricing09View,
    cmsLike: pricing09FamilyCmsLike,
    sparse: pricingFamilySparse,
    long: pricingFamilyLong,
    emptyItems: pricingFamilyEmptyPlans,
    maxItems: 3,
    distinctive: /--provider-grid-line/,
  },
  {
    id: "shadcnui-blocks.pricing-10",
    Component: Pricing10,
    View: Pricing10View,
    cmsLike: pricing10FamilyCmsLike,
    sparse: pricingFamilySparse,
    long: pricingFamilyLong,
    emptyItems: pricingFamilyEmptyPlans,
    maxItems: 3,
    distinctive: /border-dashed/,
  },
]

for (const variant of pricingFamily) {
  test(`${variant.id} literal renders distinctive markup`, () => {
    const html = renderToStaticMarkup(React.createElement(variant.Component, {
      ...variant.cmsLike,
      blockIndex: 0,
    }))
    assert.match(html, variant.distinctive)
  })

  test(`${variant.id} sparse plans still render`, () => {
    const html = renderToStaticMarkup(React.createElement(variant.Component, {
      ...variant.sparse,
      blockIndex: 0,
    }))
    assert.ok(html.length > 0)
  })

  test(`${variant.id} long content renders without throwing`, () => {
    const html = renderToStaticMarkup(React.createElement(variant.Component, {
      ...variant.long,
      blockIndex: 0,
    }))
    assert.ok(html.length > 0)
  })

  test(`${variant.id} empty plans render header-only or empty grid`, () => {
    const html = renderToStaticMarkup(React.createElement(variant.Component, {
      ...variant.emptyItems,
      blockIndex: 0,
    }))
    assert.ok(html.length > 0)
  })

  test(`${variant.id} view maps block fields and provider attributes`, () => {
    const block = {
      blockType: "pricing",
      ...variant.cmsLike,
    }
    const html = renderToStaticMarkup(React.createElement(variant.View, {
      block,
      options: { index: 2 },
    }))
    assert.match(html, new RegExp(`data-provider-variant="${variant.id.replace(".", "\\.")}"`))
    assert.match(html, /data-block-index="2"/)
    assert.match(html, />Starter|Advanced|Basic|Pro</)
  })

  if (variant.maxItems) {
    test(`${variant.id} respects static plan capacity`, () => {
      const paddedPlans = [...variant.cmsLike.plans]
      while (paddedPlans.length < variant.maxItems) {
        paddedPlans.push({
          ...variant.cmsLike.plans[0],
          title: variant.cmsLike.plans[0].title,
        })
      }
      const overflow = {
        ...variant.cmsLike,
        plans: [
          ...paddedPlans,
          {
            ...variant.cmsLike.plans[0],
            title: { t: "root", variant: "inline", children: [{ t: "text", v: "Overflow plan" }] },
          },
        ],
      }
      const html = renderToStaticMarkup(React.createElement(variant.Component, {
        ...overflow,
        blockIndex: 0,
      }))
      assert.doesNotMatch(html, /Overflow plan/)
    })
  }
}

test("pricing-01 editSlots use itemIndex/subField for nested plan fields", () => {
  const called = []
  const html = renderToStaticMarkup(React.createElement(Pricing01, {
    title: pricing01CmsLike.title,
    intro: pricing01CmsLike.intro,
    plans: pricing01CmsLike.plans,
    blockIndex: 3,
    editSlots: {
      renderRichText: ({ elementPath }) => {
        called.push(`rich:${elementPath.field}:${elementPath.itemIndex ?? ""}:${elementPath.subField ?? ""}`)
        return React.createElement("span", { "data-edit-rich": `${elementPath.field}:${elementPath.itemIndex}:${elementPath.subField}` })
      },
      renderText: ({ elementPath }) => {
        called.push(`text:${elementPath.field}:${elementPath.itemIndex}:${elementPath.subField}`)
        return React.createElement("span", {
          "data-edit-text": `${elementPath.field}:${elementPath.itemIndex}:${elementPath.subField}`,
        })
      },
      renderCta: ({ elementPath }) => {
        called.push(`cta:${elementPath.field}:${elementPath.itemIndex}:${elementPath.subField}`)
        return React.createElement("span", {
          "data-edit-cta": `${elementPath.field}:${elementPath.itemIndex}:${elementPath.subField}`,
        })
      },
    },
  }))
  assert.deepEqual(
    new Set(called),
    new Set([
      "rich:title::",
      "rich:intro::",
      "rich:plans:0:title",
      "rich:plans:1:title",
      "text:plans:0:price",
      "text:plans:1:price",
      "rich:plans:0:description",
      "rich:plans:1:description",
      "rich:plans:0:features.0.label",
      "rich:plans:0:features.1.label",
      "rich:plans:0:features.2.label",
      "rich:plans:0:features.3.label",
      "rich:plans:0:features.4.label",
      "rich:plans:1:features.0.label",
      "rich:plans:1:features.1.label",
      "rich:plans:1:features.2.label",
      "rich:plans:1:features.3.label",
      "rich:plans:1:features.4.label",
      "cta:plans:0:cta",
      "cta:plans:1:cta",
    ]),
  )
  assert.match(html, /data-edit-text="plans:0:price"/)
  assert.match(html, /data-edit-rich="plans:0:features.0.label"/)
  assert.match(html, /data-edit-cta="plans:1:cta"/)
})
