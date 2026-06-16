import { cloneElement, isValidElement } from "preact"
import type { ComponentChild } from "preact"
import type {
  RtBlock,
  RtInline,
  RtRoot,
  RtText,
  RtThemed,
  RtListItem,
} from "../../lib/types"

type ThemedHandler = (node: RtThemed) => ComponentChild

const isRtRoot = (v: unknown): v is RtRoot =>
  typeof v === "object" &&
  v !== null &&
  (v as any).t === "root" &&
  ((v as any).variant === "block" || (v as any).variant === "inline") &&
  Array.isArray((v as any).children)

const renderText = (n: RtText) => {
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

const renderInline = (n: RtInline, i?: number): ComponentChild => {
  if (n.t === "text") return <span key={i}>{renderText(n)}</span>
  if (n.t === "linebreak") return <br key={i} class="rt-br" />
  const ext = n.rel === "external"
  return (
    <a
      key={i}
      class="rt-link"
      href={n.href}
      {...(ext ? { target: "_blank", rel: "noopener noreferrer" } : {})}
    >
      {n.children.map(renderInline)}
    </a>
  )
}

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
  node?: RtRoot | null | unknown
  inline?: RtInline[] | null
}

export function RtNodeRenderer({ node, inline }: RtNodeRendererProps) {
  if (inline) return <>{inline.map(renderInline)}</>
  if (!isRtRoot(node)) return null
  if (node.variant === "inline") return <>{node.children.map(renderInline)}</>
  return <>{node.children.map(renderBlock)}</>
}

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
