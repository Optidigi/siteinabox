import { describe, it, expect } from "vitest"
import { mapHtmlToRt } from "@/lib/richText/mapper"
import type { RtManifest } from "@/lib/richText/manifest"

import { asMockDoc, rtParagraphChildren } from "../_helpers/cast"
import type { MockDoc } from "../_helpers/mockPayload"
const m: RtManifest = {
  version: 1,
  inlineMarks: { bold: true, italic: true },
  blockTypes: { paragraph: true, heading: { levels: [2, 3, 4] } },
}

describe("mapHtmlToRt — paragraphs + headings", () => {
  it("converts a single <p> with text", () => {
    expect(mapHtmlToRt("<p>hello</p>", { variant: "block", manifest: m })).toEqual({
      t: "root", variant: "block",
      children: [{ t: "paragraph", children: [{ t: "text", v: "hello" }] }],
    })
  })

  it("converts <h2>, <h3>, <h4> with allowed levels", () => {
    const r = mapHtmlToRt("<h2>A</h2><h3>B</h3><h4>C</h4>", { variant: "block", manifest: m })
    expect(r).toEqual({
      t: "root", variant: "block",
      children: [
        { t: "heading", level: 2, children: [{ t: "text", v: "A" }] },
        { t: "heading", level: 3, children: [{ t: "text", v: "B" }] },
        { t: "heading", level: 4, children: [{ t: "text", v: "C" }] },
      ],
    })
  })

  it("clamps <h1> to lowest allowed level", () => {
    const r = mapHtmlToRt("<h1>X</h1>", { variant: "block", manifest: m })
    expect(asMockDoc((asMockDoc(r).children as unknown[])[0]).level).toBe(2)
  })

  it("clamps <h5>/<h6> to highest allowed level (4)", () => {
    const r = mapHtmlToRt("<h5>X</h5>", { variant: "block", manifest: m })
    expect(asMockDoc((asMockDoc(r).children as unknown[])[0]).level).toBe(4)
  })
})
