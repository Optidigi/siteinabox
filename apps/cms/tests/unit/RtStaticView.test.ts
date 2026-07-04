import { describe, it, expect } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import * as React from "react"
import { RtStaticView } from "@/components/editor/canvas/inline/RtStaticView"

const render = (root: any) =>
  renderToStaticMarkup(React.createElement(RtStaticView, { value: root }))

describe("RtStaticView", () => {
  it("renders a paragraph with bold + italic text per the rt-* contract", () => {
    // RtNode uses v (not text) and marks[] array (not format bitmask).
    // Wrapper order mirrors the shared rich-text renderer: bold is applied
    // first (innermost), then italic wraps around it, etc. — so
    // <em class="rt-i"> wraps <strong class="rt-b">.
    const html = render({
      t: "root", variant: "block",
      children: [{
        t: "paragraph",
        children: [
          { t: "text", v: "Hello ", marks: [] },
          { t: "text", v: "world", marks: ["bold", "italic"] },
        ],
      }],
    })
    expect(html).toContain("<p class=\"rt-p\">")
    expect(html).toContain("<em class=\"rt-i\"><strong class=\"rt-b\">world</strong></em>")
  })

  it("renders paragraph and heading type styles on their block elements", () => {
    const html = render({
      t: "root", variant: "block",
      children: [
        { t: "paragraph", style: "lead", children: [{ t: "text", v: "Lead", marks: [] }] },
        { t: "heading", level: 2, style: "hero-title", children: [{ t: "text", v: "Title", marks: [] }] },
      ],
    })
    expect(html).toContain("<p class=\"rt-p rt-type-lead\">Lead</p>")
    expect(html).toContain("<h2 class=\"rt-h rt-h-2 rt-type-hero-title\">Title</h2>")
  })

  it("renders paragraph and heading alignment as classes rather than inline styles", () => {
    const html = render({
      t: "root", variant: "block",
      children: [
        { t: "paragraph", align: "center", children: [{ t: "text", v: "Centered", marks: [] }] },
        { t: "heading", level: 3, align: "right", children: [{ t: "text", v: "Right", marks: [] }] },
      ],
    })

    expect(html).toContain("<p class=\"rt-p text-center\">Centered</p>")
    expect(html).toContain("<h3 class=\"rt-h rt-h-3 text-right\">Right</h3>")
    expect(html).not.toContain("style=\"text-align")
  })

  it("renders font family classes without inline styles", () => {
    const html = renderToStaticMarkup(React.createElement(RtStaticView, {
      value: {
        t: "root", variant: "inline",
        children: [{ t: "text", v: "Title-ish", font: "title" }],
      },
      manifest: {
        version: 1,
        inlineMarks: {},
        blockTypes: { paragraph: true },
        fontFamilies: [{ id: "title", label: "Title font", cssVar: "--font-title" }],
      },
    }))
    expect(html).toContain("class=\"rt-font-title\"")
    expect(html).not.toContain("style=")
  })

  it("renders a heading with two-class contract (rt-h + rt-h-N)", () => {
    const html = render({
      t: "root", variant: "block",
      children: [{ t: "heading", level: 3, children: [{ t: "text", v: "Hi", marks: [] }] }],
    })
    expect(html).toContain("<h3 class=\"rt-h rt-h-3\">Hi</h3>")
  })

  it("renders bullet + ordered lists with the rt-ul/rt-ol contract", () => {
    // RtNode uses ordered: boolean and items: RtListItem[] (not children).
    // ListItem t is "listItem" (camelCase) with children: RtBlock[].
    const ul = render({
      t: "root", variant: "block",
      children: [{ t: "list", ordered: false, items: [
        { t: "listItem", children: [{ t: "paragraph", children: [{ t: "text", v: "A", marks: [] }] }] },
      ]}],
    })
    const ol = render({
      t: "root", variant: "block",
      children: [{ t: "list", ordered: true, items: [
        { t: "listItem", children: [{ t: "paragraph", children: [{ t: "text", v: "1", marks: [] }] }] },
      ]}],
    })
    expect(ul).toContain("<ul class=\"rt-ul\">")
    expect(ul).toContain("<li class=\"rt-li\">")
    expect(ol).toContain("<ol class=\"rt-ol\">")
    expect(ol).toContain("<li class=\"rt-li\">")
  })

  it("renders a link as <a class=\"rt-link\"> with the requested href", () => {
    // RtNode link uses href (not url), children are RtInline[].
    const html = render({
      t: "root", variant: "inline",
      children: [{ t: "link", href: "https://example.com",
        children: [{ t: "text", v: "ex", marks: [] }] }],
    })
    expect(html).toContain("<a class=\"rt-link\" href=\"https://example.com\">ex</a>")
  })

  it("renders an external link with target=_blank + rel noopener", () => {
    const html = render({
      t: "root", variant: "inline",
      children: [{ t: "link", href: "https://example.com", rel: "external",
        children: [{ t: "text", v: "ex", marks: [] }] }],
    })
    expect(html).toContain("target=\"_blank\"")
    expect(html).toContain("rel=\"noopener noreferrer\"")
  })

  it("renders a blockquote with the rt-quote class", () => {
    const html = render({
      t: "root", variant: "block",
      children: [{ t: "blockquote", children: [
        { t: "paragraph", children: [{ t: "text", v: "q", marks: [] }] },
      ]}],
    })
    expect(html).toContain("<blockquote class=\"rt-quote\">")
  })

  it("renders a divider with the rt-hr class", () => {
    const html = render({
      t: "root", variant: "block",
      children: [{ t: "divider" }],
    })
    expect(html).toContain("<hr class=\"rt-hr\"")
  })

  it("renders the themed eyebrow as the styled rotated-accent span", () => {
    // The eyebrow handler reads node.props.text and emits a block-level
    // div containing the rotated-accent span. This is the canonical
    // styled eyebrow markup matching the shared rich-text renderer.
    const html = render({
      t: "root", variant: "block",
      children: [{
        t: "themed",
        id: "eyebrow",
        props: { text: "Hello" },
      }],
    })
    expect(html).toContain("<div class=\"rt-themed rt-themed-eyebrow\" data-rt-id=\"eyebrow\">")
    expect(html).toContain("Hello")
    expect(html).toContain("-rotate-2")
    expect(html).toContain("var(--font-script)")
  })

  it("renders an unknown themed node with the generic wrapper", () => {
    const html = render({
      t: "root", variant: "block",
      children: [{
        t: "themed",
        id: "custom-badge",
        props: {},
        children: [{ t: "paragraph", children: [{ t: "text", v: "x", marks: [] }] }],
      }],
    })
    expect(html).toContain("<div class=\"rt-themed rt-themed-custom-badge\" data-rt-id=\"custom-badge\">")
    expect(html).toContain("<p class=\"rt-p\">")
  })

  it("renders all four mark types with their rt-* classes", () => {
    const html = render({
      t: "root", variant: "inline",
      children: [
        { t: "text", v: "u", marks: ["underline"] },
        { t: "text", v: "s", marks: ["strikethrough"] },
        { t: "text", v: "c", marks: ["code"] },
      ],
    })
    expect(html).toContain("<u class=\"rt-u\">u</u>")
    expect(html).toContain("<s class=\"rt-s\">s</s>")
    expect(html).toContain("<code class=\"rt-code\">c</code>")
  })

  it("renders empty rich-text values as empty static DOM for live-site fidelity", () => {
    const html = renderToStaticMarkup(React.createElement(RtStaticView, { value: undefined, placeholder: "Headline…" }))
    expect(html).toBe("")
  })
})
