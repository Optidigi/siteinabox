"use client"
import * as React from "react"
import type {
  RtRoot,
  RtBlock,
  RtInline,
  RtText,
  RtLink,
  RtListItem,
  RtThemed,
  RtAlign,
} from "@/lib/richText/RtNode"
import type { RtManifest } from "@/lib/richText/manifest"

/**
 * Pure read-only renderer for an RtRoot value. Mirrors the DOM contract
 * defined in docs/runbooks/rt-dom-contract.md so tenant CSS targets the
 * same classes whether the slot is read-only (this) or editable (Lexical).
 *
 * This file is a structural mirror of the shared live rich-text renderer:
 * emit identical rt-* DOM so tenant CSS applies identically in canvas
 * (sidebar/mobile read-only view) and on the live site.
 *
 * Why not Lexical here? LexicalField captures initialValue once at mount;
 * subsequent prop-change-triggered re-renders are ignored because Lexical
 * owns the editor state. For canvas slots in mobile/sidebar (read-only)
 * view, we want pure prop-driven rendering so bottom-sheet edits propagate
 * back to the canvas immediately. See RtSlot.tsx for the read-only branch.
 */
export interface RtStaticViewProps {
  value: RtRoot | undefined
  manifest?: RtManifest
  placeholder?: string
  blockMode?: "normal" | "inline" | "text"
}

type ThemedHandler = (node: RtThemed, key: number) => React.ReactNode

const alignClass = (align: RtAlign | undefined): string | undefined => {
  if (align === "center") return "text-center"
  if (align === "right") return "text-right"
  if (align === "justify") return "text-justify"
  if (align === "left") return "text-left"
  return undefined
}

const renderText = (n: RtText, key: number, manifest?: RtManifest): React.ReactNode => {
  // Build inside-out: text → marks → style → color → font. Order mirrors the
  // shared rich-text renderer so wrapper precedence matches.
  let out: React.ReactNode = n.v
  if (n.marks?.includes("bold")) out = <strong className="rt-b">{out}</strong>
  if (n.marks?.includes("italic")) out = <em className="rt-i">{out}</em>
  if (n.marks?.includes("underline")) out = <u className="rt-u">{out}</u>
  if (n.marks?.includes("code")) out = <code className="rt-code">{out}</code>
  if (n.marks?.includes("strikethrough")) out = <s className="rt-s">{out}</s>
  if (n.style) out = <span className={`rt-type-${n.style}`}>{out}</span>
  if (n.color) out = <span className={`rt-color-${n.color}`}>{out}</span>
  if (n.font) out = <span className={`rt-font-${n.font}`}>{out}</span>
  return <React.Fragment key={key}>{out}</React.Fragment>
}

const renderLink = (n: RtLink, key: number, manifest?: RtManifest): React.ReactNode => {
  const ext = n.rel === "external"
  return (
    <a
      key={key}
      className="rt-link"
      href={n.href}
      {...(ext ? { target: "_blank", rel: "noopener noreferrer" } : {})}
    >
      {n.children.map((child, i) => renderInline(child, i, manifest))}
    </a>
  )
}

const renderInline = (n: RtInline, key: number, manifest?: RtManifest): React.ReactNode => {
  if (n.t === "text") return renderText(n, key, manifest)
  if (n.t === "linebreak") return <br key={key} className="rt-br" />
  return renderLink(n, key, manifest)
}

const extractRtText = (value: RtRoot | undefined): string => {
  if (!value?.children?.length) return ""
  const parts: string[] = []
  const walkInline = (node: RtInline) => {
    if (node.t === "text") parts.push(node.v)
    else if (node.t === "linebreak") parts.push(" ")
    else node.children.forEach(walkInline)
  }
  const walkBlock = (node: RtBlock) => {
    switch (node.t) {
      case "paragraph":
      case "heading":
        node.children.forEach(walkInline)
        return
      case "list":
        node.items.forEach((item) => item.children.forEach(walkBlock))
        return
      case "blockquote":
        node.children.forEach(walkBlock)
        return
      case "themed":
        if (typeof node.props.text === "string") parts.push(node.props.text)
        node.children?.forEach(walkBlock)
        return
    }
  }
  if (value.variant === "inline") value.children.forEach(walkInline)
  else value.children.forEach(walkBlock)
  return parts.join(" ").replace(/\s+/g, " ").trim()
}

const renderBlockInline = (n: RtBlock, key: number, manifest?: RtManifest): React.ReactNode => {
  switch (n.t) {
    case "paragraph":
    case "heading":
      return <React.Fragment key={key}>{n.children.map((child, i) => renderInline(child, i, manifest))}</React.Fragment>
    case "list":
      return (
        <React.Fragment key={key}>
          {n.items.map((item, i) => (
            <React.Fragment key={i}>
              {i > 0 ? " " : null}
              {item.children.map((child, j) => renderBlockInline(child, j, manifest))}
            </React.Fragment>
          ))}
        </React.Fragment>
      )
    case "blockquote":
      return <React.Fragment key={key}>{n.children.map((child, i) => renderBlockInline(child, i, manifest))}</React.Fragment>
    case "themed":
      if (typeof n.props.text === "string") return <React.Fragment key={key}>{n.props.text}</React.Fragment>
      return <React.Fragment key={key}>{n.children?.map((child, i) => renderBlockInline(child, i, manifest))}</React.Fragment>
    case "divider":
      return null
  }
}

// Default themed handlers — keyed by manifest themedNode id. Themed nodes
// declared in a tenant's manifest but not present in this registry fall back
// to a generic `<div class="rt-themed rt-themed-<id>">` wrapper.
//
// Eyebrow emits a BLOCK-level wrapper (`<div>`) containing the rotated-accent
// `<span>`. The block wrapper centers itself and any immediately-following
// heading, replicating the v1 hand-typed `<div text-center>` group that
  // wrapped the eyebrow + following heading pair in earlier tenant themes.
const defaultThemedHandlers: Record<string, ThemedHandler> = {
  eyebrow: (node, key) => {
    const text = typeof node.props.text === "string" ? node.props.text : ""
    return (
      <div
        key={key}
        className="rt-themed rt-themed-eyebrow"
        data-rt-id="eyebrow"
      >
        <span
          className="inline-block -rotate-2 text-[20px] text-accent [font-family:var(--font-script)]"
        >
          {text}
        </span>
      </div>
    )
  },
}

const renderListItem = (li: RtListItem, key: number, manifest?: RtManifest): React.ReactNode => (
  <li key={key} className="rt-li">
    {li.children.map((child, i) => renderBlock(child, i, manifest))}
  </li>
)

const renderBlock = (n: RtBlock, key: number, manifest?: RtManifest): React.ReactNode => {
  switch (n.t) {
    case "paragraph": {
      const cls = ["rt-p", n.style ? `rt-type-${n.style}` : "", alignClass(n.align)].filter(Boolean).join(" ")
      return (
        <p key={key} className={cls}>
          {n.children.map((child, i) => renderInline(child, i, manifest))}
        </p>
      )
    }
    case "heading": {
      const cls = ["rt-h", `rt-h-${n.level}`, n.style ? `rt-type-${n.style}` : "", alignClass(n.align)].filter(Boolean).join(" ")
      const inner = n.children.map((child, i) => renderInline(child, i, manifest))
      if (n.level === 2) return <h2 key={key} className={cls}>{inner}</h2>
      if (n.level === 3) return <h3 key={key} className={cls}>{inner}</h3>
      return <h4 key={key} className={cls}>{inner}</h4>
    }
    case "list":
      return n.ordered ? (
        <ol key={key} className="rt-ol">
          {n.items.map((item, i) => renderListItem(item, i, manifest))}
        </ol>
      ) : (
        <ul key={key} className="rt-ul">
          {n.items.map((item, i) => renderListItem(item, i, manifest))}
        </ul>
      )
    case "blockquote":
      return (
        <blockquote key={key} className="rt-quote">
          {n.children.map((child, i) => renderBlock(child, i, manifest))}
        </blockquote>
      )
    case "divider":
      return <hr key={key} className="rt-hr" />
    case "themed": {
      const handler = defaultThemedHandlers[n.id]
      if (handler) return handler(n, key)
      return (
        <div
          key={key}
          className={`rt-themed rt-themed-${n.id}`}
          data-rt-id={n.id}
        >
          {n.children?.map((child, i) => renderBlock(child, i, manifest))}
        </div>
      )
    }
    default:
      return null
  }
}

export const RtStaticView: React.FC<RtStaticViewProps> = ({ value, manifest, placeholder, blockMode = "normal" }) => {
  if (!value || !value.children || value.children.length === 0) {
    void placeholder
    return null
  }

  if (value.variant === "inline") {
    return <>{value.children.map((child, i) => renderInline(child, i, manifest))}</>
  }

  if (blockMode === "text") return <>{extractRtText(value)}</>
  if (blockMode === "inline") {
    return <>{value.children.map((child, i) => renderBlockInline(child, i, manifest))}</>
  }

  return <>{value.children.map((child, i) => renderBlock(child, i, manifest))}</>
}
