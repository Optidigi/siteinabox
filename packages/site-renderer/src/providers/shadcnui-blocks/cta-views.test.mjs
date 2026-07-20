import assert from "node:assert/strict"
import test from "node:test"
import * as React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import {
  cta01CmsLike,
  cta01Long,
  cta01Sparse,
} from "./typed/fixtures/cta-01.ts"
import {
  cta02Long,
  cta02Sparse,
  cta03Literal,
  cta03Sparse,
  cta04Literal,
  cta04Sparse,
  cta05Literal,
  cta05SecondaryOnly,
  cta05Sparse,
  cta06Literal,
  cta06Sparse,
  cta07Literal,
  cta07Sparse,
} from "./typed/fixtures/cta-family.ts"
import { Cta01 } from "./variants/cta-01/cta.tsx"
import Cta01View from "./variants/cta-01/view.tsx"
import { Cta02 } from "./variants/cta-02/cta.tsx"
import Cta02View from "./variants/cta-02/view.tsx"
import { Cta03 } from "./variants/cta-03/cta.tsx"
import Cta03View from "./variants/cta-03/view.tsx"
import { Cta04 } from "./variants/cta-04/cta.tsx"
import Cta04View from "./variants/cta-04/view.tsx"
import { Cta05 } from "./variants/cta-05/cta.tsx"
import Cta05View from "./variants/cta-05/view.tsx"
import { Cta06 } from "./variants/cta-06/cta.tsx"
import Cta06View from "./variants/cta-06/view.tsx"
import { Cta07 } from "./variants/cta-07/cta.tsx"
import Cta07View from "./variants/cta-07/view.tsx"

globalThis.React = React

const ctaFamily = [
  {
    id: "shadcnui-blocks.cta-01",
    Component: Cta01,
    View: Cta01View,
    cmsLike: cta01CmsLike,
    sparse: cta01Sparse,
    long: cta01Long,
    distinctive: {
      markup: /tracking-tighter/,
      absent: /backgroundImage|secondary/,
    },
  },
  {
    id: "shadcnui-blocks.cta-02",
    Component: Cta02,
    View: Cta02View,
    cmsLike: {
      headline: cta03Literal.headline,
      description: cta03Literal.description,
      primary: { label: "Download", href: "/download" },
      backgroundImage: { url: "https://cdn.example.test/hero.png", alt: "Hero" },
    },
    sparse: cta02Sparse,
    long: cta02Long,
    distinctive: {
      markup: /from-black to-black\/50/,
      className: "absolute inset-0 size-full object-cover",
    },
  },
  {
    id: "shadcnui-blocks.cta-03",
    Component: Cta03,
    View: Cta03View,
    cmsLike: {
      ...cta03Literal,
      primary: { label: "Download", href: "/download" },
      backgroundImage: { url: "https://cdn.example.test/mobile.png", alt: "Mobile" },
    },
    sparse: cta03Sparse,
    long: cta02Long,
    distinctive: {
      markup: /bg-linear-to-r from-muted/,
      className: "mt-auto aspect-square",
    },
  },
  {
    id: "shadcnui-blocks.cta-04",
    Component: Cta04,
    View: Cta04View,
    cmsLike: {
      ...cta04Literal,
      backgroundImage: { url: "https://cdn.example.test/product.png", alt: "Product" },
    },
    sparse: cta04Sparse,
    long: cta02Long,
    distinctive: {
      markup: /--provider-grid-line/,
      className: "mask-b-from-75%",
    },
  },
  {
    id: "shadcnui-blocks.cta-05",
    Component: Cta05,
    View: Cta05View,
    cmsLike: cta05Literal,
    sparse: cta05Sparse,
    secondaryOnly: cta05SecondaryOnly,
    long: cta02Long,
    distinctive: {
      markup: /linear-gradient\(150deg/,
      secondaryLabel: "View Components",
    },
  },
  {
    id: "shadcnui-blocks.cta-06",
    Component: Cta06,
    View: Cta06View,
    cmsLike: cta06Literal,
    sparse: cta06Sparse,
    secondaryOnly: cta05SecondaryOnly,
    long: cta02Long,
    distinctive: {
      markup: /text-foreground tracking-\[-0\.04em\]/,
      secondaryLabel: "View Components",
    },
  },
  {
    id: "shadcnui-blocks.cta-07",
    Component: Cta07,
    View: Cta07View,
    cmsLike: cta07Literal,
    sparse: cta07Sparse,
    long: cta02Long,
    distinctive: {
      markup: /rounded-3xl bg-foreground/,
      svg: /cs_clip_1_flower-10/,
    },
  },
]

for (const variant of ctaFamily) {
  test(`${variant.id} public render outputs content and distinctive layout`, () => {
    const html = renderToStaticMarkup(React.createElement(variant.Component, {
      ...variant.cmsLike,
      blockIndex: 0,
    }))
    assert.match(html, variant.distinctive.markup)
    if (variant.distinctive.className) assert.match(html, new RegExp(variant.distinctive.className.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))
    if (variant.distinctive.secondaryLabel) assert.match(html, new RegExp(`>${variant.distinctive.secondaryLabel}<`))
    if (variant.distinctive.svg) assert.match(html, variant.distinctive.svg)
    if (variant.distinctive.absent) assert.doesNotMatch(html, variant.distinctive.absent)
  })

  test(`${variant.id} sparse content omits optional fields`, () => {
    const html = renderToStaticMarkup(React.createElement(variant.Component, {
      ...variant.sparse,
      blockIndex: 0,
    }))
    assert.doesNotMatch(html, /<a /)
    if (variant.id !== "shadcnui-blocks.cta-07") {
      assert.doesNotMatch(html, /text-muted-foreground|text-white\/85/)
    }
  })

  test(`${variant.id} long headline does not throw`, () => {
    assert.doesNotThrow(() => renderToStaticMarkup(React.createElement(variant.Component, {
      ...variant.long,
      blockIndex: 0,
    })))
  })

  if (variant.secondaryOnly) {
    test(`${variant.id} renders secondary without primary`, () => {
      const html = renderToStaticMarkup(React.createElement(variant.Component, {
        ...variant.secondaryOnly,
        blockIndex: 0,
      }))
      assert.match(html, />View Components</)
      assert.doesNotMatch(html, />Get Started</)
    })
  }

  test(`${variant.id} view maps block to typed component with provider attributes`, () => {
    const block = {
      blockType: "cta",
      headline: { t: "root", variant: "inline", children: [{ t: "text", v: "Ready to start?" }] },
      description: { t: "root", variant: "block", children: [{ t: "paragraph", children: [{ t: "text", v: "Send a message." }] }] },
      primary: { label: "Email", href: "mailto:hello@example.test" },
      ...(variant.cmsLike.backgroundImage ? { backgroundImage: variant.cmsLike.backgroundImage } : {}),
      ...(variant.cmsLike.secondary ? { secondary: variant.cmsLike.secondary } : {}),
    }
    const html = renderToStaticMarkup(React.createElement(variant.View, {
      block,
      options: { index: 2 },
    }))
    assert.match(html, new RegExp(`data-provider-variant="${variant.id.replace(".", "\\.")}"`))
    assert.match(html, /data-block-index="2"/)
    assert.match(html, />Ready to start\?</)
    assert.match(html, />Send a message\./)
    assert.match(html, /href="mailto:hello@example\.test"/)
  })
}

test("cta-01 editSlots invoked for headline, description, and primary", () => {
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

test("cta-02 literal preview renders fallback background image", () => {
  const html = renderToStaticMarkup(React.createElement(Cta02, {
    ...cta03Literal,
    blockIndex: 0,
    literalPreview: true,
  }))
  assert.match(html, /src="\/images\/ascii-art\.png"/)
})

test("cta-02 with background image uses resolved media in public render", () => {
  const html = renderToStaticMarkup(React.createElement(Cta02, {
    headline: cta02Sparse.headline,
    backgroundImage: { url: "https://cdn.example.test/bg.png", alt: "Background" },
    blockIndex: 0,
    mediaResolver: (ref) => ({ src: typeof ref === "object" && ref && "url" in ref ? ref.url ?? "" : "", alt: "Background" }),
  }))
  assert.match(html, /src="https:\/\/cdn\.example\.test\/bg\.png"/)
})

test("cta-05 editSlots invoked for primary and secondary", () => {
  const called = []
  renderToStaticMarkup(React.createElement(Cta05, {
    ...cta05Literal,
    blockIndex: 1,
    editSlots: {
      renderRichText: ({ elementPath }) => {
        called.push(`rich:${elementPath.field}`)
        return React.createElement("span", null, elementPath.field)
      },
      renderCta: ({ elementPath }) => {
        called.push(`cta:${elementPath.field}`)
        return React.createElement("a", { href: "#" }, elementPath.field)
      },
    },
  }))
  assert.deepEqual(new Set(called), new Set(["rich:headline", "rich:description", "cta:primary", "cta:secondary"]))
})
