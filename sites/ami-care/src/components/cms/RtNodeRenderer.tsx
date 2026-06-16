import { cloneElement, isValidElement } from "preact"
import type { ComponentChild } from "preact"
import type {
  RtRoot, RtBlock, RtInline, RtText, RtLink, RtListItem, RtThemed,
} from "../../lib/richText"
import { isRtRoot } from "../../lib/richText"

/**
 * Rich text v2 renderer.
 *
 * Walks an `RtRoot` tree and emits DOM with the `rt-*` class names defined in
 * siab-payload/docs/runbooks/rt-dom-contract.md. Tenant CSS in src/styles/
 * rich-text.css supplies the visual treatment.
 *
 * Accepts either:
 *   - `node`: an RtRoot (full tree)
 *   - `inline`: an array of RtInline (when only the inline children are needed,
 *     used by callers that provide their own block-level wrapper, e.g. Hero's
 *     <h1>).
 *
 * The renderer is presentation-only: it has no editor coupling, no Lexical
 * dependency, and tolerates `null` / non-RtRoot values gracefully so a
 * legacy plain-string projection or an empty document doesn't crash the site.
 */

type ThemedHandler = (node: RtThemed) => ComponentChild

const renderText = (n: RtText) => {
  // Build inside-out: text → marks → style → color
  let out: ComponentChild = n.v
  if (n.marks?.includes("bold")) out = <strong class="rt-b">{out}</strong>
  if (n.marks?.includes("italic")) out = <em class="rt-i">{out}</em>
  if (n.marks?.includes("underline")) out = <u class="rt-u">{out}</u>
  if (n.marks?.includes("code")) out = <code class="rt-code">{out}</code>
  if (n.marks?.includes("strikethrough")) out = <s class="rt-s">{out}</s>
  if (n.style) out = <span class={`rt-type-${n.style}`}>{out}</span>
  if (n.color) out = <span class={`rt-color-${n.color}`}>{out}</span>
  if (n.font) out = <span class={`rt-font-${n.font}`}>{out}</span>
  return out
}

const renderLink = (n: RtLink) => {
  const ext = n.rel === "external"
  return (
    <a
      class="rt-link"
      href={n.href}
      {...(ext ? { target: "_blank", rel: "noopener noreferrer" } : {})}
    >
      {n.children.map(renderInline)}
    </a>
  )
}

const renderInline = (n: RtInline, i?: number): ComponentChild => {
  if (n.t === "text") return <span key={i}>{renderText(n)}</span>
  if (n.t === "linebreak") return <br key={i} class="rt-br" />
  return <span key={i}>{renderLink(n)}</span>
}

// Default themed handlers — keyed by manifest themedNode id. Themed nodes
// declared in a tenant's manifest but not present in this registry fall back
// to a generic `<div class="rt-themed rt-themed-<id>">` wrapper.
//
// Eyebrow emits a BLOCK-level wrapper (`<div>`) containing the rotated-accent
// `<span>`. The block wrapper centers itself and any immediately-following
// heading, replicating the v1 hand-typed `<div text-center>` group that
// wrapped the eyebrow + h2 pair on ami-care.nl's "Over mij" section.
const defaultThemedHandlers: Record<string, ThemedHandler> = {
  eyebrow: (node) => {
    const text = typeof node.props.text === "string" ? node.props.text : ""
    return (
      <div class="rt-themed rt-themed-eyebrow" data-rt-id="eyebrow">
        <span
          class="inline-block -rotate-2 text-[20px] text-accent"
          style={{ fontFamily: "var(--font-script)" }}
        >
          {text}
        </span>
      </div>
    )
  },
}

const renderListItem = (li: RtListItem, i: number) => (
  <li key={i} class="rt-li">{li.children.map(renderBlock)}</li>
)

const renderBlock = (n: RtBlock, i?: number): ComponentChild => {
  switch (n.t) {
    case "paragraph": {
      const alignStyle = n.align ? { textAlign: n.align } : undefined
      return <p key={i} class="rt-p" style={alignStyle}>{n.children.map(renderInline)}</p>
    }
    case "heading": {
      const cls = `rt-h rt-h-${n.level}`
      const alignStyle = n.align ? { textAlign: n.align } : undefined
      if (n.level === 2) return <h2 key={i} class={cls} style={alignStyle}>{n.children.map(renderInline)}</h2>
      if (n.level === 3) return <h3 key={i} class={cls} style={alignStyle}>{n.children.map(renderInline)}</h3>
      return <h4 key={i} class={cls} style={alignStyle}>{n.children.map(renderInline)}</h4>
    }
    case "list":
      return n.ordered
        ? <ol key={i} class="rt-ol">{n.items.map(renderListItem)}</ol>
        : <ul key={i} class="rt-ul">{n.items.map(renderListItem)}</ul>
    case "blockquote":
      return <blockquote key={i} class="rt-quote">{n.children.map(renderBlock)}</blockquote>
    case "divider":
      return <hr key={i} class="rt-hr" />
    case "themed": {
      const handler = defaultThemedHandlers[n.id]
      if (handler) {
        // Don't wrap in <span> — that breaks adjacent-sibling CSS selectors
        // like `.rt-themed-eyebrow + .rt-h-2` because the eyebrow's sibling
        // becomes the wrapping span, not the heading. Use cloneElement to
        // attach the array key to the handler's root element directly.
        const node = handler(n)
        if (isValidElement(node)) return cloneElement(node as any, { key: i })
        return node
      }
      return (
        <div key={i} class={`rt-themed rt-themed-${n.id}`} data-rt-id={n.id}>
          {n.children?.map(renderBlock)}
        </div>
      )
    }
  }
}

export type RtNodeRendererProps = {
  /** Full RtRoot — block or inline variant. */
  node?: RtRoot | null | unknown
  /** Bare inline list when the caller provides its own block wrapper. */
  inline?: RtInline[] | null
}

export default function RtNodeRenderer({ node, inline }: RtNodeRendererProps) {
  if (inline) return <>{inline.map(renderInline)}</>
  if (!isRtRoot(node)) return null
  if (node.variant === "inline") return <>{node.children.map(renderInline)}</>
  return <>{node.children.map(renderBlock)}</>
}

/** Convenience: walks an RtRoot and returns its first text content as a plain
 * string, for use in `<title>`, meta tags, and other DOM-text-only contexts.
 * Used by SEO components that can't render marked-up children. */
export const extractText = (node: unknown): string => {
  if (!isRtRoot(node)) return typeof node === "string" ? node : ""
  const parts: string[] = []
  const walkInline = (n: RtInline) => {
    if (n.t === "text") parts.push(n.v)
    else if (n.t === "link") n.children.forEach(walkInline)
  }
  const walkBlock = (n: RtBlock) => {
    switch (n.t) {
      case "paragraph":
      case "heading":
        n.children.forEach(walkInline)
        return
      case "list":
        n.items.forEach((li) => li.children.forEach(walkBlock))
        return
      case "blockquote":
        n.children.forEach(walkBlock)
        return
      case "themed":
        if (typeof n.props.text === "string") parts.push(n.props.text)
        n.children?.forEach(walkBlock)
        return
    }
  }
  if (node.variant === "inline") node.children.forEach(walkInline)
  else node.children.forEach(walkBlock)
  return parts.join(" ").replace(/\s+/g, " ").trim()
}
