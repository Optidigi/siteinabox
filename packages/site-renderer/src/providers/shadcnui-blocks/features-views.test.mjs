import assert from "node:assert/strict"
import test from "node:test"
import * as React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { previewInlineText } from "./typed/fixtures.ts"
import {
  featureFamilyCmsLike,
  featureFamilyEmptyFeatures,
  featureFamilyLong,
  featureFamilySparse,
  featureFamilyWithEyebrow,
  featureItem,
} from "./typed/fixtures/feature-family.ts"
import { Features01 } from "./variants/features-01/features.tsx"
import Features01View from "./variants/features-01/view.tsx"
import { Features02 } from "./variants/features-02/features.tsx"
import Features02View from "./variants/features-02/view.tsx"
import { Features03 } from "./variants/features-03/features.tsx"
import Features03View from "./variants/features-03/view.tsx"
import { Features04 } from "./variants/features-04/features.tsx"
import Features04View from "./variants/features-04/view.tsx"
import { Features05 } from "./variants/features-05/features.tsx"
import Features05View from "./variants/features-05/view.tsx"
import { Features06 } from "./variants/features-06/features.tsx"
import Features06View from "./variants/features-06/view.tsx"
import { Features07 } from "./variants/features-07/features.tsx"
import Features07View from "./variants/features-07/view.tsx"
import { Features08 } from "./variants/features-08/features.tsx"
import Features08View from "./variants/features-08/view.tsx"
import { Features09 } from "./variants/features-09/features.tsx"
import Features09View from "./variants/features-09/view.tsx"
import { Features10 } from "./variants/features-10/features.tsx"
import Features10View from "./variants/features-10/view.tsx"
import { Features11 } from "./variants/features-11/features.tsx"
import Features11View from "./variants/features-11/view.tsx"
import { Features12 } from "./variants/features-12/features.tsx"
import Features12View from "./variants/features-12/view.tsx"
import { Features13 } from "./variants/features-13/features.tsx"
import Features13View from "./variants/features-13/view.tsx"
import { Features14 } from "./variants/features-14/features.tsx"
import Features14View from "./variants/features-14/view.tsx"
import { Features15 } from "./variants/features-15/features.tsx"
import Features15View from "./variants/features-15/view.tsx"
import { Features16 } from "./variants/features-16/features.tsx"
import Features16View from "./variants/features-16/view.tsx"
import { Features17 } from "./variants/features-17/features.tsx"
import Features17View from "./variants/features-17/view.tsx"
import { Features18 } from "./variants/features-18/features.tsx"
import Features18View from "./variants/features-18/view.tsx"

globalThis.React = React

const featuresFamily = [
  {
    id: "shadcnui-blocks.features-01",
    Component: Features01,
    View: Features01View,
    cmsLike: featureFamilyCmsLike,
    sparse: featureFamilySparse,
    long: featureFamilyLong,
    emptyFeatures: featureFamilyEmptyFeatures,
    distinctive: /lg:grid-cols-3/,
  },
  {
    id: "shadcnui-blocks.features-02",
    Component: Features02,
    View: Features02View,
    cmsLike: featureFamilyCmsLike,
    sparse: featureFamilySparse,
    long: featureFamilyLong,
    emptyFeatures: featureFamilyEmptyFeatures,
    distinctive: /aspect-4\/5/,
  },
  {
    id: "shadcnui-blocks.features-03",
    Component: Features03,
    View: Features03View,
    cmsLike: { title: featureFamilyCmsLike.title, features: featureFamilyCmsLike.features },
    sparse: featureFamilySparse,
    long: featureFamilyLong,
    emptyFeatures: { title: featureFamilyCmsLike.title, features: [] },
    distinctive: /md:grid-cols-5/,
  },
  {
    id: "shadcnui-blocks.features-04",
    Component: Features04,
    View: Features04View,
    cmsLike: { title: featureFamilyCmsLike.title, features: featureFamilyCmsLike.features },
    sparse: featureFamilySparse,
    long: featureFamilyLong,
    emptyFeatures: { title: featureFamilyCmsLike.title, features: [] },
    distinctive: /min-h-80|data-slot="accordion"/,
  },
  {
    id: "shadcnui-blocks.features-05",
    Component: Features05,
    View: Features05View,
    cmsLike: featureFamilyCmsLike,
    sparse: featureFamilySparse,
    long: featureFamilyLong,
    emptyFeatures: featureFamilyEmptyFeatures,
    distinctive: /rounded-tl-xl bg-muted/,
  },
  {
    id: "shadcnui-blocks.features-06",
    Component: Features06,
    View: Features06View,
    cmsLike: featureFamilyCmsLike,
    sparse: featureFamilySparse,
    long: featureFamilyLong,
    emptyFeatures: featureFamilyEmptyFeatures,
    distinctive: /from-indigo-400 to-orange-300/,
  },
  {
    id: "shadcnui-blocks.features-07",
    Component: Features07,
    View: Features07View,
    cmsLike: featureFamilyCmsLike,
    sparse: featureFamilySparse,
    long: featureFamilyLong,
    emptyFeatures: featureFamilyEmptyFeatures,
    distinctive: /aspect-square h-24/,
  },
  {
    id: "shadcnui-blocks.features-08",
    Component: Features08,
    View: Features08View,
    cmsLike: featureFamilyCmsLike,
    sparse: featureFamilySparse,
    long: featureFamilyLong,
    emptyFeatures: featureFamilyEmptyFeatures,
    distinctive: /bg-primary\/5/,
  },
  {
    id: "shadcnui-blocks.features-09",
    Component: Features09,
    View: Features09View,
    cmsLike: featureFamilyCmsLike,
    sparse: featureFamilySparse,
    long: featureFamilyLong,
    emptyFeatures: featureFamilyEmptyFeatures,
    distinctive: /border-border\/80 bg-card p-6/,
  },
  {
    id: "shadcnui-blocks.features-10",
    Component: Features10,
    View: Features10View,
    cmsLike: featureFamilyCmsLike,
    sparse: featureFamilySparse,
    long: featureFamilyLong,
    emptyFeatures: featureFamilyEmptyFeatures,
    distinctive: /font-satoshi text-3xl/,
  },
  {
    id: "shadcnui-blocks.features-11",
    Component: Features11,
    View: Features11View,
    cmsLike: featureFamilyCmsLike,
    sparse: featureFamilySparse,
    long: featureFamilyLong,
    emptyFeatures: featureFamilyEmptyFeatures,
    distinctive: /bg-muted\/75 p-1/,
  },
  {
    id: "shadcnui-blocks.features-12",
    Component: Features12,
    View: Features12View,
    cmsLike: featureFamilyWithEyebrow,
    sparse: featureFamilySparse,
    long: featureFamilyLong,
    emptyFeatures: { ...featureFamilyWithEyebrow, features: [] },
    distinctive: /bg-size-\[10px_10px\]/,
  },
  {
    id: "shadcnui-blocks.features-13",
    Component: Features13,
    View: Features13View,
    cmsLike: featureFamilyCmsLike,
    sparse: featureFamilySparse,
    long: featureFamilyLong,
    emptyFeatures: featureFamilyEmptyFeatures,
    distinctive: /dark:border-card-foreground\/7/,
  },
  {
    id: "shadcnui-blocks.features-14",
    Component: Features14,
    View: Features14View,
    cmsLike: featureFamilyWithEyebrow,
    sparse: featureFamilySparse,
    long: featureFamilyLong,
    emptyFeatures: { ...featureFamilyWithEyebrow, features: [] },
    distinctive: /why-choose-us/,
  },
  {
    id: "shadcnui-blocks.features-15",
    Component: Features15,
    View: Features15View,
    cmsLike: featureFamilyCmsLike,
    sparse: featureFamilySparse,
    long: featureFamilyLong,
    emptyFeatures: featureFamilyEmptyFeatures,
    distinctive: /mask-b-from-70%/,
  },
  {
    id: "shadcnui-blocks.features-16",
    Component: Features16,
    View: Features16View,
    cmsLike: featureFamilyCmsLike,
    sparse: featureFamilySparse,
    long: featureFamilyLong,
    emptyFeatures: featureFamilyEmptyFeatures,
    distinctive: /mask-t-from-50%/,
  },
  {
    id: "shadcnui-blocks.features-17",
    Component: Features17,
    View: Features17View,
    cmsLike: featureFamilyCmsLike,
    sparse: featureFamilySparse,
    long: featureFamilyLong,
    emptyFeatures: featureFamilyEmptyFeatures,
    distinctive: /font-mono/,
  },
  {
    id: "shadcnui-blocks.features-18",
    Component: Features18,
    View: Features18View,
    cmsLike: featureFamilyWithEyebrow,
    sparse: featureFamilySparse,
    long: featureFamilyLong,
    emptyFeatures: { ...featureFamilyWithEyebrow, features: [] },
    distinctive: /border-dashed/,
  },
]

for (const variant of featuresFamily) {
  test(`${variant.id} public render outputs layout markup with rich text`, () => {
    const html = renderToStaticMarkup(React.createElement(variant.Component, {
      ...variant.cmsLike,
      blockIndex: 0,
    }))
    assert.match(html, variant.distinctive)
    assert.match(html, /Product Features|Only feature|Security you can trust|Features/)
    assert.match(html, /Fast setup|Only feature|Real-time alerts/)
  })

  test(`${variant.id} sparse content omits optional title when absent`, () => {
    const html = renderToStaticMarkup(React.createElement(variant.Component, {
      ...variant.sparse,
      blockIndex: 0,
    }))
    assert.doesNotMatch(html, /<h2[^>]*>Product Features</)
    assert.match(html, /Only feature/)
  })

  test(`${variant.id} empty features renders without item rows`, () => {
    const html = renderToStaticMarkup(React.createElement(variant.Component, {
      ...variant.emptyFeatures,
      blockIndex: 0,
    }))
    assert.doesNotMatch(html, /Fast setup/)
  })

  test(`${variant.id} long title and description does not throw`, () => {
    assert.doesNotThrow(() => renderToStaticMarkup(React.createElement(variant.Component, {
      ...variant.long,
      blockIndex: 0,
    })))
  })

  test(`${variant.id} view maps block to typed component with provider attributes`, () => {
    const block = {
      blockType: "featureList",
      title: previewInlineText("Platform highlights"),
      intro: previewInlineText("What sets us apart."),
      features: [featureItem("Shipping", "Fast delivery worldwide.")],
    }
    const html = renderToStaticMarkup(React.createElement(variant.View, {
      block,
      options: { index: 2 },
    }))
    assert.match(html, new RegExp(`data-provider-variant="${variant.id.replace(".", "\\.")}"`))
    assert.match(html, /data-block-index="2"/)
    assert.match(html, />Platform highlights</)
    assert.match(html, /Shipping/)
  })
}

test("features-01 editSlots use itemIndex for nested feature fields", () => {
  const called = []
  renderToStaticMarkup(React.createElement(Features01, {
    title: featureFamilyCmsLike.title,
    intro: featureFamilyCmsLike.intro,
    features: featureFamilyCmsLike.features,
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
      "featureList.title:title",
      "featureList.intro:intro",
      "featureList.features.title:features:0:title",
      "featureList.features.description:features:0:description",
      "featureList.features.title:features:1:title",
      "featureList.features.description:features:1:description",
      "featureList.features.title:features:2:title",
      "featureList.features.description:features:2:description",
    ]),
  )
})
