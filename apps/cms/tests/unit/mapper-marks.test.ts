import { describe, it, expect } from "vitest"
import { mapHtmlToRt } from "@/lib/richText/mapper"
import type { RtManifest } from "@/lib/richText/manifest"

import { asMockDoc, rtParagraphChildren } from "../_helpers/cast"
const all: RtManifest = {
  version: 1,
  inlineMarks: { bold: true, italic: true, underline: true, code: true, strikethrough: true },
  blockTypes: { paragraph: true },
}

const boldOnly: RtManifest = {
  version: 1,
  inlineMarks: { bold: true },
  blockTypes: { paragraph: true },
}

describe("mapHtmlToRt — inline marks", () => {
  it("emits bold for <strong> and <b>", () => {
    const r = mapHtmlToRt("<p><strong>A</strong><b>B</b></p>", { variant: "block", manifest: all })
    expect(rtParagraphChildren(r)).toEqual([
      { t: "text", v: "A", marks: ["bold"] },
      { t: "text", v: "B", marks: ["bold"] },
    ])
  })

  it("emits italic for <em> and <i>", () => {
    const r = mapHtmlToRt("<p><em>A</em><i>B</i></p>", { variant: "block", manifest: all })
    expect(rtParagraphChildren(r)).toEqual([
      { t: "text", v: "A", marks: ["italic"] },
      { t: "text", v: "B", marks: ["italic"] },
    ])
  })

  it("emits underline / code / strikethrough only when manifest allows", () => {
    const r = mapHtmlToRt("<p><u>A</u><code>B</code><s>C</s></p>", { variant: "block", manifest: all })
    expect(rtParagraphChildren(r)).toEqual([
      { t: "text", v: "A", marks: ["underline"] },
      { t: "text", v: "B", marks: ["code"] },
      { t: "text", v: "C", marks: ["strikethrough"] },
    ])
  })

  it("drops disallowed marks but keeps text", () => {
    const r = mapHtmlToRt("<p><em>A</em></p>", { variant: "block", manifest: boldOnly })
    expect(rtParagraphChildren(r)).toEqual([{ t: "text", v: "A" }])
  })

  it("nests marks (em inside strong → both)", () => {
    const r = mapHtmlToRt("<p><strong><em>A</em></strong></p>", { variant: "block", manifest: all })
    expect(rtParagraphChildren(r)).toEqual([
      { t: "text", v: "A", marks: ["bold", "italic"] },
    ])
  })

  it("emits marks in canonical bit order regardless of HTML nesting", () => {
    // <em><strong>X</strong></em> nests italic outside bold, but the result
    // should still emit marks as ["bold", "italic"] (bit-order canonical).
    const r = mapHtmlToRt("<p><em><strong>A</strong></em></p>", { variant: "block", manifest: all })
    expect(rtParagraphChildren(r)).toEqual([
      { t: "text", v: "A", marks: ["bold", "italic"] },
    ])
  })

  it("emits all five marks in canonical bit order", () => {
    const r = mapHtmlToRt("<p><code><u><s><i><b>X</b></i></s></u></code></p>", { variant: "block", manifest: all })
    expect(rtParagraphChildren(r)).toEqual([
      { t: "text", v: "X", marks: ["bold", "italic", "strikethrough", "underline", "code"] },
    ])
  })
})
