import { describe, expect, it } from "vitest"
import { rtToLexicalJson } from "@/lib/richText/lexical/rtToLexical"
import { lexicalJsonToRt } from "@/lib/richText/lexical/lexicalToRt"
import type { RtRoot } from "@/lib/richText/RtNode"

import { asMockDoc } from "../../../_helpers/cast"
describe("heading style roundtrip", () => {
  it("preserves heading style through rt → lexical → rt", () => {
    const original: RtRoot = {
      t: "root", variant: "block",
      children: [
        { t: "heading", level: 2, style: "hero-eyebrow", children: [{ t: "text", v: "Hi" }] },
      ],
    }
    const lexical = rtToLexicalJson(original)
    const roundtripped = lexicalJsonToRt(lexical, "block")
    expect(roundtripped).toEqual(original)
  })

  it("preserves headings WITHOUT style (no spurious field)", () => {
    const original: RtRoot = {
      t: "root", variant: "block",
      children: [
        { t: "heading", level: 3, children: [{ t: "text", v: "Plain" }] },
      ],
    }
    const lexical = rtToLexicalJson(original)
    const roundtripped = lexicalJsonToRt(lexical, "block")
    expect(roundtripped).toEqual(original)
    expect(asMockDoc((asMockDoc(roundtripped).children as unknown[])[0]).style).toBeUndefined()
  })

  it("emits 'styled-heading' type when style is present, 'heading' when absent", () => {
    const styled = rtToLexicalJson({ t: "root", variant: "block", children: [
      { t: "heading", level: 2, style: "foo", children: [{ t: "text", v: "x" }] },
    ] })
    expect(asMockDoc((asMockDoc(asMockDoc(styled).root).children as unknown[])[0]).type).toBe("styled-heading")

    const plain = rtToLexicalJson({ t: "root", variant: "block", children: [
      { t: "heading", level: 2, children: [{ t: "text", v: "x" }] },
    ] })
    expect(asMockDoc((asMockDoc(asMockDoc(plain).root).children as unknown[])[0]).type).toBe("heading")
  })
})
