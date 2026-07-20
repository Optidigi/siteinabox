import { describe, it, expect } from "vitest"
import { mapHtmlToRt } from "@/lib/richText/mapper"
import type { RtManifest } from "@/lib/richText/manifest"

import { asMockDoc, rtParagraphChildren } from "../_helpers/cast"
import type { MockDoc } from "../_helpers/mockPayload"

const m: RtManifest = { version: 1, inlineMarks: { bold: true }, blockTypes: { paragraph: true } }

describe("mapHtmlToRt — links", () => {
  it("converts an http(s) link", () => {
    const r = mapHtmlToRt(`<p><a href="https://example.com">go</a></p>`, { variant: "block", manifest: m })
    expect(rtParagraphChildren(r)).toEqual([
      { t: "link", href: "https://example.com", children: [{ t: "text", v: "go" }] },
    ])
  })

  it("converts a relative link", () => {
    const r = mapHtmlToRt(`<p><a href="/about">about</a></p>`, { variant: "block", manifest: m })
    expect(asMockDoc((rtParagraphChildren(r) as MockDoc[])[0]).href).toBe("/about")
  })

  it("converts a mailto link", () => {
    const r = mapHtmlToRt(`<p><a href="mailto:a@b.c">mail</a></p>`, { variant: "block", manifest: m })
    expect(asMockDoc((rtParagraphChildren(r) as MockDoc[])[0]).href).toBe("mailto:a@b.c")
  })

  it("rejects javascript: URLs — link dropped, text kept", () => {
    const r = mapHtmlToRt(`<p><a href="javascript:alert(1)">bad</a></p>`, { variant: "block", manifest: m })
    expect(rtParagraphChildren(r)).toEqual([{ t: "text", v: "bad" }])
  })

  it("rejects data: URLs — link dropped, text kept", () => {
    const r = mapHtmlToRt(`<p><a href="data:text/html;base64,XXX">x</a></p>`, { variant: "block", manifest: m })
    expect(rtParagraphChildren(r)).toEqual([{ t: "text", v: "x" }])
  })

  it("rejects empty href — link dropped, text kept", () => {
    const r = mapHtmlToRt(`<p><a href="">x</a></p>`, { variant: "block", manifest: m })
    expect(rtParagraphChildren(r)).toEqual([{ t: "text", v: "x" }])
  })
})
