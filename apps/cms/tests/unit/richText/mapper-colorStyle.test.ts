import { describe, expect, it } from "vitest"
import { mapHtmlToRt } from "@/lib/richText/mapper"
import type { RtManifest } from "@/lib/richText/manifest"

import { asMockDoc, rtParagraphChildren } from "../../_helpers/cast"

const manifest: RtManifest = {
  version: 1,
  inlineMarks: { bold: true, italic: true },
  blockTypes: { paragraph: true, heading: { levels: [2, 3] } },
  colorTokens: [{ id: "accent", label: "Accent", cssVar: "--color-accent" }],
  fontFamilies: [{ id: "heading", label: "Heading font", cssVar: "--font-heading" }],
  typeStyles: [
    { id: "lead", label: "Lead", appliesTo: "inline" },
    { id: "intro", label: "Intro", appliesTo: "paragraph" },
    { id: "hero-eyebrow", label: "Hero eyebrow", appliesTo: "heading" },
  ],
}

describe("mapHtmlToRt — declared color/style classes", () => {
  it("maps rt-color-accent on a span to text.color = accent", () => {
    const root = mapHtmlToRt('<p>plain <span class="rt-color-accent">tinted</span></p>', { variant: "block", manifest })
    expect(root).toEqual({
      t: "root", variant: "block", children: [
        { t: "paragraph", children: [
          { t: "text", v: "plain " },
          { t: "text", v: "tinted", color: "accent" },
        ] },
      ],
    })
  })

  it("maps rt-type-lead on a span to text.style = lead", () => {
    const root = mapHtmlToRt('<p>plain <span class="rt-type-lead">leady</span></p>', { variant: "block", manifest })
    expect(asMockDoc((rtParagraphChildren(root) as unknown[])[1])).toMatchObject({ t: "text", v: "leady", style: "lead" })
  })

  it("maps rt-font-heading on a span to text.font = heading", () => {
    const root = mapHtmlToRt('<p>plain <span class="rt-font-heading">serif</span></p>', { variant: "block", manifest })
    expect(asMockDoc((rtParagraphChildren(root) as unknown[])[1])).toMatchObject({ t: "text", v: "serif", font: "heading" })
  })

  it("maps paragraph-scoped rt-type classes on p to paragraph.style", () => {
    const root = mapHtmlToRt('<p class="rt-p rt-type-intro">plain <span class="rt-type-intro">ignored</span></p>', { variant: "block", manifest })
    expect(root.children[0]).toEqual({
      t: "paragraph",
      style: "intro",
      children: [
        { t: "text", v: "plain " },
        { t: "text", v: "ignored" },
      ],
    })
  })

  it("drops undeclared rt-color / rt-type / rt-font classes (no field set)", () => {
    const root = mapHtmlToRt('<p><span class="rt-color-bogus rt-type-ghost rt-font-script">x</span></p>', { variant: "block", manifest })
    expect(asMockDoc((rtParagraphChildren(root) as unknown[])[0])).toEqual({ t: "text", v: "x" })
  })

  it("maps rt-type-hero-eyebrow class on h2 to heading.style", () => {
    const root = mapHtmlToRt('<h2 class="rt-h rt-h-2 rt-type-hero-eyebrow">Eyebrow</h2>', { variant: "block", manifest })
    expect(root.children[0]).toMatchObject({ t: "heading", level: 2, style: "hero-eyebrow" })
  })
})
