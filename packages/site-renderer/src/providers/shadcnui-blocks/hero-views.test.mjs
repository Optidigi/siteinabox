import assert from "node:assert/strict"
import test from "node:test"
import * as React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { previewInlineText } from "./typed/fixtures.ts"
import {
  hero08FamilyCmsLike,
  hero08FamilySparse,
  heroFamilyCmsLike,
  heroFamilyLong,
  heroFamilySecondaryOnly,
  heroFamilySparse,
  heroFamilyWithImage,
} from "./typed/fixtures/hero-family.ts"
import { Hero01 } from "./variants/hero-01/hero.tsx"
import Hero01View from "./variants/hero-01/view.tsx"
import { Hero02 } from "./variants/hero-02/hero.tsx"
import Hero02View from "./variants/hero-02/view.tsx"
import { Hero03 } from "./variants/hero-03/hero.tsx"
import Hero03View from "./variants/hero-03/view.tsx"
import { Hero04 } from "./variants/hero-04/hero.tsx"
import Hero04View from "./variants/hero-04/view.tsx"
import { Hero05 } from "./variants/hero-05/hero.tsx"
import Hero05View from "./variants/hero-05/view.tsx"
import { Hero06 } from "./variants/hero-06/hero.tsx"
import Hero06View from "./variants/hero-06/view.tsx"
import { Hero07 } from "./variants/hero-07/hero.tsx"
import Hero07View from "./variants/hero-07/view.tsx"
import { Hero08 } from "./variants/hero-08/hero.tsx"
import Hero08View from "./variants/hero-08/view.tsx"

globalThis.React = React

const heroFamily = [
  {
    id: "shadcnui-blocks.hero-01",
    Component: Hero01,
    View: Hero01View,
    cmsLike: heroFamilyCmsLike,
    sparse: heroFamilySparse,
    long: heroFamilyLong,
    secondaryOnly: heroFamilySecondaryOnly,
    distinctive: /paint0_linear_0_1/,
    withImage: false,
  },
  {
    id: "shadcnui-blocks.hero-02",
    Component: Hero02,
    View: Hero02View,
    cmsLike: heroFamilyWithImage,
    sparse: heroFamilySparse,
    long: heroFamilyLong,
    secondaryOnly: heroFamilySecondaryOnly,
    distinctive: /lg:grid-cols-2/,
    withImage: true,
  },
  {
    id: "shadcnui-blocks.hero-03",
    Component: Hero03,
    View: Hero03View,
    cmsLike: heroFamilyWithImage,
    sparse: heroFamilySparse,
    long: heroFamilyLong,
    secondaryOnly: heroFamilySecondaryOnly,
    distinctive: /from-indigo-400\/90/,
    withImage: true,
    literalPreviewNavbar: true,
  },
  {
    id: "shadcnui-blocks.hero-04",
    Component: Hero04,
    View: Hero04View,
    cmsLike: heroFamilyWithImage,
    sparse: heroFamilySparse,
    long: heroFamilyLong,
    secondaryOnly: heroFamilySecondaryOnly,
    distinctive: /lg:h-\[calc\(100vh-4rem\)\]/,
    withImage: true,
  },
  {
    id: "shadcnui-blocks.hero-05",
    Component: Hero05,
    View: Hero05View,
    cmsLike: heroFamilyWithImage,
    sparse: heroFamilySparse,
    long: heroFamilyLong,
    secondaryOnly: heroFamilySecondaryOnly,
    distinctive: /lg:h-screen lg:w-\[1000px\]/,
    withImage: true,
  },
  {
    id: "shadcnui-blocks.hero-06",
    Component: Hero06,
    View: Hero06View,
    cmsLike: heroFamilyCmsLike,
    sparse: heroFamilySparse,
    long: heroFamilyLong,
    secondaryOnly: heroFamilySecondaryOnly,
    distinctive: /mask-\[radial-gradient\(ellipse/,
    withImage: false,
  },
  {
    id: "shadcnui-blocks.hero-07",
    Component: Hero07,
    View: Hero07View,
    cmsLike: heroFamilyCmsLike,
    sparse: heroFamilySparse,
    long: heroFamilyLong,
    secondaryOnly: heroFamilySecondaryOnly,
    distinctive: /skew-y-12/,
    withImage: false,
  },
  {
    id: "shadcnui-blocks.hero-08",
    Component: Hero08,
    View: Hero08View,
    cmsLike: hero08FamilyCmsLike,
    sparse: hero08FamilySparse,
    long: {
      ...heroFamilyLong,
      trustLabel: "Trusted by engineers at",
      logos: hero08FamilyCmsLike.logos,
    },
    secondaryOnly: {
      headline: hero08FamilyCmsLike.headline,
      secondary: hero08FamilyCmsLike.secondary,
    },
    distinctive: /Trusted by engineers at|grid-cols-2/,
    withImage: false,
    literalPreviewNavbar: true,
  },
]

for (const variant of heroFamily) {
  test(`${variant.id} public render outputs layout markup with rich text`, () => {
    const html = renderToStaticMarkup(React.createElement(variant.Component, {
      ...variant.cmsLike,
      blockIndex: 0,
    }))
    assert.match(html, variant.distinctive)
    assert.match(html, /Ship better UI without the hassle|Beautifully Designed/)
    assert.match(html, /Get Started|Watch Demo|Learn More/)
  })

  test(`${variant.id} sparse content renders headline without optional eyebrow`, () => {
    const html = renderToStaticMarkup(React.createElement(variant.Component, {
      ...variant.sparse,
      blockIndex: 0,
    }))
    assert.match(html, /Headline only/)
    if ("eyebrow" in variant.cmsLike) {
      assert.doesNotMatch(html, /Just released v1\.0\.0/)
    }
  })

  test(`${variant.id} secondary-only CTA renders without primary label`, () => {
    const html = renderToStaticMarkup(React.createElement(variant.Component, {
      ...variant.secondaryOnly,
      blockIndex: 0,
    }))
    assert.match(html, /Watch Demo|Learn More/)
    assert.doesNotMatch(html, />Get Started</)
  })

  test(`${variant.id} long title and description does not throw`, () => {
    assert.doesNotThrow(() => renderToStaticMarkup(React.createElement(variant.Component, {
      ...variant.long,
      blockIndex: 0,
    })))
  })

  test(`${variant.id} view maps block to typed component with provider attributes`, () => {
    const block = {
      blockType: "hero",
      headline: previewInlineText("Platform launch"),
      subheadline: previewInlineText("Built for teams."),
      cta: { label: "Start", href: "/start" },
      ...(variant.withImage
        ? { image: { url: "https://cdn.example.test/hero.png", alt: "Hero" } }
        : {}),
      ...(variant.id.endsWith("hero-08")
        ? { trustLabel: "Trusted by teams", logos: [{ name: "Acme", image: { url: "/logo.svg", alt: "Acme" } }] }
        : {}),
    }
    const html = renderToStaticMarkup(React.createElement(variant.View, {
      block,
      options: { index: 2 },
    }))
    assert.match(html, new RegExp(`data-provider-variant="${variant.id.replace(".", "\\.")}"`))
    assert.match(html, /data-block-index="2"/)
    assert.match(html, />Platform launch</)
    assert.match(html, /Start/)
  })

  if (variant.literalPreviewNavbar) {
    test(`${variant.id} literal preview renders embedded navigation chrome`, () => {
      const html = renderToStaticMarkup(React.createElement(variant.Component, {
        ...variant.cmsLike,
        blockIndex: 0,
        literalPreview: true,
      }))
      assert.match(html, /navbar|Navigation|Menu/i)
    })

    test(`${variant.id} structured render omits embedded navigation chrome`, () => {
      const html = renderToStaticMarkup(React.createElement(variant.Component, {
        ...variant.cmsLike,
        blockIndex: 0,
      }))
      assert.doesNotMatch(html, /data-provider-variant="shadcnui-blocks\.navbar/)
    })
  }
}

test("hero-02 editSlots use nested paths for hero image", () => {
  const called = []
  renderToStaticMarkup(React.createElement(Hero02, {
    ...heroFamilyWithImage,
    blockIndex: 4,
    editSlots: {
      renderImage: ({ elementPath, name }) => {
        called.push(`${name}:${elementPath.field}:${elementPath.blockIndex}`)
        return React.createElement("img", { "data-edit-image": elementPath.field, alt: "" })
      },
    },
  }))
  assert.deepEqual(called, ["hero.image:image:4"])
})

test("hero-08 editSlots use itemIndex for nested logo images", () => {
  const called = []
  renderToStaticMarkup(React.createElement(Hero08, {
    ...hero08FamilyCmsLike,
    logos: [
      { name: "Acme", image: { url: "/acme.svg", alt: "Acme" } },
      { name: "Globex", image: { url: "/globex.svg", alt: "Globex" } },
    ],
    blockIndex: 5,
    editSlots: {
      renderImage: ({ elementPath, name }) => {
        called.push(`${name}:${elementPath.field}:${elementPath.itemIndex}:${elementPath.subField}`)
        return React.createElement("img", { "data-edit-image": `${elementPath.itemIndex}`, alt: "" })
      },
    },
  }))
  assert.deepEqual(called, [
    "hero.logos.image:logos:0:image",
    "hero.logos.image:logos:1:image",
  ])
})
