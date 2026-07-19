import assert from "node:assert/strict"
import test from "node:test"
import * as React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import {
  stats01CmsLike,
  stats01EmptyItems,
  stats01Long,
  stats01Sparse,
} from "./typed/fixtures/stats-01.ts"
import {
  stats02CmsLike,
  stats06CmsLike,
  stats11CmsLike,
  statsFamilyCmsLike,
  statsFamilyEmptyItems,
  statsFamilyLong,
  statsFamilySparse,
} from "./typed/fixtures/stats-family.ts"
import { Stats01 } from "./variants/stats-01/stats.tsx"
import Stats01View from "./variants/stats-01/view.tsx"
import { Stats02 } from "./variants/stats-02/stats.tsx"
import Stats02View from "./variants/stats-02/view.tsx"
import { Stats03 } from "./variants/stats-03/stats.tsx"
import Stats03View from "./variants/stats-03/view.tsx"
import { Stats04 } from "./variants/stats-04/stats.tsx"
import Stats04View from "./variants/stats-04/view.tsx"
import { Stats05 } from "./variants/stats-05/stats.tsx"
import Stats05View from "./variants/stats-05/view.tsx"
import { Stats06 } from "./variants/stats-06/stats.tsx"
import Stats06View from "./variants/stats-06/view.tsx"
import { Stats07 } from "./variants/stats-07/stats.tsx"
import Stats07View from "./variants/stats-07/view.tsx"
import { Stats08 } from "./variants/stats-08/stats.tsx"
import Stats08View from "./variants/stats-08/view.tsx"
import { Stats09 } from "./variants/stats-09/stats.tsx"
import Stats09View from "./variants/stats-09/view.tsx"
import { Stats10 } from "./variants/stats-10/stats.tsx"
import Stats10View from "./variants/stats-10/view.tsx"
import { Stats11 } from "./variants/stats-11/stats.tsx"
import Stats11View from "./variants/stats-11/view.tsx"

globalThis.React = React

const statsFamily = [
  {
    id: "shadcnui-blocks.stats-01",
    Component: Stats01,
    View: Stats01View,
    cmsLike: stats01CmsLike,
    sparse: stats01Sparse,
    long: stats01Long,
    emptyItems: stats01EmptyItems,
    maxItems: 3,
    distinctive: /max-w-\(--breakpoint-lg\)/,
  },
  {
    id: "shadcnui-blocks.stats-02",
    Component: Stats02,
    View: Stats02View,
    cmsLike: stats02CmsLike,
    sparse: statsFamilySparse,
    long: statsFamilyLong,
    emptyItems: statsFamilyEmptyItems,
    maxItems: 4,
    distinctive: /lg:grid-cols-4/,
  },
  {
    id: "shadcnui-blocks.stats-03",
    Component: Stats03,
    View: Stats03View,
    cmsLike: statsFamilyCmsLike,
    sparse: statsFamilySparse,
    long: statsFamilyLong,
    emptyItems: statsFamilyEmptyItems,
    maxItems: 3,
    distinctive: /rounded-xl border px-8 py-10/,
  },
  {
    id: "shadcnui-blocks.stats-04",
    Component: Stats04,
    View: Stats04View,
    cmsLike: statsFamilyCmsLike,
    sparse: statsFamilySparse,
    long: statsFamilyLong,
    emptyItems: statsFamilyEmptyItems,
    maxItems: 3,
    distinctive: /overflow-hidden rounded-2xl border/,
  },
  {
    id: "shadcnui-blocks.stats-05",
    Component: Stats05,
    View: Stats05View,
    cmsLike: statsFamilyCmsLike,
    sparse: statsFamilySparse,
    long: statsFamilyLong,
    emptyItems: statsFamilyEmptyItems,
    maxItems: 3,
    distinctive: /text-blue-500/,
  },
  {
    id: "shadcnui-blocks.stats-06",
    Component: Stats06,
    View: Stats06View,
    cmsLike: stats06CmsLike,
    sparse: statsFamilySparse,
    long: statsFamilyLong,
    emptyItems: statsFamilyEmptyItems,
    maxItems: 5,
    distinctive: /border-red-200 bg-red-50/,
  },
  {
    id: "shadcnui-blocks.stats-07",
    Component: Stats07,
    View: Stats07View,
    cmsLike: statsFamilyCmsLike,
    sparse: statsFamilySparse,
    long: statsFamilyLong,
    emptyItems: statsFamilyEmptyItems,
    maxItems: 3,
    distinctive: /rounded-2xl border bg-muted p-1/,
  },
  {
    id: "shadcnui-blocks.stats-08",
    Component: Stats08,
    View: Stats08View,
    cmsLike: stats01CmsLike,
    sparse: stats01Sparse,
    long: stats01Long,
    emptyItems: stats01EmptyItems,
    maxItems: 3,
    distinctive: /min-h-screen/,
  },
  {
    id: "shadcnui-blocks.stats-09",
    Component: Stats09,
    View: Stats09View,
    cmsLike: stats01CmsLike,
    sparse: stats01Sparse,
    long: stats01Long,
    emptyItems: stats01EmptyItems,
    maxItems: 3,
    distinctive: /lg:divide-x/,
  },
  {
    id: "shadcnui-blocks.stats-10",
    Component: Stats10,
    View: Stats10View,
    cmsLike: stats01CmsLike,
    sparse: stats01Sparse,
    long: stats01Long,
    emptyItems: stats01EmptyItems,
    maxItems: 3,
    distinctive: /md:flex-row/,
  },
  {
    id: "shadcnui-blocks.stats-11",
    Component: Stats11,
    View: Stats11View,
    cmsLike: stats11CmsLike,
    sparse: statsFamilySparse,
    long: statsFamilyLong,
    emptyItems: statsFamilyEmptyItems,
    maxItems: 3,
    distinctive: /rounded-2xl bg-muted px-6 py-16/,
  },
]

for (const variant of statsFamily) {
  test(`${variant.id} public render outputs layout markup with stat values`, () => {
    const html = renderToStaticMarkup(React.createElement(variant.Component, {
      ...variant.cmsLike,
      blockIndex: 0,
    }))
    assert.match(html, variant.distinctive)
    assert.match(html, />70%|96%|900\+</)
    assert.match(html, /Faster UI development|of customers say|Global styles/)
  })

  test(`${variant.id} sparse content omits optional title`, () => {
    const html = renderToStaticMarkup(React.createElement(variant.Component, {
      ...variant.sparse,
      blockIndex: 0,
    }))
    assert.doesNotMatch(html, /<h2/)
    assert.match(html, /42%/)
  })

  test(`${variant.id} empty items renders without item rows`, () => {
    const html = renderToStaticMarkup(React.createElement(variant.Component, {
      ...variant.emptyItems,
      blockIndex: 0,
    }))
    assert.doesNotMatch(html, /70%|96%|900\+/)
  })

  test(`${variant.id} long title and values do not throw`, () => {
    assert.doesNotThrow(() => renderToStaticMarkup(React.createElement(variant.Component, {
      ...variant.long,
      blockIndex: 0,
    })))
  })

  test(`${variant.id} view maps block fields and provider attributes`, () => {
    const block = {
      blockType: "stats",
      title: variant.cmsLike.title,
      intro: variant.cmsLike.intro,
      items: variant.cmsLike.items,
    }
    const html = renderToStaticMarkup(React.createElement(variant.View, {
      block,
      options: { index: 2 },
    }))
    assert.match(html, new RegExp(`data-provider-variant="${variant.id.replace(".", "\\.")}"`))
    assert.match(html, /data-block-index="2"/)
    assert.match(html, />70%|96%|900\+</)
  })

  if (variant.maxItems) {
    test(`${variant.id} respects static item capacity`, () => {
      const paddedItems = [...variant.cmsLike.items]
      while (paddedItems.length < variant.maxItems) {
        paddedItems.push({ value: `${paddedItems.length}%`, label: `Capacity filler ${paddedItems.length}` })
      }
      const overflow = {
        ...variant.cmsLike,
        items: [
          ...paddedItems,
          { value: "999%", label: "Overflow stat" },
        ],
      }
      const html = renderToStaticMarkup(React.createElement(variant.Component, {
        ...overflow,
        blockIndex: 0,
      }))
      assert.doesNotMatch(html, /Overflow stat/)
    })
  }
}

test("stats-01 editSlots use itemIndex for nested stat fields", () => {
  const called = []
  const html = renderToStaticMarkup(React.createElement(Stats01, {
    title: stats01CmsLike.title,
    intro: stats01CmsLike.intro,
    items: stats01CmsLike.items,
    blockIndex: 3,
    editSlots: {
      renderRichText: ({ elementPath }) => {
        called.push(`rich:${elementPath.field}`)
        return React.createElement("span", { "data-edit-rich": elementPath.field })
      },
      renderText: ({ elementPath }) => {
        called.push(`text:${elementPath.field}:${elementPath.itemIndex}:${elementPath.subField}`)
        return React.createElement("span", {
          "data-edit-text": `${elementPath.field}:${elementPath.itemIndex}:${elementPath.subField}`,
        })
      },
    },
  }))
  assert.deepEqual(
    new Set(called),
    new Set([
      "rich:title",
      "rich:intro",
      "text:items:0:value",
      "text:items:0:label",
      "text:items:1:value",
      "text:items:1:label",
    ]),
  )
  assert.match(html, /data-edit-text="items:0:value"/)
  assert.match(html, /data-edit-text="items:1:label"/)
})

test("stats variants do not use LiteralProviderVariantView", async () => {
  const { readFile } = await import("node:fs/promises")
  for (const variant of statsFamily) {
    const upstream = variant.id.replace("shadcnui-blocks.", "")
    const source = await readFile(new URL(`./variants/${upstream}/view.tsx`, import.meta.url), "utf8")
    assert.doesNotMatch(source, /LiteralProviderVariantView/)
  }
})
