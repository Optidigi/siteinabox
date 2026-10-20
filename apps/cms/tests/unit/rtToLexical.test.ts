import { describe, it, expect } from "vitest"
import { $getRoot, createEditor } from "@payloadcms/richtext-lexical/lexical"
import { rtToLexicalJson } from "@/lib/richText/lexical/rtToLexical"
import { $generateNodesFromSerializedNodes, $insertGeneratedNodes } from "@lexical/clipboard"
import { lexicalJsonToRt } from "@/lib/richText/lexical/lexicalToRt"
import { buildLexicalNodes } from "@/lib/richText/lexical/buildNodeConfig"
import type { RtBlockRoot } from "@/lib/richText/RtNode"

import type { MockDoc } from "../_helpers/mockPayload"

const lexicalChildren = (j: ReturnType<typeof rtToLexicalJson>) => j.root.children!
const editor = () => createEditor({ namespace: "test", nodes: buildLexicalNodes("block"), onError: (e) => { throw e } })

describe("rtToLexicalJson", () => {
  it("converts empty block root — injects a default empty paragraph", () => {
    // Lexical's root MUST contain ≥1 ElementNode child to mount; an empty
    // RtBlockRoot (e.g. unfilled optional field) maps to a single empty
    // paragraph so the editor renders a usable empty line.
    // The lexicalToRt reverse converter collapses this back to children:[]
    // so round-trip identity with EMPTY_BLOCK is preserved.
    const root: RtBlockRoot = { t: "root", variant: "block", children: [] }
    const j = rtToLexicalJson(root)
    expect(j.root.type).toBe("root")
    expect(j.root.children).toHaveLength(1)
    expect(lexicalChildren(j)[0]).toMatchObject({ type: "paragraph", children: [] })
  })

  it("converts a paragraph with bold text", () => {
    const root: RtBlockRoot = { t: "root", variant: "block", children: [
      { t: "paragraph", style: "lead", children: [{ t: "text", v: "hi", marks: ["bold"], color: "accent", font: "heading" }] }
    ]}
    const j = rtToLexicalJson(root, {
      version: 1,
      inlineMarks: { bold: true },
      blockTypes: { paragraph: true, heading: { levels: [2] } },
      colorTokens: [{ id: "accent", label: "Accent", cssVar: "--color-accent" }],
      fontFamilies: [{ id: "heading", label: "Heading font", cssVar: "--font-heading" }],
    })
    expect(lexicalChildren(j)[0]).toMatchObject({ type: "styled-paragraph", style: "lead" })
    expect(lexicalChildren(j)[0]!.children![0]).toMatchObject({ type: "text", text: "hi", format: 1 })
    expect(lexicalChildren(j)[0]!.children![0]!.style).toContain("--rt-color:accent")
    expect(lexicalChildren(j)[0]!.children![0]!.style).toContain("color:var(--color-accent)")
    expect(lexicalChildren(j)[0]!.children![0]!.style).toContain("--rt-font:heading")
    expect(lexicalChildren(j)[0]!.children![0]!.style).toContain("font-family:var(--font-heading)")
  })

  it("converts heading + list + link + themed", () => {
    const root: RtBlockRoot = { t: "root", variant: "block", children: [
      { t: "heading", level: 2, children: [{ t: "text", v: "T" }] },
      { t: "list", ordered: false, items: [
        { t: "listItem", children: [{ t: "paragraph", children: [{ t: "text", v: "a" }] }] },
      ]},
      { t: "paragraph", children: [
        { t: "link", href: "/about", children: [{ t: "text", v: "about" }] },
      ]},
      { t: "themed", id: "eyebrow", props: { text: "Over mij" } },
    ]}
    const j = rtToLexicalJson(root)
    const types = lexicalChildren(j).map((c: MockDoc) => c.type)
    expect(types).toEqual(["heading", "list", "paragraph", "themed"])
  })
})

describe("Payload-owned Lexical custom content compatibility", () => {
  it("loads and copies custom styled content through the real editor and paste API", () => {
    const original: RtBlockRoot = { t: "root", variant: "block", children: [
      { t: "heading", level: 2, style: "hero-eyebrow", children: [{ t: "text", v: "Amicare fixture" }] },
      { t: "paragraph", style: "lead", children: [
        { t: "text", v: "Care", marks: ["bold"], color: "accent", font: "heading" },
        { t: "link", href: "/contact", children: [{ t: "text", v: "Contact" }] },
      ] },
      { t: "themed", id: "eyebrow", props: { text: "Sanitized fixture" } },
    ] }
    const source = editor()
    source.setEditorState(source.parseEditorState(JSON.stringify(rtToLexicalJson(original))))
    const copied = source.getEditorState().toJSON()
    expect(lexicalJsonToRt(copied, "block")).toEqual(original)

    const target = editor()
    target.update(() => {
      const nodes = $generateNodesFromSerializedNodes(copied.root.children)
      $insertGeneratedNodes(target, nodes, $getRoot().selectEnd())
    }, { discrete: true })
    expect(lexicalJsonToRt(target.getEditorState().toJSON(), "block")).toEqual(original)
  })
})
