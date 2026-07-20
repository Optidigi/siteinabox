import { describe, it, expect } from "vitest"
import { mapHtmlToRt } from "@/lib/richText/mapper"
import type { RtManifest } from "@/lib/richText/manifest"

import { asMockDoc } from "../_helpers/cast"

const m: RtManifest = {
  version: 1,
  inlineMarks: { bold: true },
  blockTypes: { paragraph: true, bulletList: true, orderedList: true, blockquote: true, divider: true },
}

describe("mapHtmlToRt — lists / quotes / dividers", () => {
  it("converts <ul><li>", () => {
    const r = mapHtmlToRt("<ul><li>A</li><li>B</li></ul>", { variant: "block", manifest: m })
    expect(asMockDoc(asMockDoc(r).children)[0]).toEqual({
      t: "list", ordered: false,
      items: [
        { t: "listItem", children: [{ t: "paragraph", children: [{ t: "text", v: "A" }] }] },
        { t: "listItem", children: [{ t: "paragraph", children: [{ t: "text", v: "B" }] }] },
      ],
    })
  })

  it("converts <ol><li>", () => {
    const r = mapHtmlToRt("<ol><li>A</li></ol>", { variant: "block", manifest: m })
    expect(asMockDoc((asMockDoc(r).children as unknown[])[0]).ordered).toBe(true)
  })

  it("converts <blockquote>", () => {
    const r = mapHtmlToRt("<blockquote><p>A</p></blockquote>", { variant: "block", manifest: m })
    expect(asMockDoc(asMockDoc(r).children)[0]).toEqual({
      t: "blockquote",
      children: [{ t: "paragraph", children: [{ t: "text", v: "A" }] }],
    })
  })

  it("converts <hr> to divider", () => {
    const r = mapHtmlToRt("<hr>", { variant: "block", manifest: m })
    expect(asMockDoc(asMockDoc(r).children)[0]).toEqual({ t: "divider" })
  })
})
