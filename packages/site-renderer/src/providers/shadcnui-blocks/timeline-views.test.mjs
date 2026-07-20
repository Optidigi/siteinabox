import assert from "node:assert/strict"
import test from "node:test"
import * as React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { timeline01Literal } from "./typed/fixtures/timeline-01.ts"
import {
  timeline05Literal,
  timeline07Literal,
  timelineFamilyCmsLike,
  timelineFamilyEmptyItems,
  timelineFamilyLong,
  timelineFamilySparse,
} from "./typed/fixtures/timeline-family.ts"
import { Timeline01 } from "./variants/timeline-01/timeline.tsx"
import Timeline01View from "./variants/timeline-01/view.tsx"
import { Timeline02 } from "./variants/timeline-02/timeline.tsx"
import Timeline02View from "./variants/timeline-02/view.tsx"
import { Timeline05 } from "./variants/timeline-05/timeline.tsx"
import Timeline05View from "./variants/timeline-05/view.tsx"
import { Timeline07 } from "./variants/timeline-07/timeline.tsx"
import Timeline07View from "./variants/timeline-07/view.tsx"

globalThis.React = React

const timelineFamily = [
  {
    id: "shadcnui-blocks.timeline-01",
    Component: Timeline01,
    View: Timeline01View,
    cmsLike: timelineFamilyCmsLike,
    sparse: timelineFamilySparse,
    long: timelineFamilyLong,
    emptyItems: timelineFamilyEmptyItems,
    distinctive: /border-l-2/,
    itemMatch: /Senior Full Stack Developer|TechCorp Solutions/,
  },
  {
    id: "shadcnui-blocks.timeline-02",
    Component: Timeline02,
    View: Timeline02View,
    cmsLike: timelineFamilyCmsLike,
    sparse: timelineFamilySparse,
    long: timelineFamilyLong,
    emptyItems: timelineFamilyEmptyItems,
    distinctive: /ring-8 ring-background/,
    itemMatch: /Senior Full Stack Developer/,
  },
  {
    id: "shadcnui-blocks.timeline-05",
    Component: Timeline05,
    View: Timeline05View,
    cmsLike: timeline05Literal,
    sparse: { items: [{ title: "Only step", description: "Single step" }] },
    long: timelineFamilyLong,
    emptyItems: timelineFamilyEmptyItems,
    distinctive: /border-muted-foreground\/40/,
    itemMatch: /Research|Planning/,
  },
  {
    id: "shadcnui-blocks.timeline-07",
    Component: Timeline07,
    View: Timeline07View,
    cmsLike: timeline07Literal,
    sparse: { items: [{ title: "Release", description: "Notes", label: "1.0.0", date: "2025-01-01" }] },
    long: timelineFamilyLong,
    emptyItems: timelineFamilyEmptyItems,
    distinctive: /group-last:pb-4/,
    itemMatch: /API Integration|Initial Release/,
  },
]

for (const variant of timelineFamily) {
  test(`${variant.id} public render outputs layout markup`, () => {
    const html = renderToStaticMarkup(React.createElement(variant.Component, {
      ...variant.cmsLike,
      blockIndex: 0,
    }))
    assert.match(html, variant.distinctive)
    assert.match(html, variant.itemMatch)
  })

  test(`${variant.id} sparse content renders minimal item`, () => {
    const html = renderToStaticMarkup(React.createElement(variant.Component, {
      ...variant.sparse,
      blockIndex: 0,
    }))
    assert.match(html, /Only|Research|Release/)
  })

  test(`${variant.id} empty items renders without item rows`, () => {
    const html = renderToStaticMarkup(React.createElement(variant.Component, {
      ...variant.emptyItems,
      blockIndex: 0,
    }))
    assert.doesNotMatch(html, variant.itemMatch)
  })

  test(`${variant.id} view maps block fields and provider attributes`, () => {
    const block = { blockType: "timeline", items: variant.cmsLike.items }
    const html = renderToStaticMarkup(React.createElement(variant.View, {
      block,
      options: { index: 2 },
    }))
    assert.match(html, new RegExp(`data-provider-variant="${variant.id.replace(".", "\\.")}"`))
    assert.match(html, /data-block-index="2"/)
  })
}
