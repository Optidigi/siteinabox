import { describe, it, expect } from "vitest"
import { mapHtmlToRt } from "@/lib/richText/mapper"
import type { RtManifest } from "@/lib/richText/manifest"

import { asMockDoc, rtParagraphChildren } from "../_helpers/cast"
import type { MockDoc } from "../_helpers/mockPayload"

const m: RtManifest = {
  version: 1,
  inlineMarks: { bold: true, italic: true },
  blockTypes: { paragraph: true, heading: { levels: [2, 3] } },
}

describe("mapHtmlToRt — hostile inputs", () => {
  it("drops <script> entirely", () => {
    const r = mapHtmlToRt(`<p>hi<script>alert(1)</script></p>`, { variant: "block", manifest: m })
    expect(rtParagraphChildren(r)).toEqual([{ t: "text", v: "hi" }])
  })

  it("strips inline event handlers + style + class + id", () => {
    const r = mapHtmlToRt(`<p onclick="x" style="color:red" class="c" id="i">hi</p>`, { variant: "block", manifest: m })
    expect(asMockDoc(asMockDoc(r).children)[0]).toEqual({ t: "paragraph", children: [{ t: "text", v: "hi" }] })
  })

  it("drops <iframe>, <object>, <embed> wholesale", () => {
    const r = mapHtmlToRt(`<p>a</p><iframe src="x"></iframe><object></object><embed></embed><p>b</p>`, { variant: "block", manifest: m })
    expect((asMockDoc(r).children as MockDoc[]).map((c) => c.t)).toEqual(["paragraph", "paragraph"])
  })

  it("aborts past maxNodes with an empty root", () => {
    const big = "<p>x</p>".repeat(5000)
    const r = mapHtmlToRt(big, { variant: "block", manifest: m, maxNodes: 100 })
    expect((asMockDoc(r).children as MockDoc[]).length).toBe(0)
  })
})
