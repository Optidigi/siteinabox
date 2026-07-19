import assert from "node:assert/strict"
import test from "node:test"
import * as React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import {
  testimonials01CmsLike,
  testimonials01EmptyItems,
  testimonials01Long,
  testimonials01Sparse,
} from "./typed/fixtures/testimonials-01.ts"
import {
  testimonials02CmsLike,
  testimonials03CmsLike,
  testimonials04CmsLike,
  testimonials05CmsLike,
  testimonials06CmsLike,
  testimonials07CmsLike,
  testimonials11CmsLike,
  testimonials13CmsLike,
  testimonialsFamilyCmsLike,
  testimonialsFamilyEmptyItems,
  testimonialsFamilyLong,
  testimonialsFamilySparse,
} from "./typed/fixtures/testimonials-family.ts"
import { Testimonials01 } from "./variants/testimonials-01/testimonials.tsx"
import Testimonials01View from "./variants/testimonials-01/view.tsx"
import { Testimonials02 } from "./variants/testimonials-02/testimonials.tsx"
import Testimonials02View from "./variants/testimonials-02/view.tsx"
import { Testimonials03 } from "./variants/testimonials-03/testimonials.tsx"
import Testimonials03View from "./variants/testimonials-03/view.tsx"
import { Testimonials04 } from "./variants/testimonials-04/testimonials.tsx"
import Testimonials04View from "./variants/testimonials-04/view.tsx"
import { Testimonials05 } from "./variants/testimonials-05/testimonials.tsx"
import Testimonials05View from "./variants/testimonials-05/view.tsx"
import { Testimonials06 } from "./variants/testimonials-06/testimonials.tsx"
import Testimonials06View from "./variants/testimonials-06/view.tsx"
import { Testimonials07 } from "./variants/testimonials-07/testimonials.tsx"
import Testimonials07View from "./variants/testimonials-07/view.tsx"
import { Testimonials08 } from "./variants/testimonials-08/testimonials.tsx"
import Testimonials08View from "./variants/testimonials-08/view.tsx"
import { Testimonials09 } from "./variants/testimonials-09/testimonials.tsx"
import Testimonials09View from "./variants/testimonials-09/view.tsx"
import { Testimonials10 } from "./variants/testimonials-10/testimonials.tsx"
import Testimonials10View from "./variants/testimonials-10/view.tsx"
import { Testimonials11 } from "./variants/testimonials-11/testimonials.tsx"
import Testimonials11View from "./variants/testimonials-11/view.tsx"
import { Testimonials12 } from "./variants/testimonials-12/testimonials.tsx"
import Testimonials12View from "./variants/testimonials-12/view.tsx"
import { Testimonials13 } from "./variants/testimonials-13/testimonials.tsx"
import Testimonials13View from "./variants/testimonials-13/view.tsx"

globalThis.React = React

const mediaResolver = (media) => ({ src: media.url, alt: media.alt })

const testimonialsFamily = [
  {
    id: "shadcnui-blocks.testimonials-01",
    Component: Testimonials01,
    View: Testimonials01View,
    cmsLike: testimonials01CmsLike,
    sparse: testimonials01Sparse,
    long: testimonials01Long,
    emptyItems: testimonials01EmptyItems,
    maxItems: 6,
    distinctive: /columns-1 gap-8 md:columns-2/,
    itemMatch: /Liam Martinez|Ava Thompson/,
  },
  {
    id: "shadcnui-blocks.testimonials-02",
    Component: Testimonials02,
    View: Testimonials02View,
    cmsLike: testimonials02CmsLike,
    sparse: testimonialsFamilySparse,
    long: testimonialsFamilyLong,
    emptyItems: testimonialsFamilyEmptyItems,
    maxItems: 6,
    distinctive: /border-border\/85 bg-card/,
    itemMatch: /Sarah Johnson|Raj Mehta/,
  },
  {
    id: "shadcnui-blocks.testimonials-03",
    Component: Testimonials03,
    View: Testimonials03View,
    cmsLike: testimonials03CmsLike,
    sparse: testimonialsFamilySparse,
    long: testimonialsFamilyLong,
    emptyItems: testimonialsFamilyEmptyItems,
    maxItems: 6,
    distinctive: /relative mb-8 break-inside-avoid/,
    itemMatch: /Sarah Johnson|Raj Mehta/,
  },
  {
    id: "shadcnui-blocks.testimonials-04",
    Component: Testimonials04,
    View: Testimonials04View,
    cmsLike: testimonials04CmsLike,
    sparse: testimonialsFamilySparse,
    long: testimonialsFamilyLong,
    emptyItems: testimonialsFamilyEmptyItems,
    maxItems: 6,
    distinctive: /mask-x-from-80%/,
    itemMatch: /Sarah Johnson|Raj Mehta/,
  },
  {
    id: "shadcnui-blocks.testimonials-05",
    Component: Testimonials05,
    View: Testimonials05View,
    cmsLike: testimonials05CmsLike,
    sparse: testimonialsFamilySparse,
    long: testimonialsFamilyLong,
    emptyItems: testimonialsFamilyEmptyItems,
    maxItems: 6,
    distinctive: /fill-yellow-500/,
    itemMatch: /Sarah Johnson|Raj Mehta/,
  },
  {
    id: "shadcnui-blocks.testimonials-06",
    Component: Testimonials06,
    View: Testimonials06View,
    cmsLike: testimonials06CmsLike,
    sparse: testimonialsFamilySparse,
    long: testimonialsFamilyLong,
    emptyItems: testimonialsFamilyEmptyItems,
    maxItems: 6,
    distinctive: /aria-roledescription="carousel"/,
    itemMatch: /Sarah Johnson|Raj Mehta/,
  },
  {
    id: "shadcnui-blocks.testimonials-07",
    Component: Testimonials07,
    View: Testimonials07View,
    cmsLike: testimonials07CmsLike,
    sparse: testimonialsFamilySparse,
    long: testimonialsFamilyLong,
    emptyItems: testimonialsFamilyEmptyItems,
    maxItems: 6,
    distinctive: /sm:grid-cols-2 lg:grid-cols-3/,
    itemMatch: /Sarah Johnson|Raj Mehta/,
  },
  {
    id: "shadcnui-blocks.testimonials-08",
    Component: Testimonials08,
    View: Testimonials08View,
    cmsLike: testimonialsFamilyCmsLike,
    sparse: testimonialsFamilySparse,
    long: testimonialsFamilyLong,
    emptyItems: testimonialsFamilyEmptyItems,
    maxItems: 6,
    distinctive: /font-satoshi text-8xl/,
    itemMatch: /Sarah Johnson|Raj Mehta/,
  },
  {
    id: "shadcnui-blocks.testimonials-09",
    Component: Testimonials09,
    View: Testimonials09View,
    cmsLike: testimonialsFamilyCmsLike,
    sparse: testimonialsFamilySparse,
    long: testimonialsFamilyLong,
    emptyItems: testimonialsFamilyEmptyItems,
    maxItems: 6,
    distinctive: /border-primary\/20 bg-linear-to-br/,
    itemMatch: /Sarah Johnson|Daniel Kim/,
  },
  {
    id: "shadcnui-blocks.testimonials-10",
    Component: Testimonials10,
    View: Testimonials10View,
    cmsLike: testimonialsFamilyCmsLike,
    sparse: testimonialsFamilySparse,
    long: testimonialsFamilyLong,
    emptyItems: testimonialsFamilyEmptyItems,
    maxItems: 6,
    distinctive: /ring-2 ring-border/,
    itemMatch: /Sarah Johnson|Daniel Kim/,
  },
  {
    id: "shadcnui-blocks.testimonials-11",
    Component: Testimonials11,
    View: Testimonials11View,
    cmsLike: testimonials11CmsLike,
    sparse: testimonialsFamilySparse,
    long: testimonialsFamilyLong,
    emptyItems: testimonialsFamilyEmptyItems,
    maxItems: 6,
    distinctive: /max-w-248/,
    itemMatch: /Sarah Johnson|Raj Mehta/,
  },
  {
    id: "shadcnui-blocks.testimonials-12",
    Component: Testimonials12,
    View: Testimonials12View,
    cmsLike: testimonialsFamilyCmsLike,
    sparse: testimonialsFamilySparse,
    long: testimonialsFamilyLong,
    emptyItems: testimonialsFamilyEmptyItems,
    maxItems: 6,
    distinctive: /bg-muted\/35 p-1/,
    itemMatch: /Sarah Johnson|Daniel Kim/,
  },
  {
    id: "shadcnui-blocks.testimonials-13",
    Component: Testimonials13,
    View: Testimonials13View,
    cmsLike: testimonials13CmsLike,
    sparse: testimonialsFamilySparse,
    long: testimonialsFamilyLong,
    emptyItems: testimonialsFamilyEmptyItems,
    maxItems: 6,
    distinctive: /mask-x-from-80% mt-14 space-y-px/,
    itemMatch: /Sarah Johnson|Raj Mehta/,
  },
]

for (const variant of testimonialsFamily) {
  test(`${variant.id} public render outputs layout markup with testimonial authors`, () => {
    const html = renderToStaticMarkup(React.createElement(variant.Component, {
      ...variant.cmsLike,
      blockIndex: 0,
      mediaResolver,
    }))
    assert.match(html, variant.distinctive)
    assert.match(html, variant.itemMatch)
  })

  test(`${variant.id} sparse content omits optional title`, () => {
    const html = renderToStaticMarkup(React.createElement(variant.Component, {
      ...variant.sparse,
      blockIndex: 0,
      mediaResolver,
    }))
    assert.doesNotMatch(html, /<h2/)
    assert.match(html, /Solo Author/)
  })

  test(`${variant.id} empty items renders without testimonial rows`, () => {
    const html = renderToStaticMarkup(React.createElement(variant.Component, {
      ...variant.emptyItems,
      blockIndex: 0,
      mediaResolver,
    }))
    assert.doesNotMatch(html, variant.itemMatch)
  })

  test(`${variant.id} long title and values do not throw`, () => {
    assert.doesNotThrow(() => renderToStaticMarkup(React.createElement(variant.Component, {
      ...variant.long,
      blockIndex: 0,
      mediaResolver,
    })))
  })

  test(`${variant.id} view maps block fields and provider attributes`, () => {
    const block = {
      blockType: "testimonials",
      title: variant.cmsLike.title,
      intro: variant.cmsLike.intro,
      items: variant.cmsLike.items,
    }
    const html = renderToStaticMarkup(React.createElement(variant.View, {
      block,
      options: { index: 2, mediaResolver },
    }))
    assert.match(html, new RegExp(`data-provider-variant="${variant.id.replace(".", "\\.")}"`))
    assert.match(html, /data-block-index="2"/)
    assert.match(html, variant.itemMatch)
  })

  if (variant.maxItems) {
    test(`${variant.id} respects static item capacity`, () => {
      const paddedItems = [...variant.cmsLike.items]
      while (paddedItems.length < variant.maxItems) {
        paddedItems.push({
          author: `Capacity filler ${paddedItems.length}`,
          role: `Role ${paddedItems.length}`,
          quote: `Quote ${paddedItems.length}`,
          avatar: { url: "https://cdn.example.test/filler.jpg", alt: "Filler" },
        })
      }
      const overflow = {
        ...variant.cmsLike,
        items: [
          ...paddedItems,
          {
            author: "Overflow author",
            role: "Overflow role",
            quote: "Overflow quote",
            avatar: { url: "https://cdn.example.test/overflow.jpg", alt: "Overflow" },
          },
        ],
      }
      const html = renderToStaticMarkup(React.createElement(variant.Component, {
        ...overflow,
        blockIndex: 0,
        mediaResolver,
      }))
      assert.doesNotMatch(html, /Overflow author/)
    })
  }
}

test("testimonials-01 editSlots use itemIndex for nested item fields", () => {
  const called = []
  const html = renderToStaticMarkup(React.createElement(Testimonials01, {
    title: testimonials01CmsLike.title,
    intro: testimonials01CmsLike.intro,
    items: testimonials01CmsLike.items,
    blockIndex: 3,
    editSlots: {
      renderText: ({ elementPath }) => {
        called.push(`text:${elementPath.field}:${elementPath.itemIndex}:${elementPath.subField}`)
        return React.createElement("span", {
          "data-edit-text": `${elementPath.field}:${elementPath.itemIndex}:${elementPath.subField}`,
        })
      },
      renderImage: ({ elementPath }) => {
        called.push(`image:${elementPath.field}:${elementPath.itemIndex}:${elementPath.subField}`)
        return React.createElement("img", {
          "data-edit-image": `${elementPath.field}:${elementPath.itemIndex}:${elementPath.subField}`,
          alt: "",
        })
      },
    },
    mediaResolver,
  }))
  assert.deepEqual(
    new Set(called),
    new Set([
      "text:title:undefined:undefined",
      "text:intro:undefined:undefined",
      "text:items:0:quote",
      "text:items:0:author",
      "text:items:0:role",
      "image:items:0:avatar",
      "text:items:1:quote",
      "text:items:1:author",
      "text:items:1:role",
      "image:items:1:avatar",
    ]),
  )
  assert.match(html, /data-edit-text="items:0:author"/)
  assert.match(html, /data-edit-image="items:1:avatar"/)
})

test("testimonials variants do not use LiteralProviderVariantView", async () => {
  const { readFile } = await import("node:fs/promises")
  for (const variant of testimonialsFamily) {
    const upstream = variant.id.replace("shadcnui-blocks.", "")
    const source = await readFile(new URL(`./variants/${upstream}/view.tsx`, import.meta.url), "utf8")
    assert.doesNotMatch(source, /LiteralProviderVariantView/)
  }
})
