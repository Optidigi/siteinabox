import * as React from "react"
import type {
  RtAlign,
  RtBlock,
  RtInline,
  RtLink,
  RtListItem,
  RtRoot,
  RtText,
  RtThemed,
} from "@siteinabox/contracts"
import { isRtRoot } from "@siteinabox/contracts/rich-text"

type ThemedHandler = (node: RtThemed, key: number) => React.ReactNode

export type RichTextRendererProps = {
  value?: RtRoot | null | unknown
  inline?: RtInline[] | null
  blockMode?: "normal" | "inline" | "text"
  themedHandlers?: Record<string, ThemedHandler>
}

const alignClass = (align: RtAlign | undefined): string | undefined => {
  if (align === "center") return "text-center"
  if (align === "right") return "text-right"
  if (align === "justify") return "text-justify"
  if (align === "left") return "text-left"
  return undefined
}

const defaultThemedHandlers: Record<string, ThemedHandler> = {
  eyebrow: (node, key) => {
    const text = typeof node.props.text === "string" ? node.props.text : ""
    return (
      <div key={key} className="rt-themed rt-themed-eyebrow" data-rt-id="eyebrow">
        <span className="inline-block -rotate-2 text-[20px] text-accent [font-family:var(--font-script)]">
          {text}
        </span>
      </div>
    )
  },
}

function renderText(node: RtText, key: number): React.ReactNode {
  let out: React.ReactNode = node.v
  if (node.marks?.includes("bold")) out = <strong className="rt-b">{out}</strong>
  if (node.marks?.includes("italic")) out = <em className="rt-i">{out}</em>
  if (node.marks?.includes("underline")) out = <u className="rt-u">{out}</u>
  if (node.marks?.includes("code")) out = <code className="rt-code">{out}</code>
  if (node.marks?.includes("strikethrough")) out = <s className="rt-s">{out}</s>
  if (node.style) out = <span className={`rt-type-${node.style}`}>{out}</span>
  if (node.color) out = <span className={`rt-color-${node.color}`}>{out}</span>
  if (node.font) out = <span className={`rt-font-${node.font}`}>{out}</span>
  return <React.Fragment key={key}>{out}</React.Fragment>
}

function renderLink(node: RtLink, key: number, handlers: Record<string, ThemedHandler>): React.ReactNode {
  const external = node.rel === "external"
  return (
    <a
      key={key}
      className="rt-link"
      href={node.href}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
    >
      {node.children.map((child, i) => renderInline(child, i, handlers))}
    </a>
  )
}

function renderInline(node: RtInline, key: number, handlers: Record<string, ThemedHandler>): React.ReactNode {
  if (node.t === "text") return renderText(node, key)
  if (node.t === "linebreak") return <br key={key} className="rt-br" />
  return renderLink(node, key, handlers)
}

function renderBlockInline(node: RtBlock, key: number, handlers: Record<string, ThemedHandler>): React.ReactNode {
  switch (node.t) {
    case "paragraph":
    case "heading":
      return <React.Fragment key={key}>{node.children.map((child, i) => renderInline(child, i, handlers))}</React.Fragment>
    case "list":
      return (
        <React.Fragment key={key}>
          {node.items.map((item, i) => (
            <React.Fragment key={i}>
              {i > 0 ? " " : null}
              {item.children.map((child, j) => renderBlockInline(child, j, handlers))}
            </React.Fragment>
          ))}
        </React.Fragment>
      )
    case "blockquote":
      return <React.Fragment key={key}>{node.children.map((child, i) => renderBlockInline(child, i, handlers))}</React.Fragment>
    case "themed":
      if (typeof node.props.text === "string") return <React.Fragment key={key}>{node.props.text}</React.Fragment>
      return <React.Fragment key={key}>{node.children?.map((child, i) => renderBlockInline(child, i, handlers))}</React.Fragment>
    case "divider":
      return null
  }
}

function renderListItem(item: RtListItem, key: number, handlers: Record<string, ThemedHandler>): React.ReactNode {
  return (
    <li key={key} className="rt-li">
      {item.children.map((child, i) => renderBlock(child, i, handlers))}
    </li>
  )
}

function renderBlock(node: RtBlock, key: number, handlers: Record<string, ThemedHandler>): React.ReactNode {
  switch (node.t) {
    case "paragraph": {
      const className = ["rt-p", node.style ? `rt-type-${node.style}` : "", alignClass(node.align)].filter(Boolean).join(" ")
      return <p key={key} className={className}>{node.children.map((child, i) => renderInline(child, i, handlers))}</p>
    }
    case "heading": {
      const className = ["rt-h", `rt-h-${node.level}`, node.style ? `rt-type-${node.style}` : "", alignClass(node.align)].filter(Boolean).join(" ")
      const inner = node.children.map((child, i) => renderInline(child, i, handlers))
      if (node.level === 2) return <h2 key={key} className={className}>{inner}</h2>
      if (node.level === 3) return <h3 key={key} className={className}>{inner}</h3>
      return <h4 key={key} className={className}>{inner}</h4>
    }
    case "list":
      return node.ordered ? (
        <ol key={key} className="rt-ol">{node.items.map((item, i) => renderListItem(item, i, handlers))}</ol>
      ) : (
        <ul key={key} className="rt-ul">{node.items.map((item, i) => renderListItem(item, i, handlers))}</ul>
      )
    case "blockquote":
      return <blockquote key={key} className="rt-quote">{node.children.map((child, i) => renderBlock(child, i, handlers))}</blockquote>
    case "divider":
      return <hr key={key} className="rt-hr" />
    case "themed": {
      const handler = handlers[node.id]
      if (handler) return handler(node, key)
      return (
        <div key={key} className={`rt-themed rt-themed-${node.id}`} data-rt-id={node.id}>
          {node.children?.map((child, i) => renderBlock(child, i, handlers))}
        </div>
      )
    }
  }
}

export function extractRichText(value: unknown): string {
  if (!isRtRoot(value)) return typeof value === "string" ? value : ""
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
      case "divider":
        return
    }
  }

  if (value.variant === "inline") value.children.forEach(walkInline)
  else value.children.forEach(walkBlock)

  return parts.join(" ").replace(/\s+/g, " ").trim()
}

export function RichTextRenderer({
  value,
  inline,
  blockMode = "normal",
  themedHandlers,
}: RichTextRendererProps) {
  const handlers = { ...defaultThemedHandlers, ...themedHandlers }

  if (inline) return <>{inline.map((child, i) => renderInline(child, i, handlers))}</>
  if (!isRtRoot(value)) return null
  if (value.variant === "inline") return <>{value.children.map((child, i) => renderInline(child, i, handlers))}</>
  if (blockMode === "text") return <>{extractRichText(value)}</>
  if (blockMode === "inline") return <>{value.children.map((child, i) => renderBlockInline(child, i, handlers))}</>
  return <>{value.children.map((child, i) => renderBlock(child, i, handlers))}</>
}
